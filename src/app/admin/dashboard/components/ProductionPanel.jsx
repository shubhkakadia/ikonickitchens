"use client";

import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  CalendarClock,
  GitBranch,
  Hourglass,
  HardHat,
  TrendingUp,
  Timer,
} from "lucide-react";
import SectionCard, { EmptyState } from "./SectionCard";
import HBarList from "./HBarList";
import InsightState from "./InsightState";
import { barDataset, barOptions } from "../lib/charts";
import {
  BADGE,
  BADGE_TONES,
  SERIES_1,
  SERIES_2,
  STATUS_COLORS,
  formatDate,
  formatMonthLabel,
  titleCase,
} from "../lib/format";

// Status red (DESIGN.md 5.3) for "past due" marks. Always paired with a text
// label, never the only signal.
const OVERDUE = "#b91c1c"; // red-700

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Where active lots sit right now: one row per current stage, split into on
// track vs overdue. Two segments on one track with a 2px surface gap.
function CurrentStageBars({ rows }) {
  if (!rows || rows.length === 0)
    return (
      <EmptyState message="No active lots with open stages." icon={GitBranch} />
    );

  const max = Math.max(1, ...rows.map((r) => r.onTrack + r.overdue));
  return (
    <>
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const total = row.onTrack + row.overdue;
          return (
            <li
              key={row.name}
              className="flex items-center gap-3"
              title={`${titleCase(row.name)}: ${plural(total, "lot")}${row.overdue ? `, ${row.overdue} overdue` : ""}`}
            >
              <span className="text-xs text-slate-600 w-44 shrink-0 truncate">
                {titleCase(row.name)}
              </span>
              <div className="flex-1 h-4 bg-slate-100 rounded-r overflow-hidden min-w-0 flex gap-0.5">
                {row.onTrack > 0 && (
                  <div
                    className="h-full bg-series-1 last:rounded-r"
                    style={{ width: `${(row.onTrack / max) * 100}%` }}
                  />
                )}
                {row.overdue > 0 && (
                  <div
                    className="h-full bg-red-700 rounded-r"
                    style={{ width: `${(row.overdue / max) * 100}%` }}
                  />
                )}
              </div>
              <span className="text-xs font-semibold text-slate-700 w-16 text-right shrink-0 tabular-nums">
                {total}
                {row.overdue > 0 && (
                  <span className="text-red-700 font-medium">
                    {" "}
                    ({row.overdue})
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-series-1" /> On track
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-700" /> Stage overdue
          (count in brackets)
        </span>
      </div>
    </>
  );
}

export default function ProductionPanel({
  pipeline,
  insights,
  insightsLoading,
  insightsError,
}) {
  const forecast = useMemo(() => {
    const f = insights?.forecast;
    if (!f) return null;
    const total = f.overdue + f.weeks.reduce((sum, w) => sum + w.count, 0);
    if (total === 0) return null;
    const labels = [
      "Overdue",
      ...f.weeks.map((w, i) => (i === 0 ? "This week" : formatDate(w.week))),
    ];
    return {
      data: {
        labels,
        datasets: [
          barDataset(
            "Installations",
            [f.overdue, ...f.weeks.map((w) => w.count)],
            [OVERDUE, ...f.weeks.map(() => SERIES_1)],
          ),
        ],
      },
      options: barOptions({
        legend: false,
        format: (v) => plural(v, "installation"),
        tick: (v) => v,
        titles: [
          "Already past due",
          ...f.weeks.map((w) => `Week of ${formatDate(w.week)}`),
        ],
      }),
    };
  }, [insights]);

  const throughput = useMemo(() => {
    const rows = insights?.throughput ?? [];
    if (!rows.some((r) => r.created > 0 || r.completed > 0)) return null;
    return {
      data: {
        labels: rows.map((r) => formatMonthLabel(r.month)),
        datasets: [
          barDataset(
            "Lots opened",
            rows.map((r) => r.created),
            SERIES_1,
          ),
          barDataset(
            "Lots completed",
            rows.map((r) => r.completed),
            SERIES_2,
          ),
        ],
      },
      options: barOptions({ format: (v) => v }),
    };
  }, [insights]);

  const lotStatus = pipeline?.lotStatus ?? {};
  const cycle = insights?.cycleTime;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <SectionCard
          title="Installation forecast"
          subtitle={`Active lots by installation week, next ${insights?.forecast?.weeks?.length ?? 8} weeks`}
          icon={CalendarClock}
          className="xl:col-span-2"
        >
          <InsightState
            loading={insightsLoading}
            error={insightsError}
            height="h-[240px]"
          >
            {forecast ? (
              <div style={{ height: "240px" }}>
                <Bar
                  data={forecast.data}
                  options={forecast.options}
                  aria-label="Installations due per week, with overdue lots in the first bar"
                  role="img"
                />
              </div>
            ) : (
              <EmptyState
                message="No installations due in the next 8 weeks."
                icon={CalendarClock}
                className="h-60"
              />
            )}
          </InsightState>
        </SectionCard>

        <SectionCard
          title="Installer workload"
          subtitle="Installations due in the next 4 weeks (incl. overdue)"
          icon={HardHat}
        >
          <InsightState loading={insightsLoading} error={insightsError}>
            <HBarList
              rows={insights?.installerLoad}
              label={(row) => row.name}
              value={(row) => row.count}
              tone={(row) =>
                row.name === "Unassigned" ? "bg-slate-400" : "bg-series-1"
              }
              emptyMessage="No installations due in the next 4 weeks."
              labelWidth="w-32"
            />
          </InsightState>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <SectionCard
          title="Throughput"
          subtitle="Lots opened vs completed per month, last 12 months"
          icon={TrendingUp}
          className="xl:col-span-2"
        >
          <InsightState
            loading={insightsLoading}
            error={insightsError}
            height="h-[240px]"
          >
            {throughput ? (
              <div style={{ height: "240px" }}>
                <Bar
                  data={throughput.data}
                  options={throughput.options}
                  aria-label="Lots opened and completed per month over the last 12 months"
                  role="img"
                />
              </div>
            ) : (
              <EmptyState
                message="No lots opened or completed in the last 12 months."
                icon={TrendingUp}
                className="h-60"
              />
            )}
          </InsightState>
        </SectionCard>

        <SectionCard
          title="Cycle time"
          subtitle="Lots completed in the last 12 months"
          icon={Hourglass}
        >
          <InsightState loading={insightsLoading} error={insightsError}>
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-semibold text-primary leading-none tabular-nums">
                  {cycle?.medianDays != null ? `${cycle.medianDays} days` : "—"}
                </p>
                <p className="text-xs text-slate-600 mt-1.5">
                  Median from lot start to completion
                  {cycle?.samples ? ` · ${plural(cycle.samples, "lot")}` : ""}
                </p>
              </div>
              {insights?.readyToClose > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {plural(insights.readyToClose, "active lot")} with every stage
                  done — ready to mark completed.
                </div>
              )}
              {Object.keys(lotStatus).length > 0 && (
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
                    All lots by status
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(lotStatus).map(([status, count]) => (
                      <span
                        key={status}
                        className={`${BADGE} ${STATUS_COLORS[status] ?? BADGE_TONES.neutral}`}
                      >
                        {titleCase(status)}
                        <span className="font-semibold tabular-nums">
                          {count}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </InsightState>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title="Where active lots are"
          subtitle="Each active lot at its first unfinished stage"
          icon={GitBranch}
        >
          <InsightState loading={insightsLoading} error={insightsError}>
            <CurrentStageBars rows={insights?.currentStage} />
          </InsightState>
        </SectionCard>

        <SectionCard
          title="Average stage duration"
          subtitle="Days from start to end for stages finished in the last 6 months"
          icon={Timer}
        >
          <InsightState loading={insightsLoading} error={insightsError}>
            <HBarList
              rows={insights?.stageDurations}
              label={(row) => titleCase(row.name)}
              value={(row) => row.avgDays}
              format={(v) => `${v}d`}
              detail={(row) => `${plural(row.samples, "stage")} measured`}
              emptyMessage="No finished stages with start and end dates yet."
              labelWidth="w-44"
            />
          </InsightState>
        </SectionCard>
      </div>
    </div>
  );
}
