"use client";

import { GitBranch } from "lucide-react";
import SectionCard, { EmptyState } from "./SectionCard";
import { STATUS_COLORS, titleCase } from "../lib/format";

// Single-series magnitude bars: one hue, identity carried by the text label.
export default function PipelinePanel({ pipeline }) {
  const stages = pipeline?.byStage ?? [];
  const lotStatus = pipeline?.lotStatus ?? {};
  const max = Math.max(1, ...stages.map((s) => s.count));
  const totalLots = Object.values(lotStatus).reduce((a, b) => a + b, 0);

  return (
    <SectionCard
      title="Workflow pipeline"
      subtitle="Active lots by the stage currently in progress"
      icon={GitBranch}
    >
      {stages.length === 0 ? (
        <EmptyState message="No stages in progress." />
      ) : (
        <div className="space-y-1.5">
          {stages.map((stage) => (
            <div key={stage.name} className="flex items-center gap-3">
              <span
                className="text-[11px] text-slate-600 w-44 shrink-0 truncate"
                title={titleCase(stage.name)}
              >
                {titleCase(stage.name)}
              </span>
              <div className="flex-1 h-4 bg-slate-50 rounded-r overflow-hidden min-w-0">
                <div
                  className="h-full rounded-r-[4px] bg-[#3D4FB5]"
                  style={{ width: `${Math.max(2, (stage.count / max) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-slate-700 w-8 text-right shrink-0 tabular-nums">
                {stage.count}
              </span>
            </div>
          ))}
        </div>
      )}

      {totalLots > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
          {Object.entries(lotStatus).map(([status, count]) => (
            <span
              key={status}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium ${STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600"}`}
            >
              {titleCase(status)}
              <span className="font-bold tabular-nums">{count}</span>
            </span>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
