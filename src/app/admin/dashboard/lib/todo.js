// Helpers shared by the dashboard to-do components.
//
// Due dates are date-only: the API stores them as UTC midnight, so they are
// always read back through the "YYYY-MM-DD" prefix. Going through a local
// Date would shift the day for anyone west of UTC.

import { BADGE_TONES } from "./format";

export const dueKey = (value) => (value ? String(value).slice(0, 10) : "");

const MS_PER_DAY = 86400000;

// Whole days from today (local) to the due day. Negative = overdue.
export const daysFromToday = (key) => {
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - today) / MS_PER_DAY);
};

export const formatDueDate = (key) =>
  key
    ? new Date(`${key}T00:00:00Z`).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "";

// Badge for an open task. Completed tasks stay neutral — "overdue" is no
// longer meaningful once they are done.
export const dueBadge = (key, isCompleted) => {
  if (!key) return null;
  const label = formatDueDate(key);
  if (isCompleted) {
    return { label: `Due ${label}`, className: BADGE_TONES.neutral };
  }
  const days = daysFromToday(key);
  if (days < 0) {
    return { label: `Overdue · ${label}`, className: BADGE_TONES.danger };
  }
  if (days === 0) {
    return { label: "Due today", className: BADGE_TONES.warning };
  }
  return { label: `Due ${label}`, className: BADGE_TONES.neutral };
};

// "1 Oct 2026, 3:45 pm"
export const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "";

// <input type="date"> value for today, in the user's local calendar.
export const todayInputValue = () => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const initialOf = (name) => (name || "?").trim().charAt(0).toUpperCase();
