"use client";

import { History } from "lucide-react";
import SectionCard, { EmptyState } from "./SectionCard";
import { ACTION_COLORS, formatTimeAgo, titleCase } from "../lib/format";

export default function ActivityFeed({ activity }) {
  return (
    <SectionCard
      title="Recent activity"
      icon={History}
      bodyClassName="p-0"
      className="h-full"
    >
      {!activity || activity.length === 0 ? (
        <EmptyState message="No recent activity." />
      ) : (
        <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
          {activity.map((log) => (
            <div key={log.id} className="px-5 py-2.5 flex items-start gap-3">
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 mt-0.5 ${ACTION_COLORS[log.action] ?? ACTION_COLORS.OTHER}`}
              >
                {titleCase(log.action)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-slate-700 leading-snug line-clamp-2">
                  {log.description || `${titleCase(log.action)} on ${log.entity_type}`}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {log.user} · {formatTimeAgo(log.createdAt)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
