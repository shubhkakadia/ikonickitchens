"use client";

// Body placeholder for cards whose data comes from the lazily loaded
// /api/v1/dashboard/insights call, so each card can render its headline
// content immediately and fill in the trend chart when it arrives.
export default function InsightState({
  loading,
  error,
  height = "h-40",
  children,
}) {
  if (loading)
    return (
      <div
        className={`${height} flex flex-col justify-end gap-2 animate-pulse`}
      >
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-4/5 rounded bg-slate-100" />
        <div className="h-3 w-3/5 rounded bg-slate-100" />
        <div className="h-3 w-2/3 rounded bg-slate-100" />
      </div>
    );
  if (error)
    return (
      <div
        className={`${height} flex items-center justify-center text-center text-sm text-slate-600`}
      >
        {error}
      </div>
    );
  return children;
}
