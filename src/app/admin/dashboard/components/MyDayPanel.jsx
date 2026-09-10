"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, ListChecks } from "lucide-react";
import SectionCard, { EmptyState } from "./SectionCard";
import {
  STATUS_COLORS,
  daysLeftBadge,
  daysUntil,
  formatTime,
  titleCase,
} from "../lib/format";

export function MyStages({ stages }) {
  const router = useRouter();
  return (
    <SectionCard
      title="My stages"
      subtitle="Assigned to you and still open"
      icon={ListChecks}
      bodyClassName="p-0"
    >
      {!stages || stages.length === 0 ? (
        <EmptyState message="Nothing assigned to you right now." />
      ) : (
        <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
          {stages.map((stage) => {
            const badge = daysLeftBadge(daysUntil(stage.endDate));
            return (
              <button
                key={stage.stage_id}
                type="button"
                onClick={() =>
                  stage.project_id &&
                  router.push(`/admin/projects/${stage.project_id}`)
                }
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors duration-150 focus:outline-none focus:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {titleCase(stage.name)}
                  </p>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[stage.status] ?? "bg-slate-100 text-slate-600"}`}
                  >
                    {titleCase(stage.status)}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate">
                    {stage.project}
                    {stage.lot ? ` · ${stage.lot}` : ""}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

export function MyMeetings({ meetings }) {
  const router = useRouter();
  return (
    <SectionCard
      title="Upcoming meetings"
      icon={CalendarDays}
      bodyClassName="p-0"
      action={
        <button
          type="button"
          onClick={() => router.push("/admin/calendar")}
          className="text-[11px] font-semibold text-primary hover:underline shrink-0"
        >
          Calendar
        </button>
      }
    >
      {!meetings || meetings.length === 0 ? (
        <EmptyState message="No meetings scheduled." />
      ) : (
        <div className="max-h-56 overflow-y-auto divide-y divide-slate-50">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="px-4 py-2.5 flex gap-3">
              <div className="shrink-0 w-10 text-center rounded-lg bg-primary/5 py-1">
                <p className="text-[9px] font-bold uppercase text-primary/70 leading-none">
                  {new Date(meeting.date_time).toLocaleDateString("en-AU", {
                    month: "short",
                  })}
                </p>
                <p className="text-base font-bold text-primary leading-tight">
                  {new Date(meeting.date_time).getDate()}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-800 truncate">
                  {meeting.title}
                </p>
                <p className="text-[11px] text-slate-400">
                  {formatTime(meeting.date_time)}
                  {meeting.date_time_end
                    ? ` – ${formatTime(meeting.date_time_end)}`
                    : ""}
                </p>
                {meeting.lots.length > 0 && (
                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                    {meeting.lots
                      .slice(0, 2)
                      .map((lot) => lot.name)
                      .join(", ")}
                    {meeting.lots.length > 2
                      ? ` +${meeting.lots.length - 2}`
                      : ""}
                  </p>
                )}
              </div>
              <div className="flex -space-x-1.5 shrink-0 items-start pt-0.5">
                {meeting.participants.slice(0, 3).map((p) =>
                  p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={p.id}
                      src={p.image}
                      alt={p.name}
                      title={p.name}
                      className="w-6 h-6 rounded-full border-2 border-white object-cover"
                    />
                  ) : (
                    <span
                      key={p.id}
                      title={p.name}
                      className="w-6 h-6 rounded-full border-2 border-white bg-linear-to-br from-secondary to-primary text-white text-[9px] font-bold flex items-center justify-center"
                    >
                      {(p.name || "?").charAt(0).toUpperCase()}
                    </span>
                  ),
                )}
                {meeting.participants.length > 3 && (
                  <span className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 text-slate-600 text-[9px] font-bold flex items-center justify-center">
                    +{meeting.participants.length - 3}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
