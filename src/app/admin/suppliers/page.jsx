"use client";
import React, { useEffect, useState, useMemo, useRef } from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
import TabsController from "@/components/tabscontroller";
import PaginationFooter from "@/components/PaginationFooter";
import {
  Plus,
  Search,
  RotateCcw,
  ArrowUpDown,
  Sheet,
  ArrowUp,
  ArrowDown,
  ChevronDown,
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
import { useExcelExport } from "@/hooks/useExcelExport";

export default function page() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { getToken } = useAuth();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Refs for dropdown containers
  const sortDropdownRef = useRef(null);
  const columnDropdownRef = useRef(null);

  // Define all available columns for export
  const availableColumns = [
    "Supplier Name",
    "Email",
    "Phone",
    "Address",
    "Website",
    "Notes",
    "Total Statement Due",
    "Active PO Count",
    "Created At",
    "Updated At",
  ];

  // Initialize selected columns with all columns
  const [selectedColumns, setSelectedColumns] = useState([...availableColumns]);

  // Helper function to calculate total statement due
  const calculateTotalStatementDue = (supplier) => {
    const totalStatementDue =
      supplier.statements &&
        Array.isArray(supplier.statements)
        ? supplier.statements.reduce(
          (sum, statement) => {
            const amount =
              parseFloat(statement.amount) || 0;
            return sum + amount;
          },
          0
        )
        : 0;
    return totalStatementDue;
  };

  // Helper function to calculate active PO count
  const calculateActivePOCount = (supplier) => {
    const activePOCount =
      supplier.purchase_order &&
        Array.isArray(supplier.purchase_order)
        ? supplier.purchase_order.length
        : 0;
    return activePOCount;
  };

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
      let aValue, bValue;

      // Handle computed fields
      if (sortField === "total_statement_due") {
        aValue = calculateTotalStatementDue(a);
        bValue = calculateTotalStatementDue(b);
      } else if (sortField === "active_po_count") {
        aValue = calculateActivePOCount(a);
        bValue = calculateActivePOCount(b);
      } else {
        aValue = a[sortField] || "";
        bValue = b[sortField] || "";
      }

      // Handle numeric comparisons
      if (sortField === "total_statement_due" || sortField === "active_po_count") {
        if (sortOrder === "asc") {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      }

      // Handle string comparisons
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
      // Check if click is outside all dropdown containers
      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(event.target)
      ) {
        setShowSortDropdown(false);
      }
      if (
        columnDropdownRef.current &&
        !columnDropdownRef.current.contains(event.target)
      ) {
        setShowColumnDropdown(false);
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
        setLoading(false);
        return;
      }

      const response = await axios.get("/api/supplier/all", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      setLoading(false);
      if (response.data.status) {
        setSuppliers(response.data.data);
        setError(null);
      } else {
        setError(response.data.message || "Failed to fetch suppliers");
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      setLoading(false);
      setError(
        error.response?.data?.message || "Failed to fetch suppliers"
      );
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
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Reset to first page when search or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

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

  const getSortIcon = (field) => {
    if (sortField !== field)
      return <ArrowUpDown className="h-4 w-4 text-slate-400" />;
    if (sortOrder === "asc")
      return <ArrowUp className="h-4 w-4 text-primary" />;
    if (sortOrder === "desc")
      return <ArrowDown className="h-4 w-4 text-primary" />;
    return null;
  };

  // Column mapping for Excel export
  const columnMap = useMemo(() => ({
    "Supplier Name": (supplier) => supplier.name || "",
    Email: (supplier) => supplier.email || "",
    Phone: (supplier) => supplier.phone || "",
    Address: (supplier) => supplier.address || "",
    Website: (supplier) => supplier.website || "",
    Notes: (supplier) => supplier.notes || "",
    "Total Statement Due": (supplier) => {
      const totalStatementDue =
        supplier.statements && Array.isArray(supplier.statements)
          ? supplier.statements.reduce((sum, statement) => {
            const amount = parseFloat(statement.amount) || 0;
            return sum + amount;
          }, 0)
          : 0;
      return totalStatementDue > 0
        ? totalStatementDue.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
        : "0.00";
    },
    "Active PO Count": (supplier) => {
      const activePOCount =
        supplier.purchase_order && Array.isArray(supplier.purchase_order)
          ? supplier.purchase_order.length
          : 0;
      return activePOCount || 0;
    },
    "Created At": (supplier) =>
      supplier.createdAt
        ? new Date(supplier.createdAt).toLocaleDateString()
        : "",
    "Updated At": (supplier) =>
      supplier.updatedAt
        ? new Date(supplier.updatedAt).toLocaleDateString()
        : "",
  }), []);

  // Initialize Excel export hook
  const { exportToExcel, isExporting } = useExcelExport({
    columnMap,
    filenamePrefix: "suppliers_export",
    sheetName: "Suppliers",
    selectedColumns,
  });

  const handleExportToExcel = () => {
    exportToExcel(filteredAndSortedSuppliers);
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
                    Loading suppliers details...
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
                      Suppliers
                    </h1>
                    <TabsController
                      href="/admin/suppliers/addsupplier"
                      title="Add Supplier"
                    >
                      <div className="cursor-pointer hover:bg-primary transition-all duration-200 bg-primary/80 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm">
                        <Plus className="h-4 w-4" />
                        Add Supplier
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
                        <div className="flex items-center gap-2 flex-1 max-w-sm relative">
                          <Search className="h-4 w-4 absolute left-3 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search suppliers by name or email"
                            className="w-full text-slate-800 p-2 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm font-normal"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>

                        {/* reset, sort by, export to excel */}
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

                          <div className="relative" ref={sortDropdownRef}>
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
                                    onClick={() => handleSort("name")}
                                    className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Name {getSortIcon("name")}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="relative flex items-center" ref={columnDropdownRef}>
                            <button
                              onClick={handleExportToExcel}
                              disabled={
                                isExporting ||
                                filteredAndSortedSuppliers.length === 0 ||
                                selectedColumns.length === 0
                              }
                              className={`flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 border-r-0 px-3 py-2 rounded-l-lg text-sm font-medium ${isExporting ||
                                filteredAndSortedSuppliers.length === 0 ||
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
                                filteredAndSortedSuppliers.length === 0
                              }
                              className={`flex items-center transition-all duration-200 text-slate-700 border border-slate-300 px-2 py-2 rounded-r-lg text-sm font-medium ${isExporting ||
                                filteredAndSortedSuppliers.length === 0
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
                                onClick={() => handleSort("name")}
                              >
                                <div className="flex items-center gap-2">
                                  Name
                                  {getSortIcon("name")}
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
                                onClick={() => handleSort("total_statement_due")}
                              >
                                <div className="flex items-center gap-2">
                                  Total Statement Due
                                  {getSortIcon("total_statement_due")}
                                </div>
                              </th>
                              <th
                                className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                onClick={() => handleSort("active_po_count")}
                              >
                                <div className="flex items-center gap-2">
                                  Active PO Count
                                  {getSortIcon("active_po_count")}
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
                                  Loading suppliers...
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
                            ) : paginatedSuppliers.length === 0 ? (
                              <tr>
                                <td
                                  className="px-4 py-4 text-sm text-slate-500 text-center"
                                  colSpan={5}
                                >
                                  {search
                                    ? "No suppliers found matching your search"
                                    : "No suppliers found"}
                                </td>
                              </tr>
                            ) : (
                              paginatedSuppliers.map((supplier) => {
                                // Calculate total statement due
                                const totalStatementDue = calculateTotalStatementDue(supplier);

                                // Calculate active PO count
                                const activePOCount = calculateActivePOCount(supplier);

                                return (
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
                                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap font-medium">
                                      {supplier.name || "-"}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600">
                                      {supplier.email || "-"}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                      {supplier.phone || "-"}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                      {totalStatementDue > 0
                                        ? `$${totalStatementDue.toLocaleString(
                                          "en-US",
                                          {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          }
                                        )}`
                                        : "-"}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                      {activePOCount > 0 ? activePOCount : "-"}
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
                    {!loading && !error && paginatedSuppliers.length > 0 && (
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
