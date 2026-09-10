"use client";

import { AlertTriangle, Coffee, LogIn, LogOut, Play, Timer } from "lucide-react";
import {
  CLOCK_PUNCH_MINIMUM_BREAK_MINUTES,
  formatClockPunchAction,
} from "@/lib/clockPunchSequence";

// Pure presentation for the time clock. ClockPunchCard owns the data; this owns
// the markup, so both the live card and the preview harness render identically.

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

const ACTION_HINTS = {
  CLOCK_IN: "Start your day",
  BREAK_IN: "Take your break",
  BREAK_OUT: "Back to work",
  CLOCK_OUT: "End your day",
};

const longDateFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Adelaide",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

// mm:ss, for the live countdown to the break-out unlock.
export function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function ClockPunchView({
  statusLabel,
  statusStyles,
  accent,
  lastActionLabel,
  lastPunchTime,
  isComplete,
  isOnBreak,
  isOnTheClock,
  workedMilliseconds,
  breakMilliseconds,
  breakRemainingMs,
  isBreakOutLocked,
  breakProgress,
  allowedActions,
  loading,
  error,
  submittingAction,
  onPunch,
  onRetry,
}) {
  return (
    <div className={`bg-white rounded-xl border-2 ${accent} overflow-hidden`}>
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        <div className="px-5 py-4 lg:w-60 shrink-0 border-b lg:border-b-0 lg:border-r border-slate-100">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-primary shrink-0" />
            <h2 className="text-sm font-bold text-primary">Time Clock</h2>
          </div>
          <span
            className={`inline-flex mt-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles}`}
          >
            {statusLabel}
          </span>
          <p className="mt-2 text-[11px] text-slate-400 leading-tight">
            {longDateFormatter.format(new Date())}
            <br />
            Adelaide time
          </p>
          {lastActionLabel && (
            <p className="mt-1.5 text-[11px] text-slate-500">
              Last: {lastActionLabel} at {lastPunchTime}
            </p>
          )}
        </div>

        <div className="px-5 py-4 flex-1 flex flex-wrap items-center gap-6 min-w-0">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {isComplete ? "Worked today" : "Time worked"}
            </p>
            <p
              className={`text-3xl font-bold tabular-nums leading-tight ${isOnTheClock && !isOnBreak ? "text-emerald-600" : "text-slate-800"}`}
            >
              {formatDuration(workedMilliseconds)}
            </p>
          </div>

          {isOnBreak && (
            <>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  On break for
                </p>
                <p className="text-3xl font-bold tabular-nums leading-tight text-amber-600">
                  {formatDuration(breakMilliseconds)}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className="relative w-14 h-14 shrink-0 rounded-full"
                  style={{
                    background: `conic-gradient(${isBreakOutLocked ? "#F59E0B" : "#059669"} ${breakProgress * 360}deg, #F1F5F9 0deg)`,
                  }}
                  role="img"
                  aria-label={`${Math.round(breakProgress * 100)} percent of the minimum break elapsed`}
                >
                  <div className="absolute inset-[5px] rounded-full bg-white flex items-center justify-center">
                    <span
                      className={`text-[11px] font-bold tabular-nums ${isBreakOutLocked ? "text-amber-600" : "text-emerald-600"}`}
                    >
                      {isBreakOutLocked ? formatCountdown(breakRemainingMs) : "OK"}
                    </span>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {isBreakOutLocked ? "Break unlocks in" : "Break minimum met"}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                    {isBreakOutLocked
                      ? `${CLOCK_PUNCH_MINIMUM_BREAK_MINUTES} minute minimum`
                      : "You can return to work"}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 shrink-0 border-t lg:border-t-0 lg:border-l border-slate-100 flex items-center">
          {loading ? (
            <span className="text-sm text-slate-500">Loading...</span>
          ) : error ? (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <span className="text-sm text-red-600">{error}</span>
              <button
                type="button"
                onClick={onRetry}
                className="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                Retry
              </button>
            </div>
          ) : !allowedActions || allowedActions.length === 0 ? (
            <span className="text-sm text-slate-500">
              Nothing left to record today.
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {allowedActions.map((action) => {
                const Icon = actionIcons[action];
                const isLocked = action === "BREAK_OUT" && isBreakOutLocked;
                const isSubmitting = submittingAction === action;
                const isDisabled =
                  isLocked || Boolean(submittingAction) || isSubmitting;

                return (
                  <button
                    key={action}
                    type="button"
                    onClick={() => onPunch(action)}
                    disabled={isDisabled}
                    title={
                      isLocked
                        ? `Break out unlocks after the ${CLOCK_PUNCH_MINIMUM_BREAK_MINUTES} minute minimum break`
                        : ACTION_HINTS[action]
                    }
                    className={`flex flex-col items-center justify-center gap-1 rounded-lg px-5 py-3 text-sm font-semibold transition-all duration-200 ${
                      actionButtonStyles[action]
                    } ${isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:shadow-md"}`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {isSubmitting ? "Saving..." : formatClockPunchAction(action)}
                    </span>
                    <span className="text-[10px] font-normal opacity-90 tabular-nums">
                      {isLocked
                        ? `unlocks in ${formatCountdown(breakRemainingMs)}`
                        : ACTION_HINTS[action]}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
