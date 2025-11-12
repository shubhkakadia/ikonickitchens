"use client";
import React, { useEffect, useState } from "react";
import {
  Edit,
  Trash2,
  Plus,
  Eye,
  Receipt,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";

export default function Statement({ supplierId }) {
  const { getToken } = useAuth();
  const [statements, setStatements] = useState([]);
  const [loadingStatements, setLoadingStatements] = useState(false);
  const [showUploadStatementModal, setShowUploadStatementModal] =
    useState(false);
  const [isUploadingStatement, setIsUploadingStatement] = useState(false);
  const [statementForm, setStatementForm] = useState({
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

  useEffect(() => {
    fetchStatements();
  }, [supplierId]);

  const fetchStatements = async () => {
    try {
      setLoadingStatements(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        return;
      }

      const response = await axios.get(
        `/api/supplier/${supplierId}/statements`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (response.data.status) {
        setStatements(response.data.data || []);
      }
    } catch (err) {
      console.error("Error fetching statements:", err);
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

      if (!statementForm.month_year || !statementForm.due_date) {
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
        `/api/supplier/${supplierId}/statements`,
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
      if (!statementForm.due_date) {
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
        `/api/supplier/${supplierId}/statements/${editingStatement.id}`,
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
        `/api/supplier/${supplierId}/statements/${statementToDelete.id}`,
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
      month_year: "",
      due_date: "",
      amount: "",
      payment_status: "PENDING",
      notes: "",
      file: null,
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          Statements
        </h3>
        <button
          onClick={() => setShowUploadStatementModal(true)}
          className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Upload Statement
        </button>
      </div>

      {loadingStatements ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
        </div>
      ) : statements.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <p className="text-sm">No statements found for this supplier</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-8"></th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Month/Year
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  File
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {statements.map((statement) => (
                <React.Fragment key={statement.id}>
                  <tr
                    className={`hover:bg-slate-50 transition-colors ${
                      statement.notes ? "cursor-pointer" : ""
                    }`}
                    onClick={() => statement.notes && toggleNotes(statement.id)}
                  >
                    <td className="px-4 py-2 whitespace-nowrap">
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
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="text-xs text-slate-900">
                        {statement.month_year}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="text-xs text-slate-600">
                        {new Date(statement.due_date).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="text-xs text-slate-900">
                        {statement.amount
                          ? `$${parseFloat(statement.amount).toFixed(2)}`
                          : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          statement.payment_status === "PAID"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {statement.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className="text-xs text-slate-600">
                        {statement.supplier_file?.filename || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {statement.supplier_file && (
                          <button
                            onClick={() => handleViewStatement(statement)}
                            className="cursor-pointer p-2 rounded hover:bg-slate-100"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-600" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEditStatement(statement)}
                          className="cursor-pointer p-2 rounded hover:bg-slate-100"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5 text-slate-600" />
                        </button>
                        <button
                          onClick={() => handleDeleteStatement(statement)}
                          className="cursor-pointer p-2 rounded hover:bg-slate-100"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {statement.notes && expandedNotes.has(statement.id) && (
                    <tr className="bg-slate-50">
                      <td colSpan="7" className="px-4 py-4">
                        <div className="text-xs text-slate-700">
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
                </React.Fragment>
              ))}
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
        message={`This will permanently delete the statement for ${
          statementToDelete?.month_year || ""
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
                {isEditingStatement ? "Edit Statement" : "Upload Statement"}
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
                  {isEditingStatement && editingStatement?.supplier_file && (
                    <p className="mt-2 text-xs text-slate-500">
                      Current file: {editingStatement.supplier_file.filename}{" "}
                      (Leave empty to keep current file)
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
  );
}
