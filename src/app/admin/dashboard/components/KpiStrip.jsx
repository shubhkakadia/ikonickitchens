"use client";

import { useRouter } from "next/navigation";
import {
  ClipboardList,
  FolderKanban,
  Layers,
  ShoppingCart,
  Target,
} from "lucide-react";

// Always-on scale counts: how much work is in flight, regardless of whether
// anything is wrong. The attention strip below answers the separate question
// of what needs action today.
const CARDS = [
  { key: "activeProjects", label: "Active projects", icon: FolderKanban, href: "/admin/projects", gate: "projects" },
  { key: "activeLots", label: "Active lots", icon: Layers, href: "/admin/projects/lotatglance", gate: "projects" },
  { key: "openMtoCount", label: "Open MTOs", icon: ClipboardList, href: "/admin/suppliers/materialstoorder", gate: "materialsToOrder" },
  { key: "openPoCount", label: "Open POs", icon: ShoppingCart, href: "/admin/suppliers/purchaseorder", gate: "purchaseOrders" },
  { key: "completedThisMonth", label: "Lots completed", sub: "This month", icon: Target, href: "/admin/projects", gate: "projects" },
];

export default function KpiStrip({ kpis, permissions }) {
  const router = useRouter();
  const visible = CARDS.filter(
    (c) => permissions?.[c.gate] && kpis?.[c.key] != null,
  );
  if (visible.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {visible.map((card) => (
        <button
          key={card.key}
          type="button"
          onClick={() => router.push(card.href)}
          className="cursor-pointer text-left bg-white rounded-lg border border-slate-200 p-3 transition-colors duration-200 hover:bg-slate-50 hover:border-primary/25 focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-2xl font-semibold text-primary leading-none tabular-nums">
                {Number(kpis[card.key]).toLocaleString()}
              </p>
              <p className="text-xs font-semibold text-slate-600 mt-1.5 leading-tight">
                {card.label}
              </p>
              {card.sub && (
                <p className="text-xs text-slate-500 mt-0.5">{card.sub}</p>
              )}
            </div>
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
              <card.icon className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
