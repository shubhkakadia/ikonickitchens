"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { BarChart3, Boxes, Factory, ShoppingCart } from "lucide-react";
import ProductionPanel from "./ProductionPanel";
import ProcurementPanel from "./ProcurementPanel";
import InventoryPanel from "./InventoryPanel";

const TABS = [
  { key: "production", label: "Production", icon: Factory, gate: "projects" },
  {
    key: "procurement",
    label: "Procurement",
    icon: ShoppingCart,
    gate: "procurement",
  },
  { key: "inventory", label: "Inventory", icon: Boxes, gate: "inventory" },
];

const STORAGE_KEY = "dashboard.insightsTab";

const readStoredTab = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * Tabbed analytics area. Only the active tab renders, and each tab's trend
 * data is fetched the first time it is opened (then kept until the dashboard
 * is refreshed), so the dashboard's first load never waits on chart queries.
 *
 * - data:       the /api/v1/dashboard payload (headline numbers per section)
 * - getToken:   returns the current bearer token
 * - refreshKey: bump to discard cached insights and refetch the active tab
 */
export default function InsightsPanel({ data, getToken, refreshKey }) {
  const permissions = data?.permissions;
  const tabs = TABS.filter((tab) => permissions?.[tab.gate]);

  const [active, setActive] = useState(() => {
    const stored = readStoredTab();
    return tabs.some((t) => t.key === stored) ? stored : tabs[0]?.key;
  });
  const [cache, setCache] = useState({});
  const [errors, setErrors] = useState({});
  const inFlight = useRef(new Set());

  const load = useCallback(
    async (section) => {
      if (inFlight.current.has(section)) return;
      const token = getToken();
      if (!token) return;
      inFlight.current.add(section);
      setErrors((prev) => ({ ...prev, [section]: null }));
      try {
        const res = await axios.get("/api/v1/dashboard/insights", {
          params: { section },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data.status) {
          setCache((prev) => ({ ...prev, [section]: res.data.data }));
        } else {
          setErrors((prev) => ({
            ...prev,
            [section]: res.data.message || "Charts unavailable",
          }));
        }
      } catch (err) {
        console.error("Dashboard insights error:", err);
        setErrors((prev) => ({
          ...prev,
          [section]: err.response?.data?.message || "Charts unavailable",
        }));
      } finally {
        inFlight.current.delete(section);
      }
    },
    [getToken],
  );

  // A dashboard refresh invalidates every tab; only the open one refetches.
  const lastRefresh = useRef(refreshKey);
  useEffect(() => {
    if (lastRefresh.current === refreshKey) return;
    lastRefresh.current = refreshKey;
    setCache({});
    if (active) load(active);
  }, [refreshKey, active, load]);

  useEffect(() => {
    if (active && !cache[active] && !errors[active]) load(active);
  }, [active, cache, errors, load]);

  if (tabs.length === 0 || !active) return null;

  const select = (key) => {
    setActive(key);
    try {
      window.localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // Storage blocked; the tab still switches for this visit.
    }
  };

  const insights = cache[active];
  const shared = {
    insights,
    insightsLoading: !insights && !errors[active],
    insightsError: errors[active],
  };

  return (
    <section aria-label="Insights" className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <BarChart3 className="w-4 h-4 text-primary" aria-hidden="true" />
          Insights
        </h2>
        {tabs.length > 1 && (
          <div
            role="tablist"
            aria-label="Insight areas"
            className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5"
          >
            {tabs.map((tab) => {
              const selected = tab.key === active;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => select(tab.key)}
                  className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary ${
                    selected
                      ? "bg-primary text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
        {errors[active] && (
          <button
            type="button"
            onClick={() => load(active)}
            className="cursor-pointer text-xs font-medium text-primary hover:underline"
          >
            Retry charts
          </button>
        )}
      </div>

      <div role="tabpanel">
        {active === "production" && (
          <ProductionPanel pipeline={data.pipeline} {...shared} />
        )}
        {active === "procurement" && data.procurement && (
          <ProcurementPanel
            procurement={data.procurement}
            permissions={permissions}
            {...shared}
          />
        )}
        {active === "inventory" && data.inventory && (
          <InventoryPanel inventory={data.inventory} {...shared} />
        )}
      </div>
    </section>
  );
}
