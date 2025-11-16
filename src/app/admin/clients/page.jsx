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
  const [selectedClientType, setSelectedClientType] = useState([]);
  const [distinctClientType, setDistinctClientType] = useState([]);
  const [sortField, setSortField] = useState("client_name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [showClientTypeFilterDropdown, setShowClientTypeFilterDropdown] =
    useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [clients, setClients] = useState([]);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] =
    useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Helper function to count active projects (projects with at least one ACTIVE lot)
  const countActiveProjects = (client) => {
    if (!client.projects || client.projects.length === 0) return 0;
    return client.projects.filter((project) => {
      const lots = project.lots || [];
      if (lots.length === 0) return true; // Projects with no lots are considered active
      return lots.some((lot) => lot.status === "ACTIVE");
    }).length;
  };

  // Helper function to count completed projects (projects with at least one COMPLETED lot)
  const countCompletedProjects = (client) => {
    if (!client.projects || client.projects.length === 0) return 0;
    return client.projects.filter((project) => {
      const lots = project.lots || [];
      return lots.some((lot) => lot.status === "COMPLETED");
    }).length;
  };

  // Filter and sort employees
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

      // Role filter
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

  // Pagination logic
  const totalItems = filteredAndSortedClients.length;
  const totalPages =
    itemsPerPage === 0 ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedClients = filteredAndSortedClients.slice(startIndex, endIndex);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) {
        setShowSortDropdown(false);
        setShowItemsPerPageDropdown(false);
        setShowClientTypeFilterDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    fetchClients();
  }, []);

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
    } catch (error) {}
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

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
    setShowItemsPerPageDropdown(false);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Check if any filters are active (not in default state)
  const isAnyFilterActive = () => {
    return (
      search !== "" || // Search is not empty
      selectedClientType.length !== distinctClientType.length || // Role filter is not showing all roles
      sortField !== "client_name" || // Sort field is not default
      sortOrder !== "asc" // Sort order is not default
    );
  };

  const handleReset = () => {
    setSearch("");
    setSortField("client_name");
    setSortOrder("asc");
    setSelectedClientType([...distinctClientType]); // Reset to all roles selected
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    if (sortOrder === "asc") return <ArrowUp className="h-4 w-4" />;
    if (sortOrder === "desc") return <ArrowDown className="h-4 w-4" />;
    return null; // No icon for relevance
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

    setIsExporting(true);

    try {
      // Dynamic import of xlsx to avoid SSR issues
      const XLSX = await import("xlsx");

      // Prepare data for export - use filtered and sorted data with all fields
      const exportData = filteredAndSortedClients.map((client) => ({
        "Client ID": client.client_id || "",
        "Client Name": client.client_name || "",
        "Client Email": client.client_email || "",
        "Client Phone": client.client_phone || "",
        "Client Type": client.client_type || "",
        "Number of Projects": client.projects ? client.projects.length : 0,
        "Client Address": client.client_address || "",
        "Client Website": client.client_website || "",
        "Client Notes": client.client_notes || "",
        "Contact Name": client.contacts[0]?.first_name || "",
        "Contact Email": client.contacts[0]?.email || "",
        "Contact Phone": client.contacts[0]?.phone || "",
        "Contact Notes": client.contacts[0]?.notes || "",
        "Client Created At": client.createdAt
          ? new Date(client.createdAt).toLocaleDateString()
          : "",
        "Client Updated At": client.updatedAt
          ? new Date(client.updatedAt).toLocaleDateString()
          : "",
      }));

      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Create a worksheet from the data
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for better readability
      const colWidths = [
        { wch: 12 }, // Client ID
        { wch: 15 }, // Client Name
        { wch: 15 }, // Client Email
        { wch: 25 }, // Client Phone
        { wch: 15 }, // Client Type
        { wch: 15 }, // Number of Projects
        { wch: 30 }, // Client Address
        { wch: 20 }, // Client Website
        { wch: 18 }, // Client Notes
        { wch: 20 }, // Contact Name
        { wch: 18 }, // Contact Email
        { wch: 12 }, // Contact Phone
        { wch: 20 }, // Contact Notes
        { wch: 12 }, // Created At
        { wch: 12 }, // Updated At
      ];
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

  return (
    <AdminRoute>
      <div className="flex h-screen bg-tertiary">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CRMLayout />
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
                  <p className="text-slate-600">Loading clients details...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-red-600 mb-4">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="btn-primary"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-2">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-slate-600">Clients</h1>
                  <TabsController
                    href="/admin/clients/addclient"
                    title="Add Client"
                  >
                    <div className="cursor-pointer hover:bg-primary transition-all duration-200 bg-primary/80 text-white px-4 py-2 rounded-md flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Add Client
                    </div>
                  </TabsController>
                </div>
                <div className="mt-4 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 w-[500px] relative">
                      <Search className="h-5 w-5 absolute left-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search Client with name, client type"
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
                            setShowClientTypeFilterDropdown(
                              !showClientTypeFilterDropdown
                            )
                          }
                          className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-600 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium"
                        >
                          <Funnel className="h-4 w-4" />
                          <span>Filter by Client Type</span>
                          {distinctClientType.length -
                            selectedClientType.length >
                            0 && (
                            <span className="bg-primary text-white text-xs px-2 py-0.5 rounded-full">
                              {distinctClientType.length -
                                selectedClientType.length}
                            </span>
                          )}
                        </button>
                        {showClientTypeFilterDropdown && (
                          <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                            <div className="py-1">
                              <button
                                onClick={() =>
                                  handleClientTypeToggle("Select All")
                                }
                                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
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
                                  onClick={() => handleClientTypeToggle(role)}
                                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                >
                                  <span>{role}</span>
                                  <input
                                    type="checkbox"
                                    checked={selectedClientType.includes(role)}
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
                                onClick={() => handleSort("client_name")}
                                className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                              >
                                Client Name {getSortIcon("client_name")}
                              </button>
                              <button
                                onClick={() => handleSort("client_type")}
                                className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                              >
                                Client Type {getSortIcon("client_type")}
                              </button>
                              <button
                                onClick={() => handleSort("client_email")}
                                className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                              >
                                Client Email {getSortIcon("client_email")}
                              </button>
                              <button
                                onClick={() => handleSort("active_projects")}
                                className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                              >
                                Active Projects {getSortIcon("active_projects")}
                              </button>
                              <button
                                onClick={() => handleSort("completed_projects")}
                                className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                              >
                                Completed Projects{" "}
                                {getSortIcon("completed_projects")}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleExportToExcel}
                        disabled={
                          isExporting || filteredAndSortedClients.length === 0
                        }
                        className={`flex items-center gap-2 transition-all duration-200 text-slate-600 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium ${
                          isExporting || filteredAndSortedClients.length === 0
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
                            <th
                              className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("client_name")}
                            >
                              <div className="flex items-center gap-2">
                                Client Name
                                {getSortIcon("client_name")}
                              </div>
                            </th>
                            <th
                              className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("client_type")}
                            >
                              <div className="flex items-center gap-2">
                                Client Type
                                {getSortIcon("client_type")}
                              </div>
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Client Email
                            </th>
                            <th
                              className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("active_projects")}
                            >
                              <div className="flex items-center gap-2">
                                Active Projects
                                {getSortIcon("active_projects")}
                              </div>
                            </th>
                            <th
                              className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("completed_projects")}
                            >
                              <div className="flex items-center gap-2">
                                Completed Projects
                                {getSortIcon("completed_projects")}
                              </div>
                            </th>
                          </tr>
                        </thead>

                        <tbody className="bg-white divide-y divide-slate-100">
                          {loading ? (
                            <tr>
                              <td
                                className="px-4 py-6 text-sm text-slate-500"
                                colSpan={6}
                              >
                                Loading clients...
                              </td>
                            </tr>
                          ) : error ? (
                            <tr>
                              <td
                                className="px-4 py-6 text-sm text-red-600"
                                colSpan={6}
                              >
                                {error}
                              </td>
                            </tr>
                          ) : paginatedClients.length === 0 ? (
                            <tr>
                              <td
                                className="px-4 py-6 text-sm text-slate-500"
                                colSpan={6}
                              >
                                {search
                                  ? "No clients found matching your search"
                                  : selectedClientType.length === 0
                                  ? "No clients found - please select at least one role to view clients"
                                  : "No clients found"}
                              </td>
                            </tr>
                          ) : (
                            paginatedClients.map((e) => (
                              <tr
                                key={e.client_id}
                                onClick={() => {
                                  router.push(`/admin/clients/${e.client_id}`);
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
                                <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                  {e.client_name || "-"}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                  {e.client_type || "-"}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-700">
                                  {e.client_email || "-"}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                  {countActiveProjects(e)}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                  {countCompletedProjects(e)}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination Controls */}
                  {!loading && !error && paginatedClients.length > 0 && (
                    <div className="mt-6 flex items-center justify-between">
                      {/* Items per page dropdown and showing indicator */}
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">
                            Showing
                          </span>
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
            )}
          </div>
        </div>
      </div>
    </AdminRoute>
  );
}
