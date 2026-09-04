"use client";

import axios from "axios";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CircleCheck,
  Clock,
  Info,
  ListChecks,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import AdminShell from "@/components/AdminShell";
import CustomDropdown from "@/components/CustomDropdown";
import TabsController from "@/components/tabscontroller";
import { useAuth } from "@/contexts/AuthContext";
import {
  findSequenceViolation,
  formatClockPunchAction,
  getAllowedNextActions,
  summarizeClockPunchDay,
} from "@/lib/clockPunchSequence";

const CLOCK_PUNCH_TIME_ZONE = "Australia/Adelaide";

const actionStyles = {
  CLOCK_IN: "border-emerald-200 bg-emerald-50 text-emerald-700",
  BREAK_IN: "border-amber-200 bg-amber-50 text-amber-700",
  BREAK_OUT: "border-blue-200 bg-blue-50 text-blue-700",
  CLOCK_OUT: "border-slate-200 bg-slate-100 text-slate-700",
};

const reviewStyles = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
};

const dayFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: CLOCK_PUNCH_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const clockFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: CLOCK_PUNCH_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const displayTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: CLOCK_PUNCH_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

// The whole feature works in Adelaide time, so "today" and the times shown next
// to existing punches are always resolved in that zone rather than the browser's.
function getTodayInTimeZone() {
  const parts = dayFormatter.formatToParts(new Date());
  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function toWallClock(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return clockFormatter.format(date);
}

function toDisplayTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return displayTimeFormatter.format(date);
}

// Wall clock times on a single day, pinned to a shared reference date so the
// projected-day preview measures gaps in Adelaide time.
function toReferenceInstant(wallClock) {
  return `1970-01-01T${wallClock}:00Z`;
}

