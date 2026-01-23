import React, { useEffect, useState, useRef, useMemo } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import { useUploadProgress } from "@/hooks/useUploadProgress";
import {
  Package,
  PackagePlus,
  ChevronDown,
  Calendar,
  NotebookText,
  User,
  FileText,
  Upload,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import Image from "next/image";
import CreatePurchaseOrderModal from "@/app/admin/suppliers/purchaseorder/components/CreatePurchaseOrderModal";

const formatMoney = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0.00";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function PurchaseOrder({ supplierId, onCountChange }) {
  const { getToken } = useAuth();
  const {
    showProgressToast,
    completeUpload,
    dismissProgressToast,
    getUploadProgressHandler,
  } = useUploadProgress();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loadingPO, setLoadingPO] = useState(false);
  const [poActiveTab, setPoActiveTab] = useState("active");
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [openAccordionId, setOpenAccordionId] = useState(null);
  const [showCreatePurchaseOrderModal, setShowCreatePurchaseOrderModal] =
    useState(false);

  // invoice preview
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [selectedInvoiceFile, setSelectedInvoiceFile] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  // Invoice upload
  const [uploadingInvoicePOId, setUploadingInvoicePOId] = useState(null);
  // Invoice delete
  const [deletingInvoicePOId, setDeletingInvoicePOId] = useState(null);
  const [showDeleteInvoiceModal, setShowDeleteInvoiceModal] = useState(false);
  const [invoicePendingDelete, setInvoicePendingDelete] = useState(null);
  const invoiceFileInputRefs = useRef({});
  // Purchase order delete
  const [deletingPOId, setDeletingPOId] = useState(null);
  const [showDeletePOModal, setShowDeletePOModal] = useState(false);
  const [poPendingDelete, setPoPendingDelete] = useState(null);

  const fetchPurchaseOrders = async () => {
    try {
      setLoadingPO(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }
      const response = await axios.get(
        `/api/purchase_order/by-supplier/${supplierId}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );
      if (response.data.status) {
        const data = response.data.data || [];
        setPurchaseOrders(data);
        if (onCountChange) onCountChange(data.length || 0);
      } else {
        console.error(
          "Failed to fetch purchase orders:",
          response.data.message,
        );
        toast.error(
          response.data.message || "Failed to fetch purchase orders",
          {
            position: "top-right",
            autoClose: 3000,
          },
        );
      }
    } catch (err) {
      console.error("Error fetching purchase orders:", err);
      console.error("Error details:", err.response?.data);
      toast.error(
        err.response?.data?.message || "Failed to fetch purchase orders",
        {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        },
      );
      setPurchaseOrders([]);
    } finally {
      setLoadingPO(false);
    }
  };

  useEffect(() => {
    if (!supplierId) return;
    fetchPurchaseOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const handleInvoiceUpload = async (poId, file) => {
    if (!file) {
      toast.error("Please select a file to upload", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    setUploadingInvoicePOId(poId);
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      const formData = new FormData();
      formData.append("invoice", file);

      // Show progress toast
      showProgressToast(1);

      const response = await axios.patch(
        `/api/purchase_order/${poId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
          onUploadProgress: getUploadProgressHandler(1),
        },
      );

      if (response.data.status) {
        toast.success("Invoice uploaded successfully", {
          position: "top-right",
          autoClose: 3000,
        });
        completeUpload(1);
        // Refresh the PO list
        fetchPurchaseOrders();
      } else {
        dismissProgressToast();
        toast.error(response.data.message || "Failed to upload invoice", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (err) {
      dismissProgressToast();
      toast.error(err?.response?.data?.message || "Failed to upload invoice", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setUploadingInvoicePOId(null);
      // Clear the file input regardless of success or failure
      if (invoiceFileInputRefs.current[poId]) {
        invoiceFileInputRefs.current[poId].value = "";
      }
    }
  };

  const handleInvoiceFileChange = (poId, e) => {
    const file = e.target.files[0];
    if (file) {
      handleInvoiceUpload(poId, file);
    }
  };

  const handleInvoiceDelete = (poId) => {
    setInvoicePendingDelete(poId);
    setShowDeleteInvoiceModal(true);
  };

  const handleInvoiceDeleteConfirm = async () => {
    if (!invoicePendingDelete) return;

    setDeletingInvoicePOId(invoicePendingDelete);
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      const response = await axios.patch(
        `/api/purchase_order/${invoicePendingDelete}`,
        { invoice_url: null },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status) {
        toast.success("Invoice deleted successfully", {
          position: "top-right",
          autoClose: 3000,
        });
        // Refresh the PO list
        fetchPurchaseOrders();
        setShowDeleteInvoiceModal(false);
        setInvoicePendingDelete(null);
      } else {
        toast.error(response.data.message || "Failed to delete invoice", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete invoice", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setDeletingInvoicePOId(null);
    }
  };

  const handleInvoiceDeleteCancel = () => {
    setShowDeleteInvoiceModal(false);
    setInvoicePendingDelete(null);
  };

  const handlePODelete = (poId) => {
    const po = purchaseOrders.find((p) => p.id === poId);
    if (po) {
      setPoPendingDelete(po);
      setShowDeletePOModal(true);
    }
  };

  const handlePODeleteConfirm = async () => {
    if (!poPendingDelete) return;

    setDeletingPOId(poPendingDelete.id);
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      const response = await axios.delete(
        `/api/purchase_order/${poPendingDelete.id}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );

      if (response.data.status) {
        toast.success("Purchase order deleted successfully", {
          position: "top-right",
          autoClose: 3000,
        });
        // Refresh the PO list
        fetchPurchaseOrders();
        setShowDeletePOModal(false);
        setPoPendingDelete(null);
        // Close accordion if it was open
        if (openAccordionId === poPendingDelete.id) {
          setOpenAccordionId(null);
        }
      } else {
        toast.error(
          response.data.message || "Failed to delete purchase order",
          {
            position: "top-right",
            autoClose: 3000,
          },
        );
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to delete purchase order",
        {
          position: "top-right",
          autoClose: 3000,
        },
      );
    } finally {
      setDeletingPOId(null);
    }
  };

  const handlePODeleteCancel = () => {
    setShowDeletePOModal(false);
    setPoPendingDelete(null);
  };

  const handlePOCancel = async (poId) => {
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      const response = await axios.patch(
        `/api/purchase_order/${poId}`,
        { status: "CANCELLED" },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status) {
        toast.success("Purchase order cancelled successfully", {
          position: "top-right",
          autoClose: 3000,
        });
        // Refresh the PO list
        fetchPurchaseOrders();
        // Close accordion if it was open
        if (openAccordionId === poId) {
          setOpenAccordionId(null);
        }
      } else {
        toast.error(
          response.data.message || "Failed to cancel purchase order",
          {
            position: "top-right",
            autoClose: 3000,
          },
        );
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to cancel purchase order",
        {
          position: "top-right",
          autoClose: 3000,
        },
      );
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
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

  const filteredPOs = useMemo(() => {
    let list = purchaseOrders.filter((po) => {
      if (poActiveTab === "active") {
        return (
          po.status === "DRAFT" ||
          po.status === "ORDERED" ||
          po.status === "PARTIALLY_RECEIVED"
        );
      } else if (poActiveTab === "completed") {
        return po.status === "FULLY_RECEIVED";
      } else if (poActiveTab === "cancelled") {
        return po.status === "CANCELLED";
      }
      return false;
    });

    const withCounts = list.map((po) => {
      const itemsCount = po.items?.length || 0;
      const totalQty = (po.items || []).reduce(
        (sum, it) => sum + (parseFloat(it.quantity) || 0),
        0,
      );
      return { ...po, __itemsCount: itemsCount, __totalQty: totalQty };
    });

    withCounts.sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      let aVal;
      let bVal;
      switch (sortField) {
        case "order":
          aVal = (a.order_no || "").toLowerCase();
          bVal = (b.order_no || "").toLowerCase();
          break;
        case "supplier":
          aVal = (a.supplier?.name || "").toLowerCase();
          bVal = (b.supplier?.name || "").toLowerCase();
          break;
        case "status":
          aVal = (a.status || "").toLowerCase();
          bVal = (b.status || "").toLowerCase();
          break;
        case "items":
          aVal = a.__itemsCount;
          bVal = b.__itemsCount;
          break;
        case "total":
          aVal = parseFloat(a.total_amount || 0);
          bVal = parseFloat(b.total_amount || 0);
          break;
        case "date":
        default:
          aVal = new Date(a.ordered_at || a.createdAt || 0).getTime();
          bVal = new Date(b.ordered_at || b.createdAt || 0).getTime();
      }
      if (aVal < bVal) return -1 * dir;
      if (aVal > bVal) return 1 * dir;
      return 0;
    });

    return withCounts;
  }, [purchaseOrders, poActiveTab, sortField, sortOrder]);

  return (
    <div>
      {/* Sub-tabs for Purchase Order */}
      <div className="border-b border-slate-200 mb-2 flex items-center justify-between pl-4">
        <nav className="flex space-x-6">
          <button
            onClick={() => setPoActiveTab("active")}
            className={`cursor-pointer py-3 px-1 border-b-2 font-medium text-sm ${
              poActiveTab === "active"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setPoActiveTab("completed")}
            className={`cursor-pointer py-3 px-1 border-b-2 font-medium text-sm ${
              poActiveTab === "completed"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setPoActiveTab("cancelled")}
            className={`cursor-pointer py-3 px-1 border-b-2 font-medium text-sm ${
              poActiveTab === "cancelled"
                ? "border-primary text-primary"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Cancelled
          </button>
        </nav>
        <button
          onClick={() => setShowCreatePurchaseOrderModal(true)}
          className="cursor-pointer px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <PackagePlus className="w-4 h-4" />
          Create Purchase Order
        </button>
      </div>

      {/* Purchase Order Content */}
      {loadingPO ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
        </div>
      ) : filteredPOs && filteredPOs.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th
                  className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                  onClick={() => handleSort("order")}
                >
                  <div className="flex items-center gap-2">
                    Order / Supplier
                    {getSortIcon("order")}
                  </div>
                </th>
                <th
                  className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center gap-2">
                    Date
                    {getSortIcon("date")}
                  </div>
                </th>
                <th
                  className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                  onClick={() => handleSort("items")}
                >
                  <div className="flex items-center gap-2">
                    Items
                    {getSortIcon("items")}
                  </div>
                </th>
                <th
                  className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                  onClick={() => handleSort("total")}
                >
                  <div className="flex items-center gap-2">
                    Total
                    {getSortIcon("total")}
                  </div>
                </th>
                <th
                  className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center gap-2">
                    Status
                    {getSortIcon("status")}
                  </div>
                </th>
                <th className="px-4 py-2 text-right text-sm font-semibold text-slate-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {filteredPOs.map((po) => {
                return (
                  <React.Fragment key={po.id}>
                    <tr
                      onClick={() => {
                        if (openAccordionId === po.id) {
                          setOpenAccordionId(null);
                        } else {
                          setOpenAccordionId(po.id);
                        }
                      }}
                      className="cursor-pointer hover:bg-slate-50 transition-colors duration-200"
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-800 truncate">
                            {po.order_no}
                          </span>
                          <span className="text-xs text-slate-600 truncate">
                            {po.supplier?.name || "-"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {po.ordered_at
                          ? `Ordered: ${new Date(
                              po.ordered_at,
                            ).toLocaleDateString()}`
                          : `Created: ${
                              po.createdAt
                                ? new Date(po.createdAt).toLocaleDateString()
                                : "-"
                            }`}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {(po.items || []).reduce(
                          (sum, it) => sum + (parseFloat(it.quantity) || 0),
                          0,
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        ${formatMoney(po.total_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            po.status === "DRAFT"
                              ? "bg-yellow-100 text-yellow-800"
                              : po.status === "ORDERED"
                                ? "bg-blue-100 text-blue-800"
                                : po.status === "PARTIALLY_RECEIVED"
                                  ? "bg-purple-100 text-purple-800"
                                  : po.status === "FULLY_RECEIVED"
                                    ? "bg-green-100 text-green-800"
                                    : po.status === "CANCELLED"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ChevronDown
                          className={`w-4 h-4 text-slate-500 inline-block transition-transform duration-200 ${
                            openAccordionId === po.id ? "rotate-180" : ""
                          }`}
                        />
                      </td>
                    </tr>

                    {/* Accordion content */}
                    {openAccordionId === po.id && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 pb-4 border-t border-slate-200 bg-slate-50"
                        >
                          <div id={`po-${po.id}`} className="mt-2">
                            <div className="mb-2 p-2 bg-slate-50 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-4 text-xs text-gray-600">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4" />
                                    <span>
                                      <span className="font-medium">
                                        Created:
                                      </span>{" "}
                                      {po.createdAt
                                        ? new Date(
                                            po.createdAt,
                                          ).toLocaleString()
                                        : "No date"}
                                    </span>
                                  </div>
                                  {po.ordered_at && (
                                    <div className="flex items-center gap-1.5">
                                      <Calendar className="w-4 h-4" />
                                      <span>
                                        <span className="font-medium">
                                          Ordered:
                                        </span>{" "}
                                        {new Date(
                                          po.ordered_at,
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                  )}
                                  {po.total_amount && (
                                    <div className="flex items-center gap-1.5">
                                      <FileText className="w-4 h-4" />
                                      <span>
                                        <span className="font-medium">
                                          Total:
                                        </span>{" "}
                                        <span className="font-semibold">
                                          ${formatMoney(po.total_amount)}
                                        </span>
                                      </span>
                                    </div>
                                  )}
                                  {po.delivery_charge && (
                                    <div className="flex items-center gap-1.5">
                                      <FileText className="w-4 h-4" />
                                      <span>
                                        <span className="font-medium">
                                          Delivery Charge:
                                        </span>{" "}
                                        <span className="font-semibold">
                                          ${formatMoney(po.delivery_charge)}
                                        </span>
                                      </span>
                                    </div>
                                  )}
                                  {po.invoice_date && (
                                    <div className="flex items-center gap-1.5">
                                      <Calendar className="w-4 h-4" />
                                      <span>
                                        <span className="font-medium">
                                          Invoice Date:
                                        </span>{" "}
                                        {new Date(
                                          po.invoice_date,
                                        ).toLocaleDateString()}
                                      </span>
                                    </div>
                                  )}
                                  {po.mto?.project && (
                                    <span className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded border border-slate-200">
                                      Project: {po.mto.project.project_id} -{" "}
                                      {po.mto.project.name}
                                    </span>
                                  )}
                                  {po.orderedBy?.employee && (
                                    <div className="flex items-center gap-1.5">
                                      <User className="w-4 h-4" />
                                      <span>
                                        <span className="font-medium">
                                          Ordered by:
                                        </span>{" "}
                                        {po.orderedBy.employee.first_name}{" "}
                                        {po.orderedBy.employee.last_name}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  {po.status !== "CANCELLED" && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePOCancel(po.id);
                                      }}
                                      className="cursor-pointer px-2 py-1 border border-orange-300 rounded-lg hover:bg-orange-50 text-xs text-orange-700 flex items-center gap-1.5"
                                    >
                                      <X className="w-3 h-3" />
                                      <span>Cancel PO</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePODelete(po.id);
                                    }}
                                    disabled={deletingPOId === po.id}
                                    className={`cursor-pointer px-2 py-1 border border-red-300 rounded-lg hover:bg-red-50 text-xs text-red-700 flex items-center gap-1.5 ${
                                      deletingPOId === po.id
                                        ? "opacity-50 cursor-not-allowed"
                                        : ""
                                    }`}
                                  >
                                    {deletingPOId === po.id ? (
                                      <>
                                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-red-600"></div>
                                        <span>Deleting...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Trash2 className="w-3 h-3" />
                                        <span>Delete PO</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                              {po.notes && (
                                <div className="mt-2 flex items-start gap-2 text-xs text-gray-600">
                                  <NotebookText className="w-4 h-4 mt-0.5" />
                                  <span>
                                    <span className="font-medium">Notes:</span>{" "}
                                    {po.notes}
                                  </span>
                                </div>
                              )}
                              {/* Invoice Section */}
                              {po.invoice_url ? (
                                <div className="mt-2">
                                  <div className="border border-slate-200 rounded-lg p-2 flex items-center justify-between bg-white">
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-slate-500" />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-xs font-medium text-gray-800 truncate">
                                          {po.invoice_url.filename || "Invoice"}
                                        </div>
                                        <div className="text-xs text-slate-500 truncate">
                                          {po.invoice_url.mime_type ||
                                            po.invoice_url.extension}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const fileUrl =
                                            po.invoice_url.url.startsWith("/")
                                              ? po.invoice_url.url
                                              : `/${po.invoice_url.url}`;
                                          setSelectedInvoiceFile({
                                            name:
                                              po.invoice_url.filename ||
                                              "Invoice",
                                            url: fileUrl,
                                            type:
                                              po.invoice_url.mime_type ||
                                              (po.invoice_url.extension
                                                ? `application/${po.invoice_url.extension}`
                                                : "application/pdf"),
                                            size: po.invoice_url.size || 0,
                                            isExisting: true,
                                          });
                                          setShowInvoicePreview(true);
                                        }}
                                        className="cursor-pointer px-2 py-1 border border-slate-300 rounded-lg hover:bg-slate-50 text-xs text-slate-700"
                                      >
                                        View
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleInvoiceDelete(po.id);
                                        }}
                                        disabled={deletingInvoicePOId === po.id}
                                        className={`cursor-pointer px-2 py-1 border border-red-300 rounded-lg hover:bg-red-50 text-xs text-red-700 flex items-center gap-1.5 ${
                                          deletingInvoicePOId === po.id
                                            ? "opacity-50 cursor-not-allowed"
                                            : ""
                                        }`}
                                      >
                                        {deletingInvoicePOId === po.id ? (
                                          <>
                                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-red-600"></div>
                                            <span>Deleting...</span>
                                          </>
                                        ) : (
                                          <>
                                            <Trash2 className="w-3 h-3" />
                                            <span>Delete</span>
                                          </>
                                        )}
                                      </button>
                                      <a
                                        href={
                                          po.invoice_url.url.startsWith("/")
                                            ? po.invoice_url.url
                                            : `/${po.invoice_url.url}`
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="cursor-pointer px-2 py-1 bg-primary/80 hover:bg-primary text-white rounded-lg text-xs"
                                      >
                                        Download
                                      </a>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-2">
                                  <div className="border border-slate-200 rounded-lg p-2 bg-white">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded flex items-center justify-center">
                                          <FileText className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div>
                                          <div className="text-xs font-medium text-gray-800">
                                            No invoice uploaded
                                          </div>
                                          <div className="text-xs text-slate-500">
                                            Upload an invoice file for this
                                            purchase order
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <input
                                          ref={(el) => {
                                            invoiceFileInputRefs.current[
                                              po.id
                                            ] = el;
                                          }}
                                          type="file"
                                          accept=".pdf,.doc,.docx,image/*"
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            handleInvoiceFileChange(po.id, e);
                                          }}
                                          className="hidden"
                                          id={`invoice-upload-${po.id}`}
                                          disabled={
                                            uploadingInvoicePOId === po.id
                                          }
                                        />
                                        <label
                                          htmlFor={`invoice-upload-${po.id}`}
                                          className={`cursor-pointer px-2 py-1 border border-slate-300 rounded-lg hover:bg-slate-50 text-xs text-slate-700 flex items-center gap-2 ${
                                            uploadingInvoicePOId === po.id
                                              ? "opacity-50 cursor-not-allowed"
                                              : ""
                                          }`}
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {uploadingInvoicePOId === po.id ? (
                                            <>
                                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600"></div>
                                              <span>Uploading...</span>
                                            </>
                                          ) : (
                                            <>
                                              <Upload className="w-3 h-3" />
                                              <span>Upload Invoice</span>
                                            </>
                                          )}
                                        </label>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Items table */}
                            {po.items && po.items.length > 0 && (
                              <div className="overflow-x-auto">
                                <table className="w-full border border-slate-200 rounded-lg">
                                  <thead className="bg-slate-50">
                                    <tr>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Image
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Category
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Details
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Quantity
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Received
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Unit Price (excluding GST)
                                      </th>
                                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Total
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="bg-white divide-y divide-slate-200">
                                    {po.items.map((item) => (
                                      <tr
                                        key={item.id}
                                        className="hover:bg-slate-50"
                                      >
                                        <td className="px-3 py-2 whitespace-nowrap">
                                          <div className="flex items-center">
                                            {item.item?.image?.url ? (
                                              <Image
                                                loading="lazy"
                                                src={`/${item.item.image.url}`}
                                                alt={
                                                  item.item.item_id ||
                                                  item.item?.category ||
                                                  "Item image"
                                                }
                                                className="w-10 h-10 object-cover rounded border border-slate-200"
                                                onError={(e) => {
                                                  e.target.style.display =
                                                    "none";
                                                  e.target.nextSibling.style.display =
                                                    "flex";
                                                }}
                                                width={40}
                                                height={40}
                                              />
                                            ) : (
                                              <div className="w-10 h-10 bg-slate-100 rounded border border-slate-200 flex items-center justify-center">
                                                <Package className="w-5 h-5 text-slate-400" />
                                              </div>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2">
                                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                            {item.item?.category || "-"}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2">
                                          <div className="text-xs text-gray-600 space-y-1">
                                            {item.item?.sheet && (
                                              <>
                                                <div>
                                                  <span className="font-medium">
                                                    Brand:
                                                  </span>{" "}
                                                  {item.item.sheet.brand || "-"}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Color:
                                                  </span>{" "}
                                                  {item.item.sheet.color}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Finish:
                                                  </span>{" "}
                                                  {item.item.sheet.finish}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Face:
                                                  </span>{" "}
                                                  {item.item.sheet.face || "-"}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Dimensions:
                                                  </span>{" "}
                                                  {item.item.sheet.dimensions}
                                                </div>
                                              </>
                                            )}
                                            {item.item?.handle && (
                                              <>
                                                <div>
                                                  <span className="font-medium">
                                                    Brand:
                                                  </span>{" "}
                                                  {item.item.handle.brand ||
                                                    "-"}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Color:
                                                  </span>{" "}
                                                  {item.item.handle.color}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Type:
                                                  </span>{" "}
                                                  {item.item.handle.type}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Dimensions:
                                                  </span>{" "}
                                                  {item.item.handle.dimensions}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Material:
                                                  </span>{" "}
                                                  {item.item.handle.material ||
                                                    "-"}
                                                </div>
                                              </>
                                            )}
                                            {item.item?.hardware && (
                                              <>
                                                <div>
                                                  <span className="font-medium">
                                                    Brand:
                                                  </span>{" "}
                                                  {item.item.hardware.brand ||
                                                    "-"}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Name:
                                                  </span>{" "}
                                                  {item.item.hardware.name}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Type:
                                                  </span>{" "}
                                                  {item.item.hardware.type}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Dimensions:
                                                  </span>{" "}
                                                  {
                                                    item.item.hardware
                                                      .dimensions
                                                  }
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Sub Category:
                                                  </span>{" "}
                                                  {
                                                    item.item.hardware
                                                      .sub_category
                                                  }
                                                </div>
                                              </>
                                            )}
                                            {item.item?.accessory && (
                                              <>
                                                <div>
                                                  <span className="font-medium">
                                                    Name:
                                                  </span>{" "}
                                                  {item.item.accessory.name}
                                                </div>
                                              </>
                                            )}
                                            {item.item?.edging_tape && (
                                              <>
                                                <div>
                                                  <span className="font-medium">
                                                    Brand:
                                                  </span>{" "}
                                                  {item.item.edging_tape
                                                    .brand || "-"}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Color:
                                                  </span>{" "}
                                                  {item.item.edging_tape
                                                    .color || "-"}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Finish:
                                                  </span>{" "}
                                                  {item.item.edging_tape
                                                    .finish || "-"}
                                                </div>
                                                <div>
                                                  <span className="font-medium">
                                                    Dimensions:
                                                  </span>{" "}
                                                  {item.item.edging_tape
                                                    .dimensions || "-"}
                                                </div>
                                              </>
                                            )}
                                            {!item.item?.sheet &&
                                              !item.item?.handle &&
                                              !item.item?.hardware &&
                                              !item.item?.accessory &&
                                              !item.item?.edging_tape && (
                                                <div>
                                                  {item.item?.description ||
                                                    item.notes ||
                                                    "-"}
                                                </div>
                                              )}
                                          </div>
                                          {item.notes &&
                                            item.item?.description &&
                                            item.notes !==
                                              item.item?.description && (
                                              <div className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                                                <FileText className="w-3 h-3 mt-0.5" />
                                                <span>{item.notes}</span>
                                              </div>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                          <div className="text-xs text-gray-600">
                                            {item.quantity}
                                            {item.item?.measurement_unit && (
                                              <span className="text-gray-400 ml-1">
                                                {item.item.measurement_unit}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                          <span className="text-xs text-gray-600">
                                            {item.quantity_received || 0}
                                            {item.item?.measurement_unit && (
                                              <span className="text-gray-400 ml-1">
                                                {item.item.measurement_unit}
                                              </span>
                                            )}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                          <span className="text-xs text-gray-600">
                                            $
                                            {parseFloat(
                                              item.unit_price,
                                            ).toFixed(2)}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                          <span className="text-xs font-semibold text-gray-900">
                                            $
                                            {formatMoney(
                                              parseFloat(item.quantity) *
                                                parseFloat(item.unit_price),
                                            )}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="bg-slate-50">
                                    <tr className="border-t border-slate-200">
                                      <td
                                        colSpan="6"
                                        className="px-4 py-3 text-right text-xs font-medium text-gray-700"
                                      >
                                        Order Total:
                                      </td>
                                      <td className="px-3 py-2">
                                        <span className="text-xs font-semibold text-gray-900">
                                          $
                                          {formatMoney(
                                            po.items.reduce(
                                              (sum, item) =>
                                                sum +
                                                parseFloat(item.quantity) *
                                                  parseFloat(item.unit_price),
                                              0,
                                            ),
                                          )}
                                        </span>
                                      </td>
                                    </tr>
                                    <tr>
                                      <td
                                        colSpan="6"
                                        className="px-4 py-3 text-right text-xs font-medium text-gray-700"
                                      >
                                        GST Amount (10%):
                                      </td>
                                      <td className="px-3 py-2">
                                        <span className="text-xs font-semibold text-gray-900">
                                          $
                                          {formatMoney(
                                            Math.ceil(
                                              po.items.reduce(
                                                (sum, item) =>
                                                  sum +
                                                  parseFloat(item.quantity) *
                                                    parseFloat(item.unit_price),
                                                0,
                                              ) *
                                                0.1 *
                                                100,
                                            ) / 100,
                                          )}
                                        </span>
                                      </td>
                                    </tr>
                                    <tr className="border-t border-slate-200">
                                      <td
                                        colSpan="6"
                                        className="px-4 py-3 text-right text-xs font-bold text-gray-700"
                                      >
                                        Grand Total:
                                      </td>
                                      <td className="px-3 py-2">
                                        <span className="text-xs font-bold text-gray-900">
                                          $
                                          {formatMoney(
                                            po.items.reduce(
                                              (sum, item) =>
                                                sum +
                                                parseFloat(item.quantity) *
                                                  parseFloat(item.unit_price),
                                              0,
                                            ) +
                                              Math.ceil(
                                                po.items.reduce(
                                                  (sum, item) =>
                                                    sum +
                                                    parseFloat(item.quantity) *
                                                      parseFloat(
                                                        item.unit_price,
                                                      ),
                                                  0,
                                                ) *
                                                  0.1 *
                                                  100,
                                              ) /
                                                100,
                                          )}
                                        </span>
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}
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
      ) : (
        <div className="text-center py-10 text-slate-500">
          No purchase orders found
        </div>
      )}

      {showCreatePurchaseOrderModal && (
        <CreatePurchaseOrderModal
          setShowModal={setShowCreatePurchaseOrderModal}
          onSuccess={fetchPurchaseOrders}
        />
      )}

      {showInvoicePreview && selectedInvoiceFile && (
        <ViewMedia
          selectedFile={selectedInvoiceFile}
          setSelectedFile={setSelectedInvoiceFile}
          setViewFileModal={setShowInvoicePreview}
          setPageNumber={setPageNumber}
        />
      )}

      {/* Delete Invoice Confirmation Modal */}
      <DeleteConfirmation
        isOpen={showDeleteInvoiceModal}
        onClose={handleInvoiceDeleteCancel}
        onConfirm={handleInvoiceDeleteConfirm}
        deleteWithInput={false}
        heading="Invoice"
        message="This will permanently delete the invoice file. This action cannot be undone."
        isDeleting={deletingInvoicePOId !== null}
      />

      {/* Delete Purchase Order Confirmation Modal */}
      <DeleteConfirmation
        isOpen={showDeletePOModal}
        onClose={handlePODeleteCancel}
        onConfirm={handlePODeleteConfirm}
        deleteWithInput={true}
        heading="Purchase Order"
        message="This will permanently delete the purchase order and all its associated data. This action cannot be undone."
        comparingName={poPendingDelete?.order_no || ""}
        isDeleting={deletingPOId !== null}
        entityType="purchase_order"
      />
    </div>
  );
}
