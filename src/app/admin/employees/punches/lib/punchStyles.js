// Shared badge styling for the clock-punch pages. The list, add and detail
// pages each used to declare their own copy of these four maps, which is how a
// status ends up a different colour depending on which page you are looking at.
//
// Every map follows the badge formula in DESIGN.md 5.3: -200 border, -100
// background, -800 text, on the sanctioned semantic hues only.

// Punch actions are a sequence, not a severity: clock in starts the day (green),
// break in pauses it (amber), break out resumes it (blue), clock out ends it
// (slate). Colour reinforces the order; the label always carries the meaning.
export const actionStyles = {
  CLOCK_IN: "border-green-200 bg-green-100 text-green-800",
  BREAK_IN: "border-amber-200 bg-amber-100 text-amber-800",
  BREAK_OUT: "border-blue-200 bg-blue-100 text-blue-800",
  CLOCK_OUT: "border-slate-200 bg-slate-100 text-slate-800",
};

// PENDING is amber (not yet committed), APPROVED green, REJECTED red -- the
// same mapping DRAFT/DONE/CANCELLED use everywhere else (DESIGN.md 5.4).
// MIXED is a derived, in-flight state, so it takes blue.
export const reviewStyles = {
  PENDING: "border-amber-200 bg-amber-100 text-amber-800",
  APPROVED: "border-green-200 bg-green-100 text-green-800",
  REJECTED: "border-red-200 bg-red-100 text-red-800",
  MIXED: "border-blue-200 bg-blue-100 text-blue-800",
};

export const breakStyles = {
  ON_BREAK: "border-amber-200 bg-amber-100 text-amber-800",
  BREAK_COMPLETED: "border-green-200 bg-green-100 text-green-800",
  NO_BREAK: "border-slate-200 bg-slate-100 text-slate-600",
};

export const workingStyles = {
  WORKING: "border-blue-200 bg-blue-100 text-blue-800",
  NOT_WORKING: "border-slate-200 bg-slate-100 text-slate-600",
};

// Shared badge chrome, so a pill is the same shape on all three pages
// (DESIGN.md 9.6): rounded-full, px-2.5 py-1, text-xs font-medium.
export const BADGE =
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium";

export function formatLabel(value) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
