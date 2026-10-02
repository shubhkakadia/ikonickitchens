"use client";

import axios from "axios";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  CircleCheck,
  Clock,
  Info,
  ListChecks,
  MessageSquare,
  PencilLine,
  Plus,
  RotateCcw,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import AdminShell from "@/components/AdminShell";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import TabsController from "@/components/tabscontroller";
import { useAuth } from "@/contexts/AuthContext";
import useModalFocus from "@/hooks/useModalFocus";
import {
  formatClockPunchAction,
  summarizeClockPunchDay,
} from "@/lib/clockPunchSequence";
import {
  BADGE,
  actionStyles,
  breakStyles,
  formatLabel,
  reviewStyles,
  workingStyles,
} from "../lib/punchStyles";

const CLOCK_PUNCH_TIME_ZONE = "Australia/Adelaide";
const MAX_REVIEW_NOTES_LENGTH = 5000;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// DESIGN.md 9.1 recipes, kept as constants because several buttons share them.
const BUTTON_BASE =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BUTTON_PRIMARY = `${BUTTON_BASE} text-white bg-primary hover:bg-primary/90`;
const BUTTON_SECONDARY = `${BUTTON_BASE} text-slate-700 bg-white border border-slate-300 hover:bg-slate-100`;

// Icon-only row actions (DESIGN.md 9.1 "Icon-only"); the tone is the hover and
// resting ink only, the aria-label and title carry the meaning.
const ICON_BUTTON =
  "cursor-pointer p-2 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

const INPUT_BASE =
  "w-full text-sm text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent";
const INPUT_INVALID =
  "w-full text-sm text-slate-800 border border-red-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent";

const TH =
  "px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500";

const timeFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: CLOCK_PUNCH_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

// Feeds <input type="time">, which always wants a 24 hour HH:mm value.
const inputTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CLOCK_PUNCH_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
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

function toDisplayTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return timeFormatter.format(date);
}

function toInputTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return inputTimeFormatter.format(date);
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

// "Clock In at 08:00 am", used to name a punch in labels, titles and prompts.
function punchLabel(punch) {
  return `${formatClockPunchAction(punch.action)} at ${
    toDisplayTime(punch.punched_at) || "—"
  }`;
}

function ButtonSpinner() {
  return (
    <span
      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
      aria-hidden="true"
    />
  );
}

