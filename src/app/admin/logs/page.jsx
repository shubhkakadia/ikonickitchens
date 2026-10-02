"use client";
import AdminShell from "@/components/AdminShell";
import PaginationFooter from "@/components/PaginationFooter";
import {
  ArrowUpDown,
  Funnel,
  Search,
  Sheet,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  RotateCcw,
  AlertTriangle,
  Calendar,
  FileText,
} from "lucide-react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import "react-toastify/dist/ReactToastify.css";
import { useEffect, useMemo, useState } from "react";
import { useExcelExport } from "@/hooks/useExcelExport";
import SearchBar from "@/components/SearchBar";
import {
  usePersistedTableFilter,
  useTableFilterActions,
} from "@/hooks/usePersistedTableFilter";
import {
  ACTION_COLORS,
  BADGE,
  BADGE_TONES,
  BUTTON_COUNT_BADGE,
  formatTimeAgo,
} from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";

const TABLE_KEY = "logs";
const EMPTY = "—";
const TABLE_COLUMNS = 6;
const SESSION_ERROR = "Your session has expired. Sign in again to continue.";
const LOAD_ERROR = "Couldn't load logs. Check your connection and try again.";

// Fields the list can be sorted by. Used by both the "Sort by" menu and the
// column headers so the two never drift apart.
const SORT_OPTIONS = [
  { field: "createdAt", label: "Date and time" },
  { field: "entity_type", label: "Entity type" },
  { field: "action", label: "Action" },
];

// Column names for the Excel export. Changing these changes the exported file.
const AVAILABLE_COLUMNS = [
  "Date/Time",
  "Entity Type",
  "Action",
  "Description",
  "Entity ID",
  "Username",
  "ID",
];

// Button, field, menu and table recipes from DESIGN.md 9.1 / 9.2 / 9.5 / 9.8.
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY_COMPACT =
  "cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const INPUT =
  "w-full text-sm text-slate-800 px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent";
const LABEL = "block text-sm font-medium text-slate-700 mb-1.5";
const MENU_ITEM =
  "cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between gap-2";
const MENU_CHECK_ROW =
  "cursor-pointer flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors";
const CHECKBOX =
  "h-4 w-4 shrink-0 accent-primary border-slate-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const TH =
  "px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider";

// Excel export cell value. The exported file keeps this exact format, so it
// is deliberately separate from the on-screen formatter below.
const formatDateTime = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);

  // Get day, month, year
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  // Get hours, minutes, seconds
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";

  // Convert to 12-hour format
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const formattedHours = String(hours).padStart(2, "0");

  return `${day}/${month}/${year}, ${formattedHours}:${minutes}:${seconds} ${ampm}`;
};

// Log timestamps need the year to be unambiguous, so this stays local rather
// than using the compact shared formatDate.
const formatLogTimestamp = (value) => {
  if (!value) return EMPTY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY;
  return date.toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
};

function Spinner({ className = "w-4 h-4" }) {
  return (
    <span
      className={`${className} border-2 border-slate-200 border-t-primary rounded-full animate-spin`}
      aria-hidden="true"
    />
  );
}

