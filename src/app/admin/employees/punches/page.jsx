"use client";

import axios from "axios";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Coffee,
  Funnel,
  Plus,
  RotateCcw,
  Sheet,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import AdminShell from "@/components/AdminShell";
import PaginationFooter from "@/components/PaginationFooter";
import SearchBar from "@/components/SearchBar";
import TabsController from "@/components/tabscontroller";
import { useAuth } from "@/contexts/AuthContext";
import { useExcelExport } from "@/hooks/useExcelExport";
import {
  usePersistedTableFilter,
  useTableFilterActions,
} from "@/hooks/usePersistedTableFilter";

const DEFAULT_DATES_PER_PAGE = 10;
const TABLE_KEY = "clock_punches";
const CLOCK_PUNCH_TIME_ZONE = "Australia/Adelaide";

const BREAK_STATUS_OPTIONS = ["ON_BREAK", "BREAK_COMPLETED", "NO_BREAK"];
const REVIEW_STATUS_OPTIONS = ["PENDING", "APPROVED", "REJECTED", "MIXED"];
const WORKING_STATUS_OPTIONS = ["WORKING", "NOT_WORKING"];

// MIXED is derived from the punches underneath, so it can be displayed but never
// assigned; picking a status writes it to every punch in the day.
const REVIEW_STATUS_ACTIONS = ["PENDING", "APPROVED", "REJECTED"];

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

const punchTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: CLOCK_PUNCH_TIME_ZONE,
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

function formatGroupDate(date) {
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
  const name = [group.employee?.first_name, group.employee?.last_name]
    .filter(Boolean)
    .join(" ");
  return name || "Unknown employee";
}

