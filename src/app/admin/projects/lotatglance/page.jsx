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
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { addTab, replaceTab } from "@/state/reducer/tabs";
import { v4 as uuidv4 } from "uuid";
import SearchBar from "@/components/SearchBar";

export default function page() {
  const { getToken } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();
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
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(null); // Format: "lot_id-stage_name"
  const [statusDropdownPositions, setStatusDropdownPositions] = useState({});
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Define all available columns for export
  const availableColumns = useMemo(() => {
    return [
      "Client Name",
      "Project Name",
      "Lot ID",
      "Percentage Completed",
      ...stages,
    ];
  }, []);

  // Initialize selected columns with all columns
  const [selectedColumns, setSelectedColumns] = useState(() => [
    "Client Name",
    "Project Name",
    "Lot ID",
    "Percentage Completed",
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
      (s) => s.name.toLowerCase() === stageName.toLowerCase(),
    );
    if (!stage) {
      return "NOT_STARTED";
    }
    return stage.status;
  };

  // Helper function to calculate percentage completed
  const getPercentageCompleted = (lot) => {
    if (!lot.stages || lot.stages.length === 0) {
      return 0;
    }
    const doneCount = lot.stages.filter(
      (stage) => stage.status === "DONE",
    ).length;
    return Math.round((doneCount / stages.length) * 100);
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

  // Helper function to get status box color (just the background)
  const getStatusBoxColor = (status) => {
    switch (status) {
      case "IN_PROGRESS":
        return "bg-yellow-400";
      case "DONE":
        return "bg-green-400";
      case "NOT_STARTED":
        return "bg-gray-400";
      case "NA":
        return "bg-slate-300";
      default:
        return "bg-gray-400";
    }
  };

  // Filter and sort lots based on search and stage filters
  const filteredLots = useMemo(() => {
    const filtered = activeLots.filter((lot) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const projectName = (lot.project?.name || "").toLowerCase();
        const lotId = (lot.lot_id || "").toLowerCase();
        const clientName = (
          lot.project?.client?.client_name || ""
        ).toLowerCase();
        if (
          !projectName.includes(searchLower) &&
          !lotId.includes(searchLower) &&
          !clientName.includes(searchLower)
        ) {
          return false;
        }
      }

      // Stage filters
      for (const [stageName, filterStatus] of Object.entries(stageFilters)) {
        if (filterStatus && filterStatus !== "ALL") {
          // Get stage status inline to avoid dependency issues
          const stage = lot.stages?.find(
            (s) => s.name.toLowerCase() === stageName.toLowerCase(),
          );
          const lotStageStatus = stage ? stage.status : "NOT_STARTED";

          if (lotStageStatus !== filterStatus) {
            return false;
          }
        }
      }
      return true;
    });

    // Sort by client name > project name > lot number
    return filtered.sort((a, b) => {
      // 1. Sort by client name
      const clientNameA = (a.project?.client?.client_name || "").toLowerCase();
      const clientNameB = (b.project?.client?.client_name || "").toLowerCase();
      if (clientNameA !== clientNameB) {
        return clientNameA.localeCompare(clientNameB);
      }

      // 2. Sort by project name
      const projectNameA = (a.project?.name || "").toLowerCase();
      const projectNameB = (b.project?.name || "").toLowerCase();
      if (projectNameA !== projectNameB) {
        return projectNameA.localeCompare(projectNameB);
      }

      // 3. Sort by lot number (extract numeric part from lot_id for proper numeric sorting)
      const lotIdA = a.lot_id || "";
      const lotIdB = b.lot_id || "";

      // Extract lot number from lot_id (e.g., "IK001-lot 1" -> "1")
      const extractLotNumber = (lotId) => {
        const match = lotId.match(/lot\s*(\d+)/i);
        if (match) {
          return parseInt(match[1], 10);
        }
        // If no numeric lot number found, try to extract any number at the end
        const numMatch = lotId.match(/(\d+)$/);
        if (numMatch) {
          return parseInt(numMatch[1], 10);
        }
        // Fallback to string comparison
        return lotId;
      };

      const lotNumA = extractLotNumber(lotIdA);
      const lotNumB = extractLotNumber(lotIdB);

      if (typeof lotNumA === "number" && typeof lotNumB === "number") {
        return lotNumA - lotNumB;
      }

      // Fallback to string comparison if numbers couldn't be extracted
      return lotIdA.localeCompare(lotIdB);
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
          : [...prev, column],
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
        },
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
        "Client Name": (lot) => lot.project?.client?.client_name || "N/A",
        "Project Name": (lot) => lot.project?.name || "N/A",
        "Lot ID": (lot) => lot.lot_id || "",
        "Percentage Completed": (lot) => `${getPercentageCompleted(lot)}%`,
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
        if (column === "Client Name") return { wch: 25 };
        if (column === "Project Name") return { wch: 25 };
        if (column === "Lot ID") return { wch: 15 };
        if (column === "Percentage Completed") return { wch: 20 };
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
        },
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

  // Handle project name click - navigate to project page
  const handleProjectNameClick = (lot, event) => {
    event.stopPropagation();
    if (!lot.project?.project_id) {
      toast.error("Project ID not found", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
      return;
    }

    const projectHref = `/admin/projects/${lot.project.project_id}`;
    router.push(projectHref);
    dispatch(
      replaceTab({
        id: uuidv4(),
        title: lot.project.name,
        href: projectHref,
      }),
    );
  };

  // Handle client name click - navigate to client page
  const handleClientNameClick = (lot, event) => {
    event.stopPropagation();
    if (!lot.project?.client?.client_id) {
      toast.error("Client ID not found", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
      return;
    }

    const clientHref = `/admin/clients/${lot.project.client.client_id}`;
    router.push(clientHref);
    dispatch(
      replaceTab({
        id: uuidv4(),
        title: lot.project.client.client_name,
        href: clientHref,
      }),
    );
  };

  // Handle status square click
  const handleStatusSquareClick = (lot, stage, event) => {
    const button = event.currentTarget;
    const rect = button.getBoundingClientRect();
    const dropdownKey = `${lot.lot_id}-${stage}`;

    // Standard left alignment
    // Use viewport coordinates for fixed positioning
    let leftPosition = rect.left;

    // Check if dropdown will go off screen (w-40 is 160px)
    const dropdownWidth = 160;
    const windowWidth = window.innerWidth;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

    // Add a small buffer (10px) and account for scrollbar
    if (leftPosition + dropdownWidth > windowWidth - scrollbarWidth - 10) {
      // Align right edge of dropdown with right edge of button
      leftPosition = rect.right - dropdownWidth;
    }

    // Vertical alignment
    const dropdownHeight = 200; // Estimate height with buffer
    const windowHeight = window.innerHeight;

    let topPosition = rect.bottom + 4;
    let bottomPosition = null;

    if (topPosition + dropdownHeight > windowHeight) {
      // Position above the button
      topPosition = null;
      bottomPosition = windowHeight - rect.top + 4;
    }

    setStatusDropdownPositions((prev) => ({
      ...prev,
      [dropdownKey]: {
        top: topPosition,
        bottom: bottomPosition,
        left: leftPosition,
      },
    }));

    setStatusDropdownOpen(
      statusDropdownOpen === dropdownKey ? null : dropdownKey,
    );
  };

  // Handle stage status update
  const handleStageStatusUpdate = async (lot, stage, newStatus) => {
    try {
      setIsUpdatingStatus(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      // Find the stage object for this lot and stage name
      const stageObj = lot.stages?.find(
        (s) => s.name.toLowerCase() === stage.toLowerCase(),
      );

      if (!stageObj || !stageObj.stage_id) {
        // Stage doesn't exist yet, we need to create it
        const createResponse = await axios.post(
          "/api/stage/create",
          {
            lot_id: lot.lot_id,
            name: stage.toLowerCase(),
            status: newStatus,
            notes: "",
            startDate: null,
            endDate: null,
            assigned_to: [],
          },
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (createResponse.data.status) {
          toast.success("Stage status updated successfully", {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
          });
          setStatusDropdownOpen(null);
          fetchActiveLots();
        } else {
          toast.error(
            createResponse.data.message || "Failed to update stage status",
          );
        }
      } else {
        // Stage exists, update it
        const response = await axios.patch(
          `/api/stage/${stageObj.stage_id}`,
          {
            name: stageObj.name,
            status: newStatus,
            notes: stageObj.notes || "",
            startDate: stageObj.startDate || null,
            endDate: stageObj.endDate || null,
            assigned_to:
              stageObj.assigned_to?.map((a) =>
                typeof a === "string" ? a : a.employee_id || a,
              ) || [],
          },
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (response.data.status) {
          toast.success("Stage status updated successfully", {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
          });
          setStatusDropdownOpen(null);
          fetchActiveLots();
        } else {
          toast.error(response.data.message || "Failed to update stage status");
        }
      }
    } catch (error) {
      console.error("Error updating stage status:", error);
      toast.error("Failed to update stage status. Please try again.", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
    } finally {
      setIsUpdatingStatus(false);
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
      if (!event.target.closest(".status-dropdown-container")) {
        setStatusDropdownOpen(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close dropdowns when scrolling
  useEffect(() => {
    const handleScroll = () => {
      // Close all filter dropdowns
      setShowFilterDropdowns({});
      // Close column dropdown
      setShowColumnDropdown(false);
      // Close all status dropdowns
      setStatusDropdownOpen(null);
    };

    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
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
                <div className="px-4 py-2 shrink-0">
                  <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-slate-700">
                      Lots at a Glance
                    </h1>
                    <SearchBar />
                  </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                    {/* Fixed Header Section */}
                    <div className="p-4 shrink-0 border-b border-slate-200">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        {/* Search */}
                        <div className="flex items-center gap-2 flex-1 max-w-sm relative">
                          <Search className="h-4 w-4 absolute left-3 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search by client name, project name or lot ID"
                            className="w-full text-slate-800 p-2 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm font-normal"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Status Legend */}
                          <div className="flex items-center gap-3 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                            <span className="text-xs font-medium text-slate-600">
                              Status:
                            </span>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded bg-gray-400"></div>
                                <span className="text-xs text-slate-600">
                                  Not Started
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded bg-yellow-400"></div>
                                <span className="text-xs text-slate-600">
                                  In Progress
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div className="w-4 h-4 rounded bg-green-400"></div>
                                <span className="text-xs text-slate-600">
                                  Done
                                </span>
                              </div>
                            </div>
                          </div>
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
                          <table className="min-w-full divide-y divide-slate-200 table-fixed">
                            <thead className="bg-slate-50 sticky top-0 z-20">
                              <tr>
                                <th className="px-2 py-4 text-center text-sm font-semibold text-slate-600 uppercase tracking-wider h-[300px] border-r border-slate-200 sticky top-0 left-0 z-30 bg-slate-50 w-[250px] min-w-[250px] max-w-[250px]">
                                  Client Name
                                </th>
                                <th className="px-2 py-4 text-center text-sm font-semibold text-slate-600 uppercase tracking-wider h-[300px] border-r border-slate-200 sticky top-0 left-[200px] z-30 bg-slate-50 w-[500px] min-w-[500px] max-w-[500px]">
                                  Project Name - Lot Number
                                </th>
                                <th className="px-2 py-4 text-center text-sm font-semibold text-slate-600 uppercase tracking-wider w-[50px] h-[300px] border-r border-slate-200 sticky top-0 left-[700px] z-30 bg-slate-50">
                                  <div className="flex flex-col items-center justify-end gap-2 h-full">
                                    <span
                                      className="whitespace-nowrap"
                                      style={{
                                        writingMode: "vertical-rl",
                                        textOrientation: "mixed",
                                        transform: "rotate(180deg)",
                                      }}
                                    >
                                      Percentage Completed
                                    </span>
                                  </div>
                                </th>
                                {stages.map((stage) => {
                                  const filterStatus =
                                    stageFilters[stage] || "ALL";
                                  const hasFilter = filterStatus !== "ALL";

                                  return (
                                    <th
                                      key={stage}
                                      className="px-2 py-4 text-center text-sm font-semibold text-slate-600 uppercase tracking-wider w-[50px] h-[300px]"
                                    >
                                      <div className="flex flex-col items-center justify-end gap-2 h-full">
                                        <span
                                          className="whitespace-nowrap"
                                          style={{
                                            writingMode: "vertical-rl",
                                            textOrientation: "mixed",
                                            transform: "rotate(180deg)",
                                          }}
                                        >
                                          {stage}
                                        </span>

                                        <div className="relative filter-dropdown-container shrink-0">
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
                                    colSpan={stages.length + 3}
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
                                    <td
                                      onClick={(e) =>
                                        handleClientNameClick(lot, e)
                                      }
                                      className="px-4 py-3 text-sm text-slate-700 font-medium sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-blue-50 w-[250px] min-w-[250px] max-w-[250px]"
                                      title="Click to open client"
                                    >
                                      <span>
                                        {lot.project?.client?.client_name ||
                                          "N/A"}
                                      </span>
                                    </td>
                                    <td
                                      onClick={(e) =>
                                        handleProjectNameClick(lot, e)
                                      }
                                      className="px-4 py-3 text-sm text-slate-700 font-medium sticky left-[200px] bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 whitespace-nowrap cursor-pointer hover:bg-blue-50 w-[500px] min-w-[500px] max-w-[500px]"
                                      title="Click to open project"
                                    >
                                      {lot.project?.name || "N/A"} -{" "}
                                      {lot.lot_id}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700 font-medium text-center sticky left-[700px] bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 whitespace-nowrap w-[50px] min-w-[50px] max-w-[50px]">
                                      {getPercentageCompleted(lot)}%
                                    </td>
                                    {stages.map((stage) => {
                                      const status = getStageStatus(lot, stage);
                                      const boxColor =
                                        getStatusBoxColor(status);
                                      const dropdownKey = `${lot.lot_id}-${stage}`;
                                      const isDropdownOpen =
                                        statusDropdownOpen === dropdownKey;
                                      const dropdownPosition =
                                        statusDropdownPositions[dropdownKey];

                                      return (
                                        <td
                                          key={stage}
                                          className="px-2 py-3 text-sm text-center relative"
                                        >
                                          <div className="relative inline-block">
                                            <button
                                              onClick={(e) =>
                                                handleStatusSquareClick(
                                                  lot,
                                                  stage,
                                                  e,
                                                )
                                              }
                                              disabled={isUpdatingStatus}
                                              className={`inline-block w-6 h-6 rounded ${boxColor} cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed`}
                                              title={`${formatStatus(status)} - Click to change`}
                                            ></button>

                                            {isDropdownOpen &&
                                              dropdownPosition && (
                                                <div
                                                  className="fixed bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-40 status-dropdown-container"
                                                  style={{
                                                    top: dropdownPosition.top
                                                      ? `${dropdownPosition.top}px`
                                                      : "auto",
                                                    bottom:
                                                      dropdownPosition.bottom
                                                        ? `${dropdownPosition.bottom}px`
                                                        : "auto",
                                                    left: `${dropdownPosition.left}px`,
                                                  }}
                                                >
                                                  <div className="py-1">
                                                    <button
                                                      onClick={() =>
                                                        handleStageStatusUpdate(
                                                          lot,
                                                          stage,
                                                          "NOT_STARTED",
                                                        )
                                                      }
                                                      disabled={
                                                        isUpdatingStatus
                                                      }
                                                      className={`cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                                        status === "NOT_STARTED"
                                                          ? "bg-slate-100 font-medium"
                                                          : ""
                                                      }`}
                                                    >
                                                      Not Started
                                                    </button>
                                                    <button
                                                      onClick={() =>
                                                        handleStageStatusUpdate(
                                                          lot,
                                                          stage,
                                                          "IN_PROGRESS",
                                                        )
                                                      }
                                                      disabled={
                                                        isUpdatingStatus
                                                      }
                                                      className={`cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                                        status === "IN_PROGRESS"
                                                          ? "bg-slate-100 font-medium"
                                                          : ""
                                                      }`}
                                                    >
                                                      In Progress
                                                    </button>
                                                    <button
                                                      onClick={() =>
                                                        handleStageStatusUpdate(
                                                          lot,
                                                          stage,
                                                          "DONE",
                                                        )
                                                      }
                                                      disabled={
                                                        isUpdatingStatus
                                                      }
                                                      className={`cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                                        status === "DONE"
                                                          ? "bg-slate-100 font-medium"
                                                          : ""
                                                      }`}
                                                    >
                                                      Done
                                                    </button>
                                                  </div>
                                                </div>
                                              )}
                                          </div>
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
