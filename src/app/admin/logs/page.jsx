"use client";
import React from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
import {
  ArrowUpDown,
  Funnel,
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
} from "lucide-react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "react-toastify";
import { useEffect, useMemo, useState } from "react";

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
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] =
    useState(false);
  const [showEntityTypeFilterDropdown, setShowEntityTypeFilterDropdown] =
    useState(false);
  const [showActionFilterDropdown, setShowActionFilterDropdown] =
    useState(false);
  const [selectedEntityTypes, setSelectedEntityTypes] = useState([]);
  const [selectedActions, setSelectedActions] = useState([]);
  const [hasInitializedFilters, setHasInitializedFilters] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { getToken } = useAuth();

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) {
        setShowSortDropdown(false);
        setShowItemsPerPageDropdown(false);
        setShowEntityTypeFilterDropdown(false);
        setShowActionFilterDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleExportToExcel = async () => {
    if (filteredAndSortedLogs.length === 0) {
      toast.warning(
        "No data to export. Please adjust your filters or wait for logs to load.",
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

      // Prepare data for export
      const exportData = filteredAndSortedLogs.map((log) => ({
        "Date/Time": log.createdAt
          ? new Date(log.createdAt).toLocaleString()
          : "",
        "Entity Type": log.entity_type || "",
        Action: log.action || "",
        Description: log.description || "",
        "Entity ID": log.entity_id || "",
        Username: log.user?.username || "",
        ID: log.id || "",
      }));

      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Create a worksheet from the data
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for better readability
      const colWidths = [
        { wch: 20 }, // Date/Time
        { wch: 20 }, // Entity Type
        { wch: 12 }, // Action
        { wch: 60 }, // Description
        { wch: 40 }, // Entity ID
        { wch: 20 }, // Username
        { wch: 40 }, // ID
      ];
      ws["!cols"] = colWidths;

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(wb, ws, "Logs");

      // Generate filename with current date
      const currentDate = new Date().toISOString().split("T")[0];
      const filename = `logs_export_${currentDate}.xlsx`;

      // Save the file
      XLSX.writeFile(wb, filename);

      // Show success message
      toast.success(
        `Successfully exported ${exportData.length} logs to ${filename}`,
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

      // Entity type filter
      if (selectedEntityTypes.length > 0) {
        if (!selectedEntityTypes.includes(log.entity_type)) return false;
      }

      // Action filter
      if (selectedActions.length > 0) {
        if (!selectedActions.includes(log.action)) return false;
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
  ]);

  // Pagination logic
  const totalItems = filteredAndSortedLogs.length;
  const totalPages =
    itemsPerPage === 0 ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedLogs = filteredAndSortedLogs.slice(startIndex, endIndex);

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
      setSortOrder(field === "createdAt" ? "desc" : "asc");
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

  const handleEntityTypeToggle = (type) => {
    if (type === "Select All") {
      if (selectedEntityTypes.length === distinctEntityTypes.length) {
        setSelectedEntityTypes([]);
      } else {
        setSelectedEntityTypes([...distinctEntityTypes]);
      }
    } else {
      setSelectedEntityTypes((prev) =>
        prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
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
          : [...prev, action]
      );
    }
  };

  const handleReset = () => {
    setSearch("");
    setSortField("createdAt");
    setSortOrder("desc");
    setSelectedEntityTypes([...distinctEntityTypes]);
    setSelectedActions([...distinctActions]);
    setCurrentPage(1);
    setItemsPerPage(25);
    setHasInitializedFilters(true);
  };

  // Check if any filters are active (not in default state)
  const isAnyFilterActive = () => {
    return (
      search !== "" ||
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
    fetchLogs();
  }, []);

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
          console.log(error);
          setError(error.response?.data?.message || "Failed to fetch logs");
        });
    } catch (error) {
      console.log(error);
      setLoading(false);
    }
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
            <div className="px-4 py-2 flex-shrink-0">
              <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold text-slate-700">Logs</h1>
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                {/* Fixed Header Section */}
                <div className="p-4 flex-shrink-0 border-b border-slate-200">
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
                            setShowEntityTypeFilterDropdown(
                              !showEntityTypeFilterDropdown
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
                          <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                            <div className="py-1">
                              <button
                                onClick={() =>
                                  handleEntityTypeToggle("Select All")
                                }
                                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                              >
                                <span>Select All</span>
                                <input
                                  type="checkbox"
                                  checked={
                                    selectedEntityTypes.length ===
                                    distinctEntityTypes.length
                                  }
                                  onChange={() => {}}
                                  className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                                />
                              </button>
                              {distinctEntityTypes.map((type) => (
                                <button
                                  key={type}
                                  onClick={() => handleEntityTypeToggle(type)}
                                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                >
                                  <span>{type}</span>
                                  <input
                                    type="checkbox"
                                    checked={selectedEntityTypes.includes(type)}
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
                          onClick={() =>
                            setShowActionFilterDropdown(
                              !showActionFilterDropdown
                            )
                          }
                          className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                        >
                          <Funnel className="h-4 w-4" />
                          <span>Action</span>
                          {distinctActions.length - selectedActions.length >
                            0 && (
                            <span className="bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                              {distinctActions.length - selectedActions.length}
                            </span>
                          )}
                        </button>
                        {showActionFilterDropdown && (
                          <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                            <div className="py-1">
                              <button
                                onClick={() => handleActionToggle("Select All")}
                                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                              >
                                <span>Select All</span>
                                <input
                                  type="checkbox"
                                  checked={
                                    selectedActions.length ===
                                    distinctActions.length
                                  }
                                  onChange={() => {}}
                                  className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                                />
                              </button>
                              {distinctActions.map((action) => (
                                <button
                                  key={action}
                                  onClick={() => handleActionToggle(action)}
                                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                >
                                  <span>{action}</span>
                                  <input
                                    type="checkbox"
                                    checked={selectedActions.includes(action)}
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
                      <button
                        onClick={handleExportToExcel}
                        disabled={
                          isExporting || filteredAndSortedLogs.length === 0
                        }
                        className={`flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium ${
                          isExporting || filteredAndSortedLogs.length === 0
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
                                : selectedEntityTypes.length === 0 ||
                                  selectedActions.length === 0
                                ? "No logs found - please select at least one entity type and action to view logs"
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
                                  ? new Date(log.createdAt).toLocaleString()
                                  : "-"}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                {log.entity_type || "-"}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium border ${getActionColor(
                                    log.action
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
                  <div className="px-4 py-3 flex-shrink-0 border-t border-slate-200 bg-slate-50">
                    <div className="flex items-center justify-between">
                      {/* Items per page dropdown and showing indicator */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600 font-medium">
                            Showing
                          </span>
                          <div className="relative dropdown-container">
                            <button
                              onClick={() =>
                                setShowItemsPerPageDropdown(
                                  !showItemsPerPageDropdown
                                )
                              }
                              className="cursor-pointer flex items-center gap-2 px-2 py-1 text-sm border border-slate-300 rounded-lg hover:bg-white transition-colors duration-200 bg-white font-medium"
                            >
                              <span>
                                {itemsPerPage === 0 ? "All" : itemsPerPage}
                              </span>
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            {showItemsPerPageDropdown && (
                              <div className="absolute bottom-full left-0 mb-1 w-20 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                                <div className="py-1">
                                  {[25, 50, 100, 0].map((value) => (
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
                          <span className="text-sm text-slate-600 font-medium">
                            of {totalItems} results
                          </span>
                        </div>
                      </div>

                      {/* Pagination buttons - only show when not showing all items */}
                      {itemsPerPage > 0 && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handlePageChange(1)}
                            disabled={currentPage === 1}
                            className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
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
                                    className={`cursor-pointer px-3 py-1 text-sm rounded-lg transition-colors duration-200 font-medium ${
                                      currentPage === pageNum
                                        ? "bg-primary text-white shadow-sm"
                                        : "text-slate-600 hover:bg-white"
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
                            className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handlePageChange(totalPages)}
                            disabled={currentPage === totalPages}
                            className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                          >
                            <ChevronsRight className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminRoute>
  );
}
