"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Edit,
  ExternalLink,
  MoreVertical,
  Package,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import TabsController from "@/components/tabscontroller";
import Image from "next/image";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import CustomDropdown from "@/components/CustomDropdown";
import PaginationFooter from "@/components/PaginationFooter";
import AdminShell from "@/components/AdminShell";
import { useUploadProgress } from "@/hooks/useUploadProgress";
import useModalFocus from "@/hooks/useModalFocus";
import {
  BADGE,
  BADGE_TONES,
  formatQty,
} from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";

import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import { v4 as uuidv4 } from "uuid";

const EMPTY = "—";
const SESSION_ERROR = "Your session has expired. Sign in again to continue.";
const LOAD_ERROR =
  "Couldn't load this item. Check your connection and try again.";
const STOCK_TX_PER_PAGE = 10;

// DESIGN.md 9.2 form field recipe. `hasError` flips the border/ring to red.
const INPUT_BASE =
  "w-full text-sm text-slate-800 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-colors duration-200";
const inputClass = (hasError, extra = "px-4 py-3") =>
  `${INPUT_BASE} ${extra} ${
    hasError
      ? "border-red-500 focus:ring-red-500"
      : "border-slate-300 focus:ring-primary"
  }`;

const LABEL = "block text-sm font-medium text-slate-700 mb-1.5";
const CHECKBOX =
  "h-4 w-4 accent-primary border-slate-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer";

// DESIGN.md 9.1 button recipes. Only one primary button per view or modal.
const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY_COMPACT =
  "cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_ICON =
  "cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const MENU_ITEM =
  "cursor-pointer w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 transition-colors flex items-center gap-2";
const TH =
  "px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider";
const SPINNER =
  "w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin";

// Currency is AUD and prices carry cents, so this stays local rather than
// using the whole-dollar shared formatCurrency (DESIGN.md 15.7).
const PRICE = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

const DATE_TIME = new Intl.DateTimeFormat("en-AU", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Stock movements are categories of direction: added is green, wasted is red,
// used is neutral. The label text always carries the meaning.
const TX_TONES = {
  ADDED: BADGE_TONES.success,
  USED: BADGE_TONES.neutral,
  WASTED: BADGE_TONES.danger,
};

// Enter in a combobox's text field must not submit the whole edit form.
const blockEnterSubmit = (e) => {
  if (e.key === "Enter" && e.target?.getAttribute?.("role") === "combobox") {
    e.preventDefault();
  }
};

const faceOptions = ["single side", "double side"];

// Plain text inputs per category. A string entry is a combobox field
// (brand, finish, face, sub_category) rendered by renderCombo below.
const textField = (name, label, placeholder, mono = false) => ({
  name,
  label,
  placeholder,
  mono,
});
const CATEGORY_FIELDS = {
  sheet: [
    "brand",
    textField("color", "Colour", "e.g. Natural oak"),
    "finish",
    "face",
    textField("dimensions", "Dimensions", "e.g. 2400 x 1200 x 18 mm", true),
  ],
  handle: [
    "brand",
    textField("color", "Colour", "e.g. Brushed nickel"),
    textField("type", "Type", "e.g. Bar handle"),
    textField("material", "Material", "e.g. Aluminium"),
    textField("dimensions", "Dimensions", "e.g. 160 mm", true),
  ],
  hardware: [
    "sub_category",
    textField("brand", "Brand", "e.g. Blum"),
    textField("name", "Name", "e.g. Soft-close hinge"),
    textField("type", "Type", "e.g. Concealed"),
    textField("dimensions", "Dimensions", "e.g. 35 mm", true),
  ],
  accessory: [textField("name", "Item name", "e.g. Marker pen")],
  edging_tape: [
    "brand",
    textField("color", "Colour", "e.g. Natural oak"),
    "finish",
    textField("dimensions", "Dimensions", "e.g. 22 x 1 mm", true),
  ],
};

// On-screen labels for the combobox fields (the keys are the API field names).
const COMBO_LABELS = {
  brand: "Brand",
  finish: "Finish",
  face: "Face",
  sub_category: "Sub-category",
};

// The config lists behind the creatable comboboxes. `category` is the config
// API category (hardware sub-categories live under "hardware"); `field` is the
// form field the new value is selected into.
const CONFIG_KINDS = {
  finish: {
    category: "finish",
    field: "finish",
    comboId: "item-finish",
    title: "Create new finish",
    label: "Finish name",
    placeholder: "e.g. Matt",
    required: "Enter a finish name.",
    submit: "Create finish",
    created: "Finish created.",
    failed: "Couldn't create the finish. Check your connection and try again.",
  },
  brand: {
    category: "brand",
    field: "brand",
    comboId: "item-brand",
    title: "Create new brand",
    label: "Brand name",
    placeholder: "e.g. Polytec",
    required: "Enter a brand name.",
    submit: "Create brand",
    created: "Brand created.",
    failed: "Couldn't create the brand. Check your connection and try again.",
  },
  measuring_unit: {
    category: "measuring_unit",
    field: "measurement_unit",
    comboId: "item-measurement-unit",
    title: "Create new measuring unit",
    label: "Measuring unit name",
    placeholder: "e.g. each",
    required: "Enter a measuring unit name.",
    submit: "Create measuring unit",
    created: "Measuring unit created.",
    failed:
      "Couldn't create the measuring unit. Check your connection and try again.",
  },
  sub_category: {
    category: "hardware",
    field: "sub_category",
    comboId: "item-sub-category",
    title: "Create new hardware sub-category",
    label: "Sub-category name",
    placeholder: "e.g. Hinges",
    required: "Enter a sub-category name.",
    submit: "Create sub-category",
    created: "Hardware sub-category created.",
    failed:
      "Couldn't create the sub-category. Check your connection and try again.",
  },
};

// Config values (finishes, brands, measuring units, sub-categories) live
// behind one API.
const readConfigValues = async (sessionToken, category) => {
  const response = await axios.request({
    method: "post",
    maxBodyLength: Infinity,
    url: `/api/v1/config/read_all_by_category`,
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
    },
    data: { category },
  });
  if (response.data.status && response.data.data) {
    // Extract the value field from each config item
    return response.data.data.map((entry) => entry.value);
  }
  return null;
};

const createConfigValue = (sessionToken, category, value) =>
  axios.request({
    method: "post",
    maxBodyLength: Infinity,
    url: `/api/v1/config/create`,
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
    },
    data: { category, value },
  });

const formatValue = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "null"
  ) {
    return EMPTY;
  }
  if (typeof value === "string" && value.trim() === "") {
    return EMPTY;
  }
  return value;
};

