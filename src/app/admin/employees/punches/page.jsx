"use client";

import axios from "axios";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Funnel,
  Plus,
  RotateCcw,
  Search,
  Sheet,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import AdminShell from "@/components/AdminShell";
import PaginationFooter from "@/components/PaginationFooter";
import SearchBar from "@/components/SearchBar";
import { BUTTON_COUNT_BADGE } from "@/app/admin/dashboard/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { useExcelExport } from "@/hooks/useExcelExport";
import {
  usePersistedTableFilter,
  useTableFilterActions,
} from "@/hooks/usePersistedTableFilter";
import {
  BADGE,
  breakStyles,
  formatLabel,
  reviewStyles,
  workingStyles,
} from "./lib/punchStyles";

const DEFAULT_DATES_PER_PAGE = 10;
const TABLE_KEY = "clock_punches";
const CLOCK_PUNCH_TIME_ZONE = "Australia/Adelaide";

const TABLE_COLUMNS = 6;

// Fields the list can be sorted by. Used by both the "Sort by" menu and the
// column headers so the two never drift apart.
const SORT_OPTIONS = [
  { field: "date", label: "Date" },
  { field: "employee", label: "Employee" },
  { field: "hours", label: "Working hours" },
];

const MENU_ITEM =
  "cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between";
const MENU_CHECK_ROW =
  "cursor-pointer flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors";
const CHECKBOX =
  "h-4 w-4 accent-primary border-slate-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const INPUT =
  "w-full text-sm text-slate-800 px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent";

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

