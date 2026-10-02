"use client";

import { EmptyState } from "./SectionCard";

// Single-series horizontal magnitude bars (DESIGN.md 5.6): one hue on a
// slate-100 track, identity carried by the text label, value printed beside
// the bar so nothing depends on colour or hover.
export default function HBarList({
  rows,
  label = (row) => row.label,
  value = (row) => row.value,
  format = (v) => String(v),
  detail,
  tone = () => "bg-series-1",
  emptyMessage = "Nothing to show.",
  labelWidth = "w-40",
}) {
  if (!rows || rows.length === 0)
    return <EmptyState message={emptyMessage} className="py-6" />;

  const max = Math.max(1, ...rows.map((row) => Number(value(row)) || 0));

  return (
    <ul className="space-y-1.5">
      {rows.map((row, i) => {
        const v = Number(value(row)) || 0;
        const text = label(row);
        const extra = detail?.(row);
        return (
          <li
            key={`${text}-${i}`}
            className="flex items-center gap-3"
            title={
              extra
                ? `${text}: ${format(v)} · ${extra}`
                : `${text}: ${format(v)}`
            }
          >
            <span
              className={`text-xs text-slate-600 ${labelWidth} shrink-0 truncate`}
            >
              {text}
            </span>
            <div className="flex-1 h-4 bg-slate-100 rounded-r overflow-hidden min-w-0">
              <div
                className={`h-full rounded-r ${tone(row)}`}
                style={{ width: `${Math.max(2, (v / max) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-700 w-14 text-right shrink-0 tabular-nums">
              {format(v)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