const emptySupplierRow = () => ({
  id: uuidv4(),
  supplier_id: "",
  supplier_reference: "",
  supplier_product_link: "",
  price: "",
});

// Form rows for the item's suppliers, each with a temporary id.
const buildSupplierRows = (data) =>
  data?.itemSuppliers && data.itemSuppliers.length > 0
    ? data.itemSuppliers.map((is) => ({
        id: uuidv4(),
        supplier_id: is.supplier_id,
        supplier_reference: is.supplier_reference || "",
        supplier_product_link: is.supplier_product_link || "",
        price: is.price || "",
      }))
    : [emptySupplierRow()];

// Stock level as coloured text plus a label, so colour is never the only
// signal (DESIGN.md 13.4). Same thresholds as the inventory list.
function StockLevel({ stock, unit }) {
  const tone =
    stock <= 0
      ? "text-red-700"
      : stock < 10
        ? "text-amber-700"
        : "text-green-700";
  const label = stock <= 0 ? "Out of stock" : stock < 10 ? "Low stock" : null;
  return (
    <div>
      <div className={`text-2xl font-mono font-semibold ${tone}`}>
        {formatQty(stock, unit)}
      </div>
      {label && <div className="text-xs text-slate-500">{label}</div>}
    </div>
  );
}

// Labelled text input with inline error (DESIGN.md 9.2, 15.3).
function TextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  mono = false,
  prefix,
  step,
  error,
}) {
  const errorId = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span
            className="absolute inset-y-0 left-4 flex items-center text-sm text-slate-500"
            aria-hidden="true"
          >
            {prefix}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          step={step}
          placeholder={placeholder}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${inputClass(!!error, prefix ? "pl-8 pr-4 py-3" : "px-4 py-3")} ${
            mono ? "font-mono" : ""
          }`}
        />
      </div>
      {error && (
        <p id={errorId} className="text-xs text-red-600 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

// Free-text combobox: the user can pick a suggestion or type their own value,
// and (when onCreate is given) save a typed value as a new option.
function FreeformCombobox({
  id,
  label,
  noun,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  loading = false,
  loadingText = "Loading...",
  emptyText = "No matching options found",
  onCreate,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const listId = `${id}-list`;

  useEffect(() => {
    const onMouseDown = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const filtered = options.filter((option) =>
    option.toLowerCase().includes(value.toLowerCase()),
  );
  const typed = value.trim();
  const canCreate =
    !!onCreate &&
    typed !== "" &&
    !filtered.some((option) => option.toLowerCase() === typed.toLowerCase());
  const isOpen = open && !disabled;

  return (
    <div className="relative" ref={containerRef}>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onClick={() => !disabled && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setOpen(false);
            } else if (e.key === "Escape") {
              setOpen(false);
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            }
          }}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls={isOpen && filtered.length > 0 ? listId : undefined}
          autoComplete="off"
          className={`${inputClass(false, "px-4 py-3 pr-10")} disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed`}
        />
        <button
          type="button"
          onClick={() => setOpen((previous) => !previous)}
          disabled={disabled}
          tabIndex={-1}
          aria-label={isOpen ? `Close ${noun} options` : `Open ${noun} options`}
          className="cursor-pointer absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700 transition-colors duration-200 disabled:cursor-not-allowed"
        >
          {isOpen ? (
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-40 w-full mt-1 bg-white border border-slate-300 rounded-lg max-h-60 overflow-auto">
          {loading ? (
            <div className="px-4 py-3 text-sm text-slate-500 text-center">
              {loadingText}
            </div>
          ) : (
            <>
              {filtered.length > 0 ? (
                <div role="listbox" id={listId} aria-label={label}>
                  {filtered.map((option, index) => (
                    <button
                      key={index}
                      type="button"
                      role="option"
                      aria-selected={option === value}
                      onClick={() => {
                        onChange(option);
                        setOpen(false);
                      }}
                      className="cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-800 hover:bg-slate-100 transition-colors duration-200"
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-3 text-sm text-slate-500 text-center">
                  {emptyText}
                </div>
              )}
              {canCreate && (
                <div className="border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onCreate(value);
                    }}
                    className="cursor-pointer w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary hover:bg-slate-100 transition-colors duration-200"
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Create &quot;{typed}&quot;
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Small modal used to save a new finish / brand / measuring unit /
// sub-category to the config list.
function ConfigValueModal({
  idPrefix,
  title,
  label,
  placeholder,
  requiredMessage,
  initialValue,
  saving,
  submitLabel,
  onSubmit,
  onClose,
  returnFocusId,
}) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");
  const panelRef = useRef(null);
  useModalFocus(panelRef, true);

  // The "Create" row that opened this modal unmounts with the list, so hand
  // focus back to the field itself when the modal goes away.
  useEffect(
    () => () => {
      document.getElementById(returnFocusId)?.focus({ preventScroll: true });
    },
    [returnFocusId],
  );

  // Modals close on Escape (DESIGN.md 9.4); not while saving.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape" || saving) return;
      onClose();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [saving, onClose]);

  const inputId = `${idPrefix}-input`;
  const errorId = `${idPrefix}-error`;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (saving) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setError(requiredMessage);
      document.getElementById(inputId)?.focus();
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
      onClick={(e) => {
        e.stopPropagation();
        if (!saving && value === initialValue) onClose();
      }}
    >
      <div
        ref={panelRef}
        className="bg-white w-full max-w-lg rounded-xl border border-slate-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${idPrefix}-title`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2
            id={`${idPrefix}-title`}
            className="text-lg font-semibold text-slate-800"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="flex-1 overflow-y-auto p-6">
            <label htmlFor={inputId} className={LABEL}>
              {label}{" "}
              <span className="text-red-600" aria-hidden="true">
                *
              </span>
            </label>
            <input
              id={inputId}
              data-autofocus
              type="text"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError("");
              }}
              placeholder={placeholder}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? errorId : undefined}
              className={inputClass(!!error, "px-3 py-2")}
            />
            {error && (
              <p id={errorId} className="text-xs text-red-600 mt-1">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={BTN_SECONDARY}
            >
              Cancel
            </button>
            <button type="submit" disabled={saving} className={BTN_PRIMARY}>
              {saving ? (
                <span className={SPINNER} aria-hidden="true" />
              ) : (
                <Plus className="w-4 h-4" aria-hidden="true" />
              )}
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function InventoryItemDetailPage() {
  const { id } = useParams();
  const { getToken } = useAuth();
  const {
    showProgressToast,
    completeUpload,
    dismissProgressToast,
    getUploadProgressHandler,
  } = useUploadProgress();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [item, setItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  // Validate on submit, then on change: errors only exist once a save was tried.
  const [submitted, setSubmitted] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewFileModal, setViewFileModal] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [formData, setFormData] = useState({});
  const [newImage, setNewImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [deleteImage, setDeleteImage] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [configOptions, setConfigOptions] = useState({
    finish: [],
    brand: [],
    measuring_unit: [],
    sub_category: [],
  });
  const [loadingConfig, setLoadingConfig] = useState(false);
  // { kind, seed } while the "create new ..." modal is open
  const [configModal, setConfigModal] = useState(null);
  const [isCreatingConfig, setIsCreatingConfig] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  const [stockTxCurrentPage, setStockTxCurrentPage] = useState(1);
  const [suppliers, setSuppliers] = useState([]);
  // Multi-supplier support - array of supplier rows for this item
  const [itemSuppliers, setItemSuppliers] = useState([]);
  const dropdownRef = useRef(null);
  const fileInputRef = useRef(null);

  const sortedStockTransactions = useMemo(() => {
    const transactions = item?.stock_transactions ?? [];
    return [...transactions].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    );
  }, [item?.stock_transactions]);

  const stockTxTotalPages = Math.ceil(
    sortedStockTransactions.length / STOCK_TX_PER_PAGE,
  );
  const stockTxStartIndex = (stockTxCurrentPage - 1) * STOCK_TX_PER_PAGE;
  const currentStockTransactions = sortedStockTransactions.slice(
    stockTxStartIndex,
    stockTxStartIndex + STOCK_TX_PER_PAGE,
  );

  // Fetch the config lists behind the creatable comboboxes. Brands are shared
  // by sheets, handles, and edging tape.
  useEffect(() => {
    const fetchConfigOptions = async () => {
      const sessionToken = getToken();
      if (!sessionToken) {
        console.error("No valid session found");
        return;
      }
      setLoadingConfig(true);
      await Promise.all(
        Object.entries(CONFIG_KINDS).map(async ([kind, config]) => {
          try {
            const values = await readConfigValues(
              sessionToken,
              config.category,
            );
            if (values) {
              setConfigOptions((prev) => ({ ...prev, [kind]: values }));
            }
          } catch (err) {
            console.error(`Error fetching ${kind} options:`, err);
            // Fallback to empty array if API fails
            setConfigOptions((prev) => ({ ...prev, [kind]: [] }));
          }
        }),
      );
      setLoadingConfig(false);
    };

    fetchConfigOptions();
  }, [getToken]);

  useEffect(() => {
    fetchItem();
    fetchSuppliers();
  }, [id]);

  useEffect(() => {
    setStockTxCurrentPage(1);
  }, [id]);

  useEffect(() => {
    if (stockTxTotalPages > 0 && stockTxCurrentPage > stockTxTotalPages) {
      setStockTxCurrentPage(stockTxTotalPages);
    }
  }, [stockTxCurrentPage, stockTxTotalPages]);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Close the actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showDropdown &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  // The actions menu closes on Escape (DESIGN.md 9.4, 13). The delete
  // confirmation is destructive and needs an explicit button.
  useEffect(() => {
    if (!showDropdown) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setShowDropdown(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showDropdown]);

  const fetchItem = async () => {
    try {
      setLoading(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR);
        return;
      }
      const response = await axios.get(`/api/v1/item/${id}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (response.data.status) {
        setItem(response.data.data);
        // Load multi-supplier data
        setItemSuppliers(buildSupplierRows(response.data.data));
      } else {
        setError(response.data.message || LOAD_ERROR);
      }
    } catch (err) {
      console.error("API Error:", err);
      console.error("Error Response:", err.response?.data);
      setError(err.response?.data?.message || LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        return;
      }
      const response = await axios.get(`/api/v1/supplier/all`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (response.data.status) {
        setSuppliers(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching suppliers:", err);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const openConfigModal = (kind, seed) => {
    setConfigModal({ kind, seed: seed.trim() });
  };

  // Handle create new finish / brand / measuring unit / sub-category
  const handleCreateConfig = async (value) => {
    if (!configModal) return;
    const { kind } = configModal;
    const config = CONFIG_KINDS[kind];
    try {
      setIsCreatingConfig(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR);
        return;
      }

      const response = await createConfigValue(
        sessionToken,
        config.category,
        value,
      );
      if (!response.data.status) {
        toast.error(response.data.message || config.failed);
        return;
      }

      toast.success(config.created);
      if (kind === "brand") {
        setConfigOptions((prev) => ({
          ...prev,
          brand: [...prev.brand, value],
        }));
      } else {
        // Refresh the list
        try {
          const values = await readConfigValues(sessionToken, config.category);
          if (values) {
            setConfigOptions((prev) => ({ ...prev, [kind]: values }));
          }
        } catch (err) {
          console.error(`Error fetching ${kind} options:`, err);
        }
      }
      // Set the new value as selected
      handleInputChange(config.field, value);
      setConfigModal(null);
    } catch (err) {
      console.error(`Error creating ${kind}:`, err);
      toast.error(err.response?.data?.message || config.failed);
    } finally {
      setIsCreatingConfig(false);
    }
  };

  // Multi-supplier helper functions
  const handleAddSupplier = () => {
    setItemSuppliers((rows) => [...rows, emptySupplierRow()]);
  };

  const handleRemoveSupplier = (rowId) => {
    // Keep at least one supplier
    if (itemSuppliers.length === 1) return;
    setItemSuppliers(itemSuppliers.filter((s) => s.id !== rowId));
  };

  const handleSupplierFieldChange = (rowId, field, value) => {
    setItemSuppliers((rows) =>
      rows.map((s) => (s.id === rowId ? { ...s, [field]: value } : s)),
    );
  };

  // Initialize edit form with current item data
  const handleEdit = () => {
    if (!item) return;
    const category = item.category.toLowerCase();
    const details = item[category];

    const editFormData = {
      description: item.description || "",
      measurement_unit: item.measurement_unit || "",
    };

    // Add category-specific fields based on category
    if (details) {
      (CATEGORY_FIELDS[category] || []).forEach((field) => {
        const name = typeof field === "string" ? field : field.name;
        editFormData[name] = details[name] || "";
      });
      if (category === "sheet") {
        // Map "1" to "single side" for backward compatibility
        editFormData.face =
          details.face === "1" ? "single side" : details.face || "";
        editFormData.is_sunmica = details.is_sunmica || false;
      }
    }

    setFormData(editFormData);
    setItemSuppliers(buildSupplierRows(item));
    setSubmitted(false);
    setIsEditing(true);
  };

  // Same rules the browser applies to number and url inputs: price in cents,
  // absolute URL.
  const validate = () => {
    const errs = {};
    itemSuppliers.forEach((row) => {
      const rowErrors = {};
      if (row.price !== "" && row.price !== null && row.price !== undefined) {
        const cents = Number(row.price) * 100;
        if (
          !Number.isFinite(cents) ||
          Math.abs(cents - Math.round(cents)) > 1e-6
        ) {
          rowErrors.price =
            "Enter an amount with up to 2 decimal places, e.g. 49.95.";
        }
      }
      const link = String(row.supplier_product_link || "").trim();
      if (link !== "") {
        try {
          new URL(link);
        } catch {
          rowErrors.link =
            "Enter a full web address, e.g. https://supplier.com/product/123.";
        }
      }
      if (rowErrors.price || rowErrors.link) errs[row.id] = rowErrors;
    });
    return errs;
  };

  const errors = submitted ? validate() : {};

  const handleSave = async () => {
    if (isUpdating) return;
    setSubmitted(true);

    const currentErrors = validate();
    const invalidRow = itemSuppliers.find((row) => currentErrors[row.id]);
    if (invalidRow) {
      const rowErrors = currentErrors[invalidRow.id];
      document
        .getElementById(
          rowErrors.price
            ? `item-price-${invalidRow.id}`
            : `item-link-${invalidRow.id}`,
        )
        ?.focus();
      return;
    }

    try {
      setIsUpdating(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error(SESSION_ERROR);
        return;
      }

      // Convert object to FormData for API
      const formDataToSend = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        // Convert boolean to string for FormData
        if (typeof value === "boolean") {
          formDataToSend.append(key, value.toString());
        } else if (value !== null && value !== undefined) {
          formDataToSend.append(key, value);
        }
      });

      // Add suppliers array as JSON for multi-supplier support
      const suppliersData = itemSuppliers
        .filter((s) => s.supplier_id) // Only include suppliers with ID selected
        .map(({ id: _rowId, ...rest }) => rest); // Remove temp fields

      if (suppliersData.length > 0) {
        formDataToSend.append("suppliers", JSON.stringify(suppliersData));
      }

      // Add new image if selected
      if (newImage) {
        formDataToSend.append("image", newImage);
      } else if (deleteImage) {
        // Send empty string to delete the image
        formDataToSend.append("image", "");
      }

      // Show progress toast only if there's a new image file
      if (newImage) {
        showProgressToast(1);
      }

      const response = await axios.patch(`/api/v1/item/${id}`, formDataToSend, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "multipart/form-data",
        },
        ...(newImage && {
          onUploadProgress: getUploadProgressHandler(1),
        }),
      });

      if (response.data.status) {
        setItem(response.data.data);
        if (newImage) {
          completeUpload(1);
        } else {
          toast.success("Item updated.");
        }
        setIsEditing(false);
        setSubmitted(false);
        setNewImage(null);
        setImagePreview(null);
        setDeleteImage(false);
        setImageFailed(false);
      } else {
        if (newImage) {
          dismissProgressToast();
        }
        toast.error(
          response.data.message ||
            "Couldn't save the item. Check the details and try again.",
        );
      }
    } catch (err) {
      console.error("Error updating item:", err);
      if (newImage) {
        dismissProgressToast();
      }
      toast.error(
        err.response?.data?.message ||
          "Couldn't save the item. Check your connection and try again.",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSubmitted(false);
    setFormData({});
    setNewImage(null);
    setImagePreview(null);
    setDeleteImage(false);
    // Discard any supplier edits
    setItemSuppliers(buildSupplierRows(item));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewImage(file);
      setDeleteImage(false); // Reset delete flag when new image is selected
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
    // Let the same file be chosen again after removing it.
    e.target.value = "";
  };

  const handleDeleteImage = () => {
    setDeleteImage(true);
    setNewImage(null);
    setImagePreview(null);
  };

  const handleDeleteConfirm = async () => {
    try {
      setIsDeleting(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR);
        return;
      }

      const response = await axios.delete(`/api/v1/item/${id}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        toast.success("Item deleted.");
        setShowDeleteModal(false);
        // Navigate back to inventory list
        window.location.href = "/admin/inventory";
      } else {
        toast.error(
          response.data.message || "Couldn't delete the item. Try again.",
        );
      }
    } catch (err) {
      console.error("Error deleting item:", err);
      toast.error(
        err.response?.data?.message ||
          "Couldn't delete the item. Check your connection and try again.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleNotes = (transactionId) => {
    setExpandedNotes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  const getItemTitle = () => {
    if (!item) return "";
    const category = item.category.toLowerCase();
    if (category === "sheet" && item.sheet) {
      return [item.sheet.brand, item.sheet.color, item.sheet.finish]
        .filter(Boolean)
        .join(" ");
    } else if (category === "handle" && item.handle) {
      return [item.handle.brand, item.handle.color, item.handle.type]
        .filter(Boolean)
        .join(" ");
    } else if (category === "hardware" && item.hardware) {
      return [item.hardware.brand, item.hardware.name, item.hardware.type]
        .filter(Boolean)
        .join(" ");
    } else if (category === "accessory" && item.accessory) {
      return item.accessory.name || "";
    } else if (category === "edging_tape" && item.edging_tape) {
      return [
        item.edging_tape.brand,
        item.edging_tape.color,
        item.edging_tape.finish,
      ]
        .filter(Boolean)
        .join(" ");
    }
    return "";
  };

  // If is_sunmica is checked, face is set to "single side" and disabled.
  const handleSunmicaChange = (e) => {
    const checked = e.target.checked;
    handleInputChange("is_sunmica", checked);
    if (checked) {
      handleInputChange("face", "single side");
    } else if (
      formData.face === "single side" ||
      item.sheet?.face === "single side" ||
      formData.face === "1" ||
      item.sheet?.face === "1"
    ) {
      // If is_sunmica is unchecked and face was "single side" or "1", clear it
      handleInputChange("face", "");
    }
  };

  const renderCombo = (key) => {
    const configKind = CONFIG_KINDS[key];
    if (key === "face") {
      return (
        <FreeformCombobox
          key={key}
          id="item-face"
          label={COMBO_LABELS.face}
          noun="face"
          value={formData.face || ""}
          onChange={(value) => handleInputChange("face", value)}
          options={faceOptions}
          placeholder="e.g. single side"
          disabled={!!formData.is_sunmica}
        />
      );
    }
    return (
      <FreeformCombobox
        key={key}
        id={configKind.comboId}
        label={COMBO_LABELS[key]}
        noun={COMBO_LABELS[key].toLowerCase()}
        value={formData[key] || ""}
        onChange={(value) => handleInputChange(key, value)}
        options={configOptions[key]}
        placeholder={configKind.placeholder}
        loading={loadingConfig}
        loadingText={`Loading ${COMBO_LABELS[key].toLowerCase()} options...`}
        emptyText={`No matching ${COMBO_LABELS[key].toLowerCase()} options found`}
        onCreate={(seed) => openConfigModal(key, seed)}
      />
    );
  };

  const category = item?.category?.toLowerCase();
  const categoryDetails = item && category ? item[category] : null;
  const itemTitle = getItemTitle() || item?.item_id || "";
  // "Edging Tape" as a badge label, "Edging tape" at the start of a heading.
  const categoryLabel = item ? formatLabel(item.category) : "";
  const categoryHeading =
    categoryLabel.charAt(0) + categoryLabel.slice(1).toLowerCase();
  const categoryFields = CATEGORY_FIELDS[category] || [];

  const getFieldLabel = (field) =>
    typeof field === "string" ? COMBO_LABELS[field] : field.label;
  const getFieldName = (field) =>
    typeof field === "string" ? field : field.name;

  // The existing image or a newly chosen one, as the viewer should open it.
  const openImageViewer = () => {
    if (imagePreview) {
      // New image preview
      setSelectedFile({
        name: item.item_id || "item-image",
        type: "image",
        url: imagePreview,
        isExisting: false,
      });
    } else if (item.image?.url) {
      // Existing image
      setSelectedFile({
        name: item.image.filename || item.item_id || "item-image",
        type: "image",
        url: item.image.url.startsWith("/")
          ? item.image.url
          : `/${item.image.url}`,
        size: item.image.size || 0,
        isExisting: true,
      });
    }
    setViewFileModal(true);
  };

  const hasImage = !!(imagePreview || item?.image?.url);

  const totalReserved = (item?.reserve_item_stock || []).reduce(
    (sum, reservation) =>
      sum + (reservation.quantity - reservation.used_quantity),
    0,
  );

  return (
    <AdminShell>
      <main className="h-full overflow-y-auto">
        {loading ? (
          <div
            className="flex items-center justify-center h-full"
            role="status"
          >
            <div className="text-center">
              <div
                className="animate-spin rounded-full w-8 h-8 border-2 border-primary border-t-transparent mx-auto mb-4"
                aria-hidden="true"
              />
              <p className="text-sm text-slate-600">Loading item details...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertTriangle
                className="w-8 h-8 text-red-500 mx-auto mb-4"
                aria-hidden="true"
              />
              <p className="text-sm text-red-600 mb-4" role="alert">
                {error}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={`${BTN_PRIMARY} mx-auto`}
              >
                Try again
              </button>
            </div>
          </div>
        ) : !item ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Package
                className="w-8 h-8 text-slate-300 mx-auto mb-4"
                aria-hidden="true"
              />
              <p className="text-sm text-slate-600">
                This item could not be found. It may have been deleted.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3">
            {/* Header: back, record name with badges, record actions */}
            <div className="flex items-center gap-3 mb-4">
              <TabsController back={true}>
                <span className="cursor-pointer flex p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200">
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                  <span className="sr-only">Back</span>
                </span>
              </TabsController>
              <div className="flex-1 flex flex-wrap items-center gap-3 min-w-0">
                <h1
                  className="text-xl font-semibold text-slate-800 truncate"
                  title={itemTitle}
                >
                  {itemTitle}
                </h1>
                {/* A category carries no meaning, so its badge is neutral */}
                <span className={`${BADGE} ${BADGE_TONES.neutral}`}>
                  {categoryLabel}
                </span>
                {category === "sheet" && item.sheet?.is_sunmica && (
                  <span className={`${BADGE} ${BADGE_TONES.violet}`}>
                    Sunmica
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {!isEditing ? (
                  <div ref={dropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShowDropdown(!showDropdown)}
                      aria-haspopup="menu"
                      aria-expanded={showDropdown}
                      className={BTN_SECONDARY}
                    >
                      <MoreVertical className="w-4 h-4" aria-hidden="true" />
                      <span>More actions</span>
                    </button>

                    {showDropdown && (
                      <div
                        role="menu"
                        className="absolute right-0 mt-1 w-56 bg-white border border-slate-300 rounded-lg z-40"
                      >
                        <div className="py-1">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              handleEdit();
                              setShowDropdown(false);
                            }}
                            className={`${MENU_ITEM} text-slate-700`}
                          >
                            <Edit className="w-4 h-4" aria-hidden="true" />
                            Edit item details
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setShowDeleteModal(true);
                              setShowDropdown(false);
                            }}
                            className={`${MENU_ITEM} text-red-700 hover:bg-red-50`}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                            Delete item
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={isUpdating}
                      className={BTN_SECONDARY}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      form="item-edit-form"
                      disabled={isUpdating}
                      className={BTN_PRIMARY}
                    >
                      {isUpdating ? (
                        <span className={SPINNER} aria-hidden="true" />
                      ) : (
                        <Check className="w-4 h-4" aria-hidden="true" />
                      )}
                      Save changes
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Content */}
            <form
              id="item-edit-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (isEditing) handleSave();
              }}
            >
              <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
                {/* Main information - 70% width */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start gap-4">
                      {/* Image */}
                      <div className="shrink-0 flex flex-col items-start gap-2">
                        <div className="relative w-20 h-20 overflow-hidden rounded-lg">
                          {deleteImage && !imagePreview ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 rounded-lg border border-slate-200 text-center p-1">
                              <Trash2
                                className="w-4 h-4 text-slate-500 mb-1"
                                aria-hidden="true"
                              />
                              <p className="text-xs text-slate-600">
                                Image will be removed
                              </p>
                            </div>
                          ) : hasImage && !imageFailed ? (
                            <button
                              type="button"
                              onClick={openImageViewer}
                              aria-label="View item image"
                              className="cursor-pointer block w-full h-full rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <Image
                                src={imagePreview || `/${item.image.url}`}
                                alt=""
                                fill
                                onError={() => setImageFailed(true)}
                                className="object-cover rounded-lg border border-slate-200"
                              />
                            </button>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-lg border border-slate-200">
                              <Package
                                className="w-6 h-6 text-slate-400"
                                aria-hidden="true"
                              />
                              <span className="sr-only">No image</span>
                            </div>
                          )}
                        </div>
                        {isEditing && (
                          <>
                            <input
                              ref={fileInputRef}
                              id="item-image-input"
                              type="file"
                              accept="image/*"
                              onChange={handleImageChange}
                              tabIndex={-1}
                              aria-label="Choose item image"
                              className="sr-only"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className={BTN_SECONDARY_COMPACT}
                              >
                                {hasImage && !deleteImage
                                  ? "Change image"
                                  : "Add image"}
                              </button>
                              {!deleteImage && hasImage && (
                                <button
                                  type="button"
                                  onClick={handleDeleteImage}
                                  className={`${BTN_ICON} text-red-600`}
                                  aria-label="Remove image"
                                  title="Remove image"
                                >
                                  <Trash2
                                    className="w-4 h-4"
                                    aria-hidden="true"
                                  />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h2 className="text-lg font-semibold text-slate-800">
                              {itemTitle}
                            </h2>
                            <p className="text-xs text-slate-500">
                              ID:{" "}
                              <span className="font-mono">{item.item_id}</span>
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-slate-500 mb-1">
                              Quantity
                            </p>
                            <StockLevel
                              stock={Number(item.quantity) || 0}
                              unit={item.measurement_unit}
                            />
                            {isEditing && (
                              <p className="text-xs text-slate-500 mt-1">
                                Adjust stock with a stock tally.
                              </p>
                            )}
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="mt-4 space-y-6">
                            <div>
                              <label
                                htmlFor="item-description"
                                className={LABEL}
                              >
                                Description
                              </label>
                              <textarea
                                id="item-description"
                                value={formData.description || ""}
                                onChange={(e) =>
                                  handleInputChange(
                                    "description",
                                    e.target.value,
                                  )
                                }
                                placeholder="e.g. 18 mm white melamine, matt finish"
                                rows={3}
                                className={`${inputClass(false)} resize-none`}
                              />
                            </div>

                            <div className="space-y-4">
                              <h3 className="text-sm font-semibold text-slate-700">
                                {categoryHeading} details
                              </h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {categoryFields.map((field) =>
                                  typeof field === "string" ? (
                                    <div
                                      key={field}
                                      onKeyDown={blockEnterSubmit}
                                    >
                                      {renderCombo(field)}
                                    </div>
                                  ) : (
                                    <TextField
                                      key={field.name}
                                      id={`item-${field.name}`}
                                      label={field.label}
                                      mono={field.mono}
                                      value={formData[field.name] || ""}
                                      onChange={(e) =>
                                        handleInputChange(
                                          field.name,
                                          e.target.value,
                                        )
                                      }
                                      placeholder={field.placeholder}
                                    />
                                  ),
                                )}
                                <div onKeyDown={blockEnterSubmit}>
                                  <FreeformCombobox
                                    id="item-measurement-unit"
                                    label="Measurement unit"
                                    noun="measurement unit"
                                    value={formData.measurement_unit || ""}
                                    onChange={(value) =>
                                      handleInputChange(
                                        "measurement_unit",
                                        value,
                                      )
                                    }
                                    options={configOptions.measuring_unit}
                                    placeholder="e.g. each"
                                    loading={loadingConfig}
                                    loadingText="Loading measuring units..."
                                    emptyText="No matching measuring units found"
                                    onCreate={(seed) =>
                                      openConfigModal("measuring_unit", seed)
                                    }
                                  />
                                </div>
                              </div>

                              {category === "sheet" && (
                                <div>
                                  <label
                                    htmlFor="item-sunmica"
                                    className="flex items-center gap-2 cursor-pointer"
                                  >
                                    <input
                                      id="item-sunmica"
                                      type="checkbox"
                                      checked={!!formData.is_sunmica}
                                      onChange={handleSunmicaChange}
                                      aria-describedby={
                                        formData.is_sunmica
                                          ? "item-sunmica-hint"
                                          : undefined
                                      }
                                      className={CHECKBOX}
                                    />
                                    <span className="text-sm font-medium text-slate-700">
                                      Is sunmica
                                    </span>
                                  </label>
                                  {formData.is_sunmica && (
                                    <p
                                      id="item-sunmica-hint"
                                      className="mt-1 text-xs text-slate-500"
                                    >
                                      Face is set to &quot;single side&quot;
                                      automatically for sunmica items.
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 space-y-4">
                            <dl>
                              <dt className="text-xs text-slate-500 mb-1">
                                Description
                              </dt>
                              <dd className="text-sm text-slate-700 bg-slate-50 border border-slate-200 p-3 rounded-lg">
                                {formatValue(item.description)}
                              </dd>
                            </dl>

                            <div className="pt-4 border-t border-slate-200">
                              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                                {categoryHeading} details
                              </h3>
                              <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                                {categoryFields.map((field) => {
                                  const name = getFieldName(field);
                                  const raw = categoryDetails?.[name];
                                  const value =
                                    name === "face" && raw === "1"
                                      ? "single side"
                                      : raw;
                                  const mono =
                                    typeof field !== "string" && field.mono;
                                  return (
                                    <div key={name}>
                                      <dt className="text-xs text-slate-500 mb-0.5">
                                        {getFieldLabel(field)}
                                      </dt>
                                      <dd
                                        className={`text-sm text-slate-800 ${
                                          mono ? "font-mono" : ""
                                        }`}
                                      >
                                        {formatValue(value)}
                                      </dd>
                                    </div>
                                  );
                                })}
                                <div>
                                  <dt className="text-xs text-slate-500 mb-0.5">
                                    Measurement unit
                                  </dt>
                                  <dd className="text-sm text-slate-800">
                                    {formatValue(item.measurement_unit)}
                                  </dd>
                                </div>
                                {category === "sheet" && (
                                  <div>
                                    <dt className="text-xs text-slate-500 mb-0.5">
                                      Is sunmica
                                    </dt>
                                    <dd className="text-sm text-slate-800">
                                      {item.sheet?.is_sunmica ? "Yes" : "No"}
                                    </dd>
                                  </div>
                                )}
                              </dl>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Reserved stock */}
                  {item.reserve_item_stock &&
                    item.reserve_item_stock.length > 0 && (
                      <div className="bg-white rounded-lg border border-slate-200">
                        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-slate-200">
                          <h2 className="text-lg font-semibold text-slate-800">
                            Reserved stock
                          </h2>
                          <div className="text-right">
                            <p className="text-xs text-slate-500">
                              Total reserved
                            </p>
                            <p className="text-sm font-medium font-mono text-slate-800">
                              {formatQty(totalReserved, item.measurement_unit)}
                            </p>
                          </div>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-slate-50">
                              <tr>
                                <th scope="col" className={`${TH} text-left`}>
                                  Project name
                                </th>
                                <th scope="col" className={`${TH} text-left`}>
                                  Lot ID
                                </th>
                                <th scope="col" className={`${TH} text-right`}>
                                  Reserved qty
                                </th>
                                <th scope="col" className={`${TH} text-right`}>
                                  Used qty
                                </th>
                                <th scope="col" className={`${TH} text-right`}>
                                  Remaining
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {item.reserve_item_stock.map((reservation) => {
                                const remaining =
                                  reservation.quantity -
                                  reservation.used_quantity;
                                const lots = reservation.mto?.mto?.lots;
                                return (
                                  <tr
                                    key={reservation.id}
                                    className="hover:bg-slate-50 transition-colors"
                                  >
                                    <td className="px-4 py-3 text-sm text-slate-700">
                                      {formatValue(
                                        reservation.mto?.mto?.project?.name,
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700 font-mono">
                                      {lots && lots.length > 0
                                        ? lots
                                            .map((lot) => lot.lot_id)
                                            .join(", ")
                                        : EMPTY}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700 text-right font-mono whitespace-nowrap">
                                      {formatQty(
                                        reservation.quantity,
                                        item.measurement_unit,
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700 text-right font-mono whitespace-nowrap">
                                      {formatQty(
                                        reservation.used_quantity,
                                        item.measurement_unit,
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-medium text-slate-800 text-right font-mono whitespace-nowrap">
                                      {formatQty(
                                        remaining,
                                        item.measurement_unit,
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                  {/* Stock transactions */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200">
                      <h2 className="text-lg font-semibold text-slate-800">
                        Stock transactions
                      </h2>
                    </div>
                    {sortedStockTransactions.length > 0 ? (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-slate-50">
                              <tr>
                                <th scope="col" className={`${TH} w-8`}>
                                  <span className="sr-only">Notes</span>
                                </th>
                                <th scope="col" className={`${TH} text-left`}>
                                  Date
                                </th>
                                <th scope="col" className={`${TH} text-left`}>
                                  Type
                                </th>
                                <th scope="col" className={`${TH} text-right`}>
                                  Quantity
                                </th>
                                <th scope="col" className={`${TH} text-left`}>
                                  Purchase order
                                </th>
                                <th scope="col" className={`${TH} text-left`}>
                                  Project name
                                </th>
                                <th scope="col" className={`${TH} text-left`}>
                                  Lot ID
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {currentStockTransactions.map((transaction) => {
                                const projectName =
                                  transaction.materials_to_order?.project
                                    ?.name || transaction.project?.name;
                                const lotIds =
                                  transaction.lot?.lot_id ||
                                  (transaction.materials_to_order?.lots &&
                                  transaction.materials_to_order.lots.length > 0
                                    ? transaction.materials_to_order.lots
                                        .map((lot) => lot.lot_id)
                                        .join(", ")
                                    : null);
                                const isExpanded = expandedNotes.has(
                                  transaction.id,
                                );
                                return (
                                  <React.Fragment key={transaction.id}>
                                    <tr
                                      className={`hover:bg-slate-50 transition-colors ${
                                        transaction.notes
                                          ? "cursor-pointer"
                                          : ""
                                      }`}
                                      onClick={() =>
                                        transaction.notes &&
                                        toggleNotes(transaction.id)
                                      }
                                    >
                                      <td className="px-4 py-3 whitespace-nowrap">
                                        {transaction.notes && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleNotes(transaction.id);
                                            }}
                                            aria-expanded={isExpanded}
                                            aria-label={
                                              isExpanded
                                                ? "Hide notes"
                                                : "Show notes"
                                            }
                                            className="cursor-pointer flex p-1 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
                                          >
                                            {isExpanded ? (
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
                                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                        {DATE_TIME.format(
                                          new Date(transaction.createdAt),
                                        )}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span
                                          className={`${BADGE} ${
                                            TX_TONES[transaction.type] ||
                                            BADGE_TONES.neutral
                                          }`}
                                        >
                                          {formatLabel(transaction.type)}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-sm font-medium text-slate-800 text-right font-mono whitespace-nowrap">
                                        {transaction.type === "ADDED"
                                          ? "+"
                                          : "-"}
                                        {formatQty(
                                          transaction.quantity,
                                          item.measurement_unit,
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-700 font-mono">
                                        {transaction.type === "ADDED" &&
                                        transaction.purchase_order?.order_no
                                          ? transaction.purchase_order.order_no
                                          : EMPTY}
                                      </td>
                                      <td
                                        className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate"
                                        title={
                                          transaction.type === "USED" &&
                                          projectName
                                            ? projectName
                                            : undefined
                                        }
                                      >
                                        {transaction.type === "USED" &&
                                        projectName
                                          ? projectName
                                          : EMPTY}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-700 font-mono">
                                        {transaction.type === "USED" && lotIds
                                          ? lotIds
                                          : EMPTY}
                                      </td>
                                    </tr>
                                    {transaction.notes && isExpanded && (
                                      <tr className="bg-slate-50">
                                        <td colSpan={7} className="px-4 py-3">
                                          <p className="text-xs font-medium text-slate-700 mb-1">
                                            Notes
                                          </p>
                                          <div className="text-sm text-slate-600 whitespace-pre-wrap pl-3 border-l border-slate-300">
                                            {transaction.notes}
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

                        {stockTxTotalPages > 1 && (
                          <PaginationFooter
                            totalItems={sortedStockTransactions.length}
                            itemsPerPage={STOCK_TX_PER_PAGE}
                            currentPage={stockTxCurrentPage}
                            onPageChange={setStockTxCurrentPage}
                            showItemsPerPage={false}
                          />
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center text-center py-12">
                        <Package
                          className="w-8 h-8 text-slate-300 mb-2"
                          aria-hidden="true"
                        />
                        <p className="text-sm text-slate-600">
                          No stock transactions for this item yet.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Suppliers - 30% width */}
                <div className="lg:col-span-3">
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <Building2 className="w-4 h-4" aria-hidden="true" />
                        Suppliers
                      </h2>
                      {isEditing && (
                        <button
                          type="button"
                          onClick={handleAddSupplier}
                          className={BTN_SECONDARY_COMPACT}
                        >
                          <Plus className="w-4 h-4" aria-hidden="true" />
                          Add supplier
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="space-y-4">
                        {itemSuppliers.map((supplier, index) => {
                          const rowErrors = errors[supplier.id] || {};
                          return (
                            <div
                              key={supplier.id}
                              className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-4"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold text-slate-700">
                                  Supplier {index + 1}
                                </h3>
                                {/* Remove button */}
                                {itemSuppliers.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveSupplier(supplier.id)
                                    }
                                    className="cursor-pointer p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                                    aria-label={`Remove supplier ${index + 1}`}
                                    title="Remove supplier"
                                  >
                                    <X className="w-4 h-4" aria-hidden="true" />
                                  </button>
                                )}
                              </div>

                              <div onKeyDown={blockEnterSubmit}>
                                <label
                                  htmlFor={`item-supplier-${supplier.id}`}
                                  className={LABEL}
                                >
                                  Supplier name
                                </label>
                                <CustomDropdown
                                  id={`item-supplier-${supplier.id}`}
                                  options={suppliers.map((s) => ({
                                    value: s.supplier_id,
                                    label: s.name,
                                    description: s.supplier_id,
                                  }))}
                                  value={supplier.supplier_id}
                                  onChange={(value) =>
                                    handleSupplierFieldChange(
                                      supplier.id,
                                      "supplier_id",
                                      value,
                                    )
                                  }
                                  placeholder="Select a supplier"
                                  searchable
                                  emptyText="No matching suppliers found"
                                />
                              </div>

                              <TextField
                                id={`item-price-${supplier.id}`}
                                label="Price per unit (incl. GST)"
                                type="number"
                                mono
                                prefix="$"
                                step="0.01"
                                value={supplier.price}
                                onChange={(e) =>
                                  handleSupplierFieldChange(
                                    supplier.id,
                                    "price",
                                    e.target.value,
                                  )
                                }
                                placeholder="0.00"
                                error={rowErrors.price}
                              />

                              <TextField
                                id={`item-reference-${supplier.id}`}
                                label="Supplier reference"
                                mono
                                value={supplier.supplier_reference}
                                onChange={(e) =>
                                  handleSupplierFieldChange(
                                    supplier.id,
                                    "supplier_reference",
                                    e.target.value,
                                  )
                                }
                                placeholder="e.g. SUP-12345"
                              />

                              <TextField
                                id={`item-link-${supplier.id}`}
                                label="Product link"
                                type="url"
                                value={supplier.supplier_product_link}
                                onChange={(e) =>
                                  handleSupplierFieldChange(
                                    supplier.id,
                                    "supplier_product_link",
                                    e.target.value,
                                  )
                                }
                                placeholder="e.g. https://supplier.com/product/123"
                                error={rowErrors.link}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : item.itemSuppliers && item.itemSuppliers.length > 0 ? (
                      <ul className="space-y-2">
                        {item.itemSuppliers.map((itemSupplier, index) => (
                          <li
                            key={index}
                            className="bg-slate-50 border border-slate-200 rounded-lg p-3"
                          >
                            <dl className="space-y-2 text-sm">
                              <div>
                                <dt className="text-xs text-slate-500 mb-0.5">
                                  Supplier
                                </dt>
                                <dd>
                                  {itemSupplier.supplier ? (
                                    <Link
                                      href={`/admin/suppliers/${itemSupplier.supplier.supplier_id}`}
                                      className="font-medium text-slate-800 transition-colors duration-200"
                                    >
                                      {itemSupplier.supplier.name}
                                    </Link>
                                  ) : (
                                    <span className="text-slate-800">
                                      {EMPTY}
                                    </span>
                                  )}
                                </dd>
                              </div>
                              <div>
                                <dt className="text-xs text-slate-500 mb-0.5">
                                  Price (incl. GST)
                                </dt>
                                <dd className="font-mono text-slate-800">
                                  {itemSupplier.price
                                    ? PRICE.format(
                                        parseFloat(itemSupplier.price),
                                      )
                                    : EMPTY}
                                </dd>
                              </div>
                              {itemSupplier.supplier_reference && (
                                <div>
                                  <dt className="text-xs text-slate-500 mb-0.5">
                                    Reference
                                  </dt>
                                  <dd className="font-mono text-slate-800">
                                    {itemSupplier.supplier_reference}
                                  </dd>
                                </div>
                              )}
                              {itemSupplier.supplier_product_link && (
                                <div>
                                  <dt className="text-xs text-slate-500 mb-0.5">
                                    Product link
                                  </dt>
                                  <dd>
                                    <a
                                      href={itemSupplier.supplier_product_link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-primary hover:underline flex items-center gap-1"
                                    >
                                      View product page
                                      <ExternalLink
                                        className="w-3 h-3"
                                        aria-hidden="true"
                                      />
                                    </a>
                                  </dd>
                                </div>
                              )}
                            </dl>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="flex flex-col items-center text-center py-12">
                        <Building2
                          className="w-8 h-8 text-slate-300 mb-2"
                          aria-hidden="true"
                        />
                        <p className="text-sm text-slate-600">
                          No suppliers assigned to this item.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>
        )}
      </main>

      {viewFileModal && selectedFile && (
        <ViewMedia
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          setViewFileModal={setViewFileModal}
          setPageNumber={setPageNumber}
          allFiles={
            item?.image
              ? [
                  {
                    url: item.image.url.startsWith("/")
                      ? item.image.url
                      : `/${item.image.url}`,
                    filename:
                      item.image.filename || item.item_id || "item-image",
                    mime_type: "image",
                    size: item.image.size || 0,
                    id: item.image.id || item.item_id,
                  },
                ]
              : []
          }
          currentIndex={0}
        />
      )}

      {/* Delete confirmation */}
      <DeleteConfirmation
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        deleteWithInput={true}
        heading="Item"
        title={item ? `Delete ${itemTitle}?` : "Delete item?"}
        warningHeading="This removes the item from inventory"
        message={
          item
            ? `${itemTitle} (${item.item_id}) will be deleted from inventory.`
            : "The item will be deleted from inventory."
        }
        confirmButtonText="Delete item"
        comparingName={item ? item.item_id : ""}
        isDeleting={isDeleting}
        entityType="item"
      />

      {/* Create finish / brand / measuring unit / sub-category modal */}
      {configModal && (
        <ConfigValueModal
          idPrefix={`item-new-${configModal.kind}`}
          title={CONFIG_KINDS[configModal.kind].title}
          label={CONFIG_KINDS[configModal.kind].label}
          placeholder={CONFIG_KINDS[configModal.kind].placeholder}
          requiredMessage={CONFIG_KINDS[configModal.kind].required}
          initialValue={configModal.seed}
          saving={isCreatingConfig}
          submitLabel={CONFIG_KINDS[configModal.kind].submit}
          onSubmit={handleCreateConfig}
          onClose={() => setConfigModal(null)}
          returnFocusId={CONFIG_KINDS[configModal.kind].comboId}
        />
      )}
    </AdminShell>
  );
}
