"use client";
import React, { useState, useEffect, useRef } from "react";
import AdminShell from "@/components/AdminShell";
import PaginationFooter from "@/components/PaginationFooter";
import CustomDropdown from "@/components/CustomDropdown";
import SearchBar from "@/components/SearchBar";
import { useAuth } from "@/contexts/AuthContext";
import useModalFocus from "@/hooks/useModalFocus";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  History,
  ImageIcon,
  Layers,
  Package,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  BADGE,
  BADGE_TONES,
  COUNT_BADGE,
  STATUS_COLORS,
  formatQty,
} from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";

const EMPTY = "—";
const SESSION_ERROR = "Your session has expired. Sign in again to continue.";
const MTO_LOAD_ERROR =
  "Couldn't load materials to order. Check your connection and try again.";
const USAGE_LOAD_ERROR =
  "Couldn't load recently used materials. Check your connection and try again.";
const PROJECTS_LOAD_ERROR =
  "Couldn't load projects. Check your connection and try again.";
const ITEMS_LOAD_ERROR =
  "Couldn't load items. Check your connection and try again.";
const TOAST_OPTIONS = { position: "top-right", autoClose: 3000 };
// Value of the "No project" option. It differs from the empty selection so the
// project field shows its placeholder until something is chosen.
const NO_PROJECT = "__none__";

const TABS = [
  { id: "recent", label: "Recently used" },
  { id: "active", label: "Active" },
  { id: "upcoming", label: "Upcoming" },
  { id: "completed", label: "Completed" },
];

const MTO_EMPTY_MESSAGES = {
  active: "No active materials to order",
  upcoming: "No upcoming materials to order",
  completed: "No completed materials to order",
};

// Category options (values are the API's category slugs).
const CATEGORY_OPTIONS = [
  { label: "Sheet", value: "sheet" },
  { label: "Edging tape", value: "edging_tape" },
  { label: "Handle", value: "handle" },
  { label: "Hardware", value: "hardware" },
  { label: "Accessory", value: "accessory" },
];

// Attributes listed for an item in the accordion, in display order:
// [on-screen label, key on the object returned by getItemDetails].
const ITEM_DETAIL_FIELDS = [
  ["Brand", "brand"],
  ["Colour", "color"],
  ["Finish", "finish"],
  ["Material", "material"],
  ["Type", "type"],
  ["Sub-category", "sub_category"],
  ["Face", "face"],
  ["Dimensions", "dimensions"],
];

