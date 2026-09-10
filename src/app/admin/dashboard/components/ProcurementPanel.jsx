"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { Building2, Layers3, TrendingDown, Wallet } from "lucide-react";
import SectionCard, { EmptyState } from "./SectionCard";
import {
  formatCompactCurrency,
  formatCurrency,
  formatMonthLabel,
  titleCase,
} from "../lib/format";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

// Two series, one shared unit (AUD) so they share one axis.
// Validated pair: lightness band, chroma, CVD separation and contrast all pass.
const SERIES_PO = "#3D4FB5";
const SERIES_STATEMENT = "#B92F34";

// Ageing is an ordered severity scale, not a categorical palette. Every
// segment is directly labelled, so colour only reinforces the order.
const AGEING = [
  { key: "current", label: "Not yet due", color: "#64748B" },
  { key: "d1_30", label: "1–30 days", color: "#F59E0B" },
  { key: "d31_60", label: "31–60 days", color: "#EA580C" },
  { key: "d60plus", label: "60+ days", color: "#B91C1C" },
];

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: {
      position: "bottom",
      labels: {
        boxWidth: 10,
        boxHeight: 10,
        usePointStyle: true,
        pointStyle: "circle",
        font: { size: 11 },
        color: "#475569",
      },
    },
    tooltip: {
      backgroundColor: "#1e293b",
      padding: 10,
      cornerRadius: 8,
      titleFont: { size: 12 },
      bodyFont: { size: 12 },
      callbacks: {
        label: (ctx) =>
          `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y ?? 0)}`,
      },
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      border: { display: false },
      grid: { color: "#f1f5f9" },
      ticks: {
        font: { size: 10 },
        color: "#94a3b8",
        callback: (value) => formatCompactCurrency(value),
      },
    },
    x: {
      border: { display: false },
      grid: { display: false },
      ticks: { font: { size: 10 }, color: "#94a3b8" },
    },
  },
};

function StatusBars({ rows, emptyMessage }) {
  const max = Math.max(1, ...(rows ?? []).map((r) => r.count));
  if (!rows || rows.length === 0)
    return <EmptyState message={emptyMessage} className="py-6" />;
  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.status} className="flex items-center gap-3">
          <span className="text-[11px] text-slate-600 w-36 shrink-0 truncate">
            {titleCase(row.status)}
          </span>
          <div className="flex-1 h-4 bg-slate-50 rounded-r overflow-hidden min-w-0">
            <div
              className="h-full rounded-r-[4px] bg-[#3D4FB5]"
              style={{ width: `${Math.max(2, (row.count / max) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-700 w-8 text-right shrink-0 tabular-nums">
            {row.count}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ProcurementPanel({ procurement, permissions }) {
  const spendData = useMemo(() => {
    const rows = procurement?.spendByMonth ?? [];
    if (rows.length === 0) return null;
    const hasValues = rows.some(
      (r) => Number(r.poTotal) > 0 || Number(r.statementTotal) > 0,
    );
    if (!hasValues) return null;
    return {
      labels: rows.map((r) => formatMonthLabel(r.month)),
      datasets: [
        {
          label: "Purchase orders",
          data: rows.map((r) => Number(r.poTotal) || 0),
          backgroundColor: SERIES_PO,
          borderRadius: 4,
          borderSkipped: "bottom",
          maxBarThickness: 18,
        },
        {
          label: "Supplier statements",
          data: rows.map((r) => Number(r.statementTotal) || 0),
          backgroundColor: SERIES_STATEMENT,
          borderRadius: 4,
          borderSkipped: "bottom",
          maxBarThickness: 18,
        },
      ],
    };
  }, [procurement]);

  const ageing = procurement?.payablesAgeing;
  const ageingTotal = ageing
    ? AGEING.reduce((sum, b) => sum + (Number(ageing[b.key]) || 0), 0)
    : 0;

  const topSuppliers = procurement?.topSuppliers ?? [];
  const supplierMax = Math.max(1, ...topSuppliers.map((s) => Number(s.total)));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <SectionCard
          title="Outgoing spend"
          subtitle="Last 12 months"
          icon={TrendingDown}
          className="xl:col-span-2"
        >
          {spendData ? (
            <div style={{ height: "240px" }}>
              <Bar data={spendData} options={chartOptions} />
            </div>
          ) : (
            <EmptyState
              message="No purchase order or statement totals recorded in the last 12 months."
              className="h-[240px]"
            />
          )}
        </SectionCard>

        <SectionCard title="Top suppliers" subtitle="By spend, last 12 months" icon={Building2}>
          {topSuppliers.length === 0 ? (
            <EmptyState message="No supplier spend recorded." />
          ) : (
            <div className="space-y-2.5">
              {topSuppliers.map((supplier) => (
                <div key={supplier.supplier_id}>
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="text-[12px] text-slate-700 truncate">
                      {supplier.name}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-600 shrink-0 tabular-nums">
                      {formatCurrency(supplier.total)}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-50 rounded-r overflow-hidden">
                    <div
                      className="h-full rounded-r-[4px] bg-[#3D4FB5]"
                      style={{
                        width: `${Math.max(2, (Number(supplier.total) / supplierMax) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {permissions?.statements && (
          <SectionCard
            title="Payables ageing"
            subtitle="Unpaid supplier statements"
            icon={Wallet}
          >
            {ageingTotal === 0 ? (
              <EmptyState message="Nothing outstanding." className="py-6" />
            ) : (
              <>
                <div className="flex h-3 rounded overflow-hidden gap-0.5 mb-3">
                  {AGEING.map((bucket) => {
                    const value = Number(ageing[bucket.key]) || 0;
                    if (value <= 0) return null;
                    return (
                      <div
                        key={bucket.key}
                        style={{
                          width: `${(value / ageingTotal) * 100}%`,
                          backgroundColor: bucket.color,
                        }}
                        title={`${bucket.label}: ${formatCurrency(value)}`}
                      />
                    );
                  })}
                </div>
                <div className="space-y-1.5">
                  {AGEING.map((bucket) => (
                    <div
                      key={bucket.key}
                      className="flex items-center justify-between gap-2 text-[12px]"
                    >
                      <span className="flex items-center gap-2 text-slate-600">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: bucket.color }}
                        />
                        {bucket.label}
                      </span>
                      <span className="font-semibold text-slate-700 tabular-nums">
                        {formatCurrency(ageing[bucket.key])}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </SectionCard>
        )}

        {permissions?.purchaseOrders && (
          <SectionCard title="Purchase orders by status" icon={Layers3}>
            <StatusBars
              rows={procurement?.poByStatus}
              emptyMessage="No purchase orders."
            />
          </SectionCard>
        )}

        {permissions?.materialsToOrder && (
          <SectionCard title="Materials to order by status" icon={Layers3}>
            <StatusBars
              rows={procurement?.mtoByStatus}
              emptyMessage="No requisitions."
            />
          </SectionCard>
        )}
      </div>
    </div>
  );
}
