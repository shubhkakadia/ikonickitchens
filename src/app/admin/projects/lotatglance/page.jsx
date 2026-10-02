"use client";
import AdminShell from "@/components/AdminShell";
import React, { useEffect, useState, useMemo, useRef } from "react";
import { stages } from "@/components/constants";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Search,
  Funnel,
  Sheet,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Check,
  Clock,
  Minus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import TextEditor from "@/components/TextEditor/TextEditor";
import useModalFocus from "@/hooks/useModalFocus";
import {
  usePersistedTableFilter,
  useTableFilterActions,
} from "@/hooks/usePersistedTableFilter";
import { BADGE, STATUS_COLORS } from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";

const TABLE_KEY = "lot-at-a-glance";
const GANTT_LABEL_WIDTH = 310;
const EMPTY = "—";

// Corner radius of a schedule bar's rounded end (rounded-sm, DESIGN.md 4). It
// is applied inline because each end is only rounded when it is the true start
// or end of the item rather than clipped by the visible range.
const BAR_RADIUS = "6px";

// Shared form-control and button recipes (DESIGN.md 9.1, 9.2).
const FIELD =
  "w-full text-sm text-slate-800 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-colors duration-200";
const fieldTone = (hasError) =>
  hasError
    ? "border-red-500 focus:ring-red-500"
    : "border-slate-300 focus:ring-primary";
const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_ICON =
  "cursor-pointer rounded-lg border border-slate-300 p-2 text-slate-600 transition-colors duration-200 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary";
const MENU_ITEM =
  "cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2 focus:outline-none focus:bg-slate-100";
const MENU_CHECK_ROW =
  "cursor-pointer flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors";
const CHECKBOX =
  "h-4 w-4 accent-primary border-slate-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

// A stage's status as a solid mark in the matrix and on schedule bars. These are
// data-viz fills, not badges, so they sit one step darker than the badge tones
// (-600 against the -100 fills) but follow the same DESIGN.md 5.4 hues: DONE
// green, IN_PROGRESS blue, NOT_STARTED / NA slate. Each status also has an icon
// and a text label wherever it is drawn, so colour is never the only signal.
const STATUS_FILL = {
  DONE: "bg-green-600",
  IN_PROGRESS: "bg-blue-600",
  NOT_STARTED: "bg-slate-600",
  NA: "bg-slate-500",
};
const STATUS_ICON = { DONE: Check, IN_PROGRESS: Clock, NA: Minus };
const STATUS_OPTIONS = ["NOT_STARTED", "IN_PROGRESS", "DONE"];
const FILTER_OPTIONS = ["ALL", "NOT_STARTED", "IN_PROGRESS", "DONE", "NA"];

// NA means "not applicable", so it reads "N/A" rather than the title-cased "Na".
const statusLabel = (status) =>
  status === "NA" ? "N/A" : formatLabel(status || "NOT_STARTED");

// Floating date label shown over a bar on hover. A floating layer needs an
// opaque fill and a border rather than a shadow (DESIGN.md 6).
const DATE_PILL = "rounded-full border border-slate-300 bg-white px-2.5 py-1";

// Columns offered in the Excel export, and their headers in the sheet. These
// are the exported file's contract, so they keep their original spelling.
const COL_CLIENT = "Client Name";
const COL_PROJECT = "Project Name";
const COL_LOT = "Lot ID";
const COL_PERCENT = "Percentage Completed";

// Stage cell values written to the export (unchanged from before the redesign).
const EXPORT_STATUS = {
  IN_PROGRESS: "in progress",
  DONE: "done",
  NOT_STARTED: "not started",
  NA: "NA",
};
const EXPORT_COLUMNS = [
  COL_CLIENT,
  COL_PROJECT,
  COL_LOT,
  ...stages,
  COL_PERCENT,
];

const TIMELINE_SCALES = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

// Stage names are stored lowercase; show them with the casing from the shared
// stage list so they read the same as the matrix column headers.
const displayStageName = (name) =>
  stages.find((stage) => stage.toLowerCase() === String(name).toLowerCase()) ||
  formatLabel(name);

function Spinner() {
  return (
    <span
      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
      aria-hidden="true"
    />
  );
}

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-red-600 mt-1">
      {message}
    </p>
  );
}

// Loading and error states render inside the content card so the page header
// and toolbar stay put (DESIGN.md 11, 15.1).
function LoadState({ loading, error, onRetry }) {
  if (loading) {
    return (
      <div
        className="flex flex-col items-center gap-2 px-4 py-12"
        role="status"
      >
        <span
          className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin"
          aria-hidden="true"
        />
        <p className="text-sm text-slate-600">Loading lots…</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12" role="alert">
      <AlertTriangle className="w-8 h-8 text-red-500" aria-hidden="true" />
      <p className="text-sm text-red-600">{error}</p>
      <button
        type="button"
        onClick={onRetry}
        className={`${BTN_SECONDARY} py-1.5`}
      >
        Try again
      </button>
    </div>
  );
}

// Colour-coded status square used by the legend. Cells in the matrix draw the
// same fill plus an icon (see StatusMark).
function LegendSwatch({ status }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-4 w-4 rounded ${STATUS_FILL[status]}`}
        aria-hidden="true"
      />
      <span className="text-xs text-slate-600">{statusLabel(status)}</span>
    </div>
  );
}

const getCalendarDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const addCalendarDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getPeriodStart = (date, scale) => {
  const result = getCalendarDate(date);
  if (scale === "weekly") {
    result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  } else if (scale === "monthly") {
    result.setDate(1);
  } else {
    result.setMonth(Math.floor(result.getMonth() / 3) * 3, 1);
  }
  return result;
};

const addPeriods = (date, scale, amount) => {
  const result = new Date(date);
  if (scale === "weekly") result.setDate(result.getDate() + amount * 7);
  if (scale === "monthly") result.setMonth(result.getMonth() + amount);
  if (scale === "quarterly") result.setMonth(result.getMonth() + amount * 3);
  return result;
};

const formatPeriod = (date, scale) => {
  if (scale === "weekly") {
    const end = addCalendarDays(date, 6);
    return `${date.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}–${end.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`;
  }
  if (scale === "monthly") {
    return date.toLocaleDateString("en-AU", {
      month: "short",
      year: "numeric",
    });
  }
  return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`;
};

const formatTimelineHeader = (date, scale) => {
  return date.toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: date.getDate() === 1 || scale === "weekly" ? "short" : undefined,
  });
};

const formatScheduleDate = (value) => {
  const date = getCalendarDate(value);
  return date
    ? date.toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : EMPTY;
};

const formatScheduleDateWithDay = (value) => {
  const date = getCalendarDate(value);
  return date
    ? date.toLocaleDateString("en-AU", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : EMPTY;
};

// "02 Oct 2026 – 05 Oct 2026", or a single dash when nothing is scheduled.
const formatScheduleRange = (start, end) => {
  if (!start && !end) return EMPTY;
  return `${formatScheduleDate(start)} – ${formatScheduleDate(end)}`;
};

// Lot notes are authored in the rich text editor, so strip the markup before
// showing them anywhere that expects plain text. Notes without markup (stages,
// and lots saved before the editor) are left untouched.
const toPlainText = (notes) => {
  if (!notes) return "";
  if (!/<\/?[a-z][^>]*>/i.test(notes)) return notes;
  return notes
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{2,}/g, "\n")
    .trim();
};

const formatNotesLabel = (notes) => {
  const value = toPlainText(notes).trim();
  if (!value) return "No notes added";
  return value.length > 500 ? `${value.slice(0, 500)}…` : value;
};

const formatDateForApi = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateForInput = (value) => {
  const date = getCalendarDate(value);
  return date ? formatDateForApi(date) : "";
};

