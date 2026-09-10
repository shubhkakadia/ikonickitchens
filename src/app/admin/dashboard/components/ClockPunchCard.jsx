"use client";

import axios from "axios";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { Timer } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { calculateClockPunchHours } from "@/lib/clockPunchMetrics";
import {
  CLOCK_PUNCH_MINIMUM_BREAK_MINUTES,
  formatClockPunchAction,
  summarizeClockPunchDay,
} from "@/lib/clockPunchSequence";
import ClockPunchView from "./ClockPunchView";

const CLOCK_PUNCH_TIME_ZONE = "Australia/Adelaide";
const MINIMUM_BREAK_MS = CLOCK_PUNCH_MINIMUM_BREAK_MINUTES * 60 * 1000;

const dayFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: CLOCK_PUNCH_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: CLOCK_PUNCH_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

// Everything is anchored to the Adelaide day, not the browser's.
function getTodayInTimeZone() {
  const parts = dayFormatter.formatToParts(new Date());
  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function toDisplayTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return timeFormatter.format(date);
}

export default function ClockPunchCard() {
  const { userData } = useAuth();
  const token = userData?.token || null;
  const employeeId = userData?.user?.employee_id || null;

  const [punches, setPunches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submittingAction, setSubmittingAction] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const today = getTodayInTimeZone();

  const fetchToday = useCallback(
    async (signal) => {
      if (!token || !employeeId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const response = await axios.get(
          `/api/v1/clock_punch/employee/${employeeId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { from: today, to: today },
            ...(signal ? { signal } : {}),
          },
        );

        if (!response.data.status) {
          setError(response.data.message || "Failed to load today's punches");
          return;
        }

        setPunches(
          (response.data.data || [])
            .flatMap((dateGroup) => dateGroup.employee_groups || [])
            .flatMap((employeeGroup) => employeeGroup.punches || []),
        );
      } catch (requestError) {
        if (requestError.code === "ERR_CANCELED") return;
        console.error("Error fetching today's punches:", requestError);
        setError(
          requestError.response?.data?.message ||
            "Unable to load your clock punches.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [employeeId, today, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchToday(controller.signal);
    return () => controller.abort();
  }, [fetchToday]);

  const summary = useMemo(() => summarizeClockPunchDay(punches), [punches]);
  const isOnBreak = summary.lastAction === "BREAK_IN";
  const isOnTheClock = Boolean(summary.lastAction) && !summary.isComplete;

  // Only tick while there is a running duration to show.
  useEffect(() => {
    if (!isOnTheClock) return undefined;

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isOnTheClock]);

  const workedMilliseconds =
    calculateClockPunchHours(punches, isOnTheClock ? now : undefined) *
    60 *
    60 *
    1000;

  const breakStartedAt = isOnBreak
    ? new Date(summary.lastPunch.punched_at).getTime()
    : null;
  const breakMilliseconds = breakStartedAt ? now - breakStartedAt : 0;
  const breakRemainingMs = breakStartedAt
    ? MINIMUM_BREAK_MS - breakMilliseconds
    : 0;
  const isBreakOutLocked = isOnBreak && breakRemainingMs > 0;

  const handlePunch = async (action) => {
    try {
      setSubmittingAction(action);

      const response = await axios.post(
        "/api/v1/clock_punch/create",
        { action },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.data.status) {
        toast.error(response.data.message || "Failed to record the punch");
        return;
      }

      toast.success(`${formatClockPunchAction(action)} recorded`);
      setNow(Date.now());
      await fetchToday();
    } catch (requestError) {
      console.error("Error recording clock punch:", requestError);
      toast.error(
        requestError.response?.data?.message ||
          "Failed to record the punch. Please try again.",
      );
      // A 409 means the day moved on elsewhere, so resync the buttons.
      if (requestError.response?.status === 409) await fetchToday();
    } finally {
      setSubmittingAction(null);
    }
  };

  // Punching requires a linked employee record. Master-admin accounts usually
  // have none, so say so rather than rendering nothing.
  if (!employeeId) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 flex items-center gap-3">
        <Timer className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-600">
            Time clock unavailable
          </p>
          <p className="text-xs text-slate-600">
            This login isn&apos;t linked to an employee record, so it can&apos;t
            record punches. Link it on the employee profile to clock in here.
          </p>
        </div>
      </div>
    );
  }

  // Progress through the minimum break, for the countdown ring.
  const breakProgress = isOnBreak
    ? Math.min(1, breakMilliseconds / MINIMUM_BREAK_MS)
    : 0;

  const statusLabel = summary.isEmpty
    ? "Not clocked in yet"
    : isOnBreak
      ? "On break"
      : summary.isComplete
        ? "Clocked out"
        : "Working";

  const statusStyles = summary.isEmpty
    ? "border-slate-200 bg-slate-50 text-slate-600"
    : isOnBreak
      ? "border-amber-200 bg-amber-100 text-amber-800"
      : summary.isComplete
        ? "border-slate-200 bg-slate-100 text-slate-800"
        : "border-green-200 bg-green-100 text-green-800";

  const accent = summary.isEmpty
    ? "border-slate-200"
    : isOnBreak
      ? "border-amber-300"
      : summary.isComplete
        ? "border-slate-200"
        : "border-green-300";

  return (
    <ClockPunchView
      statusLabel={statusLabel}
      statusStyles={statusStyles}
      accent={accent}
      lastActionLabel={
        summary.lastPunch ? formatClockPunchAction(summary.lastAction) : null
      }
      lastPunchTime={
        summary.lastPunch ? toDisplayTime(summary.lastPunch.punched_at) : null
      }
      isComplete={summary.isComplete}
      isOnBreak={isOnBreak}
      isOnTheClock={isOnTheClock}
      workedMilliseconds={workedMilliseconds}
      breakMilliseconds={breakMilliseconds}
      breakRemainingMs={breakRemainingMs}
      isBreakOutLocked={isBreakOutLocked}
      breakProgress={breakProgress}
      allowedActions={summary.allowedActions}
      loading={loading}
      error={error}
      submittingAction={submittingAction}
      onPunch={handlePunch}
      onRetry={() => fetchToday()}
    />
  );
}
