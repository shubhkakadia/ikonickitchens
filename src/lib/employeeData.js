import crypto from "crypto";

// Fields only a master-admin may read or write through the employee API.
export const SENSITIVE_EMPLOYEE_FIELDS = [
  "dob",
  "address",
  "bank_account_name",
  "bank_account_number",
  "bank_account_bsb",
  "supper_account_name",
  "supper_account_number",
  "tfn_number",
  "abn_number",
];

// Encrypted at rest (AES-256-GCM); shown masked even to master-admin.
const ENCRYPTED_FIELDS = ["tfn_number", "bank_account_number"];
const MASKED_FIELDS = [
  "tfn_number",
  "bank_account_number",
  "supper_account_number",
];

const NON_SENSITIVE_SCALARS = [
  "id",
  "createdAt",
  "updatedAt",
  "employee_id",
  "first_name",
  "last_name",
  "image_id",
  "role",
  "email",
  "phone",
  "phone_secondary",
  "join_date",
  "emergency_contact_name",
  "emergency_contact_phone",
  "education",
  "availability",
  "notes",
  "is_active",
  "is_deleted",
];

// Shared select for every caller below master-admin: no financial/PII fields.
export const EMPLOYEE_PUBLIC_SELECT = {
  ...Object.fromEntries(NON_SENSITIVE_SCALARS.map((f) => [f, true])),
  image: true,
};

export const isMasterAdmin = (auth) => auth?.userType === "master-admin";

// Prisma query args: master-admin gets every column, others the public select.
export function employeeQueryArgs(auth) {
  return isMasterAdmin(auth)
    ? { include: { image: true } }
    : { select: EMPLOYEE_PUBLIC_SELECT };
}

// ---- encryption at rest ----------------------------------------------------

const PREFIX = "enc:v1:";

function getKey() {
  const secret = process.env.EMPLOYEE_DATA_KEY;
  if (!secret) return null;
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptValue(value) {
  if (value === null || value === undefined || value === "") return value;
  const text = String(value);
  if (text.startsWith(PREFIX)) return text;
  const key = getKey();
  if (!key) {
    console.warn("EMPLOYEE_DATA_KEY is not set; storing value unencrypted");
    return text;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptValue(value) {
  if (typeof value !== "string" || !value.startsWith(PREFIX)) return value;
  const key = getKey();
  if (!key) return null;
  try {
    const buf = Buffer.from(value.slice(PREFIX.length), "base64");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      buf.subarray(0, 12),
    );
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([
      decipher.update(buf.subarray(28)),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    console.error("Failed to decrypt employee field:", error.message);
    return null;
  }
}

// ---- masking / presentation -----------------------------------------------

export function maskTail(value, visible = 4) {
  if (!value) return value;
  const text = String(value);
  return `***${text.slice(-visible)}`;
}

export const isMaskedValue = (value) =>
  typeof value === "string" && value.startsWith("***");

// Response shape for one employee row. Non-master rows were already
// restricted by the select; this also strips them defensively and masks
// the number fields for master-admin.
export function presentEmployee(employee, auth) {
  if (!employee) return employee;
  const out = { ...employee };
  if (!isMasterAdmin(auth)) {
    for (const f of SENSITIVE_EMPLOYEE_FIELDS) delete out[f];
    return out;
  }
  for (const f of MASKED_FIELDS) {
    if (out[f]) out[f] = maskTail(decryptValue(out[f]));
  }
  return out;
}

export const presentEmployees = (list, auth) =>
  list.map((e) => presentEmployee(e, auth));

// Prepares sensitive fields from a request body for writing: non-master
// callers cannot write them; masked echoes are ignored; secrets encrypted.
export function sanitizeSensitiveInput(data, auth) {
  const out = { ...data };
  for (const f of SENSITIVE_EMPLOYEE_FIELDS) {
    if (!(f in out)) continue;
    const keepExisting =
      MASKED_FIELDS.includes(f) && (isMaskedValue(out[f]) || out[f] === "");
    if (!isMasterAdmin(auth) || keepExisting) {
      delete out[f];
    } else if (ENCRYPTED_FIELDS.includes(f)) {
      out[f] = encryptValue(out[f]);
    }
  }
  return out;
}
