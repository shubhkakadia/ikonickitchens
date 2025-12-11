"use client";
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import { v4 as uuidv4 } from "uuid";
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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
import TabsController from "@/components/tabscontroller";
import PaginationFooter from "@/components/PaginationFooter";
import { replaceTab } from "@/state/reducer/tabs";
import "react-toastify/dist/ReactToastify.css";

export default function page() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { getToken } = useAuth();

  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("client_name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Data objects
  const [clients, setClients] = useState([]);
  const [selectedClientType, setSelectedClientType] = useState([]);
  const [distinctClientType, setDistinctClientType] = useState([]);
  const [selectedColumns, setSelectedColumns] = useState([]);

  // UI states
  const [loading, setLoading] = useState(false);
  const [showClientTypeFilterDropdown, setShowClientTypeFilterDropdown] =
    useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Flags
  const [error, setError] = useState(null);

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

      // Client type filter
      if (selectedClientType.length === 0) {
        return false;
      }

      return selectedClientType.includes(client.client_type);
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

  // Event listeners or subscriptions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) {
        setShowSortDropdown(false);
        setShowClientTypeFilterDropdown(false);
        setShowColumnDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // UI-sync effects
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // Initialize selectedColumns with all available columns by default
  useEffect(() => {
    if (selectedColumns.length === 0) {
      setSelectedColumns([...availableColumns]);
    }
  }, []);

  // Async functions (fetch/update API)
  const fetchClients = async () => {
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
        url: "/api/client/all",
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
            setClients(response.data.data);
            // Extract distinct client types
            const types = [
              ...new Set(
                response.data.data
                  .map((client) => client.client_type)
                  .filter(Boolean)
              ),
            ];
            setDistinctClientType(types);
            setSelectedClientType(types); // Select all by default
          } else {
            setError(response.data.message);
          }
        })
        .catch((error) => {
          setLoading(false);
          setError(error.response.data.message);
        });
    } catch (error) {
      setLoading(false);
      setError("Failed to fetch clients. Please try again.");
    }
  };

  const handleExportToExcel = async () => {
    if (filteredAndSortedClients.length === 0) {
      toast.warning(
        "No data to export. Please adjust your filters or add clients.",
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
        "Client Created At": (client) =>
          client.createdAt
            ? new Date(client.createdAt).toLocaleDateString()
            : "",
        "Client Updated At": (client) =>
          client.updatedAt
            ? new Date(client.updatedAt).toLocaleDateString()
            : "",
      };

      // Column width map
      const columnWidthMap = {
        "Client ID": 12,
        "Client Name": 15,
        "Client Email": 15,
        "Client Phone": 25,
        "Client Type": 15,
        "Number of Projects": 15,
        "Client Address": 30,
        "Client Website": 20,
        "Client Notes": 18,
        "Contact Name": 20,
        "Contact Email": 18,
        "Contact Phone": 12,
        "Contact Notes": 20,
        "Client Created At": 12,
        "Client Updated At": 12,
      };

      // Prepare data for export - only include selected columns
      const exportData = filteredAndSortedClients.map((client) => {
        const row = {};
        selectedColumns.forEach((column) => {
          if (columnMap[column]) {
            row[column] = columnMap[column](client);
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
      XLSX.utils.book_append_sheet(wb, ws, "Clients");

      // Generate filename with current date
      const currentDate = new Date().toISOString().split("T")[0];
      const filename = `clients_export_${currentDate}.xlsx`;

      // Save the file
      XLSX.writeFile(wb, filename);

      // Show success message
      toast.success(
        `Successfully exported ${exportData.length} clients to ${filename}`,
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
          : [...prev, clientType]
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

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleReset = () => {
    setSearch("");
    setSortField("client_name");
    setSortOrder("asc");
    setSelectedClientType([...distinctClientType]); // Reset to all roles selected
  };

  // Local helpers (formatters, validators)
  const isAnyFilterActive = () => {
    return (
      search !== "" || // Search is not empty
      selectedClientType.length !== distinctClientType.length || // Role filter is not showing all roles
      sortField !== "client_name" || // Sort field is not default
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

  // Pagination calculations
  const totalItems = filteredAndSortedClients.length;
  const totalPages =
    itemsPerPage === 0 ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedClients = filteredAndSortedClients.slice(startIndex, endIndex);

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
                    Loading clients details...
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
                      Clients
                    </h1>
                    <TabsController
                      href="/admin/clients/addclient"
                      title="Add Client"
                    >
                      <div className="cursor-pointer hover:bg-primary transition-all duration-200 bg-primary/80 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm">
                        <Plus className="h-4 w-4" />
                        Add Client
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
                            placeholder="Search Client with name, client type"
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
                                setShowClientTypeFilterDropdown(
                                  !showClientTypeFilterDropdown
                                )
                              }
                              className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                            >
                              <Funnel className="h-4 w-4" />
                              <span>Filter by Client Type</span>
                              {distinctClientType.length -
                                selectedClientType.length >
                                0 && (
                                  <span className="bg-primary text-white text-xs font-semibold px-2 py-1 rounded-full">
                                    {distinctClientType.length -
                                      selectedClientType.length}
                                  </span>
                                )}
                            </button>
                            {showClientTypeFilterDropdown && (
                              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                                <div className="py-1">
                                  <label className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 sticky top-0 bg-white border-b border-slate-200 cursor-pointer">
                                    <span className="font-semibold">Select All</span>
                                    <input
                                      type="checkbox"
                                      checked={selectedClientType.length === distinctClientType.length}
                                      onChange={() => handleClientTypeToggle("Select All")}
                                      className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                                    />
                                  </label>
                                  {distinctClientType.map((role) => (
                                    <label
                                      key={role}
                                      className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                                    >
                                      <span>{role}</span>
                                      <input
                                        type="checkbox"
                                        checked={selectedClientType.includes(role)}
                                        onChange={() => handleClientTypeToggle(role)}
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
                                    onClick={() => handleSort("client_name")}
                                    className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Client Name {getSortIcon("client_name")}
                                  </button>
                                  <button
                                    onClick={() => handleSort("client_type")}
                                    className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Client Type {getSortIcon("client_type")}
                                  </button>
                                  <button
                                    onClick={() => handleSort("client_email")}
                                    className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Client Email {getSortIcon("client_email")}
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleSort("active_projects")
                                    }
                                    className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Active Projects{" "}
                                    {getSortIcon("active_projects")}
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleSort("completed_projects")
                                    }
                                    className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Completed Projects{" "}
                                    {getSortIcon("completed_projects")}
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
                                filteredAndSortedClients.length === 0 ||
                                selectedColumns.length === 0
                              }
                              className={`flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 border-r-0 px-3 py-2 rounded-l-lg text-sm font-medium ${isExporting ||
                                filteredAndSortedClients.length === 0 ||
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
                                filteredAndSortedClients.length === 0
                              }
                              className={`flex items-center transition-all duration-200 text-slate-700 border border-slate-300 px-2 py-2 rounded-r-lg text-sm font-medium ${isExporting ||
                                filteredAndSortedClients.length === 0
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

                    {/* Scrollable Table Section */}
                    <div className="flex-1 overflow-auto">
                      <div className="min-w-full">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                              <th
                                className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                onClick={() => handleSort("client_name")}
                              >
                                <div className="flex items-center gap-2">
                                  Client Name
                                  {getSortIcon("client_name")}
                                </div>
                              </th>
                              <th
                                className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                onClick={() => handleSort("client_type")}
                              >
                                <div className="flex items-center gap-2">
                                  Client Type
                                  {getSortIcon("client_type")}
                                </div>
                              </th>
                              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider">
                                Client Email
                              </th>
                              <th
                                className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                onClick={() => handleSort("active_projects")}
                              >
                                <div className="flex items-center gap-2">
                                  Active Projects
                                  {getSortIcon("active_projects")}
                                </div>
                              </th>
                              <th
                                className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                onClick={() => handleSort("completed_projects")}
                              >
                                <div className="flex items-center gap-2">
                                  Completed Projects
                                  {getSortIcon("completed_projects")}
                                </div>
                              </th>
                            </tr>
                          </thead>

                          <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                              <tr>
                                <td
                                  className="px-4 py-4 text-sm text-slate-500 text-center"
                                  colSpan={5}
                                >
                                  Loading clients...
                                </td>
                              </tr>
                            ) : error ? (
                              <tr>
                                <td
                                  className="px-4 py-4 text-sm text-red-600 text-center"
                                  colSpan={5}
                                >
                                  {error}
                                </td>
                              </tr>
                            ) : paginatedClients.length === 0 ? (
                              <tr>
                                <td
                                  className="px-4 py-4 text-sm text-slate-500 text-center"
                                  colSpan={5}
                                >
                                  {search
                                    ? "No clients found matching your search"
                                    : "No clients found"}
                                </td>
                              </tr>
                            ) : (
                              paginatedClients.map((e) => (
                                <tr
                                  key={e.client_id}
                                  onClick={() => {
                                    router.push(
                                      `/admin/clients/${e.client_id}`
                                    );
                                    dispatch(
                                      replaceTab({
                                        id: uuidv4(),
                                        title: e.client_name,
                                        href: `/admin/clients/${e.client_id}`,
                                      })
                                    );
                                  }}
                                  className="cursor-pointer hover:bg-slate-50 transition-colors duration-200"
                                >
                                  <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap font-medium">
                                    {e.client_name || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                    {e.client_type || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">
                                    {e.client_email || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                    <span className="inline-flex items-center justify-center min-w-8 px-2 py-1 bg-blue-50 text-blue-700 rounded-md font-medium">
                                      {countActiveProjects(e)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                    <span className="inline-flex items-center justify-center min-w-8 px-2 py-1 bg-green-50 text-green-700 rounded-md font-medium">
                                      {countCompletedProjects(e)}
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
                    {!loading && !error && paginatedClients.length > 0 && (
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
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </AdminRoute>
  );
}
