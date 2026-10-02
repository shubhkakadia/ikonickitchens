"use client";

import { Bell } from "lucide-react";
import { formatTimeAgo } from "@/app/admin/dashboard/lib/format";
import { UPDATE_TYPE_UI } from "@/components/updates/updateTypeUi";

// One update row, used by the sidebar bell and the /admin/updates page.
// Unread updates get a bold title and a dot; clicking opens the page where the
// change was made (the parent decides what a click does).
export default function UpdateItem({ update, onOpen, trailing = null }) {
  const ui = UPDATE_TYPE_UI[update.type];
  const Icon = ui?.icon || Bell;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0 transition-colors duration-200 hover:bg-slate-50 ${
        update.is_read ? "" : "bg-primary/5"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(update)}
        className="cursor-pointer flex flex-1 min-w-0 items-start gap-3 text-left rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
            ui?.tone || "bg-slate-100 text-slate-600 border-slate-200"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-sm ${
              update.is_read
                ? "font-medium text-slate-700"
                : "font-semibold text-slate-900"
            }`}
          >
            {update.title}
          </span>
          <span className="block text-sm text-slate-600 wrap-break-word line-clamp-2">
            {update.message}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">
            {update.actor?.name || "Someone"} ·{" "}
            {formatTimeAgo(update.updatedAt)}
          </span>
        </span>
        {!update.is_read && (
          <span
            className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary"
            aria-label="Unread"
          />
        )}
      </button>
      {trailing}
    </div>
  );
}