const DATE_TIME = new Intl.DateTimeFormat("en-AU", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Button, field, menu and table recipes from DESIGN.md 9.1 / 9.2 / 9.5 / 9.8.
const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_TOOLBAR =
  "cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY_COMPACT =
  "cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const ICON_BTN =
  "cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const ICON_BTN_ACCENT =
  "cursor-pointer p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const ICON_BTN_DANGER =
  "cursor-pointer p-1.5 text-red-600 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const MENU_ITEM =
  "cursor-pointer w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 transition-colors flex items-center justify-between gap-2";
const TH =
  "px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider";
const LABEL = "block text-sm font-medium text-slate-700 mb-1.5";
const SPINNER =
  "w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin";

// DESIGN.md 9.2 form field recipe. `hasError` flips the border/ring to red.
const fieldClass = (hasError, extra = "px-4 py-3") =>
  `w-full text-sm text-slate-800 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-600 disabled:cursor-not-allowed ${extra} ${
    hasError
      ? "border-red-500 focus:ring-red-500"
      : "border-slate-300 focus:ring-primary"
  }`;
// Compact numeric field used inside tables.
const cellInputClass = (hasError) =>
  `w-24 text-sm text-slate-800 px-3 py-2 text-right font-mono border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-600 disabled:cursor-not-allowed ${
    hasError
      ? "border-red-500 focus:ring-red-500"
      : "border-slate-300 focus:ring-primary"
  }`;

const tabClass = (isActive) =>
  `cursor-pointer py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary rounded-t-sm ${
    isActive
      ? "border-primary text-primary"
      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
  }`;

const dash = (value) =>
  value === null || value === undefined || value === "" ? EMPTY : value;

// Enter in a dropdown's text field must not submit the whole form.
const blockEnterSubmit = (e) => {
  if (e.key === "Enter" && e.target?.getAttribute?.("role") === "combobox") {
    e.preventDefault();
  }
};

// Validate and format image URL
const getImageUrl = (image) => {
  // Handle image object (media relation) - extract URL
  if (image && typeof image === "object" && image.url) {
    const url = image.url;
    // If it's already a full URL, return as is
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    // If it's a relative path, ensure it starts with /
    if (url.startsWith("/")) {
      return url;
    }
    // Otherwise, add leading slash
    return `/${url}`;
  }
  // Handle string format (backward compatibility)
  if (
    !image ||
    typeof image !== "string" ||
    image.trim() === "" ||
    image === "null" ||
    image === "undefined"
  ) {
    return null;
  }
  const trimmed = image.trim();
  // If it's already a full URL, return as is
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  // If it's a relative path, ensure it starts with /
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  // Otherwise, add leading slash
  return `/${trimmed}`;
};

// Get item details based on category
const getItemDetails = (item) => {
  if (!item) return null;

  const category = item.category;
  const details = {
    name: item.description || "Unknown item",
    image: getImageUrl(item.image),
    brand: null,
    color: null,
    finish: null,
    material: null,
    type: null,
    dimensions: null,
    face: null,
    sub_category: null,
  };

  switch (category) {
    case "SHEET":
      if (item.sheet) {
        details.name = item.sheet.brand || details.name;
        details.brand = item.sheet.brand;
        details.color = item.sheet.color;
        details.finish = item.sheet.finish;
        details.face = item.sheet.face;
        details.dimensions = item.sheet.dimensions;
      }
      break;
    case "HANDLE":
      if (item.handle) {
        details.name = item.handle.brand || details.name;
        details.brand = item.handle.brand;
        details.color = item.handle.color;
        details.type = item.handle.type;
        details.material = item.handle.material;
        details.dimensions = item.handle.dimensions;
      }
      break;
    case "HARDWARE":
      if (item.hardware) {
        details.name = item.hardware.name || details.name;
        details.brand = item.hardware.brand;
        details.type = item.hardware.type;
        details.sub_category = item.hardware.sub_category;
        details.dimensions = item.hardware.dimensions;
      }
      break;
    case "ACCESSORY":
      if (item.accessory) {
        details.name = item.accessory.name || details.name;
      }
      break;
    case "EDGING_TAPE":
      if (item.edging_tape) {
        details.name = item.edging_tape.brand || details.name;
        details.brand = item.edging_tape.brand;
        details.color = item.edging_tape.color;
        details.finish = item.edging_tape.finish;
        details.dimensions = item.edging_tape.dimensions;
      }
      break;
    default:
      break;
  }

  return details;
};

// Display name for an item picked in the manual add modal.
const getItemDisplayName = (item) => {
  const join = (...parts) => parts.filter(Boolean).join(" ");
  if (item.sheet)
    return join(item.sheet.brand, item.sheet.color, item.sheet.finish);
  if (item.handle)
    return join(item.handle.brand, item.handle.color, item.handle.type);
  if (item.hardware) return join(item.hardware.brand, item.hardware.name);
  if (item.accessory) return item.accessory.name || "Item";
  if (item.edging_tape)
    return join(item.edging_tape.brand, item.edging_tape.color);
  return item.description || "Item";
};

// The attribute rows listed for an item in the manual add modal.
const getDetailRows = (item) => {
  const rows = [];
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

// Group items by category
const groupItemsByCategory = (items) => {
  const grouped = {};
  items.forEach((mtoItem) => {
    const category = mtoItem.item?.category || "UNCATEGORIZED";
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(mtoItem);
  });
  return grouped;
};

const getUsageLocation = (transaction) => {
  const project =
    transaction.project || transaction.materials_to_order?.project;
  const lots = transaction.lot
    ? [transaction.lot]
    : transaction.materials_to_order?.lots || [];

  return {
    project: project?.name || project?.project_id || null,
    projectId: project?.project_id || null,
    lots,
  };
};

// Inline validation for the "new used" quantity of an MTO item. Returns the
// message to show under the field, or null when the value can be saved.
const getUsedQtyError = (inputString, mtoItem) => {
  if (inputString === undefined) return null;
  const value = inputString === "" ? 0 : parseFloat(inputString);
  if (Number.isNaN(value)) return "Enter a valid number.";
  if (value < 0) return "Can't be negative.";
  if (value > mtoItem.quantity) {
    return `Max: ${formatQty(mtoItem.quantity)}`;
  }
  const currentUsed = mtoItem.quantity_used || 0;
  if (value < currentUsed) {
    return `Can't be below ${formatQty(currentUsed)} used.`;
  }
  return null;
};

// Category pill. A category carries no status meaning, so it takes the
// sanctioned categorical hue (DESIGN.md 5.5).
function CategoryBadge({ category }) {
  if (!category) return <span className="text-sm text-slate-500">{EMPTY}</span>;
  return (
    <span className={`${BADGE} ${BADGE_TONES.indigo}`}>
      {formatLabel(category)}
    </span>
  );
}

function CategoryIcon({ category }) {
  const Icon = category === "SHEET" ? Layers : Package;
  return <Icon className="w-4 h-4 text-slate-500" aria-hidden="true" />;
}

// Item thumbnail with a placeholder when there is no image or it fails to
// load. The adjacent name carries the accessible name, so the image is
// decorative.
function ItemThumb({ image }) {
  const [failed, setFailed] = useState(false);
  const src = getImageUrl(image);

  if (!src || failed) {
    return (
      <div className="w-10 h-10 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center shrink-0">
        <ImageIcon className="w-5 h-5 text-slate-400" aria-hidden="true" />
      </div>
    );
  }

  return (
    <Image
      loading="lazy"
      src={src}
      alt=""
      className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0"
      onError={() => setFailed(true)}
      width={40}
      height={40}
    />
  );
}

function LoadingState({ label }) {
  return (
    <div className="px-4 py-12 text-center">
      <div className="flex flex-col items-center gap-2" role="status">
        <span
          className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin"
          aria-hidden="true"
        />
        <p className="text-sm text-slate-600">{label}</p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="px-4 py-12 text-center">
      <div className="flex flex-col items-center gap-2" role="alert">
        <AlertTriangle className="w-8 h-8 text-red-500" aria-hidden="true" />
        <p className="text-sm text-red-600">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className={BTN_SECONDARY_COMPACT}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon = Package, message, action }) {
  return (
    <div className="px-4 py-12 text-center">
      <div className="flex flex-col items-center gap-2">
        <Icon className="w-8 h-8 text-slate-300" aria-hidden="true" />
        <p className="text-sm text-slate-600">{message}</p>
        {action}
      </div>
    </div>
  );
}

// A toolbar filter menu: one button, a flat list of options below it.
function FilterMenu({ id, label, value, options, isOpen, onToggle, onSelect }) {
  const selectedOption = options.find((option) => option.value === value);

  return (
    <div className="relative" data-recent-filter-dropdown>
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={BTN_TOOLBAR}
      >
        <span className="max-w-48 truncate">
          {selectedOption?.label || label}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
      </button>
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-64 max-h-80 overflow-y-auto bg-white border border-slate-300 rounded-lg z-40">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value || "all"}
                type="button"
                onClick={() => onSelect(id, option.value)}
                aria-current={isSelected || undefined}
                className={`${MENU_ITEM} ${
                  isSelected ? "text-primary font-medium" : "text-slate-700"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && (
                  <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// One line of an MTO's items table: details, totals and the "new used" editor.
function MtoItemRow({
  mtoId,
  mtoItem,
  inputValue,
  readOnly,
  saving,
  onChange,
  onCancel,
  onSave,
}) {
  const details = getItemDetails(mtoItem.item);
  const unit = mtoItem.item?.measurement_unit;
  const name = details?.name || "Unknown item";
  const originalValue = String(mtoItem.quantity_used || 0);
  const hasChanges = inputValue !== undefined && inputValue !== originalValue;
  const error = getUsedQtyError(inputValue, mtoItem);
  const inputId = `used-qty-${mtoItem.id}`;
  const errorId = `${inputId}-error`;

  const pairs = ITEM_DETAIL_FIELDS.filter(([, key]) => details?.[key]).map(
    ([label, key]) => [label, details[key]],
  );
  if (mtoItem.item?.supplier) {
    pairs.push(["Supplier", mtoItem.item.supplier.name]);
  }

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <ItemThumb image={mtoItem.item?.image} />
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-slate-800">{name}</div>
        {pairs.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            {pairs.map(([label, value]) => (
              <span key={label}>
                <span className="font-medium text-slate-500">{label}:</span>{" "}
                {value}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right text-sm font-mono text-slate-700 whitespace-nowrap">
        {formatQty(mtoItem.quantity, unit)}
      </td>
      <td className="px-4 py-3 text-right text-sm font-mono text-slate-700 whitespace-nowrap">
        {formatQty(mtoItem.quantity_used || 0, unit)}
      </td>
      <td className="px-4 py-3 text-right">
        <input
          id={inputId}
          type="number"
          min="0"
          max={mtoItem.quantity}
          value={inputValue !== undefined ? inputValue : originalValue}
          onChange={(e) => onChange(mtoItem.id, e.target.value)}
          aria-label={`New used quantity for ${name}`}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          className={cellInputClass(!!error)}
          disabled={saving || readOnly}
        />
        {error && (
          <p id={errorId} className="text-xs text-red-600 mt-1">
            {error}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        {hasChanges ? (
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => onCancel(mtoItem.id)}
              disabled={saving || readOnly}
              className={ICON_BTN}
              aria-label={`Cancel change for ${name}`}
              title="Cancel"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onSave(mtoId, mtoItem)}
              disabled={saving || readOnly || !!error}
              className={ICON_BTN_ACCENT}
              aria-label={`Save used quantity for ${name}`}
              title="Save"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <span className="text-sm text-slate-500">{EMPTY}</span>
        )}
      </td>
    </tr>
  );
}

// One materials-to-order accordion card: header (project, lots, status) and,
// when open, its items grouped by category.
function MtoCard({
  mto,
  tab,
  isExpanded,
  onToggle,
  quantityInputs,
  saving,
  isStatusMenuOpen,
  isUpdatingStatus,
  onToggleStatusMenu,
  onMarkCompleted,
  onQuantityChange,
  onCancelEdit,
  onSave,
}) {
  const panelId = `used-mto-${mto.id}`;
  const lotIds =
    mto.lots && mto.lots.length > 0
      ? mto.lots.map((lot) => lot.lot_id).join(", ")
      : EMPTY;
  const isCompleted = Boolean(mto.used_material_completed);
  const groupedItems = isExpanded ? groupItemsByCategory(mto.items || []) : {};

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      {/* Accordion header */}
      <div
        className={`flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition-colors ${
          isExpanded ? "rounded-t-lg" : "rounded-lg"
        }`}
      >
        <button
          type="button"
          onClick={() => onToggle(mto.id)}
          aria-expanded={isExpanded}
          aria-controls={isExpanded ? panelId : undefined}
          className="cursor-pointer flex items-center gap-3 flex-1 min-w-0 text-left rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-slate-500 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-800 truncate">
              {mto.project?.name || "Manually added"}
            </div>
            <div className="text-sm text-slate-500 mt-0.5">
              Lot ID: <span className="font-mono">{lotIds}</span>
            </div>
          </div>
        </button>

        {/* Used material status (one-way: active to completed) */}
        {tab === "upcoming" ? (
          <span className={`${BADGE} ${BADGE_TONES.warning} shrink-0`}>
            Upcoming
          </span>
        ) : !isCompleted ? (
          <div className="relative shrink-0" data-mto-status-dropdown>
            <button
              type="button"
              onClick={() => onToggleStatusMenu(mto.id)}
              disabled={isUpdatingStatus}
              aria-haspopup="true"
              aria-expanded={isStatusMenuOpen}
              className={BTN_SECONDARY_COMPACT}
              title="Mark these materials as completed"
            >
              <span
                className="h-2 w-2 rounded-full bg-blue-500"
                aria-hidden="true"
              />
              Active
              <ChevronDown className="w-4 h-4" aria-hidden="true" />
            </button>

            {isStatusMenuOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-300 rounded-lg z-40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => onMarkCompleted(mto.id, true)}
                  disabled={isUpdatingStatus}
                  className={`${MENU_ITEM} text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Mark completed
                  <Check className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <span className={`${BADGE} ${STATUS_COLORS.COMPLETED} shrink-0`}>
            Completed
          </span>
        )}
      </div>

      {/* Accordion content */}
      {isExpanded && (
        <div
          id={panelId}
          className="border-t border-slate-200 px-4 py-3 bg-slate-50 rounded-b-lg"
        >
          {Object.keys(groupedItems).length === 0 ? (
            <p className="text-sm text-slate-600 text-center py-4">
              No items in these materials to order
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupedItems).map(([category, items]) => (
                <div
                  key={category}
                  className="bg-white rounded-lg border border-slate-200 overflow-x-auto"
                >
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
                    <CategoryIcon category={category} />
                    <h3 className="text-sm font-semibold text-slate-700">
                      {formatLabel(category)}
                    </h3>
                    <span className="text-xs text-slate-500 ml-auto">
                      {items.length} {items.length === 1 ? "item" : "items"}
                    </span>
                  </div>
                  <table
                    className="w-full divide-y divide-slate-200"
                    aria-label={`${formatLabel(category)} items`}
                  >
                    <thead className="bg-slate-50">
                      <tr>
                        <th scope="col" className={`${TH} text-left`}>
                          Image
                        </th>
                        <th scope="col" className={`${TH} text-left`}>
                          Item
                        </th>
                        <th scope="col" className={`${TH} text-right`}>
                          Total
                        </th>
                        <th scope="col" className={`${TH} text-right`}>
                          Used
                        </th>
                        <th scope="col" className={`${TH} text-right`}>
                          New used
                        </th>
                        <th scope="col" className={`${TH} text-right`}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.map((mtoItem) => (
                        <MtoItemRow
                          key={mtoItem.id}
                          mtoId={mto.id}
                          mtoItem={mtoItem}
                          inputValue={quantityInputs[mtoItem.id]}
                          readOnly={tab === "upcoming"}
                          saving={saving}
                          onChange={onQuantityChange}
                          onCancel={onCancelEdit}
                          onSave={onSave}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Manual add modal: records USED stock transactions for picked items, with an
// optional project and lot. Its state lives here so it resets on close.
function ManualAddModal({
  projects,
  loadingProjects,
  projectsError,
  onReloadProjects,
  onClose,
  onSaved,
}) {
  const { getToken } = useAuth();
  const panelRef = useRef(null);
  const itemSearchRef = useRef(null);

  // Focus moves into the dialog, stays inside it, and returns to the trigger
  // on close (DESIGN.md 13.6).
  useModalFocus(panelRef, true);

  const [selectedCategory, setSelectedCategory] = useState("");
  const [allItems, setAllItems] = useState([]);
  const [itemSearch, setItemSearch] = useState("");
  const [showItemSearchResults, setShowItemSearchResults] = useState(false);
  const [searchNotice, setSearchNotice] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);
  const [manualNotes, setManualNotes] = useState("");
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedLotId, setSelectedLotId] = useState("");
  // Validate on submit, then on change: errors only exist once a submit was
  // attempted.
  const [submitted, setSubmitted] = useState(false);

  const selectedProject = projects.find(
    (project) => project.project_id === selectedProjectId,
  );
  const selectedProjectLots = selectedProject?.lots || [];

  const projectOptions = [
    { value: NO_PROJECT, label: "No project" },
    ...projects.map((project) => ({
      value: project.project_id,
      label: project.name,
      description: `Client: ${
        project.client?.client_name || "No client assigned"
      }`,
    })),
  ];
  const lotOptions = selectedProjectLots.map((lot) => ({
    value: lot.lot_id,
    label: lot.name || lot.lot_id,
    description: `${lot.lot_id}${
      lot.status ? ` · ${formatLabel(lot.status)}` : ""
    }`,
  }));

  const fetchItemsByCategory = async (category) => {
    try {
      setLoadingItems(true);
      setItemsError(null);
      setAllItems([]);
      setItemSearch("");
      const sessionToken = getToken();
      if (!sessionToken) {
        setItemsError(SESSION_ERROR);
        return;
      }

      const response = await axios.get(`/api/v1/item/all/${category}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.data.status) {
        setAllItems(response.data.data || []);
      } else {
        setItemsError(response.data.message || ITEMS_LOAD_ERROR);
        setAllItems([]);
      }
    } catch (err) {
      console.error(err);
      setItemsError(err.response?.data?.message || ITEMS_LOAD_ERROR);
      setAllItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  // Fetch items when a category is selected
  useEffect(() => {
    if (selectedCategory) {
      fetchItemsByCategory(selectedCategory);
    } else {
      setAllItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // Close search results on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        itemSearchRef.current &&
        !itemSearchRef.current.contains(event.target)
      ) {
        setShowItemSearchResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // A form with typed or chosen input must not close on a stray backdrop click.
  const isDirty =
    !!selectedCategory ||
    !!selectedProjectId ||
    selectedItems.length > 0 ||
    manualNotes.trim() !== "";

  // Modals close on Escape (DESIGN.md 9.4). An open dropdown handles its own
  // Escape; an open result list closes before the modal does.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape" || saving) return;
      if (e.target?.getAttribute?.("aria-expanded") === "true") return;
      if (showItemSearchResults && itemSearch && selectedCategory) {
        setShowItemSearchResults(false);
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [saving, showItemSearchResults, itemSearch, selectedCategory, onClose]);

  const filteredItems = allItems.filter((item) => {
    if (!itemSearch) return false;
    const searchLower = itemSearch.toLowerCase();

    const matchesCategory = item.category?.toLowerCase().includes(searchLower);
    const matchesDesc = item.description?.toLowerCase().includes(searchLower);

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

    return matchesCategory || matchesDesc || matchesDetails;
  });

  const handleProjectChange = (projectId) => {
    setSelectedProjectId(projectId === NO_PROJECT ? "" : projectId);
    // A different project has different lots, so the lot choice is dropped.
    setSelectedLotId("");
  };

  // Handle add item to table
  const handleAddItem = (item) => {
    // Check if already added
    if (selectedItems.some((i) => i.item_id === item.item_id)) {
      setSearchNotice("That item is already in the list.");
      setShowItemSearchResults(false);
      return;
    }

    setSelectedItems((prev) => [
      ...prev,
      {
        ...item,
        item_id: item.item_id,
        stock_quantity: item.quantity, // Preserve original stock quantity
        quantity: 1, // Default quantity
      },
    ]);
    setSearchNotice("");
    setItemSearch("");
    setShowItemSearchResults(false);
  };

  // Handle update item quantity
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

  // Handle remove item from table
  const handleRemoveItem = (itemId) => {
    setSelectedItems((prev) => prev.filter((item) => item.item_id !== itemId));
  };

  // The message for one row's quantity, or null when it is valid.
  const getRowError = (item) => {
    const requestedQty = parseFloat(item.quantity);
    if (!item.quantity || !(requestedQty > 0)) {
      return "Enter a quantity above 0.";
    }
    const availableQty = item.stock_quantity ?? item.quantity;
    if (requestedQty > availableQty) {
      return `Only ${formatQty(availableQty, item.measurement_unit)} in stock.`;
    }
    return null;
  };

  const validate = () => {
    const errs = {};
    if (selectedProjectId && !selectedLotId) {
      errs.lot = "Select a lot for this project.";
    }
    if (selectedItems.length === 0) {
      errs.items = selectedCategory
        ? "Add at least one item."
        : "Select a category, then add at least one item.";
    } else if (selectedItems.some((item) => getRowError(item))) {
      errs.items = "Fix the quantities marked below.";
    }
    return errs;
  };

  const errors = submitted ? validate() : {};

  // Save manual material used
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);

    if (Object.keys(validate()).length > 0) {
      // Move focus to the first invalid field once the errors have rendered.
      setTimeout(() => {
        const target =
          panelRef.current?.querySelector('[aria-invalid="true"]') ||
          document.getElementById(
            selectedCategory ? "used-manual-search" : "used-manual-category",
          );
        target?.focus();
      }, 0);
      return;
    }

    try {
      setSaving(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR, TOAST_OPTIONS);
        return;
      }

      // Create stock transactions for all items
      const promises = selectedItems.map((item) =>
        axios.post(
          `/api/v1/stock_transaction/create`,
          {
            item_id: item.item_id,
            quantity: parseFloat(item.quantity),
            type: "USED",
            notes: manualNotes || `Manually recorded used quantity`,
            project_id: selectedProjectId || null,
            lot_id: selectedLotId || null,
          },
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              "Content-Type": "application/json",
            },
          },
        ),
      );

      const results = await Promise.allSettled(promises);
      const failed = results.filter(
        (r) => r.status === "rejected" || !r.value?.data?.status,
      );

      if (failed.length > 0) {
        toast.error(
          `Couldn't record ${failed.length} ${
            failed.length === 1 ? "item" : "items"
          }. Try again.`,
          { position: "top-right", autoClose: 5000 },
        );
      } else {
        toast.success("Material used recorded.", TOAST_OPTIONS);
        onClose();
        await onSaved();
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Couldn't record the material used. Check your connection and try again.",
        TOAST_OPTIONS,
      );
    } finally {
      setSaving(false);
    }
  };

  const lotInvalid = !!errors.lot;
  const categoryInvalid = !!errors.items && !selectedCategory;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
      onClick={() => {
        if (!isDirty && !saving) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="used-manual-title"
        className="bg-white w-full max-w-6xl rounded-xl border border-slate-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2
            id="used-manual-title"
            className="text-lg font-semibold text-slate-800"
          >
            Manually add material used
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={ICON_BTN}
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
            {/* Project and lot */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div onKeyDown={blockEnterSubmit}>
                <label htmlFor="used-manual-project" className={LABEL}>
                  Project
                </label>
                <CustomDropdown
                  id="used-manual-project"
                  options={projectOptions}
                  value={selectedProjectId}
                  onChange={handleProjectChange}
                  placeholder="Search or select a project"
                  searchable
                  disabled={saving}
                  loading={loadingProjects}
                  loadingText="Loading projects…"
                  emptyText="No matching projects"
                  describedBy={
                    projectsError ? "used-manual-project-error" : undefined
                  }
                />
                {projectsError && (
                  <div
                    id="used-manual-project-error"
                    role="alert"
                    className="mt-1 flex items-center gap-2 text-xs text-red-600"
                  >
                    <span>{projectsError}</span>
                    <button
                      type="button"
                      onClick={onReloadProjects}
                      className="cursor-pointer font-medium underline rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      Try again
                    </button>
                  </div>
                )}
              </div>

              {selectedProjectId && (
                <div onKeyDown={blockEnterSubmit}>
                  <label htmlFor="used-manual-lot" className={LABEL}>
                    Lot{" "}
                    <span className="text-red-600" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <CustomDropdown
                    id="used-manual-lot"
                    options={lotOptions}
                    value={selectedLotId}
                    onChange={setSelectedLotId}
                    placeholder="Search or select a lot"
                    searchable
                    disabled={saving}
                    emptyText="No matching lots"
                    invalid={lotInvalid}
                    describedBy={
                      lotInvalid ? "used-manual-lot-error" : undefined
                    }
                  />
                  {lotInvalid && (
                    <p
                      id="used-manual-lot-error"
                      className="text-xs text-red-600 mt-1"
                    >
                      {errors.lot}
                    </p>
                  )}
                </div>
              )}
            </div>

            <hr className="border-slate-200" />

            {/* Item selection and list */}
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

              {/* Category dropdown and search bar */}
              <div className="mb-4 flex flex-col md:flex-row gap-4">
                <div className="md:w-56 shrink-0" onKeyDown={blockEnterSubmit}>
                  <label htmlFor="used-manual-category" className={LABEL}>
                    Category{" "}
                    <span className="text-red-600" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <CustomDropdown
                    id="used-manual-category"
                    options={CATEGORY_OPTIONS}
                    value={selectedCategory}
                    onChange={setSelectedCategory}
                    placeholder="Select a category"
                    disabled={saving}
                    invalid={categoryInvalid}
                    describedBy={
                      categoryInvalid ? "used-manual-items-error" : undefined
                    }
                  />
                </div>

                <div className="relative flex-1" ref={itemSearchRef}>
                  <label htmlFor="used-manual-search" className={LABEL}>
                    Search items
                  </label>
                  <div className="relative">
                    <Search
                      className="absolute inset-y-0 left-3 my-auto w-4 h-4 text-slate-500 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="used-manual-search"
                      type="text"
                      placeholder={
                        selectedCategory
                          ? "Search items by name, category or brand"
                          : "Select a category to search items"
                      }
                      value={itemSearch}
                      onChange={(e) => {
                        setItemSearch(e.target.value);
                        setSearchNotice("");
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
                      disabled={!selectedCategory || saving}
                      className={fieldClass(false, "py-3 pr-4 pl-10")}
                    />
                  </div>
                  {searchNotice && (
                    <p role="status" className="text-xs text-slate-500 mt-1">
                      {searchNotice}
                    </p>
                  )}

                  {/* Search results */}
                  {showItemSearchResults && itemSearch && selectedCategory && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-300 rounded-lg z-40 max-h-60 overflow-y-auto">
                      {loadingItems ? (
                        <div
                          role="status"
                          className="p-4 text-center text-slate-600 text-sm"
                        >
                          Loading items…
                        </div>
                      ) : itemsError ? (
                        <div
                          role="alert"
                          className="p-4 text-center text-red-600 text-sm"
                        >
                          {itemsError}
                        </div>
                      ) : filteredItems.length === 0 ? (
                        <div className="p-4 text-center text-slate-600 text-sm">
                          No items found
                        </div>
                      ) : (
                        <ul className="divide-y divide-slate-200">
                          {filteredItems.map((item) => (
                            <li key={item.item_id}>
                              <button
                                type="button"
                                onClick={() => handleAddItem(item)}
                                className="cursor-pointer w-full text-left p-3 hover:bg-slate-50 transition-colors duration-200 flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                              >
                                <ItemThumb image={item.image} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-800">
                                    {getItemDisplayName(item)}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {formatLabel(item.category) || EMPTY} •
                                    Stock:{" "}
                                    {formatQty(
                                      item.quantity,
                                      item.measurement_unit,
                                    )}
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

              {/* Selected items table */}
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className={`${TH} text-left`}>
                        Image
                      </th>
                      <th scope="col" className={`${TH} text-left`}>
                        Category
                      </th>
                      <th scope="col" className={`${TH} text-left`}>
                        Details
                      </th>
                      <th scope="col" className={`${TH} text-right`}>
                        In stock
                      </th>
                      <th scope="col" className={`${TH} text-right`}>
                        Quantity
                      </th>
                      <th scope="col" className={`${TH} text-right`}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center">
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
                        const rowError = submitted ? getRowError(item) : null;
                        const qtyId = `used-manual-qty-${item.item_id}`;
                        return (
                          <tr
                            key={item.item_id}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <ItemThumb image={item.image} />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <CategoryBadge category={item.category} />
                            </td>
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
                                {detailRows.length === 0 && (
                                  <div>{dash(item.description)}</div>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-mono text-slate-700">
                              {formatQty(
                                item.stock_quantity ?? item.quantity,
                                item.measurement_unit,
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <input
                                id={qtyId}
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
                                aria-invalid={!!rowError}
                                aria-describedby={
                                  rowError ? `${qtyId}-error` : undefined
                                }
                                className={cellInputClass(!!rowError)}
                                disabled={saving}
                              />
                              {rowError && (
                                <p
                                  id={`${qtyId}-error`}
                                  className="text-xs text-red-600 mt-1"
                                >
                                  {rowError}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item.item_id)}
                                className={ICON_BTN_DANGER}
                                disabled={saving}
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
                <p
                  id="used-manual-items-error"
                  className="text-xs text-red-600 mt-1"
                >
                  {errors.items}
                </p>
              )}
            </div>

            <hr className="border-slate-200" />

            {/* Notes */}
            <div>
              <label htmlFor="used-manual-notes" className={LABEL}>
                Notes
              </label>
              <textarea
                id="used-manual-notes"
                rows={5}
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                className={`${fieldClass(false)} resize-none`}
                placeholder="e.g. Offcuts used on the island bench"
                disabled={saving}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 shrink-0">
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
                <Check className="w-4 h-4" aria-hidden="true" />
              )}
              Save material used
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsedMaterialPage() {
  const { getToken } = useAuth();
  const [mtos, setMtos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedMto, setExpandedMto] = useState(null);
  const [quantityInputs, setQuantityInputs] = useState({});
  const [saving, setSaving] = useState(false);
  const [recentUsage, setRecentUsage] = useState([]);
  const [loadingRecentUsage, setLoadingRecentUsage] = useState(false);
  const [recentError, setRecentError] = useState(null);
  const [recentSearch, setRecentSearch] = useState("");
  const [recentCategoryFilter, setRecentCategoryFilter] = useState("");
  const [recentProjectFilter, setRecentProjectFilter] = useState("");
  const [recentLotFilter, setRecentLotFilter] = useState("");
  const [recentPage, setRecentPage] = useState(1);
  const [recentItemsPerPage, setRecentItemsPerPage] = useState(50);
  const [openRecentFilter, setOpenRecentFilter] = useState(null);
  const [mtoPage, setMtoPage] = useState(1);
  const [mtoItemsPerPage, setMtoItemsPerPage] = useState(50);

  // Used material MTO completion (active / upcoming / completed) UI
  const [mtoTab, setMtoTab] = useState("active"); // recent | active | upcoming | completed
  const [openMtoStatusDropdownId, setOpenMtoStatusDropdownId] = useState(null);
  const [updatingMtoStatusId, setUpdatingMtoStatusId] = useState(null);

  // Manual add modal
  const [showManualAddModal, setShowManualAddModal] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectsError, setProjectsError] = useState(null);

  useEffect(() => {
    fetchMTOs();
    fetchProjectsWithAllActiveLots();
    fetchRecentUsage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRecentUsage = async () => {
    try {
      setLoadingRecentUsage(true);
      setRecentError(null);
      const sessionToken = getToken();
      if (!sessionToken) {
        setRecentError(SESSION_ERROR);
        return;
      }

      const response = await axios.get("/api/v1/stock_transaction/used", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.data.status) {
        setRecentUsage(response.data.data || []);
      } else {
        setRecentError(response.data.message || USAGE_LOAD_ERROR);
      }
    } catch (error) {
      console.error("Error fetching recent material usage:", error);
      setRecentError(error.response?.data?.message || USAGE_LOAD_ERROR);
    } finally {
      setLoadingRecentUsage(false);
    }
  };

  const fetchProjectsWithAllActiveLots = async () => {
    try {
      setLoadingProjects(true);
      setProjectsError(null);
      const sessionToken = getToken();
      if (!sessionToken) {
        setProjectsError(SESSION_ERROR);
        return;
      }

      const response = await axios.get("/api/v1/project/all", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        // Include every project that has lots so each lot can be selected.
        const filteredProjects = response.data.data.filter((project) => {
          const lots = project.lots || [];
          if (lots.length === 0) return false;
          return true;
        });
        setProjects(filteredProjects);
      } else {
        setProjectsError(response.data.message || PROJECTS_LOAD_ERROR);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      setProjectsError(error.response?.data?.message || PROJECTS_LOAD_ERROR);
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchMTOs = async () => {
    try {
      setLoading(true);
      setError(null);
      const sessionToken = getToken();
      if (!sessionToken) {
        setError(SESSION_ERROR);
        return;
      }

      const response = await axios.get(
        "/api/v1/materials_to_order/used_material_list",
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );

      if (response.data.status) {
        // Store both ready_to_use and upcoming MTOs
        const { ready_to_use, upcoming } = response.data.data;
        // Combine both for compatibility with existing code
        setMtos([...ready_to_use, ...upcoming]);
      } else {
        setError(response.data.message || MTO_LOAD_ERROR);
      }
    } catch (error) {
      console.error("Error fetching MTOs:", error);
      setError(error.response?.data?.message || MTO_LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const toggleAccordion = (mtoId) => {
    setExpandedMto(expandedMto === mtoId ? null : mtoId);
  };

  // Close the status and filter menus when clicking outside or pressing Escape.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest("[data-mto-status-dropdown]")) {
        setOpenMtoStatusDropdownId(null);
      }
      if (!event.target.closest("[data-recent-filter-dropdown]")) {
        setOpenRecentFilter(null);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpenMtoStatusDropdownId(null);
        setOpenRecentFilter(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleUpdateMtoUsedMaterialStatus = async (mtoId, completed) => {
    try {
      setUpdatingMtoStatusId(mtoId);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR, TOAST_OPTIONS);
        return;
      }

      const response = await axios.patch(
        `/api/v1/materials_to_order/${mtoId}`,
        { used_material_completed: completed },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status) {
        const updatedMto = response?.data?.data;
        setMtos((prev) =>
          prev.map((mto) => (mto.id === mtoId ? updatedMto || mto : mto)),
        );
        if (expandedMto === mtoId) setExpandedMto(null);
        setOpenMtoStatusDropdownId(null);
        toast.success(
          `Materials to order marked as ${completed ? "completed" : "active"}.`,
          { position: "top-right", autoClose: 2500 },
        );
      } else {
        toast.error(
          response.data.message ||
            "Couldn't update the status. Check your connection and try again.",
          TOAST_OPTIONS,
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Couldn't update the status. Check your connection and try again.",
        TOAST_OPTIONS,
      );
    } finally {
      setUpdatingMtoStatusId(null);
    }
  };

  const handleQuantityInputChange = (mtoItemId, value) => {
    setQuantityInputs((prev) => ({
      ...prev,
      [mtoItemId]: value,
    }));
  };

  // Initialize quantity inputs when MTOs are loaded
  useEffect(() => {
    if (mtos.length > 0) {
      const initialInputs = {};
      mtos.forEach((mto) => {
        mto.items?.forEach((item) => {
          // Store as string to allow empty input during editing
          initialInputs[item.id] = String(item.quantity_used || 0);
        });
      });
      setQuantityInputs(initialInputs);
    }
  }, [mtos]);

  const handleCancelEdit = (mtoItemId) => {
    // Reset to original value
    const mtoItem = mtos
      .flatMap((mto) => mto.items || [])
      .find((item) => item.id === mtoItemId);
    if (mtoItem) {
      setQuantityInputs((prev) => ({
        ...prev,
        [mtoItemId]: String(mtoItem.quantity_used || 0),
      }));
    }
  };

  const handleSaveUsage = async (mtoId, mtoItem) => {
    try {
      setSaving(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR, TOAST_OPTIONS);
        return;
      }

      // The field shows its own inline error (invalid number, below the
      // quantity already used, or above the total) and keeps Save disabled, so
      // an invalid value never gets this far.
      if (getUsedQtyError(quantityInputs[mtoItem.id], mtoItem)) return;

      // Parse string input to number, treating empty string as 0
      const inputString = quantityInputs[mtoItem.id] || "";
      const inputValue = inputString === "" ? 0 : parseFloat(inputString);
      const currentUsed = mtoItem.quantity_used || 0;

      // Calculate the increment (difference between new and current)
      const increment = inputValue - currentUsed;

      // If no change, do nothing
      if (increment <= 0) {
        return;
      }

      // Validate that item has item_id
      const itemId = mtoItem.item?.item_id;
      if (!itemId) {
        toast.error(
          "Couldn't find the item ID, so the stock transaction wasn't created.",
          TOAST_OPTIONS,
        );
        return;
      }

      // Create stock transaction with type USED
      const response = await axios.post(
        `/api/v1/stock_transaction/create`,
        {
          item_id: itemId,
          quantity: parseFloat(increment),
          type: "USED",
          materials_to_order_id: mtoId,
        },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status) {
        toast.success("Quantity used updated.", TOAST_OPTIONS);
        // Refresh MTOs
        await fetchMTOs();
        await fetchRecentUsage();
      } else {
        toast.error(
          response.data.message ||
            "Couldn't update the quantity used. Check your connection and try again.",
          TOAST_OPTIONS,
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Couldn't update the quantity used. Check your connection and try again.",
        TOAST_OPTIONS,
      );
    } finally {
      setSaving(false);
    }
  };

  // Filter MTOs by status and readiness
  const activeMtos = mtos.filter(
    (mto) => !Boolean(mto.used_material_completed) && mto.is_ready === true,
  );
  const upcomingMtos = mtos.filter(
    (mto) => !Boolean(mto.used_material_completed) && mto.is_ready === false,
  );
  const completedMtos = mtos.filter((mto) =>
    Boolean(mto.used_material_completed),
  );

  const displayedMtos =
    mtoTab === "completed"
      ? completedMtos
      : mtoTab === "upcoming"
        ? upcomingMtos
        : activeMtos;

  const mtoStart = mtoItemsPerPage === 0 ? 0 : (mtoPage - 1) * mtoItemsPerPage;
  const paginatedMtos = displayedMtos.slice(
    mtoStart,
    mtoItemsPerPage === 0 ? undefined : mtoStart + mtoItemsPerPage,
  );

  const tabCounts = {
    recent: recentUsage.length,
    active: activeMtos.length,
    upcoming: upcomingMtos.length,
    completed: completedMtos.length,
  };

  const recentCategoryOptions = [
    ...new Set(
      recentUsage
        .map((transaction) => transaction.item?.category)
        .filter(Boolean),
    ),
  ];
  const recentProjectOptions = [
    ...new Map(
      recentUsage
        .map((transaction) => getUsageLocation(transaction))
        .filter((location) => location.projectId)
        .map((location) => [location.projectId, location]),
    ).values(),
  ];
  const recentLotOptions = [
    ...new Map(
      recentUsage
        .flatMap((transaction) => getUsageLocation(transaction).lots)
        .map((lot) => [lot.lot_id, lot]),
    ).values(),
  ];
  const normalizedRecentSearch = recentSearch.trim().toLowerCase();
  const filteredRecentUsage = recentUsage.filter((transaction) => {
    const itemDetails = getItemDetails(transaction.item);
    const location = getUsageLocation(transaction);
    const searchableText = [
      itemDetails?.name,
      itemDetails?.brand,
      itemDetails?.color,
      itemDetails?.finish,
      itemDetails?.type,
      itemDetails?.dimensions,
      transaction.item?.description,
      transaction.item?.category,
      location.project,
      location.projectId,
      ...location.lots.flatMap((lot) => [lot.name, lot.lot_id]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      (!normalizedRecentSearch ||
        searchableText.includes(normalizedRecentSearch)) &&
      (!recentCategoryFilter ||
        transaction.item?.category === recentCategoryFilter) &&
      (!recentProjectFilter || location.projectId === recentProjectFilter) &&
      (!recentLotFilter ||
        location.lots.some((lot) => lot.lot_id === recentLotFilter))
    );
  });
  const paginatedRecentUsage = filteredRecentUsage.slice(
    recentItemsPerPage === 0 ? 0 : (recentPage - 1) * recentItemsPerPage,
    recentItemsPerPage === 0 ? undefined : recentPage * recentItemsPerPage,
  );
  const hasRecentFilters = !!(
    recentSearch ||
    recentCategoryFilter ||
    recentProjectFilter ||
    recentLotFilter
  );

  useEffect(() => {
    setRecentPage(1);
  }, [
    recentSearch,
    recentCategoryFilter,
    recentProjectFilter,
    recentLotFilter,
    recentItemsPerPage,
  ]);

  useEffect(() => {
    setMtoPage(1);
  }, [mtoTab, mtoItemsPerPage]);

  const clearRecentFilters = () => {
    setRecentSearch("");
    setRecentCategoryFilter("");
    setRecentProjectFilter("");
    setRecentLotFilter("");
  };

  const recentFilters = [
    {
      id: "category",
      label: "All categories",
      value: recentCategoryFilter,
      options: [
        { value: "", label: "All categories" },
        ...recentCategoryOptions.map((category) => ({
          value: category,
          label: formatLabel(category),
        })),
      ],
      onChange: setRecentCategoryFilter,
    },
    {
      id: "project",
      label: "All projects",
      value: recentProjectFilter,
      options: [
        { value: "", label: "All projects" },
        ...recentProjectOptions.map((project) => ({
          value: project.projectId,
          label: `${project.project} (${project.projectId})`,
        })),
      ],
      onChange: setRecentProjectFilter,
    },
    {
      id: "lot",
      label: "All lots",
      value: recentLotFilter,
      options: [
        { value: "", label: "All lots" },
        ...recentLotOptions.map((lot) => ({
          value: lot.lot_id,
          label: `${lot.name || lot.lot_id} (${lot.lot_id})`,
        })),
      ],
      onChange: setRecentLotFilter,
    },
  ];

  const openManualAddModal = () => setShowManualAddModal(true);

  const renderRecentTab = () => {
    if (loadingRecentUsage) {
      return <LoadingState label="Loading usage logs…" />;
    }
    if (recentError) {
      return <ErrorState message={recentError} onRetry={fetchRecentUsage} />;
    }
    if (recentUsage.length === 0) {
      return (
        <EmptyState
          icon={History}
          message="No materials have been used yet"
          action={
            <button
              type="button"
              onClick={openManualAddModal}
              className={BTN_SECONDARY_COMPACT}
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Manually add material used
            </button>
          }
        />
      );
    }

    return (
      <>
        <div className="p-4 shrink-0 border-b border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-64 max-w-2xl relative">
              <Search
                className="h-4 w-4 absolute left-3 text-slate-400 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                aria-label="Search recently used materials"
                value={recentSearch}
                onChange={(event) => setRecentSearch(event.target.value)}
                placeholder="Search by material, project or lot"
                className="w-full text-sm text-slate-800 py-2 pr-3 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasRecentFilters && (
                <button
                  type="button"
                  onClick={clearRecentFilters}
                  className={BTN_TOOLBAR}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>Clear filters</span>
                </button>
              )}
              {recentFilters.map(({ onChange, ...filter }) => (
                <FilterMenu
                  key={filter.id}
                  {...filter}
                  isOpen={openRecentFilter === filter.id}
                  onToggle={(id) =>
                    setOpenRecentFilter((current) =>
                      current === id ? null : id,
                    )
                  }
                  onSelect={(id, value) => {
                    onChange(value);
                    setOpenRecentFilter(null);
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {filteredRecentUsage.length === 0 ? (
            <EmptyState
              message="No materials match your filters"
              action={
                <button
                  type="button"
                  onClick={clearRecentFilters}
                  className={BTN_SECONDARY_COMPACT}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  Clear filters
                </button>
              }
            />
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th scope="col" className={`${TH} text-left`}>
                    Image
                  </th>
                  <th scope="col" className={`${TH} text-left`}>
                    Material
                  </th>
                  <th scope="col" className={`${TH} text-left`}>
                    Category
                  </th>
                  <th scope="col" className={`${TH} text-right`}>
                    Quantity
                  </th>
                  <th scope="col" className={`${TH} text-left`}>
                    Used at
                  </th>
                  <th scope="col" className={`${TH} text-left`}>
                    Project
                  </th>
                  <th scope="col" className={`${TH} text-left`}>
                    Lot
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {paginatedRecentUsage.map((transaction) => {
                  const itemDetails = getItemDetails(transaction.item);
                  const location = getUsageLocation(transaction);
                  const description =
                    [
                      itemDetails?.brand,
                      itemDetails?.color,
                      itemDetails?.finish,
                      itemDetails?.type,
                      itemDetails?.dimensions,
                    ]
                      .filter(Boolean)
                      .join(" · ") ||
                    transaction.item?.description ||
                    EMPTY;
                  return (
                    <tr
                      key={transaction.id}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <ItemThumb image={transaction.item?.image} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-slate-700">
                          {itemDetails?.name || EMPTY}
                        </div>
                        <div className="text-xs text-slate-500">
                          {description}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <CategoryBadge category={transaction.item?.category} />
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-mono font-medium text-slate-700 whitespace-nowrap">
                        {formatQty(
                          transaction.quantity,
                          transaction.item?.measurement_unit,
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                        {transaction.createdAt
                          ? DATE_TIME.format(new Date(transaction.createdAt))
                          : EMPTY}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {location.projectId ? (
                          <>
                            <Link
                              href={`/admin/projects/${location.projectId}`}
                              className="font-medium text-primary rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              {location.project}
                            </Link>
                            <div className="text-xs font-mono text-slate-500">
                              ID: {location.projectId}
                            </div>
                          </>
                        ) : (
                          <span
                            className="text-slate-500"
                            title="Not linked to a project"
                          >
                            {EMPTY}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {location.lots.length > 0 ? (
                          <div className="space-y-1">
                            {location.lots.map((lot) => (
                              <div key={lot.lot_id}>
                                <div>{lot.name || lot.lot_id}</div>
                                <div className="text-xs font-mono text-slate-500">
                                  ID: {lot.lot_id}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span
                            className="text-slate-500"
                            title="Not linked to a lot"
                          >
                            {EMPTY}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {filteredRecentUsage.length > 0 && (
          <PaginationFooter
            totalItems={filteredRecentUsage.length}
            itemsPerPage={recentItemsPerPage}
            currentPage={recentPage}
            onPageChange={setRecentPage}
            onItemsPerPageChange={setRecentItemsPerPage}
          />
        )}
      </>
    );
  };

  const renderMtoTab = () => {
    if (loading) {
      return <LoadingState label="Loading materials to order…" />;
    }
    if (error) {
      return <ErrorState message={error} onRetry={fetchMTOs} />;
    }
    if (mtos.length === 0) {
      return <EmptyState message="No materials to order yet" />;
    }
    if (displayedMtos.length === 0) {
      return <EmptyState message={MTO_EMPTY_MESSAGES[mtoTab]} />;
    }

    return (
      <>
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-2">
            {paginatedMtos.map((mto) => (
              <MtoCard
                key={mto.id}
                mto={mto}
                tab={mtoTab}
                isExpanded={expandedMto === mto.id}
                onToggle={toggleAccordion}
                quantityInputs={quantityInputs}
                saving={saving}
                isStatusMenuOpen={openMtoStatusDropdownId === mto.id}
                isUpdatingStatus={updatingMtoStatusId === mto.id}
                onToggleStatusMenu={(id) =>
                  setOpenMtoStatusDropdownId((prev) =>
                    prev === id ? null : id,
                  )
                }
                onMarkCompleted={handleUpdateMtoUsedMaterialStatus}
                onQuantityChange={handleQuantityInputChange}
                onCancelEdit={handleCancelEdit}
                onSave={handleSaveUsage}
              />
            ))}
          </div>
        </div>

        <PaginationFooter
          totalItems={displayedMtos.length}
          itemsPerPage={mtoItemsPerPage}
          currentPage={mtoPage}
          onPageChange={setMtoPage}
          onItemsPerPageChange={setMtoItemsPerPage}
        />
      </>
    );
  };

  return (
    <AdminShell>
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="px-4 py-2 shrink-0 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-slate-800">
            Used material
          </h1>
          <div className="flex items-center gap-2">
            <SearchBar />
            <button
              type="button"
              onClick={openManualAddModal}
              className={BTN_PRIMARY}
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Manually add material used
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
          <div className="bg-white rounded-lg border border-slate-200 flex flex-col h-full overflow-hidden">
            {/* Tabs section */}
            <div className="px-4 shrink-0 border-b border-slate-200">
              <div
                className="flex space-x-6 overflow-x-auto"
                role="tablist"
                aria-label="Used material view"
              >
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`used-tab-${tab.id}`}
                    aria-selected={mtoTab === tab.id}
                    aria-controls="used-panel"
                    onClick={() => setMtoTab(tab.id)}
                    className={tabClass(mtoTab === tab.id)}
                  >
                    <span className="flex items-center gap-2">
                      {tab.label}
                      {tabCounts[tab.id] > 0 && (
                        <span className={COUNT_BADGE}>{tabCounts[tab.id]}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tab panel */}
            <div
              id="used-panel"
              role="tabpanel"
              aria-labelledby={`used-tab-${mtoTab}`}
              className="flex-1 min-h-0 flex flex-col overflow-hidden"
            >
              {mtoTab === "recent" ? renderRecentTab() : renderMtoTab()}
            </div>
          </div>
        </div>
      </main>

      {showManualAddModal && (
        <ManualAddModal
          projects={projects}
          loadingProjects={loadingProjects}
          projectsError={projectsError}
          onReloadProjects={fetchProjectsWithAllActiveLots}
          onClose={() => setShowManualAddModal(false)}
          onSaved={fetchRecentUsage}
        />
      )}
    </AdminShell>
  );
}
