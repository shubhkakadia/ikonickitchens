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
  ArrowUpDown,
  Sheet,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] =
    useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filter and sort suppliers
  const filteredAndSortedSuppliers = useMemo(() => {
    let filtered = suppliers.filter((supplier) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          (supplier.name &&
            supplier.name.toLowerCase().includes(searchLower)) ||
          (supplier.email &&
            supplier.email.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      return true;
    });

    // Sort suppliers
    filtered.sort((a, b) => {
      let aValue = a[sortField] || "";
      let bValue = b[sortField] || "";

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
  }, [suppliers, search, sortField, sortOrder]);

  // Pagination logic
  const totalItems = filteredAndSortedSuppliers.length;
  const totalPages =
    itemsPerPage === 0 ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedSuppliers = filteredAndSortedSuppliers.slice(
    startIndex,
    endIndex
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) {
        setShowSortDropdown(false);
        setShowItemsPerPageDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
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
      let config = {
        method: "get",
        maxBodyLength: Infinity,
        url: "/api/supplier/all",
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
            setSuppliers(response.data.data);
          } else {
            setError(response.data.message);
          }
        })
        .catch((error) => {
          setLoading(false);
          console.log(error);
          setError(
            error.response?.data?.message || "Failed to fetch suppliers"
          );
        });
    } catch (error) {
      console.log(error);
      setLoading(false);
      setError("An unexpected error occurred");
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> asc
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else {
        setSortOrder("asc");
      }
    } else {
      setSortField(field);
      setSortOrder("asc");
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
      sortField !== "name" || // Sort field is not default
      sortOrder !== "asc" // Sort order is not default
    );
  };

  const handleReset = () => {
    setSearch("");
    setSortField("name");
    setSortOrder("asc");
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    if (sortOrder === "asc") return <ArrowUp className="h-4 w-4" />;
    if (sortOrder === "desc") return <ArrowDown className="h-4 w-4" />;
    return null;
  };

  const handleExportToExcel = async () => {
    if (filteredAndSortedSuppliers.length === 0) {
      toast.warning(
        "No data to export. Please adjust your filters or add suppliers.",
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
      const exportData = filteredAndSortedSuppliers.map((supplier) => ({
        "Supplier Name": supplier.name || "",
        Email: supplier.email || "",
        Phone: supplier.phone || "",
        Address: supplier.address || "",
        Website: supplier.website || "",
        Notes: supplier.notes || "",
        "Created At": supplier.createdAt
          ? new Date(supplier.createdAt).toLocaleDateString()
          : "",
        "Updated At": supplier.updatedAt
          ? new Date(supplier.updatedAt).toLocaleDateString()
          : "",
      }));

      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Create a worksheet from the data
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for better readability
      const colWidths = [
        { wch: 20 }, // Supplier Name
        { wch: 25 }, // Email
        { wch: 15 }, // Phone
        { wch: 30 }, // Address
        { wch: 20 }, // Website
        { wch: 30 }, // Notes
        { wch: 12 }, // Created At
        { wch: 12 }, // Updated At
      ];
      ws["!cols"] = colWidths;

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(wb, ws, "Suppliers");

      // Generate filename with current date
      const currentDate = new Date().toISOString().split("T")[0];
      const filename = `suppliers_export_${currentDate}.xlsx`;

      // Save the file
      XLSX.writeFile(wb, filename);

      // Show success message
      toast.success(
        `Successfully exported ${exportData.length} suppliers to ${filename}`,
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
                  <p className="text-slate-600">Loading suppliers details...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="h-12 w-12 text-red-500 mx-auto mb-4">⚠️</div>
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
                  <h1 className="text-2xl font-bold text-slate-600">
                    Suppliers
                  </h1>
                  <TabsController
                    href="/admin/suppliers/addsupplier"
                    title="Add Supplier"
                  >
                    <div className="cursor-pointer hover:bg-primary transition-all duration-200 bg-primary/80 text-white px-4 py-2 rounded-md flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      Add Supplier
                    </div>
                  </TabsController>
                </div>
                <div className="mt-4 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 w-[500px] relative">
                      <Search className="h-5 w-5 absolute left-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search suppliers by name or email"
                        className="w-full text-slate-800 p-3 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>

                    {/* reset, sort by, export to excel */}
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
                                onClick={() => handleSort("name")}
                                className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                              >
                                Name {getSortIcon("name")}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={handleExportToExcel}
                        disabled={
                          isExporting || filteredAndSortedSuppliers.length === 0
                        }
                        className={`flex items-center gap-2 transition-all duration-200 text-slate-600 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium ${
                          isExporting || filteredAndSortedSuppliers.length === 0
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
                              onClick={() => handleSort("name")}
                            >
                              <div className="flex items-center gap-2">
                                Name
                                {getSortIcon("name")}
                              </div>
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Email
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                              Phone
                            </th>
                          </tr>
                        </thead>

                        <tbody className="bg-white divide-y divide-slate-100">
                          {loading ? (
                            <tr>
                              <td
                                className="px-4 py-6 text-sm text-slate-500"
                                colSpan={3}
                              >
                                Loading suppliers...
                              </td>
                            </tr>
                          ) : error ? (
                            <tr>
                              <td
                                className="px-4 py-6 text-sm text-red-600"
                                colSpan={3}
                              >
                                {error}
                              </td>
                            </tr>
                          ) : paginatedSuppliers.length === 0 ? (
                            <tr>
                              <td
                                className="px-4 py-6 text-sm text-slate-500"
                                colSpan={3}
                              >
                                {search
                                  ? "No suppliers found matching your search"
                                  : "No suppliers found"}
                              </td>
                            </tr>
                          ) : (
                            paginatedSuppliers.map((supplier) => (
                              <tr
                                key={supplier.supplier_id}
                                onClick={() => {
                                  router.push(
                                    `/admin/suppliers/${supplier.supplier_id}`
                                  );
                                  dispatch(
                                    replaceTab({
                                      id: uuidv4(),
                                      title: supplier.name,
                                      href: `/admin/suppliers/${supplier.supplier_id}`,
                                    })
                                  );
                                }}
                                className="cursor-pointer hover:bg-slate-50 transition-colors duration-200"
                              >
                                <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                  {supplier.name || "-"}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-700">
                                  {supplier.email || "-"}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                  {supplier.phone || "-"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination Controls */}
                  {!loading && !error && paginatedSuppliers.length > 0 && (
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
