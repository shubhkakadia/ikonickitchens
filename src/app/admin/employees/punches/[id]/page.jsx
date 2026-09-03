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
  MessageSquare,
  RotateCcw,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import AdminShell from "@/components/AdminShell";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import TabsController from "@/components/tabscontroller";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatClockPunchAction,
  summarizeClockPunchDay,
} from "@/lib/clockPunchSequence";

const CLOCK_PUNCH_TIME_ZONE = "Australia/Adelaide";
const MAX_REVIEW_NOTES_LENGTH = 5000;

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
  MIXED: "border-blue-200 bg-blue-50 text-blue-700",
};

const breakStyles = {
  ON_BREAK: "border-amber-200 bg-amber-50 text-amber-700",
  BREAK_COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  NO_BREAK: "border-slate-200 bg-slate-50 text-slate-600",
};

const workingStyles = {
  WORKING: "border-emerald-200 bg-emerald-50 text-emerald-700",
  NOT_WORKING: "border-slate-200 bg-slate-50 text-slate-600",
};

const timeFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: CLOCK_PUNCH_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const stampFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: CLOCK_PUNCH_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

function formatLabel(value) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toDisplayTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return timeFormatter.format(date);
}

function toDisplayStamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return stampFormatter.format(date);
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

function employeeName(group) {
  const name = [group?.employee?.first_name, group?.employee?.last_name]
    .filter(Boolean)
    .join(" ");
  return name || "Unknown employee";
}

