// Shared dashboard formatters. Kept here so panels don't each re-declare them
// the way the previous single-file dashboard did.

const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

export const formatCurrency = (value) => AUD.format(Number(value) || 0);

export const formatCompactCurrency = (value) => {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `$${Math.round(n / 1000)}k`;
  return `$${Math.round(n)}`;
};

export const formatQty = (value, unit) => {
  const n = Number(value) || 0;
  const rounded = Number.isInteger(n) ? n : Math.round(n * 100) / 100;
  return unit ? `${rounded.toLocaleString()} ${unit}` : rounded.toLocaleString();
};

export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
      })
    : "—";

export const formatTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

export const formatMonthLabel = (key) => {
  const [year, month] = (key || "").split("-");
  if (!year || !month) return key;
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(
    "en-AU",
    { month: "short" },
  );
};

export const formatTimeAgo = (value) => {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
  });
};

// Days-left badge shared by the schedule and My Stages panels.
// Severity ramp on the sanctioned semantic hues (DESIGN.md 5.3).
export const daysLeftBadge = (days) => {
  if (days == null || Number.isNaN(days))
    return { label: "No date", className: "bg-slate-100 text-slate-600" };
  if (days < 0)
    return {
      label: `${Math.abs(days)}d overdue`,
      className: "bg-red-100 text-red-800",
    };
  if (days === 0)
    return { label: "Due today", className: "bg-amber-100 text-amber-800" };
  if (days <= 7)
    return { label: `${days}d left`, className: "bg-amber-50 text-amber-800" };
  return { label: `${days}d left`, className: "bg-green-100 text-green-800" };
};

export const daysUntil = (value) => {
  if (!value) return null;
  const target = new Date(value).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
};

// Log actions. CREATE/UPDATE/DELETE carry real meaning, so they take the
// matching semantic hue; ASSIGN/UPLOAD are purely categorical and use the
// extended hues (DESIGN.md 5.5). Formula is -100 background / -800 text.
export const ACTION_COLORS = {
  CREATE: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  STATUS_CHANGE: "bg-amber-100 text-amber-800",
  ASSIGN: "bg-violet-100 text-violet-800",
  UPLOAD: "bg-indigo-100 text-indigo-800",
  OTHER: "bg-slate-100 text-slate-800",
};

// Status -> colour mapping from DESIGN.md 5.4. Kept identical to the mapping
// used by the project stage table so a status never changes colour between
// the dashboard and the page it links to.
export const STATUS_COLORS = {
  // Green - finished successfully
  DONE: "bg-green-100 text-green-800",
  COMPLETED: "bg-green-100 text-green-800",
  FULLY_ORDERED: "bg-green-100 text-green-800",
  FULLY_RECEIVED: "bg-green-100 text-green-800",
  // Blue - in flight
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  ACTIVE: "bg-blue-100 text-blue-800",
  ORDERED: "bg-blue-100 text-blue-800",
  PARTIALLY_ORDERED: "bg-blue-100 text-blue-800",
  PARTIALLY_RECEIVED: "bg-blue-100 text-blue-800",
  // Amber - not yet committed
  DRAFT: "bg-amber-100 text-amber-800",
  // Red - stopped
  CANCELLED: "bg-red-100 text-red-800",
  // Slate - inert
  NOT_STARTED: "bg-slate-100 text-slate-800",
  CLOSED: "bg-slate-100 text-slate-800",
  NA: "bg-slate-100 text-slate-600",
};

// Data-viz series colours. Chart.js takes colour strings, not Tailwind
// classes, so they live here as constants rather than inline hex in JSX
// (DESIGN.md 5.6). These mirror --color-series-* in globals.css.
export const SERIES_1 = "#3d4fb5";
export const SERIES_2 = "#b82f34";

export const titleCase = (value) =>
  (value || "")
    .toString()
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
