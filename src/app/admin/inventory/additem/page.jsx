"use client";
import TabsController from "@/components/tabscontroller";
import CustomDropdown from "@/components/CustomDropdown";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Package,
  Plus,
  Trash2,
  Truck,
  Upload,
  X,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import Image from "next/image";
import { useUploadProgress } from "@/hooks/useUploadProgress";
import useModalFocus from "@/hooks/useModalFocus";
import { v4 as uuidv4 } from "uuid";

// DESIGN.md 9.2 form field recipe. `hasError` flips the border/ring to red.
const INPUT_BASE =
  "w-full text-sm text-slate-800 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent";
const inputClass = (hasError, extra = "px-4 py-3") =>
  `${INPUT_BASE} ${extra} ${
    hasError
      ? "border-red-500 focus:ring-red-500"
      : "border-slate-300 focus:ring-primary"
  }`;

const LABEL = "block text-sm font-medium text-slate-700 mb-1.5";
const CHECKBOX =
  "h-4 w-4 accent-primary border-slate-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer";

// DESIGN.md 9.1 button recipes. Only one primary button per view / modal.
const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY_COMPACT =
  "cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_ICON =
  "cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 transition-colors duration-200";
const SPINNER =
  "w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin";

// Enter in a dropdown's text field must not submit the whole form.
const blockEnterSubmit = (e) => {
  if (e.key === "Enter" && e.target?.getAttribute?.("role") === "combobox") {
    e.preventDefault();
  }
};

// Category options (values are the API's category slugs)
const categoryOptions = [
  { label: "Sheet", value: "sheet" },
  { label: "Handle", value: "handle" },
  { label: "Hardware", value: "hardware" },
  { label: "Accessory", value: "accessory" },
  { label: "Edging tape", value: "edging_tape" },
];

const faceOptions = ["single side", "double side"];

// Fields per category. A string entry is a combobox field (brand, finish,
// face, sub_category) rendered by renderCombo; an object is a plain text input.
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

// Config-backed options the user can extend from the combobox ("Create ...").
// `refetch: false` appends the new value locally instead of re-reading the list.
const CONFIG_KINDS = {
  brand: {
    category: "brand",
    field: "brand",
    comboId: "add-item-brand",
    title: "Create new brand",
    label: "Brand name",
    placeholder: "e.g. Polytec",
    requiredMessage: "Enter a brand name.",
    submitLabel: "Create brand",
    created: "Brand created.",
    failed: "Couldn't create the brand. Check your connection and try again.",
    refetch: false,
  },
  finish: {
    category: "finish",
    field: "finish",
    comboId: "add-item-finish",
    title: "Create new finish",
    label: "Finish name",
    placeholder: "e.g. Matt",
    requiredMessage: "Enter a finish name.",
    submitLabel: "Create finish",
    created: "Finish created.",
    failed: "Couldn't create the finish. Check your connection and try again.",
  },
  measurement_unit: {
    category: "measuring_unit",
    field: "measurement_unit",
    comboId: "add-item-measurement-unit",
    title: "Create new measuring unit",
    label: "Measuring unit name",
    placeholder: "e.g. each",
    requiredMessage: "Enter a measuring unit name.",
    submitLabel: "Create measuring unit",
    created: "Measuring unit created.",
    failed:
      "Couldn't create the measuring unit. Check your connection and try again.",
  },
  sub_category: {
    category: "hardware",
    field: "sub_category",
    comboId: "add-item-sub-category",
    title: "Create new sub-category",
    label: "Sub-category name",
    placeholder: "e.g. Hinges",
    requiredMessage: "Enter a sub-category name.",
    submitLabel: "Create sub-category",
    created: "Sub-category created.",
    failed:
      "Couldn't create the sub-category. Check your connection and try again.",
  },
};

const INITIAL_FORM_DATA = {
  image: "",
  category: "sheet",
  description: "",
  quantity: "0",
  price: "0",
  brand: "",
  color: "",
  finish: "",
  face: "",
  dimensions: "",
  type: "",
  material: "",
  sub_category: "",
  name: "",
  measurement_unit: "",
  is_sunmica: false,
};

// Multi-supplier support - one object per supplier of this item.
const newSupplierRow = () => ({
  id: uuidv4(), // Temporary ID for React keys
  supplier_id: "",
  supplier_reference: "",
  supplier_product_link: "",
  price: "",
});

