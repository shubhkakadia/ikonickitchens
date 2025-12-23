"use client";
import { Fragment, useEffect, useMemo, useState, useRef } from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import { useDispatch } from "react-redux";
import { replaceTab } from "@/state/reducer/tabs";
import { v4 as uuidv4 } from "uuid";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const num =
    typeof value === "number"
      ? value
      : parseFloat(String(value).replace(/,/g, ""));
  if (!Number.isFinite(num)) return "-";
  return `$${currencyFormatter.format(num)}`;
};

export default function StatementsPage() {
  const dispatch = useDispatch();
  const { getToken } = useAuth();
  const [statements, setStatements] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [error, setError] = useState(null);
  const [showUploadStatementModal, setShowUploadStatementModal] =
    useState(false);
  const [isUploadingStatement, setIsUploadingStatement] = useState(false);
  const [statementForm, setStatementForm] = useState({
    supplier_id: "",
    month_year: "",
    due_date: "",
    amount: "",
    payment_status: "PENDING",
    notes: "",
    file: null,
  });
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
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("month_year");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState("pending");
  const [isExporting, setIsExporting] = useState(false);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Refs for dropdown containers
  const sortDropdownRef = useRef(null);
  const columnDropdownRef = useRef(null);
  const supplierDropdownRef = useRef(null);

  // Supplier search state for modal
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);

  // File upload states
  const [filePreview, setFilePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(false);

  // Due In dropdown state
  const [dueIn, setDueIn] = useState("custom");

  // Status update loading state (tracking which statement is being updated)
  const [updatingStatusId, setUpdatingStatusId] = useState(null);

  // Status dropdown state (tracking which statement's dropdown is open)
  const [openStatusDropdownId, setOpenStatusDropdownId] = useState(null);
  const statusDropdownRefs = useRef({});

  // Year and month filter states
  const [yearFilter, setYearFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [monthDropdownOpen, setMonthDropdownOpen] = useState(false);
  const yearDropdownRef = useRef(null);
  const monthDropdownRef = useRef(null);

  // Define all available columns for export
  const availableColumns = [
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

  // Initialize selected columns with all columns
  const [selectedColumns, setSelectedColumns] = useState([...availableColumns]);

  useEffect(() => {
    fetchStatements();
    fetchSuppliers();
    dispatch(
      replaceTab({
        id: uuidv4(),
        title: "Statements",
        href: "/admin/suppliers/statements",
      })
    );
  }, []);

  // Reset to first page when search or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

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
      if (
        supplierDropdownRef.current &&
        !supplierDropdownRef.current.contains(event.target)
      ) {
        setIsSupplierDropdownOpen(false);
      }
      if (
        yearDropdownRef.current &&
        !yearDropdownRef.current.contains(event.target)
      ) {
        setYearDropdownOpen(false);
      }
      if (
        monthDropdownRef.current &&
        !monthDropdownRef.current.contains(event.target)
      ) {
        setMonthDropdownOpen(false);
      }
      // Check status dropdowns
      let clickedOutsideAllStatusDropdowns = true;
      Object.values(statusDropdownRefs.current).forEach((ref) => {
        if (ref && ref.contains(event.target)) {
          clickedOutsideAllStatusDropdowns = false;
        }
      });
      if (clickedOutsideAllStatusDropdowns) {
        setOpenStatusDropdownId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Fetch all suppliers from API
  const fetchSuppliers = async () => {
    try {
      setLoadingSuppliers(true);
      const sessionToken = getToken();
      if (!sessionToken) return;

      const response = await axios.get("/api/supplier/all", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.data.status) {
        setSuppliers(response.data.data || []);
      } else {
        toast.error("Failed to fetch suppliers", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (err) {
      console.error("Error fetching suppliers:", err);
      toast.error("Error fetching suppliers", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setLoadingSuppliers(false);
    }
  };

  // Get available years from statements
  const getAvailableYears = useMemo(() => {
    const years = new Set();
    statements.forEach((statement) => {
      if (statement.month_year) {
        const year = statement.month_year.split("-")[0];
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [statements]);

  // Format month number to month name
  const formatMonthName = (monthNumber) => {
    const date = new Date(2000, parseInt(monthNumber) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long" });
  };

  // Get available months for selected year
  const getAvailableMonthsForYear = useMemo(() => {
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

  // Filter suppliers for search dropdown
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((supplier) =>
      supplier.name?.toLowerCase().includes(supplierSearchTerm.toLowerCase())
    );
  }, [suppliers, supplierSearchTerm]);

  const fetchStatements = async () => {
    try {
      setLoading(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        return;
      }

      const response = await axios.get("/api/supplier/statements", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        setStatements(response.data.data || []);
        setError(null);
      } else {
        setError(response.data.message || "Failed to fetch statements");
      }
    } catch (err) {
      console.error("Error fetching statements:", err);
      setError(err.response?.data?.message || "Failed to fetch statements");
      toast.error(err.response?.data?.message || "Failed to fetch statements", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to format date to month/year string
  const formatMonthYear = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}`;
  };

  // Filter and sort statements
  const filteredAndSortedStatements = useMemo(() => {
    // First filter by tab (payment status)
    let filtered = statements.filter((statement) =>
      activeTab === "pending"
        ? statement.payment_status === "PENDING"
        : statement.payment_status === "PAID"
    );

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
  }, [statements, search, sortField, sortOrder, activeTab, yearFilter, monthFilter]);

  // Pagination logic
  const totalItems = filteredAndSortedStatements.length;
  const totalPages =
    itemsPerPage === 0 ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedStatements = filteredAndSortedStatements.slice(
    startIndex,
    endIndex
  );

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
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

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    if (sortOrder === "asc") return <ArrowUp className="h-4 w-4" />;
    if (sortOrder === "desc") return <ArrowDown className="h-4 w-4" />;
    return null;
  };

  // Reset month filter when year changes to "all"
  useEffect(() => {
    if (yearFilter === "all") {
      setMonthFilter("all");
    }
  }, [yearFilter]);

  const handleReset = () => {
    setSearch("");
    setSortField("month_year");
    setSortOrder("desc");
    setCurrentPage(1);
    setYearFilter("all");
    setMonthFilter("all");
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

  // File handling functions
  const validateAndSetFile = (file) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF and image files are allowed", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    setStatementForm((prev) => ({ ...prev, file }));
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
  };

  // Supplier selection handlers
  const handleSupplierSearchChange = (e) => {
    setSupplierSearchTerm(e.target.value);
    setIsSupplierDropdownOpen(true);
  };

  const handleSupplierSelect = (supplierId, supplierName) => {
    setStatementForm((prev) => ({ ...prev, supplier_id: supplierId }));
    setSupplierSearchTerm(supplierName);
    setIsSupplierDropdownOpen(false);
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
    }
  };

  // Handle manual due date change
  const handleDueDateChange = (e) => {
    const newDate = e.target.value;
    setStatementForm((prev) => ({ ...prev, due_date: newDate }));

    // Check if the new date matches any preset option
    const matchingOption = checkDueInOption(newDate);
    setDueIn(matchingOption);
  };

  const handleExportToExcel = async () => {
    if (filteredAndSortedStatements.length === 0) {
      toast.warning("No data to export.", {
        position: "top-right",
        autoClose: 3000,
      });
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
      toast.success(`Exported ${exportData.length} rows to ${filename}`, {
        position: "top-right",
        autoClose: 3000,
      });
    } catch (err) {
      toast.error("Failed to export data to Excel.", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleUploadStatement = async () => {
    try {
      if (!statementForm.file) {
        toast.error("Please select a file to upload", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      if (
        !statementForm.month_year ||
        !statementForm.due_date ||
        !statementForm.supplier_id
      ) {
        toast.error("Please fill in all required fields", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      setIsUploadingStatement(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      const formData = new FormData();
      formData.append("file", statementForm.file);
      formData.append("month_year", formatMonthYear(statementForm.month_year));
      formData.append("due_date", statementForm.due_date);
      formData.append("amount", statementForm.amount || "");
      formData.append("payment_status", statementForm.payment_status);
      formData.append("notes", statementForm.notes || "");

      const response = await axios.post(
        `/api/supplier/${statementForm.supplier_id}/statements`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.status) {
        toast.success("Statement uploaded successfully!", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        setShowUploadStatementModal(false);
        setStatementForm({
          supplier_id: "",
          month_year: "",
          due_date: "",
          amount: "",
          payment_status: "PENDING",
          notes: "",
          file: null,
        });
        setDueIn("custom");
        fetchStatements();
      } else {
        toast.error(response.data.message || "Failed to upload statement", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
      }
    } catch (err) {
      console.error("Error uploading statement:", err);
      toast.error(err.response?.data?.message || "Failed to upload statement", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
    } finally {
      setIsUploadingStatement(false);
    }
  };

  const handleEditStatement = (statement) => {
    // Convert month_year (e.g., "2025-01") to date format for month input
    const monthYearDate = statement.month_year
      ? `${statement.month_year}-01`
      : "";
    const dueDate = statement.due_date
      ? new Date(statement.due_date).toISOString().split("T")[0]
      : "";

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
    setSupplierSearchTerm(statement.supplier?.name || "");
    setFilePreview(null);
    // Set dueIn based on the statement's due date
    setDueIn(checkDueInOption(dueDate));
    setIsEditingStatement(true);
    setShowUploadStatementModal(true);
  };

  const handleUpdateStatement = async (statement = null, newStatus = null) => {
    // If statement and newStatus are provided, it's a status-only update from table
    const isStatusOnlyUpdate = statement && newStatus !== null;

    try {
      if (isStatusOnlyUpdate) {
        // Don't update if status hasn't changed
        if (statement.payment_status === newStatus) return;

        setUpdatingStatusId(statement.id);
      } else {
        // Full update from edit modal
        if (!statementForm.due_date || !statementForm.supplier_id) {
          toast.error("Please fill in all required fields", {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
          });
          return;
        }
        setIsUpdatingStatement(true);
      }

      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
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
        formData.append("month_year", formatMonthYear(statementForm.month_year));
        formData.append("due_date", statementForm.due_date);
        formData.append("amount", statementForm.amount || "");
        formData.append("payment_status", statementForm.payment_status);
        formData.append("notes", statementForm.notes || "");
      }

      const supplierId = isStatusOnlyUpdate ? statement.supplier_id : statementForm.supplier_id;
      const statementId = isStatusOnlyUpdate ? statement.id : editingStatement.id;

      const response = await axios.patch(
        `/api/supplier/${supplierId}/statements/${statementId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.status) {
        if (isStatusOnlyUpdate) {
          toast.success("Status updated successfully!", {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
          });
        } else {
          toast.success("Statement updated successfully!", {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
          });
          setShowUploadStatementModal(false);
          setIsEditingStatement(false);
          setEditingStatement(null);
          setStatementForm({
            supplier_id: "",
            month_year: "",
            due_date: "",
            amount: "",
            payment_status: "PENDING",
            notes: "",
            file: null,
          });
          setDueIn("custom");
        }
        fetchStatements();
      } else {
        toast.error(response.data.message || "Failed to update statement", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
      }
    } catch (err) {
      console.error("Error updating statement:", err);
      toast.error(err.response?.data?.message || "Failed to update statement", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
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
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      const response = await axios.delete(
        `/api/supplier/${statementToDelete.supplier_id}/statements/${statementToDelete.id}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (response.data.status) {
        toast.success("Statement deleted successfully!", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        setShowDeleteStatementModal(false);
        setStatementToDelete(null);
        fetchStatements();
      } else {
        toast.error(response.data.message || "Failed to delete statement", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
      }
    } catch (err) {
      console.error("Error deleting statement:", err);
      toast.error(err.response?.data?.message || "Failed to delete statement", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
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
    setStatementForm({
      supplier_id: "",
      month_year: "",
      due_date: "",
      amount: "",
      payment_status: "PENDING",
      notes: "",
      file: null,
    });
    setSupplierSearchTerm("");
    setIsSupplierDropdownOpen(false);
    setFilePreview(null);
    setIsDragging(false);
    setShowFilePreview(false);
    setDueIn("custom");
  };

  const sortOptions = [
    { value: "month_year", label: "Month/Year" },
    { value: "supplier", label: "Supplier" },
    { value: "due_date", label: "Due Date" },
    { value: "amount", label: "Amount" },
    { value: "payment_status", label: "Payment Status" },
  ];

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
                    Loading statements details...
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
                <div className="px-3 py-2 shrink-0">
                  <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-slate-600">
                      Supplier Statements
                    </h1>
                    <button
                      onClick={() => setShowUploadStatementModal(true)}
                      className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-primary/80 hover:bg-primary text-white rounded-lg transition-all duration-200 text-xs font-medium"
                    >
                      <Receipt className="w-4 h-4" />
                      Upload Statement
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden px-3 pb-3">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                    {/* Fixed Header Section */}
                    <div className="p-3 shrink-0 border-b border-slate-200">
                      <div className="flex items-center justify-between">
                        {/* Search */}
                        <div className="flex items-center gap-2 flex-1 max-w-sm relative">
                          <Search className="h-4 w-4 absolute left-3 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search by supplier name, email, or month/year"
                            className="w-full text-slate-800 p-2 pl-9 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm"
                            value={search}
                            onChange={(e) => {
                              setSearch(e.target.value);
                              setCurrentPage(1);
                            }}
                          />
                        </div>

                        {/* Reset, Year, Month Filters, Sort, Items Per Page */}
                        <div className="flex items-center gap-2">
                          {/* Reset Button */}
                          {(search !== "" ||
                            sortField !== "month_year" ||
                            sortOrder !== "desc" ||
                            yearFilter !== "all" ||
                            monthFilter !== "all") && (
                              <button
                                onClick={handleReset}
                                className="cursor-pointer flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                              >
                                <RotateCcw className="h-4 w-4" />
                                <span>Reset</span>
                              </button>
                            )}

                          {/* Year Filter Dropdown */}
                          <div className="relative" ref={yearDropdownRef}>
                            <button
                              onClick={() => setYearDropdownOpen(!yearDropdownOpen)}
                              className="cursor-pointer flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                            >
                              {yearFilter === "all" ? "All Years" : yearFilter}
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            {yearDropdownOpen && (
                              <div className="absolute right-0 mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                                <button
                                  onClick={() => {
                                    setYearFilter("all");
                                    setYearDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-100 transition-colors cursor-pointer ${yearFilter === "all"
                                    ? "text-primary font-medium"
                                    : "text-slate-600"
                                    }`}
                                >
                                  All Years
                                </button>
                                {getAvailableYears.map((year) => (
                                  <button
                                    key={year}
                                    onClick={() => {
                                      setYearFilter(year);
                                      setYearDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-100 transition-colors cursor-pointer ${yearFilter === year
                                      ? "text-primary font-medium"
                                      : "text-slate-600"
                                      }`}
                                  >
                                    {year}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Month Filter Dropdown */}
                          <div className="relative" ref={monthDropdownRef}>
                            <button
                              onClick={() => {
                                if (yearFilter !== "all") {
                                  setMonthDropdownOpen(!monthDropdownOpen);
                                }
                              }}
                              disabled={yearFilter === "all"}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${yearFilter === "all"
                                ? "text-slate-400 bg-slate-100 border border-slate-300 cursor-not-allowed"
                                : "text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 cursor-pointer"
                                }`}
                            >
                              {monthFilter === "all" ? "All Months" : formatMonthName(monthFilter)}
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            {monthDropdownOpen && yearFilter !== "all" && (
                              <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                                <button
                                  onClick={() => {
                                    setMonthFilter("all");
                                    setMonthDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-100 transition-colors cursor-pointer ${monthFilter === "all"
                                    ? "text-primary font-medium"
                                    : "text-slate-600"
                                    }`}
                                >
                                  All Months
                                </button>
                                {getAvailableMonthsForYear.map((month) => (
                                  <button
                                    key={month}
                                    onClick={() => {
                                      setMonthFilter(month.toString());
                                      setMonthDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-slate-100 transition-colors cursor-pointer ${monthFilter === month.toString()
                                      ? "text-primary font-medium"
                                      : "text-slate-600"
                                      }`}
                                  >
                                    {formatMonthName(month)}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="relative" ref={sortDropdownRef}>
                            <button
                              onClick={() =>
                                setShowSortDropdown(!showSortDropdown)
                              }
                              className="cursor-pointer flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                            >
                              <ArrowUpDown className="h-4 w-4" />
                              <span>Sort by</span>
                            </button>
                            {showSortDropdown && (
                              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                                <div className="py-1">
                                  {sortOptions.map((option) => (
                                    <button
                                      key={option.value}
                                      onClick={() => {
                                        if (sortField === option.value) {
                                          setSortOrder(
                                            sortOrder === "asc" ? "desc" : "asc"
                                          );
                                        } else {
                                          setSortField(option.value);
                                          setSortOrder("asc");
                                        }
                                        setShowSortDropdown(false);
                                      }}
                                      className="cursor-pointer w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                    >
                                      {option.label} {getSortIcon(option.value)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="relative flex items-center" ref={columnDropdownRef}>
                            <button
                              onClick={handleExportToExcel}
                              disabled={
                                isExporting ||
                                filteredAndSortedStatements.length === 0 ||
                                selectedColumns.length === 0
                              }
                              className={`flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 border-r-0 px-3 py-2 rounded-l-lg text-sm font-medium ${isExporting ||
                                filteredAndSortedStatements.length === 0 ||
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
                                filteredAndSortedStatements.length === 0
                              }
                              className={`flex items-center transition-all duration-200 text-slate-600 border border-slate-300 px-2 py-2 rounded-r-lg text-xs font-medium ${isExporting ||
                                filteredAndSortedStatements.length === 0
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

                    {/* Tabs Section */}
                    <div className="px-3 shrink-0 border-b border-slate-200">
                      <nav className="flex space-x-6">
                        <button
                          onClick={() => setActiveTab("pending")}
                          className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "pending"
                            ? "border-primary text-primary"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                        >
                          Pending
                        </button>
                        <button
                          onClick={() => setActiveTab("paid")}
                          className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "paid"
                            ? "border-primary text-primary"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                        >
                          Paid
                        </button>
                      </nav>
                    </div>

                    {/* Scrollable Table Section */}
                    <div className="flex-1 overflow-auto px-3">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-8"></th>
                            <th
                              className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("supplier")}
                            >
                              <div className="flex items-center gap-2">
                                Supplier
                                {getSortIcon("supplier")}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("month_year")}
                            >
                              <div className="flex items-center gap-2">
                                Month/Year
                                {getSortIcon("month_year")}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("due_date")}
                            >
                              <div className="flex items-center gap-2">
                                Due Date
                                {getSortIcon("due_date")}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("amount")}
                            >
                              <div className="flex items-center gap-2">
                                Amount
                                {getSortIcon("amount")}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("payment_status")}
                            >
                              <div className="flex items-center gap-2">
                                Status
                                {getSortIcon("payment_status")}
                              </div>
                            </th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              File
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {paginatedStatements.length === 0 ? (
                            <tr>
                              <td
                                className="px-3 py-10 text-xs text-slate-500 text-center"
                                colSpan={8}
                              >
                                {search
                                  ? "No statements found matching your search"
                                  : "No statements found"}
                              </td>
                            </tr>
                          ) : (
                            paginatedStatements.map((statement) => (
                              <Fragment key={statement.id}>
                                <tr
                                  className={`cursor-pointer hover:bg-slate-50 transition-colors duration-200 ${statement.notes ? "" : ""
                                    }`}
                                  onClick={() =>
                                    statement.notes && toggleNotes(statement.id)
                                  }
                                >
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    {statement.notes && (
                                      <div className="flex items-center">
                                        {expandedNotes.has(statement.id) ? (
                                          <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                                        ) : (
                                          <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                                        )}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-semibold text-gray-800 truncate">
                                        {statement.supplier?.name || "-"}
                                      </span>
                                      {statement.supplier?.email && (
                                        <span className="text-xs text-slate-600 truncate">
                                          {statement.supplier.email}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                                    {statement.month_year}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                                    {new Date(
                                      statement.due_date
                                    ).toLocaleDateString()}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                                    {formatCurrency(statement.amount)}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    <div
                                      ref={(el) => {
                                        statusDropdownRefs.current[statement.id] = el;
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      className="relative inline-flex items-center gap-2"
                                    >
                                      <div className="relative">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setOpenStatusDropdownId(
                                              openStatusDropdownId === statement.id
                                                ? null
                                                : statement.id
                                            )
                                          }
                                          disabled={updatingStatusId === statement.id}
                                          className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-all ${statement.payment_status === "PAID"
                                            ? "bg-green-100 text-green-800 hover:bg-green-200"
                                            : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                                            } ${updatingStatusId === statement.id
                                              ? "opacity-50 cursor-not-allowed"
                                              : "cursor-pointer"
                                            }`}
                                        >
                                          <span>{statement.payment_status}</span>
                                          <ChevronDown
                                            className={`h-3 w-3 transition-transform duration-200 ${openStatusDropdownId === statement.id
                                              ? "rotate-180"
                                              : ""
                                              }`}
                                          />
                                        </button>
                                        {openStatusDropdownId === statement.id && (
                                          <div className="absolute left-0 mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                                            <div className="py-1">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (statement.payment_status !== "PENDING") {
                                                    handleUpdateStatement(statement, "PENDING");
                                                  }
                                                  setOpenStatusDropdownId(null);
                                                }}
                                                className="cursor-pointer w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                                              >
                                                <span
                                                  className={`px-1.5 py-0.5 rounded text-xs font-medium ${statement.payment_status === "PENDING"
                                                    ? "bg-yellow-100 text-yellow-800"
                                                    : ""
                                                    }`}
                                                >
                                                  Pending
                                                </span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (statement.payment_status !== "PAID") {
                                                    handleUpdateStatement(statement, "PAID");
                                                  }
                                                  setOpenStatusDropdownId(null);
                                                }}
                                                className="cursor-pointer w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                                              >
                                                <span
                                                  className={`px-1.5 py-0.5 rounded text-xs font-medium ${statement.payment_status === "PAID"
                                                    ? "bg-green-100 text-green-800"
                                                    : ""
                                                    }`}
                                                >
                                                  Paid
                                                </span>
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      {updatingStatusId === statement.id && (
                                        <div className="animate-spin h-3 w-3 border-2 border-slate-400 border-t-transparent rounded-full"></div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-xs text-slate-600 whitespace-nowrap">
                                    {statement.supplier_file?.filename || "-"}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <div
                                      className="flex items-center justify-end gap-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {statement.supplier_file && (
                                        <button
                                          onClick={() =>
                                            handleViewStatement(statement)
                                          }
                                          className="cursor-pointer p-1.5 rounded hover:bg-slate-100"
                                          title="View"
                                        >
                                          <Eye className="w-3.5 h-3.5 text-slate-600" />
                                        </button>
                                      )}
                                      <button
                                        onClick={() =>
                                          handleEditStatement(statement)
                                        }
                                        className="cursor-pointer p-1.5 rounded hover:bg-slate-100"
                                        title="Edit"
                                      >
                                        <Edit className="w-3.5 h-3.5 text-slate-600" />
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleDeleteStatement(statement)
                                        }
                                        className="cursor-pointer p-1.5 rounded hover:bg-slate-100"
                                        title="Delete"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {statement.notes &&
                                  expandedNotes.has(statement.id) && (
                                    <tr>
                                      <td
                                        colSpan={8}
                                        className="px-3 pb-3 border-t border-slate-200 bg-slate-50"
                                      >
                                        <div className="mt-2 text-xs text-slate-700">
                                          <span className="font-medium text-slate-800 mb-2 block">
                                            Notes:
                                          </span>
                                          <div className="text-slate-600 whitespace-pre-wrap pl-4 border-l-2 border-slate-300">
                                            {statement.notes}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                              </Fragment>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Fixed Pagination Footer */}
                    {paginatedStatements.length > 0 && (
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

            {/* View File Modal */}
            {viewFileModal && selectedFile && (
              <ViewMedia
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
                setViewFileModal={setViewFileModal}
                setPageNumber={setPageNumber}
              />
            )}

            {/* Delete Statement Confirmation Modal */}
            <DeleteConfirmation
              isOpen={showDeleteStatementModal}
              onClose={() => {
                setShowDeleteStatementModal(false);
                setStatementToDelete(null);
              }}
              onConfirm={handleDeleteStatementConfirm}
              deleteWithInput={true}
              heading="Statement"
              message={`This will permanently delete the statement for ${statementToDelete?.month_year || ""
                } from ${statementToDelete?.supplier?.name || ""
                }. This action cannot be undone.`}
              comparingName={statementToDelete?.month_year || ""}
              isDeleting={isDeletingStatement}
              entityType="supplier_statement"
            />

            {/* Upload Statement Modal */}
            {showUploadStatementModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50">
                <div
                  className="absolute inset-0 bg-slate-900/40"
                  onClick={resetForm}
                />
                <div className="relative bg-white w-full max-w-2xl mx-4 rounded-xl shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
                  {/* Header */}
                  <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <h2 className="text-xl font-semibold text-slate-800">
                      {isEditingStatement
                        ? "Edit Statement"
                        : "Upload Statement"}
                    </h2>
                    <button
                      onClick={resetForm}
                      className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-slate-600" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Top Section: Supplier & Details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {!isEditingStatement && (
                        <div className="relative" ref={supplierDropdownRef}>
                          <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                            Select Supplier <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={supplierSearchTerm}
                              onChange={handleSupplierSearchChange}
                              onFocus={() => setIsSupplierDropdownOpen(true)}
                              className="w-full text-sm text-slate-800 px-4 py-3 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                              placeholder="Search or select supplier..."
                              disabled={loadingSuppliers}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setIsSupplierDropdownOpen(!isSupplierDropdownOpen)
                              }
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              {loadingSuppliers ? (
                                <div className="animate-spin h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full"></div>
                              ) : (
                                <ChevronDown
                                  className={`w-5 h-5 transition-transform duration-200 ${isSupplierDropdownOpen ? "rotate-180" : ""
                                    }`}
                                />
                              )}
                            </button>
                          </div>

                          {isSupplierDropdownOpen && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                              {loadingSuppliers ? (
                                <div className="px-4 py-3 text-sm text-slate-500 text-center">
                                  Loading suppliers...
                                </div>
                              ) : filteredSuppliers.length > 0 ? (
                                filteredSuppliers.map((supplier) => (
                                  <button
                                    key={supplier.supplier_id}
                                    type="button"
                                    onClick={() =>
                                      handleSupplierSelect(
                                        supplier.supplier_id,
                                        supplier.name
                                      )
                                    }
                                    className="cursor-pointer w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg last:rounded-b-lg"
                                  >
                                    <div>
                                      <div className="font-medium">
                                        {supplier.name}
                                      </div>
                                      {supplier.email && (
                                        <div className="text-xs text-slate-500">
                                          {supplier.email}
                                        </div>
                                      )}
                                    </div>
                                  </button>
                                ))
                              ) : (
                                <div className="px-4 py-3 text-sm text-slate-500 text-center">
                                  No matching suppliers found
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                          Month/Year <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="month"
                          value={statementForm.month_year}
                          onChange={(e) =>
                            setStatementForm({
                              ...statementForm,
                              month_year: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                          Due In
                        </label>
                        <select
                          value={dueIn}
                          onChange={(e) => handleDueInChange(e.target.value)}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        >
                          <option value="1 week">1 Week</option>
                          <option value="2 weeks">2 Weeks</option>
                          <option value="3 weeks">3 Weeks</option>
                          <option value="4 weeks">4 Weeks</option>
                          <option value="custom">Custom</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                          Due Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={statementForm.due_date}
                          onChange={handleDueDateChange}
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                          Amount
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-slate-500">
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={statementForm.amount}
                            onChange={(e) =>
                              setStatementForm({
                                ...statementForm,
                                amount: e.target.value,
                              })
                            }
                            placeholder="0.00"
                            className="w-full px-4 py-3 pl-7 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                          Payment Status <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={statementForm.payment_status}
                          onChange={(e) =>
                            setStatementForm({
                              ...statementForm,
                              payment_status: e.target.value,
                            })
                          }
                          className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                        >
                          <option value="PENDING">Pending</option>
                          <option value="PAID">Paid</option>
                        </select>
                      </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* File Upload & Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* File Upload */}
                      <div>
                        <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                          Statement File{" "}
                          {!isEditingStatement && (
                            <span className="text-red-500">*</span>
                          )}
                        </label>
                        {!statementForm.file ? (
                          <div
                            className={`border-2 border-dashed rounded-lg py-8 transition-all ${isDragging
                              ? "border-primary bg-blue-50"
                              : "border-slate-300 hover:border-primary hover:bg-slate-50"
                              }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                          >
                            <input
                              type="file"
                              id="statement-file-upload"
                              accept="application/pdf,image/jpeg,image/jpg,image/png"
                              onChange={handleFileChange}
                              className="hidden"
                            />
                            <label
                              htmlFor="statement-file-upload"
                              className="cursor-pointer flex flex-col items-center text-center w-full h-full"
                            >
                              <FileText
                                className={`w-8 h-8 mb-2 ${isDragging ? "text-primary" : "text-slate-400"
                                  }`}
                              />
                              <p
                                className={`text-sm font-medium ${isDragging
                                  ? "text-primary"
                                  : "text-slate-700"
                                  }`}
                              >
                                {isDragging
                                  ? "Drop file here"
                                  : "Click to upload or drag and drop"}
                              </p>
                            </label>
                          </div>
                        ) : (
                          <div className="border border-slate-200 rounded-lg p-3 flex items-center justify-between bg-slate-50">
                            <div className="flex items-center gap-3 overflow-hidden">
                              {filePreview ? (
                                <img
                                  src={filePreview}
                                  alt="Preview"
                                  className="w-10 h-10 rounded object-cover border border-slate-200"
                                />
                              ) : (
                                <div className="w-10 h-10 bg-white rounded border border-slate-200 flex items-center justify-center">
                                  <FileText className="w-5 h-5 text-slate-400" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">
                                  {statementForm.file.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {(
                                    statementForm.file.size /
                                    1024 /
                                    1024
                                  ).toFixed(2)}{" "}
                                  MB
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setShowFilePreview(true)}
                                className="cursor-pointer p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-colors"
                              >
                                <Eye className="w-4 h-4 text-slate-600" />
                              </button>
                              <button
                                onClick={() => {
                                  setStatementForm((prev) => ({
                                    ...prev,
                                    file: null,
                                  }));
                                  setFilePreview(null);
                                }}
                                className="cursor-pointer p-1.5 hover:bg-red-50 rounded border border-transparent hover:border-red-100 transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </div>
                          </div>
                        )}
                        {isEditingStatement &&
                          editingStatement?.supplier_file && (
                            <p className="mt-2 text-xs text-slate-500">
                              Current file:{" "}
                              {editingStatement.supplier_file.filename} (Leave
                              empty to keep current file)
                            </p>
                          )}
                      </div>

                      {/* Notes */}
                      <div>
                        <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                          Notes
                        </label>
                        <textarea
                          rows={5}
                          value={statementForm.notes}
                          onChange={(e) =>
                            setStatementForm({
                              ...statementForm,
                              notes: e.target.value,
                            })
                          }
                          className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
                          placeholder="Add any additional notes..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
                    <button
                      onClick={resetForm}
                      disabled={isUploadingStatement || isUpdatingStatement}
                      className="cursor-pointer px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={
                        isEditingStatement
                          ? handleUpdateStatement
                          : handleUploadStatement
                      }
                      disabled={isUploadingStatement || isUpdatingStatement}
                      className="cursor-pointer px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                      {isUploadingStatement || isUpdatingStatement ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                          {isEditingStatement ? "Updating..." : "Uploading..."}
                        </>
                      ) : isEditingStatement ? (
                        "Update Statement"
                      ) : (
                        "Upload Statement"
                      )}
                    </button>
                  </div>
                </div>

                {/* File Preview Modal */}
                {showFilePreview && statementForm.file && (
                  <ViewMedia
                    selectedFile={{
                      name: statementForm.file.name,
                      url: URL.createObjectURL(statementForm.file),
                      type: statementForm.file.type,
                      size: statementForm.file.size,
                      isExisting: false,
                    }}
                    setSelectedFile={() => { }}
                    setViewFileModal={setShowFilePreview}
                    setPageNumber={setPageNumber}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminRoute>
  );
}
