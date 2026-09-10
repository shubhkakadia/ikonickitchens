"use client";

import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ClipboardList,
  CheckCircle2,
  PackageMinus,
  Receipt,
  Timer,
  Truck,
} from "lucide-react";
import { formatCurrency } from "../lib/format";

// Order matters: most time-critical first.
const TILES = [
  {
    key: "overdueInstalls",
    label: "Overdue installs",
    icon: CalendarClock,
    tone: "critical",
    hint: "Active lots past their installation due date",
  },
  {
    key: "overdueStages",
    label: "Overdue stages",
    icon: Timer,
    tone: "critical",
    hint: "Unfinished stages past their end date",
  },
  {
    key: "lateDeliveries",
    label: "Late deliveries",
    icon: Truck,
    tone: "warn",
    hint: (tile) =>
      tile.mode === "eta"
        ? "Purchase orders past their expected delivery date"
        : "Open purchase orders ordered over 21 days ago",
  },
  {
    key: "overduePayables",
    label: "Overdue payables",
    icon: Receipt,
    tone: "critical",
    hint: "Unpaid supplier statements past their due date",
    detail: (tile) => formatCurrency(tile.amount),
  },
  {
    key: "lowStock",
    label: (tile) => (tile.mode === "reorder" ? "Below reorder point" : "Out of stock"),
    icon: PackageMinus,
    tone: "warn",
    hint: (tile) =>
      tile.mode === "reorder"
        ? "Items at or below their minimum stock level"
        : "Items at or below zero. Set minimum stock levels for reorder alerts.",
  },
  {
    key: "unorderedMtoLines",
    label: "Unordered MTO lines",
    icon: ClipboardList,
    tone: "info",
    hint: "Material lines on open requisitions not yet fully ordered",
  },
  {
    key: "punchesToReview",
    label: "Punches to review",
    icon: Timer,
    tone: "info",
    hint: "Clock punches awaiting approval",
  },
];

const TONES = {
  critical: {
    ring: "hover:border-red-300",
    chip: "bg-red-50 text-red-600",
    value: "text-red-600",
  },
  warn: {
    ring: "hover:border-amber-300",
    chip: "bg-amber-50 text-amber-600",
    value: "text-amber-600",
  },
  info: {
    ring: "hover:border-primary/30",
    chip: "bg-primary/10 text-primary",
    value: "text-primary",
  },
};

const resolve = (value, tile) =>
  typeof value === "function" ? value(tile) : value;

export default function AttentionStrip({ attention }) {
  const router = useRouter();

  const active = TILES.map((config) => ({
    config,
    tile: attention?.[config.key],
  })).filter(({ tile }) => tile && tile.count > 0);

  const tracked = TILES.filter(({ key }) => attention?.[key]).length;

  if (tracked === 0) return null;

  if (active.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-green-200 px-4 py-4 flex items-center gap-3">
        <div className="p-2 rounded-lg bg-green-50">
          <CheckCircle2 className="w-5 h-5 text-green-600" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-semibold text-green-800">
            All clear — nothing overdue
          </p>
          <p className="text-xs text-slate-600">
            No late installs, deliveries, payables or stock shortfalls across
            the areas you can see.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {active.map(({ config, tile }) => {
        const tone = TONES[config.tone];
        const detail = config.detail ? config.detail(tile) : null;
        return (
          <button
            key={config.key}
            type="button"
            onClick={() => router.push(tile.href)}
            title={resolve(config.hint, tile)}
            className={`cursor-pointer text-left bg-white rounded-lg border border-slate-200 p-3 transition-colors duration-200 hover:bg-slate-50 ${tone.ring} focus:outline-none focus:ring-2 focus:ring-primary`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={`text-2xl font-semibold leading-none ${tone.value}`}>
                  {tile.count.toLocaleString()}
                </p>
                <p className="text-xs font-semibold text-slate-600 mt-1.5 leading-tight">
                  {resolve(config.label, tile)}
                </p>
                {detail && (
                  <p className="text-xs text-slate-500 mt-0.5">{detail}</p>
                )}
              </div>
              <span className={`p-1.5 rounded-lg shrink-0 ${tone.chip}`}>
                <config.icon className="w-4 h-4" aria-hidden="true" />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
