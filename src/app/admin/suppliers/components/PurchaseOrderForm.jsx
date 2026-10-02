import React, { useState, useEffect, useRef } from "react";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import CustomDropdown from "@/components/CustomDropdown";
import useModalFocus from "@/hooks/useModalFocus";
import { toast } from "react-toastify";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import {
  X,
  FileText,
  FilePlus,
  Eye,
  Trash2,
  Package,
  SquareArrowOutUpRight,
} from "lucide-react";
import { pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import Image from "next/image";
import {
  BADGE,
  BADGE_TONES,
  formatQty,
} from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// DESIGN.md 9.2 form field recipe. `hasError` flips the border/ring to red.
const INPUT_BASE =
  "w-full text-sm text-slate-800 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent";
const inputClass = (hasError, extra = "px-4 py-3") =>
  `${INPUT_BASE} ${extra} ${
    hasError
      ? "border-red-500 focus:ring-red-500"
      : "border-slate-300 focus:ring-primary"
  }`;
// Compact variant for fields inside the line-item table.
const CELL_INPUT =
  "w-24 text-sm text-slate-800 px-3 py-2 text-right font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent";

const LABEL = "block text-sm font-medium text-slate-700 mb-1.5";

// DESIGN.md 9.1 button recipes. Only one primary button per modal.
const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_ICON =
  "cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 transition-colors duration-200";
const SPINNER =
  "w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin";

const TH =
  "px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider";

// Line items carry cents (unit prices, GST), so this keeps two decimals where
// the shared whole-dollar formatCurrency would round them away.
const AUD_CENTS = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});
const formatMoney = (value) => AUD_CENTS.format(Number(value) || 0);

const dash = (value) =>
  value === null || value === undefined || value === "" ? "—" : value;

// Category-specific detail rows shown under "Details".
const getDetailRows = (inventoryItem) => {
  const rows = [];
  if (!inventoryItem) return rows;
  const { sheet, handle, hardware, accessory, edging_tape } = inventoryItem;
  if (sheet) {
    rows.push(
      ["Colour", sheet.color],
      ["Finish", sheet.finish],
      ["Face", sheet.face],
      ["Dimensions", sheet.dimensions],
    );
  }
  if (handle) {
    rows.push(
      ["Colour", handle.color],
      ["Type", handle.type],
      ["Dimensions", handle.dimensions],
      ["Material", handle.material],
    );
  }
  if (hardware) {
    rows.push(
      ["Name", hardware.name],
      ["Type", hardware.type],
      ["Dimensions", hardware.dimensions],
      ["Sub-category", hardware.sub_category],
    );
  }
  if (accessory) {
    rows.push(["Name", accessory.name]);
  }
  if (edging_tape) {
    rows.push(
      ["Brand", edging_tape.brand],
      ["Colour", edging_tape.color],
      ["Finish", edging_tape.finish],
      ["Dimensions", edging_tape.dimensions],
    );
  }
  return rows;
};

// Enter in a dropdown's text field must not submit the whole form.
const blockEnterSubmit = (e) => {
  if (e.key === "Enter" && e.target?.getAttribute?.("role") === "combobox") {
    e.preventDefault();
  }
};

const stockTone = (stock) =>
  stock <= 0
    ? "text-red-700"
    : stock < 10
      ? "text-amber-700"
      : "text-green-700";

