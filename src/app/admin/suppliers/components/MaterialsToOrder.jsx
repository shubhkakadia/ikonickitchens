"use client";
import React, { useEffect, useId, useState, useMemo, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertTriangle,
  Plus,
  Package,
  ChevronDown,
  Calendar,
  FileText,
  FileUp,
  Paperclip,
  Trash2,
  X,
  File,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import Image from "next/image";
import PurchaseOrderForm from "./PurchaseOrderForm";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import useModalFocus from "@/hooks/useModalFocus";
import {
  BADGE,
  BADGE_TONES,
  COUNT_BADGE,
  STATUS_COLORS,
  formatQty,
  formatTime,
} from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";

const EMPTY = "—";
const LOAD_ERROR =
  "Couldn't load materials to order. Check your connection and try again.";
const SESSION_ERROR = "Your session has expired. Sign in again to continue.";

const ACTIVE_STATUSES = ["DRAFT", "PARTIALLY_ORDERED"];
const COMPLETED_STATUSES = ["FULLY_ORDERED", "CLOSED"];

// Button, field and table recipes from DESIGN.md 9.1 / 9.2 / 9.5 (compact).
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const ICON_BTN =
  "cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const FIELD_COMPACT =
  "text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors duration-200 disabled:bg-slate-50 disabled:text-slate-600 disabled:cursor-not-allowed";
const TH =
  "px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider";

// Which attributes to list for each item category, in display order.
const DETAIL_FIELDS = {
  sheet: [
    ["Brand", "brand"],
    ["Colour", "color"],
    ["Finish", "finish"],
    ["Face", "face"],
    ["Dimensions", "dimensions"],
  ],
  handle: [
    ["Brand", "brand"],
    ["Colour", "color"],
    ["Type", "type"],
    ["Dimensions", "dimensions"],
    ["Material", "material"],
  ],
  hardware: [
    ["Brand", "brand"],
    ["Name", "name"],
    ["Type", "type"],
    ["Dimensions", "dimensions"],
    ["Sub category", "sub_category"],
  ],
  accessory: [["Name", "name"]],
  edging_tape: [
    ["Brand", "brand"],
    ["Colour", "color"],
    ["Finish", "finish"],
    ["Dimensions", "dimensions"],
  ],
};

// A created date without a year is ambiguous on a record, so this keeps the
// year (the shared formatDate is the compact day + month form).
const formatCreated = (value) => {
  if (!value) return EMPTY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY;
  const day = date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = formatTime(value);
  return time ? `${day}, ${time}` : day;
};

const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};

const isImageFile = (file) =>
  file.mime_type?.includes("image") || file.file_type === "image";
const isVideoFile = (file) =>
  file.mime_type?.includes("video") || file.file_type === "video";
const isPdfFile = (file) =>
  file.mime_type?.includes("pdf") ||
  file.file_type === "pdf" ||
  file.extension === "pdf";

// If a purchase order already covers the line, show its quantity instead of the
// manually entered one.
const defaultQuantityOrdered = (entry) =>
  entry.quantity_ordered_po && Number(entry.quantity_ordered_po) > 0
    ? entry.quantity_ordered_po
    : (entry.quantity_ordered ?? 0);

// A short name for an MTO line, used to label its quantity field.
const itemLabel = (entry) => {
  const detail =
    entry.item?.sheet ||
    entry.item?.handle ||
    entry.item?.hardware ||
    entry.item?.accessory ||
    entry.item?.edging_tape;
  const name = [detail?.brand, detail?.name || detail?.color]
    .filter(Boolean)
    .join(" ");
  return name || entry.item_id || formatLabel(entry.item?.category) || "item";
};