// Rejected punches are excluded everywhere else, so keep the export consistent.
function findPunchTime(group, action, { last = false } = {}) {
  const matches = (group.punches || [])
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

// An empty selection or a full selection both mean "no filter" for the API.
function toStatusParam(selected, options) {
  if (!selected?.length || selected.length === options.length) return "";
  return [...selected].sort().join(",");
}

function StatusFilterDropdown({
  label,
  options,
  selected,
  onToggle,
  isOpen,
  onOpenChange,
}) {
  const hiddenCount = options.length - selected.length;

  return (
    <div className="relative dropdown-container">
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
      >
        <Funnel className="h-4 w-4" />
        <span>{label}</span>
        {hiddenCount > 0 && (
          <span className="bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            {hiddenCount}
          </span>
        )}
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-60 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="py-1">
            <label className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 sticky top-0 bg-white border-b border-slate-200 cursor-pointer">
              <span className="font-semibold">Select All</span>
              <input
                type="checkbox"
                checked={selected.length === options.length}
                onChange={() => onToggle("Select All")}
                className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
              />
            </label>
            {options.map((option) => (
              <label
                key={option}
                className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <span>{formatLabel(option)}</span>
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => onToggle(option)}
                  className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewStatusDropdown({
  group,
  isOpen,
  onOpenChange,
  isUpdating,
  onSelect,
}) {
  return (
    <div
      className="dropdown-container relative inline-flex items-center gap-2"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => onOpenChange(!isOpen)}
          disabled={isUpdating}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all ${
            reviewStyles[group.review_status] || reviewStyles.PENDING
          } ${isUpdating ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:opacity-80"}`}
        >
          {group.review_status === "APPROVED" && (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          <span>{formatLabel(group.review_status)}</span>
          <ChevronDown
            className={`h-3 w-3 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 z-50 mt-1 w-40 rounded-lg border border-slate-200 bg-white shadow-lg">
            <div className="py-1">
              {REVIEW_STATUS_ACTIONS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    if (group.review_status !== status) onSelect(status);
                    onOpenChange(false);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100"
                >
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      group.review_status === status
                        ? reviewStyles[status]
                        : "border border-transparent"
                    }`}
                  >
                    {formatLabel(status)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isUpdating && (
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent"></div>
      )}
    </div>
  );
}

export default function ViewAllPunchesPage() {
  const router = useRouter();
  const { userData, isAdmin } = useAuth();
  const token = userData?.token || null;
  const canReview = isAdmin();
  const [dateGroups, setDateGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [datesPerPage, setDatesPerPage] = useState(DEFAULT_DATES_PER_PAGE);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pagination, setPagination] = useState({
    total_punches: 0,
    total_dates: 0,
    total_pages: 0,
  });

  const [startDate, setStartDate] = usePersistedTableFilter(
    TABLE_KEY,
    "startDate",
    "",
  );
  const [endDate, setEndDate] = usePersistedTableFilter(
    TABLE_KEY,
    "endDate",
    "",
  );
  const [breakStatuses, setBreakStatuses] = usePersistedTableFilter(
    TABLE_KEY,
    "breakStatuses",
    BREAK_STATUS_OPTIONS,
  );
  const [reviewStatuses, setReviewStatuses] = usePersistedTableFilter(
    TABLE_KEY,
    "reviewStatuses",
    REVIEW_STATUS_OPTIONS,
  );
  const [workingStatuses, setWorkingStatuses] = usePersistedTableFilter(
    TABLE_KEY,
    "workingStatuses",
    WORKING_STATUS_OPTIONS,
  );
  const { resetFilters } = useTableFilterActions(TABLE_KEY);

  const [openDropdown, setOpenDropdown] = useState(null);
  const [openStatusDropdownId, setOpenStatusDropdownId] = useState(null);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [selectedColumns, setSelectedColumns] = useState([...EXPORT_COLUMNS]);
  const [isPreparingExport, setIsPreparingExport] = useState(false);

  const breakStatusParam = toStatusParam(breakStatuses, BREAK_STATUS_OPTIONS);
  const reviewStatusParam = toStatusParam(
    reviewStatuses,
    REVIEW_STATUS_OPTIONS,
  );
  const workingStatusParam = toStatusParam(
    workingStatuses,
    WORKING_STATUS_OPTIONS,
  );

  const isAnyFilterActive =
    Boolean(startDate) ||
    Boolean(endDate) ||
    Boolean(breakStatusParam) ||
    Boolean(reviewStatusParam) ||
    Boolean(workingStatusParam);

  const columnMap = useMemo(
    () => ({
      Date: (group) => group.date || "",
      Employee: (group) => employeeName(group),
      "Employee ID": (group) => group.employee_id || "",
      Role: (group) => group.employee?.role || "",
      "Working Hours": (group) => Number(group.hours || 0),
      "First Clock In": (group) => findPunchTime(group, "CLOCK_IN"),
      "Last Clock Out": (group) =>
        findPunchTime(group, "CLOCK_OUT", { last: true }),
      Punches: (group) => group.count || 0,
      "Break Status": (group) => formatLabel(group.break_status),
      "Review Status": (group) => formatLabel(group.review_status),
      "Working Status": (group) => formatLabel(group.working_status),
    }),
    [],
  );

  const { exportToExcel, isExporting } = useExcelExport({
    columnMap,
    columnWidths: EXPORT_COLUMN_WIDTHS,
    filenamePrefix: "clock_punches_export",
    sheetName: "Clock Punches",
    selectedColumns,
  });

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) {
        setOpenDropdown(null);
        setOpenStatusDropdownId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filters change the result set, so go back to the first page of dates.
  useEffect(() => {
    setCurrentPage(1);
  }, [
    startDate,
    endDate,
    breakStatusParam,
    reviewStatusParam,
    workingStatusParam,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchPunches = async () => {
      try {
        setLoading(true);
        setError("");

        if (!token) {
          setError("No valid session found. Please log in again.");
          return;
        }

        const response = await axios.get("/api/v1/clock_punch/all", {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            page: currentPage,
            limit: datesPerPage,
            ...(startDate ? { from: startDate } : {}),
            ...(endDate ? { to: endDate } : {}),
            ...(breakStatusParam ? { break_status: breakStatusParam } : {}),
            ...(reviewStatusParam
              ? { group_review_status: reviewStatusParam }
              : {}),
            ...(workingStatusParam
              ? { working_status: workingStatusParam }
              : {}),
          },
          signal: controller.signal,
        });

        if (!response.data.status) {
          setError(response.data.message || "Failed to fetch clock punches");
          return;
        }

        setDateGroups(response.data.data || []);
        setPagination(
          response.data.pagination || {
            total_punches: 0,
            total_dates: 0,
            total_pages: 0,
          },
        );
      } catch (requestError) {
        if (requestError.code === "ERR_CANCELED") return;
        console.error("Error fetching clock punches:", requestError);
        setError(
          requestError.response?.data?.message ||
            "Unable to load clock punches. Please try again.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchPunches();
    return () => controller.abort();
  }, [
    currentPage,
    datesPerPage,
    refreshKey,
    token,
    startDate,
    endDate,
    breakStatusParam,
    reviewStatusParam,
    workingStatusParam,
  ]);

  const punchGroups = dateGroups.flatMap(
    (dateGroup) => dateGroup.employee_groups || [],
  );

  const handleStatusToggle = (setSelected, options) => (value) => {
    if (value === "Select All") {
      setSelected((previous) =>
        previous.length === options.length ? [] : [...options],
      );
      return;
    }

    setSelected((previous) =>
      previous.includes(value)
        ? previous.filter((item) => item !== value)
        : [...previous, value],
    );
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

  // A row is a whole day for one employee, so the status is written to each of
  // its punches; the derived MIXED value disappears once they all agree.
  const handleGroupReviewStatusChange = async (group, reviewStatus) => {
    const groupId = `${group.date}-${group.employee_id}`;
    const punchesToUpdate = (group.punches || []).filter(
      (punch) => punch.review_status !== reviewStatus,
    );

    if (punchesToUpdate.length === 0) return;

    try {
      setUpdatingStatusId(groupId);

      for (const punch of punchesToUpdate) {
        const response = await axios.patch(
          `/api/v1/clock_punch/${punch.id}`,
          { review_status: reviewStatus },
          { headers: { Authorization: `Bearer ${token}` } },
        );

        if (!response.data.status) {
          toast.error(response.data.message || "Failed to update the punches");
          return;
        }
      }

      toast.success(
        `${punchesToUpdate.length} punch${
          punchesToUpdate.length === 1 ? "" : "es"
        } marked as ${formatLabel(reviewStatus)}`,
      );
    } catch (requestError) {
      console.error("Error updating clock punch review status:", requestError);
      toast.error(
        requestError.response?.data?.message ||
          "Failed to update the punches. Please try again.",
      );
    } finally {
      setUpdatingStatusId(null);
      // Hours and the derived statuses change with the review state.
      setRefreshKey((value) => value + 1);
    }
  };

  // The details route is keyed by the day's CLOCK_IN punch, so a day made up
  // only of rejected punches has nothing to open.
  const openGroup = (group) => {
    if (!group.reference_punch_id) return;
    router.push(`/admin/employees/punches/${group.reference_punch_id}`);
  };

  const handleReset = () => {
    resetFilters();
    setCurrentPage(1);
  };

  // The table is paginated by date on the server, so the export refetches every
  // matching row instead of only the visible page.
  const handleExportToExcel = async () => {
    setOpenDropdown(null);

    if (!token) {
      toast.error("No valid session found. Please login again.", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
      return;
    }

    try {
      setIsPreparingExport(true);

      const response = await axios.get("/api/v1/clock_punch/all", {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          paginate: "false",
          ...(startDate ? { from: startDate } : {}),
          ...(endDate ? { to: endDate } : {}),
          ...(breakStatusParam ? { break_status: breakStatusParam } : {}),
          ...(reviewStatusParam
            ? { group_review_status: reviewStatusParam }
            : {}),
          ...(workingStatusParam ? { working_status: workingStatusParam } : {}),
        },
      });

      if (!response.data.status) {
        toast.error(
          response.data.message || "Failed to load clock punches for export.",
          {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
          },
        );
        return;
      }

      const rows = (response.data.data || []).flatMap(
        (dateGroup) => dateGroup.employee_groups || [],
      );

      await exportToExcel(rows);
    } catch (requestError) {
      console.error("Error exporting clock punches:", requestError);
      toast.error(
        requestError.response?.data?.message ||
          "Failed to export clock punches. Please try again.",
        {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        },
      );
    } finally {
      setIsPreparingExport(false);
    }
  };

  const exportDisabled =
    isExporting ||
    isPreparingExport ||
    loading ||
    Boolean(error) ||
    pagination.total_dates === 0 ||
    selectedColumns.length === 0;

  return (
    <AdminShell>
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center justify-between gap-4 px-4 py-3">
          <div>
            <h1 className="text-xl font-bold text-slate-700">Clock Punches</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Daily employee attendance in Adelaide time
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SearchBar />
            <TabsController href="/admin/employees/punches/add">
              <div className="flex cursor-pointer items-center gap-2 rounded-lg bg-primary/80 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary">
                <Plus className="h-4 w-4" />
                Add Punch
              </div>
            </TabsController>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4">
          <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Daily punch records
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {pagination.total_dates} date
                  {pagination.total_dates === 1 ? "" : "s"} •{" "}
                  {pagination.total_punches} punch
                  {pagination.total_punches === 1 ? "" : "es"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {isAnyFilterActive && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Reset</span>
                  </button>
                )}

                <div className="relative dropdown-container">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDropdown(openDropdown === "dates" ? null : "dates")
                    }
                    className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                  >
                    <Calendar className="h-4 w-4" />
                    <span>Filter by Dates</span>
                    {(startDate || endDate) && (
                      <span className="bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                        Active
                      </span>
                    )}
                  </button>
                  {openDropdown === "dates" && (
                    <div className="absolute top-full right-0 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-4">
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Start Date
                          </label>
                          <input
                            type="date"
                            value={startDate}
                            onChange={(event) =>
                              setStartDate(event.target.value)
                            }
                            max={endDate || undefined}
                            className="w-full text-slate-800 p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm font-normal"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            End Date
                          </label>
                          <input
                            type="date"
                            value={endDate}
                            onChange={(event) => setEndDate(event.target.value)}
                            min={startDate || undefined}
                            className="w-full text-slate-800 p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm font-normal"
                          />
                        </div>
                        {(startDate || endDate) && (
                          <button
                            type="button"
                            onClick={() => {
                              setStartDate("");
                              setEndDate("");
                            }}
                            className="w-full cursor-pointer text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors duration-200"
                          >
                            Clear Dates
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <StatusFilterDropdown
                  label="Break Status"
                  options={BREAK_STATUS_OPTIONS}
                  selected={breakStatuses}
                  onToggle={handleStatusToggle(
                    setBreakStatuses,
                    BREAK_STATUS_OPTIONS,
                  )}
                  isOpen={openDropdown === "break"}
                  onOpenChange={(isOpen) =>
                    setOpenDropdown(isOpen ? "break" : null)
                  }
                />

                <StatusFilterDropdown
                  label="Review Status"
                  options={REVIEW_STATUS_OPTIONS}
                  selected={reviewStatuses}
                  onToggle={handleStatusToggle(
                    setReviewStatuses,
                    REVIEW_STATUS_OPTIONS,
                  )}
                  isOpen={openDropdown === "review"}
                  onOpenChange={(isOpen) =>
                    setOpenDropdown(isOpen ? "review" : null)
                  }
                />

                <StatusFilterDropdown
                  label="Working Status"
                  options={WORKING_STATUS_OPTIONS}
                  selected={workingStatuses}
                  onToggle={handleStatusToggle(
                    setWorkingStatuses,
                    WORKING_STATUS_OPTIONS,
                  )}
                  isOpen={openDropdown === "working"}
                  onOpenChange={(isOpen) =>
                    setOpenDropdown(isOpen ? "working" : null)
                  }
                />

                <div className="relative dropdown-container flex items-center">
                  <button
                    type="button"
                    onClick={handleExportToExcel}
                    disabled={exportDisabled}
                    className={`flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 border-r-0 px-3 py-2 rounded-l-lg text-sm font-medium ${
                      exportDisabled
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer hover:bg-slate-100"
                    }`}
                  >
                    <Sheet className="h-4 w-4" />
                    <span>
                      {isExporting || isPreparingExport
                        ? "Exporting..."
                        : "Export to Excel"}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenDropdown(
                        openDropdown === "columns" ? null : "columns",
                      )
                    }
                    disabled={isExporting || isPreparingExport}
                    className={`flex items-center transition-all duration-200 text-slate-700 border border-slate-300 px-2 py-2 rounded-r-lg text-sm font-medium ${
                      isExporting || isPreparingExport
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer hover:bg-slate-100"
                    }`}
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                  {openDropdown === "columns" && (
                    <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                      <div className="py-1">
                        <label className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 sticky top-0 bg-white border-b border-slate-200 cursor-pointer">
                          <span className="font-semibold">Select All</span>
                          <input
                            type="checkbox"
                            checked={
                              selectedColumns.length === EXPORT_COLUMNS.length
                            }
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

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wider text-slate-600">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wider text-slate-600">
                      Employee
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wider text-slate-600">
                      Working Hours
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wider text-slate-600">
                      Break Status
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wider text-slate-600">
                      Review Status
                    </th>
                    <th className="px-4 py-2 text-left text-sm font-semibold uppercase tracking-wider text-slate-600">
                      Working Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-sm font-medium text-slate-500"
                      >
                        Loading clock punches...
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center">
                        <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-red-500" />
                        <p className="text-sm font-medium text-red-600">
                          {error}
                        </p>
                        <button
                          type="button"
                          onClick={() => setRefreshKey((value) => value + 1)}
                          className="mt-4 cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                        >
                          Try again
                        </button>
                      </td>
                    </tr>
                  ) : punchGroups.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center">
                        <Coffee className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                        <p className="font-semibold text-slate-700">
                          No clock punches found
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {isAnyFilterActive
                            ? "No records match the selected filters. Try widening the date range or status filters."
                            : "Employee attendance will appear here after the first punch is recorded."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    punchGroups.map((group) => (
                      <tr
                        key={`${group.date}-${group.employee_id}`}
                        onClick={() => openGroup(group)}
                        title={
                          group.reference_punch_id
                            ? undefined
                            : "This day has no active clock in to open"
                        }
                        className={`transition-colors hover:bg-slate-50 ${
                          group.reference_punch_id ? "cursor-pointer" : ""
                        }`}
                      >
                        <td className="whitespace-nowrap px-4 py-3">
                          <p className="text-sm font-semibold text-slate-800">
                            {formatGroupDate(group.date)}
                          </p>
                          <p className="text-xs text-slate-500">{group.date}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                              <UserRound className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="whitespace-nowrap text-sm font-medium text-slate-700">
                                {employeeName(group)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {group.employee_id}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-700">
                          {Number(group.hours || 0).toFixed(2)} hours
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              breakStyles[group.break_status] ||
                              breakStyles.NO_BREAK
                            }`}
                          >
                            {formatLabel(group.break_status)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {canReview ? (
                            <ReviewStatusDropdown
                              group={group}
                              isOpen={
                                openStatusDropdownId ===
                                `${group.date}-${group.employee_id}`
                              }
                              onOpenChange={(isOpen) =>
                                setOpenStatusDropdownId(
                                  isOpen
                                    ? `${group.date}-${group.employee_id}`
                                    : null,
                                )
                              }
                              isUpdating={
                                updatingStatusId ===
                                `${group.date}-${group.employee_id}`
                              }
                              onSelect={(status) =>
                                handleGroupReviewStatusChange(group, status)
                              }
                            />
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                reviewStyles[group.review_status] ||
                                reviewStyles.PENDING
                              }`}
                            >
                              {group.review_status === "APPROVED" && (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              {formatLabel(group.review_status)}
                            </span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${
                              workingStyles[group.working_status] ||
                              workingStyles.NOT_WORKING
                            }`}
                          >
                            {formatLabel(group.working_status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!loading && !error && pagination.total_dates > 0 && (
              <PaginationFooter
                totalItems={pagination.total_dates}
                itemsPerPage={datesPerPage}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setDatesPerPage}
                itemsPerPageOptions={[10, 25, 50]}
                showItemsPerPage={true}
              />
            )}
          </div>
        </div>
      </main>
    </AdminShell>
  );
}
