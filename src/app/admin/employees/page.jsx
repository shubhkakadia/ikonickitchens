"use client";
import React from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
import {
  ArrowUpDown,
  Funnel,
  Plus,
  Search,
  Sheet,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  RotateCcw,
  ImageIcon,
} from "lucide-react";
import Image from "next/image";
import TabsController from "@/components/tabscontroller";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "react-toastify";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { replaceTab } from "@/state/reducer/tabs";
import { v4 as uuidv4 } from "uuid";
// Dynamic import for xlsx to avoid SSR issues

export default function page() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("employee_id");
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] =
    useState(false);
  const [showRoleFilterDropdown, setShowRoleFilterDropdown] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [hasInitializedRoles, setHasInitializedRoles] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { getToken } = useAuth();

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) {
        setShowSortDropdown(false);
        setShowItemsPerPageDropdown(false);
        setShowRoleFilterDropdown(false);
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

    setIsExporting(true);

    try {
      // Dynamic import of xlsx to avoid SSR issues
      const XLSX = await import("xlsx");

      // Prepare data for export - use filtered and sorted data with all fields
      const exportData = filteredAndSortedEmployees.map((employee) => ({
        "Employee ID": employee.employee_id || "",
        "First Name": employee.first_name || "",
        "Last Name": employee.last_name || "",
        Email: employee.email || "",
        Phone: employee.phone || "",
        Role: employee.role || "",
        "Date of Birth": employee.dob
          ? new Date(employee.dob).toLocaleDateString()
          : "",
        "Join Date": employee.join_date
          ? new Date(employee.join_date).toLocaleDateString()
          : "",
        Address: employee.address || "",
        "Emergency Contact Name": employee.emergency_contact_name || "",
        "Emergency Contact Phone": employee.emergency_contact_phone || "",
        "Bank Account Name": employee.bank_account_name || "",
        "Bank Account Number": employee.bank_account_number || "",
        "Bank Account BSB": employee.bank_account_bsb || "",
        "Super Account Name": employee.supper_account_name || "",
        "Super Account Number": employee.supper_account_number || "",
        "TFN Number": employee.tfn_number || "",
        Education: employee.education || "",
        Availability: employee.availability
          ? JSON.stringify(employee.availability)
          : "",
        Notes: employee.notes || "",
        "Created At": employee.createdAt
          ? new Date(employee.createdAt).toLocaleDateString()
          : "",
        "Updated At": employee.updatedAt
          ? new Date(employee.updatedAt).toLocaleDateString()
          : "",
      }));

      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Create a worksheet from the data
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for better readability
      const colWidths = [
        { wch: 12 }, // Employee ID
        { wch: 15 }, // First Name
        { wch: 15 }, // Last Name
        { wch: 25 }, // Email
        { wch: 15 }, // Phone
        { wch: 15 }, // Role
        { wch: 12 }, // Date of Birth
        { wch: 12 }, // Join Date
        { wch: 30 }, // Address
        { wch: 20 }, // Emergency Contact Name
        { wch: 18 }, // Emergency Contact Phone
        { wch: 20 }, // Bank Account Name
        { wch: 18 }, // Bank Account Number
        { wch: 12 }, // Bank Account BSB
        { wch: 20 }, // Super Account Name
        { wch: 18 }, // Super Account Number
        { wch: 12 }, // TFN Number
        { wch: 25 }, // Education
        { wch: 40 }, // Availability
        { wch: 30 }, // Notes
        { wch: 12 }, // Created At
        { wch: 12 }, // Updated At
      ];
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
          (employee.employee_id &&
            employee.employee_id
              .toString()
              .toLowerCase()
              .includes(searchLower)) ||
          (employee.first_name &&
            employee.first_name.toLowerCase().includes(searchLower)) ||
          (employee.last_name &&
            employee.last_name.toLowerCase().includes(searchLower)) ||
          (employee.email &&
            employee.email.toLowerCase().includes(searchLower)) ||
          (employee.phone &&
            employee.phone.toLowerCase().includes(searchLower)) ||
          (employee.role && employee.role.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // Role filter
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
  const totalPages =
    itemsPerPage === 0 ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedEmployees = filteredAndSortedEmployees.slice(
    startIndex,
    endIndex
  );

  // Reset to first page when search or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, itemsPerPage]);

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
    setShowItemsPerPageDropdown(false);
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

  const handleReset = () => {
    setSearch("");
    setSortField("employee_id");
    setSortOrder("asc");
    setSelectedRoles([...distinctRoles]); // Reset to all roles selected
    setCurrentPage(1);
    setItemsPerPage(10);
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
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    if (sortOrder === "asc") return <ArrowUp className="h-4 w-4" />;
    if (sortOrder === "desc") return <ArrowDown className="h-4 w-4" />;
    return null; // No icon for relevance
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
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
      let config = {
        method: "get",
        maxBodyLength: Infinity,
        url: "/api/employee/all",
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
          console.log(error);
          setError(error.response.data.message);
        });
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-tertiary">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <CRMLayout />
        <div className="h-full w-full">
          <div className="px-4 py-2">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-slate-600">Employees</h1>
              <TabsController
                href="/admin/employees/addemployee"
                title="Add Employee"
              >
                <div className="cursor-pointer hover:bg-primary transition-all duration-200 bg-primary/80 text-white px-4 py-2 rounded-md flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Add Employee
                </div>
              </TabsController>
            </div>
            <div className="mt-4 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-6">
                {/* search bar */}
                <div className="flex items-center gap-2 w-[500px] relative">
                  <Search className="h-5 w-5 absolute left-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search Employee with name, email, phone, role, employee id"
                    className="w-full text-slate-800 p-3 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {/* reset, sort by, filter by, export to excel */}
                <div className="flex items-center gap-3">
                  {isAnyFilterActive() && (
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-600 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      <RotateCcw className="h-4 w-4" />
                      <span>Reset</span>
                    </button>
                  )}

                  <div className="relative dropdown-container">
                    <button
                      onClick={() =>
                        setShowRoleFilterDropdown(!showRoleFilterDropdown)
                      }
                      className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-600 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      <Funnel className="h-4 w-4" />
                      <span>Filter by Role</span>
                      {distinctRoles.length - selectedRoles.length > 0 && (
                        <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full">
                          {distinctRoles.length - selectedRoles.length}
                        </span>
                      )}
                    </button>
                    {showRoleFilterDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                        <div className="py-1">
                          <button
                            onClick={() => handleRoleToggle("Select All")}
                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                          >
                            <span>Select All</span>
                            <input
                              type="checkbox"
                              checked={
                                selectedRoles.length === distinctRoles.length
                              }
                              onChange={() => {}}
                              className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                            />
                          </button>
                          {distinctRoles.map((role) => (
                            <button
                              key={role}
                              onClick={() => handleRoleToggle(role)}
                              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                            >
                              <span>{role}</span>
                              <input
                                type="checkbox"
                                checked={selectedRoles.includes(role)}
                                onChange={() => {}}
                                className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative dropdown-container">
                    <button
                      onClick={() => setShowSortDropdown(!showSortDropdown)}
                      className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-600 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      <ArrowUpDown className="h-4 w-4" />
                      <span>Sort by</span>
                    </button>
                    {showSortDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                        <div className="py-1">
                          <button
                            onClick={() => handleSort("employee_id")}
                            className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                          >
                            Employee ID {getSortIcon("employee_id")}
                          </button>
                          <button
                            onClick={() => handleSort("first_name")}
                            className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                          >
                            First Name {getSortIcon("first_name")}
                          </button>
                          <button
                            onClick={() => handleSort("last_name")}
                            className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                          >
                            Last Name {getSortIcon("last_name")}
                          </button>
                          <button
                            onClick={() => handleSort("role")}
                            className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                          >
                            Role {getSortIcon("role")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleExportToExcel}
                    disabled={
                      isExporting || filteredAndSortedEmployees.length === 0
                    }
                    className={`flex items-center gap-2 transition-all duration-200 text-slate-600 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium ${
                      isExporting || filteredAndSortedEmployees.length === 0
                        ? "opacity-50 cursor-not-allowed"
                        : "cursor-pointer hover:bg-slate-100"
                    }`}
                  >
                    <Sheet className="h-4 w-4" />
                    <span>
                      {isExporting ? "Exporting..." : "Export to Excel"}
                    </span>
                  </button>
                </div>
              </div>

              {/* table */}
              <div className="mt-4">
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Image
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                          onClick={() => handleSort("employee_id")}
                        >
                          <div className="flex items-center gap-2">
                            Employee ID
                            {getSortIcon("employee_id")}
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                          onClick={() => handleSort("first_name")}
                        >
                          <div className="flex items-center gap-2">
                            First Name
                            {getSortIcon("first_name")}
                          </div>
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                          onClick={() => handleSort("last_name")}
                        >
                          <div className="flex items-center gap-2">
                            Last Name
                            {getSortIcon("last_name")}
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Phone
                        </th>
                        <th
                          className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                          onClick={() => handleSort("role")}
                        >
                          <div className="flex items-center gap-2">
                            Role
                            {getSortIcon("role")}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td
                            className="px-4 py-6 text-sm text-slate-500"
                            colSpan={7}
                          >
                            Loading employees...
                          </td>
                        </tr>
                      ) : error ? (
                        <tr>
                          <td
                            className="px-4 py-6 text-sm text-red-600"
                            colSpan={7}
                          >
                            {error}
                          </td>
                        </tr>
                      ) : paginatedEmployees.length === 0 ? (
                        <tr>
                          <td
                            className="px-4 py-6 text-sm text-slate-500"
                            colSpan={7}
                          >
                            {search
                              ? "No employees found matching your search"
                              : selectedRoles.length === 0
                              ? "No employees found - please select at least one role to view employees"
                              : "No employees found"}
                          </td>
                        </tr>
                      ) : (
                        paginatedEmployees.map((e) => (
                          <tr
                            key={e.id}
                            onClick={() => {
                              router.push(`/admin/employees/${e.employee_id}`);
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
                              <div className="w-12 h-12">
                                {e.image ? (
                                  <Image
                                    src={`/${e.image.url}`}
                                    alt={e.first_name + " " + e.last_name}
                                    width={48}
                                    height={48}
                                    className="w-full h-full object-cover rounded"
                                  />
                                ) : (
                                  <div className="w-12 h-12 bg-gradient-to-br from-secondary to-primary rounded text-white text-center flex items-center justify-center font-bold text-lg">
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
                            <td className="px-4 py-3 text-sm text-slate-700">
                              {e.email || "-"}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                              {e.phone || "-"}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 border border-slate-200">
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

              {/* Pagination Controls */}
              {!loading && !error && paginatedEmployees.length > 0 && (
                <div className="mt-6 flex items-center justify-between">
                  {/* Items per page dropdown and showing indicator */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-600">Showing</span>
                      <div className="relative dropdown-container">
                        <button
                          onClick={() =>
                            setShowItemsPerPageDropdown(
                              !showItemsPerPageDropdown
                            )
                          }
                          className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
                        >
                          <span>
                            {itemsPerPage === 0 ? "All" : itemsPerPage}
                          </span>
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        {showItemsPerPageDropdown && (
                          <div className="absolute top-full left-0 mt-1 w-20 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                            <div className="py-1">
                              {[10, 25, 50, 100, 0].map((value) => (
                                <button
                                  key={value}
                                  onClick={() =>
                                    handleItemsPerPageChange(value)
                                  }
                                  className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                >
                                  {value === 0 ? "All" : value}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-slate-600">
                        of {totalItems} results
                      </span>
                    </div>
                  </div>

                  {/* Pagination buttons - only show when not showing all items */}
                  {itemsPerPage > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handlePageChange(1)}
                        disabled={currentPage === 1}
                        className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>

                      {/* Page numbers */}
                      <div className="flex items-center gap-1">
                        {Array.from(
                          { length: Math.min(5, totalPages) },
                          (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }

                            return (
                              <button
                                key={pageNum}
                                onClick={() => handlePageChange(pageNum)}
                                className={`cursor-pointer px-3 py-2 text-sm rounded-lg transition-colors duration-200 ${
                                  currentPage === pageNum
                                    ? "bg-primary text-white"
                                    : "text-slate-600 hover:bg-slate-100"
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          }
                        )}
                      </div>

                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
