export const MODULE_ACCESS_KEYS = [
  "all_clients",
  "add_clients",
  "client_details",
  "dashboard",
  "delete_media",
  "all_employees",
  "add_employees",
  "employee_details",
  "all_projects",
  "add_projects",
  "project_details",
  "all_suppliers",
  "add_suppliers",
  "supplier_details",
  "all_items",
  "add_items",
  "item_details",
  "usedmaterial",
  "logs",
  "lotatglance",
  "materialstoorder",
  "purchaseorder",
  "statements",
  "site_photos",
  "site_measurements",
  "config",
  "calendar",
];

export const MIN_PASSWORD_LENGTH = 8;

const toFlag = (value) => value === true || value === "true";

/**
 * Builds module_access data from untrusted input, accepting only known flags.
 * With `partial`, flags missing from the input are left out (for updates);
 * otherwise they default to false (for creation).
 */
export function pickModuleFlags(input, { partial = false } = {}) {
  const source = input && typeof input === "object" ? input : {};
  const flags = {};
  for (const key of MODULE_ACCESS_KEYS) {
    if (source[key] !== undefined) {
      flags[key] = toFlag(source[key]);
    } else if (!partial) {
      flags[key] = false;
    }
  }
  return flags;
}

// Returns an error message when the password is not acceptable, else null
export function validatePassword(password, username) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (username && password.toLowerCase() === String(username).toLowerCase()) {
    return "Password must not be the same as the username";
  }
  return null;
}
