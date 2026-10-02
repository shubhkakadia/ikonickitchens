import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import {
  X,
  FileText,
  FilePlus,
  Eye,
  Trash2,
  Package,
  Search,
  Plus,
} from "lucide-react";
import Image from "next/image";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import CustomDropdown from "@/components/CustomDropdown";
import useModalFocus from "@/hooks/useModalFocus";
import {
  BADGE,
  BADGE_TONES,
  formatQty,
} from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";
import AddItemModal from "./AddItemModal";

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
const cellInputClass = (hasError) =>
  `w-24 text-sm text-slate-800 px-3 py-2 text-right font-mono border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
    hasError
      ? "border-red-500 focus:ring-red-500"
      : "border-slate-300 focus:ring-primary"
  }`;

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

const lineTotal = (item) =>
  (parseFloat(item.order_quantity) || 0) *
  (parseFloat(item.order_unit_price) || 0);

const hasInvalidQuantity = (item) =>
  !item.order_quantity || item.order_quantity <= 0;

// Enter in a dropdown's text field must not submit the whole form.
const blockEnterSubmit = (e) => {
  if (e.key === "Enter" && e.target?.getAttribute?.("role") === "combobox") {
    e.preventDefault();
  }
};

export default function CreatePurchaseOrderModal({
  setShowModal,
  onSuccess,
  mtoId,
}) {
  const { getToken, userData } = useAuth();

  // Data States
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierItems, setSupplierItems] = useState([]);
  const [itemSearch, setItemSearch] = useState("");

  // Form States
  const [poOrderNo, setPoOrderNo] = useState("");
  const [poTotal, setPoTotal] = useState("");
  const [poDeliveryCharge, setPoDeliveryCharge] = useState("");
  const [poInvoiceDate, setPoInvoiceDate] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  // Validate on submit, then on change: errors only exist once a submit was attempted.
  const [submitted, setSubmitted] = useState(false);

  // File Upload States
  const [poInvoiceFile, setPoInvoiceFile] = useState(null);
  const [poInvoicePreview, setPoInvoicePreview] = useState(null);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [invoiceError, setInvoiceError] = useState("");

  // UI States
  const [loading, setLoading] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showItemSearchResults, setShowItemSearchResults] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const searchRef = useRef(null);
  const panelRef = useRef(null);
  useModalFocus(panelRef, true);

  // Fetch Suppliers on Mount
  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Start on the first required field (the dropdown opens its list on focus).
  useEffect(() => {
    document.getElementById("po-supplier")?.focus();
  }, []);

  // Close search results on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowItemSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
        toast.error("Couldn't load suppliers. Refresh and try again.");
      }
    } catch (err) {
      console.error(err);
      toast.error(
        "Couldn't load suppliers. Check your connection and try again.",
      );
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const fetchSupplierItems = async (supplierId) => {
    try {
      setLoadingItems(true);
      const sessionToken = getToken();
      if (!sessionToken) return;

      const response = await axios.get(
        `/api/v1/item/by-supplier/${supplierId}`,
        {
          headers: { Authorization: `Bearer ${sessionToken}` },
        },
      );

      if (response.data.status) {
        setSupplierItems(response.data.data || []);
      } else {
        setSupplierItems([]);
        // Don't show error if no items, just empty list
      }
    } catch (err) {
      console.error(err);
      setSupplierItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  const supplierOptions = suppliers.map((supplier) => ({
    value: supplier.supplier_id,
    label: supplier.name,
    description: supplier.supplier_id,
  }));

  const handleSupplierSelect = (supplierId) => {
    const supplier = suppliers.find((s) => s.supplier_id === supplierId);
    setSelectedSupplier(supplier);
    fetchSupplierItems(supplierId);
    setSelectedItems([]); // Clear selected items when supplier changes
  };

  // Filter items based on search
  const filteredItems = supplierItems.filter((item) => {
    if (!itemSearch) return false;
    const searchLower = itemSearch.toLowerCase();

    // Check various fields
    const matchesCategory = item.category?.toLowerCase().includes(searchLower);
    const matchesDesc = item.description?.toLowerCase().includes(searchLower);
    const matchesSupplierRef =
      item.itemSuppliers?.some(
        (is) =>
          is.supplier_id === selectedSupplier?.supplier_id &&
          is.supplier_reference?.toLowerCase().includes(searchLower),
      ) || item.supplier_reference?.toLowerCase().includes(searchLower);

    let matchesDetails = false;
    if (item.sheet) {
      matchesDetails =
        item.sheet.brand?.toLowerCase().includes(searchLower) ||
        item.sheet.color?.toLowerCase().includes(searchLower) ||
        item.sheet.finish?.toLowerCase().includes(searchLower);
    } else if (item.handle) {
      matchesDetails =
        item.handle.brand?.toLowerCase().includes(searchLower) ||
        item.handle.color?.toLowerCase().includes(searchLower) ||
        item.handle.type?.toLowerCase().includes(searchLower);
    } else if (item.hardware) {
      matchesDetails =
        item.hardware.brand?.toLowerCase().includes(searchLower) ||
        item.hardware.name?.toLowerCase().includes(searchLower);
    } else if (item.accessory) {
      matchesDetails = item.accessory.name?.toLowerCase().includes(searchLower);
    } else if (item.edging_tape) {
      matchesDetails =
        item.edging_tape.brand?.toLowerCase().includes(searchLower) ||
        item.edging_tape.color?.toLowerCase().includes(searchLower);
    }

    return (
      matchesCategory || matchesDesc || matchesSupplierRef || matchesDetails
    );
  });

  const handleAddItem = (item) => {
    // Check if already added
    if (selectedItems.some((i) => i.item_id === item.item_id)) {
      toast.info("That item is already on the order.");
      return;
    }

    setSelectedItems((prev) => [
      ...prev,
      {
        ...item,
        item_id: item.item_id,
        order_quantity: 1, // Default quantity
        order_unit_price: item.price || 0, // Default price
      },
    ]);
    setItemSearch("");
    setShowItemSearchResults(false);
  };

  const handleUpdateItem = (itemId, field, value) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.item_id === itemId) {
          return { ...item, [field]: value };
        }
        return item;
      }),
    );
  };

  const handleRemoveItem = (itemId) => {
    setSelectedItems((prev) => prev.filter((item) => item.item_id !== itemId));
  };

  const [isDragging, setIsDragging] = useState(false);

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

  const closeModal = () => setShowModal(false);

  // Totals (same maths as before, computed once for the table footer)
  const orderSubtotal = selectedItems.reduce(
    (sum, item) => sum + lineTotal(item),
    0,
  );
  const gstAmount =
    Math.ceil(
      (orderSubtotal + (parseFloat(poDeliveryCharge) || 0)) * 0.1 * 100,
    ) / 100;
  const grandTotal =
    orderSubtotal + (parseFloat(poDeliveryCharge) || 0) + gstAmount;

  // A form with typed or chosen input must not close on a stray backdrop click.
  const isDirty =
    !!selectedSupplier ||
    selectedItems.length > 0 ||
    poOrderNo.trim() !== "" ||
    poTotal !== "" ||
    poDeliveryCharge !== "" ||
    poInvoiceDate !== "" ||
    poNotes.trim() !== "" ||
    !!poInvoiceFile;

  // Modals close on Escape (DESIGN.md 9.4). The invoice viewer and the add-item
  // modal handle their own Escape; an open dropdown or result list closes first.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape" || loading) return;
      if (showInvoicePreview || showAddItemModal) return;
      if (e.target?.getAttribute?.("aria-expanded") === "true") return;
      if (showItemSearchResults && itemSearch && selectedSupplier) {
        setShowItemSearchResults(false);
        return;
      }
      closeModal();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [
    loading,
    showInvoicePreview,
    showAddItemModal,
    showItemSearchResults,
    itemSearch,
    selectedSupplier,
  ]);

  const validate = () => {
    const errs = {};
    if (!selectedSupplier) {
      errs.supplier = "Select a supplier.";
    }
    if (!poOrderNo.trim()) {
      errs.order_no = "Enter an order number.";
    }
    if (selectedItems.length === 0) {
      errs.items = "Add at least one item.";
    } else if (selectedItems.some(hasInvalidQuantity)) {
      errs.items = "Every item needs a quantity greater than 0.";
    }
    return errs;
  };

  const errors = submitted ? validate() : {};

  // Field order here is also the order focus moves to on a failed submit.
  const fieldOrder = ["supplier", "order_no", "items"];

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);

    const currentErrors = validate();
    const firstInvalid = fieldOrder.find((key) => currentErrors[key]);
    if (firstInvalid) {
      let targetId = {
        supplier: "po-supplier",
        order_no: "po-order-no",
        items: "po-item-search",
      }[firstInvalid];
      if (firstInvalid === "items") {
        const badItem = selectedItems.find(hasInvalidQuantity);
        if (badItem) targetId = `po-qty-${badItem.item_id}`;
      }
      document.getElementById(targetId)?.focus();
      return;
    }

    handleCreatePO();
  };

  const handleCreatePO = async () => {
    setLoading(true);
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again.");
        return;
      }

      const calculatedTotal = selectedItems.reduce(
        (sum, item) =>
          sum +
          (parseFloat(item.order_quantity) || 0) *
            (parseFloat(item.order_unit_price) || 0),
        0,
      );

      const finalTotal = poTotal ? parseFloat(poTotal) : calculatedTotal;

      const formData = new FormData();
      formData.append("supplier_id", selectedSupplier.supplier_id);
      formData.append("order_no", poOrderNo);
      formData.append("orderedBy_id", userData?.user?.id || "");

      // Add mto_id if this PO is linked to an MTO
      if (mtoId) {
        formData.append("mto_id", mtoId);
      }

      formData.append("total_amount", finalTotal.toString());
      if (poDeliveryCharge && parseFloat(poDeliveryCharge) > 0) {
        formData.append("delivery_charge", poDeliveryCharge);
      }
      if (poInvoiceDate) {
        formData.append("invoice_date", poInvoiceDate);
      }
      formData.append("notes", poNotes);

      const itemsData = selectedItems.map((item) => {
        const qty = parseFloat(item.order_quantity);
        const unitPrice = parseFloat(item.order_unit_price);
        const totalBeforeGst = qty * unitPrice;
        const gst = Math.ceil(totalBeforeGst * 0.1 * 100) / 100;

        return {
          item_id: item.item_id,
          quantity: qty,
          unit_price: unitPrice,
          gst: gst,
          total_amount: totalBeforeGst,
          notes: "",
        };
      });

      // The API expects a string of JSON objects separated by comma, the same
      // shape PurchaseOrderForm.jsx sends.
      const itemsString = itemsData
        .map((item) => JSON.stringify(item))
        .join(",");
      formData.append("items", itemsString);

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
        if (onSuccess) onSuccess();
        setShowModal(false);
      } else {
        toast.error(
          response.data.message ||
            "Couldn't create the purchase order. Check the details and try again.",
        );
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          "Couldn't create the purchase order. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const getItemDisplayName = (item) => {
    let parts = [];
    if (item.sheet)
      parts = [item.sheet.brand, item.sheet.color, item.sheet.finish];
    else if (item.handle)
      parts = [item.handle.brand, item.handle.color, item.handle.type];
    else if (item.hardware)
      parts = [
        item.hardware.brand,
        item.hardware.name,
        item.hardware.sub_category,
        item.hardware.type,
      ];
    else if (item.accessory) parts = [item.accessory.name];
    else if (item.edging_tape)
      parts = [
        item.edging_tape.brand,
        item.edging_tape.color,
        item.edging_tape.finish,
      ];
    else return item.description || "Item";
    return parts.filter(Boolean).join(" ") || "Item";
  };

  const getSupplierRef = (item) =>
    item.itemSuppliers?.find(
      (is) => is.supplier_id === selectedSupplier?.supplier_id,
    )?.supplier_reference || item.supplier_reference;

  // Category-specific detail rows shown under "Details".
  const getDetailRows = (item) => {
    const rows = [];
    const ref = getSupplierRef(item);
    if (ref) rows.push(["Supplier ref", ref]);
    if (item.sheet) {
      rows.push(
        ["Colour", item.sheet.color],
        ["Finish", item.sheet.finish],
        ["Face", item.sheet.face],
        ["Dimensions", item.sheet.dimensions],
      );
    }
    if (item.handle) {
      rows.push(
        ["Colour", item.handle.color],
        ["Type", item.handle.type],
        ["Dimensions", item.handle.dimensions],
        ["Material", item.handle.material],
      );
    }
    if (item.hardware) {
      rows.push(
        ["Name", item.hardware.name],
        ["Type", item.hardware.type],
        ["Dimensions", item.hardware.dimensions],
        ["Sub-category", item.hardware.sub_category],
      );
    }
    if (item.accessory) {
      rows.push(["Name", item.accessory.name]);
    }
    if (item.edging_tape) {
      rows.push(
        ["Brand", item.edging_tape.brand],
        ["Colour", item.edging_tape.color],
        ["Finish", item.edging_tape.finish],
        ["Dimensions", item.edging_tape.dimensions],
      );
    }
    return rows;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
      onClick={() => {
        if (!isDirty && !loading) closeModal();
      }}
    >
      <div
        ref={panelRef}
        className="bg-white w-full max-w-6xl rounded-xl border border-slate-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-po-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2
            id="create-po-title"
            className="text-lg font-semibold text-slate-800"
          >
            Create purchase order
          </h2>
          <button
            type="button"
            onClick={closeModal}
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
          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Top Section: Supplier & Order Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Supplier */}
              <div onKeyDown={blockEnterSubmit}>
                <label htmlFor="po-supplier" className={LABEL}>
                  Supplier{" "}
                  <span className="text-red-600" aria-hidden="true">
                    *
                  </span>
                </label>
                <CustomDropdown
                  id="po-supplier"
                  options={supplierOptions}
                  value={selectedSupplier?.supplier_id || ""}
                  onChange={handleSupplierSelect}
                  placeholder="Search or select a supplier"
                  searchable
                  loading={loadingSuppliers}
                  loadingText="Loading suppliers..."
                  emptyText="No matching suppliers found"
                  invalid={!!errors.supplier}
                  describedBy={
                    errors.supplier ? "po-supplier-error" : undefined
                  }
                />
                {errors.supplier && (
                  <p
                    id="po-supplier-error"
                    className="text-xs text-red-600 mt-1"
                  >
                    {errors.supplier}
                  </p>
                )}
              </div>

              {/* Order No */}
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

              {/* Total Amount */}
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
                    value={poTotal}
                    onChange={(e) => setPoTotal(e.target.value)}
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

            <hr className="border-slate-200" />

            {/* Item Selection & List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700">Items</h3>
                {selectedItems.length > 0 && (
                  <span className="text-xs text-slate-500">
                    {selectedItems.length}{" "}
                    {selectedItems.length === 1 ? "item" : "items"}
                  </span>
                )}
              </div>

              {/* Search Bar */}
              <div className="relative mb-4" ref={searchRef}>
                <label htmlFor="po-item-search" className="sr-only">
                  Search items
                </label>
                <div className="relative">
                  <Search
                    className="absolute inset-y-0 left-3 my-auto w-4 h-4 text-slate-500"
                    aria-hidden="true"
                  />
                  <input
                    id="po-item-search"
                    type="text"
                    placeholder={
                      selectedSupplier
                        ? "Search items by name, category or brand"
                        : "Select a supplier to search items"
                    }
                    value={itemSearch}
                    onChange={(e) => {
                      setItemSearch(e.target.value);
                      setShowItemSearchResults(true);
                    }}
                    onFocus={() => setShowItemSearchResults(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.preventDefault();
                    }}
                    disabled={!selectedSupplier}
                    className={`${inputClass(
                      false,
                      "py-3 pr-4 pl-10",
                    )} disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed`}
                  />
                </div>

                {/* Search Results Dropdown */}
                {showItemSearchResults && itemSearch && selectedSupplier && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg z-40 max-h-60 overflow-y-auto">
                    {loadingItems ? (
                      <div className="p-4 text-center text-slate-500 text-sm">
                        Loading items...
                      </div>
                    ) : filteredItems.length === 0 ? (
                      <div className="p-4 text-center space-y-3">
                        <p className="text-slate-500 text-sm">
                          No items found.
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowAddItemModal(true)}
                          className={`${BTN_SECONDARY} mx-auto`}
                        >
                          <Plus className="w-4 h-4" aria-hidden="true" />
                          Add item
                        </button>
                      </div>
                    ) : (
                      <ul className="divide-y divide-slate-200">
                        {filteredItems.map((item) => (
                          <li key={item.item_id}>
                            <button
                              type="button"
                              onClick={() => handleAddItem(item)}
                              className="cursor-pointer w-full text-left p-3 hover:bg-slate-50 transition-colors duration-200 flex items-center gap-3"
                            >
                              <div className="w-10 h-10 bg-slate-100 rounded-lg border border-slate-200 shrink-0 flex items-center justify-center overflow-hidden">
                                {item.image?.url ? (
                                  <Image
                                    src={`/${item.image.url}`}
                                    alt=""
                                    width={40}
                                    height={40}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Package
                                    className="w-5 h-5 text-slate-400"
                                    aria-hidden="true"
                                  />
                                )}
                              </div>
                              {/* dimensions */}
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-800">
                                  {getItemDisplayName(item)}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {formatLabel(item.category) || "—"} • Stock:{" "}
                                  {formatQty(
                                    item.quantity,
                                    item.measurement_unit,
                                  )}{" "}
                                  • Dimensions:{" "}
                                  {item.sheet?.dimensions ||
                                    item.handle?.dimensions ||
                                    item.hardware?.dimensions ||
                                    item.edging_tape?.dimensions ||
                                    "—"}{" "}
                                  • Supplier ref: {getSupplierRef(item) || "—"}
                                </p>
                              </div>
                              <Plus
                                className="w-4 h-4 text-primary ml-auto shrink-0"
                                aria-hidden="true"
                              />
                              <span className="sr-only">Add to order</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Selected Items Table */}
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
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
                    {selectedItems.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-4 py-12 text-center">
                          <Package
                            className="w-8 h-8 mx-auto mb-2 text-slate-300"
                            aria-hidden="true"
                          />
                          <p className="text-sm text-slate-600">
                            No items selected. Search and add items above.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      selectedItems.map((item) => {
                        const itemName = getItemDisplayName(item);
                        const detailRows = getDetailRows(item);
                        const qtyInvalid =
                          submitted && hasInvalidQuantity(item);
                        return (
                          <tr
                            key={item.item_id}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            {/* Image Column */}
                            <td className="px-4 py-3">
                              <div className="w-10 h-10 bg-slate-100 rounded-lg border border-slate-200 shrink-0 flex items-center justify-center overflow-hidden">
                                {item.image?.url ? (
                                  <Image
                                    src={`/${item.image.url}`}
                                    alt={itemName}
                                    width={40}
                                    height={40}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Package
                                    className="w-5 h-5 text-slate-400"
                                    aria-hidden="true"
                                  />
                                )}
                              </div>
                            </td>

                            {/* Category Column */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              {item.category ? (
                                <span
                                  className={`${BADGE} ${BADGE_TONES.violet}`}
                                >
                                  {formatLabel(item.category)}
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
                                {detailRows.map(([label, value], index) => (
                                  <div key={`${label}-${index}`}>
                                    <span className="font-medium">
                                      {label}:
                                    </span>{" "}
                                    {dash(value)}
                                  </div>
                                ))}
                                {!item.sheet &&
                                  !item.handle &&
                                  !item.hardware &&
                                  !item.accessory &&
                                  !item.edging_tape && (
                                    <div>{dash(item.description)}</div>
                                  )}
                              </div>
                            </td>

                            {/* Stock Column */}
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-mono text-slate-700">
                              {formatQty(item.quantity, item.measurement_unit)}
                            </td>

                            {/* Quantity Column */}
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <input
                                id={`po-qty-${item.item_id}`}
                                type="number"
                                min="1"
                                value={item.order_quantity}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    item.item_id,
                                    "order_quantity",
                                    e.target.value,
                                  )
                                }
                                aria-label={`Quantity for ${itemName}`}
                                aria-invalid={qtyInvalid}
                                aria-describedby={
                                  errors.items ? "po-items-error" : undefined
                                }
                                className={cellInputClass(qtyInvalid)}
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
                                  value={item.order_unit_price}
                                  onChange={(e) =>
                                    handleUpdateItem(
                                      item.item_id,
                                      "order_unit_price",
                                      e.target.value,
                                    )
                                  }
                                  aria-label={`Unit price for ${itemName}, excluding GST`}
                                  className={cellInputClass(false)}
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
                                onClick={() => handleRemoveItem(item.item_id)}
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
                      })
                    )}
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
                            value={poDeliveryCharge}
                            onChange={(e) =>
                              setPoDeliveryCharge(e.target.value)
                            }
                            placeholder="0.00"
                            className={cellInputClass(false)}
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
              {errors.items && (
                <p id="po-items-error" className="text-xs text-red-600 mt-1">
                  {errors.items}
                </p>
              )}
            </div>

            <hr className="border-slate-200" />

            {/* File Upload & Notes */}
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
                        onClick={() => setShowInvoicePreview(true)}
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
                        onClick={() => {
                          setPoInvoiceFile(null);
                          setPoInvoicePreview(null);
                          setInvoiceError("");
                        }}
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

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
            <button
              type="button"
              onClick={closeModal}
              disabled={loading}
              className={BTN_SECONDARY}
            >
              Cancel
            </button>
            <button type="submit" disabled={loading} className={BTN_PRIMARY}>
              {loading ? (
                <span className={SPINNER} aria-hidden="true" />
              ) : (
                <FilePlus className="w-4 h-4" aria-hidden="true" />
              )}
              Create purchase order
            </button>
          </div>
        </form>
      </div>

      {/* Invoice Preview Modal */}
      {showInvoicePreview && poInvoiceFile && (
        <ViewMedia
          selectedFile={poInvoiceFile}
          setSelectedFile={() => {}}
          setViewFileModal={setShowInvoicePreview}
          setPageNumber={setPageNumber}
        />
      )}

      {/* Add Item Modal */}
      {showAddItemModal && selectedSupplier && (
        <AddItemModal
          setShowModal={setShowAddItemModal}
          supplierId={selectedSupplier.supplier_id}
          onItemAdded={() => {
            // Refresh supplier items after item is added
            if (selectedSupplier?.supplier_id) {
              fetchSupplierItems(selectedSupplier.supplier_id);
            }
          }}
        />
      )}
    </div>
  );
}
