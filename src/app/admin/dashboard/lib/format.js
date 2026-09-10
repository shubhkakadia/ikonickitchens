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
export const daysLeftBadge = (days) => {
  if (days == null || Number.isNaN(days))
    return { label: "No date", className: "bg-slate-100 text-slate-500" };
  if (days < 0)
    return {
      label: `${Math.abs(days)}d overdue`,
      className: "bg-red-100 text-red-700",
    };
  if (days === 0)
    return { label: "Due today", className: "bg-amber-100 text-amber-800" };
  if (days <= 3)
    return { label: `${days}d left`, className: "bg-amber-50 text-amber-700" };
  if (days <= 7)
    return { label: `${days}d left`, className: "bg-yellow-50 text-yellow-700" };
  return { label: `${days}d left`, className: "bg-emerald-50 text-emerald-700" };
};

export const daysUntil = (value) => {
  if (!value) return null;
  const target = new Date(value).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
};

export const ACTION_COLORS = {
  CREATE: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
  STATUS_CHANGE: "bg-violet-100 text-violet-700",
  ASSIGN: "bg-teal-100 text-teal-700",
  UPLOAD: "bg-indigo-100 text-indigo-700",
  OTHER: "bg-slate-100 text-slate-600",
};

export const STATUS_COLORS = {
  DRAFT: "bg-slate-100 text-slate-700",
  ORDERED: "bg-blue-100 text-blue-700",
  PARTIALLY_ORDERED: "bg-amber-100 text-amber-800",
  FULLY_ORDERED: "bg-emerald-100 text-emerald-700",
  PARTIALLY_RECEIVED: "bg-amber-100 text-amber-800",
  FULLY_RECEIVED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
  CLOSED: "bg-slate-200 text-slate-700",
  ACTIVE: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  NOT_STARTED: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  DONE: "bg-emerald-100 text-emerald-700",
  NA: "bg-slate-100 text-slate-400",
};

export const titleCase = (value) =>
  (value || "")
    .toString()
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
