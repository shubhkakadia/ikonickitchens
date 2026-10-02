"use client";
import { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { toast } from "react-toastify";
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
  Truck,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import PaginationFooter from "@/components/PaginationFooter";
import "react-toastify/dist/ReactToastify.css";
import { useExcelExport } from "@/hooks/useExcelExport";
import SearchBar from "@/components/SearchBar";
import {
  usePersistedTableFilter,
  useTableFilterActions,
} from "@/hooks/usePersistedTableFilter";

const TABLE_KEY = "suppliers";
const TABLE_COLUMNS = 6;

// Fields the list can be sorted by. Used by both the "Sort by" menu and the
// column headers so the two never drift apart.
const SORT_OPTIONS = [
  { field: "name", label: "Name" },
  { field: "total_statement_due", label: "Total statement due" },
  { field: "active_po_count", label: "Active PO count" },
];

// Statement amounts keep their cents, so this is not the shared whole-dollar
// formatCurrency. Australian locale and AUD per DESIGN.md 15.7.
const AUD_CENTS = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Excel dates follow the Australian locale (DESIGN.md 15.7).
const exportDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-AU") : "";

const MENU_ITEM =
  "cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between";
const MENU_CHECK_ROW =
  "cursor-pointer flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors";
const CHECKBOX =
  "h-4 w-4 accent-primary border-slate-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const TH =
  "px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider";

// Sortable column header. The label is a real button so the sort is reachable
// by keyboard (DESIGN.md 13.7); the active column carries the only indicator.
function SortHeader({
  field,
  label,
  sortField,
  sortOrder,
  onSort,
  icon,
  alignRight = false,
}) {
  const isActive = sortField === field;
  const ariaSort = isActive
    ? sortOrder === "asc"
      ? "ascending"
      : sortOrder === "desc"
        ? "descending"
        : undefined
    : undefined;

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`${TH} ${alignRight ? "text-right" : ""}`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`cursor-pointer flex items-center gap-2 uppercase tracking-wider hover:text-slate-700 transition-colors duration-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary ${
          alignRight ? "ml-auto" : ""
        }`}
      >
        {label}
        {icon}
      </button>
    </th>
  );
}