// Config values (brands, finishes, measuring units, sub-categories) live
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
    return response.data.data.map((item) => item.value);
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

// Amounts the old type="number" step="0.01" inputs accepted: up to 2 decimals.
const hasAtMostTwoDecimals = (raw) => {
  const cents = Number(raw) * 100;
  return Number.isFinite(cents) && Math.abs(cents - Math.round(cents)) <= 1e-6;
};

// Module-level so inputs keep focus between renders.
// Labelled text input with inline error (DESIGN.md 9.2, 15.3).
function TextField({
  id,
  name,
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
          name={name}
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

function Section({ icon: Icon, title, action, children }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
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

// Small modal used to save a new brand / finish / unit / sub-category to the
// config list.
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

export default function page() {
  const router = useRouter();
  const { getToken } = useAuth();
  const {
    showProgressToast,
    completeUpload,
    dismissProgressToast,
    getUploadProgressHandler,
  } = useUploadProgress();
  // Validate on submit, then on change: errors only exist once a submit was attempted.
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [measuringUnitOptions, setMeasuringUnitOptions] = useState([]);
  const [loadingMeasuringUnits, setLoadingMeasuringUnits] = useState(false);
  const [finishOptions, setFinishOptions] = useState([]);
  const [loadingFinishes, setLoadingFinishes] = useState(false);
  const [brandOptions, setBrandOptions] = useState([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [subCategoryOptions, setSubCategoryOptions] = useState([]);
  const [loadingSubCategories, setLoadingSubCategories] = useState(false);
  // The open "create a new brand / finish / unit / sub-category" modal, if any.
  const [createModal, setCreateModal] = useState(null);
  const [isCreatingOption, setIsCreatingOption] = useState(false);
  const fileInputRef = useRef(null);
  const faceAutoSetRef = useRef(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  // Multi-supplier support - array of supplier objects for this item
  const [itemSuppliers, setItemSuppliers] = useState(() => [newSupplierRow()]);

  const selectedCategory = formData.category;
  const selectedCategoryLabel =
    categoryOptions.find((option) => option.value === selectedCategory)
      ?.label || "";

  const supplierOptions = suppliers.map((supplier) => ({
    value: supplier.supplier_id,
    label: supplier.name,
  }));

  const optionSetters = {
    brand: setBrandOptions,
    finish: setFinishOptions,
    measurement_unit: setMeasuringUnitOptions,
    sub_category: setSubCategoryOptions,
  };

  // Fetch suppliers on component mount
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const sessionToken = getToken();
        if (!sessionToken) return;

        const response = await axios.get("/api/v1/supplier/all", {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });

        if (response.data.status && response.data.data) {
          setSuppliers(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching suppliers:", error);
      }
    };

    fetchSuppliers();
  }, []);

  // Fetch hardware sub-categories from config API
  useEffect(() => {
    const fetchHardwareSubCategories = async () => {
      try {
        setLoadingSubCategories(true);
        const sessionToken = getToken();
        if (!sessionToken) {
          console.error("No valid session found");
          return;
        }

        const subCategories = await readConfigValues(sessionToken, "hardware");
        if (subCategories) setSubCategoryOptions(subCategories);
      } catch (error) {
        console.error("Error fetching hardware sub categories:", error);
        // Fallback to empty array if API fails
        setSubCategoryOptions([]);
      } finally {
        setLoadingSubCategories(false);
      }
    };

    fetchHardwareSubCategories();
  }, [getToken]);

  // Fetch measuring units from config API
  useEffect(() => {
    const fetchMeasuringUnits = async () => {
      try {
        setLoadingMeasuringUnits(true);
        const sessionToken = getToken();
        if (!sessionToken) {
          console.error("No valid session found");
          return;
        }

        const units = await readConfigValues(sessionToken, "measuring_unit");
        if (units) setMeasuringUnitOptions(units);
      } catch (error) {
        console.error("Error fetching measuring units:", error);
        // Fallback to empty array if API fails
        setMeasuringUnitOptions([]);
      } finally {
        setLoadingMeasuringUnits(false);
      }
    };

    fetchMeasuringUnits();
  }, [getToken]);

  // Fetch finishes from config API
  useEffect(() => {
    const fetchFinishes = async () => {
      try {
        setLoadingFinishes(true);
        const sessionToken = getToken();
        if (!sessionToken) {
          console.error("No valid session found");
          return;
        }

        const finishes = await readConfigValues(sessionToken, "finish");
        if (finishes) setFinishOptions(finishes);
      } catch (error) {
        console.error("Error fetching finishes:", error);
        // Fallback to empty array if API fails
        setFinishOptions([]);
      } finally {
        setLoadingFinishes(false);
      }
    };

    fetchFinishes();
  }, [getToken]);

  // Brands are shared by sheets, handles, and edging tape.
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        setLoadingBrands(true);
        const sessionToken = getToken();
        if (!sessionToken) return;

        const brands = await readConfigValues(sessionToken, "brand");
        if (brands) setBrandOptions(brands);
      } catch (error) {
        console.error("Error fetching brands:", error);
        setBrandOptions([]);
      } finally {
        setLoadingBrands(false);
      }
    };

    fetchBrands();
  }, [getToken]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const setField = (name, value) =>
    setFormData((prev) => ({ ...prev, [name]: value }));

  const handleCategorySelect = (category) => setField("category", category);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setField(name, value);
  };

  // If is_sunmica is checked, face is set to "single side" and remembered as
  // auto-set, so unchecking only clears a value the checkbox put there.
  const handleSunmicaChange = (e) => {
    const checked = e.target.checked;
    let face = formData.face;
    if (checked) {
      if (face !== "single side") {
        face = "single side";
        faceAutoSetRef.current = true;
      } else {
        // Already "single side", so it might be user-entered: don't mark as auto-set
        faceAutoSetRef.current = false;
      }
    } else {
      if (faceAutoSetRef.current && face === "single side") face = "";
      faceAutoSetRef.current = false;
    }
    setFormData((prev) => ({ ...prev, is_sunmica: checked, face }));
  };

  // A manual change to face means it is no longer auto-set.
  const handleFaceChange = (value) => {
    faceAutoSetRef.current = false;
    setField("face", value);
  };

  // Multi-supplier helper functions
  const handleAddSupplier = () => {
    setItemSuppliers((previous) => [...previous, newSupplierRow()]);
  };

  const handleRemoveSupplier = (id) => {
    // Keep at least one supplier
    if (itemSuppliers.length === 1) return;
    setItemSuppliers((previous) => previous.filter((s) => s.id !== id));
  };

  const handleSupplierFieldChange = (id, field, value) => {
    setItemSuppliers((previous) =>
      previous.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  };

  // Create a new brand / finish / measuring unit / sub-category in the config
  // list, then select it on the form.
  const handleCreateConfigValue = async (kind, value) => {
    const cfg = CONFIG_KINDS[kind];
    try {
      setIsCreatingOption(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again.");
        return;
      }

      const response = await createConfigValue(
        sessionToken,
        cfg.category,
        value,
      );
      if (!response.data.status) {
        toast.error(response.data.message || cfg.failed);
        return;
      }

      toast.success(cfg.created);
      if (cfg.refetch === false) {
        optionSetters[kind]((current) => [...current, value]);
      } else {
        // Refresh the list so the new value appears with the others
        try {
          const list = await readConfigValues(sessionToken, cfg.category);
          if (list) optionSetters[kind](list);
        } catch (error) {
          console.error(`Error fetching ${cfg.category} values:`, error);
        }
      }
      // Set the new value as selected
      setField(cfg.field, value);
      setCreateModal(null);
    } catch (error) {
      console.error(`Error creating ${cfg.category} value:`, error);
      toast.error(error.response?.data?.message || cfg.failed);
    } finally {
      setIsCreatingOption(false);
    }
  };

  // Same rules the browser applied to these inputs before the form became
  // noValidate: amounts in cents, absolute URL.
  const validate = () => {
    const errs = { suppliers: {} };
    if (formData.quantity !== "" && !hasAtMostTwoDecimals(formData.quantity)) {
      errs.quantity =
        "Enter a quantity with up to 2 decimal places, e.g. 100.5.";
    }
    itemSuppliers.forEach((supplier) => {
      const rowErrs = {};
      if (supplier.price !== "" && !hasAtMostTwoDecimals(supplier.price)) {
        rowErrs.price =
          "Enter an amount with up to 2 decimal places, e.g. 49.95.";
      }
      const link = supplier.supplier_product_link.trim();
      if (link !== "") {
        try {
          new URL(link);
        } catch {
          rowErrs.link =
            "Enter a full web address, e.g. https://supplier.com/product/123.";
        }
      }
      if (rowErrs.price || rowErrs.link) errs.suppliers[supplier.id] = rowErrs;
    });
    return errs;
  };

  const errors = submitted ? validate() : { suppliers: {} };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitted(true);

    // Page order is also the order focus moves to on a failed submit.
    const currentErrors = validate();
    let firstInvalidId = currentErrors.quantity ? "add-item-quantity" : null;
    if (!firstInvalidId) {
      for (const supplier of itemSuppliers) {
        const rowErrs = currentErrors.suppliers[supplier.id];
        if (rowErrs?.price) {
          firstInvalidId = `add-item-supplier-${supplier.id}-price`;
          break;
        }
        if (rowErrs?.link) {
          firstInvalidId = `add-item-supplier-${supplier.id}-link`;
          break;
        }
      }
    }
    if (firstInvalidId) {
      document.getElementById(firstInvalidId)?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }
      const data = new FormData();
      const hasImageFile = formData.image instanceof File;
      Object.entries(formData).forEach(([key, value]) => {
        // Skip image field here - handle it separately
        if (key === "image") {
          // Only append image if it's a File object
          if (value instanceof File) {
            data.append(key, value);
          }
          return;
        }
        // Convert boolean to string for FormData
        if (typeof value === "boolean") {
          data.append(key, value.toString());
        } else if (value !== null && value !== undefined) {
          data.append(key, value);
        }
      });

      // Add suppliers array as JSON for multi-supplier support
      const suppliersData = itemSuppliers
        .filter((s) => s.supplier_id) // Only include suppliers with ID selected
        .map(({ id, ...rest }) => rest); // Remove temp fields

      if (suppliersData.length > 0) {
        data.append("suppliers", JSON.stringify(suppliersData));
      }

      // Show progress toast only if there's an image file
      if (hasImageFile) {
        showProgressToast(1);
      }

      const response = await axios.post("/api/v1/item/create", data, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "multipart/form-data",
        },
        ...(hasImageFile && {
          onUploadProgress: getUploadProgressHandler(1),
        }),
      });
      if (response.data.status) {
        if (hasImageFile) {
          completeUpload(1);
        } else {
          toast.success("Item created.", {
            position: "top-right",
            autoClose: 3000,
          });
        }
      } else {
        if (hasImageFile) {
          dismissProgressToast();
        }
        toast.error(
          response.data.message ||
            "Couldn't create the item. Check the details and try again.",
          {
            position: "top-right",
            autoClose: 3000,
          },
        );
        return;
      }
      setFormData(INITIAL_FORM_DATA);
      setImagePreview(null);
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setSubmitted(false);
      faceAutoSetRef.current = false;
    } catch (error) {
      console.error(error);
      const hasImageFile = formData.image instanceof File;
      if (hasImageFile) {
        dismissProgressToast();
      }
      toast.error(
        error.response?.data?.message ||
          "Couldn't create the item. Check your connection and try again.",
        {
          position: "top-right",
          autoClose: 3000,
        },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        image: file,
      }));
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({
      ...prev,
      image: null,
    }));
    setImagePreview(null);
    // Let the same file be picked again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const renderCombo = (key) => {
    if (key === "brand") {
      return (
        <FreeformCombobox
          key={key}
          id="add-item-brand"
          label="Brand"
          noun="brand"
          value={formData.brand}
          onChange={(value) => setField("brand", value)}
          options={brandOptions}
          placeholder="e.g. Polytec"
          loading={loadingBrands}
          loadingText="Loading brands..."
          emptyText="No matching brands found"
          onCreate={(seed) => setCreateModal({ kind: "brand", seed })}
        />
      );
    }
    if (key === "finish") {
      return (
        <FreeformCombobox
          key={key}
          id="add-item-finish"
          label="Finish"
          noun="finish"
          value={formData.finish}
          onChange={(value) => setField("finish", value)}
          options={finishOptions}
          placeholder="e.g. Matt"
          loading={loadingFinishes}
          loadingText="Loading finishes..."
          emptyText="No matching finishes found"
          onCreate={(seed) => setCreateModal({ kind: "finish", seed })}
        />
      );
    }
    if (key === "face") {
      return (
        <FreeformCombobox
          key={key}
          id="add-item-face"
          label="Face"
          noun="face"
          value={formData.face}
          onChange={handleFaceChange}
          options={faceOptions}
          placeholder="e.g. single side"
          disabled={formData.is_sunmica}
        />
      );
    }
    return (
      <FreeformCombobox
        key={key}
        id="add-item-sub-category"
        label="Sub-category"
        noun="sub-category"
        value={formData.sub_category}
        onChange={(value) => setField("sub_category", value)}
        options={subCategoryOptions}
        placeholder="e.g. Hinges"
        loading={loadingSubCategories}
        loadingText="Loading sub-categories..."
        emptyText="No matching sub-categories found"
        onCreate={(seed) => setCreateModal({ kind: "sub_category", seed })}
      />
    );
  };

  const activeCreateConfig = createModal && CONFIG_KINDS[createModal.kind];

  return (
    <>
      <AdminShell>
        <main className="h-full w-full overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <TabsController back={true}>
                <span className="cursor-pointer inline-flex p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200">
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                  <span className="sr-only">Back</span>
                </span>
              </TabsController>
              <h1 className="text-xl font-semibold text-slate-800">Add item</h1>
            </div>

            {/* form */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <form onSubmit={handleSubmit} noValidate className="space-y-6">
                {/* Image on the left, basic information on the right */}
                <div className="flex flex-col md:flex-row md:items-start gap-6">
                  {/* Item image: one image per item, so a compact circle */}
                  <div className="flex flex-col items-center gap-3 md:w-32 shrink-0 mx-auto md:mx-0">
                    {/* Always rendered so "Change image" can open it; visually hidden but keyboard-reachable. */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      id="add-item-image"
                      aria-label="Item image"
                      className="peer sr-only"
                    />
                    <label
                      htmlFor="add-item-image"
                      className={`cursor-pointer shrink-0 w-32 h-32 rounded-full overflow-hidden flex flex-col items-center justify-center text-center transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 ${
                        imagePreview
                          ? "border border-slate-200"
                          : "border-2 border-dashed border-slate-300 hover:border-primary hover:bg-slate-50"
                      }`}
                    >
                      {imagePreview ? (
                        <Image
                          loading="lazy"
                          src={imagePreview}
                          alt="Preview of the selected item image"
                          className="w-full h-full object-cover"
                          width={128}
                          height={128}
                        />
                      ) : (
                        <>
                          <Upload
                            className="w-5 h-5 text-slate-500"
                            aria-hidden="true"
                          />
                          <span className="mt-1 text-xs font-medium text-slate-600">
                            Add image
                          </span>
                        </>
                      )}
                    </label>
                    {imagePreview && (
                      <div className="flex flex-col items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className={BTN_SECONDARY}
                        >
                          Change image
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveImage}
                          className={`${BTN_ICON} text-red-600`}
                          aria-label="Remove image"
                          title="Remove image"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Basic information section */}
                  <div className="flex-1 min-w-0">
                    <Section icon={Package} title="Basic information">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div onKeyDown={blockEnterSubmit}>
                          <label htmlFor="add-item-category" className={LABEL}>
                            Category
                          </label>
                          <CustomDropdown
                            id="add-item-category"
                            options={categoryOptions}
                            value={selectedCategory}
                            onChange={handleCategorySelect}
                            placeholder="Select a category"
                          />
                        </div>

                        <TextField
                          id="add-item-quantity"
                          name="quantity"
                          label="Quantity"
                          type="number"
                          mono
                          step="0.01"
                          value={formData.quantity}
                          onChange={handleInputChange}
                          placeholder="e.g. 100"
                          error={errors.quantity}
                        />

                        <FreeformCombobox
                          id="add-item-measurement-unit"
                          label="Measurement unit"
                          noun="measurement unit"
                          value={formData.measurement_unit}
                          onChange={(value) =>
                            setField("measurement_unit", value)
                          }
                          options={measuringUnitOptions}
                          placeholder="e.g. each"
                          loading={loadingMeasuringUnits}
                          loadingText="Loading measuring units..."
                          emptyText="No matching measuring units found"
                          onCreate={(seed) =>
                            setCreateModal({ kind: "measurement_unit", seed })
                          }
                        />
                      </div>

                      <div>
                        <label htmlFor="add-item-description" className={LABEL}>
                          Description
                        </label>
                        <textarea
                          id="add-item-description"
                          name="description"
                          value={formData.description}
                          onChange={handleInputChange}
                          className={`${inputClass(false)} resize-none`}
                          placeholder="e.g. 18 mm white melamine, matt finish"
                          rows={3}
                        />
                      </div>
                    </Section>
                  </div>
                </div>

                {/* Suppliers section */}
                <Section
                  icon={Truck}
                  title="Suppliers"
                  action={
                    <button
                      type="button"
                      onClick={handleAddSupplier}
                      className={BTN_SECONDARY_COMPACT}
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      Add supplier
                    </button>
                  }
                >
                  {itemSuppliers.map((supplier, index) => {
                    const rowId = `add-item-supplier-${supplier.id}`;
                    const rowErrors = errors.suppliers[supplier.id] || {};
                    return (
                      <div
                        key={supplier.id}
                        className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-slate-700">
                            Supplier {index + 1}
                          </h3>
                          {/* Remove button - only show if more than 1 supplier */}
                          {itemSuppliers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSupplier(supplier.id)}
                              className={`${BTN_ICON} text-red-600`}
                              aria-label={`Remove supplier ${index + 1}`}
                              title="Remove supplier"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div onKeyDown={blockEnterSubmit}>
                            <label htmlFor={rowId} className={LABEL}>
                              Supplier
                            </label>
                            <CustomDropdown
                              id={rowId}
                              options={supplierOptions}
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
                            id={`${rowId}-price`}
                            label="Price per unit (including GST)"
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
                            id={`${rowId}-reference`}
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
                            id={`${rowId}-link`}
                            label="Supplier product link"
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
                      </div>
                    );
                  })}
                </Section>

                {/* Category details section */}
                <Section
                  icon={ClipboardList}
                  title={`${selectedCategoryLabel} details`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(CATEGORY_FIELDS[selectedCategory] || []).map((field) =>
                      typeof field === "string" ? (
                        renderCombo(field)
                      ) : (
                        <TextField
                          key={field.name}
                          id={`add-item-${field.name}`}
                          name={field.name}
                          label={field.label}
                          mono={field.mono}
                          value={formData[field.name]}
                          onChange={handleInputChange}
                          placeholder={field.placeholder}
                        />
                      ),
                    )}
                  </div>

                  {selectedCategory === "sheet" && (
                    <div>
                      <label
                        htmlFor="add-item-sunmica"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          id="add-item-sunmica"
                          type="checkbox"
                          name="is_sunmica"
                          checked={formData.is_sunmica}
                          onChange={handleSunmicaChange}
                          aria-describedby={
                            formData.is_sunmica
                              ? "add-item-sunmica-hint"
                              : undefined
                          }
                          className={CHECKBOX}
                        />
                        <span className="text-sm font-medium text-slate-700">
                          Is Sunmica
                        </span>
                      </label>
                      {formData.is_sunmica && (
                        <p
                          id="add-item-sunmica-hint"
                          className="mt-1 text-xs text-slate-500"
                        >
                          Face is set to &quot;single side&quot; automatically
                          for Sunmica items.
                        </p>
                      )}
                    </div>
                  )}
                </Section>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                    className={BTN_SECONDARY}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={BTN_PRIMARY}
                  >
                    {isSubmitting ? (
                      <span className={SPINNER} aria-hidden="true" />
                    ) : (
                      <Plus className="w-4 h-4" aria-hidden="true" />
                    )}
                    Add item
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </AdminShell>

      {/* Create brand / finish / measuring unit / sub-category modal */}
      {createModal && (
        <ConfigValueModal
          key={createModal.kind}
          idPrefix={`add-item-new-${createModal.kind.replace(/_/g, "-")}`}
          title={activeCreateConfig.title}
          label={activeCreateConfig.label}
          placeholder={activeCreateConfig.placeholder}
          requiredMessage={activeCreateConfig.requiredMessage}
          initialValue={createModal.seed.trim()}
          saving={isCreatingOption}
          submitLabel={activeCreateConfig.submitLabel}
          onSubmit={(value) => handleCreateConfigValue(createModal.kind, value)}
          onClose={() => setCreateModal(null)}
          returnFocusId={activeCreateConfig.comboId}
        />
      )}
    </>
  );
}
