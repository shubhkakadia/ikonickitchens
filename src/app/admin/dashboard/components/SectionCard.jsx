"use client";

// Standard panel chrome for every dashboard section.
// Card shell follows DESIGN.md 9.3 and 6: rounded-lg, 1px border, no shadow.
export default function SectionCard({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  bodyClassName = "p-4",
  className = "",
}) {
  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col ${className}`}
    >
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2 shrink-0">
        <span className="h-5 w-1 rounded-full bg-secondary shrink-0" />
        {Icon && <Icon className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-800 truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-500 truncate">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
      <div className={`${bodyClassName} flex-1 min-h-0`}>{children}</div>
    </div>
  );
}

export function EmptyState({ message, icon: Icon, className = "" }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 text-sm text-slate-600 py-8 px-4 text-center ${className}`}
    >
      {Icon && <Icon className="w-8 h-8 text-slate-300" aria-hidden="true" />}
      {message}
    </div>
  );
}

export function SkeletonCard({ className = "h-40" }) {
  return (
    <div
      className={`bg-white rounded-lg border border-slate-200 animate-pulse ${className}`}
    >
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-slate-200" />
        <span className="h-3 w-32 rounded bg-slate-200" />
      </div>
      <div className="p-4 space-y-3">
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-3 w-4/5 rounded bg-slate-100" />
        <div className="h-3 w-2/3 rounded bg-slate-100" />
      </div>
    </div>
  );
}
