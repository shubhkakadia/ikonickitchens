// Shared dashboard formatters. Kept here so panels don't each re-declare them
// the way the previous single-file dashboard did.

import { BADGE } from "@/app/admin/employees/punches/lib/punchStyles";

// Badge chrome (shape, padding, type) is shared with the clock-punch pages so a
// pill is the same 24px shape everywhere (DESIGN.md 9.6). Colour comes from a
// tone below or one of the maps built on them.
export { BADGE };

// The 9.6 variants: hue -100 fill, -800 ink, -200 border. Every status, action
// and severity map is built from these, never from hand-typed class strings.
export const BADGE_TONES = {
  success: "bg-green-100 text-green-800 border-green-200",
  info: "bg-blue-100 text-blue-800 border-blue-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  danger: "bg-red-100 text-red-800 border-red-200",
  neutral: "bg-slate-100 text-slate-800 border-slate-200",
  muted: "bg-slate-100 text-slate-600 border-slate-200",
  violet: "bg-violet-100 text-violet-800 border-violet-200",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-200",
};

// Counts on tabs and nav items (DESIGN.md 9.6, "Count").
export const COUNT_BADGE =
  "bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full";

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

const NUMBER = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });

export const formatQty = (value, unit) => {
  const text = NUMBER.format(Number(value) || 0);
  return unit ? `${text} ${unit}` : text;
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
    return { label: "No date", className: BADGE_TONES.muted };
  if (days < 0)
    return {
      label: `${Math.abs(days)}d overdue`,
      className: BADGE_TONES.danger,
    };
  if (days === 0)
    return { label: "Due today", className: BADGE_TONES.warning };
  if (days <= 7)
    return {
      label: `${days}d left`,
      className: "bg-amber-50 text-amber-800 border-amber-200",
    };
  return { label: `${days}d left`, className: BADGE_TONES.success };
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
  CREATE: BADGE_TONES.success,
  UPDATE: BADGE_TONES.info,
  DELETE: BADGE_TONES.danger,
  STATUS_CHANGE: BADGE_TONES.warning,
  ASSIGN: BADGE_TONES.violet,
  UPLOAD: BADGE_TONES.indigo,
  OTHER: BADGE_TONES.neutral,
};

// Status -> colour mapping from DESIGN.md 5.4. Kept identical to the mapping
// used by the project stage table so a status never changes colour between
// the dashboard and the page it links to.
export const STATUS_COLORS = {
  // Green - finished successfully
  DONE: BADGE_TONES.success,
  COMPLETED: BADGE_TONES.success,
  FULLY_ORDERED: BADGE_TONES.success,
  FULLY_RECEIVED: BADGE_TONES.success,
  // Blue - in flight
  IN_PROGRESS: BADGE_TONES.info,
  ACTIVE: BADGE_TONES.info,
  ORDERED: BADGE_TONES.info,
  PARTIALLY_ORDERED: BADGE_TONES.info,
  PARTIALLY_RECEIVED: BADGE_TONES.info,
  // Amber - not yet committed
  DRAFT: BADGE_TONES.warning,
  // Red - stopped
  CANCELLED: BADGE_TONES.danger,
  // Slate - inert
  NOT_STARTED: BADGE_TONES.neutral,
  CLOSED: BADGE_TONES.neutral,
  NA: BADGE_TONES.muted,
};

// Data-viz series colours. Chart.js takes colour strings, not Tailwind
// classes, so they live here as constants rather than inline hex in JSX
// (DESIGN.md 5.6). These mirror --color-series-* in globals.css.
export const SERIES_1 = "#3d4fb5";
export const SERIES_2 = "#b82f34";

// Chart chrome and ring colours, as slate / semantic stops (DESIGN.md 5.2, 5.3).
export const CHART_COLORS = {
  tooltip: "#1e293b", // slate-800
  legend: "#475569", // slate-600
  tick: "#94a3b8", // slate-400
  grid: "#f1f5f9", // slate-100
  ringTrack: "#f1f5f9", // slate-100
  ringWarn: "#f59e0b", // amber-500
  ringOk: "#059669", // emerald-600
};

export const titleCase = (value) =>
  (value || "")
    .toString()
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
