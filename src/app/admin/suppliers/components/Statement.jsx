"use client";
import React, { useEffect, useState, useRef } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Edit,
  Eye,
  FileText,
  Plus,
  Receipt,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import CustomDropdown from "@/components/CustomDropdown";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import { useUploadProgress } from "@/hooks/useUploadProgress";
import useModalFocus from "@/hooks/useModalFocus";
import { BADGE, BADGE_TONES } from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";

const EMPTY = "—";
const TOAST_OPTIONS = { position: "top-right", autoClose: 3000 };

const FIELD =
  "w-full text-sm text-slate-800 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-colors duration-200";
const fieldTone = (hasError) =>
  hasError
    ? "border-red-500 focus:ring-red-500"
    : "border-slate-300 focus:ring-primary";
const LABEL = "block text-sm font-medium text-slate-700 mb-1.5";

const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_ICON =
  "cursor-pointer p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200";
const TH =
  "px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider";

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
  month_year: "",
  due_date: "",
  amount: "",
  payment_status: "PENDING",
  notes: "",
  file: null,
};

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

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-red-600 mt-1">
      {message}
    </p>
  );
}

function Spinner() {
  return (
    <span
      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
      aria-hidden="true"
    />
  );
}

export default function Statement({ supplierId }) {
  const { getToken } = useAuth();
  const {
    showProgressToast,
    completeUpload,
    dismissProgressToast,
    getUploadProgressHandler,
  } = useUploadProgress();
  const [statements, setStatements] = useState([]);
  const [loadingStatements, setLoadingStatements] = useState(false);
  const [fetchError, setFetchError] = useState("");
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

  // File upload states
  const [filePreview, setFilePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [fileObjectURL, setFileObjectURL] = useState(null);
  const fileObjectURLRef = useRef(null);
  const statementModalRef = useRef(null);

  // Due In dropdown state
  const [dueIn, setDueIn] = useState("custom");

  const isSaving = isUploadingStatement || isUpdatingStatement;

  useModalFocus(statementModalRef, showUploadStatementModal);

  useEffect(() => {
    fetchStatements();
  }, [supplierId]);

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

  const fetchStatements = async () => {
    try {
      setLoadingStatements(true);
      setFetchError("");
      const sessionToken = getToken();

      if (!sessionToken) {
        setFetchError("Your session has expired. Sign in again to continue.");
        return;
      }

      const response = await axios.get(
        `/api/v1/supplier/${supplierId}/statements`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );

      if (response.data.status) {
        setStatements(response.data.data || []);
      } else {
        setFetchError(
          response.data.message ||
            "Couldn't load statements. Check your connection and try again.",
        );
      }
    } catch (err) {
      console.error("Error fetching statements:", err);
      setFetchError(
        err.response?.data?.message ||
          "Couldn't load statements. Check your connection and try again.",
      );
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
        statementForm.amount !==
          (editingStatement.amount ? editingStatement.amount.toString() : "") ||
        statementForm.payment_status !==
          (editingStatement.payment_status || "PENDING") ||
        statementForm.notes !== (editingStatement.notes || "")
      );
    }
    return Boolean(
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
    setStatementForm((prev) => ({
      ...prev,
      file: null,
    }));
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

  // Shows the messages and moves focus to the first invalid field, in the
  // order the fields appear (DESIGN.md 15.3). Returns true when valid.
  const applyValidation = (nextErrors) => {
    setErrors(nextErrors);
    const order = [
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
        toast.error(
          "Your session has expired. Sign in again to continue.",
          TOAST_OPTIONS,
        );
        return;
      }

      const formData = new FormData();
      formData.append("file", statementForm.file);
      formData.append("month_year", formatMonthYear(statementForm.month_year));
      formData.append("due_date", statementForm.due_date);
      formData.append("amount", statementForm.amount || "");
      formData.append("payment_status", statementForm.payment_status);
      formData.append("notes", statementForm.notes || "");

      // Show progress toast
      showProgressToast(1);

      const response = await axios.post(
        `/api/v1/supplier/${supplierId}/statements`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: getUploadProgressHandler(1),
        },
      );

      if (response.data.status) {
        toast.success("Statement uploaded.", TOAST_OPTIONS);
        completeUpload(1);
        resetForm();
        fetchStatements();
      } else {
        dismissProgressToast();
        toast.error(
          response.data.message ||
            "Couldn't upload the statement. Check the details and try again.",
          TOAST_OPTIONS,
        );
      }
    } catch (err) {
      console.error("Error uploading statement:", err);
      dismissProgressToast();
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

  const handleUpdateStatement = async () => {
    if (isSaving) return;
    try {
      const nextErrors = {};
      if (!statementForm.due_date) {
        nextErrors.due_date = "Enter a due date.";
      }
      if (!applyValidation(nextErrors)) return;

      setIsUpdatingStatement(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error(
          "Your session has expired. Sign in again to continue.",
          TOAST_OPTIONS,
        );
        return;
      }

      const formData = new FormData();
      const hasFile = statementForm.file !== null;
      if (statementForm.file) {
        formData.append("file", statementForm.file);
      }
      formData.append("month_year", formatMonthYear(statementForm.month_year));
      formData.append("due_date", statementForm.due_date);
      formData.append("amount", statementForm.amount || "");
      formData.append("payment_status", statementForm.payment_status);
      formData.append("notes", statementForm.notes || "");

      // Show progress toast only if there's a file
      if (hasFile) {
        showProgressToast(1);
      }

      const response = await axios.patch(
        `/api/v1/supplier/${supplierId}/statements/${editingStatement.id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "multipart/form-data",
          },
          ...(hasFile && {
            onUploadProgress: getUploadProgressHandler(1),
          }),
        },
      );

      if (response.data.status) {
        toast.success("Statement updated.", TOAST_OPTIONS);
        if (hasFile) {
          completeUpload(1);
        }
        resetForm();
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
        toast.error(
          "Your session has expired. Sign in again to continue.",
          TOAST_OPTIONS,
        );
        return;
      }

      const response = await axios.delete(
        `/api/v1/supplier/${supplierId}/statements/${statementToDelete.id}`,
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
    setDueIn("custom");
    setIsDragging(false);
    setShowFilePreview(false);
    // Cleanup object URL
    if (fileObjectURLRef.current) {
      URL.revokeObjectURL(fileObjectURLRef.current);
      fileObjectURLRef.current = null;
      setFileObjectURL(null);
    }
  };

  const submitLabel = isEditingStatement ? "Save changes" : "Upload statement";

  return (
    <div>
      <div className="flex justify-between items-center gap-3 mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Statements</h2>
        <button
          type="button"
          onClick={() => setShowUploadStatementModal(true)}
          className={BTN_PRIMARY}
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Upload statement
        </button>
      </div>

      {loadingStatements ? (
        <div
          className="flex flex-col items-center justify-center gap-2 py-12"
          role="status"
        >
          <span
            className="animate-spin rounded-full w-8 h-8 border-2 border-primary border-t-transparent"
            aria-hidden="true"
          />
          <p className="text-sm text-slate-600">Loading statements...</p>
        </div>
      ) : fetchError ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500" aria-hidden="true" />
          <p className="text-sm text-red-600" role="alert">
            {fetchError}
          </p>
          <button
            type="button"
            onClick={fetchStatements}
            className={`${BTN_SECONDARY} mt-2`}
          >
            Try again
          </button>
        </div>
      ) : statements.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Receipt className="w-8 h-8 text-slate-300" aria-hidden="true" />
          <p className="text-sm text-slate-600">
            No statements for this supplier yet.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className={`${TH} text-left w-8`}>
                  <span className="sr-only">Notes</span>
                </th>
                <th scope="col" className={`${TH} text-left`}>
                  Month
                </th>
                <th scope="col" className={`${TH} text-left`}>
                  Due date
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Amount
                </th>
                <th scope="col" className={`${TH} text-left`}>
                  Status
                </th>
                <th scope="col" className={`${TH} text-left`}>
                  File
                </th>
                <th scope="col" className={`${TH} text-right`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {statements.map((statement) => {
                const notesOpen = expandedNotes.has(statement.id);
                return (
                  <React.Fragment key={statement.id}>
                    <tr
                      className={`hover:bg-slate-50 transition-colors ${
                        statement.notes ? "cursor-pointer" : ""
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
                            className={BTN_ICON}
                            aria-expanded={notesOpen}
                            aria-label={`${notesOpen ? "Hide" : "Show"} notes for ${statement.month_year}`}
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
                          EMPTY
                        )}
                      </td>
                      <td
                        className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate"
                        title={statement.supplier_file?.filename || undefined}
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
                              onClick={() => handleViewStatement(statement)}
                              className={BTN_ICON}
                              aria-label={`View file for ${statement.month_year}`}
                              title="View file"
                            >
                              <Eye className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleEditStatement(statement)}
                            className={BTN_ICON}
                            aria-label={`Edit statement for ${statement.month_year}`}
                            title="Edit statement"
                          >
                            <Edit className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStatement(statement)}
                            className="cursor-pointer p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                            aria-label={`Delete statement for ${statement.month_year}`}
                            title="Delete statement"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {statement.notes && notesOpen && (
                      <tr className="bg-slate-50">
                        <td colSpan={7} className="px-4 py-3">
                          <p className="text-xs font-medium text-slate-500 mb-1">
                            Notes
                          </p>
                          <div className="text-sm text-slate-700 whitespace-pre-wrap pl-4 border-l border-slate-300">
                            {statement.notes}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
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
        title={
          statementToDelete
            ? `Delete statement for ${statementToDelete.month_year}?`
            : "Delete statement?"
        }
        warningHeading="This removes the statement record"
        message={`The statement for ${
          statementToDelete?.month_year || EMPTY
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
                className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        type="number"
                        step="0.01"
                        value={statementForm.amount}
                        onChange={(e) => updateForm("amount", e.target.value)}
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

                {/* File Upload & Notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-200 pt-6">
                  {/* File Upload */}
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
                            className={BTN_ICON}
                            aria-label="Preview file"
                            title="Preview file"
                          >
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={removeSelectedFile}
                            className="cursor-pointer p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
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
                  className={BTN_SECONDARY}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className={BTN_PRIMARY}
                >
                  {isSaving ? (
                    <Spinner />
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
    </div>
  );
}
