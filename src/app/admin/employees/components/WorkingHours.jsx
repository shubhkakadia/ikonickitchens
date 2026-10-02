"use client";

import axios from "axios";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coffee,
  Sheet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";

import PaginationFooter from "@/components/PaginationFooter";
import { useAuth } from "@/contexts/AuthContext";
import { useExcelExport } from "@/hooks/useExcelExport";
import {
  BADGE,
  breakStyles,
  formatLabel,
  reviewStyles,
  workingStyles,
} from "@/app/admin/employees/punches/lib/punchStyles";

const CLOCK_PUNCH_TIME_ZONE = "Australia/Adelaide";
const DEFAULT_RANGE_DAYS = 14;
const DEFAULT_ROWS_PER_PAGE = 25;
const EMPTY = "—";

// These are the Excel column headers, so they keep their title-case names:
// they are part of the exported file, not just UI copy.
const EXPORT_COLUMNS = [
  "Date",
  "Employee",
  "Employee ID",
  "Role",
  "Working Hours",
  "First Clock In",
  "Last Clock Out",
  "Punches",
  "Break Status",
  "Review Status",
  "Working Status",
];

const EXPORT_COLUMN_WIDTHS = {
  Date: 14,
  Employee: 24,
  "Employee ID": 20,
  Role: 18,
  "Working Hours": 14,
  "First Clock In": 14,
  "Last Clock Out": 14,
  Punches: 10,
  "Break Status": 18,
  "Review Status": 16,
  "Working Status": 16,
};

// Button and field recipes from DESIGN.md 9.1 / 9.2 (compact variants).
const BUTTON_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const FIELD =
  "text-sm text-slate-800 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-colors duration-200";
const LABEL = "block text-sm font-medium text-slate-700 mb-1.5";
const TH =
  "px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider";

const dayFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: CLOCK_PUNCH_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const punchTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: CLOCK_PUNCH_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

// Rejected punches are excluded from the hours, so keep the export consistent.
function findPunchTime(row, action, { last = false } = {}) {
  const matches = (row.punches || [])
    .filter(
      (punch) => punch.action === action && punch.review_status !== "REJECTED",
    )
    .map((punch) => new Date(punch.punched_at).getTime())
    .filter((time) => !Number.isNaN(time));

  if (matches.length === 0) return "";

  return punchTimeFormatter.format(
    new Date(last ? Math.max(...matches) : Math.min(...matches)),
  );
}

function employeeName(row) {
  const name = [row.employee?.first_name, row.employee?.last_name]
    .filter(Boolean)
    .join(" ");
  return name || "";
}

