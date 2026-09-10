"use client";

// Standard panel chrome for every dashboard section.
export default function SectionCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  bodyClassName = "p-5",
  className = "",
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col ${className}`}
    >
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2 shrink-0">
        <span className="h-5 w-1 rounded-full bg-secondary shrink-0" />
        {Icon && <Icon className="w-4 h-4 text-primary shrink-0" />}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-primary truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className={`${bodyClassName} flex-1 min-h-0`}>{children}</div>
    </div>
  );
}

export function EmptyState({ message, className = "" }) {
  return (
    <div
      className={`flex items-center justify-center text-sm text-slate-400 py-8 text-center ${className}`}
    >
      {message}
    </div>
  );
}

export function SkeletonCard({ className = "h-40" }) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 animate-pulse ${className}`}
    >
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-slate-200" />
        <span className="h-3 w-32 rounded bg-slate-200" />
      </div>
      <div className="p-5 space-y-3">
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-4/5 rounded bg-slate-100" />
        <div className="h-3 w-2/3 rounded bg-slate-100" />
      </div>
    </div>
  );
}
