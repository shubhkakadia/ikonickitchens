"use client";
import { AdminRoute } from "@/components/ProtectedRoute";
import CRMLayout from "@/components/tabs";
import React, { useEffect, useState, useMemo, useRef } from "react";
import Sidebar from "@/components/sidebar";
import { stages } from "@/components/constants";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Search,
  Funnel,
  Sheet,
  RotateCcw,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";

export default function page() {
  const { getToken } = useAuth();
  const [activeLots, setActiveLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilters, setStageFilters] = useState({});
  const [isExporting, setIsExporting] = useState(false);
  const [showFilterDropdowns, setShowFilterDropdowns] = useState({});
  const [dropdownPositions, setDropdownPositions] = useState({});
  const filterButtonRefs = useRef({});
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Define all available columns for export
  const availableColumns = useMemo(() => {
    return ["Project Name", "Lot ID", ...stages];
  }, []);

  // Initialize selected columns with all columns
  const [selectedColumns, setSelectedColumns] = useState(() => [
    "Project Name",
    "Lot ID",
    ...stages,
  ]);

  useEffect(() => {
    fetchActiveLots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchActiveLots = async () => {
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

      const config = {
        method: "get",
        maxBodyLength: Infinity,
        url: "/api/lot/active",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      };

      const response = await axios.request(config);

      if (response.data.status) {
        setActiveLots(response.data.data);
      } else {
        setError(response.data.message);
      }
    } catch (error) {
      console.error("Error fetching active lots:", error);
      setError(error.response?.data?.message || "Failed to fetch active lots");
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get stage status for a lot
  const getStageStatus = (lot, stageName) => {
    // Stage names are stored in lowercase in the database, so we need case-insensitive comparison
    const stage = lot.stages?.find(
      (s) => s.name.toLowerCase() === stageName.toLowerCase()
    );
    if (!stage) {
      return "NOT_STARTED";
    }
    return stage.status;
  };

  // Helper function to format status for display
  const formatStatus = (status) => {
    switch (status) {
      case "IN_PROGRESS":
        return "in progress";
      case "DONE":
        return "done";
      case "NOT_STARTED":
        return "not started";
      case "NA":
        return "NA";
      default:
        return "not started";
    }
  };

  // Helper function to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case "IN_PROGRESS":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "DONE":
        return "bg-green-100 text-green-800 border-green-200";
      case "NOT_STARTED":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "NA":
        return "bg-slate-100 text-slate-600 border-slate-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Filter lots based on search and stage filters
  const filteredLots = useMemo(() => {
    return activeLots.filter((lot) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const projectName = (lot.project?.name || "").toLowerCase();
        const lotId = (lot.lot_id || "").toLowerCase();
        if (
          !projectName.includes(searchLower) &&
          !lotId.includes(searchLower)
        ) {
          return false;
        }
      }

      // Stage filters
      for (const [stageName, filterStatus] of Object.entries(stageFilters)) {
        if (filterStatus && filterStatus !== "ALL") {
          // Get stage status inline to avoid dependency issues
          const stage = lot.stages?.find(
            (s) => s.name.toLowerCase() === stageName.toLowerCase()
          );
          const lotStageStatus = stage ? stage.status : "NOT_STARTED";

          if (lotStageStatus !== filterStatus) {
            return false;
          }
        }
      }

      return true;
    });
  }, [activeLots, search, stageFilters]);

  // Handle stage filter change
  const handleStageFilterChange = (stageName, status) => {
    setStageFilters((prev) => {
      const newFilters = { ...prev };
      if (status === "ALL" || !status) {
        delete newFilters[stageName];
      } else {
        newFilters[stageName] = status;
      }
      return newFilters;
    });
    setShowFilterDropdowns((prev) => ({ ...prev, [stageName]: false }));
  };

  // Handle filter button click - calculate position
  const handleFilterButtonClick = (stage, event) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();

    setDropdownPositions((prev) => ({
      ...prev,
      [stage]: {
        top: rect.bottom + window.scrollY + 4,
        right: window.innerWidth - rect.right + window.scrollX,
      },
    }));

    setShowFilterDropdowns((prev) => ({
      ...prev,
      [stage]: !prev[stage],
    }));
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearch("");
    setStageFilters({});
  };

  // Handle column toggle
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

  // Check if any filters are active
  const hasActiveFilters = search || Object.keys(stageFilters).length > 0;

  // Export to Excel
  const handleExportToExcel = async () => {
    if (filteredLots.length === 0) {
      toast.warning(
        "No data to export. Please adjust your filters or add lots.",
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
        "Project Name": (lot) => lot.project?.name || "N/A",
        "Lot ID": (lot) => lot.lot_id || "",
      };

      // Add stage columns to the map
      stages.forEach((stage) => {
        columnMap[stage] = (lot) => {
          const status = getStageStatus(lot, stage);
          return formatStatus(status);
        };
      });

      // Add stage widths
      stages.forEach(() => {
        // We'll set stage widths to 18 in the export
      });

      // Prepare data for export - only include selected columns
      const exportData = filteredLots.map((lot) => {
        const row = {};
        selectedColumns.forEach((column) => {
          if (columnMap[column]) {
            row[column] = columnMap[column](lot);
          }
        });
        return row;
      });

      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Create a worksheet from the data
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for selected columns only
      const colWidths = selectedColumns.map((column) => {
        if (column === "Project Name") return { wch: 25 };
        if (column === "Lot ID") return { wch: 15 };
        return { wch: 18 }; // Stage columns
      });
      ws["!cols"] = colWidths;

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(wb, ws, "Lots at a Glance");

      // Generate filename with current date
      const currentDate = new Date().toISOString().split("T")[0];
      const filename = `lots_at_glance_${currentDate}.xlsx`;

      // Save the file
      XLSX.writeFile(wb, filename);

      // Show success message
      toast.success(
        `Successfully exported ${exportData.length} lots to ${filename}`,
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".filter-dropdown-container")) {
        setShowFilterDropdowns({});
      }
      if (!event.target.closest(".dropdown-container")) {
        setShowColumnDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
                    Loading lots at a glance details...
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
                <div className="px-4 py-2 flex-shrink-0">
                  <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-slate-700">
                      Lots at a Glance
                    </h1>
                  </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                    {/* Fixed Header Section */}
                    <div className="p-4 flex-shrink-0 border-b border-slate-200">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        {/* Search */}
                        <div className="flex items-center gap-2 flex-1 max-w-sm relative">
                          <Search className="h-4 w-4 absolute left-3 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search by project name or lot ID"
                            className="w-full text-slate-800 p-2 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm font-normal"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Reset Button - Always visible when filters are active */}
                          {hasActiveFilters && (
                            <button
                              onClick={handleResetFilters}
                              className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                            >
                              <RotateCcw className="h-4 w-4" />
                              <span>Reset Filters</span>
                            </button>
                          )}
                          {/* Export to Excel */}
                          <div className="relative dropdown-container flex items-center">
                            <button
                              onClick={handleExportToExcel}
                              disabled={
                                isExporting ||
                                filteredLots.length === 0 ||
                                selectedColumns.length === 0
                              }
                              className={`flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 border-r-0 px-3 py-2 rounded-l-lg text-sm font-medium ${
                                isExporting ||
                                filteredLots.length === 0 ||
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
                                isExporting || filteredLots.length === 0
                              }
                              className={`flex items-center transition-all duration-200 text-slate-700 border border-slate-300 px-2 py-2 rounded-r-lg text-sm font-medium ${
                                isExporting || filteredLots.length === 0
                                  ? "opacity-50 cursor-not-allowed"
                                  : "cursor-pointer hover:bg-slate-100"
                              }`}
                            >
                              <ChevronDown className="h-5 w-5" />
                            </button>
                            {showColumnDropdown && (
                              <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                                <div className="py-1">
                                  <button
                                    onClick={() =>
                                      handleColumnToggle("Select All")
                                    }
                                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between sticky top-0 bg-white border-b border-slate-200"
                                  >
                                    <span className="font-semibold">
                                      Select All
                                    </span>
                                    <input
                                      type="checkbox"
                                      checked={
                                        selectedColumns.length ===
                                        availableColumns.length
                                      }
                                      onChange={() => {}}
                                      className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                                    />
                                  </button>
                                  {availableColumns.map((column) => (
                                    <button
                                      key={column}
                                      onClick={() => handleColumnToggle(column)}
                                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                    >
                                      <span>{column}</span>
                                      <input
                                        type="checkbox"
                                        checked={selectedColumns.includes(
                                          column
                                        )}
                                        onChange={() => {}}
                                        className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                                      />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Filter Dropdowns - Positioned fixed over the table */}
                    {stages.map((stage) => {
                      const filterStatus = stageFilters[stage] || "ALL";
                      if (
                        !showFilterDropdowns[stage] ||
                        !dropdownPositions[stage]
                      )
                        return null;

                      return (
                        <div
                          key={`dropdown-${stage}`}
                          className="fixed bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-40 filter-dropdown-container"
                          style={{
                            top: `${dropdownPositions[stage].top}px`,
                            right: `${dropdownPositions[stage].right}px`,
                          }}
                        >
                          <div className="py-1">
                            <button
                              onClick={() =>
                                handleStageFilterChange(stage, "ALL")
                              }
                              className={`cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 ${
                                filterStatus === "ALL"
                                  ? "bg-slate-100 font-medium"
                                  : ""
                              }`}
                            >
                              All Statuses
                            </button>
                            <button
                              onClick={() =>
                                handleStageFilterChange(stage, "NOT_STARTED")
                              }
                              className={`cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 ${
                                filterStatus === "NOT_STARTED"
                                  ? "bg-slate-100 font-medium"
                                  : ""
                              }`}
                            >
                              Not Started
                            </button>
                            <button
                              onClick={() =>
                                handleStageFilterChange(stage, "IN_PROGRESS")
                              }
                              className={`cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 ${
                                filterStatus === "IN_PROGRESS"
                                  ? "bg-slate-100 font-medium"
                                  : ""
                              }`}
                            >
                              In Progress
                            </button>
                            <button
                              onClick={() =>
                                handleStageFilterChange(stage, "DONE")
                              }
                              className={`cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 ${
                                filterStatus === "DONE"
                                  ? "bg-slate-100 font-medium"
                                  : ""
                              }`}
                            >
                              Done
                            </button>
                            <button
                              onClick={() =>
                                handleStageFilterChange(stage, "NA")
                              }
                              className={`cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 ${
                                filterStatus === "NA"
                                  ? "bg-slate-100 font-medium"
                                  : ""
                              }`}
                            >
                              NA
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Scrollable Table Section */}
                    <div className="flex-1 overflow-auto">
                      {loading ? (
                        <div className="p-8 text-center text-sm text-slate-500 font-medium">
                          Loading active lots...
                        </div>
                      ) : error ? (
                        <div className="p-8 text-center text-sm text-red-600 font-medium">
                          {error}
                        </div>
                      ) : activeLots.length === 0 ? (
                        <div className="p-8 text-center text-sm text-slate-500 font-medium">
                          No active lots found
                        </div>
                      ) : (
                        <div className="min-w-full">
                          <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                              <tr>
                                <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider sticky left-0 bg-slate-50 z-20 border-r border-slate-200">
                                  Project Name - Lot Number
                                </th>
                                {stages.map((stage) => {
                                  const filterStatus =
                                    stageFilters[stage] || "ALL";
                                  const hasFilter = filterStatus !== "ALL";

                                  return (
                                    <th
                                      key={stage}
                                      className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider min-w-[150px]"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="truncate">
                                          {stage}
                                        </span>
                                        <div className="relative filter-dropdown-container flex-shrink-0">
                                          <button
                                            ref={(el) =>
                                              (filterButtonRefs.current[stage] =
                                                el)
                                            }
                                            onClick={(e) =>
                                              handleFilterButtonClick(stage, e)
                                            }
                                            className={`cursor-pointer p-1 rounded hover:bg-slate-200 transition-colors ${
                                              hasFilter ? "bg-primary/20" : ""
                                            }`}
                                            title="Filter by status"
                                          >
                                            <Funnel
                                              className={`h-3 w-3 ${
                                                hasFilter
                                                  ? "text-primary"
                                                  : "text-slate-400"
                                              }`}
                                            />
                                          </button>
                                        </div>
                                      </div>
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                              {filteredLots.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={stages.length + 1}
                                    className="px-4 py-8 text-center text-sm text-slate-500"
                                  >
                                    <div className="flex flex-col items-center gap-3">
                                      <p>
                                        No lots match your filters. Try
                                        adjusting your search or filters.
                                      </p>
                                      {hasActiveFilters && (
                                        <button
                                          onClick={handleResetFilters}
                                          className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                                        >
                                          <RotateCcw className="h-4 w-4" />
                                          Reset Filters
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                filteredLots.map((lot) => (
                                  <tr
                                    key={lot.lot_id}
                                    className="group hover:bg-slate-50 transition-colors duration-200"
                                  >
                                    <td className="px-4 py-3 text-sm text-slate-700 font-medium sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 whitespace-nowrap">
                                      {lot.project?.name || "N/A"} -{" "}
                                      {lot.lot_id}
                                    </td>
                                    {stages.map((stage) => {
                                      const status = getStageStatus(lot, stage);
                                      const formattedStatus =
                                        formatStatus(status);
                                      const statusColor =
                                        getStatusColor(status);

                                      return (
                                        <td
                                          key={stage}
                                          className="px-4 py-3 text-sm"
                                        >
                                          <span
                                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium border ${statusColor}`}
                                          >
                                            {formattedStatus}
                                          </span>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
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
