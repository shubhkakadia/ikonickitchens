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
import AddItemModal from "@/app/admin/suppliers/purchaseorder/components/AddItemModal";
import CustomDropdown from "@/components/CustomDropdown";
import useModalFocus from "@/hooks/useModalFocus";
import {
  BADGE,
  BADGE_TONES,
  formatQty,
} from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";

// DESIGN.md 9.2 form field recipe. `hasError` flips the border/ring to red.
const INPUT_BASE =
  "w-full text-sm text-slate-800 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent";
const inputClass = (hasError, extra = "px-4 py-3") =>
  `${INPUT_BASE} ${extra} ${
    hasError
      ? "border-red-500 focus:ring-red-500"
      : "border-slate-300 focus:ring-primary"
  }`;
// Compact variant for the quantity field inside the line-item table.
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

const dash = (value) =>
  value === null || value === undefined || value === "" ? "—" : value;

const hasInvalidQuantity = (item) => !item.quantity || item.quantity <= 0;

// Enter in a dropdown's text field must not submit the whole form.
const blockEnterSubmit = (e) => {
  if (e.key === "Enter" && e.target?.getAttribute?.("role") === "combobox") {
    e.preventDefault();
  }
};

// Category options (values are the API's category slugs)
const categoryOptions = [
  { label: "Sheet", value: "sheet" },
  { label: "Edging tape", value: "edging_tape" },
  { label: "Handle", value: "handle" },
  { label: "Hardware", value: "hardware" },
  { label: "Accessory", value: "accessory" },
];