export default function ClockPunchDetailPage() {
  const { id } = useParams();
  const { userData, isAdmin, isMasterAdmin } = useAuth();
  const token = userData?.token || null;
  const canReview = isAdmin();
  // Overwriting the time a punch was recorded at is a master admin override.
  const canEditTime = isMasterAdmin();

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

  const [isAddingMissing, setIsAddingMissing] = useState(false);
  const [missingDrafts, setMissingDrafts] = useState([]);
  const [missingError, setMissingError] = useState(null);
  const [isSavingMissing, setIsSavingMissing] = useState(false);
  const [isApprovingMissing, setIsApprovingMissing] = useState(false);

  const [timePunch, setTimePunch] = useState(null);
  const [timeDraft, setTimeDraft] = useState("");
  const [timeNotesDraft, setTimeNotesDraft] = useState("");
  const [timeError, setTimeError] = useState("");
  const [isSavingTime, setIsSavingTime] = useState(false);

  const missingModalRef = useRef(null);
  const timeModalRef = useRef(null);
  const notesModalRef = useRef(null);

  useModalFocus(missingModalRef, isAddingMissing);
  useModalFocus(timeModalRef, Boolean(timePunch));
  useModalFocus(notesModalRef, Boolean(notesPunch));

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
          setError(
            response.data.message ||
              "Couldn't load this clock punch. Try again.",
          );
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
            "Couldn't load this clock punch. Check your connection and try again.",
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
        toast.error(
          response.data.message ||
            "Couldn't update the punch. Try again in a moment.",
        );
        return false;
      }

      return true;
    } catch (requestError) {
      console.error("Error updating clock punch:", requestError);
      toast.error(
        requestError.response?.data?.message ||
          "Couldn't update the punch. Check your connection and try again.",
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
        toast.error(
          response.data.message ||
            "Couldn't reject the punch. Try again in a moment.",
        );
        return;
      }

      toast.success("Punch rejected; audit history retained");
      setPunchToReject(null);
      await fetchGroup();
    } catch (requestError) {
      console.error("Error rejecting clock punch:", requestError);
      toast.error(
        requestError.response?.data?.message ||
          "Couldn't reject the punch. Check your connection and try again.",
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
        toast.error(
          response.data.message ||
            "Couldn't save the notes. Try again in a moment.",
        );
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
          "Couldn't save the notes. Check your connection and try again.",
      );
    } finally {
      setIsSavingNotes(false);
    }
  };

  const openNotes = (punch) => {
    setNotesPunch(punch);
    setNotesDraft(punch.review_notes || "");
  };

  // A forgotten punch - usually a clock out - is filled in from the gaps the
  // day summary already knows about, so the added actions always continue the
  // day's sequence rather than starting a new one.
  const openMissingEditor = () => {
    setMissingDrafts(
      summary.missing.map((item) => ({
        action: item.code,
        label: item.label,
        time: "",
      })),
    );
    setMissingError(null);
    setIsAddingMissing(true);
  };

  const closeMissingEditor = () => {
    setIsAddingMissing(false);
    setMissingDrafts([]);
    setMissingError(null);
  };

  const updateMissingDraft = (action, time) => {
    setMissingError(null);
    setMissingDrafts((previous) =>
      previous.map((draft) =>
        draft.action === action ? { ...draft, time } : draft,
      ),
    );
  };

  const lastPunchTime = summary.lastPunch
    ? toInputTime(summary.lastPunch.punched_at)
    : "";

  // Times have to be filled from the top down: the sequence cannot skip a punch
  // and pick up again at a later one. `action` names the field the message
  // belongs to so the error can sit under it and focus can move there.
  const buildMissingPunches = () => {
    const filled = [];
    let blankDraft = null;

    for (const draft of missingDrafts) {
      if (!draft.time) {
        if (!blankDraft) blankDraft = draft;
        continue;
      }

      if (blankDraft) {
        return {
          error: `Set a time for ${blankDraft.label} before adding ${draft.label}`,
          action: blankDraft.action,
          punches: null,
        };
      }

      if (!TIME_PATTERN.test(draft.time)) {
        return {
          error: `${draft.label} needs a valid time`,
          action: draft.action,
          punches: null,
        };
      }

      const previous = filled.at(-1);
      if (previous && draft.time <= previous.time) {
        return {
          error: `${draft.label} must be later than ${previous.label} at ${previous.time}`,
          action: draft.action,
          punches: null,
        };
      }

      filled.push(draft);
    }

    if (filled.length === 0) {
      return {
        error: "Set a time for at least one punch",
        action: missingDrafts[0]?.action ?? null,
        punches: null,
      };
    }

    if (lastPunchTime && filled[0].time <= lastPunchTime) {
      return {
        error: `${filled[0].label} must be later than the last punch at ${toDisplayTime(
          summary.lastPunch.punched_at,
        )}`,
        action: filled[0].action,
        punches: null,
      };
    }

    return { error: null, action: null, punches: filled };
  };

  const handleSaveMissing = async (approve) => {
    const {
      error: draftError,
      action: draftErrorAction,
      punches: draftPunches,
    } = buildMissingPunches();
    if (draftError) {
      setMissingError({ message: draftError, action: draftErrorAction });
      if (draftErrorAction) {
        document.getElementById(`missing-time-${draftErrorAction}`)?.focus();
      }
      return;
    }

    try {
      setIsSavingMissing(true);
      setIsApprovingMissing(approve);

      const response = await axios.post(
        "/api/v1/clock_punch/manual",
        {
          employee_id: employeeGroup.employee_id,
          date: groupDate,
          approve,
          punches: draftPunches.map((draft) => ({
            action: draft.action,
            time: draft.time,
          })),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.data.status) {
        toast.error(
          response.data.message ||
            "Couldn't add the missing punch. Try again in a moment.",
        );
        return;
      }

      toast.success(response.data.message);
      closeMissingEditor();
      await fetchGroup();
    } catch (requestError) {
      console.error("Error adding missing clock punches:", requestError);
      toast.error(
        requestError.response?.data?.message ||
          "Couldn't add the missing punch. Check your connection and try again.",
      );
    } finally {
      setIsSavingMissing(false);
      setIsApprovingMissing(false);
    }
  };

  const openTimeEditor = (punch) => {
    setTimePunch(punch);
    setTimeDraft(toInputTime(punch.punched_at));
    setTimeNotesDraft(punch.review_notes || "");
    setTimeError("");
  };

  const closeTimeEditor = () => {
    setTimePunch(null);
    setTimeDraft("");
    setTimeNotesDraft("");
    setTimeError("");
  };

  // A form with typed-in work does not close on a stray backdrop click
  // (DESIGN.md 15.1); Escape and the buttons still do.
  const isMissingDirty = missingDrafts.some((draft) => draft.time);
  const isTimeDirty = Boolean(
    timePunch &&
    (timeDraft !== toInputTime(timePunch.punched_at) ||
      timeNotesDraft !== (timePunch.review_notes || "")),
  );
  const isNotesDirty = Boolean(
    notesPunch && notesDraft !== (notesPunch.review_notes || ""),
  );

  // DESIGN.md 9.4: modals close on Escape. Only the topmost open one responds,
  // and a save in flight is left alone so Escape can't strand a half-written
  // punch edit.
  useEffect(() => {
    const openModal = notesPunch
      ? { close: () => setNotesPunch(null), busy: isSavingNotes }
      : timePunch
        ? { close: closeTimeEditor, busy: isSavingTime }
        : isAddingMissing
          ? { close: closeMissingEditor, busy: isSavingMissing }
          : null;

    if (!openModal || openModal.busy) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") openModal.close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const handleSaveTime = async () => {
    if (!timePunch) return;

    const originalTime = toInputTime(timePunch.punched_at);
    const originalNotes = timePunch.review_notes || "";

    if (!TIME_PATTERN.test(timeDraft)) {
      setTimeError("Enter a valid time");
      document.getElementById("punch-time")?.focus();
      return;
    }

    if (timeDraft === originalTime && timeNotesDraft === originalNotes) {
      closeTimeEditor();
      return;
    }

    try {
      setIsSavingTime(true);

      const response = await axios.patch(
        `/api/v1/clock_punch/${timePunch.id}`,
        {
          punched_at_time: timeDraft,
          ...(timeNotesDraft !== originalNotes
            ? { review_notes: timeNotesDraft }
            : {}),
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!response.data.status) {
        toast.error(
          response.data.message ||
            "Couldn't update the punch time. Try again in a moment.",
        );
        return;
      }

      toast.success(
        `${formatClockPunchAction(
          timePunch.action,
        )} moved from ${originalTime} to ${timeDraft}`,
      );
      closeTimeEditor();
      await fetchGroup();
    } catch (requestError) {
      console.error("Error updating punch time:", requestError);
      toast.error(
        requestError.response?.data?.message ||
          "Couldn't update the punch time. Check your connection and try again.",
      );
    } finally {
      setIsSavingTime(false);
    }
  };

  const showHeaderActions =
    canReview &&
    !loading &&
    !error &&
    employeeGroup &&
    (pendingCount > 0 || summary.missing.length > 0);

  return (
    <AdminShell>
      <main className="h-full w-full overflow-y-auto">
        <div className="p-4">
          {/* Header: back, record name, status badge, record actions */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <TabsController back={true}>
              <span className="cursor-pointer flex p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200">
                <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                <span className="sr-only">Back</span>
              </span>
            </TabsController>
            <div className="flex-1 flex flex-wrap items-center gap-3 min-w-0">
              <h1 className="text-xl font-semibold text-slate-800 truncate">
                {!loading && !error && employeeGroup
                  ? employeeName(employeeGroup)
                  : "Clock punch"}
              </h1>
              {!loading && !error && employeeGroup && (
                <span
                  className={`${BADGE} ${
                    reviewStyles[employeeGroup.review_status] ||
                    reviewStyles.PENDING
                  }`}
                >
                  {formatLabel(employeeGroup.review_status) || "—"}
                </span>
              )}
            </div>

            {showHeaderActions && (
              <div className="flex flex-wrap items-center gap-2">
                {summary.missing.length > 0 && (
                  <button
                    type="button"
                    onClick={openMissingEditor}
                    className={BUTTON_SECONDARY}
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    {`Add missing punch${
                      summary.missing.length === 1 ? "" : "es"
                    }`}
                  </button>
                )}
                {pendingCount > 0 && (
                  <button
                    type="button"
                    onClick={handleApproveAll}
                    disabled={isBulkApproving}
                    className={BUTTON_PRIMARY}
                  >
                    {isBulkApproving ? (
                      <ButtonSpinner />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    )}
                    {isBulkApproving
                      ? "Approving..."
                      : `Approve all pending (${pendingCount})`}
                  </button>
                )}
              </div>
            )}
          </div>

          {loading ? (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div
                className="flex items-center justify-center py-12"
                role="status"
              >
                <div className="text-center">
                  <div
                    className="animate-spin rounded-full w-8 h-8 border-2 border-primary border-t-transparent mx-auto mb-4"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-slate-600">
                    Loading clock punch...
                  </p>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex flex-col items-center justify-center py-12">
                <AlertTriangle
                  aria-hidden="true"
                  className="w-8 h-8 text-red-500 mb-4"
                />
                <p className="text-sm text-red-600 mb-4" role="alert">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => fetchGroup()}
                  className={BUTTON_PRIMARY}
                >
                  Try again
                </button>
              </div>
            </div>
          ) : !employeeGroup ? (
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex flex-col items-center justify-center py-12">
                <Clock
                  aria-hidden="true"
                  className="w-8 h-8 text-slate-300 mb-4"
                />
                <p className="text-sm text-slate-600">
                  This clock punch could not be found.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-8">
              {/* Summary section */}
              <section className="space-y-4" aria-labelledby="shift-summary">
                <div className="flex items-center gap-2">
                  <UserRound
                    aria-hidden="true"
                    className="w-5 h-5 text-primary"
                  />
                  <h2
                    id="shift-summary"
                    className="text-lg font-semibold text-slate-800"
                  >
                    Shift summary
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
                      {employeeGroup.employee?.role || "—"}
                    </p>
                    {employeeGroup.employee_id && (
                      <p className="text-xs font-mono text-slate-500 break-all">
                        {employeeGroup.employee_id}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1">
                      Date
                    </p>
                    <p className="text-sm text-slate-800 font-semibold">
                      {formatLongDate(groupDate) || "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      Times shown in Adelaide time
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-1">
                      Working hours
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
                    <p className="text-sm font-medium text-slate-700 mb-1.5">
                      Shift status
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`${BADGE} ${
                          breakStyles[employeeGroup.break_status] ||
                          breakStyles.NO_BREAK
                        }`}
                      >
                        {formatLabel(employeeGroup.break_status) || "—"}
                      </span>
                      <span
                        className={`${BADGE} ${
                          workingStyles[employeeGroup.working_status] ||
                          workingStyles.NOT_WORKING
                        }`}
                      >
                        {formatLabel(employeeGroup.working_status) || "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Day status section */}
              <section className="space-y-4" aria-labelledby="day-status">
                <div className="flex items-center gap-2">
                  <ListChecks
                    aria-hidden="true"
                    className="w-5 h-5 text-primary"
                  />
                  <h2
                    id="day-status"
                    className="text-lg font-semibold text-slate-800"
                  >
                    Day status
                  </h2>
                </div>

                {summary.missing.length > 0 ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className="w-4 h-4 text-amber-600"
                        aria-hidden="true"
                      />
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
                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4">
                    <CircleCheck
                      className="w-4 h-4 text-green-600"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold text-green-800">
                      The shift is complete for this day
                    </p>
                  </div>
                )}

                {summary.warnings.map((warning) => (
                  <div
                    key={warning.code + warning.label}
                    className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4"
                  >
                    <Info
                      className="mt-0.5 w-4 h-4 shrink-0 text-blue-600"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-blue-800">{warning.label}</p>
                  </div>
                ))}
              </section>

              {/* Punch timeline section */}
              <section className="space-y-4" aria-labelledby="punch-timeline">
                <div className="flex items-center gap-2">
                  <Clock aria-hidden="true" className="w-5 h-5 text-primary" />
                  <h2
                    id="punch-timeline"
                    className="text-lg font-semibold text-slate-800"
                  >
                    Punch timeline
                  </h2>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th scope="col" className={TH}>
                            Time
                          </th>
                          <th scope="col" className={TH}>
                            Action
                          </th>
                          <th scope="col" className={TH}>
                            Source
                          </th>
                          <th scope="col" className={TH}>
                            Review status
                          </th>
                          <th scope="col" className={TH}>
                            Reviewed
                          </th>
                          <th scope="col" className={TH}>
                            Notes
                          </th>
                          {canReview && (
                            <th
                              scope="col"
                              className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wider text-slate-500"
                            >
                              Actions
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {punches.length === 0 ? (
                          <tr>
                            <td colSpan={canReview ? 7 : 6} className="py-12">
                              <div className="flex flex-col items-center justify-center">
                                <Clock
                                  aria-hidden="true"
                                  className="w-8 h-8 text-slate-300 mb-4"
                                />
                                <p className="text-sm text-slate-600">
                                  No punches recorded for this day.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          punches.map((punch) => {
                            const isBusy = pendingPunchId === punch.id;
                            const label = punchLabel(punch);

                            return (
                              <tr
                                key={punch.id}
                                className="hover:bg-slate-50 transition-colors"
                              >
                                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium font-mono tabular-nums text-slate-700">
                                  {toDisplayTime(punch.punched_at) || "—"}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                  <span
                                    className={`${BADGE} ${
                                      actionStyles[punch.action] ||
                                      actionStyles.CLOCK_OUT
                                    }`}
                                  >
                                    {formatClockPunchAction(punch.action) ||
                                      "—"}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                                  {punch.punch_type === "MANUAL"
                                    ? "Manual"
                                    : punch.punch_type === "NFC"
                                      ? "NFC"
                                      : "Employee"}
                                  {punch.user?.username && (
                                    <span className="block text-xs text-slate-500">
                                      by {punch.user.username}
                                    </span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                  <span
                                    className={`${BADGE} ${
                                      reviewStyles[punch.review_status] ||
                                      reviewStyles.PENDING
                                    }`}
                                  >
                                    {formatLabel(punch.review_status) || "—"}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                                  {punch.reviewed_by?.username ? (
                                    <>
                                      {punch.reviewed_by.username}
                                      <span className="block text-xs text-slate-500">
                                        {toDisplayStamp(punch.reviewed_at) ||
                                          "—"}
                                      </span>
                                    </>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-700 max-w-xs">
                                  {punch.review_notes ? (
                                    <span
                                      className="line-clamp-2"
                                      title={punch.review_notes}
                                    >
                                      {punch.review_notes}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                {canReview && (
                                  <td className="whitespace-nowrap px-4 py-3">
                                    <div className="flex items-center justify-end gap-2">
                                      {canEditTime && (
                                        <button
                                          type="button"
                                          title="Edit punch time"
                                          aria-label={`Edit time for ${label}`}
                                          onClick={() => openTimeEditor(punch)}
                                          disabled={isBusy}
                                          className={`${ICON_BUTTON} text-primary hover:bg-primary/10`}
                                        >
                                          <PencilLine
                                            className="w-4 h-4"
                                            aria-hidden="true"
                                          />
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        title={
                                          punch.review_status === "APPROVED"
                                            ? "Already approved"
                                            : "Approve"
                                        }
                                        aria-label={`Approve ${label}`}
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
                                        className={`${ICON_BUTTON} text-green-700 hover:bg-green-50`}
                                      >
                                        <CheckCircle2
                                          className="w-4 h-4"
                                          aria-hidden="true"
                                        />
                                      </button>

                                      <button
                                        type="button"
                                        title={
                                          punch.review_status === "REJECTED"
                                            ? "Already rejected"
                                            : "Reject"
                                        }
                                        aria-label={`Reject ${label}`}
                                        onClick={() => setPunchToReject(punch)}
                                        disabled={
                                          isBusy ||
                                          punch.review_status === "REJECTED"
                                        }
                                        className={`${ICON_BUTTON} text-red-600 hover:bg-red-50`}
                                      >
                                        <XCircle
                                          className="w-4 h-4"
                                          aria-hidden="true"
                                        />
                                      </button>

                                      <button
                                        type="button"
                                        title={
                                          punch.review_status === "PENDING"
                                            ? "Already pending"
                                            : "Reset to pending"
                                        }
                                        aria-label={`Reset ${label} to pending`}
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
                                        className={`${ICON_BUTTON} text-slate-600 hover:bg-slate-100`}
                                      >
                                        <RotateCcw
                                          className="w-4 h-4"
                                          aria-hidden="true"
                                        />
                                      </button>

                                      <button
                                        type="button"
                                        title="Review notes"
                                        aria-label={`Review notes for ${label}`}
                                        onClick={() => openNotes(punch)}
                                        disabled={isBusy}
                                        className={`${ICON_BUTTON} text-slate-600 hover:bg-slate-100`}
                                      >
                                        <MessageSquare
                                          className="w-4 h-4"
                                          aria-hidden="true"
                                        />
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
                    <Info
                      className="mt-0.5 w-4 h-4 shrink-0 text-slate-500"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-slate-600">
                      Only administrators can approve or reject clock punches.
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </main>

      <DeleteConfirmation
        isOpen={Boolean(punchToReject)}
        onClose={() => setPunchToReject(null)}
        onConfirm={handleRejectConfirmed}
        isDeleting={isRejecting}
        heading="clock punch"
        title="Reject clock punch"
        warningHeading="This will reject the punch"
        confirmButtonText="Reject punch"
        confirmingText="Rejecting..."
        message={
          punchToReject
            ? `Reject ${employeeName(employeeGroup)}'s ${punchLabel(
                punchToReject,
              )} on ${formatLongDate(
                groupDate,
              )}? It stops counting towards the day's hours but stays in the audit history.`
            : ""
        }
      />

      {isAddingMissing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
          onClick={() => {
            if (!isMissingDirty && !isSavingMissing) closeMissingEditor();
          }}
        >
          <div
            ref={missingModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Add missing punches"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-800">
                Add missing punch{missingDrafts.length === 1 ? "" : "es"}
              </h2>
              <button
                type="button"
                onClick={closeMissingEditor}
                aria-label="Close"
                className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors duration-200 hover:bg-slate-100"
              >
                <X aria-hidden="true" className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 p-6">
              <p className="text-sm text-slate-600">
                {formatLongDate(groupDate)} &bull; {employeeName(employeeGroup)}
              </p>

              {summary.lastPunch ? (
                <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <Info
                    className="mt-0.5 w-4 h-4 shrink-0 text-slate-500"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-slate-600">
                    The last punch recorded was{" "}
                    {formatClockPunchAction(summary.lastPunch.action)} at{" "}
                    {toDisplayTime(summary.lastPunch.punched_at) || "—"}.
                    Anything added has to come after it.
                  </p>
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <Info
                    className="mt-0.5 w-4 h-4 shrink-0 text-slate-500"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-slate-600">
                    No active punches are recorded for this day yet.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {missingDrafts.map((draft, index) => {
                  const inputId = `missing-time-${draft.action}`;
                  const errorId = `${inputId}-error`;
                  const hasError = missingError?.action === draft.action;

                  return (
                    <div
                      key={draft.action}
                      className="flex flex-wrap items-center justify-between gap-3"
                    >
                      <div>
                        <label htmlFor={inputId} className="block">
                          <span
                            className={`${BADGE} ${
                              actionStyles[draft.action] ||
                              actionStyles.CLOCK_OUT
                            }`}
                          >
                            {formatClockPunchAction(draft.action)}
                          </span>
                        </label>
                        {index > 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            Optional &mdash; leave blank to skip
                          </p>
                        )}
                      </div>

                      <input
                        id={inputId}
                        type="time"
                        value={draft.time}
                        data-autofocus={index === 0 ? true : undefined}
                        aria-invalid={hasError || undefined}
                        aria-describedby={hasError ? errorId : undefined}
                        onChange={(event) =>
                          updateMissingDraft(draft.action, event.target.value)
                        }
                        className={`w-40 px-3 py-2 ${
                          hasError ? INPUT_INVALID : INPUT_BASE
                        }`}
                      />

                      {hasError && (
                        <p
                          id={errorId}
                          role="alert"
                          className="basis-full text-xs text-red-600"
                        >
                          {missingError.message}
                        </p>
                      )}
                    </div>
                  );
                })}

                {missingError &&
                  !missingDrafts.some(
                    (draft) => draft.action === missingError.action,
                  ) && (
                    <p role="alert" className="text-xs text-red-600">
                      {missingError.message}
                    </p>
                  )}
              </div>

              <p className="text-xs text-slate-500">
                Times are Adelaide time on {formatLongDate(groupDate)}. Added
                punches are recorded as manual entries against your account.
              </p>
            </div>

            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeMissingEditor}
                disabled={isSavingMissing}
                className={BUTTON_SECONDARY}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveMissing(false)}
                disabled={isSavingMissing}
                className={BUTTON_SECONDARY}
              >
                {isSavingMissing && !isApprovingMissing
                  ? "Adding..."
                  : "Add as pending"}
              </button>
              <button
                type="button"
                onClick={() => handleSaveMissing(true)}
                disabled={isSavingMissing}
                className={BUTTON_PRIMARY}
              >
                {isSavingMissing && isApprovingMissing ? (
                  <ButtonSpinner />
                ) : (
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                )}
                {isSavingMissing && isApprovingMissing
                  ? "Adding..."
                  : "Add and approve"}
              </button>
            </div>
          </div>
        </div>
      )}

      {timePunch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
          onClick={() => {
            if (!isTimeDirty && !isSavingTime) closeTimeEditor();
          }}
        >
          <div
            ref={timeModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Edit punch time"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-800">
                Edit punch time
              </h2>
              <button
                type="button"
                onClick={closeTimeEditor}
                aria-label="Close"
                className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors duration-200 hover:bg-slate-100"
              >
                <X aria-hidden="true" className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 p-6">
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <AlertTriangle
                  className="mt-0.5 w-4 h-4 shrink-0 text-amber-600"
                  aria-hidden="true"
                />
                <p className="text-sm text-amber-800">
                  Overwriting a recorded punch time changes the hours for this
                  day. The change is kept in the activity log.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-sm font-medium text-slate-700">
                    Punch
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatClockPunchAction(timePunch.action)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Recorded at {toDisplayTime(timePunch.punched_at) || "—"} on{" "}
                    {formatLongDate(groupDate)}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="punch-time"
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                  >
                    New time <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="punch-time"
                    type="time"
                    required
                    value={timeDraft}
                    data-autofocus
                    aria-invalid={timeError ? true : undefined}
                    aria-describedby={
                      timeError
                        ? "punch-time-error punch-time-hint"
                        : "punch-time-hint"
                    }
                    onChange={(event) => {
                      setTimeDraft(event.target.value);
                      setTimeError("");
                    }}
                    className={`px-4 py-3 ${
                      timeError ? INPUT_INVALID : INPUT_BASE
                    }`}
                  />
                  {timeError && (
                    <p
                      id="punch-time-error"
                      role="alert"
                      className="mt-1 text-xs text-red-600"
                    >
                      {timeError}
                    </p>
                  )}
                  <p
                    id="punch-time-hint"
                    className="mt-1 text-xs text-slate-500"
                  >
                    Adelaide time, on the same day as the original punch
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="punch-time-notes"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Review notes
                </label>
                <textarea
                  id="punch-time-notes"
                  value={timeNotesDraft}
                  onChange={(event) => setTimeNotesDraft(event.target.value)}
                  maxLength={MAX_REVIEW_NOTES_LENGTH}
                  rows={3}
                  placeholder="e.g. Forgot to clock in, confirmed with the supervisor"
                  className={`resize-y px-4 py-3 ${INPUT_BASE}`}
                />
              </div>
            </div>

            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={closeTimeEditor}
                disabled={isSavingTime}
                className={BUTTON_SECONDARY}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveTime}
                disabled={isSavingTime || !timeDraft}
                className={BUTTON_PRIMARY}
              >
                {isSavingTime && <ButtonSpinner />}
                {isSavingTime ? "Saving..." : "Save time"}
              </button>
            </div>
          </div>
        </div>
      )}

      {notesPunch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
          onClick={() => {
            if (!isNotesDirty && !isSavingNotes) setNotesPunch(null);
          }}
        >
          <div
            ref={notesModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Review notes"
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-800">
                Review notes
              </h2>
              <button
                type="button"
                onClick={() => setNotesPunch(null)}
                aria-label="Close"
                className="cursor-pointer rounded-lg p-1.5 text-slate-500 transition-colors duration-200 hover:bg-slate-100"
              >
                <X aria-hidden="true" className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <p className="mb-4 text-sm text-slate-600">
                {punchLabel(notesPunch)}
              </p>
              <label
                htmlFor="punch-review-notes"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Note
              </label>
              <textarea
                id="punch-review-notes"
                value={notesDraft}
                data-autofocus
                onChange={(event) => setNotesDraft(event.target.value)}
                maxLength={MAX_REVIEW_NOTES_LENGTH}
                rows={5}
                placeholder="e.g. Approved after confirming the finish time with the supervisor"
                className={`resize-y px-4 py-3 ${INPUT_BASE}`}
              />
              <p className="mt-1 text-xs tabular-nums text-slate-500">
                {notesDraft.length}/{MAX_REVIEW_NOTES_LENGTH}
              </p>
            </div>

            <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setNotesPunch(null)}
                disabled={isSavingNotes}
                className={BUTTON_SECONDARY}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className={BUTTON_PRIMARY}
              >
                {isSavingNotes && <ButtonSpinner />}
                {isSavingNotes ? "Saving..." : "Save notes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
