"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, HardHat } from "lucide-react";
import SectionCard, { EmptyState } from "./SectionCard";
import { daysLeftBadge, formatDate } from "../lib/format";

// Buckets are derived from daysLeft, which the API computes against the
// Adelaide day boundary.
const BUCKETS = [
  { key: "overdue", label: "Overdue", test: (d) => d < 0 },
  { key: "today", label: "Today", test: (d) => d === 0 },
  { key: "week", label: "This week", test: (d) => d >= 1 && d <= 7 },
  { key: "next", label: "Next week", test: (d) => d >= 8 && d <= 14 },
];

export default function ProductionSchedule({ schedule }) {
  const router = useRouter();

  const grouped = useMemo(() => {
    const rows = schedule ?? [];
    return BUCKETS.map((bucket) => ({
      ...bucket,
      rows: rows.filter((row) => bucket.test(row.daysLeft)),
    })).filter((bucket) => bucket.rows.length > 0);
  }, [schedule]);

  return (
    <SectionCard
      title="Production schedule"
      subtitle="Installations due in the next 14 days"
      icon={CalendarRange}
      bodyClassName="p-0"
      className="min-h-0"
    >
      {grouped.length === 0 ? (
        <EmptyState message="No installations scheduled in this window." icon={CalendarRange} />
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          {grouped.map((bucket) => (
            <div key={bucket.key}>
              <div className="sticky top-0 z-10 bg-slate-50 px-4 py-1.5 border-y border-slate-200">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  {bucket.label}
                </span>
                <span className="ml-2 text-xs text-slate-500">
                  {bucket.rows.length}
                </span>
              </div>
              {bucket.rows.map((row) => {
                const badge = daysLeftBadge(row.daysLeft);
                const pct =
                  row.stagesTotal > 0
                    ? Math.round((row.stagesDone / row.stagesTotal) * 100)
                    : 0;
                return (
                  <button
                    key={row.lot_id}
                    type="button"
                    onClick={() =>
                      row.project_id &&
                      router.push(`/admin/projects/${row.project_id}`)
                    }
                    className="cursor-pointer w-full text-left px-4 py-2 border-b border-slate-200 hover:bg-slate-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {row.project}
                          <span className="text-slate-500 font-normal">
                            {" · "}
                            {row.name}
                          </span>
                        </p>
                        <div className="flex items-center gap-2 mt-1 min-w-0">
                          <div className="h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden shrink-0">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 shrink-0">
                            {row.stagesDone}/{row.stagesTotal} stages
                          </span>
                          {row.installer && (
                            <span className="text-xs text-slate-500 flex items-center gap-1 min-w-0">
                              <HardHat className="w-3 h-3 shrink-0" aria-hidden="true" />
                              <span className="truncate">{row.installer}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-slate-500">
                          {formatDate(row.installationDueDate)}
                        </p>
                        <span
                          className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