const punchTimeFormatter = new Intl.DateTimeFormat("en-AU", {
  timeZone: CLOCK_PUNCH_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

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

// Sortable column header. The label is a real button so the sort is reachable
// by keyboard (DESIGN.md 13.7); the active column carries the only indicator.
function SortHeader({
  field,
  label,
  sortField,
  sortOrder,
  onSort,
  icon,
  alignRight = false,
}) {
  const isActive = sortField === field;
  const ariaSort = isActive
    ? sortOrder === "asc"
      ? "ascending"
      : "descending"
    : undefined;

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`px-4 py-2 text-xs font-medium uppercase tracking-wider text-slate-500 ${
        alignRight ? "text-right" : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`flex cursor-pointer items-center gap-2 rounded-sm uppercase tracking-wider transition-colors duration-200 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary ${
          alignRight ? "ml-auto" : ""
        }`}
      >
        {label}
        {icon}
      </button>
    </th>
  );
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
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={BTN_SECONDARY}
      >
        <Funnel className="h-4 w-4" aria-hidden="true" />
        <span>{label}</span>
        {hiddenCount > 0 && (
          <span className={BUTTON_COUNT_BADGE}>{hiddenCount}</span>
        )}
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-60 bg-white border border-slate-300 rounded-lg z-40 max-h-96 overflow-y-auto">
          <div className="py-1">
            <label
              className={`${MENU_CHECK_ROW} sticky top-0 bg-white border-b border-slate-200`}
            >
              <span className="font-medium">Select all</span>
              <input
                type="checkbox"
                checked={selected.length === options.length}
                onChange={() => onToggle("Select All")}
                className={CHECKBOX}
              />
            </label>
            {options.map((option) => (
              <label key={option} className={MENU_CHECK_ROW}>
                <span>{formatLabel(option)}</span>
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => onToggle(option)}
                  className={CHECKBOX}
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
  const reviewLabel = group.review_status
    ? formatLabel(group.review_status)
    : "—";

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
          aria-haspopup="true"
          aria-expanded={isOpen}
          aria-label={`Review status: ${reviewLabel}. Change review status`}
          className={`${BADGE} transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
            reviewStyles[group.review_status] || reviewStyles.PENDING
          } ${isUpdating ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:opacity-80"}`}
        >
          {group.review_status === "APPROVED" && (
            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
          )}
          <span>{reviewLabel}</span>
          <ChevronDown
            aria-hidden="true"
            className={`h-3 w-3 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 z-40 mt-1 w-44 rounded-lg border border-slate-300 bg-white">
            <div className="py-1">
              {REVIEW_STATUS_ACTIONS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    if (group.review_status !== status) onSelect(status);
                    onOpenChange(false);
                  }}
                  aria-current={
                    group.review_status === status ? "true" : undefined
                  }
                  className={MENU_ITEM}
                >
                  <span>{formatLabel(status)}</span>
                  {group.review_status === status && (
                    <Check
                      className="h-4 w-4 text-primary"
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isUpdating && (
        <span
          role="status"
          aria-label="Updating review status"
          className="h-3 w-3 animate-spin rounded-full border-2 border-slate-200 border-t-primary"
        />
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
  const [search, setSearch] = usePersistedTableFilter(TABLE_KEY, "search", "");
  const [sortField, setSortField] = usePersistedTableFilter(
    TABLE_KEY,
    "sortField",
    "date",
  );
  const [sortOrder, setSortOrder] = usePersistedTableFilter(
    TABLE_KEY,
    "sortOrder",
    "desc",
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
    Boolean(workingStatusParam) ||
    search !== "" ||
    sortField !== "date" ||
    sortOrder !== "desc";

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

  // Close dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    const closeAll = () => {
      setOpenDropdown(null);
      setOpenStatusDropdownId(null);
    };
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) closeAll();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeAll();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
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
          setError("Your session has expired. Sign in again.");
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
          setError(
            response.data.message ||
              "Couldn't load clock punches. Check your connection and try again.",
          );
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
            "Couldn't load clock punches. Check your connection and try again.",
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

  // The API paginates by date, so the search and sort below refine the dates
  // that are currently loaded rather than the whole result set.
  const punchGroups = useMemo(() => {
    const groups = dateGroups.flatMap(
      (dateGroup) => dateGroup.employee_groups || [],
    );

    const searchLower = search.trim().toLowerCase();
    const filtered = searchLower
      ? groups.filter((group) =>
          [
            employeeName(group),
            group.employee_id,
            group.employee?.role,
            group.date,
            formatGroupDate(group.date),
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(searchLower)),
        )
      : [...groups];

    const direction = sortOrder === "desc" ? -1 : 1;
    filtered.sort((a, b) => {
      if (sortField === "hours") {
        return (Number(a.hours || 0) - Number(b.hours || 0)) * direction;
      }

      const aValue =
        sortField === "employee"
          ? employeeName(a).toLowerCase()
          : String(a.date || "");
      const bValue =
        sortField === "employee"
          ? employeeName(b).toLowerCase()
          : String(b.date || "");

      if (aValue === bValue) return 0;
      return (aValue < bValue ? -1 : 1) * direction;
    });

    return filtered;
  }, [dateGroups, search, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setOpenDropdown(null);
  };

  // Only the active column shows a sort indicator (DESIGN.md 15.4).
  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    if (sortOrder === "asc")
      return <ArrowUp className="h-4 w-4 text-primary" aria-hidden="true" />;
    return <ArrowDown className="h-4 w-4 text-primary" aria-hidden="true" />;
  };

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
          toast.error(
            response.data.message || "Couldn't update the punches. Try again.",
          );
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
          "Couldn't update the punches. Check your connection and try again.",
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
      toast.error("Your session has expired. Sign in again.", {
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
          response.data.message ||
            "Couldn't load clock punches for export. Try again.",
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
          "Couldn't export clock punches. Check your connection and try again.",
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

  const goToAddPunch = () => router.push("/admin/employees/punches/add");

  // Filters that narrow the list (sort does not hide records), used to tell
  // "no records" apart from "no results for this filter" (DESIGN.md 15.4).
  const isNarrowingFilterActive =
    search !== "" ||
    Boolean(startDate) ||
    Boolean(endDate) ||
    Boolean(breakStatusParam) ||
    Boolean(reviewStatusParam) ||
    Boolean(workingStatusParam);

  return (
    <AdminShell>
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="px-4 py-2 shrink-0">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-slate-800">
              Clock punches
            </h1>
            <div className="flex items-center gap-2">
              <SearchBar />
              <button
                type="button"
                onClick={goToAddPunch}
                className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add punch
              </button>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4">
          <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="p-4 shrink-0 border-b border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* search bar */}
                <div className="flex items-center gap-2 flex-1 min-w-64 max-w-2xl relative">
                  <Search
                    className="h-4 w-4 absolute left-3 text-slate-400 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    aria-label="Search clock punches"
                    placeholder="Search by employee, employee ID, role or date"
                    className="w-full text-sm text-slate-800 py-2 pr-3 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                {/* reset, filters, sort by, export to excel */}
                <div className="flex flex-wrap items-center gap-2">
                  {isAnyFilterActive && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className={BTN_SECONDARY}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      <span>Reset</span>
                    </button>
                  )}

                  <div className="relative dropdown-container">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDropdown(
                          openDropdown === "dates" ? null : "dates",
                        )
                      }
                      aria-haspopup="true"
                      aria-expanded={openDropdown === "dates"}
                      className={BTN_SECONDARY}
                    >
                      <Calendar className="h-4 w-4" aria-hidden="true" />
                      <span>Filter by dates</span>
                      {(startDate || endDate) && (
                        <span className={BUTTON_COUNT_BADGE}>Active</span>
                      )}
                    </button>
                    {openDropdown === "dates" && (
                      <div className="absolute top-full right-0 mt-1 w-72 bg-white border border-slate-300 rounded-lg z-40 p-4">
                        <div className="space-y-4">
                          <div>
                            <label
                              htmlFor="punch-start-date"
                              className="block text-sm font-medium text-slate-700 mb-1.5"
                            >
                              Start date
                            </label>
                            <input
                              id="punch-start-date"
                              type="date"
                              value={startDate}
                              onChange={(event) =>
                                setStartDate(event.target.value)
                              }
                              max={endDate || undefined}
                              className={INPUT}
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="punch-end-date"
                              className="block text-sm font-medium text-slate-700 mb-1.5"
                            >
                              End date
                            </label>
                            <input
                              id="punch-end-date"
                              type="date"
                              value={endDate}
                              onChange={(event) =>
                                setEndDate(event.target.value)
                              }
                              min={startDate || undefined}
                              className={INPUT}
                            />
                          </div>
                          {(startDate || endDate) && (
                            <button
                              type="button"
                              onClick={() => {
                                setStartDate("");
                                setEndDate("");
                              }}
                              className="w-full cursor-pointer text-sm font-medium text-slate-600 hover:bg-slate-100 px-3 py-2 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              Clear dates
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <StatusFilterDropdown
                    label="Break status"
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
                    label="Review status"
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
                    label="Working status"
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

                  <div className="relative dropdown-container">
                    <button
                      type="button"
                      onClick={() =>
                        setOpenDropdown(openDropdown === "sort" ? null : "sort")
                      }
                      aria-haspopup="true"
                      aria-expanded={openDropdown === "sort"}
                      className={BTN_SECONDARY}
                    >
                      <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                      <span>Sort by</span>
                    </button>
                    {openDropdown === "sort" && (
                      <div className="absolute top-full right-0 mt-1 w-52 bg-white border border-slate-300 rounded-lg z-40">
                        <div className="py-1">
                          {SORT_OPTIONS.map(({ field, label }) => (
                            <button
                              key={field}
                              type="button"
                              onClick={() => handleSort(field)}
                              className={MENU_ITEM}
                            >
                              {label} {getSortIcon(field)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative dropdown-container flex items-stretch">
                    <button
                      type="button"
                      onClick={handleExportToExcel}
                      disabled={exportDisabled}
                      className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 border-r-0 hover:bg-slate-100 rounded-l-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sheet className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {isExporting || isPreparingExport
                          ? "Exporting…"
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
                      aria-label="Choose columns to export"
                      aria-haspopup="true"
                      aria-expanded={openDropdown === "columns"}
                      className="cursor-pointer flex items-center px-2 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-r-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {openDropdown === "columns" && (
                      <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg z-40 max-h-96 overflow-y-auto">
                        <div className="py-1">
                          <label
                            className={`${MENU_CHECK_ROW} sticky top-0 bg-white border-b border-slate-200`}
                          >
                            <span className="font-medium">Select all</span>
                            <input
                              type="checkbox"
                              checked={
                                selectedColumns.length === EXPORT_COLUMNS.length
                              }
                              onChange={() => handleColumnToggle("Select All")}
                              className={CHECKBOX}
                            />
                          </label>
                          {EXPORT_COLUMNS.map((column) => (
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

            <div className="min-h-0 flex-1 overflow-auto">
              <div className="min-w-full">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr>
                      <SortHeader
                        field="date"
                        label="Date"
                        sortField={sortField}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        icon={getSortIcon("date")}
                      />
                      <SortHeader
                        field="employee"
                        label="Employee"
                        sortField={sortField}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        icon={getSortIcon("employee")}
                      />
                      <SortHeader
                        field="hours"
                        label="Working hours"
                        sortField={sortField}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        icon={getSortIcon("hours")}
                        alignRight
                      />
                      <th
                        scope="col"
                        className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                      >
                        Break status
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                      >
                        Review status
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500"
                      >
                        Working status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {loading ? (
                      <tr>
                        <td
                          colSpan={TABLE_COLUMNS}
                          className="px-4 py-12 text-center"
                        >
                          <div
                            className="flex flex-col items-center gap-2"
                            role="status"
                          >
                            <span
                              className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin"
                              aria-hidden="true"
                            />
                            <p className="text-sm text-slate-600">
                              Loading clock punches…
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td
                          colSpan={TABLE_COLUMNS}
                          className="px-4 py-12 text-center"
                        >
                          <div
                            className="flex flex-col items-center gap-2"
                            role="alert"
                          >
                            <AlertTriangle
                              className="w-8 h-8 text-red-500"
                              aria-hidden="true"
                            />
                            <p className="text-sm text-red-600">{error}</p>
                            <button
                              type="button"
                              onClick={() =>
                                setRefreshKey((value) => value + 1)
                              }
                              className={`${BTN_SECONDARY} py-1.5`}
                            >
                              Try again
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : punchGroups.length === 0 ? (
                      <tr>
                        <td
                          colSpan={TABLE_COLUMNS}
                          className="px-4 py-12 text-center"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Clock
                              className="w-8 h-8 text-slate-300"
                              aria-hidden="true"
                            />
                            {isNarrowingFilterActive ? (
                              <>
                                <p className="text-sm text-slate-600">
                                  {search
                                    ? "No clock punches match your search on the loaded dates"
                                    : "No clock punches match your filters"}
                                </p>
                                <button
                                  type="button"
                                  onClick={handleReset}
                                  className={`${BTN_SECONDARY} py-1.5`}
                                >
                                  <RotateCcw
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Clear filters
                                </button>
                              </>
                            ) : (
                              <>
                                <p className="text-sm text-slate-600">
                                  No clock punches yet. Attendance appears here
                                  after the first punch is recorded.
                                </p>
                                <button
                                  type="button"
                                  onClick={goToAddPunch}
                                  className={`${BTN_SECONDARY} py-1.5`}
                                >
                                  <Plus
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Add punch
                                </button>
                              </>
                            )}
                          </div>
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
                          className={`transition-colors duration-200 hover:bg-slate-50 ${
                            group.reference_punch_id ? "cursor-pointer" : ""
                          }`}
                        >
                          <td className="whitespace-nowrap px-4 py-3">
                            <p className="text-sm font-semibold text-slate-800">
                              {group.reference_punch_id ? (
                                <Link
                                  href={`/admin/employees/punches/${group.reference_punch_id}`}
                                  onClick={(event) => event.stopPropagation()}
                                  className="rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                  {formatGroupDate(group.date)}
                                </Link>
                              ) : (
                                formatGroupDate(group.date)
                              )}
                            </p>
                            <p className="font-mono text-xs text-slate-500">
                              {group.date || "—"}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500"
                                aria-hidden="true"
                              >
                                <UserRound className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="whitespace-nowrap text-sm font-medium text-slate-700">
                                  {employeeName(group)}
                                </p>
                                <p className="font-mono text-xs text-slate-500">
                                  {group.employee_id || "—"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-medium text-slate-700">
                            {Number(group.hours || 0).toFixed(2)} hours
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`${BADGE} ${
                                breakStyles[group.break_status] ||
                                breakStyles.NO_BREAK
                              }`}
                            >
                              {group.break_status
                                ? formatLabel(group.break_status)
                                : "—"}
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
                                className={`${BADGE} ${
                                  reviewStyles[group.review_status] ||
                                  reviewStyles.PENDING
                                }`}
                              >
                                {group.review_status === "APPROVED" && (
                                  <CheckCircle2
                                    className="w-3 h-3"
                                    aria-hidden="true"
                                  />
                                )}
                                {group.review_status
                                  ? formatLabel(group.review_status)
                                  : "—"}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span
                              className={`${BADGE} ${
                                workingStyles[group.working_status] ||
                                workingStyles.NOT_WORKING
                              }`}
                            >
                              {group.working_status
                                ? formatLabel(group.working_status)
                                : "—"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