export default function SuppliersPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [search, setSearch] = usePersistedTableFilter(TABLE_KEY, "search", "");
  const [sortField, setSortField] = usePersistedTableFilter(
    TABLE_KEY,
    "sortField",
    "name",
  );
  const [sortOrder, setSortOrder] = usePersistedTableFilter(
    TABLE_KEY,
    "sortOrder",
    "asc",
  );
  const { resetFilters } = useTableFilterActions(TABLE_KEY);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

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

  // Suppliers have no image, so the avatar cell always falls back to initials.
  const supplierInitials = (supplierName) => {
    const words = String(supplierName || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (words.length === 0) return "—";
    return words
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join("");
  };

  // Helper function to calculate total statement due
  const calculateTotalStatementDue = (supplier) => {
    const totalStatementDue =
      supplier.statements && Array.isArray(supplier.statements)
        ? supplier.statements.reduce((sum, statement) => {
            const amount = parseFloat(statement.amount) || 0;
            return sum + amount;
          }, 0)
        : 0;
    return totalStatementDue;
  };

  // Helper function to calculate active PO count
  const calculateActivePOCount = (supplier) => {
    const activePOCount =
      supplier.purchase_order && Array.isArray(supplier.purchase_order)
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
      if (
        sortField === "total_statement_due" ||
        sortField === "active_po_count"
      ) {
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
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedSuppliers = filteredAndSortedSuppliers.slice(
    startIndex,
    endIndex,
  );

  // Close dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    const closeAll = () => {
      setShowSortDropdown(false);
      setShowColumnDropdown(false);
    };
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) closeAll();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeAll();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    setError("");
    try {
      // Get the session token when needed
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again.");
        setError("Your session has expired. Sign in again.");
        return;
      }

      const response = await axios.get("/api/v1/supplier/all", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        setSuppliers(response.data.data);
      } else {
        setError(
          response.data.message ||
            "Couldn't load suppliers. Check your connection and try again.",
        );
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      setError(
        error.response?.data?.message ||
          "Couldn't load suppliers. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
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
    setShowSortDropdown(false);
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

  // Filters that narrow the list (sort does not hide records), used to tell
  // "no records" apart from "no results for this filter" (DESIGN.md 15.4).
  const isNarrowingFilterActive = search !== "";

  const handleReset = () => {
    resetFilters();
    setCurrentPage(1);
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

  // Only the active column shows a sort indicator (DESIGN.md 15.4).
  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    if (sortOrder === "asc")
      return <ArrowUp className="h-4 w-4 text-primary" aria-hidden="true" />;
    if (sortOrder === "desc")
      return <ArrowDown className="h-4 w-4 text-primary" aria-hidden="true" />;
    return null;
  };

  // Column mapping for Excel export
  const columnMap = useMemo(
    () => ({
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
          ? totalStatementDue.toLocaleString("en-AU", {
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
      "Created At": (supplier) => exportDate(supplier.createdAt),
      "Updated At": (supplier) => exportDate(supplier.updatedAt),
    }),
    [],
  );

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

  const goToAddSupplier = () => router.push("/admin/suppliers/addsupplier");

  const exportDisabled =
    isExporting ||
    filteredAndSortedSuppliers.length === 0 ||
    selectedColumns.length === 0;
  const columnPickerDisabled =
    isExporting || filteredAndSortedSuppliers.length === 0;

  const sortHeaderProps = {
    sortField,
    sortOrder,
    onSort: handleSort,
  };

  return (
    <AdminShell>
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="px-4 py-2 shrink-0">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-slate-800">Suppliers</h1>
            <div className="flex items-center gap-2">
              <SearchBar />
              <button
                type="button"
                onClick={goToAddSupplier}
                className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add supplier
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
          <div className="bg-white rounded-lg border border-slate-200 flex flex-col h-full overflow-hidden">
            {/* Fixed header section */}
            <div className="p-4 shrink-0 border-b border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Search */}
                <div className="flex items-center gap-2 flex-1 min-w-64 max-w-2xl relative">
                  <Search
                    className="h-4 w-4 absolute left-3 text-slate-400 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    aria-label="Search suppliers"
                    placeholder="Search by name or email"
                    className="w-full text-sm text-slate-800 py-2 pr-3 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Reset, sort by, export to Excel */}
                <div className="flex flex-wrap items-center gap-2">
                  {isAnyFilterActive() && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className={BTN_SECONDARY}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      <span>Reset</span>
                    </button>
                  )}

                  <div className="relative dropdown-container">
                    <button
                      type="button"
                      onClick={() => setShowSortDropdown(!showSortDropdown)}
                      aria-haspopup="true"
                      aria-expanded={showSortDropdown}
                      className={BTN_SECONDARY}
                    >
                      <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                      <span>Sort by</span>
                    </button>
                    {showSortDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-300 rounded-lg z-40">
                        <div className="py-1">
                          {SORT_OPTIONS.map(({ field, label }) => (
                            <button
                              type="button"
                              key={field}
                              onClick={() => handleSort(field)}
                              className={MENU_ITEM}
                            >
                              {label} {getSortIcon(field)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative dropdown-container flex items-stretch">
                    <button
                      type="button"
                      onClick={handleExportToExcel}
                      disabled={exportDisabled}
                      className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 border-r-0 hover:bg-slate-100 rounded-l-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sheet className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {isExporting ? "Exporting…" : "Export to Excel"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                      disabled={columnPickerDisabled}
                      aria-label="Choose columns to export"
                      aria-haspopup="true"
                      aria-expanded={showColumnDropdown}
                      className="cursor-pointer flex items-center px-2 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-r-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {showColumnDropdown && (
                      <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg z-40 max-h-96 overflow-y-auto">
                        <div className="py-1">
                          <label
                            className={`${MENU_CHECK_ROW} sticky top-0 bg-white border-b border-slate-200`}
                          >
                            <span className="font-medium">Select all</span>
                            <input
                              type="checkbox"
                              checked={
                                selectedColumns.length ===
                                availableColumns.length
                              }
                              onChange={() => handleColumnToggle("Select All")}
                              className={CHECKBOX}
                            />
                          </label>
                          {availableColumns.map((column) => (
                            <label key={column} className={MENU_CHECK_ROW}>
                              <span>{column}</span>
                              <input
                                type="checkbox"
                                checked={selectedColumns.includes(column)}
                                onChange={() => handleColumnToggle(column)}
                                className={CHECKBOX}
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

            {/* Scrollable table section */}
            <div className="flex-1 overflow-auto">
              <div className="min-w-full">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className={TH}>
                        Image
                      </th>
                      <SortHeader
                        field="name"
                        label="Name"
                        icon={getSortIcon("name")}
                        {...sortHeaderProps}
                      />
                      <th scope="col" className={TH}>
                        Email
                      </th>
                      <th scope="col" className={TH}>
                        Phone
                      </th>
                      <SortHeader
                        field="total_statement_due"
                        label="Total statement due"
                        icon={getSortIcon("total_statement_due")}
                        alignRight
                        {...sortHeaderProps}
                      />
                      <SortHeader
                        field="active_po_count"
                        label="Active PO count"
                        icon={getSortIcon("active_po_count")}
                        alignRight
                        {...sortHeaderProps}
                      />
                    </tr>
                  </thead>

                  <tbody className="bg-white divide-y divide-slate-200">
                    {loading ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={TABLE_COLUMNS}
                        >
                          <div
                            className="flex flex-col items-center gap-2"
                            role="status"
                          >
                            <span
                              className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin"
                              aria-hidden="true"
                            />
                            <p className="text-sm text-slate-600">
                              Loading suppliers…
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={TABLE_COLUMNS}
                        >
                          <div
                            className="flex flex-col items-center gap-2"
                            role="alert"
                          >
                            <AlertTriangle
                              className="w-8 h-8 text-red-500"
                              aria-hidden="true"
                            />
                            <p className="text-sm text-red-600">{error}</p>
                            <button
                              type="button"
                              onClick={fetchSuppliers}
                              className={`${BTN_SECONDARY} py-1.5`}
                            >
                              Try again
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : paginatedSuppliers.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={TABLE_COLUMNS}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Truck
                              className="w-8 h-8 text-slate-300"
                              aria-hidden="true"
                            />
                            {suppliers.length > 0 && isNarrowingFilterActive ? (
                              <>
                                <p className="text-sm text-slate-600">
                                  No suppliers match your search
                                </p>
                                <button
                                  type="button"
                                  onClick={handleReset}
                                  className={`${BTN_SECONDARY} py-1.5`}
                                >
                                  <RotateCcw
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Clear filters
                                </button>
                              </>
                            ) : (
                              <>
                                <p className="text-sm text-slate-600">
                                  No suppliers yet
                                </p>
                                <button
                                  type="button"
                                  onClick={goToAddSupplier}
                                  className={`${BTN_SECONDARY} py-1.5`}
                                >
                                  <Plus
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Add supplier
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedSuppliers.map((supplier) => {
                        // Calculate total statement due
                        const totalStatementDue =
                          calculateTotalStatementDue(supplier);

                        // Calculate active PO count
                        const activePOCount = calculateActivePOCount(supplier);

                        return (
                          <tr
                            key={supplier.supplier_id}
                            onClick={() => {
                              router.push(
                                `/admin/suppliers/${supplier.supplier_id}`,
                              );
                            }}
                            className="cursor-pointer hover:bg-slate-50 transition-colors duration-200"
                          >
                            <td className="px-4 py-3">
                              <div className="w-10 h-10">
                                <div
                                  className="w-10 h-10 bg-slate-100 border border-slate-200 rounded-full text-slate-600 flex items-center justify-center font-medium text-sm"
                                  aria-hidden="true"
                                >
                                  {supplierInitials(supplier.name)}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700 font-medium">
                              {supplier.name ? (
                                <Link
                                  href={`/admin/suppliers/${supplier.supplier_id}`}
                                  onClick={(ev) => ev.stopPropagation()}
                                  title={supplier.name}
                                  className="block max-w-64 truncate rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                  {supplier.name}
                                </Link>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              <span
                                className="block max-w-64 truncate"
                                title={supplier.email || undefined}
                              >
                                {supplier.email || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                              {supplier.phone || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap text-right font-mono tabular-nums">
                              {totalStatementDue > 0
                                ? AUD_CENTS.format(totalStatementDue)
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap text-right font-mono tabular-nums">
                              {activePOCount}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fixed pagination footer */}
            {!loading && !error && paginatedSuppliers.length > 0 && (
              <PaginationFooter
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
                itemsPerPageOptions={[50, 100, 250, 0]}
                showItemsPerPage={true}
              />
            )}
          </div>
        </div>
      </main>
    </AdminShell>
  );
}
