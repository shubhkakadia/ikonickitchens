"use client";
import React from "react";
import AdminShell from "@/components/AdminShell";
import PaginationFooter from "@/components/PaginationFooter";
import {
  ArrowUpDown,
  Funnel,
  Plus,
  Search,
  Sheet,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  RotateCcw,
  AlertTriangle,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

const TABLE_KEY = "employees";
const TABLE_COLUMNS = 7;

// Fields the list can be sorted by. Used by both the "Sort by" menu and the
// column headers so the two never drift apart.
const SORT_OPTIONS = [
  { field: "employee_id", label: "Employee ID" },
  { field: "first_name", label: "First name" },
  { field: "last_name", label: "Last name" },
  { field: "role", label: "Role" },
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

// Sortable column header. The label is a real button so the sort is reachable
// by keyboard (DESIGN.md 13.7); the active column carries the only indicator.
function SortHeader({ field, label, sortField, sortOrder, onSort, icon }) {
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
      className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="cursor-pointer flex items-center gap-2 uppercase tracking-wider hover:text-slate-700 transition-colors duration-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {label}
        {icon}
      </button>
    </th>
  );
}

export default function EmployeesPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = usePersistedTableFilter(TABLE_KEY, "search", "");
  const [sortField, setSortField] = usePersistedTableFilter(
    TABLE_KEY,
    "sortField",
    "employee_id",
  );
  const [sortOrder, setSortOrder] = usePersistedTableFilter(
    TABLE_KEY,
    "sortOrder",
    "asc",
  );
  const { resetFilters } = useTableFilterActions(TABLE_KEY);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showRoleFilterDropdown, setShowRoleFilterDropdown] = useState(false);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState("active");

  // Define all available columns for export
  const availableColumns = [
    "Employee ID",
    "First Name",
    "Last Name",
    "Email",
    "Phone",
    "Secondary Phone",
    "Role",
    "Date of Birth",
    "Join Date",
    "Address",
    "Emergency Contact Name",
    "Emergency Contact Phone",
    "Bank Account Name",
    "Bank Account Number",
    "Bank Account BSB",
    "Super Account Name",
    "Super Account Number",
    "TFN Number",
    "Education",
    "Availability",
    "Notes",
    "Created At",
    "Updated At",
  ];

  const [selectedColumns, setSelectedColumns] = useState([...availableColumns]);

  // Close dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    const closeAll = () => {
      setShowSortDropdown(false);
      setShowRoleFilterDropdown(false);
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

  // Column mapping for Excel export
  const columnMap = useMemo(
    () => ({
      "Employee ID": (employee) => employee.employee_id || "",
      "First Name": (employee) => employee.first_name || "",
      "Last Name": (employee) => employee.last_name || "",
      Email: (employee) => employee.email || "",
      Phone: (employee) => employee.phone || "",
      "Secondary Phone": (employee) => employee.phone_secondary || "",
      Role: (employee) => employee.role || "",
      "Date of Birth": (employee) => exportDate(employee.dob),
      "Join Date": (employee) => exportDate(employee.join_date),
      Address: (employee) => employee.address || "",
      "Emergency Contact Name": (employee) =>
        employee.emergency_contact_name || "",
      "Emergency Contact Phone": (employee) =>
        employee.emergency_contact_phone || "",
      "Bank Account Name": (employee) => employee.bank_account_name || "",
      "Bank Account Number": (employee) => employee.bank_account_number || "",
      "Bank Account BSB": (employee) => employee.bank_account_bsb || "",
      "Super Account Name": (employee) => employee.supper_account_name || "",
      "Super Account Number": (employee) =>
        employee.supper_account_number || "",
      "TFN Number": (employee) => employee.tfn_number || "",
      Education: (employee) => employee.education || "",
      Availability: (employee) =>
        employee.availability ? JSON.stringify(employee.availability) : "",
      Notes: (employee) => employee.notes || "",
      "Created At": (employee) => exportDate(employee.createdAt),
      "Updated At": (employee) => exportDate(employee.updatedAt),
    }),
    [],
  );

  // Initialize Excel export hook
  const { exportToExcel, isExporting } = useExcelExport({
    columnMap,
    filenamePrefix: "employees_export",
    sheetName: "Employees",
    selectedColumns,
  });

  const handleExportToExcel = () => {
    exportToExcel(filteredAndSortedEmployees);
  };

  // Get distinct roles from employees data
  const distinctRoles = useMemo(() => {
    const roles = [
      ...new Set(employees.map((emp) => emp.role).filter((role) => role)),
    ];
    return roles.sort();
  }, [employees]);

  const [selectedRoles, setSelectedRoles] = usePersistedTableFilter(
    TABLE_KEY,
    "selectedRoles",
    distinctRoles,
  );

  // Filter and sort employees
  const filteredAndSortedEmployees = useMemo(() => {
    let filtered = employees.filter((employee) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          (employee.employee_id || "")
            .toString()
            .toLowerCase()
            .includes(searchLower) ||
          (employee.first_name || "").toLowerCase().includes(searchLower) ||
          (employee.last_name || "").toLowerCase().includes(searchLower) ||
          (employee.email || "").toLowerCase().includes(searchLower) ||
          (employee.phone || "").toLowerCase().includes(searchLower) ||
          (employee.phone_secondary || "")
            .toLowerCase()
            .includes(searchLower) ||
          (employee.role || "").toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Role filter - if no roles are selected, show all employees
      if (selectedRoles.length > 0) {
        return selectedRoles.includes(employee.role);
      }
      return true;
    });

    // Sort employees
    filtered.sort((a, b) => {
      let aValue = a[sortField] || "";
      let bValue = b[sortField] || "";

      // Handle relevance sorting (by search match)
      if (sortOrder === "relevance" && search) {
        const searchLower = search.toLowerCase();
        const aMatch = aValue.toString().toLowerCase().includes(searchLower);
        const bMatch = bValue.toString().toLowerCase().includes(searchLower);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }

      // Convert to string for comparison
      aValue = aValue.toString().toLowerCase();
      bValue = bValue.toString().toLowerCase();

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else if (sortOrder === "desc") {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
      return 0;
    });

    return filtered;
  }, [employees, search, sortField, sortOrder, selectedRoles]);

  // Pagination logic
  const totalItems = filteredAndSortedEmployees.length;
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedEmployees = filteredAndSortedEmployees.slice(
    startIndex,
    endIndex,
  );

  // Reset to first page when search, tab, or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeTab]);

  const handleSort = (field) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> relevance -> asc
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else if (sortOrder === "desc") {
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

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleRoleToggle = (role) => {
    if (role === "Select All") {
      if (selectedRoles.length === distinctRoles.length) {
        // If all roles are selected, unselect all (show no data)
        setSelectedRoles([]);
      } else {
        // If not all roles are selected, select all
        setSelectedRoles([...distinctRoles]);
      }
    } else {
      setSelectedRoles((prev) =>
        prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
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

  const handleReset = () => {
    resetFilters();
    setCurrentPage(1);
  };

  // Check if any filters are active (not in default state)
  const isAnyFilterActive = () => {
    return (
      search !== "" || // Search is not empty
      selectedRoles.length !== distinctRoles.length || // Role filter is not showing all roles
      sortField !== "employee_id" || // Sort field is not default
      sortOrder !== "asc" // Sort order is not default
    );
  };

  // Filters that narrow the list (sort does not hide records), used to tell
  // "no records" apart from "no results for this filter" (DESIGN.md 15.4).
  const isNarrowingFilterActive =
    search !== "" ||
    (selectedRoles.length > 0 && selectedRoles.length !== distinctRoles.length);

  // Only the active column shows a sort indicator (DESIGN.md 15.4).
  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    if (sortOrder === "asc")
      return <ArrowUp className="h-4 w-4 text-primary" aria-hidden="true" />;
    if (sortOrder === "desc")
      return <ArrowDown className="h-4 w-4 text-primary" aria-hidden="true" />;
    return null; // No icon for relevance
  };

  useEffect(() => {
    fetchEmployees();
  }, [activeTab]);

  const fetchEmployees = async () => {
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

      // Use different endpoint based on active tab
      const endpoint =
        activeTab === "inactive"
          ? "/api/v1/employee/all_inactive"
          : "/api/v1/employee/all";

      let config = {
        method: "get",
        maxBodyLength: Infinity,
        url: endpoint,
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          ...{},
        },
        data: {},
      };

      const response = await axios.request(config);
      if (response.data.status) {
        setEmployees(response.data.data);
      } else {
        setError(
          response.data.message ||
            "Couldn't load employees. Check your connection and try again.",
        );
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      setError(
        error.response?.data?.message ||
          "Couldn't load employees. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const goToAddEmployee = () => router.push("/admin/employees/addemployee");

  const exportDisabled =
    isExporting ||
    filteredAndSortedEmployees.length === 0 ||
    selectedColumns.length === 0;
  const columnPickerDisabled =
    isExporting || filteredAndSortedEmployees.length === 0;

  const tabClass = (tab) =>
    `cursor-pointer py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-t-sm ${
      activeTab === tab
        ? "border-primary text-primary"
        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
    }`;

  return (
    <AdminShell>
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="px-4 py-2 shrink-0">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-slate-800">Employees</h1>
            <div className="flex items-center gap-2">
              <SearchBar />
              <button
                type="button"
                onClick={goToAddEmployee}
                className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add employee
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
                    aria-label="Search employees"
                    placeholder="Search by name, email, phone, role or employee ID"
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
                        setShowRoleFilterDropdown(!showRoleFilterDropdown)
                      }
                      aria-haspopup="true"
                      aria-expanded={showRoleFilterDropdown}
                      className={BTN_SECONDARY}
                    >
                      <Funnel className="h-4 w-4" aria-hidden="true" />
                      <span>Filter by role</span>
                      {distinctRoles.length - selectedRoles.length > 0 && (
                        <span className={BUTTON_COUNT_BADGE}>
                          {distinctRoles.length - selectedRoles.length}
                        </span>
                      )}
                    </button>
                    {showRoleFilterDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg z-40 max-h-96 overflow-y-auto">
                        <div className="py-1">
                          {distinctRoles.length === 0 ? (
                            <p className="px-4 py-2.5 text-sm text-slate-500">
                              No roles to filter by
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
                                    selectedRoles.length ===
                                    distinctRoles.length
                                  }
                                  onChange={() =>
                                    handleRoleToggle("Select All")
                                  }
                                  className={CHECKBOX}
                                />
                              </label>
                              {distinctRoles.map((role) => (
                                <label key={role} className={MENU_CHECK_ROW}>
                                  <span>{role}</span>
                                  <input
                                    type="checkbox"
                                    checked={selectedRoles.includes(role)}
                                    onChange={() => handleRoleToggle(role)}
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

            {/* Tabs section */}
            <div className="px-4 shrink-0 border-b border-slate-200">
              <div
                className="flex space-x-6"
                role="tablist"
                aria-label="Employment status"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "active"}
                  onClick={() => setActiveTab("active")}
                  className={tabClass("active")}
                >
                  Current
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "inactive"}
                  onClick={() => setActiveTab("inactive")}
                  className={tabClass("inactive")}
                >
                  Former
                </button>
              </div>
            </div>

            {/* Scrollable table section */}
            <div className="flex-1 overflow-auto">
              <div className="min-w-full">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th
                        scope="col"
                        className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                      >
                        Photo
                      </th>
                      {SORT_OPTIONS.slice(0, 3).map(({ field, label }) => (
                        <SortHeader
                          key={field}
                          field={field}
                          label={label}
                          sortField={sortField}
                          sortOrder={sortOrder}
                          onSort={handleSort}
                          icon={getSortIcon(field)}
                        />
                      ))}
                      <th
                        scope="col"
                        className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                      >
                        Email
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                      >
                        Phone
                      </th>
                      <SortHeader
                        field="role"
                        label="Role"
                        sortField={sortField}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        icon={getSortIcon("role")}
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
                              Loading employees…
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
                              onClick={fetchEmployees}
                              className={`${BTN_SECONDARY} py-1.5`}
                            >
                              Try again
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : paginatedEmployees.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={TABLE_COLUMNS}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Users
                              className="w-8 h-8 text-slate-300"
                              aria-hidden="true"
                            />
                            {employees.length > 0 && isNarrowingFilterActive ? (
                              <>
                                <p className="text-sm text-slate-600">
                                  No employees match your filters
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
                                  {activeTab === "active"
                                    ? "No current employees yet"
                                    : "No former employees yet"}
                                </p>
                                {activeTab === "active" && (
                                  <button
                                    type="button"
                                    onClick={goToAddEmployee}
                                    className={`${BTN_SECONDARY} py-1.5`}
                                  >
                                    <Plus
                                      className="h-4 w-4"
                                      aria-hidden="true"
                                    />
                                    Add employee
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedEmployees.map((e) => {
                        const fullName =
                          `${e.first_name || ""} ${e.last_name || ""}`.trim();
                        return (
                          <tr
                            key={e.id}
                            onClick={() => {
                              router.push(`/admin/employees/${e.employee_id}`);
                            }}
                            className="cursor-pointer hover:bg-slate-50 transition-colors duration-200"
                          >
                            <td className="px-4 py-3">
                              <div className="w-10 h-10">
                                {e.image ? (
                                  <Image
                                    src={`/${e.image.url}`}
                                    alt=""
                                    width={40}
                                    height={40}
                                    className="w-full h-full object-cover rounded-full"
                                  />
                                ) : (
                                  <div
                                    className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-full text-slate-600 uppercase flex items-center justify-center font-medium text-sm"
                                    aria-hidden="true"
                                  >
                                    {e.first_name?.[0] || e.last_name?.[0]
                                      ? `${e.first_name?.[0] || ""}${e.last_name?.[0] || ""}`
                                      : "—"}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap font-medium font-mono">
                              {e.employee_id ? (
                                <Link
                                  href={`/admin/employees/${e.employee_id}`}
                                  onClick={(ev) => ev.stopPropagation()}
                                  aria-label={
                                    fullName
                                      ? `${e.employee_id}, ${fullName}`
                                      : undefined
                                  }
                                  className="rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                  {e.employee_id}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                              {e.first_name || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                              {e.last_name || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              <span
                                className="block max-w-64 truncate"
                                title={e.email || undefined}
                              >
                                {e.email || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                              {e.phone || "—"}
                              {e.phone_secondary && (
                                <span className="block text-xs text-slate-500">
                                  {e.phone_secondary}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {e.role ? (
                                <span
                                  className={`${BADGE} ${BADGE_TONES.neutral}`}
                                >
                                  {e.role}
                                </span>
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fixed pagination footer */}
            {!loading && !error && paginatedEmployees.length > 0 && (
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
