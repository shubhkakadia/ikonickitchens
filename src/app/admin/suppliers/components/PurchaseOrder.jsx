import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
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
} from "lucide-react";

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

  return (
    <div>
      {/* Sub-tabs for Purchase Order */}
      <div className="border-b border-slate-200 mb-4">
        <nav className="flex space-x-8">
          <button
            onClick={() => setPoActiveTab("active")}
            className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
              poActiveTab === "active"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-2">
              Active
              {purchaseOrders.filter(
                (po) =>
                  po.status === "DRAFT" ||
                  po.status === "ORDERED" ||
                  po.status === "PARTIALLY_RECEIVED"
              ).length > 0 && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {
                    purchaseOrders.filter(
                      (po) =>
                        po.status === "DRAFT" ||
                        po.status === "ORDERED" ||
                        po.status === "PARTIALLY_RECEIVED"
                    ).length
                  }
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setPoActiveTab("completed")}
            className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
              poActiveTab === "completed"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-2">
              Completed
              {purchaseOrders.filter(
                (po) =>
                  po.status === "FULLY_RECEIVED" || po.status === "CANCELLED"
              ).length > 0 && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {
                    purchaseOrders.filter(
                      (po) =>
                        po.status === "FULLY_RECEIVED" ||
                        po.status === "CANCELLED"
                    ).length
                  }
                </span>
              )}
            </div>
          </button>
        </nav>
      </div>

      {/* Purchase Order Content */}
      {loadingPO ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
        </div>
      ) : purchaseOrders && purchaseOrders.length > 0 ? (
        <div className="space-y-2">
          {purchaseOrders
            .filter((po) => {
              if (poActiveTab === "active") {
                return (
                  po.status === "DRAFT" ||
                  po.status === "ORDERED" ||
                  po.status === "PARTIALLY_RECEIVED"
                );
              } else {
                return (
                  po.status === "FULLY_RECEIVED" || po.status === "CANCELLED"
                );
              }
            })
            .map((po) => (
              <div key={po.id} className="border border-slate-200 rounded-lg">
                <button
                  onClick={() => {
                    const element = document.getElementById(`po-${po.id}`);
                    if (element) {
                      element.classList.toggle("hidden");
                    }
                  }}
                  className="w-full p-4 text-left hover:bg-slate-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="text-sm font-bold text-slate-800 w-44 truncate shrink-0">
                        {po.order_no}
                      </h4>
                      <span className="text-xs text-slate-600 w-48 truncate shrink-0">
                        {po.ordered_at
                          ? `Ordered: ${new Date(
                              po.ordered_at
                            ).toLocaleDateString()}`
                          : `Created: ${
                              po.createdAt
                                ? new Date(po.createdAt).toLocaleDateString()
                                : "-"
                            }`}
                      </span>
                      <span className="text-xs font-medium text-slate-700 w-36 shrink-0">
                        Total: ${parseFloat(po.total_amount || 0).toFixed(2)}
                      </span>
                      <span className="text-xs text-slate-600 w-24 shrink-0">
                        Items:{" "}
                        {Array.isArray(po.items)
                          ? po.items.reduce(
                              (sum, it) => sum + (parseFloat(it.quantity) || 0),
                              0
                            )
                          : 0}
                      </span>
                      <span
                        className={`ml-auto px-2 py-1 text-xs font-medium rounded w-36 text-center shrink-0 ${
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
                  </div>
                  <div className="ml-4">
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  </div>
                </button>
                <div
                  id={`po-${po.id}`}
                  className="hidden px-4 pb-4 border-t border-slate-100"
                >
                  <div className="mt-4">
                    {/* PO Details */}
                    <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            <span className="font-medium">Created:</span>{" "}
                            {po.createdAt
                              ? new Date(po.createdAt).toLocaleString()
                              : "No date"}
                          </span>
                        </div>
                        {po.ordered_at && (
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                              <span className="font-medium">Ordered:</span>{" "}
                              {new Date(po.ordered_at).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {po.total_amount && (
                          <div className="flex items-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5" />
                            <span>
                              <span className="font-medium">Total:</span>{" "}
                              <span className="font-semibold">
                                ${parseFloat(po.total_amount).toFixed(2)}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-start gap-2 text-xs text-slate-600">
                        <NotebookText className="w-3.5 h-3.5 mt-0.5" />
                        <span>
                          <span className="font-medium">Notes:</span>{" "}
                          {po.notes ? po.notes : ""}
                        </span>
                      </div>
                      {po.mto && (
                        <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                          {po.mto.project && (
                            <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded border border-slate-200">
                              Project: {po.mto.project.project_id} -{" "}
                              {po.mto.project.name}
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 text-xs rounded ${
                              po.mto.status === "PARTIALLY_RECEIVED"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {po.mto.status}
                          </span>
                        </div>
                      )}
                      {po.orderedBy && po.orderedBy.employee && (
                        <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
                          <User className="w-3.5 h-3.5" />
                          <span>
                            <span className="font-medium">Ordered by:</span>{" "}
                            {po.orderedBy.employee.first_name || ""}{" "}
                            {po.orderedBy.employee.last_name || ""}
                          </span>
                        </div>
                      )}
                      {po.invoice_url ? (
                        <div className="mt-3">
                          <div className="border border-slate-200 rounded-lg p-3 flex items-center justify-between bg-white">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded flex items-center justify-center">
                                <FileText className="w-4 h-4 text-slate-500" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-slate-800 truncate">
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
                                    name: po.invoice_url.filename || "Invoice",
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
                                className="cursor-pointer px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 text-xs text-slate-700 transition-all duration-200"
                              >
                                View
                              </button>
                              <a
                                href={po.invoice_url.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="cursor-pointer px-3 py-1.5 bg-primary/80 hover:bg-primary text-white rounded-md text-xs font-medium transition-all duration-200"
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
                                  <FileText className="w-4 h-4 text-slate-400" />
                                </div>
                                <div>
                                  <div className="text-xs font-medium text-slate-800">
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
                                  disabled={uploadingInvoicePOId === po.id}
                                />
                                <label
                                  htmlFor={`invoice-upload-${po.id}`}
                                  className={`cursor-pointer px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 text-xs text-slate-700 font-medium flex items-center gap-2 transition-all duration-200 ${
                                    uploadingInvoicePOId === po.id
                                      ? "opacity-50 cursor-not-allowed"
                                      : ""
                                  }`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {uploadingInvoicePOId === po.id ? (
                                    <>
                                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-slate-600"></div>
                                      <span>Uploading...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-3.5 h-3.5" />
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

                    {/* Items List */}
                    {po.items && po.items.length > 0 && (
                      <div>
                        <h5 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                          Items ({po.items.length})
                        </h5>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Image
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Category
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Details
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Qty
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Received
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Unit Price
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Total
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                              {po.items.map((item) => (
                                <tr
                                  key={item.id}
                                  className="hover:bg-slate-50 transition-colors"
                                >
                                  {/* Image Column */}
                                  <td className="px-4 py-2 whitespace-nowrap">
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
                                  <td className="px-4 py-2">
                                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                      {item.item?.category || "-"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2">
                                    <div className="text-xs text-slate-600 space-y-1">
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
                                        <div className="text-xs text-slate-500 mt-1 flex items-start gap-1">
                                          <NotebookText className="w-3 h-3 mt-0.5" />
                                          <span>{item.notes}</span>
                                        </div>
                                      )}
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    <div className="text-xs text-slate-600">
                                      {item.quantity}
                                      {item.item?.measurement_unit && (
                                        <span className="text-slate-400 ml-1">
                                          {item.item.measurement_unit}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    <span className="text-xs text-slate-600">
                                      {item.quantity_received || 0}
                                      {item.item?.measurement_unit && (
                                        <span className="text-slate-400 ml-1">
                                          {item.item.measurement_unit}
                                        </span>
                                      )}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    <span className="text-xs text-slate-600">
                                      ${parseFloat(item.unit_price).toFixed(2)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    <span className="text-xs font-semibold text-slate-900">
                                      $
                                      {(
                                        parseFloat(item.quantity) *
                                        parseFloat(item.unit_price)
                                      ).toFixed(2)}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500">
          <PackagePlus className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <p className="text-sm">No purchase orders found for this supplier</p>
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
    </div>
  );
}
