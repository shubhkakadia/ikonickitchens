"use client";

import { useRouter } from "next/navigation";
import { Boxes, PackageMinus, Recycle } from "lucide-react";
import SectionCard, { EmptyState } from "./SectionCard";
import { formatQty, titleCase } from "../lib/format";

export default function InventoryPanel({ inventory }) {
  const router = useRouter();
  const movement = inventory?.movement30d;
  const lowStock = inventory?.lowStock ?? [];
  const topReserved = inventory?.topReserved ?? [];
  const reorderMode = inventory?.mode === "reorder";

  return (
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
          <EmptyState message="Nothing needs reordering." icon={PackageMinus} />
        ) : (
          <div className="divide-y divide-slate-200 max-h-60 overflow-y-auto">
            {lowStock.map((item) => (
              <button
                key={item.item_id}
                type="button"
                onClick={() => router.push(`/admin/inventory/${item.item_id}`)}
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
                { label: "Added", value: movement.ADDED, tone: "text-green-700" },
                { label: "Used", value: movement.USED, tone: "text-slate-700" },
                { label: "Wasted", value: movement.WASTED, tone: "text-red-600" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg bg-slate-50 px-2 py-3 text-center"
                >
                  <p className={`text-lg font-semibold tabular-nums ${stat.tone}`}>
                    {Number(stat.value).toLocaleString()}
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
  );
}
