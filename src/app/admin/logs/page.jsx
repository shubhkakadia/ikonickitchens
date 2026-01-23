"use client";
import React from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
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
} from "lucide-react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useEffect, useMemo, useState } from "react";
import { useExcelExport } from "@/hooks/useExcelExport";
import SearchBar from "@/components/SearchBar";

export default function page() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showEntityTypeFilterDropdown, setShowEntityTypeFilterDropdown] =
    useState(false);
  const [showActionFilterDropdown, setShowActionFilterDropdown] =
    useState(false);
  const [showDateFilterDropdown, setShowDateFilterDropdown] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedEntityTypes, setSelectedEntityTypes] = useState([]);
  const [selectedActions, setSelectedActions] = useState([]);
  const [hasInitializedFilters, setHasInitializedFilters] = useState(false);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const { getToken } = useAuth();

  // Define all available columns for export
  const availableColumns = [
    "Date/Time",
    "Entity Type",
    "Action",
    "Description",
    "Entity ID",
    "Username",
    "ID",
  ];

  // Initialize selected columns with all columns
  const [selectedColumns, setSelectedColumns] = useState([...availableColumns]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) {
        setShowSortDropdown(false);
        setShowEntityTypeFilterDropdown(false);
        setShowActionFilterDropdown(false);
        setShowDateFilterDropdown(false);
        setShowColumnDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
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

  // Initialize filters with all values when data changes (only once)
  useEffect(() => {
    if (
      (distinctEntityTypes.length > 0 || distinctActions.length > 0) &&
      !hasInitializedFilters
    ) {
      setSelectedEntityTypes([...distinctEntityTypes]);
      setSelectedActions([...distinctActions]);
      setHasInitializedFilters(true);
    }
  }, [distinctEntityTypes, distinctActions, hasInitializedFilters]);

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

      // Entity type filter
      if (selectedEntityTypes.length === 0) {
        return false;
      }

      if (!selectedEntityTypes.includes(log.entity_type)) {
        return false;
      }

      // Action filter
      if (selectedActions.length === 0) {
        return false;
      }

      if (!selectedActions.includes(log.action)) {
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
  const totalPages =
    itemsPerPage === 0 ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedLogs = filteredAndSortedLogs.slice(startIndex, endIndex);

  // Reset to first page when search, items per page, or date filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, startDate, endDate]);

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
      setSortOrder(field === "createdAt" ? "desc" : "asc");
    }
    setShowSortDropdown(false);
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
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
    setSearch("");
    setSortField("createdAt");
    setSortOrder("desc");
    setStartDate("");
    setEndDate("");
    setSelectedEntityTypes([...distinctEntityTypes]);
    setSelectedActions([...distinctActions]);
    setCurrentPage(1);
    setHasInitializedFilters(true);
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

  // Check if any filters are active (not in default state)
  const isAnyFilterActive = () => {
    return (
      search !== "" ||
      startDate !== "" ||
      endDate !== "" ||
      selectedEntityTypes.length !== distinctEntityTypes.length ||
      selectedActions.length !== distinctActions.length ||
      sortField !== "createdAt" ||
      sortOrder !== "desc"
    );
  };

  const getSortIcon = (field) => {
    if (sortField !== field)
      return <ArrowUpDown className="h-4 w-4 text-slate-400" />;
    if (sortOrder === "asc")
      return <ArrowUp className="h-4 w-4 text-primary" />;
    if (sortOrder === "desc")
      return <ArrowDown className="h-4 w-4 text-primary" />;
    return null;
  };

  useEffect(() => {
    const fetchLogs = async () => {
      try {
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
          url: "/api/logs",
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
              setLogs(response.data.data);
            } else {
              setError(response.data.message);
            }
          })
          .catch((error) => {
            setLoading(false);
            console.error("Error fetching logs:", error);
            setError(error.response?.data?.message || "Failed to fetch logs");
          });
      } catch (error) {
        console.error("Error fetching logs:", error);
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

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

  const getActionColor = (action) => {
    switch (action) {
      case "CREATE":
        return "bg-green-100 text-green-700 border-green-200";
      case "UPDATE":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "DELETE":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
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
                    Loading logs...
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
                    <h1 className="text-xl font-bold text-slate-700">Logs</h1>
                    <SearchBar />
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
                            placeholder="Search logs by description, entity type, action, entity ID, username"
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
                                setShowDateFilterDropdown(
                                  !showDateFilterDropdown,
                                )
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
                            {showDateFilterDropdown && (
                              <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-4">
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                      Start Date
                                    </label>
                                    <input
                                      type="date"
                                      value={startDate}
                                      onChange={(e) =>
                                        setStartDate(e.target.value)
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
                                      onChange={(e) =>
                                        setEndDate(e.target.value)
                                      }
                                      min={startDate || undefined}
                                      className="w-full text-slate-800 p-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm font-normal"
                                    />
                                  </div>
                                  {(startDate || endDate) && (
                                    <button
                                      onClick={() => {
                                        setStartDate("");
                                        setEndDate("");
                                      }}
                                      className="w-full text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors duration-200"
                                    >
                                      Clear Dates
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="relative dropdown-container">
                            <button
                              onClick={() =>
                                setShowEntityTypeFilterDropdown(
                                  !showEntityTypeFilterDropdown,
                                )
                              }
                              className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                            >
                              <Funnel className="h-4 w-4" />
                              <span>Entity Type</span>
                              {distinctEntityTypes.length -
                                selectedEntityTypes.length >
                                0 && (
                                <span className="bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                                  {distinctEntityTypes.length -
                                    selectedEntityTypes.length}
                                </span>
                              )}
                            </button>
                            {showEntityTypeFilterDropdown && (
                              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                                <div className="py-1">
                                  <label className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 sticky top-0 bg-white border-b border-slate-200 cursor-pointer">
                                    <span className="font-semibold">
                                      Select All
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={
                                        selectedEntityTypes.length ===
                                        distinctEntityTypes.length
                                      }
                                      onChange={() =>
                                        handleEntityTypeToggle("Select All")
                                      }
                                      className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                                    />
                                  </label>
                                  {distinctEntityTypes.map((type) => (
                                    <label
                                      key={type}
                                      className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                                    >
                                      <span>{type}</span>
                                      <input
                                        type="checkbox"
                                        checked={selectedEntityTypes.includes(
                                          type,
                                        )}
                                        onChange={() =>
                                          handleEntityTypeToggle(type)
                                        }
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
                                setShowActionFilterDropdown(
                                  !showActionFilterDropdown,
                                )
                              }
                              className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                            >
                              <Funnel className="h-4 w-4" />
                              <span>Action</span>
                              {distinctActions.length - selectedActions.length >
                                0 && (
                                <span className="bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                                  {distinctActions.length -
                                    selectedActions.length}
                                </span>
                              )}
                            </button>
                            {showActionFilterDropdown && (
                              <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                                <div className="py-1">
                                  <label className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 sticky top-0 bg-white border-b border-slate-200 cursor-pointer">
                                    <span className="font-semibold">
                                      Select All
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={
                                        selectedActions.length ===
                                        distinctActions.length
                                      }
                                      onChange={() =>
                                        handleActionToggle("Select All")
                                      }
                                      className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                                    />
                                  </label>
                                  {distinctActions.map((action) => (
                                    <label
                                      key={action}
                                      className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                                    >
                                      <span>{action}</span>
                                      <input
                                        type="checkbox"
                                        checked={selectedActions.includes(
                                          action,
                                        )}
                                        onChange={() =>
                                          handleActionToggle(action)
                                        }
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
                                    onClick={() => handleSort("createdAt")}
                                    className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Date/Time {getSortIcon("createdAt")}
                                  </button>
                                  <button
                                    onClick={() => handleSort("entity_type")}
                                    className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Entity Type {getSortIcon("entity_type")}
                                  </button>
                                  <button
                                    onClick={() => handleSort("action")}
                                    className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Action {getSortIcon("action")}
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
                                filteredAndSortedLogs.length === 0 ||
                                selectedColumns.length === 0
                              }
                              className={`flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 border-r-0 px-3 py-2 rounded-l-lg text-sm font-medium ${
                                isExporting ||
                                filteredAndSortedLogs.length === 0 ||
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
                                filteredAndSortedLogs.length === 0
                              }
                              className={`flex items-center transition-all duration-200 text-slate-700 border border-slate-300 px-2 py-2 rounded-r-lg text-sm font-medium ${
                                isExporting ||
                                filteredAndSortedLogs.length === 0
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
                                    <span className="font-semibold">
                                      Select All
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={
                                        selectedColumns.length ===
                                        availableColumns.length
                                      }
                                      onChange={() =>
                                        handleColumnToggle("Select All")
                                      }
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
                                        checked={selectedColumns.includes(
                                          column,
                                        )}
                                        onChange={() =>
                                          handleColumnToggle(column)
                                        }
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
                                onClick={() => handleSort("createdAt")}
                              >
                                <div className="flex items-center gap-2">
                                  Date/Time
                                  {getSortIcon("createdAt")}
                                </div>
                              </th>
                              <th
                                className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                onClick={() => handleSort("entity_type")}
                              >
                                <div className="flex items-center gap-2">
                                  Entity Type
                                  {getSortIcon("entity_type")}
                                </div>
                              </th>
                              <th
                                className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                onClick={() => handleSort("action")}
                              >
                                <div className="flex items-center gap-2">
                                  Action
                                  {getSortIcon("action")}
                                </div>
                              </th>
                              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider">
                                Description
                              </th>
                              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider">
                                Entity ID
                              </th>
                              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider">
                                Username
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                              <tr>
                                <td
                                  className="px-4 py-4 text-sm text-slate-500 text-center"
                                  colSpan={6}
                                >
                                  Loading logs...
                                </td>
                              </tr>
                            ) : error ? (
                              <tr>
                                <td
                                  className="px-4 py-4 text-sm text-red-600 text-center"
                                  colSpan={6}
                                >
                                  {error}
                                </td>
                              </tr>
                            ) : paginatedLogs.length === 0 ? (
                              <tr>
                                <td
                                  className="px-4 py-4 text-sm text-slate-500 text-center"
                                  colSpan={6}
                                >
                                  {search
                                    ? "No logs found matching your search"
                                    : "No logs found"}
                                </td>
                              </tr>
                            ) : (
                              paginatedLogs.map((log) => (
                                <tr
                                  key={log.id}
                                  className="hover:bg-slate-50 transition-colors duration-200"
                                >
                                  <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                    {log.createdAt
                                      ? formatDateTime(log.createdAt)
                                      : "-"}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                    {log.entity_type || "-"}
                                  </td>
                                  <td className="px-4 py-3 text-sm">
                                    <span
                                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium border ${getActionColor(
                                        log.action,
                                      )}`}
                                    >
                                      {log.action || "-"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">
                                    <div title={log.description}>
                                      {log.description || "-"}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-600">
                                    <div
                                      className="max-w-xs truncate"
                                      title={log.entity_id}
                                    >
                                      {log.entity_id || "-"}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                    {log.user?.username || "-"}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Fixed Pagination Footer */}
                    {!loading && !error && paginatedLogs.length > 0 && (
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
