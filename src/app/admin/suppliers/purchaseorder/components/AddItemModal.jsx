"use client";
import React, { useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import Image from "next/image";
import { X, ChevronDown, ChevronUp, Upload, Plus, Trash2 } from "lucide-react";
import CustomDropdown from "@/components/CustomDropdown";
import useModalFocus from "@/hooks/useModalFocus";

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

// DESIGN.md 9.1 button recipes. Only one primary button per modal.
const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
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

const hardwareSubCategories = [
  "Legs with plates",
  "Hinges",
  "Hinge Plates",
  "Screws",
  "Hangin Rode",
  "Hanging Rode Support & Ends",
  "Cutlery Tray",
  "Bin",
  "Drawer set (Runners)",
  "Screw Caps (White & Color)",
  "Plastic Wraps",
  "Shelf Support",
  "LED",
];

const faceOptions = ["single side", "double side"];

// Plain text inputs per category. A string entry is a combobox field
// (finish, face, sub_category) rendered by renderCombo below.
const textField = (name, label, placeholder, mono = false) => ({
  name,
  label,
  placeholder,
  mono,
});
const CATEGORY_FIELDS = {
  sheet: [
    textField("brand", "Brand", "e.g. Polytec"),
    textField("color", "Colour", "e.g. Natural oak"),
    "finish",
    "face",
    textField("dimensions", "Dimensions", "e.g. 2400 x 1200 x 18 mm", true),
  ],
  handle: [
    textField("brand", "Brand", "e.g. Polytec"),
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
    textField("brand", "Brand", "e.g. Polytec"),
    textField("color", "Colour", "e.g. Natural oak"),
    "finish",
    textField("dimensions", "Dimensions", "e.g. 22 x 1 mm", true),
  ],
};

// Fields that count as typed input for the dirty-form backdrop guard.
const TEXT_KEYS = [
  "description",
  "quantity",
  "price",
  "brand",
  "color",
  "finish",
  "face",
  "dimensions",
  "type",
  "material",
  "sub_category",
  "name",
  "measurement_unit",
  "supplier_reference",
  "supplier_product_link",
];

// Config values (finishes, measuring units) live behind one API.
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

// Small modal used to save a new finish / measuring unit to the config list.
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

export default function AddItemModal({
  setShowModal,
  supplierId,
  onItemAdded,
}) {
  const { getToken } = useAuth();
  // Validate on submit, then on change: errors only exist once a submit was attempted.
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [measuringUnitOptions, setMeasuringUnitOptions] = useState([]);
  const [loadingMeasuringUnits, setLoadingMeasuringUnits] = useState(false);
  const [showCreateMeasuringUnitModal, setShowCreateMeasuringUnitModal] =
    useState(false);
  const [newMeasuringUnitValue, setNewMeasuringUnitValue] = useState("");
  const [isCreatingMeasuringUnit, setIsCreatingMeasuringUnit] = useState(false);
  const [finishOptions, setFinishOptions] = useState([]);
  const [loadingFinishes, setLoadingFinishes] = useState(false);
  const [showCreateFinishModal, setShowCreateFinishModal] = useState(false);
  const [newFinishValue, setNewFinishValue] = useState("");
  const [isCreatingFinish, setIsCreatingFinish] = useState(false);
  const fileInputRef = useRef(null);
  const faceAutoSetRef = useRef(false);
  const panelRef = useRef(null);
  useModalFocus(panelRef, true);
  const [imagePreview, setImagePreview] = useState(null);

  const [formData, setFormData] = useState({
    image: "",
    category: "sheet",
    description: "",
    quantity: "",
    price: "",
    brand: "",
    color: "",
    finish: "",
    face: "",
    dimensions: "",
    type: "",
    material: "",
    sub_category: "",
    name: "",
    supplier_id: supplierId || "",
    measurement_unit: "",
    supplier_reference: "",
    supplier_product_link: "",
    is_sunmica: false,
  });

  const selectedCategory = formData.category;
  const selectedCategoryLabel =
    categoryOptions.find((option) => option.value === selectedCategory)
      ?.label || "";

  const supplierOptions = suppliers.map((supplier) => ({
    value: supplier.supplier_id,
    label: supplier.name,
  }));

  // Start on the first field (the dropdown opens its list on focus).
  useEffect(() => {
    document.getElementById("add-item-category")?.focus();
  }, []);

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

  // Update supplier_id when supplierId prop changes
  useEffect(() => {
    if (supplierId) {
      setFormData((prev) => ({
        ...prev,
        supplier_id: supplierId,
      }));
    }
  }, [supplierId]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const closeModal = () => setShowModal(false);

  // A form with typed or chosen input must not close on a stray backdrop click.
  const isDirty =
    !!formData.image ||
    formData.category !== "sheet" ||
    formData.is_sunmica ||
    (!supplierId && formData.supplier_id !== "") ||
    TEXT_KEYS.some((key) => String(formData[key]).trim() !== "");

  // Modals close on Escape (DESIGN.md 9.4). The create finish / unit modals
  // handle their own Escape; an open dropdown closes first.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape" || isSubmitting) return;
      if (showCreateFinishModal || showCreateMeasuringUnitModal) return;
      if (e.target?.getAttribute?.("aria-expanded") === "true") return;
      closeModal();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [isSubmitting, showCreateFinishModal, showCreateMeasuringUnitModal]);

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

  // Handle create new finish
  const handleCreateNewFinish = async (finishValue) => {
    try {
      setIsCreatingFinish(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please sign in again.");
        return;
      }

      const response = await createConfigValue(
        sessionToken,
        "finish",
        finishValue,
      );
      if (response.data.status) {
        toast.success("Finish created.");
        // Refresh finishes list
        try {
          const finishes = await readConfigValues(sessionToken, "finish");
          if (finishes) setFinishOptions(finishes);
        } catch (error) {
          console.error("Error fetching finishes:", error);
        }
        // Set the new finish as selected
        setField("finish", finishValue);
        setShowCreateFinishModal(false);
      } else {
        toast.error(
          response.data.message ||
            "Couldn't create the finish. Check your connection and try again.",
        );
      }
    } catch (error) {
      console.error("Error creating finish:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Couldn't create the finish. Check your connection and try again.";
      toast.error(errorMessage);
    } finally {
      setIsCreatingFinish(false);
    }
  };

  // Handle create new measuring unit
  const handleCreateNewMeasuringUnit = async (unitValue) => {
    try {
      setIsCreatingMeasuringUnit(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please sign in again.");
        return;
      }

      const response = await createConfigValue(
        sessionToken,
        "measuring_unit",
        unitValue,
      );
      if (response.data.status) {
        toast.success("Measuring unit created.");
        // Refresh measuring units list
        try {
          const units = await readConfigValues(sessionToken, "measuring_unit");
          if (units) setMeasuringUnitOptions(units);
        } catch (error) {
          console.error("Error fetching measuring units:", error);
        }
        // Set the new measuring unit as selected
        setField("measurement_unit", unitValue);
        setShowCreateMeasuringUnitModal(false);
      } else {
        toast.error(
          response.data.message ||
            "Couldn't create the measuring unit. Check your connection and try again.",
        );
      }
    } catch (error) {
      console.error("Error creating measuring unit:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Couldn't create the measuring unit. Check your connection and try again.";
      toast.error(errorMessage);
    } finally {
      setIsCreatingMeasuringUnit(false);
    }
  };

  // Same rules the browser applied to these inputs before the form became
  // noValidate: whole-number quantity, price in cents, absolute URL.
  const validate = () => {
    const errs = {};
    if (
      formData.quantity !== "" &&
      !Number.isInteger(Number(formData.quantity))
    ) {
      errs.quantity = "Enter a whole number, e.g. 100.";
    }
    if (formData.price !== "") {
      const cents = Number(formData.price) * 100;
      if (
        !Number.isFinite(cents) ||
        Math.abs(cents - Math.round(cents)) > 1e-6
      ) {
        errs.price = "Enter an amount with up to 2 decimal places, e.g. 49.95.";
      }
    }
    const link = formData.supplier_product_link.trim();
    if (link !== "") {
      try {
        new URL(link);
      } catch {
        errs.supplier_product_link =
          "Enter a full web address, e.g. https://supplier.com/product/123.";
      }
    }
    return errs;
  };

  const errors = submitted ? validate() : {};

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitted(true);

    const currentErrors = validate();
    const firstInvalid = [
      ["quantity", "add-item-quantity"],
      ["price", "add-item-price"],
      ["supplier_product_link", "add-item-link"],
    ].find(([key]) => currentErrors[key]);
    if (firstInvalid) {
      document.getElementById(firstInvalid[1])?.focus();
      return;
    }

    setIsSubmitting(true);
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please sign in again.");
        return;
      }
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === "image") {
          if (value instanceof File) {
            data.append(key, value);
          }
          return;
        }
        if (typeof value === "boolean") {
          data.append(key, value.toString());
        } else if (value !== null && value !== undefined && value !== "") {
          data.append(key, value);
        }
      });
      const response = await axios.post("/api/v1/item/create", data, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "multipart/form-data",
        },
      });
      if (response.data.status) {
        toast.success("Item created.");
        resetForm();
        if (onItemAdded) {
          onItemAdded();
        }
        setShowModal(false);
      } else {
        toast.error(
          response.data.message ||
            "Couldn't create the item. Check your connection and try again.",
        );
      }
    } catch (error) {
      console.error(error);
      toast.error(
        error?.response?.data?.message ||
          "Couldn't create the item. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      image: "",
      category: "sheet",
      description: "",
      quantity: "",
      price: "",
      brand: "",
      color: "",
      finish: "",
      face: "",
      dimensions: "",
      type: "",
      material: "",
      sub_category: "",
      name: "",
      supplier_id: supplierId || "",
      measurement_unit: "",
      supplier_reference: "",
      supplier_product_link: "",
      is_sunmica: false,
    });
    setImagePreview(null);
    setSubmitted(false);
    faceAutoSetRef.current = false;
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
  };

  const renderCombo = (key) => {
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
          onCreate={(seed) => {
            setNewFinishValue(seed.trim());
            setShowCreateFinishModal(true);
          }}
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
        options={hardwareSubCategories}
        placeholder="e.g. Hinges"
        emptyText={
          formData.sub_category
            ? `No matching sub-categories. Press Enter to use "${formData.sub_category}".`
            : "Type to search or enter a custom sub-category"
        }
      />
    );
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
        onClick={(e) => {
          // Stop the click reaching the modal that opened this one.
          e.stopPropagation();
          if (!isDirty && !isSubmitting) closeModal();
        }}
      >
        <div
          ref={panelRef}
          className="bg-white w-full max-w-2xl rounded-xl border border-slate-200 max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-item-title"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h2
              id="add-item-title"
              className="text-lg font-semibold text-slate-800"
            >
              Add item
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
              {/* Item image */}
              <div>
                <span id="add-item-image-label" className={LABEL}>
                  Item image
                </span>
                {/* Always rendered so "Change image" can open it; visually hidden but keyboard-reachable. */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  id="add-item-image"
                  tabIndex={imagePreview ? -1 : 0}
                  aria-labelledby="add-item-image-label"
                  className="peer sr-only"
                />
                {imagePreview ? (
                  <div className="flex items-center gap-4">
                    <Image
                      loading="lazy"
                      src={imagePreview}
                      alt="Preview of the selected item image"
                      className="w-24 h-24 rounded-lg object-cover border border-slate-200"
                      width={96}
                      height={96}
                    />
                    <div className="flex items-center gap-2">
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
                  </div>
                ) : (
                  <label
                    htmlFor="add-item-image"
                    className="cursor-pointer flex flex-col items-center text-center w-full border-2 border-dashed border-slate-300 hover:border-primary hover:bg-slate-50 rounded-lg py-6 transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-primary"
                  >
                    <Upload
                      className="w-8 h-8 mb-2 text-slate-400"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      Click to upload an image
                    </span>
                  </label>
                )}
              </div>

              {/* Basic information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">
                  Basic information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    value={formData.quantity}
                    onChange={handleInputChange}
                    placeholder="e.g. 100"
                    error={errors.quantity}
                  />

                  <TextField
                    id="add-item-price"
                    name="price"
                    label="Price per unit (including GST)"
                    type="number"
                    mono
                    prefix="$"
                    step="0.01"
                    value={formData.price}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    error={errors.price}
                  />

                  {/* Supplier dropdown - only shown when supplierId is not provided */}
                  {!supplierId && (
                    <div onKeyDown={blockEnterSubmit}>
                      <label htmlFor="add-item-supplier" className={LABEL}>
                        Supplier
                      </label>
                      <CustomDropdown
                        id="add-item-supplier"
                        options={supplierOptions}
                        value={formData.supplier_id}
                        onChange={(value) => setField("supplier_id", value)}
                        placeholder="Select a supplier"
                        searchable
                        emptyText="No matching suppliers found"
                      />
                    </div>
                  )}

                  <FreeformCombobox
                    id="add-item-measurement-unit"
                    label="Measurement unit"
                    noun="measurement unit"
                    value={formData.measurement_unit}
                    onChange={(value) => setField("measurement_unit", value)}
                    options={measuringUnitOptions}
                    placeholder="e.g. each"
                    loading={loadingMeasuringUnits}
                    loadingText="Loading measuring units..."
                    emptyText="No matching measuring units found"
                    onCreate={(seed) => {
                      setNewMeasuringUnitValue(seed.trim());
                      setShowCreateMeasuringUnitModal(true);
                    }}
                  />

                  <TextField
                    id="add-item-supplier-reference"
                    name="supplier_reference"
                    label="Supplier reference"
                    mono
                    value={formData.supplier_reference}
                    onChange={handleInputChange}
                    placeholder="e.g. SUP-12345"
                  />

                  <TextField
                    id="add-item-link"
                    name="supplier_product_link"
                    label="Supplier product link"
                    type="url"
                    value={formData.supplier_product_link}
                    onChange={handleInputChange}
                    placeholder="e.g. https://supplier.com/product/123"
                    error={errors.supplier_product_link}
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
              </div>

              {/* Category details */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">
                  {selectedCategoryLabel} details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        Face is set to &quot;single side&quot; automatically for
                        Sunmica items.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button
                type="button"
                onClick={closeModal}
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

      {/* Create finish modal */}
      {showCreateFinishModal && (
        <ConfigValueModal
          idPrefix="add-item-new-finish"
          title="Create new finish"
          label="Finish name"
          placeholder="e.g. Matt"
          requiredMessage="Enter a finish name."
          initialValue={newFinishValue}
          saving={isCreatingFinish}
          submitLabel="Create finish"
          onSubmit={handleCreateNewFinish}
          onClose={() => setShowCreateFinishModal(false)}
          returnFocusId="add-item-finish"
        />
      )}

      {/* Create measuring unit modal */}
      {showCreateMeasuringUnitModal && (
        <ConfigValueModal
          idPrefix="add-item-new-unit"
          title="Create new measuring unit"
          label="Measuring unit name"
          placeholder="e.g. each"
          requiredMessage="Enter a measuring unit name."
          initialValue={newMeasuringUnitValue}
          saving={isCreatingMeasuringUnit}
          submitLabel="Create measuring unit"
          onSubmit={handleCreateNewMeasuringUnit}
          onClose={() => setShowCreateMeasuringUnitModal(false)}
          returnFocusId="add-item-measurement-unit"
        />
      )}
    </>
  );
}
