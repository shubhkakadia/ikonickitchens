"use client";
import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  Plus,
  Search,
  RotateCcw,
  Funnel,
  ArrowUpDown,
  Sheet,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  AlertTriangle,
  Building2,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import PaginationFooter from "@/components/PaginationFooter";
import "react-toastify/dist/ReactToastify.css";
import { useExcelExport } from "@/hooks/useExcelExport";
import SearchBar from "@/components/SearchBar";
import {
  usePersistedTableFilter,
  useTableFilterActions,
} from "@/hooks/usePersistedTableFilter";
import {
  BADGE,
  BADGE_TONES,
  BUTTON_COUNT_BADGE,
} from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";

const TABLE_KEY = "clients";
const TABLE_COLUMNS = 7;

// Fields the list can be sorted by. Used by both the "Sort by" menu and the
// column headers so the two never drift apart.
const SORT_OPTIONS = [
  { field: "client_name", label: "Client name" },
  { field: "client_type", label: "Client type" },
  { field: "client_email", label: "Client email" },
  { field: "active_projects", label: "Active projects" },
  { field: "completed_projects", label: "Completed projects" },
];

// Excel dates follow the Australian locale (DESIGN.md 15.7).
const exportDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-AU") : "";

const MENU_ITEM =
  "cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between";
const MENU_CHECK_ROW =
  "cursor-pointer flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors";
const CHECKBOX =
  "h-4 w-4 accent-primary border-slate-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const TH =
  "px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider";

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
      : sortOrder === "desc"
        ? "descending"
        : undefined
    : undefined;

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`${TH} ${alignRight ? "text-right" : ""}`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`cursor-pointer flex items-center gap-2 uppercase tracking-wider hover:text-slate-700 transition-colors duration-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary ${
          alignRight ? "ml-auto" : ""
        }`}
      >
        {label}
        {icon}
      </button>
    </th>
  );
}

