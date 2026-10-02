// Helpers shared by the dashboard API routes (/api/v1/dashboard and
// /api/v1/dashboard/insights). Route files may only export HTTP handlers, so
// anything both routes need lives here.

export const TZ = "Australia/Adelaide";

// Canonical workflow order. Stage.name is free text, so stages are sorted
// against this list (mirrored from the stage_* flags on notification_config)
// instead of letting groupBy return an arbitrary order.
export const STAGE_ORDER = [
  "quote approve",
  "material & appliances selection",
  "drafting",
  "drafting revision",
  "final design approval",
  "site measurements",
  "final approval for production",
  "machining out",
  "material order",
  "cnc",
  "assembly",
  "delivery",
  "installation",
  "invoice sent",
  "maintenance",
  "job completion",
];

export const normaliseStage = (name) => (name || "").trim().toLowerCase();

export const stageRank = (name) => {
  const i = STAGE_ORDER.indexOf(normaliseStage(name));
  return i === -1 ? STAGE_ORDER.length : i;
};

// Prisma Decimal / BigInt do not survive NextResponse.json cleanly.
export const dec = (value) => (value == null ? null : value.toString());
export const num = (value) => (value == null ? 0 : Number(value));

// Item has no name column - the label lives on whichever subtype row exists.
export const itemLabel = (item) => {
  if (!item) return "Unknown item";
  const parts =
    (item.sheet && [item.sheet.brand, item.sheet.color, item.sheet.finish]) ||
    (item.handle && [item.handle.brand, item.handle.color, item.handle.type]) ||
    (item.hardware && [item.hardware.brand, item.hardware.name]) ||
    (item.accessory && [item.accessory.name]) ||
    (item.edging_tape && [
      item.edging_tape.brand,
      item.edging_tape.color,
      item.edging_tape.finish,
    ]) ||
    [];
  const label = parts.filter(Boolean).join(" ").trim();
  return label || item.description || "Unnamed item";
};

export const ITEM_SUBTYPES = {
  sheet: { select: { brand: true, color: true, finish: true } },
  handle: { select: { brand: true, color: true, type: true } },
  hardware: { select: { brand: true, name: true } },
  accessory: { select: { name: true } },
  edging_tape: { select: { brand: true, color: true, finish: true } },
};

export const employeeName = (e) =>
  e ? [e.first_name, e.last_name].filter(Boolean).join(" ") : null;
