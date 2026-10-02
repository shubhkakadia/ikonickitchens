"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import axios from "axios";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import AdminShell from "@/components/AdminShell";
import SearchBar from "@/components/SearchBar";
import { useAuth } from "@/contexts/AuthContext";
import ClockPunchCard from "./components/ClockPunchCard";
import KpiStrip from "./components/KpiStrip";
import AttentionStrip from "./components/AttentionStrip";
import ProductionSchedule from "./components/ProductionSchedule";
import { MyMeetings, MyStages } from "./components/MyDayPanel";
import TodoPanel from "./components/TodoPanel";
import UpdatesPanel from "./components/UpdatesPanel";
import ActivityFeed from "./components/ActivityFeed";
import StorageIndicator from "./components/StorageIndicator";
import { SkeletonCard } from "./components/SectionCard";
import { formatTime } from "./lib/format";

// Chart.js and every chart panel live behind this boundary, so the first
// paint (greeting, KPIs, attention items, schedule) ships without them.
const InsightsPanel = dynamic(() => import("./components/InsightsPanel"), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <SkeletonCard className="xl:col-span-2 h-72" />
      <SkeletonCard className="h-72" />
    </div>
  ),
});

const AUTO_REFRESH_MS = 5 * 60 * 1000;

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

// Isolated so the ticking clock never re-renders the dashboard body.
// The previous dashboard ticked every second and re-rendered the whole page.
function HeaderClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-xs text-slate-500">
      {now.toLocaleDateString("en-AU", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}
      {" · "}
      {now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-[86px] bg-white rounded-lg border border-slate-200 animate-pulse"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <SkeletonCard className="xl:col-span-2 h-80" />
        <SkeletonCard className="h-80" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <SkeletonCard className="h-56" />
        <SkeletonCard className="h-56" />
        <SkeletonCard className="h-56" />
      </div>
    </div>
  );
}

export default function page() {
  const { getToken } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // Bumped on every successful reload so the Insights tabs drop their cache.
  const [refreshKey, setRefreshKey] = useState(0);
  const lastLoaded = useRef(0);
  const [storage, setStorage] = useState(null);
  const [storageLoading, setStorageLoading] = useState(true);
  const [storageError, setStorageError] = useState(null);
  // Keeps the previous payload on screen while a refresh is in flight.
  const hasData = useRef(false);

  // AuthContext recreates getToken on every render, so depending on its
  // identity would re-fire the fetch effect in a loop. Hold it in a ref and
  // keep the callback stable.
  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  });

  const fetchDashboard = useCallback(async () => {
    const token = getTokenRef.current();
    if (!token) {
      setError("No valid session found. Please login again.");
      return;
    }
    try {
      setRefreshing(true);
      setError(null);
      const response = await axios.get("/api/v1/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.status) {
        setData(response.data.data);
        if (hasData.current) setRefreshKey((k) => k + 1);
        hasData.current = true;
        lastLoaded.current = Date.now();
      } else {
        setError(response.data.message || "Failed to fetch dashboard data");
      }
    } catch (err) {
      console.error("Dashboard API Error:", err);
      setError(
        err.response?.data?.message ||
          "An error occurred while fetching dashboard data",
      );
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Coming back to a stale tab refreshes it, instead of polling in the
  // background while nobody is looking.
  useEffect(() => {
    const onVisible = () => {
      if (
        document.visibilityState === "visible" &&
        hasData.current &&
        Date.now() - lastLoaded.current > AUTO_REFRESH_MS
      ) {
        fetchDashboard();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchDashboard]);

  const getCurrentToken = useCallback(() => getTokenRef.current(), []);

  const fetchStorage = useCallback(async (refresh = false) => {
    const token = getTokenRef.current();
    if (!token) return;
    try {
      setStorageLoading(true);
      setStorageError(null);
      const res = await axios.get(
        `/api/v1/storage${refresh ? "?refresh=1" : ""}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data.status) setStorage(res.data.data);
      else setStorageError(res.data.message || "Storage usage unavailable");
    } catch (err) {
      // 403 simply means this user cannot see infrastructure data.
      if (err.response?.status === 403) setStorageError(null);
      else {
        console.error("Storage API Error:", err);
        setStorageError("Storage usage unavailable");
      }
      setStorage(null);
    } finally {
      setStorageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStorage();
  }, [fetchStorage]);

  const permissions = data?.permissions;

  // Month-to-date PO spend comes free with the 12-month series already in
  // the payload; no extra query.
  const kpis = useMemo(() => {
    const months = data?.procurement?.spendByMonth;
    if (!data?.kpis || !permissions?.purchaseOrders || !months?.length)
      return data?.kpis;
    return {
      ...data.kpis,
      spendThisMonth: Number(months.at(-1)?.poTotal) || 0,
      spendLastMonth: Number(months.at(-2)?.poTotal) || 0,
    };
  }, [data, permissions]);

  return (
    <AdminShell>
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="shrink-0 px-4 pt-4 pb-3">
          <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold text-slate-800 truncate">
                {greeting()}
                {data?.viewer?.name ? `, ${data.viewer.name}` : ""}
              </h1>
              <HeaderClock />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <SearchBar />
              {data?.generatedAt && (
                <span className="hidden md:inline text-xs text-slate-500 whitespace-nowrap">
                  as of {formatTime(data.generatedAt)}
                </span>
              )}
              <StorageIndicator
                storage={storage}
                loading={storageLoading}
                error={storageError}
                onRefresh={() => fetchStorage(true)}
              />
              <button
                type="button"
                onClick={fetchDashboard}
                disabled={refreshing}
                title="Refresh dashboard"
                aria-label="Refresh dashboard"
                className="cursor-pointer p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCcw
                  aria-hidden="true"
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6">
          {error && !hasData.current ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <AlertTriangle
                  aria-hidden="true"
                  className="w-8 h-8 text-red-500 mx-auto mb-4"
                />
                <p className="text-sm font-medium text-slate-600 mb-4">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={fetchDashboard}
                  className="cursor-pointer px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : !data ? (
            <DashboardSkeleton />
          ) : (
            <div
              className={`space-y-4 transition-opacity duration-200 ${refreshing ? "opacity-60" : "opacity-100"}`}
            >
              {error && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
                  Showing the last successful load — {error}
                </div>
              )}

              <ClockPunchCard />

              <KpiStrip kpis={kpis} permissions={permissions} />

              <AttentionStrip attention={data.attention} />

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 min-h-0">
                  {permissions?.projects ? (
                    <ProductionSchedule schedule={data.schedule} />
                  ) : permissions?.logs ? (
                    <ActivityFeed activity={data.activity} />
                  ) : (
                    <div className="bg-white rounded-lg border border-slate-200 h-full flex items-center justify-center p-8 text-center text-sm text-slate-600">
                      Your access is limited to your own day. Ask an
                      administrator if you need project or procurement
                      visibility.
                    </div>
                  )}
                </div>
                <div className="space-y-4 min-w-0">
                  <UpdatesPanel />
                  <TodoPanel />
                  <MyStages stages={data.myDay?.stages} />
                  <MyMeetings meetings={data.myDay?.meetings} />
                </div>
              </div>

              <InsightsPanel
                data={data}
                getToken={getCurrentToken}
                refreshKey={refreshKey}
              />

              {permissions?.logs && permissions?.projects && (
                <ActivityFeed activity={data.activity} />
              )}
            </div>
          )}
        </div>
      </main>
    </AdminShell>
  );
}