export default function page() {
  const { id } = useParams();
  const { userData, isAdmin } = useAuth();
  const token = userData?.token || null;
  const canReview = isAdmin();

  const [employeeGroup, setEmployeeGroup] = useState(null);
  const [groupDate, setGroupDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingPunchId, setPendingPunchId] = useState(null);
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  const [punchToReject, setPunchToReject] = useState(null);
  const [isRejecting, setIsRejecting] = useState(false);

  const [notesPunch, setNotesPunch] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const fetchGroup = useCallback(
    async (signal) => {
      if (!token || !id) return;

      try {
        setLoading(true);
        setError("");

        const response = await axios.get(`/api/v1/clock_punch/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
          ...(signal ? { signal } : {}),
        });

        if (!response.data.status) {
          setError(response.data.message || "Failed to load the clock punch");
          return;
        }

        const dateGroup = response.data.data;
        setGroupDate(dateGroup?.date || "");
        setEmployeeGroup(dateGroup?.employee_groups?.[0] || null);
      } catch (requestError) {
        if (requestError.code === "ERR_CANCELED") return;
        console.error("Error fetching clock punch:", requestError);
        setError(
          requestError.response?.data?.message ||
            "Unable to load this clock punch. Please try again.",
        );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [id, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchGroup(controller.signal);
    return () => controller.abort();
  }, [fetchGroup]);

  const punches = useMemo(
    () =>
      [...(employeeGroup?.punches || [])].sort(
        (first, second) =>
          new Date(first.punched_at) - new Date(second.punched_at),
      ),
    [employeeGroup],
  );

  const summary = useMemo(() => summarizeClockPunchDay(punches), [punches]);
  const pendingCount = punches.filter(
    (punch) => punch.review_status === "PENDING",
  ).length;

  const changeReviewStatus = async (punchId, reviewStatus) => {
    try {
      setPendingPunchId(punchId);

      const response = await axios.patch(
        `/api/v1/clock_punch/${punchId}`,
        { review_status: reviewStatus },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.data.status) {
        toast.error(response.data.message || "Failed to update the punch");
        return false;
      }

      return true;
    } catch (requestError) {
      console.error("Error updating clock punch:", requestError);
      toast.error(
        requestError.response?.data?.message ||
          "Failed to update the punch. Please try again.",
      );
      return false;
    } finally {
      setPendingPunchId(null);
    }
  };

  const handleReviewStatusChange = async (punchId, reviewStatus) => {
    const updated = await changeReviewStatus(punchId, reviewStatus);
    if (!updated) return;

    toast.success(`Punch marked as ${formatLabel(reviewStatus)}`);
    await fetchGroup();
  };

  const handleApproveAll = async () => {
    const pendingPunches = punches.filter(
      (punch) => punch.review_status === "PENDING",
    );
    if (pendingPunches.length === 0) return;

    setIsBulkApproving(true);
    let approved = 0;

    for (const punch of pendingPunches) {
      const updated = await changeReviewStatus(punch.id, "APPROVED");
      if (!updated) break;
      approved += 1;
    }

    setIsBulkApproving(false);

    if (approved > 0) {
      toast.success(
        `${approved} punch${approved === 1 ? "" : "es"} approved successfully`,
      );
    }

    await fetchGroup();
  };

  // Rejecting goes through DELETE, which keeps the punch for the audit trail and
  // drops it out of the day's hours.
  const handleRejectConfirmed = async () => {
    if (!punchToReject) return;

    try {
      setIsRejecting(true);

      const response = await axios.delete(
        `/api/v1/clock_punch/${punchToReject.id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.data.status) {
        toast.error(response.data.message || "Failed to reject the punch");
        return;
      }

      toast.success("Punch rejected; audit history retained");
      setPunchToReject(null);
      await fetchGroup();
    } catch (requestError) {
      console.error("Error rejecting clock punch:", requestError);
      toast.error(
        requestError.response?.data?.message ||
          "Failed to reject the punch. Please try again.",
      );
    } finally {
      setIsRejecting(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!notesPunch) return;

    try {
      setIsSavingNotes(true);

      const response = await axios.patch(
        `/api/v1/clock_punch/${notesPunch.id}`,
        { review_notes: notesDraft },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.data.status) {
        toast.error(response.data.message || "Failed to save the notes");
        return;
      }

      toast.success("Review notes updated");
      setNotesPunch(null);
      setNotesDraft("");
      await fetchGroup();
    } catch (requestError) {
      console.error("Error saving review notes:", requestError);
      toast.error(
        requestError.response?.data?.message ||
          "Failed to save the notes. Please try again.",
      );
    } finally {
      setIsSavingNotes(false);
    }
  };

  const openNotes = (punch) => {
    setNotesPunch(punch);
    setNotesDraft(punch.review_notes || "");
  };

  const actionButtonClasses = (disabled, tone) => {
    if (disabled) {
      return "border-slate-200 text-slate-300 cursor-not-allowed";
    }

    return `cursor-pointer ${tone}`;
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
              Clock Punch Details
            </h1>
          </div>

          {loading ? (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
                  <p className="text-sm text-slate-600 font-medium">
                    Loading clock punch...
                  </p>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex flex-col items-center justify-center py-16">
                <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                <p className="text-sm text-red-600 font-medium mb-4">{error}</p>
                <button
                  type="button"
                  onClick={() => fetchGroup()}
                  className="cursor-pointer bg-primary/80 hover:bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : !employeeGroup ? (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <p className="text-sm text-slate-500 text-center py-16">
                This clock punch could not be found.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-lg p-6 space-y-8">
              {/* Summary Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 mb-4">
                  <UserRound className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-bold text-slate-800">
                    Shift Summary
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1">
                      Employee
                    </p>
                    <p className="text-sm text-slate-800 font-semibold">
                      {employeeName(employeeGroup)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {[employeeGroup.employee_id, employeeGroup.employee?.role]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1">
                      Date
                    </p>
                    <p className="text-sm text-slate-800 font-semibold">
                      {formatLongDate(groupDate)}
                    </p>
                    <p className="text-xs text-slate-500">{groupDate}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1">
                      Working Hours
                    </p>
                    <p className="text-sm text-slate-800 font-semibold">
                      {Number(employeeGroup.hours || 0).toFixed(2)} hours
                    </p>
                    <p className="text-xs text-slate-500">
                      {punches.length} punch
                      {punches.length === 1 ? "" : "es"} recorded
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">
                      Status
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          reviewStyles[employeeGroup.review_status] ||
                          reviewStyles.PENDING
                        }`}
                      >
                        {formatLabel(employeeGroup.review_status)}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          breakStyles[employeeGroup.break_status] ||
                          breakStyles.NO_BREAK
                        }`}
                      >
                        {formatLabel(employeeGroup.break_status)}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          workingStyles[employeeGroup.working_status] ||
                          workingStyles.NOT_WORKING
                        }`}
                      >
                        {formatLabel(employeeGroup.working_status)}
                      </span>
                    </div>
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

                {summary.missing.length > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <p className="text-sm font-semibold text-amber-800">
                        {summary.isEmpty
                          ? "No active punches for this day"
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
              </div>

              {/* Punch Timeline Section */}
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-primary" />
                    <h2 className="text-xl font-bold text-slate-800">
                      Punch Timeline
                    </h2>
                  </div>

                  {canReview && pendingCount > 0 && (
                    <button
                      type="button"
                      onClick={handleApproveAll}
                      disabled={isBulkApproving}
                      className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/80 hover:bg-primary text-white text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {isBulkApproving
                        ? "Approving..."
                        : `Approve All Pending (${pendingCount})`}
                    </button>
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
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                            Reviewed
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                            Notes
                          </th>
                          {canReview && (
                            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {punches.length === 0 ? (
                          <tr>
                            <td
                              colSpan={canReview ? 7 : 6}
                              className="px-4 py-6 text-center text-sm text-slate-500"
                            >
                              No punches recorded for this day.
                            </td>
                          </tr>
                        ) : (
                          punches.map((punch) => {
                            const isBusy = pendingPunchId === punch.id;

                            return (
                              <tr key={punch.id} className="hover:bg-slate-50">
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
                                    : "Employee"}
                                  {punch.user?.username && (
                                    <span className="block text-xs text-slate-400">
                                      by {punch.user.username}
                                    </span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-4 py-2.5">
                                  <span
                                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                      reviewStyles[punch.review_status] ||
                                      reviewStyles.PENDING
                                    }`}
                                  >
                                    {formatLabel(punch.review_status)}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-2.5 text-sm text-slate-600">
                                  {punch.reviewed_by?.username ? (
                                    <>
                                      {punch.reviewed_by.username}
                                      <span className="block text-xs text-slate-400">
                                        {toDisplayStamp(punch.reviewed_at)}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-sm text-slate-600 max-w-xs">
                                  {punch.review_notes ? (
                                    <span className="line-clamp-2">
                                      {punch.review_notes}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                {canReview && (
                                  <td className="whitespace-nowrap px-4 py-2.5">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        title="Approve"
                                        onClick={() =>
                                          handleReviewStatusChange(
                                            punch.id,
                                            "APPROVED",
                                          )
                                        }
                                        disabled={
                                          isBusy ||
                                          punch.review_status === "APPROVED"
                                        }
                                        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${actionButtonClasses(
                                          isBusy ||
                                            punch.review_status === "APPROVED",
                                          "border-emerald-200 text-emerald-600 hover:bg-emerald-50",
                                        )}`}
                                      >
                                        <CheckCircle2 className="h-4 w-4" />
                                      </button>

                                      <button
                                        type="button"
                                        title="Reject"
                                        onClick={() => setPunchToReject(punch)}
                                        disabled={
                                          isBusy ||
                                          punch.review_status === "REJECTED"
                                        }
                                        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${actionButtonClasses(
                                          isBusy ||
                                            punch.review_status === "REJECTED",
                                          "border-red-200 text-red-600 hover:bg-red-50",
                                        )}`}
                                      >
                                        <XCircle className="h-4 w-4" />
                                      </button>

                                      <button
                                        type="button"
                                        title="Reset to pending"
                                        onClick={() =>
                                          handleReviewStatusChange(
                                            punch.id,
                                            "PENDING",
                                          )
                                        }
                                        disabled={
                                          isBusy ||
                                          punch.review_status === "PENDING"
                                        }
                                        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${actionButtonClasses(
                                          isBusy ||
                                            punch.review_status === "PENDING",
                                          "border-slate-300 text-slate-600 hover:bg-slate-100",
                                        )}`}
                                      >
                                        <RotateCcw className="h-4 w-4" />
                                      </button>

                                      <button
                                        type="button"
                                        title="Review notes"
                                        onClick={() => openNotes(punch)}
                                        disabled={isBusy}
                                        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${actionButtonClasses(
                                          isBusy,
                                          "border-slate-300 text-slate-600 hover:bg-slate-100",
                                        )}`}
                                      >
                                        <MessageSquare className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {!canReview && (
                  <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <p className="text-sm text-slate-600">
                      Only administrators can approve or reject clock punches.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <DeleteConfirmation
        isOpen={Boolean(punchToReject)}
        onClose={() => setPunchToReject(null)}
        onConfirm={handleRejectConfirmed}
        isDeleting={isRejecting}
        heading="Clock Punch"
        title="Reject Clock Punch"
        confirmButtonText="Reject Punch"
        confirmingText="Rejecting..."
        message={
          punchToReject
            ? `Reject the ${formatClockPunchAction(
                punchToReject.action,
              )} punch at ${toDisplayTime(
                punchToReject.punched_at,
              )}? It stops counting towards the day's hours but stays in the audit history.`
            : ""
        }
      />

      {notesPunch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-800">Review Notes</h3>
              <button
                type="button"
                onClick={() => setNotesPunch(null)}
                className="cursor-pointer rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="mb-3 text-sm text-slate-600">
                {formatClockPunchAction(notesPunch.action)} at{" "}
                {toDisplayTime(notesPunch.punched_at)}
              </p>
              <textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                maxLength={MAX_REVIEW_NOTES_LENGTH}
                rows={5}
                placeholder="Add a note explaining this review decision..."
                className="w-full resize-y rounded-lg border border-slate-300 px-4 py-3 text-sm text-slate-800 transition-all duration-200 focus:border-transparent focus:ring-2 focus:ring-primary"
              />
              <p className="mt-1 text-xs text-slate-400">
                {notesDraft.length}/{MAX_REVIEW_NOTES_LENGTH}
              </p>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setNotesPunch(null)}
                className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="cursor-pointer rounded-lg bg-primary/80 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:bg-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingNotes ? "Saving..." : "Save Notes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
