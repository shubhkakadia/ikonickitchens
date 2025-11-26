"use client";
import React, { useEffect, useState, useMemo } from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
import TabsController from "@/components/tabscontroller";
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { replaceTab } from "@/state/reducer/tabs";
import { v4 as uuidv4 } from "uuid";

export default function page() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { getToken } = useAuth();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("project_id");
  const [sortOrder, setSortOrder] = useState("asc");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [projects, setProjects] = useState([]);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showClientNameFilterDropdown, setShowClientNameFilterDropdown] =
    useState(false);
  const [selectedClientName, setSelectedClientName] = useState([]);
  const [distinctClientName, setDistinctClientName] = useState([]);
  const [selectedClientType, setSelectedClientType] = useState([]);
  const [distinctClientType, setDistinctClientType] = useState([]);
  const [showClientTypeFilterDropdown, setShowClientTypeFilterDropdown] =
    useState(false);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Define all available columns for export
  const availableColumns = [
    "Project ID",
    "Project Name",
    "Number of Lots",
    "Client",
    "Client Type",
    "Created At",
    "Updated At",
  ];

  // Initialize selected columns with all columns
  const [selectedColumns, setSelectedColumns] = useState([...availableColumns]);

  // Filter and sort projects
  const filteredAndSortedProjects = useMemo(() => {
    let filtered = projects.filter((project) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          (project.project_id &&
            project.project_id
              .toString()
              .toLowerCase()
              .includes(searchLower)) ||
          (project.name && project.name.toLowerCase().includes(searchLower)) ||
          (project.lots &&
            project.lots.length.toString().includes(searchLower)) ||
          project.client?.client_name?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }
      // Client Name filter
      if (
        selectedClientName.length > 0 &&
        selectedClientName.length < distinctClientName.length
      ) {
        // Check if "Unassigned" is selected and project has no client
        if (selectedClientName.includes("Unassigned")) {
          if (!project.client?.client_name) return true;
        }

        // Check if the project's client name is in the selected list
        const projectClientName = project.client?.client_name;

        if (
          !projectClientName ||
          !selectedClientName.includes(projectClientName)
        ) {
          return false;
        }
      }

      // Client Type filter
      if (
        selectedClientType.length > 0 &&
        selectedClientType.length < distinctClientType.length
      ) {
        // Check if the project's client type is in the selected list
        const projectClientType = project.client?.client_type;

        if (
          !projectClientType ||
          !selectedClientType.includes(projectClientType)
        ) {
          return false;
        }
      }

      return true;
    });

    // Sort projects
    filtered.sort((a, b) => {
      let aValue = a[sortField] || "";
      let bValue = b[sortField] || "";

      // Handle lots sorting (by count)
      if (sortField === "number_of_lots") {
        aValue = a.lots ? a.lots.length : 0;
        bValue = b.lots ? b.lots.length : 0;
      }

      // Handle relevance sorting (by search match)
      if (sortOrder === "relevance" && search) {
        const searchLower = search.toLowerCase();
        const aMatch = aValue.toString().toLowerCase().includes(searchLower);
        const bMatch = bValue.toString().toLowerCase().includes(searchLower);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }

      // Convert to string for comparison (except for lots which is numeric)
      if (sortField !== "number_of_lots") {
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
  }, [
    projects,
    search,
    sortField,
    sortOrder,
    selectedClientName,
    selectedClientType,
  ]);

  // Pagination logic
  const totalItems = filteredAndSortedProjects.length;
  const totalPages =
    itemsPerPage === 0 ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedProjects = filteredAndSortedProjects.slice(
    startIndex,
    endIndex
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) {
        setShowSortDropdown(false);
        setShowItemsPerPageDropdown(false);
        setShowClientNameFilterDropdown(false);
        setShowClientTypeFilterDropdown(false);
        setShowColumnDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
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
        url: "/api/project/all",
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
            setProjects(response.data.data);
            // Extract distinct client names from projects and add "Unassigned" option
            const names = [
              ...new Set(
                response.data.data
                  .map((project) => project.client?.client_name)
                  .filter(Boolean)
              ),
            ];
            const types = [
              ...new Set(
                response.data.data
                  .map((project) => project.client?.client_type)
                  .filter(Boolean)
              ),
            ];

            // Add "Unassigned" option if there are projects without clients
            const hasUnassignedProjects = response.data.data.some(
              (project) => !project.client?.client_name
            );

            if (hasUnassignedProjects) {
              names.push("Unassigned");
            }

            setDistinctClientName(names);
            setSelectedClientName(names); // Select all by default
            setDistinctClientType(types);
            setSelectedClientType(types); // Select all by default
          } else {
            setError(response.data.message);
          }
        })
        .catch((error) => {
          setLoading(false);
          console.log(error);
          setError(error.response?.data?.message || "Failed to fetch projects");
        });
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

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
  };

  const handleClientNameToggle = (clientName) => {
    if (clientName === "Select All") {
      if (selectedClientName.length === distinctClientName.length) {
        // If all client types are selected, unselect all (show no data)
        setSelectedClientName([]);
      } else {
        // If not all client types are selected, select all
        setSelectedClientName([...distinctClientName]);
      }
    } else {
      setSelectedClientName((prev) =>
        prev.includes(clientName)
          ? prev.filter((name) => name !== clientName)
          : [...prev, clientName]
      );
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
    setShowItemsPerPageDropdown(false);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Reset to first page when search or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, itemsPerPage]);

  // Check if any filters are active (not in default state)
  const isAnyFilterActive = () => {
    return (
      search !== "" || // Search is not empty
      selectedClientType.length !== distinctClientType.length || // Role filter is not showing all roles
      selectedClientName.length !== distinctClientName.length || // Client name filter is not showing all client names
      sortField !== "project_id" || // Sort field is not default
      sortOrder !== "asc" // Sort order is not default
    );
  };

  const handleReset = () => {
    setSearch("");
    setSortField("project_id");
    setSortOrder("asc");
    setSelectedClientName([...distinctClientName]); // Reset to all client names selected (including "Unassigned" if present)
    setSelectedClientType([...distinctClientType]); // Reset to all roles selected
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

  const handleExportToExcel = async () => {
    if (filteredAndSortedProjects.length === 0) {
      toast.warning(
        "No data to export. Please adjust your filters or add projects.",
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

      // Map of column names to their data extraction functions
      const columnMap = {
        "Project ID": (project) => project.project_id || "",
        "Project Name": (project) => project.name || "",
        "Number of Lots": (project) => (project.lots ? project.lots.length : 0),
        Client: (project) =>
          project.client?.client_name || "No client assigned",
        "Client Type": (project) => project.client?.client_type || "",
        "Created At": (project) =>
          project.createdAt
            ? new Date(project.createdAt).toLocaleDateString()
            : "",
        "Updated At": (project) =>
          project.updatedAt
            ? new Date(project.updatedAt).toLocaleDateString()
            : "",
      };

      // Column width map
      const columnWidthMap = {
        "Project ID": 12,
        "Project Name": 20,
        "Number of Lots": 15,
        Client: 25,
        "Client Type": 15,
        "Created At": 12,
        "Updated At": 12,
      };

      // Prepare data for export - only include selected columns
      const exportData = filteredAndSortedProjects.map((project) => {
        const row = {};
        selectedColumns.forEach((column) => {
          if (columnMap[column]) {
            row[column] = columnMap[column](project);
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
      XLSX.utils.book_append_sheet(wb, ws, "Projects");

      // Generate filename with current date
      const currentDate = new Date().toISOString().split("T")[0];
      const filename = `projects_export_${currentDate}.xlsx`;

      // Save the file
      XLSX.writeFile(wb, filename);

      // Show success message
      toast.success(
        `Successfully exported ${exportData.length} projects to ${filename}`,
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
  // Helper function to get client name from project
  const getClientName = (project) => {
    return project?.client?.client_name || null;
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
                    Loading projects details...
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
                      Projects
                    </h1>
                    <TabsController
                      href="/admin/projects/addproject"
                      title="Add Project"
                    >
                      <div className="cursor-pointer hover:bg-primary transition-all duration-200 bg-primary/80 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm">
                        <Plus className="h-4 w-4" />
                        Add Project
                      </div>
                    </TabsController>
                  </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                    {/* Fixed Header Section */}
                    <div className="p-4 flex-shrink-0 border-b border-slate-200">
                      <div className="flex items-center justify-between gap-3">
                        {/* search bar */}
                        <div className="flex items-center gap-2 flex-1 max-w-sm relative">
                          <Search className="h-4 w-4 absolute left-3 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search Project with name, project id"
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
                                <span className="bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                                  {distinctClientType.length -
                                    selectedClientType.length}
                                </span>
                              )}
                            </button>
                            {showClientTypeFilterDropdown && (
                              <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                                <div className="py-1">
                                  <button
                                    onClick={() =>
                                      handleClientTypeToggle("Select All")
                                    }
                                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    <span>Select All</span>
                                    <input
                                      type="checkbox"
                                      checked={
                                        selectedClientType.length ===
                                        distinctClientType.length
                                      }
                                      onChange={() => {}}
                                      className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                                    />
                                  </button>
                                  {distinctClientType.map((role) => (
                                    <button
                                      key={role}
                                      onClick={() =>
                                        handleClientTypeToggle(role)
                                      }
                                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                    >
                                      <span>{role}</span>
                                      <input
                                        type="checkbox"
                                        checked={selectedClientType.includes(
                                          role
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

                          <div className="relative dropdown-container">
                            <button
                              onClick={() =>
                                setShowClientNameFilterDropdown(
                                  !showClientNameFilterDropdown
                                )
                              }
                              className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                            >
                              <Funnel className="h-4 w-4" />
                              <span>Filter by Client Name</span>
                              {distinctClientName.length -
                                selectedClientName.length >
                                0 && (
                                <span className="bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                                  {distinctClientName.length -
                                    selectedClientName.length}
                                </span>
                              )}
                            </button>
                            {showClientNameFilterDropdown && (
                              <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                                <div className="py-1">
                                  <button
                                    onClick={() =>
                                      handleClientNameToggle("Select All")
                                    }
                                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    <span>Select All</span>
                                    <input
                                      type="checkbox"
                                      checked={
                                        selectedClientName.length ===
                                        distinctClientName.length
                                      }
                                      onChange={() => {}}
                                      className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                                    />
                                  </button>
                                  {distinctClientName.map((name) => (
                                    <button
                                      key={name}
                                      onClick={() =>
                                        handleClientNameToggle(name)
                                      }
                                      className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                    >
                                      <span>{name}</span>
                                      <input
                                        type="checkbox"
                                        onChange={() => {}}
                                        checked={selectedClientName.includes(
                                          name
                                        )}
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
                                    onClick={() => handleSort("project_id")}
                                    className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Project ID {getSortIcon("project_id")}
                                  </button>
                                  <button
                                    onClick={() => handleSort("name")}
                                    className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Project Name {getSortIcon("name")}
                                  </button>
                                  <button
                                    onClick={() => handleSort("number_of_lots")}
                                    className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Number of Lots{" "}
                                    {getSortIcon("number_of_lots")}
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
                                filteredAndSortedProjects.length === 0 ||
                                selectedColumns.length === 0
                              }
                              className={`flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 border-r-0 px-3 py-2 rounded-l-lg text-sm font-medium ${
                                isExporting ||
                                filteredAndSortedProjects.length === 0 ||
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
                                filteredAndSortedProjects.length === 0
                              }
                              className={`flex items-center transition-all duration-200 text-slate-700 border border-slate-300 px-2 py-2 rounded-r-lg text-sm font-medium ${
                                isExporting ||
                                filteredAndSortedProjects.length === 0
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

                    {/* Scrollable Table Section */}
                    <div className="flex-1 overflow-auto">
                      <div className="min-w-full">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                              <th
                                className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                onClick={() => handleSort("name")}
                              >
                                <div className="flex items-center gap-2">
                                  Name
                                  {getSortIcon("name")}
                                </div>
                              </th>
                              <th
                                className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                onClick={() => handleSort("project_id")}
                              >
                                <div className="flex items-center gap-2">
                                  Project ID
                                  {getSortIcon("project_id")}
                                </div>
                              </th>
                              <th
                                className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                onClick={() => handleSort("number_of_lots")}
                              >
                                <div className="flex items-center gap-2">
                                  Number of Lots
                                  {getSortIcon("number_of_lots")}
                                </div>
                              </th>
                              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider">
                                Client
                              </th>
                            </tr>
                          </thead>

                          <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                              <tr>
                                <td
                                  className="px-4 py-4 text-sm text-slate-500 text-center"
                                  colSpan={4}
                                >
                                  Loading projects...
                                </td>
                              </tr>
                            ) : error ? (
                              <tr>
                                <td
                                  className="px-4 py-4 text-sm text-red-600 text-center"
                                  colSpan={4}
                                >
                                  {error}
                                </td>
                              </tr>
                            ) : paginatedProjects.length === 0 ? (
                              <tr>
                                <td
                                  className="px-4 py-4 text-sm text-slate-500 text-center"
                                  colSpan={4}
                                >
                                  {search
                                    ? "No projects found matching your search"
                                    : "No projects found"}
                                </td>
                              </tr>
                            ) : (
                              paginatedProjects.map((project) => {
                                const clientName = getClientName(project);
                                return (
                                  <tr
                                    key={project.id}
                                    onClick={() => {
                                      router.push(
                                        `/admin/projects/${project.project_id}`
                                      );
                                      dispatch(
                                        replaceTab({
                                          id: uuidv4(),
                                          title: project.name,
                                          href: `/admin/projects/${project.project_id}`,
                                        })
                                      );
                                    }}
                                    className="cursor-pointer hover:bg-slate-50 transition-colors duration-200"
                                  >
                                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap font-medium">
                                      {project.name || "-"}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                      {project.project_id || "-"}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 bg-slate-50 text-slate-700 rounded-md font-medium">
                                        {project.lots ? project.lots.length : 0}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600">
                                      {clientName ? (
                                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 border border-blue-200">
                                          {clientName}
                                        </span>
                                      ) : (
                                        <span className="text-slate-400 text-xs">
                                          No client assigned
                                        </span>
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

                    {/* Fixed Pagination Footer */}
                    {!loading && !error && paginatedProjects.length > 0 && (
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
                                onClick={() =>
                                  handlePageChange(currentPage - 1)
                                }
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
                                        onClick={() =>
                                          handlePageChange(pageNum)
                                        }
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
                                onClick={() =>
                                  handlePageChange(currentPage + 1)
                                }
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
              </>
            )}
          </div>
        </div>
      </div>
    </AdminRoute>
  );
}