// Sortable column header. The label is a real button so the sort is reachable
// by keyboard (DESIGN.md 13.7); the active column carries the only indicator.
function SortHeader({
  field,
  label,
  sortField,
  sortOrder,
  onSort,
  alignRight = false,
}) {
  const isActive = sortField === field;
  const ariaSort = isActive
    ? sortOrder === "asc"
      ? "ascending"
      : "descending"
    : undefined;
  const Icon = !isActive
    ? ArrowUpDown
    : sortOrder === "asc"
      ? ArrowUp
      : ArrowDown;

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`${TH} ${alignRight ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`cursor-pointer flex items-center gap-2 uppercase tracking-wider hover:text-slate-700 transition-colors duration-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary ${
          alignRight ? "ml-auto" : ""
        }`}
      >
        {label}
        <Icon
          className={`w-4 h-4 ${isActive ? "text-primary" : "text-slate-400"}`}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

// Item thumbnail with a placeholder when there is no image or it fails to load.
function ItemThumb({ entry }) {
  const [failed, setFailed] = useState(false);
  const url = entry.item?.image?.url;

  if (!url || failed) {
    return (
      <div className="w-10 h-10 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
        <Package className="w-5 h-5 text-slate-400" aria-hidden="true" />
      </div>
    );
  }

  return (
    <Image
      loading="lazy"
      src={`/${url}`}
      alt={entry.item_id || entry.item?.category || "Item image"}
      className="w-10 h-10 object-cover rounded-lg border border-slate-200"
      onError={() => setFailed(true)}
      width={40}
      height={40}
    />
  );
}

// One collapsible group of uploaded files (images, videos, PDFs, other).
function FileCategorySection({
  title,
  files,
  isSmall = false,
  sectionKey,
  isExpanded,
  onToggle,
  onView,
  onDelete,
  deletingMediaId,
}) {
  if (files.length === 0) return null;

  const panelId = `mto-files-${sectionKey}`;

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => onToggle(sectionKey)}
        aria-expanded={isExpanded}
        aria-controls={panelId}
        className="cursor-pointer w-full flex items-center justify-between text-sm font-semibold text-slate-700 mb-3 hover:text-slate-900 transition-colors duration-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        <span>
          {title} ({files.length})
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {isExpanded && (
        <div id={panelId} className="flex flex-wrap gap-3">
          {files.map((file) => (
            <div
              key={file.id}
              className={`relative bg-white border border-slate-200 hover:border-primary/25 rounded-lg transition-colors duration-200 ${
                isSmall ? "w-32" : "w-40"
              }`}
            >
              <button
                type="button"
                onClick={() => onView(file)}
                title="View file"
                className="cursor-pointer block w-full text-left p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <span
                  className={`flex w-full ${
                    isSmall ? "aspect-4/3" : "aspect-square"
                  } rounded-lg items-center justify-center mb-2 overflow-hidden bg-slate-50`}
                >
                  {isImageFile(file) ? (
                    <Image
                      height={100}
                      width={100}
                      src={`/${file.url}`}
                      alt=""
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : isVideoFile(file) ? (
                    <video
                      src={`/${file.url}`}
                      className="w-full h-full object-cover rounded-lg"
                      muted
                      playsInline
                    />
                  ) : isPdfFile(file) ? (
                    <FileText
                      className={`${isSmall ? "w-5 h-5" : "w-8 h-8"} text-slate-400`}
                      aria-hidden="true"
                    />
                  ) : (
                    <File
                      className={`${isSmall ? "w-5 h-5" : "w-8 h-8"} text-slate-400`}
                      aria-hidden="true"
                    />
                  )}
                </span>
                <span className="block space-y-1">
                  <span
                    className="block text-xs font-medium text-slate-700 truncate"
                    title={file.filename}
                  >
                    {file.filename || EMPTY}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {formatFileSize(file.size || 0)}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => onDelete(file.id)}
                disabled={deletingMediaId === file.id}
                aria-label={`Delete ${file.filename || "file"}`}
                title="Delete file"
                className="absolute top-2 right-2 cursor-pointer p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deletingMediaId === file.id ? (
                  <span
                    className="block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const GroupedItemsTable = ({
  items,
  mtoId,
  activeTab,
  onOpenPO,
  onUpdateQuantityOrdered,
}) => {
  const { getToken } = useAuth();
  const [quantityOrderedDraftById, setQuantityOrderedDraftById] = useState({});
  const [isSavingQuantityOrderedById, setIsSavingQuantityOrderedById] =
    useState({});
  const quantityOrderedTimersRef = useRef(new Map());

  // Initialize draft values (don't clobber what the user is typing)
  useEffect(() => {
    if (!Array.isArray(items)) return;
    setQuantityOrderedDraftById((prev) => {
      const next = { ...prev };
      items.forEach((it) => {
        if (it?.id && next[it.id] === undefined) {
          next[it.id] = String(defaultQuantityOrdered(it));
        }
      });
      return next;
    });
  }, [items]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      const timers = quantityOrderedTimersRef.current;
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const saveQuantityOrdered = async (mtoItemId, rawValue) => {
    const sessionToken = getToken();
    if (!sessionToken) {
      toast.error(SESSION_ERROR);
      return;
    }

    const parsed =
      rawValue === "" || rawValue === null || rawValue === undefined
        ? 0
        : Math.max(0, parseInt(rawValue, 10) || 0);

    setIsSavingQuantityOrderedById((prev) => ({ ...prev, [mtoItemId]: true }));
    try {
      const response = await axios.patch(
        `/api/v1/materials_to_order_item/${mtoItemId}`,
        { quantity_ordered: parsed },
        { headers: { Authorization: `Bearer ${sessionToken}` } },
      );

      if (!response?.data?.status) {
        throw new Error(
          response?.data?.message || "Failed to update quantity ordered",
        );
      }

      const saved = response?.data?.data?.quantity_ordered ?? parsed;
      setQuantityOrderedDraftById((prev) => ({
        ...prev,
        [mtoItemId]: String(saved),
      }));

      if (onUpdateQuantityOrdered)
        onUpdateQuantityOrdered(mtoId, mtoItemId, saved);
    } catch (err) {
      console.error("Failed to update quantity_ordered:", err);
      toast.error(
        err?.response?.data?.message ||
          "Couldn't save the quantity ordered. Check your connection and try again.",
      );
    } finally {
      setIsSavingQuantityOrderedById((prev) => ({
        ...prev,
        [mtoItemId]: false,
      }));
    }
  };

  const handleQuantityOrderedChange = (mtoItemId, nextValue) => {
    setQuantityOrderedDraftById((prev) => ({
      ...prev,
      [mtoItemId]: nextValue,
    }));

    const timers = quantityOrderedTimersRef.current;
    if (timers.has(mtoItemId)) {
      clearTimeout(timers.get(mtoItemId));
    }
    timers.set(
      mtoItemId,
      setTimeout(() => {
        saveQuantityOrdered(mtoItemId, nextValue);
      }, 800),
    );
  };

  const groupedItems = useMemo(() => {
    if (!items || items.length === 0) return null;

    // Group items by supplier name (Unassigned last)
    // UPDATED: Handle multi-supplier items - an item can appear under multiple suppliers
    const groups = new Map();
    items.forEach((it) => {
      // Check if item has itemSuppliers array (new multi-supplier structure)
      if (it.item?.itemSuppliers && it.item.itemSuppliers.length > 0) {
        // Add this item under each of its suppliers
        it.item.itemSuppliers.forEach((itemSupplier) => {
          const supplierName = itemSupplier.supplier?.name || "Unassigned";
          if (!groups.has(supplierName)) groups.set(supplierName, []);
          groups.get(supplierName).push(it);
        });
      } else {
        // Fallback: Legacy single supplier structure or no supplier
        const supplierName = it.item?.supplier?.name || "Unassigned";
        if (!groups.has(supplierName)) groups.set(supplierName, []);
        groups.get(supplierName).push(it);
      }
    });

    // Sort group names (Unassigned last)
    const orderedGroupNames = Array.from(groups.keys()).sort((a, b) => {
      if (a === "Unassigned" && b !== "Unassigned") return 1;
      if (b === "Unassigned" && a !== "Unassigned") return -1;
      return a.localeCompare(b);
    });

    return { groups, orderedGroupNames };
  }, [items]);

  if (!groupedItems) return null;

  const { groups, orderedGroupNames } = groupedItems;

  return (
    <div className="space-y-4">
      {orderedGroupNames.map((name) => {
        // Check if all items in this group have been fully ordered
        const groupItems = groups.get(name) || [];
        const allItemsOrdered =
          groupItems.length > 0 &&
          groupItems.every(
            (it) =>
              Number(it.quantity_ordered_po || 0) >= Number(it.quantity || 0),
          );

        return (
          <div key={name}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="text-sm font-semibold text-slate-700">{name}</h3>
              {activeTab === "active" &&
                name !== "Unassigned" &&
                !allItemsOrdered && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const firstItem = groups.get(name)?.[0];

                      // UPDATED: For multi-supplier items, find the supplier ID that matches this group name
                      let supplierId = null;
                      if (
                        firstItem?.item?.itemSuppliers &&
                        firstItem.item.itemSuppliers.length > 0
                      ) {
                        // Find the supplier in itemSuppliers that matches this group's name
                        const matchingSupplier =
                          firstItem.item.itemSuppliers.find(
                            (is) => is.supplier?.name === name,
                          );
                        supplierId =
                          matchingSupplier?.supplier?.supplier_id || null;
                      } else {
                        // Fallback: Legacy single supplier structure
                        supplierId =
                          firstItem?.item?.supplier?.supplier_id ||
                          firstItem?.item?.supplier_id ||
                          null;
                      }

                      if (!supplierId) return;
                      onOpenPO(name, supplierId, mtoId);
                    }}
                    className={BTN_SECONDARY}
                  >
                    <Plus className="w-4 h-4" aria-hidden="true" />
                    Create purchase order
                  </button>
                )}
            </div>
            <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
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
                      Quantity
                    </th>
                    <th scope="col" className={`${TH} text-right`}>
                      Qty ordered
                    </th>
                    <th scope="col" className={`${TH} text-left`}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {groups.get(name).map((item) => {
                    const hasOrderedPo =
                      Number(item.quantity_ordered_po || 0) > 0;
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <ItemThumb entry={item} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {item.item?.category ? (
                            <span className={`${BADGE} ${BADGE_TONES.indigo}`}>
                              {formatLabel(item.item.category)}
                            </span>
                          ) : (
                            <span className="text-sm text-slate-500">
                              {EMPTY}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-slate-600 space-y-1">
                            {Object.entries(DETAIL_FIELDS).map(
                              ([key, fields]) =>
                                item.item?.[key] && (
                                  <React.Fragment key={key}>
                                    {fields.map(([label, field]) => (
                                      <div key={field}>
                                        <span className="font-medium">
                                          {label}:
                                        </span>{" "}
                                        {item.item[key][field] || EMPTY}
                                      </div>
                                    ))}
                                  </React.Fragment>
                                ),
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <p className="text-sm font-mono text-slate-700">
                            {formatQty(
                              item.quantity,
                              item.item?.measurement_unit,
                            )}
                          </p>
                          {item.quantity_ordered_po > 0 && (
                            <p className="text-xs font-mono text-slate-600">
                              Ordered {formatQty(item.quantity_ordered_po)}
                            </p>
                          )}
                          {item.quantity_received > 0 && (
                            <p className="text-xs font-mono text-slate-600">
                              Received {formatQty(item.quantity_received)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <input
                            type="number"
                            min="0"
                            aria-label={`Quantity ordered for ${itemLabel(item)}`}
                            value={
                              quantityOrderedDraftById[item.id] ??
                              String(defaultQuantityOrdered(item))
                            }
                            onChange={(e) =>
                              handleQuantityOrderedChange(
                                item.id,
                                e.target.value,
                              )
                            }
                            onBlur={() => {
                              const timers = quantityOrderedTimersRef.current;
                              if (timers.has(item.id)) {
                                clearTimeout(timers.get(item.id));
                                timers.delete(item.id);
                              }
                              const v =
                                quantityOrderedDraftById[item.id] ??
                                String(defaultQuantityOrdered(item));
                              saveQuantityOrdered(item.id, v);
                            }}
                            disabled={
                              !!isSavingQuantityOrderedById[item.id] ||
                              hasOrderedPo
                            }
                            title={
                              hasOrderedPo
                                ? "A purchase order already covers this line"
                                : undefined
                            }
                            className={`w-24 text-right font-mono ${FIELD_COMPACT}`}
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {hasOrderedPo && (
                              <span
                                className={`${BADGE} ${STATUS_COLORS.ORDERED}`}
                              >
                                Ordered
                              </span>
                            )}
                            {item.quantity_received > 0 && (
                              <span
                                className={`${BADGE} ${STATUS_COLORS.FULLY_RECEIVED}`}
                              >
                                Received
                              </span>
                            )}
                            {!hasOrderedPo && item.quantity_received === 0 && (
                              <span
                                className={`${BADGE} ${BADGE_TONES.warning}`}
                              >
                                Pending
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function MaterialsToOrder({ supplierId, onCountChange }) {
  const { getToken } = useAuth();
  const fileFieldId = useId();
  const [materialsToOrder, setMaterialsToOrder] = useState([]);
  const [loadingMTO, setLoadingMTO] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mtoActiveTab, setMtoActiveTab] = useState("active");
  const [showCreatePurchaseOrderModal, setShowCreatePurchaseOrderModal] =
    useState(false);
  const [selectedSupplierForPO, setSelectedSupplierForPO] = useState(null);
  const [mtosForSelectedSupplier, setMtosForSelectedSupplier] = useState([]);
  const [preSelectedMtoId, setPreSelectedMtoId] = useState(null);
  // Media popup state
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [selectedMtoForMedia, setSelectedMtoForMedia] = useState(null);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [deletingMediaId, setDeletingMediaId] = useState(null);
  const [showDeleteMediaModal, setShowDeleteMediaModal] = useState(false);
  const [pendingDeleteMediaId, setPendingDeleteMediaId] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    images: false,
    videos: false,
    pdfs: false,
    others: false,
  });
  const [viewFileModal, setViewFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const fileInputRef = useRef(null);
  const mediaModalRef = useRef(null);

  // Focus moves into the media modal, stays inside it, and returns to the
  // trigger on close (DESIGN.md 13.6).
  useModalFocus(mediaModalRef, showMediaModal && !!selectedMtoForMedia);

  const handleUpdateQuantityOrdered = (mtoId, mtoItemId, value) => {
    setMaterialsToOrder((prev) =>
      (prev || []).map((mto) => {
        if (!mto || mto.id !== mtoId) return mto;
        return {
          ...mto,
          items: (mto.items || []).map((it) =>
            it.id === mtoItemId ? { ...it, quantity_ordered: value } : it,
          ),
        };
      }),
    );
  };

  const fetchMaterialsToOrder = async () => {
    try {
      setLoadingMTO(true);
      setLoadError("");
      const sessionToken = getToken();
      if (!sessionToken) {
        setLoadError(SESSION_ERROR);
        return;
      }
      const response = await axios.get(
        `/api/v1/materials_to_order/by-supplier/${supplierId}`,
        {
          headers: { Authorization: `Bearer ${sessionToken}` },
        },
      );
      if (response.data.status) {
        const data = response.data.data || [];
        setMaterialsToOrder(data);
        if (onCountChange) onCountChange(data.length || 0);
      } else {
        setLoadError(response.data.message || LOAD_ERROR);
      }
    } catch (err) {
      console.error("Error fetching materials to order:", err);
      const message = err.response?.data?.message || LOAD_ERROR;
      setLoadError(message);
      // With a list already on screen the inline error state is not shown, so
      // say so in a toast instead.
      if (materialsToOrder.length > 0) toast.error(message);
    } finally {
      setLoadingMTO(false);
    }
  };

  useEffect(() => {
    if (!supplierId) {
      setLoadingMTO(false);
      return;
    }
    fetchMaterialsToOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const openCreatePOForSupplier = (supplierName, supplierId, mtoId = null) => {
    // Build materialsToOrder list filtered to only include items from the selected supplier
    const filteredMTOs = (materialsToOrder || [])
      .map((mto) => {
        const supplierItems = (mto.items || []).filter((it) => {
          // UPDATED: Check itemSuppliers array for multi-supplier support
          if (it.item?.itemSuppliers && it.item.itemSuppliers.length > 0) {
            // Check if any of this item's suppliers matches the selected supplier ID
            return it.item.itemSuppliers.some(
              (is) => is.supplier?.supplier_id === supplierId,
            );
          } else {
            // Fallback: Legacy single supplier structure
            return (
              (it.item?.supplier?.supplier_id ||
                it.item?.supplier_id ||
                null) === supplierId
            );
          }
        });
        return { ...mto, items: supplierItems };
      })
      .filter((mto) => (mto.items || []).length > 0);

    setMtosForSelectedSupplier(filteredMTOs);
    setSelectedSupplierForPO({ name: supplierName, supplier_id: supplierId });
    setPreSelectedMtoId(mtoId);
    setShowCreatePurchaseOrderModal(true);
  };

  const [sortField, setSortField] = useState("project");
  const [sortOrder, setSortOrder] = useState("asc");
  const [openAccordionId, setOpenAccordionId] = useState(null);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const tabCounts = useMemo(
    () => ({
      active: materialsToOrder.filter((mto) =>
        ACTIVE_STATUSES.includes(mto.status),
      ).length,
      completed: materialsToOrder.filter((mto) =>
        COMPLETED_STATUSES.includes(mto.status),
      ).length,
    }),
    [materialsToOrder],
  );

  const filteredMTOs = useMemo(() => {
    // Tab filter
    let list = materialsToOrder.filter((mto) =>
      mtoActiveTab === "active"
        ? ACTIVE_STATUSES.includes(mto.status)
        : COMPLETED_STATUSES.includes(mto.status),
    );

    // Precompute counts
    const withCounts = list.map((mto) => {
      const itemsCount = mto.items?.length || 0;
      const itemsRemainingCount =
        mto.items?.filter(
          (it) => (it.quantity_ordered_po || 0) < (it.quantity || 0),
        ).length || 0;
      return {
        ...mto,
        __itemsCount: itemsCount,
        __itemsRemaining: itemsRemainingCount,
      };
    });

    // Sort
    withCounts.sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      let aVal;
      let bVal;
      switch (sortField) {
        case "project":
          aVal = (a.project?.name || "").toLowerCase();
          bVal = (b.project?.name || "").toLowerCase();
          break;
        case "status":
          aVal = (a.status || "").toLowerCase();
          bVal = (b.status || "").toLowerCase();
          break;
        case "items":
          aVal = a.__itemsCount;
          bVal = b.__itemsCount;
          break;
        case "remaining":
          aVal = a.__itemsRemaining;
          bVal = b.__itemsRemaining;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }
      if (aVal < bVal) return -1 * dir;
      if (aVal > bVal) return 1 * dir;
      return 0;
    });

    return withCounts;
  }, [materialsToOrder, mtoActiveTab, sortField, sortOrder]);

  const handleOpenMediaModal = (mto) => {
    setSelectedMtoForMedia(mto);
    setMediaFiles(mto.media || []);
    setShowMediaModal(true);
  };

  const handleCloseMediaModal = () => {
    setShowMediaModal(false);
    setSelectedMtoForMedia(null);
    setMediaFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // The media modal closes on Escape (DESIGN.md 9.4), except while an upload is
  // running. The delete confirmation needs an explicit button, and the file
  // viewer handles its own Escape.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (showDeleteMediaModal || viewFileModal) return;
      if (showMediaModal && !uploadingMedia) handleCloseMediaModal();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    await handleUploadMedia(files);
  };

  const handleUploadMedia = async (filesToUpload = null) => {
    if (!selectedMtoForMedia) return;

    const files =
      filesToUpload || Array.from(fileInputRef.current?.files || []);
    if (files.length === 0) return;

    setUploadingMedia(true);
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR);
        return;
      }

      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await axios.post(
        `/api/v1/uploads/materials-to-order/${selectedMtoForMedia.id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      if (response.data.status) {
        toast.success(response.data.message || "Files uploaded.");
        // Refresh media files
        const updatedMedia = [...mediaFiles, ...(response.data.data || [])];
        setMediaFiles(updatedMedia);
        // Refresh MTO list
        fetchMaterialsToOrder();
        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        toast.error(
          response.data.message ||
            "Couldn't upload the files. Check your connection and try again.",
        );
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Couldn't upload the files. Check your connection and try again.",
      );
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleDeleteMedia = (mediaId) => {
    setPendingDeleteMediaId(mediaId);
    setShowDeleteMediaModal(true);
  };

  const handleDeleteMediaConfirm = async () => {
    if (!selectedMtoForMedia || !pendingDeleteMediaId) return;

    setDeletingMediaId(pendingDeleteMediaId);
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR);
        return;
      }

      const response = await axios.delete(
        `/api/v1/uploads/materials-to-order/${selectedMtoForMedia.id}?mediaId=${pendingDeleteMediaId}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );

      if (response.data.status) {
        toast.success("File deleted.");
        // Remove from local state
        setMediaFiles((prev) =>
          prev.filter((f) => f.id !== pendingDeleteMediaId),
        );
        // Refresh MTO list
        fetchMaterialsToOrder();
        setShowDeleteMediaModal(false);
        setPendingDeleteMediaId(null);
      } else {
        toast.error(
          response.data.message ||
            "Couldn't delete the file. Check your connection and try again.",
        );
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Couldn't delete the file. Check your connection and try again.",
      );
    } finally {
      setDeletingMediaId(null);
    }
  };

  const handleDeleteMediaCancel = () => {
    setShowDeleteMediaModal(false);
    setPendingDeleteMediaId(null);
  };

  const handleViewExistingFile = (file) => {
    setSelectedFile({
      name: file.filename || "File",
      url: `/${file.url}`,
      type:
        file.mime_type ||
        (file.extension ? `application/${file.extension}` : "application/pdf"),
      size: file.size || 0,
      isExisting: true,
    });
    setViewFileModal(true);
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const tabClass = (tab) =>
    `cursor-pointer py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      mtoActiveTab === tab
        ? "border-primary text-primary"
        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
    }`;

  const categorizedMedia = {
    images: mediaFiles.filter((file) => isImageFile(file)),
    videos: mediaFiles.filter(
      (file) => !isImageFile(file) && isVideoFile(file),
    ),
    pdfs: mediaFiles.filter(
      (file) => !isImageFile(file) && !isVideoFile(file) && isPdfFile(file),
    ),
    others: mediaFiles.filter(
      (file) => !isImageFile(file) && !isVideoFile(file) && !isPdfFile(file),
    ),
  };

  const pendingDeleteFile = mediaFiles.find(
    (file) => file.id === pendingDeleteMediaId,
  );
  const pendingDeleteName = pendingDeleteFile?.filename || "This file";

  const otherTab = mtoActiveTab === "active" ? "completed" : "active";
  const tabLabels = { active: "active", completed: "completed" };

  return (
    <div>
      <div className="border-b border-slate-200 mb-2 flex items-center justify-between px-4">
        <nav
          className="flex space-x-6"
          role="tablist"
          aria-label="Materials to order status"
        >
          <button
            type="button"
            role="tab"
            id="mto-tab-active"
            aria-selected={mtoActiveTab === "active"}
            aria-controls="mto-panel"
            onClick={() => setMtoActiveTab("active")}
            className={tabClass("active")}
          >
            <span className="flex items-center gap-2">
              Active
              {tabCounts.active > 0 && (
                <span className={COUNT_BADGE}>{tabCounts.active}</span>
              )}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            id="mto-tab-completed"
            aria-selected={mtoActiveTab === "completed"}
            aria-controls="mto-panel"
            onClick={() => setMtoActiveTab("completed")}
            className={tabClass("completed")}
          >
            <span className="flex items-center gap-2">
              Completed
              {tabCounts.completed > 0 && (
                <span className={COUNT_BADGE}>{tabCounts.completed}</span>
              )}
            </span>
          </button>
        </nav>
      </div>

      <div
        id="mto-panel"
        role="tabpanel"
        aria-labelledby={`mto-tab-${mtoActiveTab}`}
      >
        {loadingMTO ? (
          <div className="bg-white rounded-lg border border-slate-200 px-4 py-12 text-center">
            <div
              className="flex items-center justify-center gap-2 text-sm text-slate-600"
              role="status"
            >
              <span
                className="w-4 h-4 border-2 border-slate-200 border-t-primary rounded-full animate-spin"
                aria-hidden="true"
              />
              Loading materials to order...
            </div>
          </div>
        ) : loadError && materialsToOrder.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 px-4 py-12 text-center">
            <AlertTriangle
              className="mx-auto mb-2 w-8 h-8 text-red-500"
              aria-hidden="true"
            />
            <p className="text-sm text-red-600 mb-4" role="alert">
              {loadError}
            </p>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={fetchMaterialsToOrder}
                className={BTN_SECONDARY}
              >
                Try again
              </button>
            </div>
          </div>
        ) : filteredMTOs.length > 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <SortHeader
                      field="project"
                      label="Project / lots"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <SortHeader
                      field="items"
                      label="Items"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      alignRight
                    />
                    <SortHeader
                      field="remaining"
                      label="Items remaining"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                      alignRight
                    />
                    <SortHeader
                      field="status"
                      label="Status"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                    <th scope="col" className={`${TH} text-right`}>
                      <span className="sr-only">Show items</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredMTOs.map((mto) => {
                    const isOpen = openAccordionId === mto.id;
                    const projectName = mto.project?.name || EMPTY;
                    return (
                      <React.Fragment key={mto.id}>
                        <tr
                          onClick={() =>
                            setOpenAccordionId(isOpen ? null : mto.id)
                          }
                          className="cursor-pointer hover:bg-slate-50 transition-colors duration-200"
                        >
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-3">
                              <span
                                className="text-sm font-semibold text-slate-800 truncate max-w-xs"
                                title={projectName}
                              >
                                {projectName}
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {mto.lots?.map((lot) => (
                                  <span
                                    key={lot.lot_id || lot.id}
                                    className={`${BADGE} ${BADGE_TONES.violet}`}
                                  >
                                    {lot.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-mono text-slate-700">
                            {mto.__itemsCount}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-mono text-slate-700">
                            {mto.__itemsRemaining}
                          </td>
                          <td className="px-4 py-3">
                            {mto.status ? (
                              <span
                                className={`${BADGE} ${
                                  STATUS_COLORS[mto.status] ||
                                  BADGE_TONES.neutral
                                }`}
                              >
                                {formatLabel(mto.status)}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-500">
                                {EMPTY}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenAccordionId(isOpen ? null : mto.id);
                              }}
                              aria-expanded={isOpen}
                              aria-controls={
                                isOpen ? `mto-${mto.id}` : undefined
                              }
                              aria-label={`${
                                isOpen ? "Hide" : "Show"
                              } items for ${projectName}`}
                              className={ICON_BTN}
                            >
                              <ChevronDown
                                className={`w-4 h-4 transition-transform duration-200 ${
                                  isOpen ? "rotate-180" : ""
                                }`}
                                aria-hidden="true"
                              />
                            </button>
                          </td>
                        </tr>

                        {/* Accordion content */}
                        {isOpen && (
                          <tr>
                            <td colSpan={5} className="px-4 py-4 bg-slate-50">
                              <div id={`mto-${mto.id}`} className="space-y-4">
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600">
                                  <div className="flex items-center gap-2">
                                    <Calendar
                                      className="w-4 h-4"
                                      aria-hidden="true"
                                    />
                                    <span>
                                      <span className="font-medium">
                                        Created:
                                      </span>{" "}
                                      {formatCreated(mto.createdAt)}
                                    </span>
                                  </div>
                                  {mto.notes && (
                                    <div className="flex items-center gap-2">
                                      <FileText
                                        className="w-4 h-4"
                                        aria-hidden="true"
                                      />
                                      <span>
                                        <span className="font-medium">
                                          Notes:
                                        </span>{" "}
                                        {mto.notes}
                                      </span>
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenMediaModal(mto);
                                    }}
                                    className="cursor-pointer flex items-center gap-2 text-xs font-medium text-primary rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                  >
                                    <Paperclip
                                      className="w-4 h-4"
                                      aria-hidden="true"
                                    />
                                    Media files ({(mto.media || []).length})
                                  </button>
                                </div>

                                {/* Items grouped by supplier */}
                                {!!(mto.items && mto.items.length) && (
                                  <GroupedItemsTable
                                    items={mto.items}
                                    mtoId={mto.id}
                                    activeTab={mtoActiveTab}
                                    onOpenPO={openCreatePOForSupplier}
                                    onUpdateQuantityOrdered={
                                      handleUpdateQuantityOrdered
                                    }
                                  />
                                )}
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
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 px-4 py-12 text-center">
            <Package
              className="mx-auto mb-2 w-8 h-8 text-slate-300"
              aria-hidden="true"
            />
            <p className="text-sm text-slate-600">
              No {tabLabels[mtoActiveTab]} materials to order
            </p>
            {tabCounts[otherTab] > 0 && (
              <div className="flex justify-center mt-4">
                <button
                  type="button"
                  onClick={() => setMtoActiveTab(otherTab)}
                  className={BTN_SECONDARY}
                >
                  View {tabLabels[otherTab]} ({tabCounts[otherTab]})
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showCreatePurchaseOrderModal && selectedSupplierForPO && (
        <PurchaseOrderForm
          materialsToOrder={mtosForSelectedSupplier}
          supplier={selectedSupplierForPO}
          setShowCreatePurchaseOrderModal={setShowCreatePurchaseOrderModal}
          fetchMaterialsToOrder={fetchMaterialsToOrder}
          selectedMtoId={preSelectedMtoId}
        />
      )}

      {/* Media Files Modal */}
      {showMediaModal && selectedMtoForMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
          onClick={() => {
            if (!uploadingMedia) handleCloseMediaModal();
          }}
        >
          <div
            ref={mediaModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mto-media-title"
            className="bg-white rounded-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div>
                <h2
                  id="mto-media-title"
                  className="text-lg font-semibold text-slate-800"
                >
                  Media files
                </h2>
                <p className="text-xs text-slate-500">
                  Project: {selectedMtoForMedia.project?.name || EMPTY}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseMediaModal}
                disabled={uploadingMedia}
                className={ICON_BTN}
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Display Existing Files First */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-4">
                  Uploaded files
                </h3>

                {mediaFiles.length > 0 ? (
                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <FileCategorySection
                      title="Images"
                      files={categorizedMedia.images}
                      sectionKey="images"
                      isExpanded={expandedSections.images}
                      onToggle={toggleSection}
                      onView={handleViewExistingFile}
                      onDelete={handleDeleteMedia}
                      deletingMediaId={deletingMediaId}
                    />
                    <FileCategorySection
                      title="Videos"
                      files={categorizedMedia.videos}
                      sectionKey="videos"
                      isExpanded={expandedSections.videos}
                      onToggle={toggleSection}
                      onView={handleViewExistingFile}
                      onDelete={handleDeleteMedia}
                      deletingMediaId={deletingMediaId}
                    />
                    <FileCategorySection
                      title="PDFs"
                      files={categorizedMedia.pdfs}
                      isSmall
                      sectionKey="pdfs"
                      isExpanded={expandedSections.pdfs}
                      onToggle={toggleSection}
                      onView={handleViewExistingFile}
                      onDelete={handleDeleteMedia}
                      deletingMediaId={deletingMediaId}
                    />
                    <FileCategorySection
                      title="Other files"
                      files={categorizedMedia.others}
                      isSmall
                      sectionKey="others"
                      isExpanded={expandedSections.others}
                      onToggle={toggleSection}
                      onView={handleViewExistingFile}
                      onDelete={handleDeleteMedia}
                      deletingMediaId={deletingMediaId}
                    />
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-lg px-4 py-12 border border-slate-200 text-center">
                    <FileText
                      className="w-8 h-8 text-slate-300 mx-auto mb-2"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-slate-600">
                      No files uploaded yet
                    </p>
                  </div>
                )}
              </div>

              {/* Upload New Files Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">
                  Upload new files
                </h3>

                {/* File Upload Area */}
                <div className="relative">
                  <label
                    htmlFor={fileFieldId}
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Select files
                  </label>
                  <div
                    className={`border-2 border-dashed border-slate-300 hover:border-primary focus-within:ring-2 focus-within:ring-primary rounded-lg transition-colors duration-200 bg-slate-50 hover:bg-slate-100 ${
                      uploadingMedia ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <input
                      id={fileFieldId}
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.dwg,.jpg,.jpeg,.png,.mp4,.mov,.doc,.docx"
                      onChange={handleFileChange}
                      disabled={uploadingMedia}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                    />
                    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                      {uploadingMedia ? (
                        <div
                          role="status"
                          className="flex flex-col items-center"
                        >
                          <span
                            className="w-8 h-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin mb-3"
                            aria-hidden="true"
                          />
                          <p className="text-sm font-medium text-slate-700">
                            Uploading files...
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                            <FileUp
                              className="w-5 h-5 text-primary"
                              aria-hidden="true"
                            />
                          </div>
                          <p className="text-sm font-medium text-slate-700 mb-1">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-xs text-slate-500">
                            PDF, DWG, JPG, PNG, MP4, MOV, DOC, or DOCX
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File View Modal */}
      {viewFileModal && selectedFile && (
        <ViewMedia
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          setViewFileModal={setViewFileModal}
          setPageNumber={setPageNumber}
        />
      )}

      {/* Delete Media Confirmation Modal */}
      <DeleteConfirmation
        isOpen={showDeleteMediaModal}
        onClose={handleDeleteMediaCancel}
        onConfirm={handleDeleteMediaConfirm}
        deleteWithInput={false}
        heading="media file"
        title={`Delete ${pendingDeleteName}?`}
        warningHeading="This removes the file from the list"
        message={`${pendingDeleteName} will be deleted from ${
          selectedMtoForMedia?.project?.name || "this"
        } materials to order.`}
        confirmButtonText="Delete file"
        isDeleting={deletingMediaId !== null}
        entityType="media"
      />
    </div>
  );
}
