"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Bar } from "react-chartjs-2";
import { Activity, Boxes, Flame, PackageMinus, Recycle } from "lucide-react";
import SectionCard, { EmptyState } from "./SectionCard";
import HBarList from "./HBarList";
import InsightState from "./InsightState";
import { barDataset, barOptions } from "../lib/charts";
import {
  SERIES_1,
  SERIES_2,
  formatDate,
  formatQty,
  titleCase,
} from "../lib/format";

const movementOptions = (titles) =>
  barOptions({ format: (v) => formatQty(v), titles });

export default function InventoryPanel({
  inventory,
  insights,
  insightsLoading,
  insightsError,
}) {
  const router = useRouter();

  // Used vs wasted per week: the two consumption outcomes share one unit, so
  // one axis. Restocking (ADDED) is a different question and stays a tile.
  const movementChart = useMemo(() => {
    const weeks = insights?.movementWeekly ?? [];
    if (!weeks.some((w) => w.USED > 0 || w.WASTED > 0)) return null;
    return {
      data: {
        labels: weeks.map((w) => formatDate(w.week)),
        datasets: [
          barDataset(
            "Used",
            weeks.map((w) => w.USED),
            SERIES_1,
          ),
          barDataset(
            "Wasted",
            weeks.map((w) => w.WASTED),
            SERIES_2,
          ),
        ],
      },
      options: movementOptions(
        weeks.map((w) => `Week of ${formatDate(w.week)}`),
      ),
    };
  }, [insights]);
  const movement = inventory?.movement30d;
  const lowStock = inventory?.lowStock ?? [];
  const topReserved = inventory?.topReserved ?? [];
  const reorderMode = inventory?.mode === "reorder";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <SectionCard
          title={reorderMode ? "Below reorder point" : "Out of stock"}
          subtitle={
            reorderMode
              ? "Items at or below their minimum stock level"
              : "No minimum stock levels set yet — showing items at or below zero"
          }
          icon={PackageMinus}
          bodyClassName="p-0"
        >
          {lowStock.length === 0 ? (
            <EmptyState
              message="Nothing needs reordering."
              icon={PackageMinus}
            />
          ) : (
            <div className="divide-y divide-slate-200 max-h-60 overflow-y-auto">
              {lowStock.map((item) => (
                <button
                  key={item.item_id}
                  type="button"
                  onClick={() =>
                    router.push(`/admin/inventory/${item.item_id}`)
                  }
                  className="cursor-pointer w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700 truncate">
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-500">
                        {titleCase(item.category)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-red-600 tabular-nums">
                        {formatQty(item.quantity, item.measurement_unit)}
                      </p>
                      {reorderMode && (
                        <p className="text-xs text-slate-500 tabular-nums">
                          min {formatQty(item.minimum_stock)}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Stock movement"
          subtitle="Last 30 days"
          icon={Recycle}
        >
          {!movement ? (
            <EmptyState message="No stock movement recorded." icon={Recycle} />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  {
                    label: "Added",
                    value: movement.ADDED,
                    tone: "text-green-700",
                  },
                  {
                    label: "Used",
                    value: movement.USED,
                    tone: "text-slate-700",
                  },
                  {
                    label: "Wasted",
                    value: movement.WASTED,
                    tone: "text-red-600",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg bg-slate-50 px-2 py-3 text-center"
                  >
                    <p
                      className={`text-lg font-semibold tabular-nums ${stat.tone}`}
                    >
                      {formatQty(stat.value)}
                    </p>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-200">
                <span className="text-sm text-slate-600">Waste rate</span>
                <span
                  className={`text-sm font-semibold tabular-nums ${movement.wastePct > 10 ? "text-red-700" : "text-slate-700"}`}
                >
                  {movement.wastePct}%
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Wasted as a share of everything consumed (used + wasted).
              </p>
              {insights?.wasteByCategory?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
                    Waste rate by category · 90 days
                  </p>
                  <HBarList
                    rows={insights.wasteByCategory}
                    label={(row) => titleCase(row.category)}
                    value={(row) => row.wastePct}
                    format={(v) => `${v}%`}
                    detail={(row) =>
                      `${formatQty(row.wasted)} wasted of ${formatQty(row.used + row.wasted)}`
                    }
                    tone={(row) =>
                      row.wastePct > 10 ? "bg-red-700" : "bg-series-1"
                    }
                    labelWidth="w-24"
                  />
                </div>
              )}
            </>
          )}
        </SectionCard>

        <SectionCard
          title="Reserved stock"
          subtitle="Committed against open requisitions"
          icon={Boxes}
          bodyClassName="p-0"
        >
          {topReserved.length === 0 ? (
            <EmptyState message="Nothing reserved." icon={Boxes} />
          ) : (
            <div className="divide-y divide-slate-200 max-h-60 overflow-y-auto">
              {topReserved.map((item) => {
                const short = item.reserved > item.onHand;
                return (
                  <div key={item.item_id} className="px-4 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-slate-700 truncate min-w-0">
                        {item.label}
                      </p>
                      <p className="text-xs shrink-0 tabular-nums">
                        <span
                          className={
                            short
                              ? "font-semibold text-red-700"
                              : "font-semibold text-slate-700"
                          }
                        >
                          {formatQty(item.reserved)}
                        </span>
                        <span className="text-slate-500">
                          {" / "}
                          {formatQty(item.onHand, item.measurement_unit)}
                        </span>
                      </p>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full rounded-full ${short ? "bg-red-500" : "bg-series-1"}`}
                        style={{
                          width: `${Math.min(100, item.onHand > 0 ? (item.reserved / item.onHand) * 100 : 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <SectionCard
          title="Weekly consumption"
          subtitle="Quantity used vs wasted, last 12 weeks"
          icon={Activity}
          className="xl:col-span-2"
        >
          <InsightState
            loading={insightsLoading}
            error={insightsError}
            height="h-[240px]"
          >
            {movementChart ? (
              <div style={{ height: "240px" }}>
                <Bar
                  data={movementChart.data}
                  options={movementChart.options}
                  aria-label="Weekly stock used and wasted over the last 12 weeks"
                  role="img"
                />
              </div>
            ) : (
              <EmptyState
                message="No stock used or wasted in the last 12 weeks."
                icon={Activity}
                className="h-60"
              />
            )}
          </InsightState>
        </SectionCard>

        <SectionCard
          title="Most used items"
          subtitle="By quantity used, last 90 days"
          icon={Flame}
        >
          <InsightState loading={insightsLoading} error={insightsError}>
            <HBarList
              rows={insights?.topConsumed}
              label={(row) => row.label}
              value={(row) => row.used}
              format={(v) => formatQty(v)}
              detail={(row) =>
                `${titleCase(row.category)}${row.measurement_unit ? ` · ${row.measurement_unit}` : ""}`
              }
              emptyMessage="No stock used in the last 90 days."
              labelWidth="w-32"
            />
          </InsightState>
        </SectionCard>
      </div>
    </div>
  );
}
