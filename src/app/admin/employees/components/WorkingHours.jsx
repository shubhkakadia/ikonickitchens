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
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";

import PaginationFooter from "@/components/PaginationFooter";
import { useAuth } from "@/contexts/AuthContext";
import { useExcelExport } from "@/hooks/useExcelExport";

const CLOCK_PUNCH_TIME_ZONE = "Australia/Adelaide";
const DEFAULT_RANGE_DAYS = 14;
const DEFAULT_ROWS_PER_PAGE = 25;

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

const breakStyles = {
  ON_BREAK: "border-amber-200 bg-amber-50 text-amber-700",
  BREAK_COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  NO_BREAK: "border-slate-200 bg-slate-50 text-slate-600",
};

const reviewStyles = {
  PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  REJECTED: "border-red-200 bg-red-50 text-red-700",
  MIXED: "border-blue-200 bg-blue-50 text-blue-700",
};

const workingStyles = {
  WORKING: "border-emerald-200 bg-emerald-50 text-emerald-700",
  NOT_WORKING: "border-slate-200 bg-slate-50 text-slate-600",
};

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

function formatLabel(value) {
  return String(value || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
  if (!date) return "";
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export default function WorkingHours({ employeeId }) {
  const router = useRouter();
  const { getToken } = useAuth();

  const today = getTodayInTimeZone();
  const [startDate, setStartDate] = useState(() =>
    shiftDate(getTodayInTimeZone(), -(DEFAULT_RANGE_DAYS - 1)),
  );
  const [endDate, setEndDate] = useState(today);

  const [dateGroups, setDateGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
          setError("No valid session found. Please login again.");
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
          setError(response.data.message || "Failed to fetch working hours");
          setDateGroups([]);
          return;
        }

        setDateGroups(response.data.data || []);
      } catch (requestError) {
        if (requestError.code === "ERR_CANCELED") return;
        console.error("Error fetching working hours:", requestError);
        setError(
          requestError.response?.data?.message ||
            "Unable to load working hours. Please try again.",
        );
        setDateGroups([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchWorkingHours();
    return () => controller.abort();
  }, [employeeId, endDate, getToken, isRangeValid, startDate]);

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

  return (
    <div className="space-y-4">
      {/* Range controls */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
              className="text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none transition-all duration-200"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              className="text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => applyQuickRange(7)}
            className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Last 7 days
          </button>
          <button
            type="button"
            onClick={() => applyQuickRange(DEFAULT_RANGE_DAYS)}
            className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Last 14 days
          </button>
          <button
            type="button"
            onClick={applyThisMonth}
            className="cursor-pointer px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            This month
          </button>

          <div className="relative flex items-center" ref={columnDropdownRef}>
            <button
              type="button"
              onClick={handleExportToExcel}
              disabled={exportDisabled}
              className={`flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 border border-slate-300 border-r-0 rounded-l-lg transition-colors ${
                exportDisabled
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:bg-slate-100"
              }`}
            >
              <Sheet className="h-4 w-4" />
              <span>{isExporting ? "Exporting..." : "Export to Excel"}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowColumnDropdown(!showColumnDropdown)}
              disabled={isExporting}
              className={`flex items-center px-2 py-2 text-slate-700 border border-slate-300 rounded-r-lg transition-colors ${
                isExporting
                  ? "opacity-50 cursor-not-allowed"
                  : "cursor-pointer hover:bg-slate-100"
              }`}
            >
              <ChevronDown className="h-4 w-4" />
            </button>

            {showColumnDropdown && (
              <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                <div className="py-1">
                  <label className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 sticky top-0 bg-white border-b border-slate-200 cursor-pointer">
                    <span className="font-semibold">Select All</span>
                    <input
                      type="checkbox"
                      checked={selectedColumns.length === EXPORT_COLUMNS.length}
                      onChange={() => handleColumnToggle("Select All")}
                      className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                    />
                  </label>
                  {EXPORT_COLUMNS.map((column) => (
                    <label
                      key={column}
                      className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <span>{column}</span>
                      <input
                        type="checkbox"
                        checked={selectedColumns.includes(column)}
                        onChange={() => handleColumnToggle(column)}
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

      {!isRangeValid && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">
            The start date must be on or before the end date.
          </p>
        </div>
      )}

      {/* Totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            Total Hours
          </div>
          <p className="mt-1 text-lg font-bold text-slate-800">
            {totals.totalHours.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
            <CalendarDays className="w-3.5 h-3.5" />
            Days Worked
          </div>
          <p className="mt-1 text-lg font-bold text-slate-800">
            {totals.daysWorked}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            Average Per Day
          </div>
          <p className="mt-1 text-lg font-bold text-slate-800">
            {totals.averageHours.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Awaiting Review
          </div>
          <p className="mt-1 text-lg font-bold text-slate-800">
            {totals.pendingDays}
          </p>
        </div>
      </div>

      {/* Days table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Date
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Working Hours
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Punches
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Break Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Review Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  Working Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm font-medium text-slate-500"
                  >
                    Loading working hours...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
                    <p className="text-sm font-medium text-red-600">{error}</p>
                  </td>
                </tr>
              ) : dayRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <Coffee className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <p className="text-sm font-semibold text-slate-700">
                      No working hours in this range
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Try widening the date range.
                    </p>
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
                      <p className="text-sm font-semibold text-slate-800">
                        {formatLongDate(row.date)}
                      </p>
                      <p className="text-xs text-slate-500">{row.date}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-700">
                      {Number(row.hours || 0).toFixed(2)} hours
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {row.count}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          breakStyles[row.break_status] || breakStyles.NO_BREAK
                        }`}
                      >
                        {formatLabel(row.break_status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          reviewStyles[row.review_status] ||
                          reviewStyles.PENDING
                        }`}
                      >
                        {row.review_status === "APPROVED" && (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        {formatLabel(row.review_status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          workingStyles[row.working_status] ||
                          workingStyles.NOT_WORKING
                        }`}
                      >
                        {formatLabel(row.working_status)}
                      </span>
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
