"use client";
import {
  Fragment,
  Suspense,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import PaginationFooter from "@/components/PaginationFooter";
import {
  Edit,
  Trash2,
  Eye,
  Receipt,
  ChevronDown,
  ChevronUp,
  X,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Sheet,
  AlertTriangle,
  FileText,
  Funnel,
  Plus,
  Check,
  Upload,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import CustomDropdown from "@/components/CustomDropdown";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import SearchBar from "@/components/SearchBar";
import useModalFocus from "@/hooks/useModalFocus";
import {
  usePersistedTableFilter,
  useTableFilterActions,
} from "@/hooks/usePersistedTableFilter";
import {
  BADGE,
  BADGE_TONES,
  BUTTON_COUNT_BADGE,
  COUNT_BADGE,
} from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";

const TABLE_KEY = "supplier-statements";
const EMPTY = "—";
const TABLE_COLUMNS = 8;
const SESSION_ERROR = "Your session has expired. Sign in again to continue.";
const LOAD_ERROR =
  "Couldn't load statements. Check your connection and try again.";
const TOAST_OPTIONS = { position: "top-right", autoClose: 3000 };

const STATEMENT_TABS = [
  { key: "pending", label: "Pending", status: "PENDING" },
  { key: "paid", label: "Paid", status: "PAID" },
];

// Fields the list can be sorted by. Used by both the "Sort by" menu and the
// column headers so the two never drift apart.
const SORT_OPTIONS = [
  { field: "month_year", label: "Month" },
  { field: "supplier", label: "Supplier" },
  { field: "due_date", label: "Due date" },
  { field: "amount", label: "Amount" },
  { field: "payment_status", label: "Payment status" },
];

const DUE_IN_OPTIONS = [
  { value: "1 week", label: "1 week" },
  { value: "2 weeks", label: "2 weeks" },
  { value: "3 weeks", label: "3 weeks" },
  { value: "4 weeks", label: "4 weeks" },
  { value: "custom", label: "Custom" },
];

const PAYMENT_STATUS_OPTIONS = ["PENDING", "PAID"].map((value) => ({
  value,
  label: formatLabel(value),
}));

const EMPTY_FORM = {
  supplier_id: "",
  month_year: "",
  due_date: "",
  amount: "",
  payment_status: "PENDING",
  notes: "",
  file: null,
};

// Column names for the Excel export. Changing these changes the exported file.
const AVAILABLE_COLUMNS = [
  "Supplier",
  "Supplier Email",
  "Month/Year",
  "Due Date",
  "Amount",
  "Payment Status",
  "File Name",
  "File URL",
  "Notes",
  "Created At",
  "Updated At",
];

// Button, field, menu and table recipes from DESIGN.md 9.1 / 9.2 / 9.5 / 9.8.
const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY_FORM =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY_COMPACT =
  "cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const ICON_BTN =
  "cursor-pointer p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const ICON_BTN_DANGER =
  "cursor-pointer p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50 disabled:cursor-not-allowed";
const FIELD =
  "w-full text-sm text-slate-800 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-colors duration-200";
const fieldTone = (hasError) =>
  hasError
    ? "border-red-500 focus:ring-red-500"
    : "border-slate-300 focus:ring-primary";
const LABEL = "block text-sm font-medium text-slate-700 mb-1.5";
const MENU_ITEM =
  "cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between gap-2";
const MENU_CHECK_ROW =
  "cursor-pointer flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors";
const CHECKBOX =
  "h-4 w-4 shrink-0 accent-primary border-slate-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const TH =
  "px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider";

// Statements are charged to the cent, so this keeps two decimals rather than
// using the whole-dollar shared formatCurrency.
const AUD_AMOUNT = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

const formatAmount = (value) => {
  if (value === null || value === undefined || value === "") return EMPTY;
  const num =
    typeof value === "number"
      ? value
      : parseFloat(String(value).replace(/,/g, ""));
  if (!Number.isFinite(num)) return EMPTY;
  return AUD_AMOUNT.format(num);
};

// Due dates need the year to be unambiguous, so this stays local rather than
// using the compact shared formatDate.
const formatDate = (value) => {
  if (!value) return EMPTY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY;
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const toDateInputValue = (value) =>
  value ? new Date(value).toISOString().split("T")[0] : "";

// Format month number to month name
const formatMonthName = (monthNumber) => {
  const date = new Date(2000, parseInt(monthNumber) - 1, 1);
  return date.toLocaleDateString("en-AU", { month: "long" });
};

// Helper function to format date to month/year string
const formatMonthYear = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

// Helper function to calculate date X weeks from today
const getDateWeeksFromToday = (weeks) => {
  const date = new Date();
  date.setDate(date.getDate() + weeks * 7);
  return date.toISOString().split("T")[0];
};

// Helper function to check if a date matches any preset option
const checkDueInOption = (dateString) => {
  if (!dateString) return "custom";

  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffTime = date - today;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.round(diffDays / 7);

  if (diffWeeks === 1) return "1 week";
  if (diffWeeks === 2) return "2 weeks";
  if (diffWeeks === 3) return "3 weeks";
  if (diffWeeks === 4) return "4 weeks";

  return "custom";
};

const stripCommas = (value) => (value ? String(value).replace(/,/g, "") : "");

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-red-600 mt-1">
      {message}
    </p>
  );
}

function Spinner({ className = "w-4 h-4", onPrimary = false }) {
  return (
    <span
      className={`${className} border-2 rounded-full animate-spin ${
        onPrimary
          ? "border-white/30 border-t-white"
          : "border-slate-200 border-t-primary"
      }`}
      aria-hidden="true"
    />
  );
}

// Sortable column header. The label is a real button so the sort is reachable
// by keyboard (DESIGN.md 13.7); the active column carries the only indicator.
function SortHeader({
  field,
  label,
  sortField,
  sortOrder,
  onSort,
  alignRight = false,
}) {
  const isActive = sortField === field;
  const ariaSort = isActive
    ? sortOrder === "asc"
      ? "ascending"
      : "descending"
    : undefined;
  const Icon = !isActive
    ? ArrowUpDown
    : sortOrder === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`${TH} ${alignRight ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`cursor-pointer flex items-center gap-2 uppercase tracking-wider hover:text-slate-700 transition-colors duration-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary ${
          alignRight ? "ml-auto" : ""
        }`}
      >
        {label}
        <Icon
          className={`w-4 h-4 ${isActive ? "text-primary" : "text-slate-400"}`}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

// useSearchParams needs a Suspense boundary above it
export default function StatementsPage() {
  return (
    <Suspense fallback={null}>
      <StatementsContent />
    </Suspense>
  );
}

function StatementsContent() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const [highlightedStatementId, setHighlightedStatementId] = useState(null);
  const [statements, setStatements] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [error, setError] = useState("");
  const [showUploadStatementModal, setShowUploadStatementModal] =
    useState(false);
  const [isUploadingStatement, setIsUploadingStatement] = useState(false);
  const [statementForm, setStatementForm] = useState(EMPTY_FORM);
  // Inline validation messages (DESIGN.md 11, 15.3).
  const [errors, setErrors] = useState({});
  const [editingStatement, setEditingStatement] = useState(null);
  const [isEditingStatement, setIsEditingStatement] = useState(false);
  const [isUpdatingStatement, setIsUpdatingStatement] = useState(false);
  const [showDeleteStatementModal, setShowDeleteStatementModal] =
    useState(false);
  const [statementToDelete, setStatementToDelete] = useState(null);
  const [isDeletingStatement, setIsDeletingStatement] = useState(false);
  const [viewFileModal, setViewFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  const [search, setSearch] = usePersistedTableFilter(TABLE_KEY, "search", "");
  const [sortField, setSortField] = usePersistedTableFilter(
    TABLE_KEY,
    "sortField",
    "month_year",
  );
  const [sortOrder, setSortOrder] = usePersistedTableFilter(
    TABLE_KEY,
    "sortOrder",
    "desc",
  );
  const { resetFilters } = useTableFilterActions(TABLE_KEY);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("pending");
  const [isExporting, setIsExporting] = useState(false);

  // Which toolbar / row menu is open: "supplier", "year", "month", "sort",
  // "columns" or `status:<id>`. One value, so opening a menu closes the others.
  const [openMenu, setOpenMenu] = useState(null);

  // File upload states
  const [filePreview, setFilePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [fileObjectURL, setFileObjectURL] = useState(null);
  const fileObjectURLRef = useRef(null);
  const statementModalRef = useRef(null);

  // Due In dropdown state
  const [dueIn, setDueIn] = useState("custom");

  // Status update loading state (tracking which statement is being updated)
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // Year and month filter states
  const [yearFilter, setYearFilter] = usePersistedTableFilter(
    TABLE_KEY,
    "yearFilter",
    "all",
  );
  const [monthFilter, setMonthFilter] = usePersistedTableFilter(
    TABLE_KEY,
    "monthFilter",
    "all",
  );

  // Initialize selected columns with all columns
  const [selectedColumns, setSelectedColumns] = useState([
    ...AVAILABLE_COLUMNS,
  ]);

  const isSaving = isUploadingStatement || isUpdatingStatement;

  // Focus moves into the statement modal, stays inside it, and returns to the
  // trigger on close (DESIGN.md 13.6).
  useModalFocus(statementModalRef, showUploadStatementModal);

  useEffect(() => {
    fetchStatements();
    fetchSuppliers();
  }, []);

  // Close the open menu when clicking outside any menu container or pressing
  // Escape.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) {
        setOpenMenu(null);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Manage object URL for file preview
  useEffect(() => {
    // Cleanup previous object URL if it exists
    if (fileObjectURLRef.current) {
      URL.revokeObjectURL(fileObjectURLRef.current);
      fileObjectURLRef.current = null;
    }

    // Create new object URL if preview is open and file exists
    if (
      showFilePreview &&
      statementForm.file &&
      statementForm.file instanceof File
    ) {
      const objectURL = URL.createObjectURL(statementForm.file);
      fileObjectURLRef.current = objectURL;
      setFileObjectURL(objectURL);
    } else {
      setFileObjectURL(null);
    }

    // Cleanup function
    return () => {
      if (fileObjectURLRef.current) {
        URL.revokeObjectURL(fileObjectURLRef.current);
        fileObjectURLRef.current = null;
      }
    };
  }, [showFilePreview, statementForm.file]);

  // The statement modal closes on Escape (DESIGN.md 9.4). While the file
  // preview is open, ViewMedia owns Escape; the delete confirmation is
  // destructive and needs an explicit button.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (showDeleteStatementModal || showFilePreview) return;
      if (showUploadStatementModal && !isSaving) resetForm();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  // Fetch all suppliers from API
  const fetchSuppliers = async () => {
    try {
      setLoadingSuppliers(true);
      const sessionToken = getToken();
      if (!sessionToken) return;

      const response = await axios.get("/api/v1/supplier/all", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.data.status) {
        setSuppliers(response.data.data || []);
      } else {
        toast.error(
          response.data.message ||
            "Couldn't load suppliers. Check your connection and try again.",
          TOAST_OPTIONS,
        );
      }
    } catch (err) {
      console.error("Error fetching suppliers:", err);
      toast.error(
        err.response?.data?.message ||
          "Couldn't load suppliers. Check your connection and try again.",
        TOAST_OPTIONS,
      );
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const fetchStatements = async () => {
    try {
      setLoading(true);
      setError("");
      const sessionToken = getToken();

      if (!sessionToken) {
        setError(SESSION_ERROR);
        return;
      }

      const response = await axios.get("/api/v1/supplier/statements", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        setStatements(response.data.data || []);
        setError("");
      } else {
        const message = response.data.message || LOAD_ERROR;
        setError(message);
        // With a list already on screen the inline error state is not shown,
        // so say so in a toast instead.
        if (statements.length > 0) toast.error(message, TOAST_OPTIONS);
      }
    } catch (err) {
      console.error("Error fetching statements:", err);
      const message = err.response?.data?.message || LOAD_ERROR;
      setError(message);
      if (statements.length > 0) toast.error(message, TOAST_OPTIONS);
    } finally {
      setLoading(false);
    }
  };

  // Get available years from statements
  const availableYears = useMemo(() => {
    const years = new Set();
    statements.forEach((statement) => {
      if (statement.month_year) {
        const year = statement.month_year.split("-")[0];
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [statements]);

  // Get available months for selected year
  const availableMonths = useMemo(() => {
    if (yearFilter === "all") {
      return [];
    }
    const months = new Set();
    statements.forEach((statement) => {
      if (statement.month_year) {
        const [year, month] = statement.month_year.split("-");
        if (year === yearFilter) {
          months.add(parseInt(month));
        }
      }
    });
    return Array.from(months).sort((a, b) => a - b);
  }, [statements, yearFilter]);

  // Supplier options for the upload modal
  const supplierOptions = useMemo(
    () =>
      suppliers.map((supplier) => ({
        value: supplier.supplier_id,
        label: supplier.name,
        description: supplier.email || undefined,
      })),
    [suppliers],
  );

  // Get distinct suppliers from statements
  const distinctSuppliers = useMemo(() => {
    const supplierNames = [
      ...new Set(
        statements
          .map((statement) => statement.supplier?.name)
          .filter((name) => name),
      ),
    ];
    return supplierNames.sort();
  }, [statements]);

  const [selectedSuppliers, setSelectedSuppliers] = usePersistedTableFilter(
    TABLE_KEY,
    "selectedSuppliers",
    distinctSuppliers,
  );

  // Year, month, supplier and search filters, applied before the tab split so
  // the tab counts match what each tab would show.
  const searchedStatements = useMemo(() => {
    let filtered = statements;

    // Apply year filter
    if (yearFilter !== "all") {
      filtered = filtered.filter((statement) => {
        if (!statement.month_year) return false;
        const year = statement.month_year.split("-")[0];
        return year === yearFilter;
      });
    }

    // Apply month filter (only if year is selected)
    if (monthFilter !== "all" && yearFilter !== "all") {
      filtered = filtered.filter((statement) => {
        if (!statement.month_year) return false;
        const [year, month] = statement.month_year.split("-");
        return year === yearFilter && parseInt(month) === parseInt(monthFilter);
      });
    }

    // Apply supplier filter
    if (selectedSuppliers.length > 0) {
      filtered = filtered.filter((statement) => {
        const supplierName = statement.supplier?.name;
        return supplierName && selectedSuppliers.includes(supplierName);
      });
    }

    // Then apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter((statement) => {
        const supplierName = (statement.supplier?.name || "").toLowerCase();
        const monthYear = (statement.month_year || "").toLowerCase();
        const supplierEmail = (statement.supplier?.email || "").toLowerCase();
        return (
          supplierName.includes(searchLower) ||
          monthYear.includes(searchLower) ||
          supplierEmail.includes(searchLower)
        );
      });
    }

    return filtered;
  }, [statements, search, yearFilter, monthFilter, selectedSuppliers]);

  const tabCounts = useMemo(() => {
    const counts = {};
    STATEMENT_TABS.forEach((tab) => {
      counts[tab.key] = searchedStatements.filter(
        (statement) => statement.payment_status === tab.status,
      ).length;
    });
    return counts;
  }, [searchedStatements]);

  // Filter and sort statements
  const filteredAndSortedStatements = useMemo(() => {
    // First filter by tab (payment status)
    const filtered = searchedStatements.filter((statement) =>
      activeTab === "pending"
        ? statement.payment_status === "PENDING"
        : statement.payment_status === "PAID",
    );

    // Sort statements
    filtered.sort((a, b) => {
      let aValue, bValue;

      if (sortField === "supplier") {
        aValue = a.supplier?.name || "";
        bValue = b.supplier?.name || "";
      } else if (sortField === "amount") {
        aValue = parseFloat(a.amount || 0);
        bValue = parseFloat(b.amount || 0);
      } else if (sortField === "due_date") {
        aValue = new Date(a.due_date);
        bValue = new Date(b.due_date);
      } else {
        aValue = a[sortField] || "";
        bValue = b[sortField] || "";
      }

      if (sortField === "amount" || sortField === "due_date") {
        if (sortOrder === "asc") {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      } else {
        aValue = aValue.toString().toLowerCase();
        bValue = bValue.toString().toLowerCase();
        if (sortOrder === "asc") {
          return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        } else {
          return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
        }
      }
    });

    return filtered;
  }, [searchedStatements, sortField, sortOrder, activeTab]);

  // Pagination logic
  const totalItems = filteredAndSortedStatements.length;
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedStatements = filteredAndSortedStatements.slice(
    startIndex,
    endIndex,
  );

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setOpenMenu(null);
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Only the active field shows a sort indicator (DESIGN.md 15.4).
  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    if (sortOrder === "asc")
      return <ArrowUp className="h-4 w-4 text-primary" aria-hidden="true" />;
    return <ArrowDown className="h-4 w-4 text-primary" aria-hidden="true" />;
  };

  // Deep link from an update: ?statement=<id> clears the filters that could
  // hide it, switches to its payment-status tab, then highlights and scrolls to
  // its row. Applied once per link, after the statements have loaded.
  const openedStatementRef = useRef(null);
  useEffect(() => {
    const statementId = searchParams.get("statement");
    if (!statementId || openedStatementRef.current === statementId) return;
    const target = statements.find((s) => s.id === statementId);
    if (!target) return;
    openedStatementRef.current = statementId;
    resetFilters();
    setItemsPerPage(0);
    setActiveTab(target.payment_status === "PAID" ? "paid" : "pending");
    setHighlightedStatementId(statementId);
    setTimeout(
      () =>
        document
          .getElementById(`statement-row-${statementId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      200,
    );
  }, [statements, searchParams]);

  // A new search, filter or tab is a new result set, so go back to the first
  // page. The supplier filter is keyed by its contents because the persisted
  // array is a new object on every render.
  const supplierFilterKey = selectedSuppliers.join("\u0000");
  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeTab, yearFilter, monthFilter, supplierFilterKey]);

  // Reset month filter when year changes to "all"
  useEffect(() => {
    if (yearFilter === "all") {
      setMonthFilter("all");
    }
  }, [yearFilter]);

  const handleReset = () => {
    resetFilters();
    setCurrentPage(1);
  };

  // Filters that narrow the list (sort does not hide records), used to tell
  // "no records" apart from "no results for this filter" (DESIGN.md 15.4).
  const isNarrowingFilterActive =
    search !== "" ||
    yearFilter !== "all" ||
    monthFilter !== "all" ||
    selectedSuppliers.length !== distinctSuppliers.length;

  const isAnyFilterActive =
    isNarrowingFilterActive ||
    sortField !== "month_year" ||
    sortOrder !== "desc";

  const handleSupplierToggle = (supplier) => {
    if (supplier === "Select All") {
      if (selectedSuppliers.length === distinctSuppliers.length) {
        // If all suppliers are selected, unselect all
        setSelectedSuppliers([]);
      } else {
        // If not all suppliers are selected, select all
        setSelectedSuppliers([...distinctSuppliers]);
      }
    } else {
      setSelectedSuppliers((prev) =>
        prev.includes(supplier)
          ? prev.filter((s) => s !== supplier)
          : [...prev, supplier],
      );
    }
  };

  const handleColumnToggle = (column) => {
    if (column === "Select All") {
      if (selectedColumns.length === AVAILABLE_COLUMNS.length) {
        // If all columns are selected, unselect all
        setSelectedColumns([]);
      } else {
        // If not all columns are selected, select all
        setSelectedColumns([...AVAILABLE_COLUMNS]);
      }
    } else {
      setSelectedColumns((prev) =>
        prev.includes(column)
          ? prev.filter((c) => c !== column)
          : [...prev, column],
      );
    }
  };

  const toggleMenu = (name) => {
    setOpenMenu((prev) => (prev === name ? null : name));
  };

  const clearError = (field) => {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev));
  };

  const updateForm = (field, value) => {
    setStatementForm((prev) => ({ ...prev, [field]: value }));
    clearError(field);
  };

  // True when the open modal holds input the user would lose on close
  // (DESIGN.md 15.1). In edit mode, "dirty" means changed from the record.
  const isFormDirty = () => {
    if (statementForm.file) return true;
    if (isEditingStatement && editingStatement) {
      return (
        statementForm.month_year !== (editingStatement.month_year || "") ||
        statementForm.due_date !==
          toDateInputValue(editingStatement.due_date) ||
        stripCommas(statementForm.amount) !==
          (editingStatement.amount ? editingStatement.amount.toString() : "") ||
        statementForm.payment_status !==
          (editingStatement.payment_status || "PENDING") ||
        statementForm.notes !== (editingStatement.notes || "")
      );
    }
    return Boolean(
      statementForm.supplier_id ||
      statementForm.month_year ||
      statementForm.due_date ||
      statementForm.amount ||
      statementForm.notes ||
      statementForm.payment_status !== "PENDING",
    );
  };

  // File handling functions
  const validateAndSetFile = (file) => {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (!allowedTypes.includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        file: "Choose a PDF, JPG or PNG file.",
      }));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({
        ...prev,
        file: "Choose a file smaller than 10 MB.",
      }));
      return;
    }

    setStatementForm((prev) => ({ ...prev, file }));
    clearError("file");
    setFilePreview(null);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndSetFile(file);
    // Let the same file be chosen again after a validation error.
    e.target.value = "";
  };

  const removeSelectedFile = () => {
    setStatementForm((prev) => ({ ...prev, file: null }));
    setFilePreview(null);
    setShowFilePreview(false);
    // Cleanup object URL
    if (fileObjectURLRef.current) {
      URL.revokeObjectURL(fileObjectURLRef.current);
      fileObjectURLRef.current = null;
      setFileObjectURL(null);
    }
  };

  // Handle Due In dropdown change
  const handleDueInChange = (value) => {
    setDueIn(value);

    if (value === "custom") {
      // Don't change the date, just set to custom
      return;
    }

    // Extract number of weeks from value
    const weeks = parseInt(value);
    if (!isNaN(weeks) && weeks > 0) {
      const calculatedDate = getDateWeeksFromToday(weeks);
      setStatementForm((prev) => ({ ...prev, due_date: calculatedDate }));
      clearError("due_date");
    }
  };

  // Handle manual due date change
  const handleDueDateChange = (e) => {
    const newDate = e.target.value;
    updateForm("due_date", newDate);

    // Check if the new date matches any preset option
    const matchingOption = checkDueInOption(newDate);
    setDueIn(matchingOption);
  };

  // Keeps digits and one decimal point (max two places) and groups the whole
  // part with commas for display. The commas are stripped again on submit.
  const handleAmountChange = (e) => {
    // Remove all non-numeric characters except decimal point
    let rawValue = e.target.value.replace(/[^0-9.]/g, "");

    // Allow only one decimal point
    const parts = rawValue.split(".");
    if (parts.length > 2) {
      rawValue = parts[0] + "." + parts.slice(1).join("");
    }

    // Limit to 2 decimal places
    if (parts.length === 2 && parts[1].length > 2) {
      rawValue = parts[0] + "." + parts[1].substring(0, 2);
    }

    // Format with commas for display
    let formattedValue = rawValue;
    if (rawValue) {
      const numValue = parseFloat(rawValue);
      if (!isNaN(numValue)) {
        // Only format the integer part with commas
        const [integerPart, decimalPart] = rawValue.split(".");
        const formattedInteger = parseInt(integerPart || "0").toLocaleString(
          "en-AU",
        );
        formattedValue =
          decimalPart !== undefined
            ? `${formattedInteger}.${decimalPart}`
            : formattedInteger;
      }
    }

    updateForm("amount", formattedValue);
  };

  const handleExportToExcel = async () => {
    if (filteredAndSortedStatements.length === 0) {
      toast.warning("There's no data to export.", TOAST_OPTIONS);
      return;
    }
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      // Map of column names to their data extraction functions
      const columnMap = {
        Supplier: (statement) => statement.supplier?.name || "",
        "Supplier Email": (statement) => statement.supplier?.email || "",
        "Month/Year": (statement) => statement.month_year || "",
        "Due Date": (statement) =>
          statement.due_date
            ? new Date(statement.due_date).toLocaleDateString()
            : "",
        Amount: (statement) =>
          statement.amount ? parseFloat(statement.amount).toFixed(2) : "",
        "Payment Status": (statement) => statement.payment_status || "",
        "File Name": (statement) => statement.supplier_file?.filename || "",
        "File URL": (statement) =>
          statement.supplier_file?.url
            ? `${origin}/${statement.supplier_file.url}`
            : "",
        Notes: (statement) => statement.notes || "",
        "Created At": (statement) =>
          statement.createdAt
            ? new Date(statement.createdAt).toLocaleString()
            : "",
        "Updated At": (statement) =>
          statement.updatedAt
            ? new Date(statement.updatedAt).toLocaleString()
            : "",
      };

      // Column width map
      const columnWidthMap = {
        Supplier: 24,
        "Supplier Email": 28,
        "Month/Year": 12,
        "Due Date": 14,
        Amount: 12,
        "Payment Status": 14,
        "File Name": 30,
        "File URL": 40,
        Notes: 40,
        "Created At": 20,
        "Updated At": 20,
      };

      // Prepare data for export - only include selected columns
      const exportData = filteredAndSortedStatements.map((statement) => {
        const row = {};
        selectedColumns.forEach((column) => {
          if (columnMap[column]) {
            row[column] = columnMap[column](statement);
          }
        });
        return row;
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for selected columns only
      const colWidths = selectedColumns.map((column) => ({
        wch: columnWidthMap[column] || 15,
      }));
      ws["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "SupplierStatements");
      const currentDate = new Date().toISOString().split("T")[0];
      const filename = `supplier_statements_${currentDate}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(
        `Exported ${exportData.length} rows to ${filename}`,
        TOAST_OPTIONS,
      );
    } catch (err) {
      toast.error("Couldn't export the data. Try again.", TOAST_OPTIONS);
    } finally {
      setIsExporting(false);
    }
  };

  // Shows the messages and moves focus to the first invalid field, in the
  // order the fields appear (DESIGN.md 15.3). Returns true when valid.
  const applyValidation = (nextErrors) => {
    setErrors(nextErrors);
    const order = [
      ["supplier_id", "statement-supplier"],
      ["month_year", "statement-month"],
      ["due_date", "statement-due-date"],
      ["file", "statement-file-upload"],
    ];
    const firstInvalid = order.find(([field]) => nextErrors[field]);
    if (!firstInvalid) return true;
    setTimeout(() => {
      document.getElementById(firstInvalid[1])?.focus();
    }, 0);
    return false;
  };

  const handleUploadStatement = async () => {
    if (isSaving) return;
    try {
      const nextErrors = {};
      if (!statementForm.supplier_id) {
        nextErrors.supplier_id = "Select a supplier.";
      }
      if (!statementForm.month_year) {
        nextErrors.month_year = "Select the statement month.";
      }
      if (!statementForm.due_date) {
        nextErrors.due_date = "Enter a due date.";
      }
      if (!statementForm.file) {
        nextErrors.file = "Choose a statement file to upload.";
      }
      if (!applyValidation(nextErrors)) return;

      setIsUploadingStatement(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error(SESSION_ERROR, TOAST_OPTIONS);
        return;
      }

      const formData = new FormData();
      formData.append("file", statementForm.file);
      formData.append("month_year", formatMonthYear(statementForm.month_year));
      formData.append("due_date", statementForm.due_date);
      formData.append("amount", stripCommas(statementForm.amount));
      formData.append("payment_status", statementForm.payment_status);
      formData.append("notes", statementForm.notes || "");

      const response = await axios.post(
        `/api/v1/supplier/${statementForm.supplier_id}/statements`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      if (response.data.status) {
        toast.success("Statement uploaded.", TOAST_OPTIONS);
        resetForm();
        fetchStatements();
      } else {
        toast.error(
          response.data.message ||
            "Couldn't upload the statement. Check the details and try again.",
          TOAST_OPTIONS,
        );
      }
    } catch (err) {
      console.error("Error uploading statement:", err);
      toast.error(
        err.response?.data?.message ||
          "Couldn't upload the statement. Check your connection and try again.",
        TOAST_OPTIONS,
      );
    } finally {
      setIsUploadingStatement(false);
    }
  };

  const handleEditStatement = (statement) => {
    // A type="month" input takes "YYYY-MM", which is how month_year is stored.
    const monthYearDate = statement.month_year || "";
    const dueDate = toDateInputValue(statement.due_date);

    setEditingStatement(statement);
    setStatementForm({
      supplier_id: statement.supplier_id,
      month_year: monthYearDate,
      due_date: dueDate,
      amount: statement.amount ? statement.amount.toString() : "",
      payment_status: statement.payment_status || "PENDING",
      notes: statement.notes || "",
      file: null,
    });
    setErrors({});
    setFilePreview(null);
    // Set dueIn based on the statement's due date
    setDueIn(checkDueInOption(dueDate));
    setIsEditingStatement(true);
    setShowUploadStatementModal(true);
  };

  const handleUpdateStatement = async (statement = null, newStatus = null) => {
    // If statement and newStatus are provided, it's a status-only update from table
    const isStatusOnlyUpdate = Boolean(statement && newStatus);

    if (!isStatusOnlyUpdate && isSaving) return;

    try {
      if (isStatusOnlyUpdate) {
        // Don't update if status hasn't changed
        if (statement.payment_status === newStatus) return;

        setUpdatingStatusId(statement.id);
      } else {
        // Full update from edit modal
        const nextErrors = {};
        if (!statementForm.due_date) {
          nextErrors.due_date = "Enter a due date.";
        }
        if (!applyValidation(nextErrors)) return;
        setIsUpdatingStatement(true);
      }

      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error(SESSION_ERROR, TOAST_OPTIONS);
        return;
      }

      const formData = new FormData();

      if (isStatusOnlyUpdate) {
        // Status-only update: include all existing statement data
        formData.append("month_year", statement.month_year || "");
        formData.append("due_date", statement.due_date || "");
        formData.append("amount", statement.amount || "");
        formData.append("payment_status", newStatus);
        formData.append("notes", statement.notes || "");
      } else {
        // Full update from edit modal
        if (statementForm.file) {
          formData.append("file", statementForm.file);
        }
        formData.append(
          "month_year",
          formatMonthYear(statementForm.month_year),
        );
        formData.append("due_date", statementForm.due_date);
        formData.append("amount", stripCommas(statementForm.amount));
        formData.append("payment_status", statementForm.payment_status);
        formData.append("notes", statementForm.notes || "");
      }

      const supplierId = isStatusOnlyUpdate
        ? statement.supplier_id
        : statementForm.supplier_id;
      const statementId = isStatusOnlyUpdate
        ? statement.id
        : editingStatement.id;

      const response = await axios.patch(
        `/api/v1/supplier/${supplierId}/statements/${statementId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      if (response.data.status) {
        if (isStatusOnlyUpdate) {
          toast.success("Status updated.", TOAST_OPTIONS);
        } else {
          toast.success("Statement updated.", TOAST_OPTIONS);
          resetForm();
        }
        fetchStatements();
      } else {
        toast.error(
          response.data.message ||
            "Couldn't update the statement. Check the details and try again.",
          TOAST_OPTIONS,
        );
      }
    } catch (err) {
      console.error("Error updating statement:", err);
      toast.error(
        err.response?.data?.message ||
          "Couldn't update the statement. Check your connection and try again.",
        TOAST_OPTIONS,
      );
    } finally {
      if (isStatusOnlyUpdate) {
        setUpdatingStatusId(null);
      } else {
        setIsUpdatingStatement(false);
      }
    }
  };

  const handleDeleteStatement = (statement) => {
    setStatementToDelete(statement);
    setShowDeleteStatementModal(true);
  };

  const handleDeleteStatementConfirm = async () => {
    if (!statementToDelete) return;

    try {
      setIsDeletingStatement(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error(SESSION_ERROR, TOAST_OPTIONS);
        return;
      }

      const response = await axios.delete(
        `/api/v1/supplier/${statementToDelete.supplier_id}/statements/${statementToDelete.id}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );

      if (response.data.status) {
        toast.success("Statement deleted.", TOAST_OPTIONS);
        setShowDeleteStatementModal(false);
        setStatementToDelete(null);
        fetchStatements();
      } else {
        toast.error(
          response.data.message || "Couldn't delete the statement. Try again.",
          TOAST_OPTIONS,
        );
      }
    } catch (err) {
      console.error("Error deleting statement:", err);
      toast.error(
        err.response?.data?.message ||
          "Couldn't delete the statement. Check your connection and try again.",
        TOAST_OPTIONS,
      );
    } finally {
      setIsDeletingStatement(false);
    }
  };

  const handleViewStatement = (statement) => {
    if (statement.supplier_file) {
      setSelectedFile({
        name: statement.supplier_file.filename,
        url: `/${statement.supplier_file.url}`,
        type: statement.supplier_file.mime_type || "application/pdf",
        size: statement.supplier_file.size || 0,
        isExisting: true,
      });
      setViewFileModal(true);
      setPageNumber(1);
    }
  };

  const toggleNotes = (statementId) => {
    setExpandedNotes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(statementId)) {
        newSet.delete(statementId);
      } else {
        newSet.add(statementId);
      }
      return newSet;
    });
  };

  const resetForm = () => {
    setShowUploadStatementModal(false);
    setIsEditingStatement(false);
    setEditingStatement(null);
    setStatementForm(EMPTY_FORM);
    setErrors({});
    setFilePreview(null);
    setIsDragging(false);
    setShowFilePreview(false);
    setDueIn("custom");
    // Cleanup object URL
    if (fileObjectURLRef.current) {
      URL.revokeObjectURL(fileObjectURLRef.current);
      fileObjectURLRef.current = null;
      setFileObjectURL(null);
    }
  };

  const tabClass = (tab) =>
    `cursor-pointer py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-t-sm ${
      activeTab === tab
        ? "border-primary text-primary"
        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
    }`;

  const exportDisabled =
    isExporting ||
    filteredAndSortedStatements.length === 0 ||
    selectedColumns.length === 0;
  const columnPickerDisabled =
    isExporting || filteredAndSortedStatements.length === 0;

  const showInitialLoading = loading && statements.length === 0;
  const showLoadError = !!error && !loading && statements.length === 0;
  const activeTabLabel =
    STATEMENT_TABS.find((tab) => tab.key === activeTab)?.label || "";

  const submitLabel = isEditingStatement ? "Save changes" : "Upload statement";
  const deleteMonth = statementToDelete?.month_year || EMPTY;
  const deleteSupplier = statementToDelete?.supplier?.name;

  return (
    <AdminShell>
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="px-4 py-2 shrink-0">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-slate-800">
              Supplier statements
            </h1>
            <div className="flex items-center gap-2">
              <SearchBar />
              <button
                type="button"
                onClick={() => setShowUploadStatementModal(true)}
                className={BTN_PRIMARY}
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Upload statement
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
                    aria-label="Search statements"
                    placeholder="Search by supplier, email or month"
                    className="w-full text-sm text-slate-800 py-2 pr-3 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Reset, filters, sort, export */}
                <div className="flex flex-wrap items-center gap-2">
                  {isAnyFilterActive && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className={BTN_SECONDARY}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      <span>Reset</span>
                    </button>
                  )}

                  {/* Supplier filter */}
                  <div className="relative dropdown-container">
                    <button
                      type="button"
                      onClick={() => toggleMenu("supplier")}
                      aria-haspopup="true"
                      aria-expanded={openMenu === "supplier"}
                      className={BTN_SECONDARY}
                    >
                      <Funnel className="h-4 w-4" aria-hidden="true" />
                      <span>Filter by supplier</span>
                      {distinctSuppliers.length - selectedSuppliers.length >
                        0 && (
                        <span className={BUTTON_COUNT_BADGE}>
                          {distinctSuppliers.length - selectedSuppliers.length}
                        </span>
                      )}
                    </button>
                    {openMenu === "supplier" && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg z-40 max-h-96 overflow-y-auto">
                        <div className="py-1">
                          <label
                            className={`${MENU_CHECK_ROW} sticky top-0 bg-white border-b border-slate-200`}
                          >
                            <span className="font-medium">Select all</span>
                            <input
                              type="checkbox"
                              checked={
                                selectedSuppliers.length ===
                                distinctSuppliers.length
                              }
                              onChange={() =>
                                handleSupplierToggle("Select All")
                              }
                              className={CHECKBOX}
                            />
                          </label>
                          {distinctSuppliers.length === 0 && (
                            <p className="px-4 py-2.5 text-sm text-slate-500">
                              No suppliers yet
                            </p>
                          )}
                          {distinctSuppliers.map((supplier) => (
                            <label key={supplier} className={MENU_CHECK_ROW}>
                              <span className="truncate" title={supplier}>
                                {supplier}
                              </span>
                              <input
                                type="checkbox"
                                checked={selectedSuppliers.includes(supplier)}
                                onChange={() => handleSupplierToggle(supplier)}
                                className={CHECKBOX}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Year filter */}
                  <div className="relative dropdown-container">
                    <button
                      type="button"
                      onClick={() => toggleMenu("year")}
                      aria-haspopup="true"
                      aria-expanded={openMenu === "year"}
                      className={BTN_SECONDARY}
                    >
                      {yearFilter === "all" ? "All years" : yearFilter}
                      <ChevronDown className="w-4 h-4" aria-hidden="true" />
                    </button>
                    {openMenu === "year" && (
                      <div className="absolute top-full left-0 mt-1 w-36 bg-white border border-slate-300 rounded-lg z-40 max-h-96 overflow-y-auto">
                        <div className="py-1">
                          <button
                            type="button"
                            aria-current={yearFilter === "all" || undefined}
                            onClick={() => {
                              setYearFilter("all");
                              setOpenMenu(null);
                            }}
                            className={`${MENU_ITEM} ${
                              yearFilter === "all"
                                ? "text-primary font-medium"
                                : ""
                            }`}
                          >
                            All years
                            {yearFilter === "all" && (
                              <Check className="w-4 h-4" aria-hidden="true" />
                            )}
                          </button>
                          {availableYears.map((year) => (
                            <button
                              type="button"
                              key={year}
                              aria-current={yearFilter === year || undefined}
                              onClick={() => {
                                setYearFilter(year);
                                setOpenMenu(null);
                              }}
                              className={`${MENU_ITEM} ${
                                yearFilter === year
                                  ? "text-primary font-medium"
                                  : ""
                              }`}
                            >
                              {year}
                              {yearFilter === year && (
                                <Check className="w-4 h-4" aria-hidden="true" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Month filter (needs a year) */}
                  <div className="relative dropdown-container">
                    <button
                      type="button"
                      onClick={() => toggleMenu("month")}
                      disabled={yearFilter === "all"}
                      title={
                        yearFilter === "all" ? "Choose a year first" : undefined
                      }
                      aria-haspopup="true"
                      aria-expanded={openMenu === "month"}
                      className={BTN_SECONDARY}
                    >
                      {monthFilter === "all"
                        ? "All months"
                        : formatMonthName(monthFilter)}
                      <ChevronDown className="w-4 h-4" aria-hidden="true" />
                    </button>
                    {openMenu === "month" && yearFilter !== "all" && (
                      <div className="absolute top-full left-0 mt-1 w-44 bg-white border border-slate-300 rounded-lg z-40 max-h-96 overflow-y-auto">
                        <div className="py-1">
                          <button
                            type="button"
                            aria-current={monthFilter === "all" || undefined}
                            onClick={() => {
                              setMonthFilter("all");
                              setOpenMenu(null);
                            }}
                            className={`${MENU_ITEM} ${
                              monthFilter === "all"
                                ? "text-primary font-medium"
                                : ""
                            }`}
                          >
                            All months
                            {monthFilter === "all" && (
                              <Check className="w-4 h-4" aria-hidden="true" />
                            )}
                          </button>
                          {availableMonths.map((month) => (
                            <button
                              type="button"
                              key={month}
                              aria-current={
                                monthFilter === month.toString() || undefined
                              }
                              onClick={() => {
                                setMonthFilter(month.toString());
                                setOpenMenu(null);
                              }}
                              className={`${MENU_ITEM} ${
                                monthFilter === month.toString()
                                  ? "text-primary font-medium"
                                  : ""
                              }`}
                            >
                              {formatMonthName(month)}
                              {monthFilter === month.toString() && (
                                <Check className="w-4 h-4" aria-hidden="true" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sort */}
                  <div className="relative dropdown-container">
                    <button
                      type="button"
                      onClick={() => toggleMenu("sort")}
                      aria-haspopup="true"
                      aria-expanded={openMenu === "sort"}
                      className={BTN_SECONDARY}
                    >
                      <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                      <span>Sort by</span>
                    </button>
                    {openMenu === "sort" && (
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

                  {/* Export */}
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
                      onClick={() => toggleMenu("columns")}
                      disabled={columnPickerDisabled}
                      aria-label="Choose columns to export"
                      aria-haspopup="true"
                      aria-expanded={openMenu === "columns"}
                      className="cursor-pointer flex items-center px-2 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-r-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {openMenu === "columns" && (
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
                                AVAILABLE_COLUMNS.length
                              }
                              onChange={() => handleColumnToggle("Select All")}
                              className={CHECKBOX}
                            />
                          </label>
                          {AVAILABLE_COLUMNS.map((column) => (
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

            {/* Tabs section */}
            <div className="px-4 shrink-0 border-b border-slate-200">
              <div
                className="flex space-x-6"
                role="tablist"
                aria-label="Payment status"
              >
                {STATEMENT_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    id={`statements-tab-${tab.key}`}
                    aria-selected={activeTab === tab.key}
                    aria-controls="statements-panel"
                    onClick={() => setActiveTab(tab.key)}
                    className={tabClass(tab.key)}
                  >
                    <span className="flex items-center gap-2">
                      {tab.label}
                      {tabCounts[tab.key] > 0 && (
                        <span className={COUNT_BADGE}>
                          {tabCounts[tab.key]}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable table section */}
            <div
              id="statements-panel"
              role="tabpanel"
              aria-labelledby={`statements-tab-${activeTab}`}
              className="flex-1 overflow-auto"
            >
              <div className="min-w-full">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className={`${TH} text-left w-10`}>
                        <span className="sr-only">Notes</span>
                      </th>
                      <SortHeader
                        field="supplier"
                        label="Supplier"
                        sortField={sortField}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                      />
                      <SortHeader
                        field="month_year"
                        label="Month"
                        sortField={sortField}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                      />
                      <SortHeader
                        field="due_date"
                        label="Due date"
                        sortField={sortField}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                      />
                      <SortHeader
                        field="amount"
                        label="Amount"
                        sortField={sortField}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                        alignRight
                      />
                      <SortHeader
                        field="payment_status"
                        label="Status"
                        sortField={sortField}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                      />
                      <th scope="col" className={`${TH} text-left`}>
                        File
                      </th>
                      <th scope="col" className={`${TH} text-right`}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {showInitialLoading ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={TABLE_COLUMNS}
                        >
                          <div
                            className="flex flex-col items-center gap-2"
                            role="status"
                          >
                            <Spinner className="w-6 h-6" />
                            <p className="text-sm text-slate-600">
                              Loading statements…
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : showLoadError ? (
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
                              onClick={fetchStatements}
                              className={BTN_SECONDARY_COMPACT}
                            >
                              Try again
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : paginatedStatements.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={TABLE_COLUMNS}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Receipt
                              className="w-8 h-8 text-slate-300"
                              aria-hidden="true"
                            />
                            {statements.length > 0 &&
                            isNarrowingFilterActive ? (
                              <>
                                <p className="text-sm text-slate-600">
                                  No {activeTabLabel.toLowerCase()} statements
                                  match your filters
                                </p>
                                <button
                                  type="button"
                                  onClick={handleReset}
                                  className={BTN_SECONDARY_COMPACT}
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
                                  {statements.length === 0
                                    ? "No statements yet"
                                    : `No ${activeTabLabel.toLowerCase()} statements`}
                                </p>
                                {statements.length === 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowUploadStatementModal(true)
                                    }
                                    className={BTN_SECONDARY_COMPACT}
                                  >
                                    <Plus
                                      className="h-4 w-4"
                                      aria-hidden="true"
                                    />
                                    Upload statement
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedStatements.map((statement) => {
                        const notesOpen = expandedNotes.has(statement.id);
                        const rowLabel = [
                          statement.supplier?.name,
                          statement.month_year,
                        ]
                          .filter(Boolean)
                          .join(" ");
                        const statusMenuName = `status:${statement.id}`;
                        const isStatusMenuOpen = openMenu === statusMenuName;
                        const isStatusUpdating =
                          updatingStatusId === statement.id;
                        return (
                          <Fragment key={statement.id}>
                            <tr
                              id={`statement-row-${statement.id}`}
                              className={`hover:bg-slate-50 transition-colors duration-200 ${
                                statement.notes ? "cursor-pointer" : ""
                              } ${
                                statement.id === highlightedStatementId
                                  ? "bg-primary/10"
                                  : ""
                              }`}
                              onClick={() =>
                                statement.notes && toggleNotes(statement.id)
                              }
                            >
                              <td className="px-4 py-3 whitespace-nowrap">
                                {statement.notes && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleNotes(statement.id);
                                    }}
                                    className={ICON_BTN}
                                    aria-expanded={notesOpen}
                                    aria-controls={
                                      notesOpen
                                        ? `statement-notes-${statement.id}`
                                        : undefined
                                    }
                                    aria-label={`${
                                      notesOpen ? "Hide" : "Show"
                                    } notes for ${rowLabel}`}
                                  >
                                    {notesOpen ? (
                                      <ChevronUp
                                        className="w-4 h-4"
                                        aria-hidden="true"
                                      />
                                    ) : (
                                      <ChevronDown
                                        className="w-4 h-4"
                                        aria-hidden="true"
                                      />
                                    )}
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span
                                    className="text-sm font-medium text-slate-800 truncate max-w-xs"
                                    title={
                                      statement.supplier?.name || undefined
                                    }
                                  >
                                    {statement.supplier?.name || EMPTY}
                                  </span>
                                  {statement.supplier?.email && (
                                    <span
                                      className="text-xs text-slate-600 truncate max-w-xs"
                                      title={statement.supplier.email}
                                    >
                                      {statement.supplier.email}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-sm font-mono text-slate-700 whitespace-nowrap">
                                {statement.month_year || EMPTY}
                              </td>
                              <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                {formatDate(statement.due_date)}
                              </td>
                              <td className="px-4 py-3 text-sm font-mono text-slate-700 text-right whitespace-nowrap">
                                {formatAmount(statement.amount)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  className="relative dropdown-container inline-flex items-center gap-1"
                                >
                                  {statement.payment_status ? (
                                    <span
                                      className={`${BADGE} ${
                                        statement.payment_status === "PAID"
                                          ? BADGE_TONES.success
                                          : BADGE_TONES.warning
                                      }`}
                                    >
                                      {formatLabel(statement.payment_status)}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-slate-500">
                                      {EMPTY}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => toggleMenu(statusMenuName)}
                                    disabled={isStatusUpdating}
                                    aria-haspopup="menu"
                                    aria-expanded={isStatusMenuOpen}
                                    aria-label={`Change payment status for ${rowLabel}`}
                                    title="Change payment status"
                                    className={ICON_BTN}
                                  >
                                    {isStatusUpdating ? (
                                      <Spinner />
                                    ) : (
                                      <ChevronDown
                                        className={`w-4 h-4 transition-transform duration-200 ${
                                          isStatusMenuOpen ? "rotate-180" : ""
                                        }`}
                                        aria-hidden="true"
                                      />
                                    )}
                                  </button>
                                  {isStatusUpdating && (
                                    <span className="sr-only" role="status">
                                      Updating status…
                                    </span>
                                  )}
                                  {isStatusMenuOpen && (
                                    <div
                                      role="menu"
                                      aria-label="Payment status"
                                      className="absolute top-full left-0 mt-1 w-40 bg-white border border-slate-300 rounded-lg z-40"
                                    >
                                      <div className="py-1">
                                        {PAYMENT_STATUS_OPTIONS.map(
                                          ({ value, label }) => (
                                            <button
                                              key={value}
                                              type="button"
                                              role="menuitemradio"
                                              aria-checked={
                                                statement.payment_status ===
                                                value
                                              }
                                              onClick={() => {
                                                if (
                                                  statement.payment_status !==
                                                  value
                                                ) {
                                                  handleUpdateStatement(
                                                    statement,
                                                    value,
                                                  );
                                                }
                                                setOpenMenu(null);
                                              }}
                                              className={MENU_ITEM}
                                            >
                                              {label}
                                              {statement.payment_status ===
                                                value && (
                                                <Check
                                                  className="w-4 h-4 text-primary"
                                                  aria-hidden="true"
                                                />
                                              )}
                                            </button>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td
                                className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate"
                                title={
                                  statement.supplier_file?.filename || undefined
                                }
                              >
                                {statement.supplier_file?.filename || EMPTY}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div
                                  className="flex items-center justify-end gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {statement.supplier_file && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleViewStatement(statement)
                                      }
                                      className={ICON_BTN}
                                      aria-label={`View file for ${rowLabel}`}
                                      title="View file"
                                    >
                                      <Eye
                                        className="w-4 h-4"
                                        aria-hidden="true"
                                      />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleEditStatement(statement)
                                    }
                                    className={ICON_BTN}
                                    aria-label={`Edit statement for ${rowLabel}`}
                                    title="Edit statement"
                                  >
                                    <Edit
                                      className="w-4 h-4"
                                      aria-hidden="true"
                                    />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteStatement(statement)
                                    }
                                    className={ICON_BTN_DANGER}
                                    aria-label={`Delete statement for ${rowLabel}`}
                                    title="Delete statement"
                                  >
                                    <Trash2
                                      className="w-4 h-4"
                                      aria-hidden="true"
                                    />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {statement.notes && notesOpen && (
                              <tr className="bg-slate-50">
                                <td
                                  colSpan={TABLE_COLUMNS}
                                  className="px-4 py-3"
                                >
                                  <div id={`statement-notes-${statement.id}`}>
                                    <p className="text-xs font-medium text-slate-500 mb-1">
                                      Notes
                                    </p>
                                    <div className="text-sm text-slate-700 whitespace-pre-wrap pl-4 border-l border-slate-300">
                                      {statement.notes}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fixed pagination footer */}
            {!showInitialLoading &&
              !showLoadError &&
              paginatedStatements.length > 0 && (
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

      {/* View file modal */}
      {viewFileModal && selectedFile && (
        <ViewMedia
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          setViewFileModal={setViewFileModal}
          setPageNumber={setPageNumber}
        />
      )}

      {/* Delete statement confirmation modal */}
      <DeleteConfirmation
        isOpen={showDeleteStatementModal}
        onClose={() => {
          setShowDeleteStatementModal(false);
          setStatementToDelete(null);
        }}
        onConfirm={handleDeleteStatementConfirm}
        deleteWithInput={true}
        heading="Statement"
        title={
          statementToDelete
            ? `Delete statement for ${deleteMonth}${
                deleteSupplier ? ` from ${deleteSupplier}` : ""
              }?`
            : "Delete statement?"
        }
        warningHeading="This removes the statement record"
        message={`The statement for ${deleteMonth}${
          deleteSupplier ? ` from ${deleteSupplier}` : ""
        } (${formatAmount(statementToDelete?.amount)}) will be permanently deleted. This can't be undone.`}
        confirmButtonText="Delete statement"
        comparingName={statementToDelete?.month_year || ""}
        isDeleting={isDeletingStatement}
        entityType="supplier_statement"
      />

      {/* Upload / edit statement modal */}
      {showUploadStatementModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
          onClick={() => {
            // Keep typed-in work on a stray backdrop click (DESIGN.md 15.1).
            if (!isFormDirty() && !isSaving) resetForm();
          }}
        >
          <div
            ref={statementModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="statement-modal-title"
            className="bg-white w-full max-w-2xl rounded-xl border border-slate-200 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <h2
                id="statement-modal-title"
                className="text-lg font-semibold text-slate-800"
              >
                {isEditingStatement ? "Edit statement" : "Upload statement"}
              </h2>
              <button
                type="button"
                onClick={resetForm}
                disabled={isSaving}
                className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (isEditingStatement) handleUpdateStatement();
                else handleUploadStatement();
              }}
              className="flex flex-col min-h-0"
            >
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="statement-supplier" className={LABEL}>
                      Supplier{" "}
                      {!isEditingStatement && (
                        <span className="text-red-600">*</span>
                      )}
                    </label>
                    {isEditingStatement ? (
                      <input
                        id="statement-supplier"
                        type="text"
                        readOnly
                        value={editingStatement?.supplier?.name || EMPTY}
                        className={`${FIELD} border-slate-300 bg-slate-50 text-slate-600 cursor-not-allowed`}
                      />
                    ) : (
                      <>
                        <CustomDropdown
                          id="statement-supplier"
                          options={supplierOptions}
                          value={statementForm.supplier_id}
                          onChange={(value) => updateForm("supplier_id", value)}
                          placeholder="Search or select a supplier"
                          searchable
                          loading={loadingSuppliers}
                          loadingText="Loading suppliers..."
                          emptyText="No matching suppliers"
                          invalid={!!errors.supplier_id}
                          describedBy={
                            errors.supplier_id
                              ? "statement-supplier-error"
                              : undefined
                          }
                        />
                        <FieldError
                          id="statement-supplier-error"
                          message={errors.supplier_id}
                        />
                      </>
                    )}
                  </div>

                  <div>
                    <label htmlFor="statement-month" className={LABEL}>
                      Statement month <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="statement-month"
                      type="month"
                      data-autofocus
                      value={statementForm.month_year}
                      onChange={(e) => updateForm("month_year", e.target.value)}
                      aria-invalid={!!errors.month_year}
                      aria-describedby={
                        errors.month_year ? "statement-month-error" : undefined
                      }
                      className={`${FIELD} ${fieldTone(errors.month_year)}`}
                    />
                    <FieldError
                      id="statement-month-error"
                      message={errors.month_year}
                    />
                  </div>

                  <div>
                    <label htmlFor="statement-due-in" className={LABEL}>
                      Due in
                    </label>
                    <CustomDropdown
                      id="statement-due-in"
                      options={DUE_IN_OPTIONS}
                      value={dueIn}
                      onChange={handleDueInChange}
                      placeholder="Select a period"
                    />
                  </div>

                  <div>
                    <label htmlFor="statement-due-date" className={LABEL}>
                      Due date <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="statement-due-date"
                      type="date"
                      value={statementForm.due_date}
                      onChange={handleDueDateChange}
                      aria-invalid={!!errors.due_date}
                      aria-describedby={
                        errors.due_date ? "statement-due-date-error" : undefined
                      }
                      className={`${FIELD} ${fieldTone(errors.due_date)}`}
                    />
                    <FieldError
                      id="statement-due-date-error"
                      message={errors.due_date}
                    />
                  </div>

                  <div>
                    <label htmlFor="statement-amount" className={LABEL}>
                      Amount
                    </label>
                    <div className="relative">
                      <span
                        className="absolute inset-y-0 left-4 flex items-center text-sm text-slate-500"
                        aria-hidden="true"
                      >
                        $
                      </span>
                      <input
                        id="statement-amount"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={statementForm.amount}
                        onChange={handleAmountChange}
                        placeholder="0.00"
                        className={`${FIELD} ${fieldTone(false)} pl-8 font-mono`}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="statement-payment-status" className={LABEL}>
                      Payment status <span className="text-red-600">*</span>
                    </label>
                    <CustomDropdown
                      id="statement-payment-status"
                      options={PAYMENT_STATUS_OPTIONS}
                      value={statementForm.payment_status}
                      onChange={(value) => updateForm("payment_status", value)}
                      placeholder="Select a status"
                    />
                  </div>
                </div>

                {/* File upload & notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200 pt-6">
                  {/* File upload */}
                  <div>
                    <label
                      htmlFor={
                        statementForm.file ? undefined : "statement-file-upload"
                      }
                      className={LABEL}
                    >
                      Statement file{" "}
                      {!isEditingStatement && (
                        <span className="text-red-600">*</span>
                      )}
                    </label>
                    {!statementForm.file ? (
                      <div className="relative">
                        <input
                          type="file"
                          id="statement-file-upload"
                          accept="application/pdf,image/jpeg,image/jpg,image/png"
                          onChange={handleFileChange}
                          aria-invalid={!!errors.file}
                          aria-describedby={
                            errors.file
                              ? "statement-file-error"
                              : "statement-file-hint"
                          }
                          className="sr-only peer"
                        />
                        <label
                          htmlFor="statement-file-upload"
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={`cursor-pointer flex flex-col items-center text-center w-full py-8 rounded-lg border-2 border-dashed transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${
                            errors.file
                              ? "border-red-500"
                              : isDragging
                                ? "border-primary"
                                : "border-slate-300 hover:border-primary"
                          }`}
                        >
                          <FileText
                            className={`w-8 h-8 mb-2 ${
                              isDragging ? "text-primary" : "text-slate-400"
                            }`}
                            aria-hidden="true"
                          />
                          <span
                            className={`text-sm font-medium ${
                              isDragging ? "text-primary" : "text-slate-700"
                            }`}
                          >
                            {isDragging
                              ? "Drop file here"
                              : "Click to upload or drag and drop"}
                          </span>
                        </label>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-lg p-3 flex items-center justify-between gap-3 bg-slate-50">
                        <div className="flex items-center gap-3 overflow-hidden">
                          {filePreview ? (
                            <img
                              src={filePreview}
                              alt=""
                              className="w-10 h-10 rounded-md object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-white rounded-md border border-slate-200 flex items-center justify-center">
                              <FileText
                                className="w-5 h-5 text-slate-400"
                                aria-hidden="true"
                              />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p
                              className="text-sm font-medium text-slate-800 truncate"
                              title={statementForm.file.name}
                            >
                              {statementForm.file.name}
                            </p>
                            <p className="text-xs text-slate-500">
                              {(statementForm.file.size / 1024 / 1024).toFixed(
                                2,
                              )}{" "}
                              MB
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowFilePreview(true)}
                            className={ICON_BTN}
                            aria-label="Preview file"
                            title="Preview file"
                          >
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={removeSelectedFile}
                            className={ICON_BTN_DANGER}
                            aria-label="Remove file"
                            title="Remove file"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    )}
                    {errors.file ? (
                      <FieldError
                        id="statement-file-error"
                        message={errors.file}
                      />
                    ) : (
                      <p
                        id="statement-file-hint"
                        className="text-xs text-slate-500 mt-1"
                      >
                        PDF, JPG or PNG, up to 10 MB.
                      </p>
                    )}
                    {isEditingStatement && editingStatement?.supplier_file && (
                      <p className="mt-1 text-xs text-slate-500">
                        Current file: {editingStatement.supplier_file.filename}.
                        Leave empty to keep it.
                      </p>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label htmlFor="statement-notes" className={LABEL}>
                      Notes
                    </label>
                    <textarea
                      id="statement-notes"
                      rows={5}
                      value={statementForm.notes}
                      onChange={(e) => updateForm("notes", e.target.value)}
                      className={`${FIELD} ${fieldTone(false)} resize-none`}
                      placeholder="e.g. Includes the October freight surcharge"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isSaving}
                  className={BTN_SECONDARY_FORM}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={BTN_PRIMARY}
                >
                  {isSaving ? (
                    <Spinner onPrimary />
                  ) : isEditingStatement ? (
                    <Check className="w-4 h-4" aria-hidden="true" />
                  ) : (
                    <Upload className="w-4 h-4" aria-hidden="true" />
                  )}
                  {submitLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* File preview. Rendered outside the modal backdrop so clicks inside it
          cannot reach the modal's backdrop-click handler. */}
      {showUploadStatementModal &&
        showFilePreview &&
        statementForm.file &&
        fileObjectURL && (
          <ViewMedia
            selectedFile={{
              name: statementForm.file.name,
              url: fileObjectURL,
              type: statementForm.file.type,
              size: statementForm.file.size,
              isExisting: false,
            }}
            setSelectedFile={() => {}}
            setViewFileModal={setShowFilePreview}
            setPageNumber={setPageNumber}
          />
        )}
    </AdminShell>
  );
}