function SchedulerView({
  activeLots,
  getStageStatus,
  getToken,
  onRefresh,
  onOptimisticUpdate,
}) {
  const [timelineScale, setTimelineScale] = useState("weekly");
  const [rangeOffset, setRangeOffset] = useState(0);
  const [expandedLots, setExpandedLots] = useState({});
  const [dragState, setDragState] = useState(null);
  const [pendingSchedule, setPendingSchedule] = useState(null);
  const [pendingHoverDate, setPendingHoverDate] = useState(null);
  const [hoveredBar, setHoveredBar] = useState(null);
  const [hoveredTimelineCell, setHoveredTimelineCell] = useState(null);
  const [selectedScheduleDetails, setSelectedScheduleDetails] = useState(null);
  const [detailForm, setDetailForm] = useState(null);
  const [isSavingLotDetails, setIsSavingLotDetails] = useState(false);
  const [detailErrors, setDetailErrors] = useState({});
  const initialDetailForm = useRef(null);
  const detailModalRef = useRef(null);
  const hasInitialisedAccordions = useRef(false);

  useModalFocus(detailModalRef, Boolean(selectedScheduleDetails));

  useEffect(() => {
    if (hasInitialisedAccordions.current || activeLots.length === 0) return;

    const today = getCalendarDate(new Date());
    setExpandedLots(
      Object.fromEntries(
        activeLots.map((lot) => {
          const start = getCalendarDate(lot.startDate);
          const end = getCalendarDate(lot.installationDueDate);
          return [
            lot.lot_id,
            Boolean(start && end && start <= today && end >= today),
          ];
        }),
      ),
    );
    hasInitialisedAccordions.current = true;
  }, [activeLots]);

  const schedule = useMemo(() => {
    const today = getCalendarDate(new Date());
    const startDate = addPeriods(
      getPeriodStart(today, timelineScale),
      timelineScale,
      rangeOffset,
    );
    const endDate = addCalendarDays(
      addPeriods(startDate, timelineScale, 1),
      -1,
    );
    const unitScale = "daily";
    const periods = [];

    for (
      let date = startDate;
      date <= endDate;
      date =
        unitScale === "daily"
          ? addCalendarDays(date, 1)
          : addPeriods(date, unitScale, 1)
    ) {
      periods.push(date);
    }

    const todayIndex = periods.findIndex((period, index) => {
      const nextPeriod = periods[index + 1] || addCalendarDays(endDate, 1);
      return today >= period && today < nextPeriod;
    });

    return {
      periods,
      startDate,
      endDate,
      totalPeriods: periods.length,
      todayIndex,
      unitScale,
    };
  }, [rangeOffset, timelineScale]);

  const unitWidth = 44;
  const rangeLabel = formatScheduleRange(schedule.startDate, schedule.endDate);
  const previousRangeLabel = formatPeriod(
    addPeriods(schedule.startDate, timelineScale, -1),
    timelineScale,
  );
  const nextRangeLabel = formatPeriod(
    addPeriods(schedule.startDate, timelineScale, 1),
    timelineScale,
  );
  const isWeeklyView = timelineScale === "weekly";
  const weeklyGridColumns = `repeat(${schedule.totalPeriods}, minmax(${unitWidth}px, 1fr))`;
  const gridStyle = {
    gridTemplateColumns: isWeeklyView
      ? `${GANTT_LABEL_WIDTH}px ${weeklyGridColumns}`
      : `${GANTT_LABEL_WIDTH}px repeat(${schedule.totalPeriods}, ${unitWidth}px)`,
  };
  const timelineWidth = schedule.totalPeriods * unitWidth;
  const hasTodayMarker =
    schedule.todayIndex >= 0 && schedule.todayIndex < schedule.totalPeriods;

  const getPeriodIndex = (date) => {
    const visibleDate = getCalendarDate(date);
    return schedule.periods.findIndex((period, index) => {
      const nextPeriod =
        schedule.periods[index + 1] || addCalendarDays(schedule.endDate, 1);
      return visibleDate >= period && visibleDate < nextPeriod;
    });
  };

  const getBarStyle = (startValue, endValue) => {
    const start = getCalendarDate(startValue);
    const end = getCalendarDate(endValue);
    if (!start || !end || end < start) return null;

    const visibleStart =
      start < schedule.startDate ? schedule.startDate : start;
    const visibleEnd = end > schedule.endDate ? schedule.endDate : end;
    if (visibleEnd < visibleStart) return null;

    const startIndex = getPeriodIndex(visibleStart);
    const endIndex = getPeriodIndex(visibleEnd);
    if (startIndex < 0 || endIndex < startIndex) return null;
    const duration = endIndex - startIndex + 1;
    return {
      left: isWeeklyView
        ? `calc(${(startIndex / schedule.totalPeriods) * 100}% + 3px)`
        : `${startIndex * unitWidth + 3}px`,
      width: isWeeklyView
        ? `calc(${(duration / schedule.totalPeriods) * 100}% - 6px)`
        : `${Math.max(duration * unitWidth - 6, 12)}px`,
      borderTopLeftRadius:
        visibleStart.getTime() === start.getTime() ? BAR_RADIUS : "0",
      borderBottomLeftRadius:
        visibleStart.getTime() === start.getTime() ? BAR_RADIUS : "0",
      borderTopRightRadius:
        visibleEnd.getTime() === end.getTime() ? BAR_RADIUS : "0",
      borderBottomRightRadius:
        visibleEnd.getTime() === end.getTime() ? BAR_RADIUS : "0",
    };
  };

  const getMissingInstallationBarStyle = (startValue) => {
    const start = getCalendarDate(startValue) || schedule.startDate;
    if (start > schedule.endDate) return null;
    return getBarStyle(start, schedule.endDate);
  };

  // Returns a { field, message } describing what is wrong with a stage's dates
  // relative to its parent lot, or null when they are fine. Drag and click
  // scheduling surface it as a toast; the details modal shows it inline.
  const getStageDateRangeError = (scheduleData, startDate, endDate) => {
    if (scheduleData.type !== "stage") return null;

    const lotStartDate = getCalendarDate(scheduleData.lotStartDate);
    const lotEndDate = getCalendarDate(scheduleData.lotEndDate);
    if (!lotStartDate || !lotEndDate) {
      return {
        field: "form",
        message:
          "Set the lot's start and installation due dates before scheduling a stage.",
      };
    }
    if (startDate < lotStartDate) {
      return {
        field: "startDate",
        message: `Stage dates must stay within the lot's dates. The lot starts ${formatScheduleDate(lotStartDate)}.`,
      };
    }
    if (endDate > lotEndDate) {
      return {
        field: "endDate",
        message: `Stage dates must stay within the lot's dates. The lot ends ${formatScheduleDate(lotEndDate)}.`,
      };
    }
    return null;
  };

  const validateStageDateRange = (scheduleData, startDate, endDate) => {
    const rangeError = getStageDateRangeError(scheduleData, startDate, endDate);
    if (rangeError) {
      toast.error(rangeError.message);
      return false;
    }
    return true;
  };

  const getPeriodFromDragPosition = (event) => {
    const timeline = event.currentTarget.parentElement?.parentElement;
    if (!timeline) return null;

    const bounds = timeline.getBoundingClientRect();
    const relativePosition = Math.min(
      Math.max(event.clientX - bounds.left, 0),
      Math.max(bounds.width - 1, 0),
    );
    const periodIndex = Math.min(
      Math.floor((relativePosition / bounds.width) * schedule.totalPeriods),
      schedule.totalPeriods - 1,
    );
    return schedule.periods[periodIndex] || null;
  };

  const getScheduleKey = (scheduleData) =>
    `${scheduleData.type}:${scheduleData.id || scheduleData.lotId}:${scheduleData.name || ""}`;

  const openScheduleDetails = (details) => {
    if (!details) return;
    const endDate =
      details.type === "stage"
        ? details.item.endDate
        : details.item.installationDueDate;
    const nextForm = {
      startDate: formatDateForInput(details.item.startDate),
      endDate: formatDateForInput(endDate),
      notes: details.item.notes || "",
    };
    initialDetailForm.current = nextForm;
    setSelectedScheduleDetails(details);
    setDetailForm(nextForm);
    setDetailErrors({});
  };

  const closeScheduleDetails = () => {
    setSelectedScheduleDetails(null);
    setDetailForm(null);
    setDetailErrors({});
    initialDetailForm.current = null;
  };

  // A dirty form is never closed by a stray backdrop click (DESIGN.md 15.1).
  const isDetailFormDirty =
    Boolean(detailForm) &&
    Boolean(initialDetailForm.current) &&
    (detailForm.startDate !== initialDetailForm.current.startDate ||
      detailForm.endDate !== initialDetailForm.current.endDate ||
      detailForm.notes !== initialDetailForm.current.notes);

  const handleDetailFieldChange = (field, value) => {
    setDetailForm((current) => ({ ...current, [field]: value }));
    setDetailErrors((current) => ({ ...current, [field]: "", form: "" }));
  };

  // Escape closes the details modal (DESIGN.md 9.4) unless a save is running.
  useEffect(() => {
    if (!selectedScheduleDetails) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !isSavingLotDetails) closeScheduleDetails();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [selectedScheduleDetails, isSavingLotDetails]);

  const validateScheduleDetails = () => {
    const errors = {};
    if (!detailForm.startDate) errors.startDate = "Enter a start date.";
    if (!detailForm.endDate) errors.endDate = "Enter an end date.";
    if (
      !errors.startDate &&
      !errors.endDate &&
      new Date(detailForm.startDate) > new Date(detailForm.endDate)
    ) {
      errors.endDate = "The end date can't be before the start date.";
    }
    if (
      Object.keys(errors).length === 0 &&
      selectedScheduleDetails.type === "stage"
    ) {
      const rangeError = getStageDateRangeError(
        {
          type: "stage",
          lotStartDate: selectedScheduleDetails.lot?.startDate,
          lotEndDate: selectedScheduleDetails.lot?.installationDueDate,
        },
        getCalendarDate(detailForm.startDate),
        getCalendarDate(detailForm.endDate),
      );
      if (rangeError) errors[rangeError.field] = rangeError.message;
    }
    return errors;
  };

  const saveScheduleDetails = async () => {
    if (!selectedScheduleDetails || !detailForm) return;
    const errors = validateScheduleDetails();
    if (Object.keys(errors).length > 0) {
      setDetailErrors(errors);
      const firstInvalid = ["startDate", "endDate"].find(
        (field) => errors[field],
      );
      if (firstInvalid) {
        document.getElementById(`schedule-${firstInvalid}`)?.focus();
      }
      return;
    }

    try {
      const token = getToken();
      if (!token)
        throw new Error("Your session has expired. Sign in again to continue.");

      setIsSavingLotDetails(true);
      const item = selectedScheduleDetails.item;
      if (selectedScheduleDetails.type === "lot") {
        onOptimisticUpdate({
          type: "lot",
          id: item.id,
          startDate: detailForm.startDate,
          endDate: detailForm.endDate,
          notes: detailForm.notes,
        });
        await axios.patch(
          `/api/v1/lot/${item.id}`,
          {
            startDate: detailForm.startDate,
            installationDueDate: detailForm.endDate,
            notes: detailForm.notes,
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
      } else {
        onOptimisticUpdate({
          type: "stage",
          id: item.stage_id,
          startDate: detailForm.startDate,
          endDate: detailForm.endDate,
          notes: detailForm.notes,
        });
        await axios.patch(
          `/api/v1/stage/${item.stage_id}`,
          {
            name: item.name,
            status: item.status,
            notes: detailForm.notes,
            startDate: detailForm.startDate,
            endDate: detailForm.endDate,
            assigned_to:
              item.assigned_to
                ?.map((assignment) => assignment.employee?.employee_id)
                .filter(Boolean) || [],
          },
          { headers: { Authorization: `Bearer ${token}` } },
        );
      }
      toast.success("Schedule details updated.");
      await onRefresh();
      closeScheduleDetails();
    } catch (error) {
      console.error("Error updating lot details:", error);
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Couldn't save the schedule details. Check your connection and try again.",
      );
      await onRefresh();
    } finally {
      setIsSavingLotDetails(false);
    }
  };

  const hideNativeDragImage = (event) => {
    const dragImage = document.createElement("div");
    dragImage.style.cssText =
      "position:fixed;top:-10px;left:-10px;width:1px;height:1px;opacity:0;";
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 0, 0);
    requestAnimationFrame(() => dragImage.remove());
  };

  const handleUnscheduledDateClick = async (scheduleData, date) => {
    if (!scheduleData || dragState) return;

    if (
      !pendingSchedule ||
      pendingSchedule.type !== scheduleData.type ||
      pendingSchedule.id !== scheduleData.id ||
      pendingSchedule.lotId !== scheduleData.lotId ||
      pendingSchedule.name !== scheduleData.name
    ) {
      setPendingSchedule({ ...scheduleData, startDate: date });
      setPendingHoverDate(date);
      return;
    }

    if (date < pendingSchedule.startDate) {
      toast.error("The end date can't be before the start date.");
      return;
    }

    if (
      !validateStageDateRange(scheduleData, pendingSchedule.startDate, date)
    ) {
      return;
    }

    const startDate = formatDateForApi(pendingSchedule.startDate);
    const endDate = formatDateForApi(date);
    setPendingSchedule(null);
    setPendingHoverDate(null);

    try {
      const token = getToken();
      if (!token)
        throw new Error("Your session has expired. Sign in again to continue.");
      const headers = { Authorization: `Bearer ${token}` };

      if (scheduleData.type === "lot") {
        onOptimisticUpdate({
          type: "lot",
          id: scheduleData.id,
          startDate,
          endDate,
        });
        await axios.patch(
          `/api/v1/lot/${scheduleData.id}`,
          { startDate, installationDueDate: endDate },
          { headers },
        );
      } else if (scheduleData.id) {
        onOptimisticUpdate({
          type: "stage",
          id: scheduleData.id,
          startDate,
          endDate,
        });
        await axios.patch(
          `/api/v1/stage/${scheduleData.id}`,
          {
            name: scheduleData.name,
            status: scheduleData.status,
            notes: scheduleData.notes || "",
            startDate,
            endDate,
            assigned_to: scheduleData.assignedTo || [],
          },
          { headers },
        );
      } else {
        await axios.post(
          "/api/v1/stage/create",
          {
            lot_id: scheduleData.lotId,
            name: scheduleData.name,
            status: "NOT_STARTED",
            notes: "",
            startDate,
            endDate,
            assigned_to: [],
          },
          { headers },
        );
      }

      toast.success("Schedule dates added.");
      await onRefresh();
    } catch (error) {
      console.error("Error adding schedule dates:", error);
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Couldn't add the schedule dates. Check your connection and try again.",
      );
      await onRefresh();
    } finally {
    }
  };

  const handleDateDrop = async (event, targetDate) => {
    event.preventDefault();
    let dragData;
    try {
      dragData = JSON.parse(
        event.dataTransfer.getData("application/x-ikoniq-gantt-date"),
      );
      const targetDateValue = formatDateForApi(targetDate);
      const currentStart = getCalendarDate(dragData.startDate);
      const currentEnd = getCalendarDate(dragData.endDate);
      const durationInDays = Math.round(
        (currentEnd.getTime() - currentStart.getTime()) / 86400000,
      );
      const nextStart =
        dragData.edge === "start" || dragData.edge === "move"
          ? getCalendarDate(targetDate)
          : currentStart;
      const nextEnd =
        dragData.edge === "end"
          ? getCalendarDate(targetDate)
          : dragData.edge === "move"
            ? addCalendarDays(getCalendarDate(targetDate), durationInDays)
            : currentEnd;

      if (!nextStart || !nextEnd || nextStart > nextEnd) {
        toast.error("The start date can't be after the end date.");
        return;
      }

      if (!validateStageDateRange(dragData, nextStart, nextEnd)) return;

      if (
        nextStart.getTime() === currentStart.getTime() &&
        nextEnd.getTime() === currentEnd.getTime()
      ) {
        setDragState(null);
        return;
      }

      const token = getToken();
      if (!token) {
        toast.error("Your session has expired. Sign in again to continue.");
        return;
      }

      const nextStartValue =
        dragData.edge === "start" || dragData.edge === "move"
          ? targetDateValue
          : dragData.startDate;
      const nextEndValue =
        dragData.edge === "end"
          ? targetDateValue
          : dragData.edge === "move"
            ? formatDateForApi(nextEnd)
            : dragData.endDate;
      onOptimisticUpdate({
        type: dragData.type,
        id: dragData.id,
        startDate: nextStartValue,
        endDate: nextEndValue,
      });
      const headers = { Authorization: `Bearer ${token}` };

      if (dragData.type === "lot") {
        await axios.patch(
          `/api/v1/lot/${dragData.id}`,
          {
            startDate: nextStartValue,
            installationDueDate: nextEndValue,
          },
          { headers },
        );
      } else {
        await axios.patch(
          `/api/v1/stage/${dragData.id}`,
          {
            name: dragData.name,
            status: dragData.status,
            notes: dragData.notes || "",
            startDate: nextStartValue,
            endDate: nextEndValue,
            assigned_to: dragData.assignedTo || [],
          },
          { headers },
        );
      }

      toast.success("Schedule date updated.");
      await onRefresh();
    } catch (error) {
      console.error("Error updating schedule date:", error);
      if (typeof dragData !== "undefined") {
        onOptimisticUpdate({
          type: dragData.type,
          id: dragData.id,
          startDate: dragData.startDate,
          endDate: dragData.endDate,
        });
      }
      toast.error(
        error.response?.data?.message ||
          "Couldn't update the schedule date. Check your connection and try again.",
      );
    } finally {
      setDragState(null);
    }
  };

  const renderTimelineRow = ({
    label,
    detail,
    barStyle,
    barClass,
    tone,
    onToggle,
    isExpanded,
    dragData,
    canSchedule,
    notes,
    details,
    warning,
    rowKey,
  }) => {
    const isDraggingThisBar =
      dragState &&
      dragData &&
      dragState.type === dragData.type &&
      dragState.id === dragData.id &&
      dragState.targetDate;
    const previewBarStyle = isDraggingThisBar
      ? getBarStyle(
          dragState.edge === "start" || dragState.edge === "move"
            ? dragState.targetDate
            : dragData.startDate,
          dragState.edge === "end"
            ? dragState.targetDate
            : dragState.edge === "move"
              ? addCalendarDays(
                  dragState.targetDate,
                  Math.round(
                    (getCalendarDate(dragData.endDate).getTime() -
                      getCalendarDate(dragData.startDate).getTime()) /
                      86400000,
                  ),
                )
              : dragData.endDate,
        )
      : null;
    const displayedBarStyle = previewBarStyle || barStyle;
    const scheduleKey = dragData ? getScheduleKey(dragData) : null;
    const isHoveredBar = hoveredBar?.key === scheduleKey;
    const startDate = getCalendarDate(dragData?.startDate);
    const endDate = getCalendarDate(dragData?.endDate);
    const canResizeStart =
      startDate && barStyle?.borderTopLeftRadius === BAR_RADIUS;
    const canResizeEnd =
      endDate && barStyle?.borderTopRightRadius === BAR_RADIUS;
    const showEndpointPills =
      startDate &&
      endDate &&
      startDate >= schedule.startDate &&
      startDate <= schedule.endDate &&
      endDate >= schedule.startDate &&
      endDate <= schedule.endDate;
    const isDragSource =
      dragState &&
      dragData &&
      dragState.type === dragData.type &&
      dragState.id === dragData.id;
    const dragInteractionClass =
      dragState && !isDragSource
        ? "pointer-events-none"
        : "pointer-events-auto";
    const isSelectingThisRow =
      pendingSchedule &&
      dragData &&
      pendingSchedule.type === dragData.type &&
      pendingSchedule.id === dragData.id &&
      pendingSchedule.lotId === dragData.lotId &&
      pendingSchedule.name === dragData.name &&
      pendingHoverDate;
    const pendingBarStyle = isSelectingThisRow
      ? getBarStyle(pendingSchedule.startDate, pendingHoverDate)
      : null;
    const isHoveredRow = hoveredTimelineCell?.rowKey === rowKey;

    return (
      <div className="grid" style={gridStyle}>
        <div
          className={`sticky left-0 z-10 flex min-h-16 items-center border-b border-r border-slate-200 px-3 ${
            isHoveredRow ? "bg-primary/5" : tone
          }`}
          onMouseEnter={() => setHoveredTimelineCell({ rowKey, period: null })}
          onMouseLeave={() => setHoveredTimelineCell(null)}
        >
          {onToggle ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={isExpanded}
              className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {isExpanded ? (
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-slate-500"
                  aria-hidden="true"
                />
              ) : (
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-slate-500"
                  aria-hidden="true"
                />
              )}
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-medium text-slate-700"
                  title={label}
                >
                  {label}
                </p>
                <p className="truncate text-xs text-slate-500" title={detail}>
                  {detail}
                </p>
              </div>
            </button>
          ) : (
            <div className="min-w-0 pl-6">
              <p
                className="truncate text-sm font-medium text-slate-700"
                title={label}
              >
                {label}
              </p>
              <p className="truncate text-xs text-slate-500" title={detail}>
                {detail}
              </p>
            </div>
          )}
        </div>
        <div
          className="relative min-h-16 border-b border-slate-200"
          style={{ gridColumn: `2 / span ${schedule.totalPeriods}` }}
          onMouseLeave={() => setHoveredTimelineCell(null)}
        >
          <div
            className="absolute inset-0 grid"
            style={{
              gridTemplateColumns: isWeeklyView
                ? weeklyGridColumns
                : `repeat(${schedule.totalPeriods}, ${unitWidth}px)`,
            }}
          >
            {schedule.periods.map((period) =>
              (() => {
                const showHoveredTilePills =
                  isHoveredBar &&
                  !dragState &&
                  !showEndpointPills &&
                  hoveredBar.period?.getTime() === period.getTime();
                const isHoveredColumn =
                  hoveredTimelineCell?.period?.getTime() === period.getTime();
                const isHoveredCell = isHoveredRow && isHoveredColumn;
                return (
                  <div
                    key={period.toISOString()}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      if (dragState) {
                        setDragState((current) =>
                          current &&
                          current.targetDate?.getTime() === period.getTime()
                            ? current
                            : { ...current, targetDate: period },
                        );
                      }
                    }}
                    onDrop={(event) => handleDateDrop(event, period)}
                    onMouseEnter={() => {
                      setHoveredTimelineCell({ rowKey, period });
                      if (isSelectingThisRow) setPendingHoverDate(period);
                    }}
                    onClick={() => {
                      if (canSchedule)
                        handleUnscheduledDateClick(dragData, period);
                    }}
                    className={`relative border-r border-slate-100 ${
                      isHoveredCell
                        ? "bg-primary/15"
                        : isHoveredColumn
                          ? "bg-slate-100"
                          : isHoveredRow
                            ? "bg-slate-50"
                            : ""
                    } ${canSchedule ? "cursor-crosshair" : ""}`}
                  >
                    {showHoveredTilePills && (
                      <div className="pointer-events-none absolute bottom-full left-0 right-0 z-30 mb-1 flex justify-center gap-1 whitespace-nowrap text-xs font-medium text-slate-700">
                        <span className={DATE_PILL}>
                          Start: {formatScheduleDateWithDay(dragData.startDate)}
                        </span>
                        <span className={DATE_PILL}>
                          End: {formatScheduleDateWithDay(dragData.endDate)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })(),
            )}
          </div>
          {displayedBarStyle ? (
            <div
              className={`pointer-events-none absolute top-5 h-6 ${barClass} ${
                isDraggingThisBar ? "opacity-30" : ""
              }`}
              style={displayedBarStyle}
            >
              {warning && (
                <button
                  type="button"
                  onClick={() => openScheduleDetails(details)}
                  className="pointer-events-auto absolute inset-0 flex cursor-pointer items-center justify-center gap-1 text-xs font-medium text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                  title="Open lot details to set the installation date"
                >
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Installation date is not set
                </button>
              )}
              {isHoveredBar && !dragState && showEndpointPills && (
                <>
                  <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-1 whitespace-nowrap text-xs font-medium text-slate-700">
                    <span className={DATE_PILL}>
                      Start: {formatScheduleDateWithDay(dragData.startDate)}
                    </span>
                  </div>
                  <div className="pointer-events-none absolute bottom-full right-0 z-30 mb-1 whitespace-nowrap text-xs font-medium text-slate-700">
                    <span className={DATE_PILL}>
                      End: {formatScheduleDateWithDay(dragData.endDate)}
                    </span>
                  </div>
                </>
              )}
              {!warning && (
                <button
                  type="button"
                  onClick={() => {
                    if (!dragState) openScheduleDetails(details);
                  }}
                  onMouseEnter={(event) => {
                    const period = getPeriodFromDragPosition(event);
                    setHoveredBar({ key: scheduleKey, period });
                    if (period) setHoveredTimelineCell({ rowKey, period });
                  }}
                  onMouseMove={(event) => {
                    const period = getPeriodFromDragPosition(event);
                    if (period) setHoveredTimelineCell({ rowKey, period });
                  }}
                  onMouseLeave={() => setHoveredBar(null)}
                  onDragOver={(event) => {
                    if (!dragState) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    const period = getPeriodFromDragPosition(event);
                    if (period) {
                      setDragState((current) => ({
                        ...current,
                        targetDate: period,
                      }));
                    }
                  }}
                  onDrop={(event) => {
                    const period = getPeriodFromDragPosition(event);
                    if (period) handleDateDrop(event, period);
                  }}
                  className="pointer-events-auto absolute inset-y-0 left-2 right-2 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
                  title={`Open schedule details: ${label}, ${detail}`}
                  aria-label={`Open schedule details: ${label}, ${detail}`}
                />
              )}
              {!warning && canResizeStart && (
                <div
                  draggable
                  onMouseEnter={(event) => {
                    const period = getPeriodFromDragPosition(event);
                    setHoveredBar({ key: scheduleKey, period });
                    if (period) setHoveredTimelineCell({ rowKey, period });
                  }}
                  onMouseLeave={() => setHoveredBar(null)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    hideNativeDragImage(event);
                    setDragState({
                      ...dragData,
                      edge: "start",
                      targetDate: null,
                    });
                    event.dataTransfer.setData(
                      "application/x-ikoniq-gantt-date",
                      JSON.stringify({ ...dragData, edge: "start" }),
                    );
                  }}
                  onDragEnd={() => setDragState(null)}
                  className={`${dragInteractionClass} absolute inset-y-0 left-0 z-10 w-2 cursor-ew-resize border-r border-white/70 hover:bg-white/30`}
                  title="Drag to change start date"
                />
              )}
              {!warning && canResizeEnd && (
                <div
                  draggable
                  onMouseEnter={(event) => {
                    const period = getPeriodFromDragPosition(event);
                    setHoveredBar({ key: scheduleKey, period });
                    if (period) setHoveredTimelineCell({ rowKey, period });
                  }}
                  onMouseLeave={() => setHoveredBar(null)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    hideNativeDragImage(event);
                    setDragState({
                      ...dragData,
                      edge: "end",
                      targetDate: null,
                    });
                    event.dataTransfer.setData(
                      "application/x-ikoniq-gantt-date",
                      JSON.stringify({ ...dragData, edge: "end" }),
                    );
                  }}
                  onDragEnd={() => setDragState(null)}
                  className={`${dragInteractionClass} absolute inset-y-0 right-0 z-10 w-2 cursor-ew-resize border-l border-white/70 hover:bg-white/30`}
                  title="Drag to change end date"
                />
              )}
            </div>
          ) : pendingBarStyle ? (
            <div
              className={`pointer-events-none absolute top-5 h-6 opacity-25 ${barClass}`}
              style={pendingBarStyle}
            />
          ) : (
            <span className="relative inline-flex h-16 items-center px-3 text-xs italic text-slate-500">
              Unscheduled
            </span>
          )}
          <p
            className="absolute top-12 max-w-64 truncate text-xs text-slate-500"
            style={{ left: displayedBarStyle?.left || "0.5rem" }}
            title={toPlainText(notes) || "No notes added"}
          >
            {formatNotesLabel(notes)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 px-4 py-4">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              Lot schedule
            </h2>
            <p className="mt-1 text-sm text-slate-500">{rangeLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Timeline scale"
              className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1"
            >
              {TIMELINE_SCALES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={timelineScale === value}
                  onClick={() => {
                    setTimelineScale(value);
                    setRangeOffset(0);
                  }}
                  className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary ${
                    timelineScale === value
                      ? "border-slate-300 bg-white text-primary"
                      : "border-transparent text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setRangeOffset((offset) => offset - 1)}
              aria-label={
                timelineScale === "weekly"
                  ? "Previous week"
                  : `Previous ${previousRangeLabel}`
              }
              title={
                timelineScale === "weekly"
                  ? "Previous week"
                  : `Previous ${previousRangeLabel}`
              }
              className={BTN_ICON}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setRangeOffset((offset) => offset + 1)}
              aria-label={
                timelineScale === "weekly"
                  ? "Next week"
                  : `Next ${nextRangeLabel}`
              }
              title={
                timelineScale === "weekly"
                  ? "Next week"
                  : `Next ${nextRangeLabel}`
              }
              className={BTN_ICON}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        {activeLots.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12">
            <ClipboardList
              className="w-8 h-8 text-slate-300"
              aria-hidden="true"
            />
            <p className="text-sm text-slate-600">No active lots yet</p>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            <div
              className={`relative ${isWeeklyView ? "w-full" : "w-max"}`}
              style={{
                minWidth: isWeeklyView
                  ? "100%"
                  : GANTT_LABEL_WIDTH + timelineWidth,
              }}
            >
              {hasTodayMarker && (
                <div
                  className="pointer-events-none absolute bottom-0 top-0 z-20 border-l-2 border-primary"
                  style={{
                    left: isWeeklyView
                      ? `calc(${((schedule.todayIndex + 0.5) / schedule.totalPeriods) * 100}% + ${GANTT_LABEL_WIDTH * (1 - (schedule.todayIndex + 0.5) / schedule.totalPeriods)}px)`
                      : GANTT_LABEL_WIDTH +
                        schedule.todayIndex * unitWidth +
                        unitWidth / 2,
                  }}
                >
                  <span className="absolute -left-6 top-1 rounded-sm bg-primary px-1.5 py-0.5 text-xs font-medium text-white">
                    Today
                  </span>
                </div>
              )}
              <div className="grid sticky top-0 z-30" style={gridStyle}>
                <div className="sticky left-0 z-40 border-b border-r border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                  Lot / stage
                </div>
                <div
                  className="grid border-b border-slate-200 bg-slate-50"
                  style={{
                    gridColumn: `2 / span ${schedule.totalPeriods}`,
                    gridTemplateColumns: isWeeklyView
                      ? weeklyGridColumns
                      : `repeat(${schedule.totalPeriods}, ${unitWidth}px)`,
                  }}
                >
                  {schedule.periods.map((period) => (
                    <div
                      key={period.toISOString()}
                      className="border-r border-slate-200 px-1 py-2 text-center text-xs leading-tight text-slate-500"
                    >
                      <div className="font-semibold text-slate-700">
                        {formatTimelineHeader(period, timelineScale)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {activeLots.map((lot) => {
                const lotBarStyle = getBarStyle(
                  lot.startDate,
                  lot.installationDueDate,
                );
                const hasMissingInstallationDate = !lot.installationDueDate;
                const lotWarningBarStyle = hasMissingInstallationDate
                  ? getMissingInstallationBarStyle(lot.startDate)
                  : null;
                const isExpanded = Boolean(expandedLots[lot.lot_id]);
                return (
                  <React.Fragment key={lot.lot_id}>
                    {renderTimelineRow({
                      label: `${lot.project?.name || EMPTY} - ${lot.name || lot.lot_id}`,
                      detail: formatScheduleRange(
                        lot.startDate,
                        lot.installationDueDate,
                      ),
                      barStyle: lotBarStyle || lotWarningBarStyle,
                      barClass: hasMissingInstallationDate
                        ? "bg-red-600"
                        : "bg-violet-600",
                      tone: "bg-slate-50",
                      rowKey: `lot-${lot.lot_id}`,
                      notes: lot.notes,
                      details: { type: "lot", item: lot },
                      dragData: {
                        type: "lot",
                        id: lot.id,
                        startDate: lot.startDate,
                        endDate: lot.installationDueDate,
                      },
                      canSchedule: !lotBarStyle && !hasMissingInstallationDate,
                      warning: hasMissingInstallationDate,
                      isExpanded,
                      onToggle: () =>
                        setExpandedLots((current) => ({
                          ...current,
                          [lot.lot_id]: !current[lot.lot_id],
                        })),
                    })}
                    {isExpanded &&
                      stages.map((stageName) => {
                        const stage = lot.stages?.find(
                          (item) =>
                            item.name.toLowerCase() === stageName.toLowerCase(),
                        );
                        const status = getStageStatus(lot, stageName);
                        return (
                          <React.Fragment key={`${lot.lot_id}-${stageName}`}>
                            {renderTimelineRow({
                              label: `↳ ${stageName}`,
                              detail: `${
                                stage?.startDate || stage?.endDate
                                  ? formatScheduleRange(
                                      stage.startDate,
                                      stage.endDate,
                                    )
                                  : "Unscheduled"
                              } · ${statusLabel(status)}`,
                              barStyle: getBarStyle(
                                stage?.startDate,
                                stage?.endDate,
                              ),
                              barClass:
                                STATUS_FILL[status] || STATUS_FILL.NOT_STARTED,
                              tone: "bg-white",
                              rowKey: `stage-${lot.lot_id}-${stageName}`,
                              notes: stage?.notes,
                              details: stage
                                ? { type: "stage", item: stage, lot }
                                : null,
                              dragData: {
                                type: "stage",
                                id: stage?.stage_id || null,
                                lotId: lot.lot_id,
                                lotStartDate: lot.startDate,
                                lotEndDate: lot.installationDueDate,
                                name: stage?.name || stageName,
                                status: stage?.status || "NOT_STARTED",
                                notes: stage?.notes || "",
                                startDate: stage?.startDate || null,
                                endDate: stage?.endDate || null,
                                assignedTo:
                                  stage?.assigned_to
                                    ?.map(
                                      (assignment) =>
                                        assignment.employee?.employee_id,
                                    )
                                    .filter(Boolean) || [],
                              },
                              canSchedule: !getBarStyle(
                                stage?.startDate,
                                stage?.endDate,
                              ),
                            })}
                          </React.Fragment>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {selectedScheduleDetails && detailForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
          onClick={() => {
            if (!isDetailFormDirty && !isSavingLotDetails) {
              closeScheduleDetails();
            }
          }}
        >
          <div
            ref={detailModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-details-title"
            className="bg-white w-full max-w-2xl rounded-xl border border-slate-200 max-h-[90vh] flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 shrink-0">
              <div className="min-w-0">
                <h2
                  id="schedule-details-title"
                  className="truncate text-lg font-semibold text-slate-800"
                >
                  {selectedScheduleDetails.type === "stage"
                    ? displayStageName(selectedScheduleDetails.item.name)
                    : selectedScheduleDetails.item.name ||
                      selectedScheduleDetails.item.lot_id}
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedScheduleDetails.type === "stage"
                    ? "Stage details"
                    : "Lot details"}
                </p>
              </div>
              <button
                type="button"
                onClick={closeScheduleDetails}
                disabled={isSavingLotDetails}
                className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                saveScheduleDetails();
              }}
              className="flex flex-col min-h-0"
            >
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="schedule-startDate"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      Start date <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="schedule-startDate"
                      type="date"
                      data-autofocus
                      value={detailForm.startDate || ""}
                      onChange={(event) =>
                        handleDetailFieldChange("startDate", event.target.value)
                      }
                      aria-invalid={!!detailErrors.startDate}
                      aria-describedby={
                        detailErrors.startDate
                          ? "schedule-startDate-error"
                          : undefined
                      }
                      className={`${FIELD} ${fieldTone(detailErrors.startDate)}`}
                    />
                    <FieldError
                      id="schedule-startDate-error"
                      message={detailErrors.startDate}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="schedule-endDate"
                      className="block text-sm font-medium text-slate-700 mb-1.5"
                    >
                      End date <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="schedule-endDate"
                      type="date"
                      value={detailForm.endDate || ""}
                      min={detailForm.startDate || undefined}
                      onChange={(event) =>
                        handleDetailFieldChange("endDate", event.target.value)
                      }
                      aria-invalid={!!detailErrors.endDate}
                      aria-describedby={
                        detailErrors.endDate
                          ? "schedule-endDate-error"
                          : undefined
                      }
                      className={`${FIELD} ${fieldTone(detailErrors.endDate)}`}
                    />
                    <FieldError
                      id="schedule-endDate-error"
                      message={detailErrors.endDate}
                    />
                  </div>
                  {selectedScheduleDetails.type === "stage" && (
                    <div>
                      <p className="block text-sm font-medium text-slate-700 mb-1.5">
                        Status
                      </p>
                      <span
                        className={`${BADGE} ${
                          STATUS_COLORS[selectedScheduleDetails.item.status] ||
                          STATUS_COLORS.NOT_STARTED
                        }`}
                      >
                        {statusLabel(selectedScheduleDetails.item.status)}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="block text-sm font-medium text-slate-700 mb-1.5">
                      Lot ID
                    </p>
                    <p className="text-sm font-mono text-slate-700">
                      {selectedScheduleDetails.lot?.lot_id ||
                        selectedScheduleDetails.item.lot_id ||
                        EMPTY}
                    </p>
                  </div>
                </div>
                <div>
                  {selectedScheduleDetails.type === "lot" ? (
                    <div role="group" aria-labelledby="schedule-notes-label">
                      <p
                        id="schedule-notes-label"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Notes
                      </p>
                      <TextEditor
                        initialContent={detailForm.notes || ""}
                        onChange={(content) =>
                          handleDetailFieldChange("notes", content)
                        }
                        placeholder="No notes added"
                      />
                    </div>
                  ) : (
                    <>
                      <label
                        htmlFor="schedule-notes"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Notes
                      </label>
                      <textarea
                        id="schedule-notes"
                        value={detailForm.notes || ""}
                        onChange={(event) =>
                          handleDetailFieldChange("notes", event.target.value)
                        }
                        rows={5}
                        className={`${FIELD} ${fieldTone(false)}`}
                        placeholder="No notes added"
                      />
                    </>
                  )}
                </div>
                {detailErrors.form && (
                  <p role="alert" className="text-sm text-red-600">
                    {detailErrors.form}
                  </p>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={closeScheduleDetails}
                  disabled={isSavingLotDetails}
                  className={`${BTN_SECONDARY} px-4`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingLotDetails}
                  className={BTN_PRIMARY}
                >
                  {isSavingLotDetails && <Spinner />}
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LotsAtAGlancePage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [activeLots, setActiveLots] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = usePersistedTableFilter(TABLE_KEY, "search", "");
  const [stageFilters, setStageFilters] = usePersistedTableFilter(
    TABLE_KEY,
    "stageFilters",
    {},
  );
  const { resetFilters } = useTableFilterActions(TABLE_KEY);
  const [isExporting, setIsExporting] = useState(false);
  const [showFilterDropdowns, setShowFilterDropdowns] = useState({});
  const [dropdownPositions, setDropdownPositions] = useState({});
  const filterButtonRefs = useRef({});
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(null); // Format: "lot_id-stage_name"
  const [statusDropdownPositions, setStatusDropdownPositions] = useState({});
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Define all available columns for export
  const availableColumns = useMemo(() => [...EXPORT_COLUMNS], []);

  // Initialize selected columns with all columns
  const [selectedColumns, setSelectedColumns] = useState(() => [
    ...EXPORT_COLUMNS,
  ]);

  useEffect(() => {
    fetchActiveLots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Menus close on Escape (DESIGN.md 9.4).
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      setShowFilterDropdowns({});
      setShowColumnDropdown(false);
      setStatusDropdownOpen(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const fetchActiveLots = async () => {
    try {
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
        return;
      }

      const config = {
        method: "get",
        maxBodyLength: Infinity,
        url: "/api/v1/lot/active",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      };

      const response = await axios.request(config);

      if (response.data.status) {
        setActiveLots(response.data.data);
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      console.error("Error fetching active lots:", error);
      setError(
        error.response?.data?.message ||
          "Couldn't load the active lots. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const updateScheduleOptimistically = ({
    type,
    id,
    startDate,
    endDate,
    notes,
  }) => {
    setActiveLots((currentLots) =>
      currentLots.map((lot) => {
        if (type === "lot" && lot.id === id) {
          return {
            ...lot,
            startDate,
            installationDueDate: endDate,
            ...(notes !== undefined ? { notes } : {}),
          };
        }

        if (type === "stage") {
          return {
            ...lot,
            stages: lot.stages?.map((stage) =>
              stage.stage_id === id
                ? {
                    ...stage,
                    startDate,
                    endDate,
                    ...(notes !== undefined ? { notes } : {}),
                  }
                : stage,
            ),
          };
        }

        return lot;
      }),
    );
  };

  // Helper function to get stage status for a lot
  const getStageStatus = (lot, stageName) => {
    // Stage names are stored in lowercase in the database, so we need case-insensitive comparison
    const stage = lot.stages?.find(
      (s) => s.name.toLowerCase() === stageName.toLowerCase(),
    );
    if (!stage) {
      return "NOT_STARTED";
    }
    return stage.status;
  };

  // Helper function to calculate percentage completed
  const getPercentageCompleted = (lot) => {
    if (!lot.stages || lot.stages.length === 0) {
      return 0;
    }
    const doneCount = lot.stages.filter(
      (stage) => stage.status === "DONE",
    ).length;
    return Math.round((doneCount / stages.length) * 100);
  };

  // Filter and sort lots based on search and stage filters
  const filteredLots = useMemo(() => {
    const filtered = activeLots.filter((lot) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const projectName = (lot.project?.name || "").toLowerCase();
        const lotId = (lot.lot_id || "").toLowerCase();
        const clientName = (
          lot.project?.client?.client_name || ""
        ).toLowerCase();
        if (
          !projectName.includes(searchLower) &&
          !lotId.includes(searchLower) &&
          !clientName.includes(searchLower)
        ) {
          return false;
        }
      }

      // Stage filters
      for (const [stageName, filterStatus] of Object.entries(stageFilters)) {
        if (filterStatus && filterStatus !== "ALL") {
          // Get stage status inline to avoid dependency issues
          const stage = lot.stages?.find(
            (s) => s.name.toLowerCase() === stageName.toLowerCase(),
          );
          const lotStageStatus = stage ? stage.status : "NOT_STARTED";

          if (lotStageStatus !== filterStatus) {
            return false;
          }
        }
      }
      return true;
    });

    // Sort by client name > project name > lot number
    return filtered.sort((a, b) => {
      // 1. Sort by client name
      const clientNameA = (a.project?.client?.client_name || "").toLowerCase();
      const clientNameB = (b.project?.client?.client_name || "").toLowerCase();
      if (clientNameA !== clientNameB) {
        return clientNameA.localeCompare(clientNameB);
      }

      // 2. Sort by project name
      const projectNameA = (a.project?.name || "").toLowerCase();
      const projectNameB = (b.project?.name || "").toLowerCase();
      if (projectNameA !== projectNameB) {
        return projectNameA.localeCompare(projectNameB);
      }

      // 3. Sort by lot number (extract numeric part from lot_id for proper numeric sorting)
      const lotIdA = a.lot_id || "";
      const lotIdB = b.lot_id || "";

      // Extract lot number from lot_id (e.g., "IK001-lot 1" -> "1")
      const extractLotNumber = (lotId) => {
        const match = lotId.match(/lot\s*(\d+)/i);
        if (match) {
          return parseInt(match[1], 10);
        }
        // If no numeric lot number found, try to extract any number at the end
        const numMatch = lotId.match(/(\d+)$/);
        if (numMatch) {
          return parseInt(numMatch[1], 10);
        }
        // Fallback to string comparison
        return lotId;
      };

      const lotNumA = extractLotNumber(lotIdA);
      const lotNumB = extractLotNumber(lotIdB);

      if (typeof lotNumA === "number" && typeof lotNumB === "number") {
        return lotNumA - lotNumB;
      }

      // Fallback to string comparison if numbers couldn't be extracted
      return lotIdA.localeCompare(lotIdB);
    });
  }, [activeLots, search, stageFilters]);

  // Handle stage filter change
  const handleStageFilterChange = (stageName, status) => {
    setStageFilters((prev) => {
      const newFilters = { ...prev };
      if (status === "ALL" || !status) {
        delete newFilters[stageName];
      } else {
        newFilters[stageName] = status;
      }
      return newFilters;
    });
    setShowFilterDropdowns((prev) => ({ ...prev, [stageName]: false }));
  };

  // Handle filter button click - calculate position
  const handleFilterButtonClick = (stage, event) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();

    setDropdownPositions((prev) => ({
      ...prev,
      [stage]: {
        top: rect.bottom + window.scrollY + 4,
        right: window.innerWidth - rect.right + window.scrollX,
      },
    }));

    setShowFilterDropdowns((prev) => ({
      ...prev,
      [stage]: !prev[stage],
    }));
  };

  // Reset all filters
  const handleResetFilters = () => {
    resetFilters();
  };

  // Handle column toggle
  const handleColumnToggle = (column) => {
    if (column === "Select All") {
      if (selectedColumns.length === availableColumns.length) {
        // If all columns are selected, unselect all
        setSelectedColumns([]);
      } else {
        // If not all columns are selected, select all
        setSelectedColumns([...availableColumns]);
      }
    } else {
      setSelectedColumns((prev) =>
        prev.includes(column)
          ? prev.filter((c) => c !== column)
          : [...prev, column],
      );
    }
  };

  // Check if any filters are active
  const hasActiveFilters = search || Object.keys(stageFilters).length > 0;

  // Export to Excel
  const handleExportToExcel = async () => {
    if (filteredLots.length === 0) {
      toast.warning(
        "There are no lots to export. Adjust your filters and try again.",
      );
      return;
    }

    if (selectedColumns.length === 0) {
      toast.warning("Choose at least one column to export.");
      return;
    }

    setIsExporting(true);

    try {
      // Dynamic import of xlsx to avoid SSR issues
      const XLSX = await import("xlsx");

      // Map of column names to their data extraction functions
      const columnMap = {
        [COL_CLIENT]: (lot) => lot.project?.client?.client_name || "N/A",
        [COL_PROJECT]: (lot) => lot.project?.name || "N/A",
        [COL_LOT]: (lot) => lot.lot_id || "",
        [COL_PERCENT]: (lot) => `${getPercentageCompleted(lot)}%`,
      };

      // Add stage columns to the map
      stages.forEach((stage) => {
        columnMap[stage] = (lot) => {
          const status = getStageStatus(lot, stage);
          return EXPORT_STATUS[status] || "not started";
        };
      });

      // Prepare data for export - only include selected columns
      const exportData = filteredLots.map((lot) => {
        const row = {};
        selectedColumns.forEach((column) => {
          if (columnMap[column]) {
            row[column] = columnMap[column](lot);
          }
        });
        return row;
      });

      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Create a worksheet from the data
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for selected columns only
      const colWidths = selectedColumns.map((column) => {
        if (column === COL_CLIENT) return { wch: 25 };
        if (column === COL_PROJECT) return { wch: 25 };
        if (column === COL_LOT) return { wch: 15 };
        if (column === COL_PERCENT) return { wch: 20 };
        return { wch: 18 }; // Stage columns
      });
      ws["!cols"] = colWidths;

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(wb, ws, "Lots at a Glance");

      // Generate filename with current date
      const currentDate = new Date().toISOString().split("T")[0];
      const filename = `lots_at_glance_${currentDate}.xlsx`;

      // Save the file
      XLSX.writeFile(wb, filename);

      // Show success message
      toast.success(`Exported ${exportData.length} lots to ${filename}.`);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Couldn't export to Excel. Try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Handle project name click - navigate to project page
  const handleProjectNameClick = (lot, event) => {
    event.stopPropagation();
    if (!lot.project?.project_id) {
      toast.error("Couldn't open the project because its ID is missing.");
      return;
    }

    const projectHref = `/admin/projects/${lot.project.project_id}`;
    router.push(projectHref);
  };

  // Handle client name click - navigate to client page
  const handleClientNameClick = (lot, event) => {
    event.stopPropagation();
    if (!lot.project?.client?.client_id) {
      toast.error("Couldn't open the client because its ID is missing.");
      return;
    }

    const clientHref = `/admin/clients/${lot.project.client.client_id}`;
    router.push(clientHref);
  };

  // Handle status square click
  const handleStatusSquareClick = (lot, stage, event) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const dropdownKey = `${lot.lot_id}-${stage}`;

    // Standard left alignment
    // Use viewport coordinates for fixed positioning
    let leftPosition = rect.left;

    // Check if dropdown will go off screen (w-40 is 160px)
    const dropdownWidth = 160;
    const windowWidth = window.innerWidth;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    // Add a small buffer (10px) and account for scrollbar
    if (leftPosition + dropdownWidth > windowWidth - scrollbarWidth - 10) {
      // Align right edge of dropdown with right edge of button
      leftPosition = rect.right - dropdownWidth;
    }

    // Vertical alignment
    const dropdownHeight = 200; // Estimate height with buffer
    const windowHeight = window.innerHeight;

    let topPosition = rect.bottom + 4;
    let bottomPosition = null;

    if (topPosition + dropdownHeight > windowHeight) {
      // Position above the button
      topPosition = null;
      bottomPosition = windowHeight - rect.top + 4;
    }

    setStatusDropdownPositions((prev) => ({
      ...prev,
      [dropdownKey]: {
        top: topPosition,
        bottom: bottomPosition,
        left: leftPosition,
      },
    }));

    setStatusDropdownOpen(
      statusDropdownOpen === dropdownKey ? null : dropdownKey,
    );
  };

  // Handle stage status update
  const handleStageStatusUpdate = async (lot, stage, newStatus) => {
    try {
      setIsUpdatingStatus(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
        return;
      }

      // Find the stage object for this lot and stage name
      const stageObj = lot.stages?.find(
        (s) => s.name.toLowerCase() === stage.toLowerCase(),
      );

      if (!stageObj || !stageObj.stage_id) {
        // Stage doesn't exist yet, we need to create it
        const createResponse = await axios.post(
          "/api/v1/stage/create",
          {
            lot_id: lot.lot_id,
            name: stage.toLowerCase(),
            status: newStatus,
            notes: "",
            startDate: null,
            endDate: null,
            assigned_to: [],
          },
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (createResponse.data.status) {
          toast.success("Stage status updated.");
          setStatusDropdownOpen(null);
          fetchActiveLots();
        } else {
          toast.error(
            createResponse.data.message ||
              "Couldn't update the stage status. Try again.",
          );
        }
      } else {
        // Stage exists, update it
        const response = await axios.patch(
          `/api/v1/stage/${stageObj.stage_id}`,
          {
            name: stageObj.name,
            status: newStatus,
            notes: stageObj.notes || "",
            startDate: stageObj.startDate || null,
            endDate: stageObj.endDate || null,
            assigned_to:
              stageObj.assigned_to?.map((a) =>
                typeof a === "string" ? a : a.employee_id || a,
              ) || [],
          },
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (response.data.status) {
          toast.success("Stage status updated.");
          setStatusDropdownOpen(null);
          fetchActiveLots();
        } else {
          toast.error(
            response.data.message ||
              "Couldn't update the stage status. Try again.",
          );
        }
      }
    } catch (error) {
      console.error("Error updating stage status:", error);
      toast.error(
        "Couldn't update the stage status. Check your connection and try again.",
      );
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".filter-dropdown-container")) {
        setShowFilterDropdowns({});
      }
      if (!event.target.closest(".dropdown-container")) {
        setShowColumnDropdown(false);
      }
      if (!event.target.closest(".status-dropdown-container")) {
        setStatusDropdownOpen(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close dropdowns when scrolling
  useEffect(() => {
    const handleScroll = () => {
      // Close all filter dropdowns
      setShowFilterDropdowns({});
      // Close column dropdown
      setShowColumnDropdown(false);
      // Close all status dropdowns
      setStatusDropdownOpen(null);
    };

    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  const retryFetch = () => {
    setError("");
    setLoading(true);
    fetchActiveLots();
  };

  const exportDisabled =
    isExporting || filteredLots.length === 0 || selectedColumns.length === 0;
  const columnPickerDisabled = isExporting || filteredLots.length === 0;
  const tableColumnCount = stages.length + 3;

  const tabClass = (tab) =>
    `cursor-pointer py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-t-sm ${
      activeTab === tab
        ? "border-primary text-primary"
        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
    }`;

  const TH_BASE =
    "py-2 text-xs font-medium text-slate-500 uppercase tracking-wider";
  const TH_ROTATED = `${TH_BASE} px-2 text-center w-[50px] h-80`;
  const ROTATED_LABEL_STYLE = {
    writingMode: "vertical-rl",
    textOrientation: "mixed",
    transform: "rotate(180deg)",
  };

  return (
    <AdminShell>
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="px-4 py-2 shrink-0">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-800">
              Lots at a glance
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Stage status key"
                className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              >
                <span className="text-xs font-medium text-slate-600">
                  Status:
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  {["NOT_STARTED", "IN_PROGRESS", "DONE", "NA"].map(
                    (status) => (
                      <LegendSwatch key={status} status={status} />
                    ),
                  )}
                </div>
              </div>
              <SearchBar />
            </div>
          </div>
        </div>

        <div className="px-4 shrink-0 border-b border-slate-200">
          <div className="flex space-x-6" role="tablist" aria-label="Lots view">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
              className={tabClass("overview")}
            >
              Overview
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "scheduler"}
              onClick={() => setActiveTab("scheduler")}
              className={tabClass("scheduler")}
            >
              Scheduler
            </button>
          </div>
        </div>

        {activeTab === "overview" ? (
          <div className="flex-1 flex flex-col overflow-hidden px-4 py-4">
            <div className="bg-white rounded-lg border border-slate-200 flex flex-col h-full overflow-hidden">
              {/* Fixed header section */}
              <div className="p-4 shrink-0 border-b border-slate-200">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {/* Search */}
                  <div className="flex items-center gap-2 flex-1 min-w-64 max-w-2xl relative">
                    <Search
                      className="h-4 w-4 absolute left-3 text-slate-400 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      aria-label="Search lots"
                      placeholder="Search by client name, project name or lot ID"
                      className="w-full text-sm text-slate-800 py-2 pr-3 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Reset button - visible when filters are active */}
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleResetFilters}
                        className={BTN_SECONDARY}
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        <span>Reset filters</span>
                      </button>
                    )}
                    {/* Export to Excel */}
                    <div className="relative dropdown-container flex items-stretch">
                      <button
                        type="button"
                        onClick={handleExportToExcel}
                        disabled={exportDisabled}
                        className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 border-r-0 hover:bg-slate-100 rounded-l-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Sheet className="h-4 w-4" aria-hidden="true" />
                        <span>
                          {isExporting ? "Exporting…" : "Export to Excel"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setShowColumnDropdown(!showColumnDropdown)
                        }
                        disabled={columnPickerDisabled}
                        aria-label="Choose columns to export"
                        aria-haspopup="true"
                        aria-expanded={showColumnDropdown}
                        className="cursor-pointer flex items-center px-2 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-r-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      </button>
                      {showColumnDropdown && (
                        <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg z-40 max-h-96 overflow-y-auto">
                          <div className="py-1">
                            <label
                              className={`${MENU_CHECK_ROW} sticky top-0 bg-white border-b border-slate-200`}
                            >
                              <span className="font-medium">Select all</span>
                              <input
                                type="checkbox"
                                checked={
                                  selectedColumns.length ===
                                  availableColumns.length
                                }
                                onChange={() =>
                                  handleColumnToggle("Select All")
                                }
                                className={CHECKBOX}
                              />
                            </label>
                            {availableColumns.map((column) => (
                              <label key={column} className={MENU_CHECK_ROW}>
                                <span>{column}</span>
                                <input
                                  type="checkbox"
                                  checked={selectedColumns.includes(column)}
                                  onChange={() => handleColumnToggle(column)}
                                  className={CHECKBOX}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter dropdowns - positioned fixed over the table */}
              {stages.map((stage) => {
                const filterStatus = stageFilters[stage] || "ALL";
                if (!showFilterDropdowns[stage] || !dropdownPositions[stage])
                  return null;

                return (
                  <div
                    key={`dropdown-${stage}`}
                    className="fixed bg-white border border-slate-300 rounded-lg z-40 w-40 filter-dropdown-container"
                    style={{
                      top: `${dropdownPositions[stage].top}px`,
                      right: `${dropdownPositions[stage].right}px`,
                    }}
                  >
                    <div className="py-1">
                      {FILTER_OPTIONS.map((option) => (
                        <button
                          type="button"
                          key={option}
                          onClick={() => handleStageFilterChange(stage, option)}
                          aria-current={filterStatus === option}
                          className={`${MENU_ITEM} ${
                            filterStatus === option
                              ? "bg-slate-100 font-medium"
                              : ""
                          }`}
                        >
                          {option !== "ALL" && (
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${STATUS_FILL[option]}`}
                              aria-hidden="true"
                            />
                          )}
                          {option === "ALL"
                            ? "All statuses"
                            : statusLabel(option)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Scrollable table section */}
              <div className="flex-1 overflow-auto">
                {loading || error ? (
                  <LoadState
                    loading={loading}
                    error={error}
                    onRetry={retryFetch}
                  />
                ) : activeLots.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-12">
                    <ClipboardList
                      className="w-8 h-8 text-slate-300"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-slate-600">No active lots yet</p>
                  </div>
                ) : (
                  <div className="min-w-full">
                    <table className="min-w-full divide-y divide-slate-200 table-fixed">
                      <caption className="sr-only">
                        Stage status for each active lot
                      </caption>
                      <thead className="bg-slate-50 sticky top-0 z-20">
                        <tr>
                          <th
                            scope="col"
                            className={`${TH_BASE} px-4 text-left align-bottom border-r border-slate-200 sticky top-0 left-0 z-30 bg-slate-50 w-[180px] min-w-[180px] max-w-[180px]`}
                          >
                            Client name
                          </th>
                          <th
                            scope="col"
                            className={`${TH_BASE} px-4 text-left align-bottom border-r border-slate-200 sticky top-0 left-[180px] z-30 bg-slate-50 w-[350px] min-w-[350px] max-w-[350px]`}
                          >
                            Project name - lot number
                          </th>
                          {stages.map((stage) => {
                            const filterStatus = stageFilters[stage] || "ALL";
                            const hasFilter = filterStatus !== "ALL";

                            return (
                              <th
                                key={stage}
                                scope="col"
                                className={TH_ROTATED}
                              >
                                <div className="flex flex-col items-center justify-end gap-2 h-full">
                                  <span
                                    className="whitespace-nowrap"
                                    style={ROTATED_LABEL_STYLE}
                                  >
                                    {stage}
                                  </span>

                                  <div className="relative filter-dropdown-container shrink-0">
                                    <button
                                      type="button"
                                      ref={(el) =>
                                        (filterButtonRefs.current[stage] = el)
                                      }
                                      onClick={(e) =>
                                        handleFilterButtonClick(stage, e)
                                      }
                                      aria-haspopup="true"
                                      aria-expanded={Boolean(
                                        showFilterDropdowns[stage],
                                      )}
                                      aria-label={`Filter ${stage} by status${
                                        hasFilter
                                          ? ` (showing ${statusLabel(filterStatus)})`
                                          : ""
                                      }`}
                                      title={
                                        hasFilter
                                          ? `Showing ${statusLabel(filterStatus)}`
                                          : "Filter by status"
                                      }
                                      className={`cursor-pointer p-1.5 rounded-md hover:bg-slate-200 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary ${
                                        hasFilter ? "bg-primary/20" : ""
                                      }`}
                                    >
                                      <Funnel
                                        className={`h-4 w-4 ${
                                          hasFilter
                                            ? "text-primary"
                                            : "text-slate-500"
                                        }`}
                                        aria-hidden="true"
                                      />
                                    </button>
                                  </div>
                                </div>
                              </th>
                            );
                          })}
                          <th
                            scope="col"
                            className={`${TH_ROTATED} border-l border-slate-200`}
                          >
                            <div className="flex flex-col items-center justify-end gap-2 h-full">
                              <span
                                className="whitespace-nowrap"
                                style={ROTATED_LABEL_STYLE}
                              >
                                Percentage completed
                              </span>
                            </div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {filteredLots.length === 0 ? (
                          <tr>
                            <td
                              colSpan={tableColumnCount}
                              className="px-4 py-12 text-center"
                            >
                              <div className="flex flex-col items-center gap-2">
                                <ClipboardList
                                  className="w-8 h-8 text-slate-300"
                                  aria-hidden="true"
                                />
                                <p className="text-sm text-slate-600">
                                  No lots match your filters
                                </p>
                                {hasActiveFilters && (
                                  <button
                                    type="button"
                                    onClick={handleResetFilters}
                                    className={`${BTN_SECONDARY} py-1.5`}
                                  >
                                    <RotateCcw
                                      className="h-4 w-4"
                                      aria-hidden="true"
                                    />
                                    Clear filters
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredLots.map((lot) => (
                            <tr
                              key={lot.lot_id}
                              className="group hover:bg-slate-50 transition-colors duration-200"
                            >
                              <td className="px-4 py-3 text-sm text-slate-700 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 whitespace-nowrap w-[180px] min-w-[180px] max-w-[180px] overflow-hidden">
                                <button
                                  type="button"
                                  onClick={(e) => handleClientNameClick(lot, e)}
                                  title={
                                    lot.project?.client?.client_name || EMPTY
                                  }
                                  className="block w-full truncate text-left font-medium cursor-pointer rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                  {lot.project?.client?.client_name || EMPTY}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-700 sticky left-[180px] bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 whitespace-nowrap w-[350px] min-w-[350px] max-w-[350px] overflow-hidden">
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    handleProjectNameClick(lot, e)
                                  }
                                  title={`${lot.project?.name || EMPTY} - ${lot.lot_id}`}
                                  className="block w-full truncate text-left font-medium cursor-pointer rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                  {lot.project?.name || EMPTY} - {lot.lot_id}
                                </button>
                              </td>
                              {stages.map((stage) => {
                                const status = getStageStatus(lot, stage);
                                const StatusIcon = STATUS_ICON[status];
                                const dropdownKey = `${lot.lot_id}-${stage}`;
                                const isDropdownOpen =
                                  statusDropdownOpen === dropdownKey;
                                const dropdownPosition =
                                  statusDropdownPositions[dropdownKey];

                                return (
                                  <td
                                    key={stage}
                                    className="px-2 py-3 text-sm text-center relative"
                                  >
                                    <div className="relative inline-block">
                                      <button
                                        type="button"
                                        onClick={(e) =>
                                          handleStatusSquareClick(lot, stage, e)
                                        }
                                        disabled={isUpdatingStatus}
                                        aria-haspopup="true"
                                        aria-expanded={isDropdownOpen}
                                        aria-label={`${stage} for ${lot.lot_id}: ${statusLabel(status)}. Change status`}
                                        title={`${statusLabel(status)} - click to change`}
                                        className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-white ${
                                          STATUS_FILL[status] ||
                                          STATUS_FILL.NOT_STARTED
                                        } cursor-pointer hover:opacity-80 transition-opacity duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed`}
                                      >
                                        {StatusIcon && (
                                          <StatusIcon
                                            className="w-3 h-3"
                                            aria-hidden="true"
                                          />
                                        )}
                                      </button>

                                      {isDropdownOpen && dropdownPosition && (
                                        <div
                                          className="fixed bg-white border border-slate-300 rounded-lg z-40 w-40 status-dropdown-container"
                                          style={{
                                            top: dropdownPosition.top
                                              ? `${dropdownPosition.top}px`
                                              : "auto",
                                            bottom: dropdownPosition.bottom
                                              ? `${dropdownPosition.bottom}px`
                                              : "auto",
                                            left: `${dropdownPosition.left}px`,
                                          }}
                                        >
                                          <div className="py-1">
                                            {STATUS_OPTIONS.map((option) => (
                                              <button
                                                type="button"
                                                key={option}
                                                onClick={() =>
                                                  handleStageStatusUpdate(
                                                    lot,
                                                    stage,
                                                    option,
                                                  )
                                                }
                                                disabled={isUpdatingStatus}
                                                aria-current={status === option}
                                                className={`${MENU_ITEM} disabled:opacity-50 disabled:cursor-not-allowed ${
                                                  status === option
                                                    ? "bg-slate-100 font-medium"
                                                    : ""
                                                }`}
                                              >
                                                <span
                                                  className={`h-2 w-2 shrink-0 rounded-full ${STATUS_FILL[option]}`}
                                                  aria-hidden="true"
                                                />
                                                {statusLabel(option)}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="px-4 py-3 text-sm text-slate-700 font-medium text-center tabular-nums border-l border-slate-200 whitespace-nowrap w-[50px] min-w-[50px] max-w-[50px]">
                                {getPercentageCompleted(lot)}%
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : loading || error ? (
          <div className="flex-1 min-h-0 px-4 py-4">
            <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
              <LoadState loading={loading} error={error} onRetry={retryFetch} />
            </div>
          </div>
        ) : (
          <SchedulerView
            activeLots={activeLots}
            getStageStatus={getStageStatus}
            getToken={getToken}
            onRefresh={fetchActiveLots}
            onOptimisticUpdate={updateScheduleOptimistically}
          />
        )}
      </main>
    </AdminShell>
  );
}
