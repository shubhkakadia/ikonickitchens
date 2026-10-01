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
        <EmptyState message="No recent activity." icon={History} />
      ) : (
        <div className="divide-y divide-slate-200 max-h-72 overflow-y-auto">
          {activity.map((log) => (
            <div key={log.id} className="px-4 py-2 flex items-start gap-3">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 mt-0.5 ${ACTION_COLORS[log.action] ?? ACTION_COLORS.OTHER}`}
              >
                {titleCase(log.action)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-700 leading-snug line-clamp-2">
                  {log.description || `${titleCase(log.action)} on ${log.entity_type}`}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
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