// Sortable column header. The label is a real button so the sort is reachable
// by keyboard (DESIGN.md 13.7); the active column carries the only indicator.
function SortHeader({ field, label, sortField, sortOrder, onSort }) {
  const isActive = sortField === field;
  const ariaSort = isActive
    ? sortOrder === "asc"
      ? "ascending"
      : "descending"
    : undefined;
  const Icon = !isActive
    ? ArrowUpDown
    : sortOrder === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <th scope="col" aria-sort={ariaSort} className={`${TH} text-left`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className="cursor-pointer flex items-center gap-2 uppercase tracking-wider hover:text-slate-700 transition-colors duration-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {label}
        <Icon
          className={`w-4 h-4 ${isActive ? "text-primary" : "text-slate-400"}`}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = usePersistedTableFilter(TABLE_KEY, "search", "");
  const [sortField, setSortField] = usePersistedTableFilter(
    TABLE_KEY,
    "sortField",
    "createdAt",
  );
  const [sortOrder, setSortOrder] = usePersistedTableFilter(
    TABLE_KEY,
    "sortOrder",
    "desc",
  );
  const { resetFilters } = useTableFilterActions(TABLE_KEY);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  // Which toolbar menu is open: "dates", "entity", "action", "sort" or
  // "columns". One value, so opening a menu closes the others.
  const [openMenu, setOpenMenu] = useState(null);

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
  const { getToken } = useAuth();

  // Initialize selected columns with all columns
  const [selectedColumns, setSelectedColumns] = useState([
    ...AVAILABLE_COLUMNS,
  ]);

  // Close the open menu when clicking outside any menu container or pressing
  // Escape.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) {
        setOpenMenu(null);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpenMenu(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Column mapping for Excel export
  const columnMap = useMemo(
    () => ({
      "Date/Time": (log) =>
        log.createdAt ? formatDateTime(log.createdAt) : "",
      "Entity Type": (log) => log.entity_type || "",
      Action: (log) => log.action || "",
      Description: (log) => log.description || "",
      "Entity ID": (log) => log.entity_id || "",
      Username: (log) => log.user?.username || "",
      ID: (log) => log.id || "",
    }),
    [],
  );

  // Initialize Excel export hook
  const { exportToExcel, isExporting } = useExcelExport({
    columnMap,
    filenamePrefix: "logs_export",
    sheetName: "Logs",
    selectedColumns,
  });

  const handleExportToExcel = () => {
    exportToExcel(filteredAndSortedLogs);
  };

  // Get distinct entity types from logs data
  const distinctEntityTypes = useMemo(() => {
    const types = [
      ...new Set(logs.map((log) => log.entity_type).filter((type) => type)),
    ];
    return types.sort();
  }, [logs]);

  // Get distinct actions from logs data
  const distinctActions = useMemo(() => {
    const actions = [
      ...new Set(logs.map((log) => log.action).filter((action) => action)),
    ];
    return actions.sort();
  }, [logs]);

  const [selectedEntityTypes, setSelectedEntityTypes] = usePersistedTableFilter(
    TABLE_KEY,
    "selectedEntityTypes",
    distinctEntityTypes,
  );
  const [selectedActions, setSelectedActions] = usePersistedTableFilter(
    TABLE_KEY,
    "selectedActions",
    distinctActions,
  );

  // Filter and sort logs
  const filteredAndSortedLogs = useMemo(() => {
    let filtered = logs.filter((log) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          (log.entity_type &&
            log.entity_type.toLowerCase().includes(searchLower)) ||
          (log.action && log.action.toLowerCase().includes(searchLower)) ||
          (log.description &&
            log.description.toLowerCase().includes(searchLower)) ||
          (log.entity_id &&
            log.entity_id.toLowerCase().includes(searchLower)) ||
          (log.user?.username &&
            log.user.username.toLowerCase().includes(searchLower)) ||
          (log.id && log.id.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // Date filter
      if (startDate || endDate) {
        if (!log.createdAt) return false;
        const logDate = new Date(log.createdAt);
        logDate.setHours(0, 0, 0, 0); // Reset time to start of day for comparison

        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (logDate < start) return false;
        }

        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999); // Set to end of day
          if (logDate > end) return false;
        }
      }

      // Empty selections show all values, matching the Employees table while
      // filter options are initialized from the loaded data.
      if (
        selectedEntityTypes.length > 0 &&
        !selectedEntityTypes.includes(log.entity_type)
      ) {
        return false;
      }

      // Action filter
      if (selectedActions.length > 0 && !selectedActions.includes(log.action)) {
        return false;
      }

      return true;
    });

    // Sort logs
    filtered.sort((a, b) => {
      let aValue = a[sortField] || "";
      let bValue = b[sortField] || "";

      // Handle date sorting
      if (sortField === "createdAt") {
        const aDate = new Date(aValue);
        const bDate = new Date(bValue);
        if (sortOrder === "asc") {
          return aDate - bDate;
        } else {
          return bDate - aDate;
        }
      }

      // Convert to string for comparison
      aValue = aValue.toString().toLowerCase();
      bValue = bValue.toString().toLowerCase();

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    });

    return filtered;
  }, [
    logs,
    search,
    sortField,
    sortOrder,
    selectedEntityTypes,
    selectedActions,
    startDate,
    endDate,
  ]);

  // Pagination logic
  const totalItems = filteredAndSortedLogs.length;
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedLogs = filteredAndSortedLogs.slice(startIndex, endIndex);

  // Reset to the first page whenever the displayed log set changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [search, startDate, endDate, selectedEntityTypes, selectedActions]);

  // Clicking the active column toggles asc/desc (DESIGN.md 15.4).
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder(field === "createdAt" ? "desc" : "asc");
    }
    setOpenMenu(null);
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const toggleMenu = (name) => {
    setOpenMenu((prev) => (prev === name ? null : name));
  };

  const handleEntityTypeToggle = (type) => {
    if (type === "Select All") {
      if (selectedEntityTypes.length === distinctEntityTypes.length) {
        setSelectedEntityTypes([]);
      } else {
        setSelectedEntityTypes([...distinctEntityTypes]);
      }
    } else {
      setSelectedEntityTypes((prev) =>
        prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
      );
    }
  };

  const handleActionToggle = (action) => {
    if (action === "Select All") {
      if (selectedActions.length === distinctActions.length) {
        setSelectedActions([]);
      } else {
        setSelectedActions([...distinctActions]);
      }
    } else {
      setSelectedActions((prev) =>
        prev.includes(action)
          ? prev.filter((a) => a !== action)
          : [...prev, action],
      );
    }
  };

  const handleReset = () => {
    resetFilters();
    setCurrentPage(1);
  };

  const handleColumnToggle = (column) => {
    if (column === "Select All") {
      if (selectedColumns.length === AVAILABLE_COLUMNS.length) {
        // If all columns are selected, unselect all
        setSelectedColumns([]);
      } else {
        // If not all columns are selected, select all
        setSelectedColumns([...AVAILABLE_COLUMNS]);
      }
    } else {
      setSelectedColumns((prev) =>
        prev.includes(column)
          ? prev.filter((c) => c !== column)
          : [...prev, column],
      );
    }
  };

  // Filters that narrow the list (sort does not hide records), used to tell
  // "no records" apart from "no results for this filter" (DESIGN.md 15.4).
  const isNarrowingFilterActive =
    search !== "" ||
    startDate !== "" ||
    endDate !== "" ||
    selectedEntityTypes.length !== distinctEntityTypes.length ||
    selectedActions.length !== distinctActions.length;

  const isAnyFilterActive =
    isNarrowingFilterActive ||
    sortField !== "createdAt" ||
    sortOrder !== "desc";

  // Only the active field shows a sort indicator (DESIGN.md 15.4).
  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    if (sortOrder === "asc")
      return <ArrowUp className="h-4 w-4 text-primary" aria-hidden="true" />;
    return <ArrowDown className="h-4 w-4 text-primary" aria-hidden="true" />;
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError("");
      const sessionToken = getToken();

      if (!sessionToken) {
        setError(SESSION_ERROR);
        return;
      }
      let config = {
        method: "get",
        maxBodyLength: Infinity,
        url: "/api/v1/logs",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          ...{},
        },
        data: {},
      };

      const response = await axios.request(config);
      if (response.data.status) {
        setLogs(response.data.data);
      } else {
        setError(response.data.message || LOAD_ERROR);
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      setError(error.response?.data?.message || LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const exportDisabled =
    isExporting ||
    filteredAndSortedLogs.length === 0 ||
    selectedColumns.length === 0;
  const columnPickerDisabled =
    isExporting || filteredAndSortedLogs.length === 0;

  const showInitialLoading = loading && logs.length === 0;
  const showLoadError = !!error && !loading && logs.length === 0;

  return (
    <AdminShell>
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="px-4 py-2 shrink-0">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-slate-800">
              Activity logs
            </h1>
            <SearchBar />
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
          <div className="bg-white rounded-lg border border-slate-200 flex flex-col h-full overflow-hidden">
            {/* Fixed header section */}
            <div className="p-4 shrink-0 border-b border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Search */}
                <div className="flex items-center gap-2 flex-1 min-w-64 max-w-2xl relative">
                  <Search
                    className="h-4 w-4 absolute left-3 text-slate-400 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    aria-label="Search logs"
                    placeholder="Search by description, entity type, action, entity ID or username"
                    className="w-full text-sm text-slate-800 py-2 pr-3 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Reset, filters, sort, export */}
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

                  {/* Date filter */}
                  <div className="relative dropdown-container">
                    <button
                      type="button"
                      onClick={() => toggleMenu("dates")}
                      aria-haspopup="true"
                      aria-expanded={openMenu === "dates"}
                      className={BTN_SECONDARY}
                    >
                      <Calendar className="h-4 w-4" aria-hidden="true" />
                      <span>Filter by dates</span>
                      {(startDate || endDate) && (
                        <span className={BUTTON_COUNT_BADGE}>Active</span>
                      )}
                    </button>
                    {openMenu === "dates" && (
                      <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-300 rounded-lg z-40 p-4">
                        <div className="space-y-4">
                          <div>
                            <label htmlFor="logs-start-date" className={LABEL}>
                              Start date
                            </label>
                            <input
                              id="logs-start-date"
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              max={endDate || undefined}
                              className={INPUT}
                            />
                          </div>
                          <div>
                            <label htmlFor="logs-end-date" className={LABEL}>
                              End date
                            </label>
                            <input
                              id="logs-end-date"
                              type="date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
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

                  {/* Entity type filter */}
                  <div className="relative dropdown-container">
                    <button
                      type="button"
                      onClick={() => toggleMenu("entity")}
                      aria-haspopup="true"
                      aria-expanded={openMenu === "entity"}
                      className={BTN_SECONDARY}
                    >
                      <Funnel className="h-4 w-4" aria-hidden="true" />
                      <span>Entity type</span>
                      {distinctEntityTypes.length - selectedEntityTypes.length >
                        0 && (
                        <span className={BUTTON_COUNT_BADGE}>
                          {distinctEntityTypes.length -
                            selectedEntityTypes.length}
                        </span>
                      )}
                    </button>
                    {openMenu === "entity" && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg z-40 max-h-96 overflow-y-auto">
                        <div className="py-1">
                          <label
                            className={`${MENU_CHECK_ROW} sticky top-0 bg-white border-b border-slate-200`}
                          >
                            <span className="font-medium">Select all</span>
                            <input
                              type="checkbox"
                              checked={
                                selectedEntityTypes.length ===
                                distinctEntityTypes.length
                              }
                              onChange={() =>
                                handleEntityTypeToggle("Select All")
                              }
                              className={CHECKBOX}
                            />
                          </label>
                          {distinctEntityTypes.length === 0 && (
                            <p className="px-4 py-2.5 text-sm text-slate-500">
                              No entity types yet
                            </p>
                          )}
                          {distinctEntityTypes.map((type) => (
                            <label key={type} className={MENU_CHECK_ROW}>
                              <span className="truncate" title={type}>
                                {formatLabel(type)}
                              </span>
                              <input
                                type="checkbox"
                                checked={selectedEntityTypes.includes(type)}
                                onChange={() => handleEntityTypeToggle(type)}
                                className={CHECKBOX}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action filter */}
                  <div className="relative dropdown-container">
                    <button
                      type="button"
                      onClick={() => toggleMenu("action")}
                      aria-haspopup="true"
                      aria-expanded={openMenu === "action"}
                      className={BTN_SECONDARY}
                    >
                      <Funnel className="h-4 w-4" aria-hidden="true" />
                      <span>Action</span>
                      {distinctActions.length - selectedActions.length > 0 && (
                        <span className={BUTTON_COUNT_BADGE}>
                          {distinctActions.length - selectedActions.length}
                        </span>
                      )}
                    </button>
                    {openMenu === "action" && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg z-40 max-h-96 overflow-y-auto">
                        <div className="py-1">
                          <label
                            className={`${MENU_CHECK_ROW} sticky top-0 bg-white border-b border-slate-200`}
                          >
                            <span className="font-medium">Select all</span>
                            <input
                              type="checkbox"
                              checked={
                                selectedActions.length ===
                                distinctActions.length
                              }
                              onChange={() => handleActionToggle("Select All")}
                              className={CHECKBOX}
                            />
                          </label>
                          {distinctActions.length === 0 && (
                            <p className="px-4 py-2.5 text-sm text-slate-500">
                              No actions yet
                            </p>
                          )}
                          {distinctActions.map((action) => (
                            <label key={action} className={MENU_CHECK_ROW}>
                              <span className="truncate" title={action}>
                                {formatLabel(action)}
                              </span>
                              <input
                                type="checkbox"
                                checked={selectedActions.includes(action)}
                                onChange={() => handleActionToggle(action)}
                                className={CHECKBOX}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sort */}
                  <div className="relative dropdown-container">
                    <button
                      type="button"
                      onClick={() => toggleMenu("sort")}
                      aria-haspopup="true"
                      aria-expanded={openMenu === "sort"}
                      className={BTN_SECONDARY}
                    >
                      <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                      <span>Sort by</span>
                    </button>
                    {openMenu === "sort" && (
                      <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-300 rounded-lg z-40">
                        <div className="py-1">
                          {SORT_OPTIONS.map(({ field, label }) => (
                            <button
                              type="button"
                              key={field}
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

                  {/* Export */}
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
                      onClick={() => toggleMenu("columns")}
                      disabled={columnPickerDisabled}
                      aria-label="Choose columns to export"
                      aria-haspopup="true"
                      aria-expanded={openMenu === "columns"}
                      className="cursor-pointer flex items-center px-2 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-r-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {openMenu === "columns" && (
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
                                AVAILABLE_COLUMNS.length
                              }
                              onChange={() => handleColumnToggle("Select All")}
                              className={CHECKBOX}
                            />
                          </label>
                          {AVAILABLE_COLUMNS.map((column) => (
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

            {/* Scrollable table section */}
            <div className="flex-1 overflow-auto">
              <div className="min-w-full">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      {SORT_OPTIONS.map(({ field, label }) => (
                        <SortHeader
                          key={field}
                          field={field}
                          label={label}
                          sortField={sortField}
                          sortOrder={sortOrder}
                          onSort={handleSort}
                        />
                      ))}
                      <th scope="col" className={`${TH} text-left`}>
                        Description
                      </th>
                      <th scope="col" className={`${TH} text-left`}>
                        Entity ID
                      </th>
                      <th scope="col" className={`${TH} text-left`}>
                        Username
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {showInitialLoading ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={TABLE_COLUMNS}
                        >
                          <div
                            className="flex flex-col items-center gap-2"
                            role="status"
                          >
                            <Spinner className="w-6 h-6" />
                            <p className="text-sm text-slate-600">
                              Loading logs…
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : showLoadError ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={TABLE_COLUMNS}
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
                              onClick={fetchLogs}
                              className={BTN_SECONDARY_COMPACT}
                            >
                              Try again
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : paginatedLogs.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={TABLE_COLUMNS}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <FileText
                              className="w-8 h-8 text-slate-300"
                              aria-hidden="true"
                            />
                            {logs.length > 0 && isNarrowingFilterActive ? (
                              <>
                                <p className="text-sm text-slate-600">
                                  No logs match your filters
                                </p>
                                <button
                                  type="button"
                                  onClick={handleReset}
                                  className={BTN_SECONDARY_COMPACT}
                                >
                                  <RotateCcw
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Clear filters
                                </button>
                              </>
                            ) : (
                              <p className="text-sm text-slate-600">
                                No activity logged yet
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedLogs.map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-slate-50 transition-colors duration-200"
                        >
                          <td className="px-4 py-3 text-sm font-mono text-slate-700 whitespace-nowrap">
                            {log.createdAt ? (
                              <time
                                dateTime={log.createdAt}
                                title={formatTimeAgo(log.createdAt)}
                              >
                                {formatLogTimestamp(log.createdAt)}
                              </time>
                            ) : (
                              EMPTY
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                            {log.entity_type
                              ? formatLabel(log.entity_type)
                              : EMPTY}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {log.action ? (
                              <span
                                className={`${BADGE} ${
                                  ACTION_COLORS[log.action] ||
                                  BADGE_TONES.neutral
                                }`}
                              >
                                {formatLabel(log.action)}
                              </span>
                            ) : (
                              <span className="text-slate-500">{EMPTY}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            <div
                              className="max-w-md truncate"
                              title={log.description || undefined}
                            >
                              {log.description || EMPTY}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-slate-600">
                            <div
                              className="max-w-xs truncate"
                              title={log.entity_id || undefined}
                            >
                              {log.entity_id || EMPTY}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                            {log.user?.username || EMPTY}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fixed pagination footer */}
            {!showInitialLoading &&
              !showLoadError &&
              paginatedLogs.length > 0 && (
                <PaginationFooter
                  totalItems={totalItems}
                  itemsPerPage={itemsPerPage}
                  currentPage={currentPage}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                  itemsPerPageOptions={[100, 250, 500, 0]}
                  showItemsPerPage={true}
                />
              )}
          </div>
        </div>
      </main>
    </AdminShell>
  );
}