function formatLongDate(date) {
  if (!date) return "";
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function employeeLabel(employee) {
  const name = [employee?.first_name, employee?.last_name]
    .filter(Boolean)
    .join(" ");
  return name || employee?.employee_id || "Unknown employee";
}

function createDraft(action = "", time = "") {
  return {
    key:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,
    action,
    time,
  };
}

export default function page() {
  const router = useRouter();
  const { userData, isAdmin } = useAuth();
  const token = userData?.token || null;
  const canApprove = isAdmin();

  const [date, setDate] = useState(getTodayInTimeZone);
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);

  const [dayPunches, setDayPunches] = useState([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState("");

  const [drafts, setDrafts] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const fetchEmployees = async () => {
      try {
        setEmployeesLoading(true);
        if (!token) return;

        const response = await axios.get("/api/v1/employee/all", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (!response.data.status) {
          toast.error(response.data.message || "Failed to load employees");
          return;
        }

        const sorted = [...(response.data.data || [])].sort((first, second) =>
          employeeLabel(first).localeCompare(employeeLabel(second)),
        );
        setEmployees(sorted);
      } catch (requestError) {
        if (requestError.code === "ERR_CANCELED") return;
        console.error("Error fetching employees:", requestError);
        toast.error(
          requestError.response?.data?.message || "Failed to load employees",
        );
      } finally {
        if (!controller.signal.aborted) setEmployeesLoading(false);
      }
    };

    fetchEmployees();
    return () => controller.abort();
  }, [token]);

  const fetchDay = useCallback(
    async (signal) => {
      if (!token || !date || !employeeId) {
        setDayPunches([]);
        setDayError("");
        return;
      }

      try {
        setDayLoading(true);
        setDayError("");

        const response = await axios.get("/api/v1/clock_punch/all", {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            employee_id: employeeId,
            from: date,
            to: date,
            paginate: "false",
          },
          ...(signal ? { signal } : {}),
        });

        if (!response.data.status) {
          setDayError(response.data.message || "Failed to load the day");
          setDayPunches([]);
          return;
        }

        const punches = (response.data.data || [])
          .flatMap((dateGroup) => dateGroup.employee_groups || [])
          .flatMap((employeeGroup) => employeeGroup.punches || []);

        setDayPunches(punches);
      } catch (requestError) {
        if (requestError.code === "ERR_CANCELED") return;
        console.error("Error fetching day punches:", requestError);
        setDayError(
          requestError.response?.data?.message ||
            "Unable to load punches for this day.",
        );
        setDayPunches([]);
      } finally {
        if (!signal?.aborted) setDayLoading(false);
      }
    },
    [date, employeeId, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchDay(controller.signal);
    return () => controller.abort();
  }, [fetchDay]);

  // Drafts only make sense for one employee/day at a time.
  useEffect(() => {
    setDrafts([]);
  }, [date, employeeId]);

  const summary = useMemo(
    () => summarizeClockPunchDay(dayPunches),
    [dayPunches],
  );

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee.employee_id,
        label: employeeLabel(employee),
        description: [employee.employee_id, employee.role]
          .filter(Boolean)
          .join(" • "),
      })),
    [employees],
  );

  const selectedEmployee = employees.find(
    (employee) => employee.employee_id === employeeId,
  );
  const hasSelection = Boolean(date && employeeId);
  const lastExistingTime = summary.lastPunch
    ? toWallClock(summary.lastPunch.punched_at)
    : "";

  // Each draft row is validated against everything before it: the existing day
  // sequence first, then the earlier drafts.
  const draftRows = useMemo(() => {
    let lastAction = summary.lastAction;
    let lastTime = lastExistingTime;

    return drafts.map((draft) => {
      const allowedActions = getAllowedNextActions(lastAction);
      const errors = [];

      if (!draft.action) {
        errors.push("Select an action");
      } else if (!allowedActions.includes(draft.action)) {
        errors.push(
          `${formatClockPunchAction(draft.action)} cannot follow ${
            lastAction ? formatClockPunchAction(lastAction) : "an empty day"
          }`,
        );
      }

      if (!draft.time) {
        errors.push("Enter a time");
      } else if (lastTime && draft.time <= lastTime) {
        errors.push(`Time must be after ${lastTime}`);
      }

      const row = { ...draft, allowedActions, errors };

      if (draft.action) lastAction = draft.action;
      if (draft.time) lastTime = draft.time;

      return row;
    });
  }, [drafts, lastExistingTime, summary.lastAction]);

  const lastDraftRow = draftRows.at(-1);
  const nextAllowedActions =
    lastDraftRow?.action && lastDraftRow.errors.length === 0
      ? getAllowedNextActions(lastDraftRow.action)
      : [];

  const hasDraftErrors = draftRows.some((row) => row.errors.length > 0);
  const isFormValid =
    hasSelection && drafts.length > 0 && !hasDraftErrors && !dayLoading;

  // Warn (without blocking) when the combined day breaks the 30 minute rule or
  // still has gaps once the drafts are applied. Existing punches are reduced to
  // their Adelaide wall clock first so drafts can be compared against them
  // without dragging the browser's own time zone into the maths.
  const projectedSummary = useMemo(() => {
    if (!hasSelection || hasDraftErrors) return null;

    const projectedPunches = [
      ...summary.activePunches.map((punch) => ({
        action: punch.action,
        review_status: punch.review_status,
        punched_at: toReferenceInstant(toWallClock(punch.punched_at)),
      })),
      ...drafts
        .filter((draft) => draft.action && draft.time)
        .map((draft) => ({
          action: draft.action,
          review_status: "PENDING",
          punched_at: toReferenceInstant(draft.time),
        })),
    ];

    return summarizeClockPunchDay(projectedPunches);
  }, [drafts, hasDraftErrors, hasSelection, summary.activePunches]);

  const addDraft = (action = "") => {
    setDrafts((previous) => [...previous, createDraft(action)]);
  };

  const updateDraft = (key, changes) => {
    setDrafts((previous) =>
      previous.map((draft) =>
        draft.key === key ? { ...draft, ...changes } : draft,
      ),
    );
  };

  const removeDraft = (key) => {
    setDrafts((previous) => previous.filter((draft) => draft.key !== key));
  };

  const handleSave = async (approve) => {
    if (!token) {
      toast.error("No valid session found. Please login again.");
      return;
    }

    const violation = findSequenceViolation(
      drafts.map((draft) => draft.action),
      summary.lastAction,
    );

    if (violation) {
      toast.error(
        `Punch ${violation.index + 1} is not a valid next action for this day.`,
      );
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await axios.post(
        "/api/v1/clock_punch/manual",
        {
          employee_id: employeeId,
          date,
          approve,
          punches: drafts.map((draft) => ({
            action: draft.action,
            time: draft.time,
          })),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.data.status) {
        toast.error(response.data.message || "Failed to save clock punches");
        return;
      }

      toast.success(response.data.message);

      setDrafts([]);
      setEmployeeId("");
      setDate(getTodayInTimeZone());
      setDayPunches([]);
      router.push("/admin/employees/punches");
    } catch (requestError) {
      console.error("Error saving clock punches:", requestError);
      toast.error(
        requestError.response?.data?.message ||
          "Failed to save clock punches. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const saveButtonClasses = (primary) => {
    if (!isFormValid || isSubmitting) {
      return "bg-slate-300 text-slate-500 cursor-not-allowed";
    }

    return primary
      ? "bg-primary/80 hover:bg-primary text-white cursor-pointer"
      : "border border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer";
  };

  return (
    <AdminShell>
      <div className="h-full w-full overflow-y-auto">
        <div className="px-4 py-2">
          {/* Header */}
          <div className="flex items-center gap-2 mb-4">
            <TabsController back={true}>
              <div className="cursor-pointer p-1 hover:bg-slate-200 rounded-lg transition-colors">
                <ChevronLeft className="w-8 h-8 text-slate-600" />
              </div>
            </TabsController>
            <h1 className="text-2xl font-bold text-slate-600">
              Add Clock Punch
            </h1>
          </div>

          {/* Form */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (isFormValid && !isSubmitting) handleSave(false);
              }}
              className="space-y-8"
            >
              {/* Punch Details Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-bold text-slate-800">
                    Punch Details
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={date}
                      max={getTodayInTimeZone()}
                      onChange={(event) => setDate(event.target.value)}
                      className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Punches are recorded in Adelaide time
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Employee <span className="text-red-500">*</span>
                    </label>
                    <CustomDropdown
                      options={employeeOptions}
                      value={employeeId}
                      onChange={setEmployeeId}
                      searchable
                      loading={employeesLoading}
                      loadingText="Loading employees..."
                      emptyText="No employees found"
                      placeholder={
                        employeesLoading
                          ? "Loading employees..."
                          : "Search or select an employee"
                      }
                      disabled={employeesLoading}
                    />
                    {selectedEmployee && (
                      <p className="text-xs text-slate-500 mt-1">
                        {selectedEmployee.employee_id}
                        {selectedEmployee.role
                          ? ` • ${selectedEmployee.role}`
                          : ""}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Day Status Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <ListChecks className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-bold text-slate-800">
                    Day Status
                  </h2>
                </div>

                {!hasSelection ? (
                  <p className="text-sm text-slate-500">
                    Select a date and employee to see what has already been
                    recorded.
                  </p>
                ) : dayLoading ? (
                  <p className="text-sm text-slate-500">Loading this day...</p>
                ) : dayError ? (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <p className="text-sm text-red-700">{dayError}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                      {employeeLabel(selectedEmployee)} • {formatLongDate(date)}
                    </p>

                    {summary.missing.length > 0 ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <p className="text-sm font-semibold text-amber-800">
                            {summary.isEmpty
                              ? "No punches recorded for this day"
                              : "This day is incomplete"}
                          </p>
                        </div>
                        <ul className="mt-2 list-inside list-disc text-sm text-amber-800">
                          {summary.missing.map((item) => (
                            <li key={item.code}>{item.label} is missing</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                        <CircleCheck className="h-4 w-4 text-emerald-600" />
                        <p className="text-sm font-semibold text-emerald-800">
                          The shift is complete for this day
                        </p>
                      </div>
                    )}

                    {summary.warnings.map((warning) => (
                      <div
                        key={warning.code + warning.label}
                        className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4"
                      >
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                        <p className="text-sm text-blue-800">{warning.label}</p>
                      </div>
                    ))}

                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">
                        Available actions
                      </p>
                      {summary.allowedActions.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          No further punches can be added for this day.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {summary.allowedActions.map((action) => (
                            <button
                              key={action}
                              type="button"
                              onClick={() => addDraft(action)}
                              disabled={drafts.length > 0}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                actionStyles[action]
                              } ${
                                drafts.length > 0
                                  ? "cursor-not-allowed opacity-50"
                                  : "cursor-pointer hover:opacity-80"
                              }`}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              {formatClockPunchAction(action)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                                Time
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                                Action
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                                Source
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                                Review Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 bg-white">
                            {dayPunches.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={4}
                                  className="px-4 py-6 text-center text-sm text-slate-500"
                                >
                                  No punches recorded for this day yet.
                                </td>
                              </tr>
                            ) : (
                              [...dayPunches]
                                .sort(
                                  (first, second) =>
                                    new Date(first.punched_at) -
                                    new Date(second.punched_at),
                                )
                                .map((punch) => (
                                  <tr
                                    key={punch.id}
                                    className="hover:bg-slate-50"
                                  >
                                    <td className="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-slate-700">
                                      {toDisplayTime(punch.punched_at)}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-2.5">
                                      <span
                                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                          actionStyles[punch.action] ||
                                          actionStyles.CLOCK_OUT
                                        }`}
                                      >
                                        {formatClockPunchAction(punch.action)}
                                      </span>
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-600">
                                      {punch.punch_type === "MANUAL"
                                        ? "Manual"
                                        : punch.punch_type === "NFC"
                                          ? "NFC"
                                          : "Employee"}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-2.5">
                                      <span
                                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                          reviewStyles[punch.review_status] ||
                                          reviewStyles.PENDING
                                        }`}
                                      >
                                        {punch.review_status}
                                      </span>
                                    </td>
                                  </tr>
                                ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* New Punches Section */}
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-bold text-slate-800">
                      New Punches
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => addDraft()}
                    disabled={!hasSelection || dayLoading || Boolean(dayError)}
                    className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    Add Punch
                  </button>
                </div>

                {!hasSelection ? (
                  <p className="text-sm text-slate-500">
                    Select a date and employee to start adding punches.
                  </p>
                ) : draftRows.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No punches queued yet. Use the available actions above or
                    &quot;Add Punch&quot; to start.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {draftRows.map((row, index) => {
                      const actionOptions = row.allowedActions.map(
                        (action) => ({
                          value: action,
                          label: formatClockPunchAction(action),
                        }),
                      );

                      if (
                        row.action &&
                        !row.allowedActions.includes(row.action)
                      ) {
                        actionOptions.push({
                          value: row.action,
                          label: `${formatClockPunchAction(
                            row.action,
                          )} (not allowed here)`,
                        });
                      }

                      return (
                        <div
                          key={row.key}
                          className="border border-slate-200 rounded-lg p-4"
                        >
                          <div className="flex flex-wrap items-end gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">
                              {index + 1}
                            </div>

                            <div className="flex-1 min-w-56">
                              <label className="block text-sm font-medium text-slate-700 mb-2">
                                Action <span className="text-red-500">*</span>
                              </label>
                              <CustomDropdown
                                options={actionOptions}
                                value={row.action}
                                onChange={(action) =>
                                  updateDraft(row.key, { action })
                                }
                                placeholder="Select an action"
                                emptyText="No actions available"
                              />
                            </div>

                            <div className="flex-1 min-w-48">
                              <label className="block text-sm font-medium text-slate-700 mb-2">
                                Time <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="time"
                                value={row.time}
                                onChange={(event) =>
                                  updateDraft(row.key, {
                                    time: event.target.value,
                                  })
                                }
                                className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                                required
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => removeDraft(row.key)}
                              className="cursor-pointer flex h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                              aria-label={`Remove punch ${index + 1}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {row.errors.length > 0 && (
                            <ul className="mt-3 list-inside list-disc text-xs font-medium text-red-600">
                              {row.errors.map((error) => (
                                <li key={error}>{error}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}

                    {nextAllowedActions.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-slate-700">
                          Next allowed
                        </span>
                        {nextAllowedActions.map((action) => (
                          <button
                            key={action}
                            type="button"
                            onClick={() => addDraft(action)}
                            className={`cursor-pointer inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80 ${actionStyles[action]}`}
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {formatClockPunchAction(action)}
                          </button>
                        ))}
                      </div>
                    )}

                    {projectedSummary &&
                      projectedSummary.missing.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                          <p className="text-sm font-semibold text-amber-800">
                            After saving, this day will still be missing:
                          </p>
                          <ul className="mt-1 list-inside list-disc text-sm text-amber-800">
                            {projectedSummary.missing.map((item) => (
                              <li key={item.code}>{item.label}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {projectedSummary?.warnings.map((warning) => (
                      <div
                        key={warning.code + warning.label}
                        className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4"
                      >
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                        <p className="text-sm text-blue-800">{warning.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-wrap justify-end gap-3 pt-6 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className={`flex items-center gap-2 px-8 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${saveButtonClasses(
                    !canApprove,
                  )}`}
                >
                  <Save className="w-5 h-5" />
                  {isSubmitting ? "Saving..." : "Save"}
                </button>

                {canApprove && (
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={!isFormValid || isSubmitting}
                    className={`flex items-center gap-2 px-8 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${saveButtonClasses(
                      true,
                    )}`}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    {isSubmitting ? "Saving..." : "Save & Approve"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