const lineTotal = (item) =>
  (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);

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
  const [poDeliveryCharge, setPoDeliveryCharge] = useState(0);
  const [poInvoiceDate, setPoInvoiceDate] = useState("");
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [selectedInvoiceFile, setSelectedInvoiceFile] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  // Validate on submit, then on change: errors only exist once a submit was attempted.
  const [submitted, setSubmitted] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const panelRef = useRef(null);
  useModalFocus(panelRef, true);

  const handleMTOSelection = (mtoId) => {
    if (!mtoId) {
      setSelectedMTO(null);
      setPoItems([]);
      return;
    }

    // Find MTO - ID could be string (UUID) or number
    const mto = materialsToOrder.find(
      (m) => m.id === mtoId || m.id === parseInt(mtoId),
    );
    if (!mto) {
      console.error("MTO not found:", mtoId);
      toast.error(
        "Couldn't find those materials to order. Refresh and try again.",
      );
      return;
    }
    setSelectedMTO(mto);

    // Populate items from MTO
    if (mto.items && mto.items.length > 0) {
      const items = mto.items
        .map((item) => {
          const mtoQuantity = parseFloat(item.quantity) || 0;
          const mtoQuantityOrdered = parseFloat(item.quantity_ordered_po) || 0;
          const remaining = Math.max(0, mtoQuantity - mtoQuantityOrdered);

          // If MTO is PARTIALLY_ORDERED, only include items with remaining > 0
          if (mto.status === "PARTIALLY_ORDERED" && remaining <= 0) {
            return null;
          }

          return {
            id: item.id,
            item_id: item.item_id || item.item?.item_id, // Check both locations for item_id
            item: item.item,
            mto_item_id: item.id,
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
      toast.warning("No items found in the selected materials to order.");
    }
  };

  // Preselect MTO when provided by parent
  useEffect(() => {
    if (!selectedMtoId || !materialsToOrder.length) return;
    handleMTOSelection(selectedMtoId);
  }, [selectedMtoId, materialsToOrder]);

  const handleQuantityChange = (itemId, newQuantity) => {
    setPoItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, quantity: parseInt(newQuantity) || 0 }
          : item,
      ),
    );
  };

  const handleUnitPriceChange = (itemId, newPrice) => {
    setPoItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, unit_price: parseFloat(newPrice) || 0 }
          : item,
      ),
    );
  };

  const handleRemoveItem = (itemId) => {
    setPoItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const validateAndSetFile = (file) => {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (!allowedTypes.includes(file.type)) {
      setInvoiceError("Upload a PDF, JPG or PNG file.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setInvoiceError("The file must be smaller than 10 MB.");
      return;
    }

    setInvoiceError("");
    setPoInvoiceFile(file);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => setPoInvoicePreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPoInvoicePreview(null);
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

  const handleInvoiceFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndSetFile(file);
  };

  const handleRemoveInvoiceFile = () => {
    setPoInvoiceFile(null);
    setPoInvoicePreview(null);
    setInvoiceError("");
  };

  const handleViewInvoice = () => {
    if (poInvoiceFile) {
      // Create formatted object for ViewMedia component
      setSelectedInvoiceFile({
        name: poInvoiceFile.name,
        type: poInvoiceFile.type,
        size: poInvoiceFile.size,
        isExisting: false,
        // Pass the File object itself for URL.createObjectURL
        ...poInvoiceFile,
      });
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
    setPoDeliveryCharge(0);
    setPoInvoiceDate("");
    setShowInvoicePreview(false);
    setSelectedInvoiceFile(null);
    setPageNumber(1);
    setSubmitted(false);
    setInvoiceError("");
  };

  // Totals (same maths as before, computed once for the table footer)
  const orderSubtotal = poItems.reduce((sum, item) => sum + lineTotal(item), 0);
  const gstAmount =
    Math.ceil(
      (orderSubtotal + (parseFloat(poDeliveryCharge) || 0)) * 0.1 * 100,
    ) / 100;
  const grandTotal =
    orderSubtotal + (parseFloat(poDeliveryCharge) || 0) + gstAmount;

  // A form with typed or chosen input must not close on a stray backdrop click.
  const isDirty =
    poOrderNo.trim() !== "" ||
    poTotal > 0 ||
    poDeliveryCharge > 0 ||
    poInvoiceDate !== "" ||
    poNotes.trim() !== "" ||
    !!poInvoiceFile ||
    poItems.some((item) => item.unit_price) ||
    (selectedMTO
      ? String(selectedMTO.id) !== String(selectedMtoId ?? "")
      : false);

  // Modals close on Escape (DESIGN.md 9.4). The invoice viewer handles its own
  // Escape, and an open dropdown closes itself first.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape" || isCreatingPO || showInvoicePreview) return;
      if (e.target?.getAttribute?.("aria-expanded") === "true") return;
      handleClosePOModal();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [isCreatingPO, showInvoicePreview]);

  const validate = () => {
    const errs = {};
    if (!selectedMTO) {
      errs.mto = "Select the materials to order.";
    }
    if (!poOrderNo || poOrderNo.trim() === "") {
      errs.order_no = "Enter an order number.";
    }
    if (selectedMTO) {
      if (poItems.length === 0) {
        errs.items = "Add at least one item to the purchase order.";
      } else if (!poItems.some((item) => item.item_id)) {
        errs.items =
          "None of these items can be ordered because they're missing item details.";
      }
    }
    return errs;
  };

  const errors = submitted ? validate() : {};

  // Field order here is also the order focus moves to on a failed submit.
  const fieldOrder = [
    ["order_no", "po-order-no"],
    ["mto", "po-mto"],
    ["items", "po-items"],
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);

    const currentErrors = validate();
    const firstInvalid = fieldOrder.find(([key]) => currentErrors[key]);
    if (firstInvalid) {
      document.getElementById(firstInvalid[1])?.focus();
      return;
    }

    handleCreatePurchaseOrder();
  };

  const handleCreatePurchaseOrder = async () => {
    try {
      setIsCreatingPO(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again.");
        return;
      }

      // Filter out items without item_id and validate
      const validItems = poItems.filter((item) => {
        if (!item.item_id) {
          console.warn("Item missing item_id:", item);
          return false;
        }
        return true;
      });

      if (validItems.length === 0) {
        return;
      }

      if (validItems.length < poItems.length) {
        toast.warning(
          `${
            poItems.length - validItems.length
          } item(s) were removed due to missing information.`,
        );
      }

      // Calculate total from valid items
      const calculatedTotal = validItems.reduce(
        (sum, item) =>
          sum +
          (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0),
        0,
      );

      // Use manually entered total if provided, otherwise use calculated
      const finalTotal = poTotal > 0 ? poTotal : calculatedTotal;

      const formData = new FormData();
      formData.append("supplier_id", supplier.supplier_id);
      formData.append("mto_id", String(selectedMTO.id));
      formData.append("order_no", poOrderNo);
      formData.append("orderedBy_id", userData.user?.id || null);
      formData.append("total_amount", finalTotal.toString());
      if (poDeliveryCharge > 0) {
        formData.append("delivery_charge", poDeliveryCharge.toString());
      }
      if (poInvoiceDate) {
        formData.append("invoice_date", poInvoiceDate);
      }
      formData.append("notes", poNotes);

      // Add items as comma-separated JSON objects (not an array)
      const itemsString = validItems
        .map((item) => {
          const qty = parseFloat(item.quantity) || 0;
          const unitPrice = parseFloat(item.unit_price) || 0;
          const totalBeforeGst = qty * unitPrice;
          const gst = Math.ceil(totalBeforeGst * 0.1 * 100) / 100;

          return JSON.stringify({
            item_id: item.item_id,
            mto_item_id: item.mto_item_id,
            quantity: qty,
            unit_price: unitPrice,
            gst: gst,
            total_amount: totalBeforeGst,
            notes: "", // Optional notes per item
          });
        })
        .join(",");
      formData.append("items", itemsString);

      // Add invoice file if exists
      if (poInvoiceFile) {
        formData.append("invoice", poInvoiceFile);
      }
      formData.append("status", "ORDERED");

      const response = await axios.post(
        "/api/v1/purchase_order/create",
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      if (response.data.status) {
        toast.success("Purchase order created.");
        handleClosePOModal();
        fetchMaterialsToOrder(); // Refresh the data
      } else {
        toast.error(
          response.data.message ||
            "Couldn't create the purchase order. Check the details and try again.",
        );
      }
    } catch (err) {
      console.error("Create purchase order failed", err);
      toast.error(
        err?.response?.data?.message ||
          "Couldn't create the purchase order. Check your connection and try again.",
      );
    } finally {
      setIsCreatingPO(false);
    }
  };

  // MTOs open for ordering that still have at least one remaining item
  const remainingCount = (mto) =>
    Array.isArray(mto.items)
      ? mto.items.filter(
          (it) =>
            (parseFloat(it.quantity_ordered_po) || 0) <
            (parseFloat(it.quantity) || 0),
        ).length
      : 0;

  const mtoOptions = materialsToOrder
    .filter((mto) => {
      if (mto.status === "DRAFT") return true;
      if (mto.status === "PARTIALLY_ORDERED") {
        const hasRemaining = Array.isArray(mto.items)
          ? mto.items.some((it) => {
              const qty = parseFloat(it.quantity) || 0;
              const ordered = parseFloat(it.quantity_ordered_po) || 0;
              return ordered < qty; // remaining to order
            })
          : false;
        return hasRemaining;
      }
      return false;
    })
    .map((mto) => {
      const count = remainingCount(mto);
      return {
        value: mto.id,
        label: `${mto.project?.name || `MTO-${mto.id}`} — ${count} remaining ${
          count === 1 ? "item" : "items"
        }`,
      };
    });

  return (
    <div>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
        onClick={() => {
          if (!isDirty && !isCreatingPO) handleClosePOModal();
        }}
      >
        <div
          ref={panelRef}
          className="bg-white w-full max-w-6xl rounded-xl border border-slate-200 max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="po-form-title"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h2
              id="po-form-title"
              className="text-lg font-semibold text-slate-800"
            >
              Create purchase order
            </h2>
            <button
              type="button"
              onClick={handleClosePOModal}
              className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200"
              aria-label="Close"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <form
            noValidate
            onSubmit={handleSubmit}
            className="flex flex-col min-h-0 flex-1"
          >
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Supplier Information */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">
                    {supplier?.name || "—"}
                  </p>
                  {/* open in new tab */}
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        `/admin/suppliers/${supplier?.supplier_id}`,
                        "_blank",
                      )
                    }
                    className={BTN_ICON}
                    aria-label={`Open ${supplier?.name || "supplier"} in a new tab`}
                    title="Open supplier in a new tab"
                  >
                    <SquareArrowOutUpRight
                      className="w-4 h-4 text-slate-600"
                      aria-hidden="true"
                    />
                  </button>
                </div>

                <p className="text-xs font-mono text-slate-500">
                  {supplier?.supplier_id || "—"}
                </p>
              </div>

              {/* Order Details */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="po-order-no" className={LABEL}>
                    Order number{" "}
                    <span className="text-red-600" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    id="po-order-no"
                    type="text"
                    required
                    data-autofocus
                    value={poOrderNo}
                    onChange={(e) => setPoOrderNo(e.target.value)}
                    placeholder="e.g. PO-2025-001"
                    aria-invalid={!!errors.order_no}
                    aria-describedby={
                      errors.order_no ? "po-order-no-error" : undefined
                    }
                    className={inputClass(!!errors.order_no)}
                  />
                  {errors.order_no && (
                    <p
                      id="po-order-no-error"
                      className="text-xs text-red-600 mt-1"
                    >
                      {errors.order_no}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="po-total" className={LABEL}>
                    Total amount
                  </label>
                  <div className="relative">
                    <span
                      className="absolute inset-y-0 left-3 flex items-center text-sm text-slate-600"
                      aria-hidden="true"
                    >
                      $
                    </span>
                    <input
                      id="po-total"
                      type="number"
                      min="0"
                      step="0.01"
                      value={poTotal || ""}
                      onChange={(e) =>
                        setPoTotal(parseFloat(e.target.value) || 0)
                      }
                      placeholder="0.00"
                      aria-describedby="po-total-hint"
                      className={`${inputClass(false, "py-3 pr-4 pl-8")} font-mono`}
                    />
                  </div>
                  <p id="po-total-hint" className="text-xs text-slate-500 mt-1">
                    Leave blank to use the calculated total.
                  </p>
                </div>
                {/* Invoice Date */}
                <div>
                  <label htmlFor="po-invoice-date" className={LABEL}>
                    Invoice date
                  </label>
                  <input
                    id="po-invoice-date"
                    type="date"
                    value={poInvoiceDate}
                    onChange={(e) => setPoInvoiceDate(e.target.value)}
                    className={inputClass(false)}
                  />
                </div>
              </div>

              {/* Select MTO */}
              <div onKeyDown={blockEnterSubmit}>
                <label htmlFor="po-mto" className={LABEL}>
                  Materials to order{" "}
                  <span className="text-red-600" aria-hidden="true">
                    *
                  </span>
                </label>
                <CustomDropdown
                  id="po-mto"
                  options={mtoOptions}
                  value={selectedMTO?.id || ""}
                  onChange={handleMTOSelection}
                  placeholder="Select materials to order"
                  emptyText="No materials to order are open for ordering"
                  searchable={mtoOptions.length > 10}
                  invalid={!!errors.mto}
                  describedBy={errors.mto ? "po-mto-error" : undefined}
                />
                {errors.mto && (
                  <p id="po-mto-error" className="text-xs text-red-600 mt-1">
                    {errors.mto}
                  </p>
                )}
              </div>

              {/* Items Table */}
              <div id="po-items" tabIndex={-1} className="focus:outline-none">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Items
                  </h3>
                  {poItems.length > 0 && (
                    <span className="text-xs text-slate-500">
                      {poItems.length} {poItems.length === 1 ? "item" : "items"}
                    </span>
                  )}
                </div>

                {poItems.length === 0 ? (
                  <div className="text-center py-12 border border-slate-200 rounded-lg">
                    <Package
                      className="w-8 h-8 mx-auto mb-2 text-slate-300"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-slate-600">
                      {selectedMTO
                        ? "No items found in the selected materials to order."
                        : "Select materials to order above to populate items."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className={`${TH} text-left`}>Image</th>
                          <th className={`${TH} text-left`}>Category</th>
                          <th className={`${TH} text-left`}>Details</th>
                          <th className={`${TH} text-right`}>Stock</th>
                          <th className={`${TH} text-right`}>Quantity</th>
                          <th className={`${TH} text-right`}>
                            Unit price (excl. GST)
                          </th>
                          <th className={`${TH} text-right`}>Total</th>
                          <th className={`${TH} text-right`}>Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {poItems.map((item) => {
                          const itemName = item.item_id || "item";
                          return (
                            <tr
                              key={item.id}
                              className="hover:bg-slate-50 transition-colors"
                            >
                              {/* Image Column */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                {item.item?.image?.url ? (
                                  <Image
                                    loading="lazy"
                                    src={`/${item.item.image.url}`}
                                    alt={
                                      item.item_id ||
                                      item.item?.category ||
                                      "Item image"
                                    }
                                    className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                                    width={48}
                                    height={48}
                                  />
                                ) : (
                                  <div className="w-12 h-12 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
                                    <Package
                                      className="w-5 h-5 text-slate-400"
                                      aria-hidden="true"
                                    />
                                  </div>
                                )}
                              </td>

                              {/* Category Column */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                {item.item?.category ? (
                                  <span
                                    className={`${BADGE} ${BADGE_TONES.violet}`}
                                  >
                                    {formatLabel(item.item.category)}
                                  </span>
                                ) : (
                                  <span className="text-sm text-slate-500">
                                    —
                                  </span>
                                )}
                              </td>

                              {/* Details Column */}
                              <td className="px-4 py-3">
                                <div className="text-xs text-slate-600 space-y-1">
                                  {getDetailRows(item.item).map(
                                    ([label, value], index) => (
                                      <div key={`${label}-${index}`}>
                                        <span className="font-medium">
                                          {label}:
                                        </span>{" "}
                                        {dash(value)}
                                      </div>
                                    ),
                                  )}
                                </div>
                              </td>

                              {/* Stock Column */}
                              <td className="px-4 py-3 whitespace-nowrap text-right">
                                <div
                                  className={`text-sm font-mono font-medium ${stockTone(
                                    item.stock_on_hand,
                                  )}`}
                                >
                                  {formatQty(
                                    item.stock_on_hand,
                                    item.measurement_unit,
                                  )}
                                </div>
                                <div className="text-xs text-slate-500">
                                  in stock
                                </div>
                              </td>

                              {/* Quantity Column */}
                              <td className="px-4 py-3 whitespace-nowrap text-right">
                                <input
                                  type="number"
                                  min="0"
                                  value={item.quantity || ""}
                                  onChange={(e) =>
                                    handleQuantityChange(
                                      item.id,
                                      e.target.value,
                                    )
                                  }
                                  placeholder="0"
                                  aria-label={`Quantity for ${itemName}`}
                                  className={CELL_INPUT}
                                />
                              </td>

                              {/* Unit Price Column */}
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  <span
                                    className="text-sm text-slate-600"
                                    aria-hidden="true"
                                  >
                                    $
                                  </span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={item.unit_price || ""}
                                    onChange={(e) =>
                                      handleUnitPriceChange(
                                        item.id,
                                        e.target.value,
                                      )
                                    }
                                    className={CELL_INPUT}
                                    placeholder="0.00"
                                    aria-label={`Unit price for ${itemName}, excluding GST`}
                                  />
                                </div>
                              </td>

                              {/* Total Column */}
                              <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-mono font-medium text-slate-800">
                                {formatMoney(lineTotal(item))}
                              </td>

                              {/* Actions Column */}
                              <td className="px-4 py-3 whitespace-nowrap text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(item.id)}
                                  className="cursor-pointer p-1.5 text-red-600 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                                  aria-label={`Remove ${itemName}`}
                                  title="Remove item"
                                >
                                  <Trash2
                                    className="w-4 h-4"
                                    aria-hidden="true"
                                  />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50">
                        <tr className="border-t border-slate-200">
                          <td
                            colSpan="6"
                            className="px-4 py-2 text-right text-sm text-slate-600"
                          >
                            Order total
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-mono text-slate-700">
                            {formatMoney(orderSubtotal)}
                          </td>
                          <td></td>
                        </tr>
                        <tr>
                          <td
                            colSpan="6"
                            className="px-4 py-2 text-right text-sm text-slate-600"
                          >
                            <label htmlFor="po-delivery-charge">
                              Delivery charge
                            </label>
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              <span
                                className="text-sm text-slate-600"
                                aria-hidden="true"
                              >
                                $
                              </span>
                              <input
                                id="po-delivery-charge"
                                type="number"
                                min="0"
                                step="0.01"
                                value={poDeliveryCharge || ""}
                                onChange={(e) =>
                                  setPoDeliveryCharge(
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                placeholder="0.00"
                                className={CELL_INPUT}
                              />
                            </div>
                          </td>
                          <td></td>
                        </tr>
                        <tr>
                          <td
                            colSpan="6"
                            className="px-4 py-2 text-right text-sm text-slate-600"
                          >
                            GST amount (10%)
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-mono text-slate-700">
                            {formatMoney(gstAmount)}
                          </td>
                          <td></td>
                        </tr>
                        <tr className="border-t border-slate-200">
                          <td
                            colSpan="6"
                            className="px-4 py-2 text-right text-sm font-semibold text-slate-700"
                          >
                            Grand total
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-mono font-semibold text-slate-800">
                            {formatMoney(grandTotal)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
                {errors.items && (
                  <p id="po-items-error" className="text-xs text-red-600 mt-1">
                    {errors.items}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Invoice Upload */}
                <div>
                  <span id="po-invoice-label" className={LABEL}>
                    Invoice / receipt
                  </span>
                  {!poInvoiceFile ? (
                    <div
                      className={`border-2 border-dashed rounded-lg py-8 transition-colors duration-200 focus-within:ring-2 focus-within:ring-primary ${
                        invoiceError
                          ? "border-red-500"
                          : isDragging
                            ? "border-primary bg-primary/10"
                            : "border-slate-300 hover:border-primary hover:bg-slate-50"
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <input
                        type="file"
                        id="po-invoice-upload"
                        accept="application/pdf,image/jpeg,image/jpg,image/png"
                        onChange={handleInvoiceFileChange}
                        aria-labelledby="po-invoice-label"
                        aria-invalid={!!invoiceError}
                        aria-describedby={
                          invoiceError ? "po-invoice-error" : undefined
                        }
                        className="sr-only"
                      />
                      <label
                        htmlFor="po-invoice-upload"
                        className="cursor-pointer flex flex-col items-center text-center w-full h-full"
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
                            ? "Drop the file here"
                            : "Click to upload or drag and drop"}
                        </span>
                        <span className="text-xs text-slate-500 mt-1">
                          PDF, JPG or PNG, up to 10 MB
                        </span>
                      </label>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-lg p-3 flex items-center justify-between bg-slate-50">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {poInvoicePreview ? (
                          <Image
                            src={poInvoicePreview}
                            alt="Invoice preview"
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-lg object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                            <FileText
                              className="w-5 h-5 text-slate-400"
                              aria-hidden="true"
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p
                            className="text-sm font-medium text-slate-800 truncate"
                            title={poInvoiceFile.name}
                          >
                            {poInvoiceFile.name}
                          </p>
                          <p className="text-xs font-mono text-slate-500">
                            {(poInvoiceFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleViewInvoice}
                          className={BTN_ICON}
                          aria-label="Preview invoice"
                          title="Preview invoice"
                        >
                          <Eye
                            className="w-4 h-4 text-slate-600"
                            aria-hidden="true"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveInvoiceFile}
                          className="cursor-pointer p-1.5 text-red-600 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                          aria-label="Remove invoice"
                          title="Remove invoice"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )}
                  {invoiceError && (
                    <p
                      id="po-invoice-error"
                      className="text-xs text-red-600 mt-1"
                    >
                      {invoiceError}
                    </p>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <label htmlFor="po-notes" className={LABEL}>
                    Notes
                  </label>
                  <textarea
                    id="po-notes"
                    rows={5}
                    value={poNotes}
                    onChange={(e) => setPoNotes(e.target.value)}
                    className={`${inputClass(false)} resize-none`}
                    placeholder="e.g. Deliver to the workshop before 9am"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                type="button"
                onClick={handleClosePOModal}
                disabled={isCreatingPO}
                className={BTN_SECONDARY}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingPO}
                className={BTN_PRIMARY}
              >
                {isCreatingPO ? (
                  <span className={SPINNER} aria-hidden="true" />
                ) : (
                  <FilePlus className="w-4 h-4" aria-hidden="true" />
                )}
                Create purchase order
              </button>
            </div>
          </form>
        </div>
      </div>
      {/* Invoice Preview Modal */}
      {showInvoicePreview && selectedInvoiceFile && (
        <ViewMedia
          selectedFile={selectedInvoiceFile}
          setSelectedFile={() => {}}
          setViewFileModal={setShowInvoicePreview}
          setPageNumber={setPageNumber}
        />
      )}
    </div>
  );
}
