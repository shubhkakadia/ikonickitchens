"use client";
import { AdminRoute } from "@/components/ProtectedRoute";
import CRMLayout from "@/components/tabs";
import React, { useEffect, useState, useMemo, useRef } from "react";
import Sidebar from "@/components/sidebar";
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
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { addTab, replaceTab } from "@/state/reducer/tabs";
import { v4 as uuidv4 } from "uuid";
import SearchBar from "@/components/SearchBar";
import {
  usePersistedTableFilter,
  useTableFilterActions,
} from "@/hooks/usePersistedTableFilter";

const TABLE_KEY = "lot-at-a-glance";
const GANTT_LABEL_WIDTH = 310;

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
    : "Not set";
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
    : "Not set";
};

const formatNotesLabel = (notes) => {
  const value = notes?.trim();
  if (!value) return "No notes added";
  return value.length > 500 ? `${value.slice(0, 500)}...` : value;
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
  const hasInitialisedAccordions = useRef(false);

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
  const rangeLabel = `${formatScheduleDate(schedule.startDate)} - ${formatScheduleDate(schedule.endDate)}`;
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
        visibleStart.getTime() === start.getTime() ? "0.375rem" : "0",
      borderBottomLeftRadius:
        visibleStart.getTime() === start.getTime() ? "0.375rem" : "0",
      borderTopRightRadius:
        visibleEnd.getTime() === end.getTime() ? "0.375rem" : "0",
      borderBottomRightRadius:
        visibleEnd.getTime() === end.getTime() ? "0.375rem" : "0",
    };
  };

  const getMissingInstallationBarStyle = (startValue) => {
    const start = getCalendarDate(startValue) || schedule.startDate;
    if (start > schedule.endDate) return null;
    return getBarStyle(start, schedule.endDate);
  };

  const validateStageDateRange = (scheduleData, startDate, endDate) => {
    if (scheduleData.type !== "stage") return true;

    const lotStartDate = getCalendarDate(scheduleData.lotStartDate);
    const lotEndDate = getCalendarDate(scheduleData.lotEndDate);
    if (!lotStartDate || !lotEndDate) {
      toast.error(
        "Set the parent lot start and installation due dates before scheduling a stage",
      );
      return false;
    }
    if (startDate < lotStartDate || endDate > lotEndDate) {
      toast.error("Stage dates must stay within the parent lot date range");
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

  const getStageBarColor = (status) => {
    switch (status) {
      case "IN_PROGRESS":
        return "bg-yellow-600";
      case "DONE":
        return "bg-green-600";
      case "NA":
        return "bg-slate-500";
      default:
        return "bg-gray-600";
    }
  };

  const getScheduleKey = (scheduleData) =>
    `${scheduleData.type}:${scheduleData.id || scheduleData.lotId}:${scheduleData.name || ""}`;

  const openScheduleDetails = (details) => {
    if (!details) return;
    const endDate =
      details.type === "stage"
        ? details.item.endDate
        : details.item.installationDueDate;
    setSelectedScheduleDetails(details);
    setDetailForm({
      startDate: formatDateForInput(details.item.startDate),
      endDate: formatDateForInput(endDate),
      notes: details.item.notes || "",
    });
  };

  const saveScheduleDetails = async () => {
    if (!selectedScheduleDetails || !detailForm) return;
    if (!detailForm.startDate || !detailForm.endDate) {
      toast.error("Start and end dates are required");
      return;
    }
    if (new Date(detailForm.startDate) > new Date(detailForm.endDate)) {
      toast.error("Start date cannot be after end date");
      return;
    }
    if (
      selectedScheduleDetails.type === "stage" &&
      !validateStageDateRange(
        {
          type: "stage",
          lotStartDate: selectedScheduleDetails.lot?.startDate,
          lotEndDate: selectedScheduleDetails.lot?.installationDueDate,
        },
        getCalendarDate(detailForm.startDate),
        getCalendarDate(detailForm.endDate),
      )
    ) {
      return;
    }

    try {
      const token = getToken();
      if (!token)
        throw new Error("No valid session found. Please login again.");

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
          `/api/lot/${item.id}`,
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
          `/api/stage/${item.stage_id}`,
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
      toast.success("Schedule details updated");
      await onRefresh();
      setSelectedScheduleDetails(null);
      setDetailForm(null);
    } catch (error) {
      console.error("Error updating lot details:", error);
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to update lot details",
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
      toast.error("End date cannot be before start date");
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
        throw new Error("No valid session found. Please login again.");
      const headers = { Authorization: `Bearer ${token}` };

      if (scheduleData.type === "lot") {
        onOptimisticUpdate({
          type: "lot",
          id: scheduleData.id,
          startDate,
          endDate,
        });
        await axios.patch(
          `/api/lot/${scheduleData.id}`,
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
          `/api/stage/${scheduleData.id}`,
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
          "/api/stage/create",
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

      toast.success("Schedule dates added");
      await onRefresh();
    } catch (error) {
      console.error("Error adding schedule dates:", error);
      toast.error(
        error.response?.data?.message ||
          error.message ||
          "Failed to add schedule dates",
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
        toast.error("Start date cannot be after end date");
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
        toast.error("No valid session found. Please login again.");
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
          `/api/lot/${dragData.id}`,
          {
            startDate: nextStartValue,
            installationDueDate: nextEndValue,
          },
          { headers },
        );
      } else {
        await axios.patch(
          `/api/stage/${dragData.id}`,
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

      toast.success("Schedule date updated");
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
        error.response?.data?.message || "Failed to update schedule date",
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
      startDate && barStyle?.borderTopLeftRadius === "0.375rem";
    const canResizeEnd =
      endDate && barStyle?.borderTopRightRadius === "0.375rem";
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
              onClick={onToggle}
              aria-expanded={isExpanded}
              className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer"
            >
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${
                  isExpanded ? "" : "-rotate-90"
                }`}
              />
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-medium text-slate-700"
                  title={label}
                >
                  {label}
                </p>
                <p className="text-xs text-slate-500">{detail}</p>
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
              <p className="text-xs text-slate-500">{detail}</p>
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
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 flex -translate-x-1/2 gap-1 whitespace-nowrap text-[11px] font-medium text-slate-700">
                        <span className="rounded-full bg-white px-2 py-1 shadow-sm ring-1 ring-slate-200">
                          Start: {formatScheduleDateWithDay(dragData.startDate)}
                        </span>
                        <span className="rounded-full bg-white px-2 py-1 shadow-sm ring-1 ring-slate-200">
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
                isDraggingThisBar ? "opacity-30 shadow-none" : "shadow-sm"
              }`}
              style={displayedBarStyle}
            >
              {warning && (
                <button
                  onClick={() => openScheduleDetails(details)}
                  className="pointer-events-auto absolute inset-0 flex cursor-pointer items-center justify-center gap-1 text-xs font-semibold text-white"
                  title="Open lot details to set the installation date"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Installation date is not set
                </button>
              )}
              {isHoveredBar && !dragState && showEndpointPills && (
                <>
                  <div className="pointer-events-none absolute bottom-full left-0 z-30 mb-1 whitespace-nowrap text-[11px] font-medium text-slate-700">
                    <span className="rounded-full bg-white px-2 py-1 shadow-sm ring-1 ring-slate-200">
                      Start: {formatScheduleDateWithDay(dragData.startDate)}
                    </span>
                  </div>
                  <div className="pointer-events-none absolute bottom-full right-0 z-30 mb-1 whitespace-nowrap text-[11px] font-medium text-slate-700">
                    <span className="rounded-full bg-white px-2 py-1 shadow-sm ring-1 ring-slate-200">
                      End: {formatScheduleDateWithDay(dragData.endDate)}
                    </span>
                  </div>
                </>
              )}
              {!warning && (
                <div
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
                  className="pointer-events-auto absolute inset-y-0 left-2 right-2 cursor-pointer"
                  title="Open schedule details"
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
              className={`pointer-events-none absolute top-5 h-6 opacity-25 shadow-sm ${barClass}`}
              style={pendingBarStyle}
            />
          ) : (
            <span className="relative z-1 inline-flex h-16 items-center px-3 text-xs italic text-slate-400">
              Unscheduled
            </span>
          )}
          <p
            className="absolute top-12 z-1 max-w-[250px] truncate text-xs text-slate-500"
            style={{ left: displayedBarStyle?.left || "0.5rem" }}
            title={notes || "No notes added"}
          >
            {formatNotesLabel(notes)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 m-4">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h2 className="text-base font-semibold text-slate-700">
              Lot Schedule
            </h2>
            <p className="mt-1 text-sm text-slate-500">{rangeLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1">
              {["weekly", "monthly", "quarterly"].map((scale) => (
                <button
                  key={scale}
                  onClick={() => {
                    setTimelineScale(scale);
                    setRangeOffset(0);
                  }}
                  className={`cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                    timelineScale === scale
                      ? "bg-white text-primary shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {scale}
                </button>
              ))}
            </div>
            <button
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
              className="cursor-pointer rounded-lg border border-slate-300 p-2 text-slate-600 transition-colors hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
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
              className="cursor-pointer rounded-lg border border-slate-300 p-2 text-slate-600 transition-colors hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        {activeLots.length === 0 ? (
          <div className="p-8 text-center text-sm font-medium text-slate-500">
            No active lots found
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
                  className="pointer-events-none absolute bottom-0 top-0 z-20 border-l-2 border-red-500"
                  style={{
                    left: isWeeklyView
                      ? `calc(${((schedule.todayIndex + 0.5) / schedule.totalPeriods) * 100}% + ${GANTT_LABEL_WIDTH * (1 - (schedule.todayIndex + 0.5) / schedule.totalPeriods)}px)`
                      : GANTT_LABEL_WIDTH +
                        schedule.todayIndex * unitWidth +
                        unitWidth / 2,
                  }}
                >
                  <span className="absolute -left-5 top-1 rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Today
                  </span>
                </div>
              )}
              <div className="grid sticky top-0 z-30" style={gridStyle}>
                <div className="sticky left-0 z-40 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Lot / Stage
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
                      className="border-r border-slate-200 px-1 py-2 text-center text-[10px] leading-tight text-slate-500"
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
                      label: `${lot.project?.name || "N/A"} — ${lot.name || lot.lot_id}`,
                      detail: `${formatScheduleDate(lot.startDate)} — ${formatScheduleDate(lot.installationDueDate)}`,
                      barStyle: lotBarStyle || lotWarningBarStyle,
                      barClass: hasMissingInstallationDate
                        ? "bg-red-600"
                        : "bg-primary",
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
                              detail: stage
                                ? `${formatScheduleDate(stage.startDate)} — ${formatScheduleDate(stage.endDate)}`
                                : "Unscheduled",
                              barStyle: getBarStyle(
                                stage?.startDate,
                                stage?.endDate,
                              ),
                              barClass: getStageBarColor(status),
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
      {selectedScheduleDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Schedule details"
            className="w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {selectedScheduleDetails.type === "stage" ? "Stage" : "Lot"}{" "}
                  details
                </p>
                <h3 className="mt-1 text-lg font-semibold text-slate-800">
                  {selectedScheduleDetails.item.name ||
                    selectedScheduleDetails.item.lot_id}
                </h3>
              </div>
              <button
                onClick={() => {
                  setSelectedScheduleDetails(null);
                  setDetailForm(null);
                }}
                className="cursor-pointer rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close schedule details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Start date
                </p>
                {detailForm ? (
                  <input
                    type="date"
                    value={detailForm?.startDate || ""}
                    onChange={(event) =>
                      setDetailForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                ) : (
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {formatScheduleDateWithDay(
                      selectedScheduleDetails.item.startDate,
                    )}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  End date
                </p>
                {detailForm ? (
                  <input
                    type="date"
                    value={detailForm?.endDate || ""}
                    min={detailForm?.startDate || undefined}
                    onChange={(event) =>
                      setDetailForm((current) => ({
                        ...current,
                        endDate: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                ) : (
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {formatScheduleDateWithDay(
                      selectedScheduleDetails.item.endDate,
                    )}
                  </p>
                )}
              </div>
              {selectedScheduleDetails.type === "stage" && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Status
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {selectedScheduleDetails.item.status
                      ?.replaceAll("_", " ")
                      .toLowerCase()}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Lot
                </p>
                <p className="mt-1 text-sm font-medium text-slate-700">
                  {selectedScheduleDetails.lot?.lot_id ||
                    selectedScheduleDetails.item.lot_id}
                </p>
              </div>
            </div>
            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Notes
              </p>
              {detailForm ? (
                <textarea
                  value={detailForm?.notes || ""}
                  onChange={(event) =>
                    setDetailForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="No notes added"
                />
              ) : (
                <p className="mt-1 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  {selectedScheduleDetails.item.notes || "No notes added"}
                </p>
              )}
            </div>
            {detailForm && (
              <div className="mt-5 flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  onClick={() => {
                    setSelectedScheduleDetails(null);
                    setDetailForm(null);
                  }}
                  className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveScheduleDetails}
                  disabled={isSavingLotDetails}
                  className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingLotDetails ? "Saving..." : "Save changes"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function page() {
  const { getToken } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();
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
  const availableColumns = useMemo(() => {
    return [
      "Client Name",
      "Project Name",
      "Lot ID",
      ...stages,
      "Percentage Completed",
    ];
  }, []);

  // Initialize selected columns with all columns
  const [selectedColumns, setSelectedColumns] = useState(() => [
    "Client Name",
    "Project Name",
    "Lot ID",
    ...stages,
    "Percentage Completed",
  ]);

  useEffect(() => {
    fetchActiveLots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchActiveLots = async () => {
    try {
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      const config = {
        method: "get",
        maxBodyLength: Infinity,
        url: "/api/lot/active",
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
      setError(error.response?.data?.message || "Failed to fetch active lots");
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

  // Helper function to format status for display
  const formatStatus = (status) => {
    switch (status) {
      case "IN_PROGRESS":
        return "in progress";
      case "DONE":
        return "done";
      case "NOT_STARTED":
        return "not started";
      case "NA":
        return "NA";
      default:
        return "not started";
    }
  };

  // Helper function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "IN_PROGRESS":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "DONE":
        return "bg-green-100 text-green-800 border-green-200";
      case "NOT_STARTED":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "NA":
        return "bg-slate-100 text-slate-600 border-slate-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Helper function to get status box color (just the background)
  const getStatusBoxColor = (status) => {
    switch (status) {
      case "IN_PROGRESS":
        return "bg-yellow-600";
      case "DONE":
        return "bg-green-600";
      case "NOT_STARTED":
        return "bg-gray-600";
      case "NA":
        return "bg-slate-500";
      default:
        return "bg-gray-600";
    }
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
        "No data to export. Please adjust your filters or add lots.",
        {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        },
      );
      return;
    }

    if (selectedColumns.length === 0) {
      toast.warning("Please select at least one column to export.", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
      return;
    }

    setIsExporting(true);

    try {
      // Dynamic import of xlsx to avoid SSR issues
      const XLSX = await import("xlsx");

      // Map of column names to their data extraction functions
      const columnMap = {
        "Client Name": (lot) => lot.project?.client?.client_name || "N/A",
        "Project Name": (lot) => lot.project?.name || "N/A",
        "Lot ID": (lot) => lot.lot_id || "",
        "Percentage Completed": (lot) => `${getPercentageCompleted(lot)}%`,
      };

      // Add stage columns to the map
      stages.forEach((stage) => {
        columnMap[stage] = (lot) => {
          const status = getStageStatus(lot, stage);
          return formatStatus(status);
        };
      });

      // Add stage widths
      stages.forEach(() => {
        // We'll set stage widths to 18 in the export
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
        if (column === "Client Name") return { wch: 25 };
        if (column === "Project Name") return { wch: 25 };
        if (column === "Lot ID") return { wch: 15 };
        if (column === "Percentage Completed") return { wch: 20 };
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
      toast.success(
        `Successfully exported ${exportData.length} lots to ${filename}`,
        {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        },
      );
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Failed to export data to Excel. Please try again.", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Handle project name click - navigate to project page
  const handleProjectNameClick = (lot, event) => {
    event.stopPropagation();
    if (!lot.project?.project_id) {
      toast.error("Project ID not found", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
      return;
    }

    const projectHref = `/admin/projects/${lot.project.project_id}`;
    router.push(projectHref);
    dispatch(
      replaceTab({
        id: uuidv4(),
        title: lot.project.name,
        href: projectHref,
      }),
    );
  };

  // Handle client name click - navigate to client page
  const handleClientNameClick = (lot, event) => {
    event.stopPropagation();
    if (!lot.project?.client?.client_id) {
      toast.error("Client ID not found", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
      return;
    }

    const clientHref = `/admin/clients/${lot.project.client.client_id}`;
    router.push(clientHref);
    dispatch(
      replaceTab({
        id: uuidv4(),
        title: lot.project.client.client_name,
        href: clientHref,
      }),
    );
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
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      // Find the stage object for this lot and stage name
      const stageObj = lot.stages?.find(
        (s) => s.name.toLowerCase() === stage.toLowerCase(),
      );

      if (!stageObj || !stageObj.stage_id) {
        // Stage doesn't exist yet, we need to create it
        const createResponse = await axios.post(
          "/api/stage/create",
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
          toast.success("Stage status updated successfully", {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
          });
          setStatusDropdownOpen(null);
          fetchActiveLots();
        } else {
          toast.error(
            createResponse.data.message || "Failed to update stage status",
          );
        }
      } else {
        // Stage exists, update it
        const response = await axios.patch(
          `/api/stage/${stageObj.stage_id}`,
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
          toast.success("Stage status updated successfully", {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
          });
          setStatusDropdownOpen(null);
          fetchActiveLots();
        } else {
          toast.error(response.data.message || "Failed to update stage status");
        }
      }
    } catch (error) {
      console.error("Error updating stage status:", error);
      toast.error("Failed to update stage status. Please try again.", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
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

  return (
    <AdminRoute>
      <div className="flex h-screen bg-tertiary">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CRMLayout />
          <div className="flex-1 flex flex-col overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
                  <p className="text-sm text-slate-600 font-medium">
                    Loading lots at a glance details...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-sm text-red-600 mb-4 font-medium">
                    {error}
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="cursor-pointer btn-primary px-4 py-2 text-sm font-medium rounded-lg"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="px-4 py-2 shrink-0">
                  <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-slate-700">
                      Lots at a Glance
                    </h1>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="text-xs font-medium text-slate-600">
                          Status:
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <div className="h-4 w-4 rounded bg-gray-600" />
                            <span className="text-xs text-slate-600">
                              Not Started
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="h-4 w-4 rounded bg-yellow-600" />
                            <span className="text-xs text-slate-600">
                              In Progress
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="h-4 w-4 rounded bg-green-600" />
                            <span className="text-xs text-slate-600">Done</span>
                          </div>
                        </div>
                      </div>
                      <SearchBar />
                    </div>
                  </div>
                </div>

                <div className="px-4 shrink-0">
                  <div className="flex gap-1 border-b border-slate-200">
                    <button
                      onClick={() => setActiveTab("overview")}
                      className={`cursor-pointer border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === "overview"
                          ? "border-primary text-primary"
                          : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Overview
                    </button>
                    <button
                      onClick={() => setActiveTab("scheduler")}
                      className={`cursor-pointer border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === "scheduler"
                          ? "border-primary text-primary"
                          : "border-transparent text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Scheduler
                    </button>
                  </div>
                </div>

                {activeTab === "overview" ? (
                  <div className="flex-1 flex flex-col overflow-hidden px-4 py-4">
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                      {/* Fixed Header Section */}
                      <div className="p-4 shrink-0 border-b border-slate-200">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          {/* Search */}
                          <div className="flex items-center gap-2 flex-1 max-w-2xl relative">
                            <Search className="h-4 w-4 absolute left-3 text-slate-400" />
                            <input
                              type="text"
                              placeholder="Search by client name, project name or lot ID"
                              className="w-full text-slate-800 p-2 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm font-normal"
                              value={search}
                              onChange={(e) => setSearch(e.target.value)}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Reset Button - Always visible when filters are active */}
                            {hasActiveFilters && (
                              <button
                                onClick={handleResetFilters}
                                className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                              >
                                <RotateCcw className="h-4 w-4" />
                                <span>Reset Filters</span>
                              </button>
                            )}
                            {/* Export to Excel */}
                            <div className="relative dropdown-container flex items-center">
                              <button
                                onClick={handleExportToExcel}
                                disabled={
                                  isExporting ||
                                  filteredLots.length === 0 ||
                                  selectedColumns.length === 0
                                }
                                className={`flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 border-r-0 px-3 py-2 rounded-l-lg text-sm font-medium ${
                                  isExporting ||
                                  filteredLots.length === 0 ||
                                  selectedColumns.length === 0
                                    ? "opacity-50 cursor-not-allowed"
                                    : "cursor-pointer hover:bg-slate-100"
                                }`}
                              >
                                <Sheet className="h-4 w-4" />
                                <span>
                                  {isExporting
                                    ? "Exporting..."
                                    : "Export to Excel"}
                                </span>
                              </button>
                              <button
                                onClick={() =>
                                  setShowColumnDropdown(!showColumnDropdown)
                                }
                                disabled={
                                  isExporting || filteredLots.length === 0
                                }
                                className={`flex items-center transition-all duration-200 text-slate-700 border border-slate-300 px-2 py-2 rounded-r-lg text-sm font-medium ${
                                  isExporting || filteredLots.length === 0
                                    ? "opacity-50 cursor-not-allowed"
                                    : "cursor-pointer hover:bg-slate-100"
                                }`}
                              >
                                <ChevronDown className="h-5 w-5" />
                              </button>
                              {showColumnDropdown && (
                                <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                                  <div className="py-1">
                                    <label className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 sticky top-0 bg-white border-b border-slate-200 cursor-pointer">
                                      <span className="font-semibold">
                                        Select All
                                      </span>
                                      <input
                                        type="checkbox"
                                        checked={
                                          selectedColumns.length ===
                                          availableColumns.length
                                        }
                                        onChange={() =>
                                          handleColumnToggle("Select All")
                                        }
                                        className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                                      />
                                    </label>
                                    {availableColumns.map((column) => (
                                      <label
                                        key={column}
                                        className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                                      >
                                        <span>{column}</span>
                                        <input
                                          type="checkbox"
                                          checked={selectedColumns.includes(
                                            column,
                                          )}
                                          onChange={() =>
                                            handleColumnToggle(column)
                                          }
                                          className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
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

                      {/* Filter Dropdowns - Positioned fixed over the table */}
                      {stages.map((stage) => {
                        const filterStatus = stageFilters[stage] || "ALL";
                        if (
                          !showFilterDropdowns[stage] ||
                          !dropdownPositions[stage]
                        )
                          return null;

                        return (
                          <div
                            key={`dropdown-${stage}`}
                            className="fixed bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-40 filter-dropdown-container"
                            style={{
                              top: `${dropdownPositions[stage].top}px`,
                              right: `${dropdownPositions[stage].right}px`,
                            }}
                          >
                            <div className="py-1">
                              <button
                                onClick={() =>
                                  handleStageFilterChange(stage, "ALL")
                                }
                                className={`cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 ${
                                  filterStatus === "ALL"
                                    ? "bg-slate-100 font-medium"
                                    : ""
                                }`}
                              >
                                All Statuses
                              </button>
                              <button
                                onClick={() =>
                                  handleStageFilterChange(stage, "NOT_STARTED")
                                }
                                className={`cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 ${
                                  filterStatus === "NOT_STARTED"
                                    ? "bg-slate-100 font-medium"
                                    : ""
                                }`}
                              >
                                Not Started
                              </button>
                              <button
                                onClick={() =>
                                  handleStageFilterChange(stage, "IN_PROGRESS")
                                }
                                className={`cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 ${
                                  filterStatus === "IN_PROGRESS"
                                    ? "bg-slate-100 font-medium"
                                    : ""
                                }`}
                              >
                                In Progress
                              </button>
                              <button
                                onClick={() =>
                                  handleStageFilterChange(stage, "DONE")
                                }
                                className={`cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 ${
                                  filterStatus === "DONE"
                                    ? "bg-slate-100 font-medium"
                                    : ""
                                }`}
                              >
                                Done
                              </button>
                              <button
                                onClick={() =>
                                  handleStageFilterChange(stage, "NA")
                                }
                                className={`cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 ${
                                  filterStatus === "NA"
                                    ? "bg-slate-100 font-medium"
                                    : ""
                                }`}
                              >
                                NA
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Scrollable Table Section */}
                      <div className="flex-1 overflow-auto">
                        {loading ? (
                          <div className="p-8 text-center text-sm text-slate-500 font-medium">
                            Loading active lots...
                          </div>
                        ) : error ? (
                          <div className="p-8 text-center text-sm text-red-600 font-medium">
                            {error}
                          </div>
                        ) : activeLots.length === 0 ? (
                          <div className="p-8 text-center text-sm text-slate-500 font-medium">
                            No active lots found
                          </div>
                        ) : (
                          <div className="min-w-full">
                            <table className="min-w-full divide-y divide-slate-200 table-fixed">
                              <thead className="bg-slate-50 sticky top-0 z-20">
                                <tr>
                                  <th className="px-2 py-4 text-center text-sm font-semibold text-slate-600 uppercase tracking-wider h-[300px] border-r border-slate-200 sticky top-0 left-0 z-30 bg-slate-50 w-[180px] min-w-[180px] max-w-[180px]">
                                    Client Name
                                  </th>
                                  <th className="px-2 py-4 text-center text-sm font-semibold text-slate-600 uppercase tracking-wider h-[300px] border-r border-slate-200 sticky top-0 left-[180px] z-30 bg-slate-50 w-[350px] min-w-[350px] max-w-[350px]">
                                    Project Name - Lot Number
                                  </th>
                                  {stages.map((stage) => {
                                    const filterStatus =
                                      stageFilters[stage] || "ALL";
                                    const hasFilter = filterStatus !== "ALL";

                                    return (
                                      <th
                                        key={stage}
                                        className="px-2 py-4 text-center text-sm font-semibold text-slate-600 uppercase tracking-wider w-[50px] h-[300px]"
                                      >
                                        <div className="flex flex-col items-center justify-end gap-2 h-full">
                                          <span
                                            className="whitespace-nowrap"
                                            style={{
                                              writingMode: "vertical-rl",
                                              textOrientation: "mixed",
                                              transform: "rotate(180deg)",
                                            }}
                                          >
                                            {stage}
                                          </span>

                                          <div className="relative filter-dropdown-container shrink-0">
                                            <button
                                              ref={(el) =>
                                                (filterButtonRefs.current[
                                                  stage
                                                ] = el)
                                              }
                                              onClick={(e) =>
                                                handleFilterButtonClick(
                                                  stage,
                                                  e,
                                                )
                                              }
                                              className={`cursor-pointer p-1 rounded hover:bg-slate-200 transition-colors ${
                                                hasFilter ? "bg-primary/20" : ""
                                              }`}
                                              title="Filter by status"
                                            >
                                              <Funnel
                                                className={`h-3 w-3 ${
                                                  hasFilter
                                                    ? "text-primary"
                                                    : "text-slate-400"
                                                }`}
                                              />
                                            </button>
                                          </div>
                                        </div>
                                      </th>
                                    );
                                  })}
                                  <th className="px-2 py-4 text-center text-sm font-semibold text-slate-600 uppercase tracking-wider w-[50px] h-[300px] border-l border-slate-200">
                                    <div className="flex flex-col items-center justify-end gap-2 h-full">
                                      <span
                                        className="whitespace-nowrap"
                                        style={{
                                          writingMode: "vertical-rl",
                                          textOrientation: "mixed",
                                          transform: "rotate(180deg)",
                                        }}
                                      >
                                        Percentage Completed
                                      </span>
                                    </div>
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-slate-200">
                                {filteredLots.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={stages.length + 3}
                                      className="px-4 py-8 text-center text-sm text-slate-500"
                                    >
                                      <div className="flex flex-col items-center gap-3">
                                        <p>
                                          No lots match your filters. Try
                                          adjusting your search or filters.
                                        </p>
                                        {hasActiveFilters && (
                                          <button
                                            onClick={handleResetFilters}
                                            className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                                          >
                                            <RotateCcw className="h-4 w-4" />
                                            Reset Filters
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
                                      <td
                                        onClick={(e) =>
                                          handleClientNameClick(lot, e)
                                        }
                                        className="px-4 py-3 text-sm text-slate-700 font-medium sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-blue-50 w-[180px] min-w-[180px] max-w-[180px] overflow-hidden"
                                        title={
                                          lot.project?.client?.client_name ||
                                          "N/A"
                                        }
                                      >
                                        <span className="block truncate">
                                          {lot.project?.client?.client_name ||
                                            "N/A"}
                                        </span>
                                      </td>
                                      <td
                                        onClick={(e) =>
                                          handleProjectNameClick(lot, e)
                                        }
                                        className="px-4 py-3 text-sm text-slate-700 font-medium sticky left-[180px] bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-blue-50 w-[350px] min-w-[350px] max-w-[350px] overflow-hidden"
                                        title={`${lot.project?.name || "N/A"} - ${lot.lot_id}`}
                                      >
                                        <span className="block truncate">
                                          {lot.project?.name || "N/A"} -{" "}
                                          {lot.lot_id}
                                        </span>
                                      </td>
                                      {stages.map((stage) => {
                                        const status = getStageStatus(
                                          lot,
                                          stage,
                                        );
                                        const boxColor =
                                          getStatusBoxColor(status);
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
                                                onClick={(e) =>
                                                  handleStatusSquareClick(
                                                    lot,
                                                    stage,
                                                    e,
                                                  )
                                                }
                                                disabled={isUpdatingStatus}
                                                className={`inline-block w-6 h-6 rounded ${boxColor} cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
                                                title={`${formatStatus(status)} - Click to change`}
                                              ></button>

                                              {isDropdownOpen &&
                                                dropdownPosition && (
                                                  <div
                                                    className="fixed bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-40 status-dropdown-container"
                                                    style={{
                                                      top: dropdownPosition.top
                                                        ? `${dropdownPosition.top}px`
                                                        : "auto",
                                                      bottom:
                                                        dropdownPosition.bottom
                                                          ? `${dropdownPosition.bottom}px`
                                                          : "auto",
                                                      left: `${dropdownPosition.left}px`,
                                                    }}
                                                  >
                                                    <div className="py-1">
                                                      <button
                                                        onClick={() =>
                                                          handleStageStatusUpdate(
                                                            lot,
                                                            stage,
                                                            "NOT_STARTED",
                                                          )
                                                        }
                                                        disabled={
                                                          isUpdatingStatus
                                                        }
                                                        className={`cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                                          status ===
                                                          "NOT_STARTED"
                                                            ? "bg-slate-100 font-medium"
                                                            : ""
                                                        }`}
                                                      >
                                                        Not Started
                                                      </button>
                                                      <button
                                                        onClick={() =>
                                                          handleStageStatusUpdate(
                                                            lot,
                                                            stage,
                                                            "IN_PROGRESS",
                                                          )
                                                        }
                                                        disabled={
                                                          isUpdatingStatus
                                                        }
                                                        className={`cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                                          status ===
                                                          "IN_PROGRESS"
                                                            ? "bg-slate-100 font-medium"
                                                            : ""
                                                        }`}
                                                      >
                                                        In Progress
                                                      </button>
                                                      <button
                                                        onClick={() =>
                                                          handleStageStatusUpdate(
                                                            lot,
                                                            stage,
                                                            "DONE",
                                                          )
                                                        }
                                                        disabled={
                                                          isUpdatingStatus
                                                        }
                                                        className={`cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                                          status === "DONE"
                                                            ? "bg-slate-100 font-medium"
                                                            : ""
                                                        }`}
                                                      >
                                                        Done
                                                      </button>
                                                    </div>
                                                  </div>
                                                )}
                                            </div>
                                          </td>
                                        );
                                      })}
                                      <td className="px-4 py-3 text-sm text-slate-700 font-medium text-center border-l border-slate-200 whitespace-nowrap w-[50px] min-w-[50px] max-w-[50px]">
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
                ) : (
                  <SchedulerView
                    activeLots={activeLots}
                    getStageStatus={getStageStatus}
                    getToken={getToken}
                    onRefresh={fetchActiveLots}
                    onOptimisticUpdate={updateScheduleOptimistically}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AdminRoute>
  );
}
