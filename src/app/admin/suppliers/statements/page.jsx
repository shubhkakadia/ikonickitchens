"use client";
import { Fragment, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  Sheet,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { replaceTab } from "@/state/reducer/tabs";
import { v4 as uuidv4 } from "uuid";

export default function StatementsPage() {
  const dispatch = useDispatch();
  const { getToken } = useAuth();
  const [statements, setStatements] = useState([]);
  const [loadingStatements, setLoadingStatements] = useState(false);
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
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] =
    useState(false);
  const [activeTab, setActiveTab] = useState("pending");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchStatements();
    dispatch(
      replaceTab({
        id: uuidv4(),
        title: "Statements",
        href: "/admin/suppliers/statements",
      })
    );
  }, []);

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

  // Extract unique suppliers from statements data
  const suppliers = useMemo(() => {
    const supplierMap = new Map();
    statements.forEach((statement) => {
      if (
        statement.supplier &&
        !supplierMap.has(statement.supplier.supplier_id)
      ) {
        supplierMap.set(statement.supplier.supplier_id, statement.supplier);
      }
    });
    return Array.from(supplierMap.values());
  }, [statements]);

  const fetchStatements = async () => {
    try {
      setLoadingStatements(true);
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
      setLoadingStatements(false);
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
  }, [statements, search, sortField, sortOrder, activeTab]);

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

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    if (sortOrder === "asc") return <ArrowUp className="h-4 w-4" />;
    if (sortOrder === "desc") return <ArrowDown className="h-4 w-4" />;
    return null;
  };

  const handleReset = () => {
    setSearch("");
    setSortField("month_year");
    setSortOrder("desc");
    setCurrentPage(1);
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
      const exportData = filteredAndSortedStatements.map((statement) => {
        const supplierName = statement.supplier?.name || "";
        const supplierEmail = statement.supplier?.email || "";
        const monthYear = statement.month_year || "";
        const dueDate = statement.due_date
          ? new Date(statement.due_date).toLocaleDateString()
          : "";
        const amount = statement.amount
          ? parseFloat(statement.amount).toFixed(2)
          : "";
        const paymentStatus = statement.payment_status || "";
        const notes = statement.notes || "";
        const fileName = statement.supplier_file?.filename || "";
        const fileUrl = statement.supplier_file?.url
          ? `${origin}/${statement.supplier_file.url}`
          : "";
        const createdAt = statement.createdAt
          ? new Date(statement.createdAt).toLocaleString()
          : "";
        const updatedAt = statement.updatedAt
          ? new Date(statement.updatedAt).toLocaleString()
          : "";

        return {
          Supplier: supplierName,
          "Supplier Email": supplierEmail,
          "Month/Year": monthYear,
          "Due Date": dueDate,
          Amount: amount,
          "Payment Status": paymentStatus,
          "File Name": fileName,
          "File URL": fileUrl,
          Notes: notes,
          "Created At": createdAt,
          "Updated At": updatedAt,
        };
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws["!cols"] = [
        { wch: 24 }, // Supplier
        { wch: 28 }, // Supplier Email
        { wch: 12 }, // Month/Year
        { wch: 14 }, // Due Date
        { wch: 12 }, // Amount
        { wch: 14 }, // Payment Status
        { wch: 30 }, // File Name
        { wch: 40 }, // File URL
        { wch: 40 }, // Notes
        { wch: 20 }, // Created At
        { wch: 20 }, // Updated At
      ];
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
    setEditingStatement(statement);
    setStatementForm({
      supplier_id: statement.supplier_id,
      month_year: monthYearDate,
      due_date: statement.due_date
        ? new Date(statement.due_date).toISOString().split("T")[0]
        : "",
      amount: statement.amount ? statement.amount.toString() : "",
      payment_status: statement.payment_status || "PENDING",
      notes: statement.notes || "",
      file: null,
    });
    setIsEditingStatement(true);
    setShowUploadStatementModal(true);
  };

  const handleUpdateStatement = async () => {
    try {
      if (!statementForm.due_date || !statementForm.supplier_id) {
        toast.error("Please fill in all required fields", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      setIsUpdatingStatement(true);
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
      if (statementForm.file) {
        formData.append("file", statementForm.file);
      }
      formData.append("month_year", formatMonthYear(statementForm.month_year));
      formData.append("due_date", statementForm.due_date);
      formData.append("amount", statementForm.amount || "");
      formData.append("payment_status", statementForm.payment_status);
      formData.append("notes", statementForm.notes || "");

      const response = await axios.patch(
        `/api/supplier/${statementForm.supplier_id}/statements/${editingStatement.id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.status) {
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
      setIsUpdatingStatement(false);
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
            {loadingStatements ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
                  <p className="text-slate-600">Loading statements...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="h-12 w-12 text-red-500 mx-auto mb-4">⚠️</div>
                  <p className="text-red-600 mb-4">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="cursor-pointer px-3 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-xs font-medium"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="px-3 py-2 flex-shrink-0">
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
                    <div className="p-3 flex-shrink-0 border-b border-slate-200">
                      <div className="flex items-center justify-between">
                        {/* Search */}
                        <div className="flex items-center gap-2 w-[500px] relative">
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

                        {/* Reset, Sort, Items Per Page */}
                        <div className="flex items-center gap-2">
                          {(search !== "" ||
                            sortField !== "month_year" ||
                            sortOrder !== "desc") && (
                            <button
                              onClick={handleReset}
                              className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-600 border border-slate-300 px-3 py-2 rounded-lg text-xs font-medium"
                            >
                              <RotateCcw className="h-4 w-4" />
                              <span>Reset</span>
                            </button>
                          )}

                          <div className="relative dropdown-container">
                            <button
                              onClick={() =>
                                setShowSortDropdown(!showSortDropdown)
                              }
                              className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-600 border border-slate-300 px-3 py-2 rounded-lg text-xs font-medium"
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

                          <button
                            onClick={handleExportToExcel}
                            disabled={
                              isExporting ||
                              filteredAndSortedStatements.length === 0
                            }
                            className={`flex items-center gap-2 transition-all duration-200 text-slate-600 border border-slate-300 px-3 py-2 rounded-lg text-xs font-medium ${
                              isExporting ||
                              filteredAndSortedStatements.length === 0
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

                    {/* Tabs Section */}
                    <div className="px-3 flex-shrink-0 border-b border-slate-200">
                      <nav className="flex space-x-6">
                        <button
                          onClick={() => setActiveTab("pending")}
                          className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
                            activeTab === "pending"
                              ? "border-primary text-primary"
                              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                          }`}
                        >
                          Pending
                        </button>
                        <button
                          onClick={() => setActiveTab("paid")}
                          className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
                            activeTab === "paid"
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
                                  className={`cursor-pointer hover:bg-slate-50 transition-colors duration-200 ${
                                    statement.notes ? "" : ""
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
                                    {statement.amount
                                      ? `$${parseFloat(
                                          statement.amount
                                        ).toFixed(2)}`
                                      : "-"}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap">
                                    <span
                                      className={`px-2 py-1 text-xs font-medium rounded ${
                                        statement.payment_status === "PAID"
                                          ? "bg-green-100 text-green-800"
                                          : "bg-yellow-100 text-yellow-800"
                                      }`}
                                    >
                                      {statement.payment_status}
                                    </span>
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
                      <div className="px-3 py-2 flex-shrink-0 border-t border-slate-200">
                        <div className="flex items-center justify-between">
                          {/* Items per page */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-600">
                                Showing
                              </span>
                              <div className="relative dropdown-container">
                                <button
                                  onClick={() =>
                                    setShowItemsPerPageDropdown(
                                      !showItemsPerPageDropdown
                                    )
                                  }
                                  className="cursor-pointer flex items-center gap-2 px-2 py-1 text-xs border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
                                >
                                  <span>
                                    {itemsPerPage === 0 ? "All" : itemsPerPage}
                                  </span>
                                  <ChevronDown className="h-4 w-4" />
                                </button>
                                {showItemsPerPageDropdown && (
                                  <div className="absolute bottom-full left-0 mb-1 w-20 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                                    <div className="py-1">
                                      {[10, 25, 50, 100, 0].map((value) => (
                                        <button
                                          key={value}
                                          onClick={() => {
                                            setItemsPerPage(value);
                                            setCurrentPage(1);
                                            setShowItemsPerPageDropdown(false);
                                          }}
                                          className="cursor-pointer w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-100"
                                        >
                                          {value === 0 ? "All" : value}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <span className="text-xs text-slate-600">
                                of {totalItems} results
                              </span>
                            </div>
                          </div>

                          {/* Pagination buttons */}
                          {itemsPerPage > 0 && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                              >
                                <ChevronsLeft className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setCurrentPage((p) => Math.max(1, p - 1))
                                }
                                disabled={currentPage === 1}
                                className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <div className="flex items-center gap-1">
                                {Array.from(
                                  { length: Math.min(5, totalPages) },
                                  (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) pageNum = i + 1;
                                    else if (currentPage <= 3) pageNum = i + 1;
                                    else if (currentPage >= totalPages - 2)
                                      pageNum = totalPages - 4 + i;
                                    else pageNum = currentPage - 2 + i;
                                    return (
                                      <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`cursor-pointer px-2 py-1 text-xs rounded-md transition-colors duration-200 ${
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
                                onClick={() =>
                                  setCurrentPage((p) =>
                                    Math.min(totalPages, p + 1)
                                  )
                                }
                                disabled={currentPage === totalPages}
                                className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
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
              message={`This will permanently delete the statement for ${
                statementToDelete?.month_year || ""
              } from ${
                statementToDelete?.supplier?.name || ""
              }. This action cannot be undone.`}
              comparingName={statementToDelete?.month_year || ""}
              isDeleting={isDeletingStatement}
            />

            {/* Upload Statement Modal */}
            {showUploadStatementModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs">
                <div
                  className="absolute inset-0 bg-slate-900/40"
                  onClick={resetForm}
                />
                <div className="relative bg-white w-full max-w-2xl mx-4 rounded-xl shadow-xl border border-slate-200 max-h-[95vh] overflow-y-auto">
                  <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-800">
                      {isEditingStatement
                        ? "Edit Statement"
                        : "Upload Statement"}
                    </h2>
                    <button
                      onClick={resetForm}
                      className="cursor-pointer p-2 rounded-lg hover:bg-slate-100"
                    >
                      <X className="w-5 h-5 text-slate-600" />
                    </button>
                  </div>

                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      {!isEditingStatement && (
                        <div className="col-span-2">
                          <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                            Supplier <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={statementForm.supplier_id}
                            onChange={(e) =>
                              setStatementForm({
                                ...statementForm,
                                supplier_id: e.target.value,
                              })
                            }
                            className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                          >
                            <option value="">Select a supplier</option>
                            {suppliers.map((supplier) => (
                              <option
                                key={supplier.supplier_id}
                                value={supplier.supplier_id}
                              >
                                {supplier.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
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
                          className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                          Due Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={statementForm.due_date}
                          onChange={(e) =>
                            setStatementForm({
                              ...statementForm,
                              due_date: e.target.value,
                            })
                          }
                          className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                          Amount
                        </label>
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
                          className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
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
                          className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                        >
                          <option value="PENDING">Pending</option>
                          <option value="PAID">Paid</option>
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                          File{" "}
                          {!isEditingStatement && (
                            <span className="text-red-500">*</span>
                          )}
                        </label>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(e) =>
                            setStatementForm({
                              ...statementForm,
                              file: e.target.files[0],
                            })
                          }
                          className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                        />
                        {statementForm.file && (
                          <p className="mt-2 text-xs text-slate-600">
                            Selected: {statementForm.file.name}
                          </p>
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
                      <div className="col-span-2">
                        <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                          Notes
                        </label>
                        <textarea
                          rows={3}
                          value={statementForm.notes}
                          onChange={(e) =>
                            setStatementForm({
                              ...statementForm,
                              notes: e.target.value,
                            })
                          }
                          placeholder="Add any additional notes..."
                          className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
                    <button
                      onClick={resetForm}
                      className="cursor-pointer px-4 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md transition-all duration-200 text-sm font-medium"
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
                      className="cursor-pointer px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isEditingStatement
                        ? isUpdatingStatement
                          ? "Updating..."
                          : "Update Statement"
                        : isUploadingStatement
                        ? "Uploading..."
                        : "Upload Statement"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminRoute>
  );
}
