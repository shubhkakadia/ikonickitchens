"use client";

import axios from "axios";
import {
  AlertTriangle,
  Coffee,
  LogIn,
  LogOut,
  Play,
  Timer,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { useAuth } from "@/contexts/AuthContext";
import { calculateClockPunchHours } from "@/lib/clockPunchMetrics";
import {
  CLOCK_PUNCH_MINIMUM_BREAK_MINUTES,
  formatClockPunchAction,
  summarizeClockPunchDay,
} from "@/lib/clockPunchSequence";

const CLOCK_PUNCH_TIME_ZONE = "Australia/Adelaide";
const MINIMUM_BREAK_MS = CLOCK_PUNCH_MINIMUM_BREAK_MINUTES * 60 * 1000;

const actionButtonStyles = {
  CLOCK_IN: "bg-emerald-600 hover:bg-emerald-700 text-white",
  BREAK_IN: "bg-amber-500 hover:bg-amber-600 text-white",
  BREAK_OUT: "bg-blue-600 hover:bg-blue-700 text-white",
  CLOCK_OUT: "bg-red-600 hover:bg-red-700 text-white",
};

const actionIcons = {
  CLOCK_IN: LogIn,
  BREAK_IN: Coffee,
  BREAK_OUT: Play,
  CLOCK_OUT: LogOut,
};

const dayFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: CLOCK_PUNCH_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const longDateFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: CLOCK_PUNCH_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
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

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

function formatRemaining(milliseconds) {
  const totalMinutes = Math.ceil(milliseconds / 60000);
  return totalMinutes === 1 ? "1 minute" : `${totalMinutes} minutes`;
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

  // The widget is only meaningful for accounts linked to an employee record.
  if (!employeeId) return null;

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
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : summary.isComplete
        ? "border-slate-200 bg-slate-100 text-slate-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-slate-800">Time Clock</h2>
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles}`}
            >
              {statusLabel}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {longDateFormatter.format(new Date())} • Adelaide time
          </p>

          {summary.lastPunch && (
            <p className="mt-1 text-sm text-slate-600">
              Last punch:{" "}
              <span className="font-medium text-slate-800">
                {formatClockPunchAction(summary.lastAction)}
              </span>{" "}
              at {toDisplayTime(summary.lastPunch.punched_at)}
            </p>
          )}
        </div>

        {/* Live durations */}
        <div className="flex flex-wrap items-center gap-6">
          {isOnBreak && (
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Break Duration
              </p>
              <p className="text-2xl font-bold tabular-nums text-amber-600">
                {formatDuration(breakMilliseconds)}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {summary.isComplete ? "Worked Today" : "Time Worked"}
            </p>
            <p className="text-2xl font-bold tabular-nums text-slate-800">
              {formatDuration(workedMilliseconds)}
            </p>
          </div>
        </div>

        {/* Punch actions */}
        <div className="flex flex-wrap items-center gap-2">
          {loading ? (
            <span className="text-sm text-slate-500">Loading...</span>
          ) : error ? (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-600">{error}</span>
              <button
                type="button"
                onClick={() => fetchToday()}
                className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                Retry
              </button>
            </div>
          ) : (
            summary.allowedActions.map((action) => {
              const Icon = actionIcons[action];
              const isLocked = action === "BREAK_OUT" && isBreakOutLocked;
              const isSubmitting = submittingAction === action;
              const isDisabled =
                isLocked || Boolean(submittingAction) || isSubmitting;

              return (
                <button
                  key={action}
                  type="button"
                  onClick={() => handlePunch(action)}
                  disabled={isDisabled}
                  title={
                    isLocked
                      ? `Break out unlocks after the ${CLOCK_PUNCH_MINIMUM_BREAK_MINUTES} minute minimum break`
                      : undefined
                  }
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                    actionButtonStyles[action]
                  } ${
                    isDisabled
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {isSubmitting ? "Saving..." : formatClockPunchAction(action)}
                  {isLocked && (
                    <span className="text-xs font-normal">
                      (in {formatRemaining(breakRemainingMs)})
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
