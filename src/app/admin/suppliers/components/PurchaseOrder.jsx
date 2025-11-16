import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import {
  Package,
  PackagePlus,
  ChevronDown,
  Calendar,
  Receipt,
  NotebookText,
  User,
  FileText,
  Upload,
  Trash2,
} from "lucide-react";

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
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loadingPO, setLoadingPO] = useState(false);
  const [poActiveTab, setPoActiveTab] = useState("active");

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
        }
      );
      if (response.data.status) {
        const data = response.data.data || [];
        setPurchaseOrders(data);
        if (onCountChange) onCountChange(data.length || 0);
      } else {
        console.error(
          "Failed to fetch purchase orders:",
          response.data.message
        );
        toast.error(
          response.data.message || "Failed to fetch purchase orders",
          {
            position: "top-right",
            autoClose: 3000,
          }
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
        }
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

      const response = await axios.patch(
        `/api/purchase_order/${poId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (response.data.status) {
        toast.success("Invoice uploaded successfully", {
          position: "top-right",
          autoClose: 3000,
        });
        // Clear the file input
        if (invoiceFileInputRefs.current[poId]) {
          invoiceFileInputRefs.current[poId].value = "";
        }
        // Refresh the PO list
        fetchPurchaseOrders();
      } else {
        toast.error(response.data.message || "Failed to upload invoice", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to upload invoice", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setUploadingInvoicePOId(null);
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
        }
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

  const filteredPOs = purchaseOrders.filter((po) => {
    if (poActiveTab === "active") {
      return (
        po.status === "DRAFT" ||
        po.status === "ORDERED" ||
        po.status === "PARTIALLY_RECEIVED"
      );
    } else {
      return po.status === "FULLY_RECEIVED" || po.status === "CANCELLED";
    }
  });

  return (
    <div>
      {/* Sub-tabs for Purchase Order */}
      <div className="border-b border-slate-200 mb-2 flex items-center justify-between px-4">
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
        </nav>
      </div>

      {/* Purchase Order Content */}
      {loadingPO ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
        </div>
      ) : filteredPOs && filteredPOs.length > 0 ? (
        <div className="bg-white rounded-lg">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 border-t border-b border-slate-200 text-xs font-medium text-slate-600 uppercase tracking-wider">
            <div className="col-span-3">Order / Supplier</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2">Items</div>
            <div className="col-span-2">Total</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {/* Rows */}
          <div className="space-y-2">
            {filteredPOs.map((po) => {
              return (
                <div
                  key={po.id}
                  className="border border-slate-200 rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => {
                      const element = document.getElementById(`po-${po.id}`);
                      if (element) element.classList.toggle("hidden");
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-3 flex flex-col">
                        <span className="text-sm font-semibold text-gray-800 truncate">
                          {po.order_no}
                        </span>
                        <span className="text-xs text-slate-600 truncate">
                          {po.supplier?.name || "-"}
                        </span>
                      </div>
                      <div className="col-span-2 text-sm text-slate-700">
                        {po.ordered_at
                          ? `Ordered: ${new Date(
                              po.ordered_at
                            ).toLocaleDateString()}`
                          : `Created: ${
                              po.createdAt
                                ? new Date(po.createdAt).toLocaleDateString()
                                : "-"
                            }`}
                      </div>
                      <div className="col-span-2 text-sm text-slate-700">
                        {(po.items || []).reduce(
                          (sum, it) =>
                            sum + (parseFloat(it.quantity) || 0),
                          0
                        )}
                      </div>
                      <div className="col-span-2 text-sm text-slate-700">
                        ${formatMoney(po.total_amount)}
                      </div>
                      <div className="col-span-2">
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
                      </div>
                      <div className="col-span-1 text-right">
                        <ChevronDown className="w-5 h-5 text-slate-500 inline-block" />
                      </div>
                    </div>
                  </button>

                  {/* Accordion content */}
                  <div
                    id={`po-${po.id}`}
                    className="hidden px-4 pb-4 border-t border-slate-100"
                  >
                    <div className="mt-4">
                      <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4" />
                            <span>
                              <span className="font-medium">Created:</span>{" "}
                              {po.createdAt
                                ? new Date(po.createdAt).toLocaleString()
                                : "No date"}
                            </span>
                          </div>
                          {po.ordered_at && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4" />
                              <span>
                                <span className="font-medium">Ordered:</span>{" "}
                                {new Date(po.ordered_at).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {po.total_amount && (
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-4 h-4" />
                              <span>
                                <span className="font-medium">Total:</span>{" "}
                                <span className="font-semibold">
                                  ${formatMoney(po.total_amount)}
                                </span>
                              </span>
                            </div>
                          )}
                          {po.mto?.project && (
                            <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded border border-slate-200">
                              Project: {po.mto.project.project_id} -{" "}
                              {po.mto.project.name}
                            </span>
                          )}
                          {po.orderedBy?.employee && (
                            <div className="flex items-center gap-1.5">
                              <User className="w-4 h-4" />
                              <span>
                                <span className="font-medium">Ordered by:</span>{" "}
                                {po.orderedBy.employee.first_name}{" "}
                                {po.orderedBy.employee.last_name}
                              </span>
                            </div>
                          )}
                        </div>
                        {po.notes && (
                          <div className="mt-3 flex items-start gap-2 text-sm text-gray-600">
                            <NotebookText className="w-4 h-4 mt-0.5" />
                            <span>
                              <span className="font-medium">Notes:</span>{" "}
                              {po.notes}
                            </span>
                          </div>
                        )}
                        {/* Invoice Section */}
                        {po.invoice_url ? (
                          <div className="mt-3">
                            <div className="border border-slate-200 rounded-lg p-3 flex items-center justify-between bg-white">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded flex items-center justify-center">
                                  <FileText className="w-5 h-5 text-slate-500" />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-gray-800 truncate">
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
                                    setSelectedInvoiceFile({
                                      name:
                                        po.invoice_url.filename || "Invoice",
                                      url: po.invoice_url.url,
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
                                  className="cursor-pointer px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm text-slate-700"
                                >
                                  View
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleInvoiceDelete(po.id);
                                  }}
                                  disabled={deletingInvoicePOId === po.id}
                                  className={`cursor-pointer px-3 py-1.5 border border-red-300 rounded-lg hover:bg-red-50 text-sm text-red-700 flex items-center gap-1.5 ${
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
                                      <Trash2 className="w-4 h-4" />
                                      <span>Delete</span>
                                    </>
                                  )}
                                </button>
                                <a
                                  href={po.invoice_url.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="cursor-pointer px-3 py-1.5 bg-primary/80 hover:bg-primary text-white rounded-lg text-sm"
                                >
                                  Download
                                </a>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3">
                            <div className="border border-slate-200 rounded-lg p-3 bg-white">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-slate-400" />
                                  </div>
                                  <div>
                                    <div className="text-sm font-medium text-gray-800">
                                      No invoice uploaded
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      Upload an invoice file for this purchase
                                      order
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    ref={(el) => {
                                      invoiceFileInputRefs.current[po.id] = el;
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
                                    className={`cursor-pointer px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm text-slate-700 flex items-center gap-2 ${
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
                                        <Upload className="w-4 h-4" />
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
                                  Unit Price
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
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="flex items-center">
                                      {item.item?.image ? (
                                        <img
                                          src={`/${item.item.image}`}
                                          alt={item.item.item_id}
                                          className="w-12 h-12 object-cover rounded border border-slate-200"
                                          onError={(e) => {
                                            e.target.style.display = "none";
                                            e.target.nextSibling.style.display =
                                              "flex";
                                          }}
                                        />
                                      ) : null}
                                      <div
                                        className={`w-12 h-12 bg-slate-100 rounded border border-slate-200 flex items-center justify-center ${
                                          item.item?.image ? "hidden" : "flex"
                                        }`}
                                      >
                                        <Package className="w-6 h-6 text-slate-400" />
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                      {item.item?.category || "-"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <div className="text-sm text-gray-600 space-y-1">
                                      {item.item?.sheet && (
                                        <>
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
                                            {item.item.handle.material || "-"}
                                          </div>
                                        </>
                                      )}
                                      {item.item?.hardware && (
                                        <>
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
                                            {item.item.hardware.dimensions}
                                          </div>
                                          <div>
                                            <span className="font-medium">
                                              Sub Category:
                                            </span>{" "}
                                            {item.item.hardware.sub_category}
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
                                      {!item.item?.sheet &&
                                        !item.item?.handle &&
                                        !item.item?.hardware &&
                                        !item.item?.accessory && (
                                          <div>
                                            {item.item?.description ||
                                              item.notes ||
                                              "-"}
                                          </div>
                                        )}
                                    </div>
                                    {item.notes &&
                                      item.item?.description &&
                                      item.notes !== item.item?.description && (
                                        <div className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                                          <FileText className="w-3 h-3 mt-0.5" />
                                          <span>{item.notes}</span>
                                        </div>
                                      )}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="text-sm text-gray-600">
                                      {item.quantity}
                                      {item.item?.measurement_unit && (
                                        <span className="text-gray-400 ml-1">
                                          {item.item.measurement_unit}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span className="text-sm text-gray-600">
                                      {item.quantity_received || 0}
                                      {item.item?.measurement_unit && (
                                        <span className="text-gray-400 ml-1">
                                          {item.item.measurement_unit}
                                        </span>
                                      )}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span className="text-sm text-gray-600">
                                      $
                                      {parseFloat(item.unit_price).toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span className="text-sm font-semibold text-gray-900">
                                      ${formatMoney(
                                        parseFloat(item.quantity) *
                                          parseFloat(item.unit_price)
                                      )}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-slate-500">
          No purchase orders found
        </div>
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
    </div>
  );
}
