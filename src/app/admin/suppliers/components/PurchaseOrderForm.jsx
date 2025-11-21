import React from "react";
import { useState, useEffect } from "react";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import { toast, ToastContainer } from "react-toastify";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { X, FileText, Eye, Trash2, Package } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import Image from "next/image";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PurchaseOrderForm({
  materialsToOrder,
  supplier,
  setShowCreatePurchaseOrderModal,
  fetchMaterialsToOrder,
  selectedMtoId,
}) {
  const { getToken, userData } = useAuth();
  // Purchase Order Modal States
  const [selectedMTO, setSelectedMTO] = useState(null);
  const [poItems, setPoItems] = useState([]);
  const [poNotes, setPoNotes] = useState("");
  const [poInvoiceFile, setPoInvoiceFile] = useState(null);
  const [poInvoicePreview, setPoInvoicePreview] = useState(null);
  const [isCreatingPO, setIsCreatingPO] = useState(false);
  const [poOrderNo, setPoOrderNo] = useState("");
  const [poTotal, setPoTotal] = useState(0);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const handleMTOSelection = (mtoId) => {
    if (!mtoId) {
      setSelectedMTO(null);
      setPoItems([]);
      return;
    }

    // Find MTO - ID could be string (UUID) or number
    const mto = materialsToOrder.find(
      (m) => m.id === mtoId || m.id === parseInt(mtoId)
    );
    if (!mto) {
      console.error("MTO not found:", mtoId);
      toast.error("Materials to Order not found");
      return;
    }
    setSelectedMTO(mto);

    // Populate items from MTO
    if (mto.items && mto.items.length > 0) {
      const items = mto.items
        .map((item) => {
          const mtoQuantity = parseFloat(item.quantity) || 0;
          const mtoQuantityOrdered = parseFloat(item.quantity_ordered) || 0;
          const remaining = Math.max(0, mtoQuantity - mtoQuantityOrdered);

          // If MTO is PARTIALLY_ORDERED, only include items with remaining > 0
          if (mto.status === "PARTIALLY_ORDERED" && remaining <= 0) {
            return null;
          }

          return {
            id: item.id,
            item_id: item.item?.item_id, // Fallback to item.item.item_id if item_id is not directly on the MTO item
            item: item.item,
            // Use remaining for partially ordered lists to continue ordering the balance
            quantity:
              mto.status === "PARTIALLY_ORDERED" ? remaining : mtoQuantity,
            unit_price: "", // Empty by default, user will fill this
            measurement_unit: item.item?.measurement_unit || "units",
            stock_on_hand: item.item?.quantity || 0, // Use item.quantity as stock_on_hand
          };
        })
        .filter(Boolean);
      setPoItems(items);
    } else {
      console.warn("No items found in MTO");
      setPoItems([]);
      toast.warning("No items found in selected Materials to Order");
    }
  };

  // Preselect MTO when provided by parent
  useEffect(() => {
    if (!selectedMtoId) return;
    handleMTOSelection(selectedMtoId);
  }, [selectedMtoId]);

  const handleQuantityChange = (itemId, newQuantity) => {
    setPoItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, quantity: parseInt(newQuantity) || 0 }
          : item
      )
    );
  };

  const handleUnitPriceChange = (itemId, newPrice) => {
    setPoItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, unit_price: parseFloat(newPrice) || 0 }
          : item
      )
    );
  };

  const handleRemoveItem = (itemId) => {
    setPoItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleInvoiceFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF and image files are allowed");
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setPoInvoiceFile(file);

    // Create preview URL for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPoInvoicePreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setPoInvoicePreview(null);
    }
  };

  const handleRemoveInvoiceFile = () => {
    setPoInvoiceFile(null);
    setPoInvoicePreview(null);
  };

  const handleViewInvoice = () => {
    if (poInvoiceFile) {
      setShowInvoicePreview(true);
    }
  };
  const handleClosePOModal = () => {
    setShowCreatePurchaseOrderModal(false);
    setSelectedMTO(null);
    setPoItems([]);
    setPoNotes("");
    setPoInvoiceFile(null);
    setPoInvoicePreview(null);
    setPoOrderNo("");
    setPoTotal(0);
    setShowInvoicePreview(false);
    setPageNumber(1);
  };

  const handleCreatePurchaseOrder = async () => {
    try {
      setIsCreatingPO(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      if (!selectedMTO) {
        toast.error("Please select a Materials to Order");
        return;
      }

      if (!poOrderNo || poOrderNo.trim() === "") {
        toast.error("Please enter an Order Number");
        return;
      }

      if (poItems.length === 0) {
        toast.error("Please add at least one item to the purchase order");
        return;
      }

      // Calculate total from items
      const calculatedTotal = poItems.reduce(
        (sum, item) =>
          sum +
          (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0),
        0
      );

      // Use manually entered total if provided, otherwise use calculated
      const finalTotal = poTotal > 0 ? poTotal : calculatedTotal;

      const formData = new FormData();
      formData.append("supplier_id", supplier.supplier_id);
      formData.append("mto_id", String(selectedMTO.id));
      formData.append("order_no", poOrderNo);
      formData.append("orderedBy_id", userData.user?.id || null);
      formData.append("total_amount", finalTotal.toString());
      formData.append("notes", poNotes);

      // Add items as comma-separated JSON objects (not an array)
      const itemsString = poItems
        .map((item) =>
          JSON.stringify({
            item_id: item.item_id,
            quantity: parseFloat(item.quantity) || 0,
            unit_price: parseFloat(item.unit_price) || 0,
            notes: "", // Optional notes per item
          })
        )
        .join(",");
      formData.append("items", itemsString);

      // Add invoice file if exists
      if (poInvoiceFile) {
        formData.append("invoice", poInvoiceFile);
      }

      const response = await axios.post(
        "/api/purchase_order/create",
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.status) {
        toast.success("Purchase order created successfully!");
        handleClosePOModal();
        fetchMaterialsToOrder(); // Refresh the data
      } else {
        toast.error(response.data.message || "Failed to create purchase order");
      }
    } catch (err) {
      console.error("Create purchase order failed", err);
      toast.error(
        err?.response?.data?.message ||
          "An error occurred while creating purchase order"
      );
    } finally {
      setIsCreatingPO(false);
    }
  };

  return (
    <div>
      <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs">
        <div
          className="absolute inset-0 bg-slate-900/40"
          onClick={handleClosePOModal}
        />
        <div className="relative bg-white w-full max-w-6xl mx-4 rounded-xl shadow-xl border border-slate-200 max-h-[95vh] overflow-y-auto">
          <div className="sticky top-0 bg-white z-10 p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-slate-800">
              Create Purchase Order
            </h2>
            <button
              onClick={handleClosePOModal}
              className="cursor-pointer p-2 rounded-lg hover:bg-slate-100"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Supplier Information */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h3 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                Supplier Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                    Supplier Name
                  </label>
                  <p className="text-sm text-slate-800">
                    {supplier?.name || "-"}
                  </p>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                    Supplier ID
                  </label>
                  <p className="text-sm text-slate-800">
                    {supplier?.supplier_id || "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Details */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                  Order Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={poOrderNo}
                  onChange={(e) => setPoOrderNo(e.target.value)}
                  placeholder="e.g., PO-2025-001"
                  className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                  Total Amount (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={poTotal || ""}
                    onChange={(e) =>
                      setPoTotal(parseFloat(e.target.value) || 0)
                    }
                    placeholder="Auto-calculated"
                    className="w-full text-sm text-slate-800 pl-7 pr-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Leave empty to use calculated total
                </p>
              </div>
            </div>

            {/* Select MTO */}
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                Select Materials to Order{" "}
                <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedMTO?.id || ""}
                onChange={(e) => handleMTOSelection(e.target.value)}
                className="cursor-pointer w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                required
              >
                <option value="">-- Select MTO --</option>
                {materialsToOrder
                  // Show only MTOs that are open for ordering and have at least one remaining item
                  .filter((mto) => {
                    if (mto.status === "DRAFT") return true;
                    if (mto.status === "PARTIALLY_ORDERED") {
                      const hasRemaining = Array.isArray(mto.items)
                        ? mto.items.some((it) => {
                            const qty = parseFloat(it.quantity) || 0;
                            const ordered =
                              parseFloat(it.quantity_ordered) || 0;
                            return ordered < qty; // remaining to order
                          })
                        : false;
                      return hasRemaining;
                    }
                    return false;
                  })
                  .map((mto) => (
                    <option key={mto.id} value={mto.id}>
                      {mto.project?.name || `MTO-${mto.id}`} -{" "}
                      {Array.isArray(mto.items)
                        ? mto.items.filter(
                            (it) =>
                              (parseFloat(it.quantity_ordered) || 0) <
                              (parseFloat(it.quantity) || 0)
                          ).length
                        : 0}{" "}
                      remaining item(s)
                    </option>
                  ))}
              </select>
            </div>

            {/* Items Table */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  Items
                </h3>
                {poItems.length > 0 && (
                  <span className="text-xs text-slate-500">
                    {poItems.length} item(s)
                  </span>
                )}
              </div>

              {poItems.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
                  <Package className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                  <p className="text-sm text-slate-600">
                    {selectedMTO
                      ? "No items found in selected MTO"
                      : "Select an MTO above to populate items"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
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
                          Stock
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Unit Price
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {poItems.map((item) => (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          {/* Image Column */}
                          <td className="px-4 py-2 whitespace-nowrap">
                            <div className="flex items-center">
                              {item.item.image?.url ? (
                                <Image
                                  loading="lazy"
                                  src={`/${item.item.image.url}`}
                                  alt={item.item_id}
                                  className="w-12 h-12 object-cover rounded border border-slate-200"
                                  width={48}
                                  height={48}
                                />
                              ) : (
                                <div className="w-12 h-12 bg-slate-100 rounded border border-slate-200 flex items-center justify-center">
                                  <Package className="w-6 h-6 text-slate-400" />
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Category Column */}
                          <td className="px-4 py-2 whitespace-nowrap">
                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                              {item.item.category}
                            </span>
                          </td>

                          {/* Details Column */}
                          <td className="px-4 py-2">
                            <div className="text-xs text-slate-600 space-y-1">
                              {item.item.sheet && (
                                <>
                                  <div>
                                    <span className="font-medium">Color:</span>{" "}
                                    {item.item.sheet.color}
                                  </div>
                                  <div>
                                    <span className="font-medium">Finish:</span>{" "}
                                    {item.item.sheet.finish}
                                  </div>
                                  <div>
                                    <span className="font-medium">Face:</span>{" "}
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
                              {item.item.handle && (
                                <>
                                  <div>
                                    <span className="font-medium">Color:</span>{" "}
                                    {item.item.handle.color}
                                  </div>
                                  <div>
                                    <span className="font-medium">Type:</span>{" "}
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
                              {item.item.hardware && (
                                <>
                                  <div>
                                    <span className="font-medium">Name:</span>{" "}
                                    {item.item.hardware.name}
                                  </div>
                                  <div>
                                    <span className="font-medium">Type:</span>{" "}
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
                              {item.item.accessory && (
                                <>
                                  <div>
                                    <span className="font-medium">Name:</span>{" "}
                                    {item.item.accessory.name}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Stock Column */}
                          <td className="px-4 py-2 whitespace-nowrap">
                            <div className="text-xs">
                              <div
                                className={`font-medium ${
                                  item.stock_on_hand <= 0
                                    ? "text-red-600"
                                    : item.stock_on_hand < 10
                                    ? "text-yellow-600"
                                    : "text-green-600"
                                }`}
                              >
                                {item.stock_on_hand} {item.measurement_unit}
                              </div>
                              <div className="text-xs text-slate-500">
                                in stock
                              </div>
                            </div>
                          </td>

                          {/* Quantity Column */}
                          <td className="px-4 py-2 whitespace-nowrap">
                            <input
                              type="number"
                              min="0"
                              value={item.quantity || ""}
                              onChange={(e) =>
                                handleQuantityChange(item.id, e.target.value)
                              }
                              placeholder="0"
                              className="w-24 text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                            />
                          </td>

                          {/* Unit Price Column */}
                          <td className="px-4 py-2 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-slate-600">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unit_price || ""}
                                onChange={(e) =>
                                  handleUnitPriceChange(item.id, e.target.value)
                                }
                                className="w-24 text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                                placeholder="0.00"
                              />
                            </div>
                          </td>

                          {/* Total Column */}
                          <td className="px-4 py-2 whitespace-nowrap">
                            <p className="text-xs font-medium text-slate-900">
                              $
                              {(
                                (parseFloat(item.quantity) || 0) *
                                (parseFloat(item.unit_price) || 0)
                              ).toFixed(2)}
                            </p>
                          </td>

                          {/* Actions Column */}
                          <td className="px-4 py-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="cursor-pointer p-2 rounded hover:bg-red-50"
                              title="Remove item"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200">
                      <tr>
                        <td
                          colSpan="7"
                          className="px-4 py-2 text-right text-xs font-medium text-slate-700"
                        >
                          Grand Total:
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <p className="text-sm font-bold text-slate-900">
                            $
                            {poItems
                              .reduce(
                                (sum, item) =>
                                  sum +
                                  (parseFloat(item.quantity) || 0) *
                                    (parseFloat(item.unit_price) || 0),
                                0
                              )
                              .toFixed(2)}
                          </p>
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Invoice Upload */}
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                Invoice/Receipt (Optional)
              </label>
              {!poInvoiceFile ? (
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 hover:border-primary transition-colors">
                  <input
                    type="file"
                    id="invoice-upload"
                    accept="application/pdf,image/jpeg,image/jpg,image/png"
                    onChange={handleInvoiceFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="invoice-upload"
                    className="cursor-pointer flex flex-col items-center"
                  >
                    <FileText className="w-8 h-8 text-slate-400 mb-2" />
                    <p className="text-xs text-slate-600 mb-1">
                      Click to upload invoice
                    </p>
                    <p className="text-xs text-slate-500">
                      PDF or Image (Max 10MB)
                    </p>
                  </label>
                </div>
              ) : (
                <div className="border border-slate-300 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {poInvoicePreview ? (
                        <Image
                          loading="lazy"
                          src={poInvoicePreview}
                          alt="Invoice preview"
                          className="w-16 h-16 object-cover rounded border border-slate-200"
                          width={64}
                          height={64}
                        />
                      ) : (
                        <div className="w-16 h-16 bg-slate-100 rounded border border-slate-200 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-slate-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-900 truncate">
                          {poInvoiceFile.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {(poInvoiceFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleViewInvoice}
                        className="cursor-pointer px-3 py-1.5 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-600" />
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveInvoiceFile}
                        className="cursor-pointer px-3 py-1.5 border border-red-300 rounded-md hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">
                Notes
              </label>
              <textarea
                rows={4}
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
                className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none resize-none"
                placeholder="Add any additional notes about this purchase order..."
              />
            </div>
          </div>

          <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 flex justify-end gap-2">
            <button
              onClick={handleClosePOModal}
              disabled={isCreatingPO}
              className="cursor-pointer px-4 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleCreatePurchaseOrder}
              disabled={
                isCreatingPO ||
                !selectedMTO ||
                !poOrderNo ||
                poItems.length === 0
              }
              className="cursor-pointer px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingPO ? "Creating..." : "Create Purchase Order"}
            </button>
          </div>
        </div>
      </div>
      {/* Invoice Preview Modal */}
      {showInvoicePreview && poInvoiceFile && (
        <ViewMedia
          selectedFile={poInvoiceFile}
          setSelectedFile={() => {}} // Don't clear the file on close, just close the modal
          setViewFileModal={setShowInvoicePreview}
          setPageNumber={setPageNumber}
        />
      )}
    </div>
  );
}