// Ranges are Adelaide calendar days, so "today" is resolved in that zone rather
// than the browser's.
function getTodayInTimeZone() {
  const parts = dayFormatter.formatToParts(new Date());
  const lookup = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${lookup.year}-${lookup.month}-${lookup.day}`;
}

function shiftDate(date, days) {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

function startOfMonth(date) {
  return `${date.slice(0, 7)}-01`;
}

function formatLongDate(date) {
  if (!date) return EMPTY;
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

// A status pill built from the shared punch-style maps (DESIGN.md 9.6). A
// missing value reads as an em dash rather than an empty pill.
function StatusBadge({ styles, value, fallback, icon: Icon }) {
  if (!value) return <span className="text-slate-500">{EMPTY}</span>;
  return (
    <span className={`${BADGE} ${styles[value] || styles[fallback]}`}>
      {Icon && <Icon className="w-3 h-3" aria-hidden="true" />}
      {formatLabel(value)}
    </span>
  );
}

export default function WorkingHours({ employeeId }) {
  const router = useRouter();
  const { getToken } = useAuth();
  const fieldId = useId();
  const startId = `${fieldId}-start`;
  const endId = `${fieldId}-end`;
  const rangeErrorId = `${fieldId}-range-error`;

  const today = getTodayInTimeZone();
  const [startDate, setStartDate] = useState(() =>
    shiftDate(getTodayInTimeZone(), -(DEFAULT_RANGE_DAYS - 1)),
  );
  const [endDate, setEndDate] = useState(today);

  const [dateGroups, setDateGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Bumped by "Try again" to re-run the fetch with the same range.
  const [reloadKey, setReloadKey] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

  const [selectedColumns, setSelectedColumns] = useState([...EXPORT_COLUMNS]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const columnDropdownRef = useRef(null);

  const isRangeValid = !startDate || !endDate || startDate <= endDate;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        columnDropdownRef.current &&
        !columnDropdownRef.current.contains(event.target)
      ) {
        setShowColumnDropdown(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") setShowColumnDropdown(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchWorkingHours = async () => {
      if (!employeeId || !isRangeValid) return;

      try {
        setLoading(true);
        setError("");

        const token = getToken();
        if (!token) {
          setError("Your session has expired. Sign in again to continue.");
          return;
        }

        const response = await axios.get(
          `/api/v1/clock_punch/employee/${employeeId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            params: {
              ...(startDate ? { from: startDate } : {}),
              ...(endDate ? { to: endDate } : {}),
            },
            signal: controller.signal,
          },
        );

        if (!response.data.status) {
          setError(
            response.data.message ||
              "Couldn't load working hours. Check your connection and try again.",
          );
          setDateGroups([]);
          return;
        }

        setDateGroups(response.data.data || []);
      } catch (requestError) {
        if (requestError.code === "ERR_CANCELED") return;
        console.error("Error fetching working hours:", requestError);
        setError(
          requestError.response?.data?.message ||
            "Couldn't load working hours. Check your connection and try again.",
        );
        setDateGroups([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchWorkingHours();
    return () => controller.abort();
  }, [employeeId, endDate, getToken, isRangeValid, startDate, reloadKey]);

  // The endpoint is already scoped to one employee, so each date yields at most
  // one group. Newest day first, matching the punches list.
  const dayRows = useMemo(
    () =>
      dateGroups
        .flatMap((dateGroup) => dateGroup.employee_groups || [])
        .sort((first, second) => second.date.localeCompare(first.date)),
    [dateGroups],
  );

  const totals = useMemo(() => {
    const totalHours = dayRows.reduce(
      (sum, row) => sum + Number(row.hours || 0),
      0,
    );
    const pendingDays = dayRows.filter(
      (row) => row.review_status === "PENDING" || row.review_status === "MIXED",
    ).length;

    return {
      totalHours: Number(totalHours.toFixed(2)),
      daysWorked: dayRows.length,
      averageHours:
        dayRows.length > 0
          ? Number((totalHours / dayRows.length).toFixed(2))
          : 0,
      pendingDays,
    };
  }, [dayRows]);

  // The range is fetched in full, so pagination is applied client side.
  const paginatedRows = useMemo(() => {
    if (rowsPerPage === 0) return dayRows;

    const startIndex = (currentPage - 1) * rowsPerPage;
    return dayRows.slice(startIndex, startIndex + rowsPerPage);
  }, [currentPage, dayRows, rowsPerPage]);

  // A new range means a new result set.
  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate]);

  // Keep the page in range when the day count shrinks.
  useEffect(() => {
    if (rowsPerPage === 0) return;

    const totalPages = Math.max(1, Math.ceil(dayRows.length / rowsPerPage));
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, dayRows.length, rowsPerPage]);

  const columnMap = useMemo(
    () => ({
      Date: (row) => row.date || "",
      Employee: (row) => employeeName(row),
      "Employee ID": (row) => row.employee_id || "",
      Role: (row) => row.employee?.role || "",
      "Working Hours": (row) => Number(row.hours || 0),
      "First Clock In": (row) => findPunchTime(row, "CLOCK_IN"),
      "Last Clock Out": (row) =>
        findPunchTime(row, "CLOCK_OUT", { last: true }),
      Punches: (row) => row.count || 0,
      "Break Status": (row) => formatLabel(row.break_status),
      "Review Status": (row) => formatLabel(row.review_status),
      "Working Status": (row) => formatLabel(row.working_status),
    }),
    [],
  );

  const { exportToExcel, isExporting } = useExcelExport({
    columnMap,
    columnWidths: EXPORT_COLUMN_WIDTHS,
    filenamePrefix: "working_hours_export",
    sheetName: "Working Hours",
    selectedColumns,
  });

  const handleExportToExcel = () => {
    setShowColumnDropdown(false);
    exportToExcel(dayRows, {
      customFilename: `working_hours_${employeeId}_${startDate || "start"}_to_${
        endDate || "end"
      }.xlsx`,
    });
  };

  const handleColumnToggle = (column) => {
    if (column === "Select All") {
      setSelectedColumns((previous) =>
        previous.length === EXPORT_COLUMNS.length ? [] : [...EXPORT_COLUMNS],
      );
      return;
    }

    setSelectedColumns((previous) =>
      previous.includes(column)
        ? previous.filter((item) => item !== column)
        : [...previous, column],
    );
  };

  const exportDisabled =
    isExporting ||
    loading ||
    Boolean(error) ||
    dayRows.length === 0 ||
    selectedColumns.length === 0;

  const applyQuickRange = (days) => {
    setStartDate(shiftDate(today, -(days - 1)));
    setEndDate(today);
  };

  const applyThisMonth = () => {
    setStartDate(startOfMonth(today));
    setEndDate(today);
  };

  const openDay = (row) => {
    if (!row.reference_punch_id) return;
    router.push(`/admin/employees/punches/${row.reference_punch_id}`);
  };

  const totalTiles = [
    { label: "Total hours", icon: Clock, value: totals.totalHours.toFixed(2) },
    { label: "Days worked", icon: CalendarDays, value: totals.daysWorked },
    {
      label: "Average per day",
      icon: Clock,
      value: totals.averageHours.toFixed(2),
    },
    {
      label: "Awaiting review",
      icon: CheckCircle2,
      value: totals.pendingDays,
    },
  ];

  return (
    <div className="space-y-4">
      {/* Range controls */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-start gap-3">
          <div>
            <label htmlFor={startId} className={LABEL}>
              Start date
            </label>
            <input
              id={startId}
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
              aria-invalid={!isRangeValid}
              aria-describedby={!isRangeValid ? rangeErrorId : undefined}
              className={`${FIELD} ${
                isRangeValid
                  ? "border-slate-300 focus:ring-primary"
                  : "border-red-500 focus:ring-red-500"
              }`}
            />
          </div>
          <div>
            <label htmlFor={endId} className={LABEL}>
              End date
            </label>
            <input
              id={endId}
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              aria-invalid={!isRangeValid}
              aria-describedby={!isRangeValid ? rangeErrorId : undefined}
              className={`${FIELD} ${
                isRangeValid
                  ? "border-slate-300 focus:ring-primary"
                  : "border-red-500 focus:ring-red-500"
              }`}
            />
            {!isRangeValid && (
              <p id={rangeErrorId} className="text-xs text-red-600 mt-1">
                End date can&apos;t be before the start date.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyQuickRange(7)}
            className={BUTTON_SECONDARY}
          >
            Last 7 days
          </button>
          <button
            type="button"
            onClick={() => applyQuickRange(DEFAULT_RANGE_DAYS)}
            className={BUTTON_SECONDARY}
          >
            Last 14 days
          </button>
          <button
            type="button"
            onClick={applyThisMonth}
            className={BUTTON_SECONDARY}
          >
            This month
          </button>

          <div className="relative flex items-center" ref={columnDropdownRef}>
            <button
              type="button"
              onClick={handleExportToExcel}
              disabled={exportDisabled}
              className="cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 border-r-0 hover:bg-slate-100 rounded-l-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <span
                  className="w-4 h-4 border-2 border-slate-200 border-t-primary rounded-full animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Sheet className="w-4 h-4" aria-hidden="true" />
              )}
              <span>{isExporting ? "Exporting..." : "Export to Excel"}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              disabled={isExporting}
              aria-label="Choose export columns"
              aria-haspopup="true"
              aria-expanded={showColumnDropdown}
              className="cursor-pointer flex items-center px-2 py-2 text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-r-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            </button>

            {showColumnDropdown && (
              <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg z-40 max-h-96 overflow-y-auto">
                <div className="py-1">
                  <label className="flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 sticky top-0 bg-white border-b border-slate-200 cursor-pointer">
                    <span className="font-semibold">Select all</span>
                    <input
                      type="checkbox"
                      checked={selectedColumns.length === EXPORT_COLUMNS.length}
                      onChange={() => handleColumnToggle("Select All")}
                      className="cursor-pointer w-4 h-4 text-primary focus:ring-primary border-slate-300 rounded"
                    />
                  </label>
                  {EXPORT_COLUMNS.map((column) => (
                    <label
                      key={column}
                      className="flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <span>{column}</span>
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(column)}
                        onChange={() => handleColumnToggle(column)}
                        className="cursor-pointer w-4 h-4 text-primary focus:ring-primary border-slate-300 rounded"
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {totalTiles.map(({ label, icon: Icon, value }) => (
          <div
            key={label}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <Icon className="w-4 h-4" aria-hidden="true" />
              {label}
            </div>
            <p className="mt-1 text-2xl font-semibold text-slate-800 tabular-nums">
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Days table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className={`${TH} text-left`}>
                  Date
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Working hours
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Punches
                </th>
                <th scope="col" className={`${TH} text-left`}>
                  Break status
                </th>
                <th scope="col" className={`${TH} text-left`}>
                  Review status
                </th>
                <th scope="col" className={`${TH} text-left`}>
                  Working status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div
                      className="flex items-center justify-center gap-2 text-sm text-slate-600"
                      role="status"
                    >
                      <span
                        className="w-4 h-4 border-2 border-slate-200 border-t-primary rounded-full animate-spin"
                        aria-hidden="true"
                      />
                      Loading working hours...
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <AlertTriangle
                      className="mx-auto mb-2 w-8 h-8 text-red-500"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-red-600 mb-4" role="alert">
                      {error}
                    </p>
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => setReloadKey((key) => key + 1)}
                        className={BUTTON_SECONDARY}
                      >
                        Try again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : dayRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Coffee
                      className="mx-auto mb-2 w-8 h-8 text-slate-300"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-slate-600">
                      No working hours in this range
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Try widening the date range.
                    </p>
                    <div className="flex justify-center mt-4">
                      <button
                        type="button"
                        onClick={() => applyQuickRange(DEFAULT_RANGE_DAYS)}
                        className={BUTTON_SECONDARY}
                      >
                        Reset to last 14 days
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => (
                  <tr
                    key={row.date}
                    onClick={() => openDay(row)}
                    title={
                      row.reference_punch_id
                        ? undefined
                        : "This day has no active clock in to open"
                    }
                    className={`transition-colors hover:bg-slate-50 ${
                      row.reference_punch_id ? "cursor-pointer" : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3">
                      {row.reference_punch_id ? (
                        <Link
                          href={`/admin/employees/punches/${row.reference_punch_id}`}
                          onClick={(event) => event.stopPropagation()}
                          className="text-sm font-semibold text-slate-800 hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary rounded-sm transition-colors duration-200"
                        >
                          {formatLongDate(row.date)}
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold text-slate-800">
                          {formatLongDate(row.date)}
                        </p>
                      )}
                      <p className="text-xs font-mono text-slate-500">
                        {row.date}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-mono font-semibold text-slate-700">
                      {Number(row.hours || 0).toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-mono text-slate-700">
                      {row.count ?? EMPTY}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge
                        styles={breakStyles}
                        value={row.break_status}
                        fallback="NO_BREAK"
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge
                        styles={reviewStyles}
                        value={row.review_status}
                        fallback="PENDING"
                        icon={
                          row.review_status === "APPROVED" ? CheckCircle2 : null
                        }
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <StatusBadge
                        styles={workingStyles}
                        value={row.working_status}
                        fallback="NOT_WORKING"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && !error && (
          <PaginationFooter
            totalItems={dayRows.length}
            itemsPerPage={rowsPerPage}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setRowsPerPage}
            itemsPerPageOptions={[10, 25, 50, 0]}
            showItemsPerPage={true}
          />
        )}
      </div>
    </div>
  );
}
