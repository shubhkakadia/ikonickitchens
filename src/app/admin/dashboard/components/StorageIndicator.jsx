"use client";

import { useEffect, useRef, useState } from "react";
import { Database, HardDrive, TrendingUp } from "lucide-react";

const formatBytes = (bytes) => {
  const n = Number(bytes) || 0;
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
};

const monthLabel = (key) => {
  const [y, m] = (key || "").split("-");
  if (!y || !m) return key;
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-AU", {
    month: "short",
  });
};

// The upgrade call, stated plainly rather than left to the reader.
function verdict(percentUsed, monthsRemaining) {
  if (percentUsed == null)
    return { label: "Capacity unknown", dot: "bg-slate-300", chip: "bg-slate-100 text-slate-600", bar: "bg-slate-300", advice: "No capacity limit could be determined." };
  if (percentUsed >= 90 || (monthsRemaining != null && monthsRemaining < 2))
    return { label: "Upgrade now", dot: "bg-red-500", chip: "bg-red-100 text-red-800", bar: "bg-red-500", advice: "Capacity is nearly exhausted." };
  if (percentUsed >= 75 || (monthsRemaining != null && monthsRemaining < 6))
    return { label: "Plan an upgrade", dot: "bg-amber-500", chip: "bg-amber-100 text-amber-800", bar: "bg-amber-500", advice: "Headroom is shrinking. Budget for more space." };
  return { label: "Healthy", dot: "bg-green-500", chip: "bg-green-100 text-green-800", bar: "bg-green-500", advice: "Plenty of headroom at the current rate." };
}

export default function StorageIndicator({
  storage,
  loading,
  error,
  onRefresh,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const closeTimer = useRef(null);

  // Hover opens it, but a tap or keyboard focus must work too.
  const show = () => {
    clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onEsc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const v = verdict(storage?.percentUsed, storage?.monthsRemaining);
  const growthMax = Math.max(1, ...(storage?.growthByMonth ?? []).map((g) => g.bytes));

  return (
    <div
      ref={wrapRef}
      className="relative shrink-0"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onFocus={show}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={
          storage
            ? `Storage — ${v.label}${storage.percentUsed != null ? ` (${storage.percentUsed}% used)` : ""}`
            : "Storage usage"
        }
        className="cursor-pointer relative p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors duration-200"
      >
        <HardDrive className="w-4 h-4" aria-hidden="true" />
        {storage && (
          <span
            className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${v.dot}`}
          />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Storage usage"
          className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-lg border border-slate-300 z-40 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-800 flex-1">Storage</h3>
            <button
              type="button"
              onClick={() => onRefresh?.()}
              className="cursor-pointer text-xs font-medium text-primary hover:underline"
            >
              Recheck
            </button>
          </div>

          {loading && !storage ? (
            <p className="text-sm text-slate-600 py-3">Measuring storage…</p>
          ) : error || !storage ? (
            <p className="text-sm text-slate-600 py-3">
              {error || "Storage usage unavailable."}
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-500 mb-2">
                {storage.limitSource === "plan"
                  ? "Against your configured plan limit"
                  : storage.limitSource === "disk"
                    ? "Against total server disk capacity"
                    : "Capacity limit unknown"}
              </p>

              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${v.chip}`}>
                  {v.label}
                </span>
                <span className="text-xs text-slate-500 leading-tight">
                  {v.advice}
                </span>
              </div>

              {storage.percentUsed != null && (
                <>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-xl font-semibold text-slate-800 tabular-nums">
                      {storage.percentUsed}%
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">
                      {formatBytes(storage.usedAgainstLimit)} /{" "}
                      {formatBytes(storage.limitBytes)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden mb-1">
                    <div
                      className={`h-full rounded-full ${v.bar}`}
                      style={{
                        width: `${Math.min(100, Math.max(1, storage.percentUsed))}%`,
                      }}
                    />
                  </div>
                  {storage.freeBytes != null && (
                    <p className="text-xs text-slate-500 mb-3">
                      {formatBytes(storage.freeBytes)} free
                    </p>
                  )}
                </>
              )}

              <div className="space-y-1.5 mb-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <Database className="w-3 h-3" aria-hidden="true" /> Database
                  </span>
                  <span className="font-semibold text-slate-700 tabular-nums">
                    {formatBytes(storage.database?.bytes)}
                    <span className="text-slate-500 font-normal">
                      {" "}
                      · {storage.database?.tableCount ?? 0} tables
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Uploads</span>
                  <span className="font-semibold text-slate-700 tabular-nums">
                    {formatBytes(storage.files?.bytes)}
                    <span className="text-slate-500 font-normal">
                      {" "}
                      · {(storage.files?.count ?? 0).toLocaleString()} files
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200">
                  <span className="text-slate-600 font-medium">App total</span>
                  <span className="font-semibold text-primary tabular-nums">
                    {formatBytes(storage.totalBytes)}
                  </span>
                </div>
              </div>

              {storage.limitSource === "disk" && (
                <p className="text-xs text-slate-600 mb-3 leading-snug">
                  The percentage is the whole server volume, not just this app —
                  other software on the same disk counts toward it.
                </p>
              )}

              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" aria-hidden="true" /> Upload growth
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {storage.avgMonthlyBytes > 0
                      ? `${formatBytes(storage.avgMonthlyBytes)}/mo`
                      : "no growth"}
                    {storage.monthsRemaining != null &&
                      ` · ~${storage.monthsRemaining}mo left`}
                  </span>
                </div>
                {storage.avgMonthlyBytes > 0 ? (
                  <div className="flex items-end gap-1 h-9">
                    {(storage.growthByMonth ?? []).map((g) => (
                      <div
                        key={g.month}
                        className="flex-1 flex flex-col items-center gap-0.5"
                      >
                        <div
                          className="w-full rounded-t bg-series-1"
                          style={{
                            height: `${Math.max(2, (g.bytes / growthMax) * 26)}px`,
                          }}
                          title={`${monthLabel(g.month)}: ${formatBytes(g.bytes)}`}
                        />
                        <span className="text-xs text-slate-500">
                          {monthLabel(g.month)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600">
                    Not enough recorded file history to project growth yet.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
