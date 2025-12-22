"use client";
import React from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
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
} from "lucide-react";
import Image from "next/image";
import TabsController from "@/components/tabscontroller";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { replaceTab } from "@/state/reducer/tabs";
import { v4 as uuidv4 } from "uuid";

export default function page() {
  const router = useRouter();
  const { getToken } = useAuth();
  const dispatch = useDispatch();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("employee_id");
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showRoleFilterDropdown, setShowRoleFilterDropdown] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [hasInitializedRoles, setHasInitializedRoles] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [activeTab, setActiveTab] = useState("active");

  // Define all available columns for export
  const availableColumns = [
    "Employee ID",
    "First Name",
    "Last Name",
    "Email",
    "Phone",
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) {
        setShowSortDropdown(false);
        setShowRoleFilterDropdown(false);
        setShowColumnDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleExportToExcel = async () => {
    if (filteredAndSortedEmployees.length === 0) {
      toast.warning(
        "No data to export. Please adjust your filters or add employees.",
        {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        }
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
        "Employee ID": (employee) => employee.employee_id || "",
        "First Name": (employee) => employee.first_name || "",
        "Last Name": (employee) => employee.last_name || "",
        Email: (employee) => employee.email || "",
        Phone: (employee) => employee.phone || "",
        Role: (employee) => employee.role || "",
        "Date of Birth": (employee) =>
          employee.dob ? new Date(employee.dob).toLocaleDateString() : "",
        "Join Date": (employee) =>
          employee.join_date
            ? new Date(employee.join_date).toLocaleDateString()
            : "",
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
        "Created At": (employee) =>
          employee.createdAt
            ? new Date(employee.createdAt).toLocaleDateString()
            : "",
        "Updated At": (employee) =>
          employee.updatedAt
            ? new Date(employee.updatedAt).toLocaleDateString()
            : "",
      };

      // Column width map
      const columnWidthMap = {
        "Employee ID": 12,
        "First Name": 15,
        "Last Name": 15,
        Email: 25,
        Phone: 15,
        Role: 15,
        "Date of Birth": 12,
        "Join Date": 12,
        Address: 30,
        "Emergency Contact Name": 20,
        "Emergency Contact Phone": 18,
        "Bank Account Name": 20,
        "Bank Account Number": 18,
        "Bank Account BSB": 12,
        "Super Account Name": 20,
        "Super Account Number": 18,
        "TFN Number": 12,
        Education: 25,
        Availability: 40,
        Notes: 30,
        "Created At": 12,
        "Updated At": 12,
      };

      // Prepare data for export - only include selected columns
      const exportData = filteredAndSortedEmployees.map((employee) => {
        const row = {};
        selectedColumns.forEach((column) => {
          if (columnMap[column]) {
            row[column] = columnMap[column](employee);
          }
        });
        return row;
      });

      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Create a worksheet from the data
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for selected columns only
      const colWidths = selectedColumns.map((column) => ({
        wch: columnWidthMap[column] || 15,
      }));
      ws["!cols"] = colWidths;

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(wb, ws, "Employees");

      // Generate filename with current date
      const currentDate = new Date().toISOString().split("T")[0];
      const filename = `employees_export_${currentDate}.xlsx`;

      // Save the file
      XLSX.writeFile(wb, filename);

      // Show success message
      toast.success(
        `Successfully exported ${exportData.length} employees to ${filename}`,
        {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        }
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

  // Get distinct roles from employees data
  const distinctRoles = useMemo(() => {
    const roles = [
      ...new Set(employees.map((emp) => emp.role).filter((role) => role)),
    ];
    return roles.sort();
  }, [employees]);

  // Initialize selectedRoles with all roles when distinctRoles changes (only once)
  useEffect(() => {
    if (distinctRoles.length > 0 && !hasInitializedRoles) {
      setSelectedRoles([...distinctRoles]);
      setHasInitializedRoles(true);
    }
  }, [distinctRoles, hasInitializedRoles]);

  // Filter and sort employees
  const filteredAndSortedEmployees = useMemo(() => {
    let filtered = employees.filter((employee) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          (employee.employee_id || "").toString().toLowerCase().includes(searchLower) ||
          (employee.first_name || "").toLowerCase().includes(searchLower) ||
          (employee.last_name || "").toLowerCase().includes(searchLower) ||
          (employee.email || "").toLowerCase().includes(searchLower) ||
          (employee.phone || "").toLowerCase().includes(searchLower) ||
          (employee.role || "").toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Role filter
      if (selectedRoles.length > 0) {
        return selectedRoles.includes(employee.role);
      }
      return false;
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
  const totalPages =
    itemsPerPage === 0 ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedEmployees = filteredAndSortedEmployees.slice(
    startIndex,
    endIndex
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
        prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
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
          : [...prev, column]
      );
    }
  };

  const handleReset = () => {
    setSearch("");
    setSortField("employee_id");
    setSortOrder("asc");
    setSelectedRoles([...distinctRoles]); // Reset to all roles selected
    setCurrentPage(1);
    setHasInitializedRoles(true); // Keep initialized state
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

  const getSortIcon = (field) => {
    if (sortField !== field)
      return <ArrowUpDown className="h-4 w-4 text-slate-400" />;
    if (sortOrder === "asc")
      return <ArrowUp className="h-4 w-4 text-primary" />;
    if (sortOrder === "desc")
      return <ArrowDown className="h-4 w-4 text-primary" />;
    return null; // No icon for relevance
  };

  useEffect(() => {
    fetchEmployees();
  }, [activeTab]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      // Get the session token when needed
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }
      
      // Use different endpoint based on active tab
      const endpoint = activeTab === "inactive" 
        ? "/api/employee/all_inactive" 
        : "/api/employee/all";
      
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

      axios
        .request(config)
        .then((response) => {
          setLoading(false);
          if (response.data.status) {
            setEmployees(response.data.data);
          } else {
            setError(response.data.message);
          }
        })
        .catch((error) => {
          setLoading(false);
          console.error("Error fetching employees:", error);
          setError(error.response?.data?.message || "Failed to fetch employees");
        });
    } catch (error) {
      console.error("Error fetching employees:", error);
      setLoading(false);
    }
  };

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
                    Loading employees details...
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
                      Employees
                    </h1>
                    <TabsController
                      href="/admin/employees/addemployee"
                      title="Add Employee"
                    >
                      <div className="cursor-pointer hover:bg-primary transition-all duration-200 bg-primary/80 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm">
                        <Plus className="h-4 w-4" />
                        Add Employee
                      </div>
                    </TabsController>
                  </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                    {/* Fixed Header Section */}
                    <div className="p-4 shrink-0 border-b border-slate-200">
                      <div className="flex items-center justify-between gap-3">
                        {/* search bar */}
                        <div className="flex items-center gap-2 flex-1 max-w-2xl relative">
                          <Search className="h-4 w-4 absolute left-3 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search Employee with name, email, phone, role, employee id"
                            className="w-full text-slate-800 p-2 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm font-normal"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>
                        {/* reset, sort by, filter by, export to excel */}
                        <div className="flex items-center gap-2">
                          {isAnyFilterActive() && (
                            <button
                              onClick={handleReset}
                              className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                            >
                              <RotateCcw className="h-4 w-4" />
                              <span>Reset</span>
                            </button>
                          )}

                          <div className="relative dropdown-container">
                            <button
                              onClick={() =>
                                setShowRoleFilterDropdown(
                                  !showRoleFilterDropdown
                                )
                              }
                              className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                            >
                              <Funnel className="h-4 w-4" />
                              <span>Filter by Role</span>
                              {distinctRoles.length - selectedRoles.length >
                                0 && (
                                  <span className="bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                                    {distinctRoles.length - selectedRoles.length}
                                  </span>
                                )}
                            </button>
                            {showRoleFilterDropdown && (
                              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                                <div className="py-1">
                                  <label className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 sticky top-0 bg-white border-b border-slate-200 cursor-pointer">
                                    <span className="font-semibold">Select All</span>
                                    <input
                                      type="checkbox"
                                      checked={selectedRoles.length === distinctRoles.length}
                                      onChange={() => handleRoleToggle("Select All")}
                                      className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                                    />
                                  </label>
                                  {distinctRoles.map((role) => (
                                    <label
                                      key={role}
                                      className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                                    >
                                      <span>{role}</span>
                                      <input
                                        type="checkbox"
                                        checked={selectedRoles.includes(role)}
                                        onChange={() => handleRoleToggle(role)}
                                        className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                                      />
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="relative dropdown-container">
                            <button
                              onClick={() =>
                                setShowSortDropdown(!showSortDropdown)
                              }
                              className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                            >
                              <ArrowUpDown className="h-4 w-4" />
                              <span>Sort by</span>
                            </button>
                            {showSortDropdown && (
                              <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                                <div className="py-1">
                                  <button
                                    onClick={() => handleSort("employee_id")}
                                    className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Employee ID {getSortIcon("employee_id")}
                                  </button>
                                  <button
                                    onClick={() => handleSort("first_name")}
                                    className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    First Name {getSortIcon("first_name")}
                                  </button>
                                  <button
                                    onClick={() => handleSort("last_name")}
                                    className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Last Name {getSortIcon("last_name")}
                                  </button>
                                  <button
                                    onClick={() => handleSort("role")}
                                    className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Role {getSortIcon("role")}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="relative dropdown-container flex items-center">
                            <button
                              onClick={handleExportToExcel}
                              disabled={
                                isExporting ||
                                filteredAndSortedEmployees.length === 0 ||
                                selectedColumns.length === 0
                              }
                              className={`flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 border-r-0 px-3 py-2 rounded-l-lg text-sm font-medium ${isExporting ||
                                filteredAndSortedEmployees.length === 0 ||
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
                                isExporting ||
                                filteredAndSortedEmployees.length === 0
                              }
                              className={`flex items-center transition-all duration-200 text-slate-700 border border-slate-300 px-2 py-2 rounded-r-lg text-sm font-medium ${isExporting ||
                                filteredAndSortedEmployees.length === 0
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
                                    <span className="font-semibold">Select All</span>
                                    <input
                                      type="checkbox"
                                      checked={selectedColumns.length === availableColumns.length}
                                      onChange={() => handleColumnToggle("Select All")}
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
                    </div>

                    {/* Tabs Section */}
                    <div className="px-4 shrink-0 border-b border-slate-200">
                      <nav className="flex space-x-6">
                        <button
                          onClick={() => setActiveTab("active")}
                          className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
                            activeTab === "active"
                              ? "border-primary text-primary"
                              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                          }`}
                        >
                          Active
                        </button>
                        <button
                          onClick={() => setActiveTab("inactive")}
                          className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
                            activeTab === "inactive"
                              ? "border-primary text-primary"
                              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                          }`}
                        >
                          Inactive
                        </button>
                      </nav>
                    </div>

                    {/* Scrollable Table Section */}
                    <div className="flex-1 overflow-auto">
                      <div className="min-w-full">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider">
                                Image
                              </th>
                              <th
                                className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                onClick={() => handleSort("employee_id")}
                              >
                                <div className="flex items-center gap-2">
                                  Employee ID
                                  {getSortIcon("employee_id")}
                                </div>
                              </th>
                              <th
                                className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                onClick={() => handleSort("first_name")}
                              >
                                <div className="flex items-center gap-2">
                                  First Name
                                  {getSortIcon("first_name")}
                                </div>
                              </th>
                              <th
                                className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                onClick={() => handleSort("last_name")}
                              >
                                <div className="flex items-center gap-2">
                                  Last Name
                                  {getSortIcon("last_name")}
                                </div>
                              </th>
                              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider">
                                Email
                              </th>
                              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider">
                                Phone
                              </th>
                              <th
                                className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                onClick={() => handleSort("role")}
                              >
                                <div className="flex items-center gap-2">
                                  Role
                                  {getSortIcon("role")}
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                              <tr>
                                <td
                                  className="px-4 py-4 text-sm text-slate-500 text-center"
                                  colSpan={7}
                                >
                                  Loading employees...
                                </td>
                              </tr>
                            ) : error ? (
                              <tr>
                                <td
                                  className="px-4 py-4 text-sm text-red-600 text-center"
                                  colSpan={7}
                                >
                                  {error}
                                </td>
                              </tr>
                            ) : paginatedEmployees.length === 0 ? (
                              <tr>
                                <td
                                  className="px-4 py-4 text-sm text-slate-500 text-center"
                                  colSpan={7}
                                >
                                  {search
                                    ? "No employees found matching your search"
                                    : selectedRoles.length === 0
                                      ? "No employees found - please select at least one role to view employees"
                                      : activeTab === "active"
                                        ? "No active employees found"
                                        : "No inactive employees found"}
                                </td>
                              </tr>
                            ) : (
                              paginatedEmployees.map((e) => (
                                <tr
                                  key={e.id}
                                  onClick={() => {
                                    router.push(
                                      `/admin/employees/${e.employee_id}`
                                    );
                                    dispatch(
                                      replaceTab({
                                        id: uuidv4(),
                                        title: e.first_name + " " + e.last_name,
                                        href: `/admin/employees/${e.employee_id}`,
                                      })
                                    );
                                  }}
                                  className="cursor-pointer hover:bg-slate-50 transition-colors duration-200"
                                >
                                  <td className="px-4 py-3">
                                    <div className="w-10 h-10">
                                      {e.image ? (
                                        <Image
                                          src={`/${e.image.url}`}
                                          alt={e.first_name + " " + e.last_name}
                                          width={40}
                                          height={40}
                                          className="w-full h-full object-cover rounded"
                                        />
                                      ) : (
                                        <div className="w-10 h-10 bg-linear-to-br from-secondary to-primary rounded text-white text-center flex items-center justify-center font-bold text-sm">
                                          {e.first_name?.[0] || ""}
                                          {e.last_name?.[0] || ""}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap font-medium">
                                    {e.employee_id || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                    {e.first_name || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                    {e.last_name || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">
                                    {e.email || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                    {e.phone || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                                      {e.role || "-"}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Fixed Pagination Footer */}
                    {!loading && !error && paginatedEmployees.length > 0 && (
                      <PaginationFooter
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        currentPage={currentPage}
                        onPageChange={handlePageChange}
                        onItemsPerPageChange={handleItemsPerPageChange}
                        itemsPerPageOptions={[25, 50, 100, 0]}
                        showItemsPerPage={true}
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AdminRoute>
  );
}