export default function CreateMaterialsToOrderModal({
  setShowModal,
  onSuccess,
}) {
  const { getToken, userData } = useAuth();

  // Data States
  const [allItems, setAllItems] = useState([]);
  const [itemSearch, setItemSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  // Form States
  const [mtoNotes, setMtoNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  // Validate on submit, then on change: errors only exist once a submit was attempted.
  const [submitted, setSubmitted] = useState(false);

  // File Upload States
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [fileError, setFileError] = useState("");

  // UI States
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showItemSearchResults, setShowItemSearchResults] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const searchRef = useRef(null);
  const fileInputRef = useRef(null);
  const panelRef = useRef(null);
  useModalFocus(panelRef, true);

  // Start on the first required field (the dropdown opens its list on focus).
  useEffect(() => {
    document.getElementById("mto-category")?.focus();
  }, []);

  // Fetch items when category is selected
  useEffect(() => {
    if (selectedCategory) {
      fetchItemsByCategory(selectedCategory);
    } else {
      setAllItems([]);
    }
  }, [selectedCategory]);

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

  const fetchItemsByCategory = async (category) => {
    try {
      setLoadingItems(true);
      setAllItems([]);
      setItemSearch("");
      const sessionToken = getToken();
      if (!sessionToken) return;

      const response = await axios.get(`/api/v1/item/all/${category}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.data.status) {
        setAllItems(response.data.data || []);
      } else {
        toast.error("Couldn't load items. Refresh and try again.");
        setAllItems([]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Couldn't load items. Check your connection and try again.");
      setAllItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  // Filter items based on search
  const filteredItems = allItems.filter((item) => {
    if (!itemSearch) return false;
    const searchLower = itemSearch.toLowerCase();

    // Check various fields
    const matchesCategory = item.category?.toLowerCase().includes(searchLower);
    const matchesDesc = item.description?.toLowerCase().includes(searchLower);
    const matchesSupplierRef =
      item.itemSuppliers?.some((is) =>
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
      toast.info("That item is already on the list.");
      return;
    }

    setSelectedItems((prev) => [
      ...prev,
      {
        ...item,
        item_id: item.item_id,
        stock_quantity: item.quantity, // Preserve original stock quantity
        quantity: 1, // Default order quantity
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

  // Returns an inline error message, or null once the file was accepted.
  const validateAndAddFile = (file) => {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (!allowedTypes.includes(file.type)) {
      return "Upload PDF, JPG or PNG files only.";
    }

    if (file.size > 10 * 1024 * 1024) {
      return "Each file must be smaller than 10 MB.";
    }

    setUploadedFiles((prev) => [...prev, file]);
    return null;
  };

  const addFiles = (files) => {
    let firstError = "";
    files.forEach((file) => {
      const message = validateAndAddFile(file);
      if (message && !firstError) firstError = message;
    });
    setFileError(firstError);
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

    addFiles(Array.from(e.dataTransfer.files || []));
  };

  const handleFileChange = (e) => {
    addFiles(Array.from(e.target.files || []));
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError("");
  };

  const handleViewFile = (file) => {
    setPreviewFile(file);
    setShowFilePreview(true);
  };

  const closeModal = () => setShowModal(false);

  // A form with typed or chosen input must not close on a stray backdrop click.
  const isDirty =
    !!selectedCategory ||
    selectedItems.length > 0 ||
    mtoNotes.trim() !== "" ||
    uploadedFiles.length > 0;

  // Modals close on Escape (DESIGN.md 9.4). The file viewer and the add-item
  // modal handle their own Escape; an open dropdown or result list closes first.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape" || loading) return;
      if (showFilePreview || showAddItemModal) return;
      if (e.target?.getAttribute?.("aria-expanded") === "true") return;
      if (showItemSearchResults && itemSearch && selectedCategory) {
        setShowItemSearchResults(false);
        return;
      }
      closeModal();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [
    loading,
    showFilePreview,
    showAddItemModal,
    showItemSearchResults,
    itemSearch,
    selectedCategory,
  ]);

  const validate = () => {
    const errs = {};
    if (selectedItems.length === 0) {
      errs.items = selectedCategory
        ? "Add at least one item."
        : "Select a category, then add at least one item.";
    } else if (selectedItems.some(hasInvalidQuantity)) {
      errs.items = "Every item needs a quantity greater than 0.";
    }
    return errs;
  };

  const errors = submitted ? validate() : {};

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);

    const currentErrors = validate();
    if (currentErrors.items) {
      let targetId = selectedCategory ? "mto-item-search" : "mto-category";
      const badItem = selectedItems.find(hasInvalidQuantity);
      if (badItem) targetId = `mto-qty-${badItem.item_id}`;
      document.getElementById(targetId)?.focus();
      return;
    }

    handleCreateMTO();
  };

  const handleCreateMTO = async () => {
    setLoading(true);
    try {
      const sessionToken = getToken();
      if (!sessionToken) throw new Error("No session token");

      // First create the MTO
      const requestData = {
        notes: mtoNotes || null,
        createdBy_id: userData?.user?.id || null,
        items: selectedItems.map((item) => ({
          item_id: item.item_id,
          quantity: parseInt(item.quantity),
          notes: "",
        })),
        lot_ids: [], // Can be empty for now
      };

      const response = await axios.post(
        "/api/v1/materials_to_order/create",
        requestData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status) {
        const mtoId = response.data.data.id;

        // Upload files if any
        if (uploadedFiles.length > 0) {
          const formData = new FormData();
          uploadedFiles.forEach((file) => {
            formData.append("files", file);
          });

          await axios.post(
            `/api/v1/uploads/materials-to-order/${mtoId}`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${sessionToken}`,
                "Content-Type": "multipart/form-data",
              },
            },
          );
        }

        toast.success("Materials to order created.");
        if (onSuccess) onSuccess();
        setShowModal(false);
      } else {
        toast.error(
          response.data.message ||
            "Couldn't create materials to order. Check the details and try again.",
        );
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.message ||
          "Couldn't create materials to order. Check your connection and try again.",
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
    else if (item.hardware) parts = [item.hardware.brand, item.hardware.name];
    else if (item.accessory) parts = [item.accessory.name];
    else if (item.edging_tape)
      parts = [item.edging_tape.brand, item.edging_tape.color];
    else return item.description || "Item";
    return parts.filter(Boolean).join(" ") || "Item";
  };

  // Every supplier's reference, or the item's own reference when it has none.
  const getSupplierRefs = (item) =>
    item.itemSuppliers?.length > 0
      ? item.itemSuppliers
          .map(
            (is) =>
              `${is.supplier?.name || "Unknown"}: ${is.supplier_reference || "—"}`,
          )
          .join(", ")
      : item.supplier_reference;

  // Category-specific detail rows shown under "Details".
  const getDetailRows = (item) => {
    const rows = [];
    const refs = getSupplierRefs(item);
    if (refs) rows.push(["Supplier ref", refs]);
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
        aria-labelledby="create-mto-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2
            id="create-mto-title"
            className="text-lg font-semibold text-slate-800"
          >
            Create materials to order
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

              {/* Category Dropdown and Search Bar */}
              <div className="mb-4 flex flex-col md:flex-row gap-4">
                {/* Category Dropdown */}
                <div className="md:w-56 shrink-0" onKeyDown={blockEnterSubmit}>
                  <label htmlFor="mto-category" className={LABEL}>
                    Category{" "}
                    <span className="text-red-600" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <CustomDropdown
                    id="mto-category"
                    options={categoryOptions}
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                    placeholder="Select a category"
                    invalid={!!errors.items && !selectedCategory}
                    describedBy={
                      errors.items && !selectedCategory
                        ? "mto-items-error"
                        : undefined
                    }
                  />
                </div>

                {/* Search Bar */}
                <div className="relative flex-1" ref={searchRef}>
                  <label htmlFor="mto-item-search" className={LABEL}>
                    Search items
                  </label>
                  <div className="relative">
                    <Search
                      className="absolute inset-y-0 left-3 my-auto w-4 h-4 text-slate-500"
                      aria-hidden="true"
                    />
                    <input
                      id="mto-item-search"
                      type="text"
                      placeholder={
                        selectedCategory
                          ? "Search items by name, category or brand"
                          : "Select a category to search items"
                      }
                      value={itemSearch}
                      onChange={(e) => {
                        setItemSearch(e.target.value);
                        setShowItemSearchResults(true);
                      }}
                      onFocus={() => {
                        if (selectedCategory) {
                          setShowItemSearchResults(true);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.preventDefault();
                      }}
                      disabled={!selectedCategory}
                      className={`${inputClass(
                        false,
                        "py-3 pr-4 pl-10",
                      )} disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed`}
                    />
                  </div>

                  {/* Search Results Dropdown */}
                  {showItemSearchResults && itemSearch && selectedCategory && (
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
                                    • Supplier ref:{" "}
                                    {getSupplierRefs(item) || "—"}
                                  </p>
                                </div>
                                <Plus
                                  className="w-4 h-4 text-primary ml-auto shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="sr-only">Add to list</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Items Table */}
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className={`${TH} text-left`}>Image</th>
                      <th className={`${TH} text-left`}>Category</th>
                      <th className={`${TH} text-left`}>Details</th>
                      <th className={`${TH} text-right`}>In stock</th>
                      <th className={`${TH} text-right`}>Quantity</th>
                      <th className={`${TH} text-right`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedItems.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-4 py-12 text-center">
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

                            {/* In Stock Column */}
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-mono text-slate-700">
                              {formatQty(
                                item.stock_quantity ?? item.quantity,
                                item.measurement_unit,
                              )}
                            </td>

                            {/* Quantity Column */}
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <input
                                id={`mto-qty-${item.item_id}`}
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    item.item_id,
                                    "quantity",
                                    e.target.value,
                                  )
                                }
                                aria-label={`Quantity for ${itemName}`}
                                aria-invalid={qtyInvalid}
                                aria-describedby={
                                  errors.items ? "mto-items-error" : undefined
                                }
                                className={cellInputClass(qtyInvalid)}
                              />
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
                </table>
              </div>
              {errors.items && (
                <p id="mto-items-error" className="text-xs text-red-600 mt-1">
                  {errors.items}
                </p>
              )}
            </div>

            <hr className="border-slate-200" />

            {/* File Upload & Notes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* File Upload */}
              <div>
                <span id="mto-files-label" className={LABEL}>
                  Upload files
                </span>
                {/* Always rendered so "Add more files" can open it; visually hidden but keyboard-reachable. */}
                <input
                  type="file"
                  id="mto-files-upload"
                  ref={fileInputRef}
                  accept="application/pdf,image/jpeg,image/jpg,image/png"
                  onChange={handleFileChange}
                  multiple
                  tabIndex={uploadedFiles.length === 0 ? 0 : -1}
                  aria-labelledby="mto-files-label"
                  aria-invalid={!!fileError}
                  aria-describedby={fileError ? "mto-files-error" : undefined}
                  className="peer sr-only"
                />
                {uploadedFiles.length === 0 ? (
                  <label
                    htmlFor="mto-files-upload"
                    className={`cursor-pointer flex flex-col items-center text-center w-full border-2 border-dashed rounded-lg py-8 transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${
                      fileError
                        ? "border-red-500"
                        : isDragging
                          ? "border-primary bg-primary/10"
                          : "border-slate-300 hover:border-primary hover:bg-slate-50"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
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
                        ? "Drop files here"
                        : "Click to upload or drag and drop"}
                    </span>
                    <span className="text-xs text-slate-500 mt-1">
                      PDF, JPG or PNG, up to 10 MB each
                    </span>
                  </label>
                ) : (
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="border border-slate-200 rounded-lg p-3 flex items-center justify-between bg-slate-50"
                      >
                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                          {file.type.startsWith("image/") ? (
                            <img
                              src={URL.createObjectURL(file)}
                              alt=""
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
                          <div className="min-w-0 flex-1">
                            <p
                              className="text-sm font-medium text-slate-800 truncate"
                              title={file.name}
                            >
                              {file.name}
                            </p>
                            <p className="text-xs font-mono text-slate-500">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewFile(file)}
                            className={BTN_ICON}
                            aria-label={`Preview ${file.name}`}
                            title="Preview file"
                          >
                            <Eye
                              className="w-4 h-4 text-slate-600"
                              aria-hidden="true"
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(index)}
                            className="cursor-pointer p-1.5 text-red-600 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                            aria-label={`Remove ${file.name}`}
                            title="Remove file"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className={`${BTN_SECONDARY} w-full justify-center mt-2`}
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      Add more files
                    </button>
                  </div>
                )}
                {fileError && (
                  <p id="mto-files-error" className="text-xs text-red-600 mt-1">
                    {fileError}
                  </p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="mto-notes" className={LABEL}>
                  Notes
                </label>
                <textarea
                  id="mto-notes"
                  rows={5}
                  value={mtoNotes}
                  onChange={(e) => setMtoNotes(e.target.value)}
                  className={`${inputClass(false)} resize-none`}
                  placeholder="e.g. Needed on site by Friday"
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
              Create materials to order
            </button>
          </div>
        </form>
      </div>

      {/* File Preview Modal */}
      {showFilePreview && previewFile && (
        <ViewMedia
          selectedFile={previewFile}
          setSelectedFile={() => {}}
          setViewFileModal={setShowFilePreview}
          setPageNumber={setPageNumber}
        />
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <AddItemModal
          setShowModal={setShowAddItemModal}
          supplierId="" // Materials to Order doesn't require a supplier
          onItemAdded={() => {
            // Refresh items for the selected category after item is added
            if (selectedCategory) {
              fetchItemsByCategory(selectedCategory);
            }
          }}
        />
      )}
    </div>
  );
}