export default function ClientsPage() {
  const router = useRouter();
  const { getToken } = useAuth();

  const [search, setSearch] = usePersistedTableFilter(TABLE_KEY, "search", "");
  const [sortField, setSortField] = usePersistedTableFilter(
    TABLE_KEY,
    "sortField",
    "client_name",
  );
  const [sortOrder, setSortOrder] = usePersistedTableFilter(
    TABLE_KEY,
    "sortOrder",
    "asc",
  );
  const { resetFilters } = useTableFilterActions(TABLE_KEY);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  // Data objects
  const [clients, setClients] = useState([]);
  const [distinctClientType, setDistinctClientType] = useState([]);
  const [selectedClientType, setSelectedClientType] = usePersistedTableFilter(
    TABLE_KEY,
    "selectedClientType",
    distinctClientType,
  );
  // UI states
  const [loading, setLoading] = useState(true);
  const [showClientTypeFilterDropdown, setShowClientTypeFilterDropdown] =
    useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Flags
  const [error, setError] = useState("");

  const availableColumns = [
    "Client ID",
    "Client Name",
    "Client Email",
    "Client Phone",
    "Client Type",
    "Number of Projects",
    "Client Address",
    "Client Website",
    "Client Notes",
    "Contact Name",
    "Contact Email",
    "Contact Phone",
    "Contact Notes",
    "Client Created At",
    "Client Updated At",
  ];

  const [selectedColumns, setSelectedColumns] = useState([...availableColumns]);

  // Clients have no image, so the avatar cell always falls back to initials.
  const clientInitials = (clientName) => {
    const words = String(clientName || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) return "—";
    return words
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join("");
  };

  // Helper functions used in memoized values
  const countActiveProjects = (client) => {
    if (!client.projects || client.projects.length === 0) return 0;
    return client.projects.filter((project) => {
      const lots = project.lots || [];
      if (lots.length === 0) return true; // Projects with no lots are considered active
      return lots.some((lot) => lot.status === "ACTIVE");
    }).length;
  };

  const countCompletedProjects = (client) => {
    if (!client.projects || client.projects.length === 0) return 0;
    return client.projects.filter((project) => {
      const lots = project.lots || [];
      return lots.some((lot) => lot.status === "COMPLETED");
    }).length;
  };

  // Filter and sort clients
  const filteredAndSortedClients = useMemo(() => {
    let filtered = clients.filter((client) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          (client.client_name &&
            client.client_name.toLowerCase().includes(searchLower)) ||
          (client.client_type &&
            client.client_type.toLowerCase().includes(searchLower)) ||
          (client.client_email &&
            client.client_email.toLowerCase().includes(searchLower)) ||
          (client.projects &&
            client.projects.length.toString().includes(searchLower)) ||
          (client.client_type &&
            client.client_type.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // Client type filter - no selection means every client type is visible.
      // This matches the Employees table and prevents an empty table while the
      // available client types are being loaded.
      if (selectedClientType.length > 0) {
        return selectedClientType.includes(client.client_type);
      }

      return true;
    });

    // Sort clients
    filtered.sort((a, b) => {
      let aValue = a[sortField] || "";
      let bValue = b[sortField] || "";

      // Handle projects sorting (by count)
      if (
        sortField === "number_of_projects" ||
        sortField === "active_projects"
      ) {
        aValue = countActiveProjects(a);
        bValue = countActiveProjects(b);
      } else if (sortField === "completed_projects") {
        aValue = countCompletedProjects(a);
        bValue = countCompletedProjects(b);
      }

      // Handle relevance sorting (by search match)
      if (sortOrder === "relevance" && search) {
        const searchLower = search.toLowerCase();
        const aMatch = aValue.toString().toLowerCase().includes(searchLower);
        const bMatch = bValue.toString().toLowerCase().includes(searchLower);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }

      // Convert to string for comparison (except for projects which is numeric)
      if (
        sortField !== "number_of_projects" &&
        sortField !== "active_projects" &&
        sortField !== "completed_projects"
      ) {
        aValue = aValue.toString().toLowerCase();
        bValue = bValue.toString().toLowerCase();
      }

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else if (sortOrder === "desc") {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
      return 0;
    });

    return filtered;
  }, [clients, search, sortField, sortOrder, selectedClientType]);

  // Data-fetching effects
  useEffect(() => {
    fetchClients();
  }, []);

  // Close dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    const closeAll = () => {
      setShowSortDropdown(false);
      setShowClientTypeFilterDropdown(false);
      setShowColumnDropdown(false);
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

  // UI-sync effects
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // Async functions (fetch/update API)
  const fetchClients = async () => {
    setLoading(true);
    setError("");
    try {
      // Get the session token when needed
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again.");
        setError("Your session has expired. Sign in again.");
        return;
      }
      let config = {
        method: "get",
        maxBodyLength: Infinity,
        url: "/api/v1/client/all",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          ...{},
        },
        data: {},
      };

      const response = await axios.request(config);
      if (response.data.status) {
        setClients(response.data.data);
        // Extract distinct client types
        const types = [
          ...new Set(
            response.data.data
              .map((client) => client.client_type)
              .filter(Boolean),
          ),
        ];
        setDistinctClientType(types);
      } else {
        setError(
          response.data.message ||
            "Couldn't load clients. Check your connection and try again.",
        );
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
      setError(
        error.response?.data?.message ||
          "Couldn't load clients. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Column mapping for Excel export
  const columnMap = useMemo(
    () => ({
      "Client ID": (client) => client.client_id || "",
      "Client Name": (client) => client.client_name || "",
      "Client Email": (client) => client.client_email || "",
      "Client Phone": (client) => client.client_phone || "",
      "Client Type": (client) => client.client_type || "",
      "Number of Projects": (client) =>
        client.projects ? client.projects.length : 0,
      "Client Address": (client) => client.client_address || "",
      "Client Website": (client) => client.client_website || "",
      "Client Notes": (client) => client.client_notes || "",
      "Contact Name": (client) => client.contacts[0]?.first_name || "",
      "Contact Email": (client) => client.contacts[0]?.email || "",
      "Contact Phone": (client) => client.contacts[0]?.phone || "",
      "Contact Notes": (client) => client.contacts[0]?.notes || "",
      "Client Created At": (client) => exportDate(client.createdAt),
      "Client Updated At": (client) => exportDate(client.updatedAt),
    }),
    [],
  );

  // Initialize Excel export hook
  const { exportToExcel, isExporting } = useExcelExport({
    columnMap,
    filenamePrefix: "clients_export",
    sheetName: "Clients",
    selectedColumns,
  });

  const handleExportToExcel = () => {
    exportToExcel(filteredAndSortedClients);
  };

  // Handlers (handleChange, handleSubmit)
  const handleSort = (field) => {
    if (sortField === field) {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else if (sortOrder === "desc" && search) {
        setSortOrder("relevance");
      } else {
        setSortOrder("asc");
      }
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setShowSortDropdown(false);
  };

  const handleClientTypeToggle = (clientType) => {
    if (clientType === "Select All") {
      if (selectedClientType.length === distinctClientType.length) {
        // If all client types are selected, unselect all (show no data)
        setSelectedClientType([]);
      } else {
        // If not all client types are selected, select all
        setSelectedClientType([...distinctClientType]);
      }
    } else {
      setSelectedClientType((prev) =>
        prev.includes(clientType)
          ? prev.filter((type) => type !== clientType)
          : [...prev, clientType],
      );
    }
  };

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

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleReset = () => {
    resetFilters();
    setCurrentPage(1);
  };

  // Local helpers (formatters, validators)
  const isAnyFilterActive = () => {
    return (
      search !== "" || // Search is not empty
      selectedClientType.length !== distinctClientType.length || // Client type filter is not showing all types
      sortField !== "client_name" || // Sort field is not default
      sortOrder !== "asc" // Sort order is not default
    );
  };

  // Filters that narrow the list (sort does not hide records), used to tell
  // "no records" apart from "no results for this filter" (DESIGN.md 15.4).
  const isNarrowingFilterActive =
    search !== "" ||
    (selectedClientType.length > 0 &&
      selectedClientType.length !== distinctClientType.length);

  // Only the active column shows a sort indicator (DESIGN.md 15.4).
  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    if (sortOrder === "asc")
      return <ArrowUp className="h-4 w-4 text-primary" aria-hidden="true" />;
    if (sortOrder === "desc")
      return <ArrowDown className="h-4 w-4 text-primary" aria-hidden="true" />;
    return null; // No icon for relevance
  };

  const goToAddClient = () => router.push("/admin/clients/addclient");

  const exportDisabled =
    isExporting ||
    filteredAndSortedClients.length === 0 ||
    selectedColumns.length === 0;
  const columnPickerDisabled =
    isExporting || filteredAndSortedClients.length === 0;

  // Pagination calculations
  const totalItems = filteredAndSortedClients.length;
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedClients = filteredAndSortedClients.slice(startIndex, endIndex);

  const sortHeaderProps = {
    sortField,
    sortOrder,
    onSort: handleSort,
  };

  return (
    <AdminShell>
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="px-4 py-2 shrink-0">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-slate-800">Clients</h1>
            <div className="flex items-center gap-2">
              <SearchBar />
              <button
                type="button"
                onClick={goToAddClient}
                className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add client
              </button>
            </div>
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
                    aria-label="Search clients"
                    placeholder="Search by name, client type or email"
                    className="w-full text-sm text-slate-800 py-2 pr-3 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Reset, filter by, sort by, export to Excel */}
                <div className="flex flex-wrap items-center gap-2">
                  {isAnyFilterActive() && (
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
                        setShowClientTypeFilterDropdown(
                          !showClientTypeFilterDropdown,
                        )
                      }
                      aria-haspopup="true"
                      aria-expanded={showClientTypeFilterDropdown}
                      className={BTN_SECONDARY}
                    >
                      <Funnel className="h-4 w-4" aria-hidden="true" />
                      <span>Filter by client type</span>
                      {distinctClientType.length - selectedClientType.length >
                        0 && (
                        <span className={BUTTON_COUNT_BADGE}>
                          {distinctClientType.length -
                            selectedClientType.length}
                        </span>
                      )}
                    </button>
                    {showClientTypeFilterDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg z-40 max-h-96 overflow-y-auto">
                        <div className="py-1">
                          {distinctClientType.length === 0 ? (
                            <p className="px-4 py-2.5 text-sm text-slate-500">
                              No client types to filter by
                            </p>
                          ) : (
                            <>
                              <label
                                className={`${MENU_CHECK_ROW} sticky top-0 bg-white border-b border-slate-200`}
                              >
                                <span className="font-medium">Select all</span>
                                <input
                                  type="checkbox"
                                  checked={
                                    selectedClientType.length ===
                                    distinctClientType.length
                                  }
                                  onChange={() =>
                                    handleClientTypeToggle("Select All")
                                  }
                                  className={CHECKBOX}
                                />
                              </label>
                              {distinctClientType.map((clientType) => (
                                <label
                                  key={clientType}
                                  className={MENU_CHECK_ROW}
                                >
                                  <span>{formatLabel(clientType)}</span>
                                  <input
                                    type="checkbox"
                                    checked={selectedClientType.includes(
                                      clientType,
                                    )}
                                    onChange={() =>
                                      handleClientTypeToggle(clientType)
                                    }
                                    className={CHECKBOX}
                                  />
                                </label>
                              ))}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative dropdown-container">
                    <button
                      type="button"
                      onClick={() => setShowSortDropdown(!showSortDropdown)}
                      aria-haspopup="true"
                      aria-expanded={showSortDropdown}
                      className={BTN_SECONDARY}
                    >
                      <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                      <span>Sort by</span>
                    </button>
                    {showSortDropdown && (
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
                      onClick={() => setShowColumnDropdown(!showColumnDropdown)}
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
                              onChange={() => handleColumnToggle("Select All")}
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

            {/* Scrollable table section */}
            <div className="flex-1 overflow-auto">
              <div className="min-w-full">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className={TH}>
                        Image
                      </th>
                      <SortHeader
                        field="client_name"
                        label="Client name"
                        icon={getSortIcon("client_name")}
                        {...sortHeaderProps}
                      />
                      <SortHeader
                        field="client_type"
                        label="Client type"
                        icon={getSortIcon("client_type")}
                        {...sortHeaderProps}
                      />
                      <th scope="col" className={TH}>
                        Client email
                      </th>
                      <th scope="col" className={TH}>
                        Client phone
                      </th>
                      <SortHeader
                        field="active_projects"
                        label="Active projects"
                        icon={getSortIcon("active_projects")}
                        alignRight
                        {...sortHeaderProps}
                      />
                      <SortHeader
                        field="completed_projects"
                        label="Completed projects"
                        icon={getSortIcon("completed_projects")}
                        alignRight
                        {...sortHeaderProps}
                      />
                    </tr>
                  </thead>

                  <tbody className="bg-white divide-y divide-slate-200">
                    {loading ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={TABLE_COLUMNS}
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
                              Loading clients…
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : error ? (
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
                              onClick={fetchClients}
                              className={`${BTN_SECONDARY} py-1.5`}
                            >
                              Try again
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : paginatedClients.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={TABLE_COLUMNS}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Building2
                              className="w-8 h-8 text-slate-300"
                              aria-hidden="true"
                            />
                            {clients.length > 0 && isNarrowingFilterActive ? (
                              <>
                                <p className="text-sm text-slate-600">
                                  No clients match your filters
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
                                  No clients yet
                                </p>
                                <button
                                  type="button"
                                  onClick={goToAddClient}
                                  className={`${BTN_SECONDARY} py-1.5`}
                                >
                                  <Plus
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Add client
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedClients.map((e) => (
                        <tr
                          key={e.client_id}
                          className="hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
                          onClick={() => {
                            router.push(`/admin/clients/${e.client_id}`);
                          }}
                        >
                          <td className="px-4 py-3">
                            <div className="w-10 h-10">
                              <div
                                className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-full text-slate-600 flex items-center justify-center font-medium text-sm"
                                aria-hidden="true"
                              >
                                {clientInitials(e.client_name)}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 font-medium">
                            {e.client_name ? (
                              <Link
                                href={`/admin/clients/${e.client_id}`}
                                onClick={(ev) => ev.stopPropagation()}
                                title={e.client_name}
                                className="block max-w-64 truncate rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              >
                                {e.client_name}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {e.client_type ? (
                              <span
                                className={`${BADGE} ${BADGE_TONES.neutral} whitespace-nowrap`}
                              >
                                {formatLabel(e.client_type)}
                              </span>
                            ) : (
                              <span className="text-slate-700">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-600">
                            <span
                              className="block max-w-64 truncate"
                              title={e.client_email || undefined}
                            >
                              {e.client_email || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                            {e.client_phone || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap text-right font-mono tabular-nums">
                            {countActiveProjects(e)}
                          </td>
                          <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap text-right font-mono tabular-nums">
                            {countCompletedProjects(e)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fixed pagination footer */}
            {!loading && !error && paginatedClients.length > 0 && (
              <PaginationFooter
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
                showItemsPerPage={true}
              />
            )}
          </div>
        </div>
      </main>
    </AdminShell>
  );
}
