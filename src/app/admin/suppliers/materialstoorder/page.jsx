"use client";
import React, {
  Suspense,
  useEffect,
  useId,
  useMemo,
  useState,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import PaginationFooter from "@/components/PaginationFooter";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Calendar,
  FileText,
  Package,
  ChevronDown,
  Search,
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Sheet,
  Plus,
  FileUp,
  Paperclip,
  Trash2,
  X,
  File,
  AlertTriangle,
  Check,
} from "lucide-react";
import Image from "next/image";
import PurchaseOrder from "../components/PurchaseOrderForm";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import CreateMaterialsToOrderModal from "./components/CreateMaterialsToOrderModal";
import SearchBar from "@/components/SearchBar";
import useModalFocus from "@/hooks/useModalFocus";
import {
  usePersistedTableFilter,
  useTableFilterActions,
} from "@/hooks/usePersistedTableFilter";
import {
  BADGE,
  BADGE_TONES,
  COUNT_BADGE,
  STATUS_COLORS,
  formatQty,
  formatTime,
} from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";

const TABLE_KEY = "materials-to-order";
const EMPTY = "—";
const TABLE_COLUMNS = 5;
const SESSION_ERROR = "Your session has expired. Sign in again to continue.";
const LOAD_ERROR =
  "Couldn't load materials to order. Check your connection and try again.";
const CUMULATIVE_ERROR =
  "Couldn't load the cumulative list. Check your connection and try again.";
const TOAST_OPTIONS = { position: "top-right", autoClose: 3000 };

const ACTIVE_STATUSES = ["DRAFT", "PARTIALLY_ORDERED"];
const COMPLETED_STATUSES = ["FULLY_ORDERED", "CLOSED"];

// Fields the list can be sorted by. Used by both the "Sort by" menu and the
// column headers so the two never drift apart.
const SORT_OPTIONS = [
  { field: "project", label: "Project" },
  { field: "status", label: "Status" },
  { field: "items", label: "Items" },
  { field: "remaining", label: "Items remaining" },
];

// Button, field, menu and table recipes from DESIGN.md 9.1 / 9.2 / 9.5 / 9.8.
const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY_COMPACT =
  "cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
// A red-ink outline for destructive actions that sit beside secondary buttons;
// the solid red button lives in the confirmation dialog.
const BTN_DANGER_COMPACT =
  "cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50 disabled:cursor-not-allowed";
const ICON_BTN =
  "cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const ICON_BTN_ACCENT =
  "cursor-pointer p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const FIELD_COMPACT =
  "text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors duration-200 disabled:bg-slate-50 disabled:text-slate-600 disabled:cursor-not-allowed";
const MENU_ITEM =
  "cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between";
const MENU_CHECK_ROW =
  "cursor-pointer flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors";
const CHECKBOX =
  "h-4 w-4 accent-primary border-slate-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
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

// A short name for an item, used to label its image and quantity controls.
const itemLabel = (detail, fallbackId) => {
  const part =
    detail?.sheet ||
    detail?.handle ||
    detail?.hardware ||
    detail?.accessory ||
    detail?.edging_tape;
  const name = [part?.brand, part?.name || part?.color]
    .filter(Boolean)
    .join(" ");
  return name || fallbackId || formatLabel(detail?.category) || "item";
};

// Group an MTO's lines by supplier name (Unassigned last). A line can appear
// under several suppliers when the item has more than one.
const groupItemsBySupplier = (items) => {
  const groups = new Map();
  items.forEach((it) => {
    if (it.item?.itemSuppliers && it.item.itemSuppliers.length > 0) {
      it.item.itemSuppliers.forEach((itemSupplier) => {
        const supplierName = itemSupplier.supplier?.name || "Unassigned";
        if (!groups.has(supplierName)) groups.set(supplierName, []);
        groups.get(supplierName).push(it);
      });
    } else {
      // Legacy single supplier structure, or no supplier
      const supplierName = it.item?.supplier?.name || "Unassigned";
      if (!groups.has(supplierName)) groups.set(supplierName, []);
      groups.get(supplierName).push(it);
    }
  });

  const orderedGroupNames = Array.from(groups.keys()).sort((a, b) => {
    if (a === "Unassigned" && b !== "Unassigned") return 1;
    if (b === "Unassigned" && a !== "Unassigned") return -1;
    return a.localeCompare(b);
  });

  return { groups, orderedGroupNames };
};

// The supplier id behind a group name, taken from the group's first line.
const resolveSupplierId = (firstItem, name) => {
  if (
    firstItem?.item?.itemSuppliers &&
    firstItem.item.itemSuppliers.length > 0
  ) {
    const matchingSupplier = firstItem.item.itemSuppliers.find(
      (is) => is.supplier?.name === name,
    );
    return matchingSupplier?.supplier?.supplier_id || null;
  }
  // Legacy single supplier structure
  return (
    firstItem?.item?.supplier?.supplier_id ||
    firstItem?.item?.supplier_id ||
    null
  );
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

// Item thumbnail that opens the image viewer. Falls back to a placeholder when
// there is no image or it fails to load.
function ItemThumb({ image, label, onOpen }) {
  const [failed, setFailed] = useState(false);

  if (!image?.url || failed) {
    return (
      <div className="w-10 h-10 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
        <Package className="w-5 h-5 text-slate-400" aria-hidden="true" />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(image)}
      aria-label={`View image of ${label}`}
      title="View image"
      className="cursor-pointer block rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <Image
        loading="lazy"
        src={`/${image.url}`}
        alt=""
        className="w-10 h-10 object-cover rounded-lg border border-slate-200"
        onError={() => setFailed(true)}
        width={40}
        height={40}
      />
    </button>
  );
}

// The category-specific attributes of an item, driven by DETAIL_FIELDS.
function ItemDetails({ detail, supplierRef }) {
  return (
    <div className="text-xs text-slate-600 space-y-1">
      {supplierRef && (
        <div>
          <span className="font-medium">Supplier ref:</span> {supplierRef}
        </div>
      )}
      {Object.entries(DETAIL_FIELDS).map(
        ([key, fields]) =>
          detail?.[key] && (
            <React.Fragment key={key}>
              {fields.map(([label, field]) => (
                <div key={field}>
                  <span className="font-medium">{label}:</span>{" "}
                  {detail[key][field] || EMPTY}
                </div>
              ))}
            </React.Fragment>
          ),
      )}
    </div>
  );
}

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

// Stock on hand, with a text label so the level never rests on colour alone
// (DESIGN.md 13.4).
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
      <div className={`text-sm font-mono font-medium ${tone}`}>
        {formatQty(stock, unit)}
      </div>
      {label && <div className="text-xs text-slate-500">{label}</div>}
    </div>
  );
}

// useSearchParams needs a Suspense boundary above it
export default function MaterialsToOrderPage() {
  return (
    <Suspense fallback={null}>
      <MaterialsToOrderContent />
    </Suspense>
  );
}

function MaterialsToOrderContent() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();
  const fileFieldId = useId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mtos, setMtos] = useState([]);
  const [activeTab, setActiveTab] = useState("active");
  const [showCreatePurchaseOrderModal, setShowCreatePurchaseOrderModal] =
    useState(false);
  const [showCreateMTOModal, setShowCreateMTOModal] = useState(false);
  const [selectedSupplierForPO, setSelectedSupplierForPO] = useState(null);
  const [mtosForSelectedSupplier, setMtosForSelectedSupplier] = useState([]);
  const [preSelectedMtoId, setPreSelectedMtoId] = useState(null);
  const [search, setSearch] = usePersistedTableFilter(TABLE_KEY, "search", "");
  const [sortField, setSortField] = usePersistedTableFilter(
    TABLE_KEY,
    "sortField",
    "project",
  );
  const [sortOrder, setSortOrder] = usePersistedTableFilter(
    TABLE_KEY,
    "sortOrder",
    "asc",
  );
  const { resetFilters } = useTableFilterActions(TABLE_KEY);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  // Define all available columns for export
  const availableColumns = [
    "Project",
    "Lot",
    "Items",
    "Items Remaining",
    "Status",
    "Supplier Name",
    "Image URL",
    "Category",
    "Sheet Color",
    "Sheet Finish",
    "Sheet Face",
    "Sheet Dimensions",
    "Handle Color",
    "Handle Type",
    "Handle Dimensions",
    "Handle Material",
    "Hardware Name",
    "Hardware Type",
    "Hardware Dimensions",
    "Hardware Sub Category",
    "Accessory Name",
    "Quantity",
    "Quantity Ordered",
    "Created At",
    "Created By",
    "Notes",
  ];
  // Initialize selected columns with all columns
  const [selectedColumns, setSelectedColumns] = useState([...availableColumns]);
  const [openAccordionId, setOpenAccordionId] = useState(null);
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
  const [quantityOrderedDraftById, setQuantityOrderedDraftById] = useState({});
  const [isSavingQuantityOrderedById, setIsSavingQuantityOrderedById] =
    useState({});
  const [pendingChangesById, setPendingChangesById] = useState({});
  const [originalQuantityOrderedById, setOriginalQuantityOrderedById] =
    useState({});
  const quantityOrderedTimersRef = useRef(new Map());
  // Delete MTO state
  const [showDeleteMTOModal, setShowDeleteMTOModal] = useState(false);
  const [mtoPendingDelete, setMtoPendingDelete] = useState(null);
  const [deletingMTOId, setDeletingMTOId] = useState(null);
  // Stock reservation state
  const [reservedItemsMap, setReservedItemsMap] = useState({}); // Map of mto_item_id -> reservation details
  const [reservingItemId, setReservingItemId] = useState(null);
  // Cumulative materials state
  const [cumulativeData, setCumulativeData] = useState([]);
  const [loadingCumulative, setLoadingCumulative] = useState(false);
  const [cumulativeLoaded, setCumulativeLoaded] = useState(false);
  const [cumulativeError, setCumulativeError] = useState("");

  // Focus moves into the media modal, stays inside it, and returns to the
  // trigger on close (DESIGN.md 13.6).
  useModalFocus(mediaModalRef, showMediaModal && !!selectedMtoForMedia);

  useEffect(() => {
    fetchMTOs();
  }, []);

  // Deep link from an update: ?mto=<id> switches to the tab the MTO is on,
  // clears anything that would hide it (search, paging), opens its row and
  // scrolls to it. Applied once per link, after the MTOs have loaded.
  const openedMtoRef = useRef(null);
  useEffect(() => {
    const mtoId = searchParams.get("mto");
    if (!mtoId || openedMtoRef.current === mtoId) return;
    const target = (Array.isArray(mtos) ? mtos : []).find(
      (m) => m.id === mtoId,
    );
    if (!target) return;
    openedMtoRef.current = mtoId;
    if (search) setSearch("");
    setItemsPerPage(0);
    setActiveTab(
      COMPLETED_STATUSES.includes(target.status) ? "completed" : "active",
    );
    setOpenAccordionId(mtoId);
    setTimeout(
      () =>
        document
          .getElementById(`mto-${mtoId}`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" }),
      200,
    );
  }, [mtos, searchParams]);

  // Fetch cumulative data when cumulative tab is active
  useEffect(() => {
    if (activeTab === "cumulative") {
      fetchCumulativeData();
    }
  }, [activeTab]);

  // Process reservations from MTO data (already included in the response)
  useEffect(() => {
    if (mtos && mtos.length > 0) {
      processReservationsFromMTOs();
    }
  }, [mtos]);

  const processReservationsFromMTOs = () => {
    try {
      // Build reservations map from the data already included in MTOs
      const reservationsMap = {};
      const mtosArray = Array.isArray(mtos) ? mtos : [];

      mtosArray.forEach((mto) => {
        (mto?.items || []).forEach((item) => {
          // Check if this item has reservation data
          if (item.reserve_item_stock && item.reserve_item_stock.length > 0) {
            // Use the first reservation (should only be one per MTO item)
            const reservation = item.reserve_item_stock[0];
            reservationsMap[item.id] = reservation;
          }
        });
      });

      setReservedItemsMap(reservationsMap);
    } catch (err) {
      console.error("Error processing reservations:", err);
    }
  };

  const handleReserveStock = async (mtoItem, stockAvailable) => {
    const sessionToken = getToken();
    if (!sessionToken) {
      toast.error(SESSION_ERROR);
      return;
    }

    setReservingItemId(mtoItem.id);
    try {
      const response = await axios.post(
        "/api/v1/reserve_item_stock/create",
        {
          item_id: mtoItem.item.item_id,
          quantity: mtoItem.quantity, // Reserve all available stock
          mto_id: mtoItem.id,
        },
        { headers: { Authorization: `Bearer ${sessionToken}` } },
      );

      if (response.data.status) {
        toast.success("Stock reserved.");
        // Update local state
        setReservedItemsMap((prev) => ({
          ...prev,
          [mtoItem.id]: response.data.data,
        }));
        // Update the item quantity in mtos state to reflect the reduced stock
        // AND add the reservation data to the item's reserve_item_stock array
        setMtos((prev) =>
          (prev || []).map((mto) => ({
            ...mto,
            items: (mto.items || []).map((it) =>
              it.id === mtoItem.id
                ? {
                    ...it,
                    reserve_item_stock: [response.data.data], // Add reservation to the item
                    item: {
                      ...it.item,
                      quantity: Math.max(
                        0,
                        Number(it.item.quantity || 0) - mtoItem.quantity,
                      ),
                    },
                  }
                : it.item?.item_id === mtoItem.item.item_id
                  ? {
                      ...it,
                      item: {
                        ...it.item,
                        quantity: Math.max(
                          0,
                          Number(it.item.quantity || 0) - mtoItem.quantity,
                        ),
                      },
                    }
                  : it,
            ),
          })),
        );
      } else {
        toast.error(
          response.data.message ||
            "Couldn't reserve the stock. Check your connection and try again.",
        );
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Couldn't reserve the stock. Check your connection and try again.",
      );
    } finally {
      setReservingItemId(null);
    }
  };

  const handleDeleteReservation = async (reservationId, mtoItemId) => {
    const sessionToken = getToken();
    if (!sessionToken) {
      toast.error(SESSION_ERROR);
      return;
    }

    setReservingItemId(mtoItemId);
    try {
      const response = await axios.delete(
        `/api/v1/reserve_item_stock/${reservationId}`,
        { headers: { Authorization: `Bearer ${sessionToken}` } },
      );

      if (response.data.status) {
        toast.success("Stock unreserved.");

        // Get the reservation quantity before deleting from state
        const reservation = reservedItemsMap[mtoItemId];
        const reservedQuantity = reservation?.quantity || 0;

        // Update local state
        setReservedItemsMap((prev) => {
          const updated = { ...prev };
          delete updated[mtoItemId];
          return updated;
        });

        // Update the item quantity in mtos state to add back the reserved stock
        // AND remove the reservation data from the item's reserve_item_stock array
        if (reservedQuantity > 0) {
          setMtos((prev) =>
            (prev || []).map((mto) => ({
              ...mto,
              items: (mto.items || []).map((it) =>
                it.id === mtoItemId
                  ? {
                      ...it,
                      reserve_item_stock: [], // Clear the reservation
                      item: {
                        ...it.item,
                        quantity:
                          Number(it.item.quantity || 0) + reservedQuantity,
                      },
                    }
                  : it,
              ),
            })),
          );
        }
      } else {
        toast.error(
          response.data.message ||
            "Couldn't unreserve the stock. Check your connection and try again.",
        );
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Couldn't unreserve the stock. Check your connection and try again.",
      );
    } finally {
      setReservingItemId(null);
    }
  };

  // Fetch cumulative materials data from API
  const fetchCumulativeData = async () => {
    try {
      setLoadingCumulative(true);
      setCumulativeError("");
      const sessionToken = getToken();
      if (!sessionToken) {
        setCumulativeError(SESSION_ERROR);
        return;
      }

      const response = await axios.get(
        "/api/v1/materials_to_order/cumulative",
        {
          headers: { Authorization: `Bearer ${sessionToken}` },
        },
      );

      if (response.data.status) {
        setCumulativeData(response.data.data || []);
      } else {
        setCumulativeError(response.data.message || CUMULATIVE_ERROR);
        setCumulativeData([]);
      }
    } catch (err) {
      console.error("Error fetching cumulative data:", err);
      setCumulativeError(err?.response?.data?.message || CUMULATIVE_ERROR);
      setCumulativeData([]);
    } finally {
      setLoadingCumulative(false);
      setCumulativeLoaded(true);
    }
  };

  // Initialize draft values for the editable Qty Ordered inputs (don't clobber what user is typing)
  useEffect(() => {
    const mtosArray = Array.isArray(mtos) ? mtos : [];
    const newDraft = {};
    const newOriginal = {};

    mtosArray.forEach((mto) => {
      (mto?.items || []).forEach((it) => {
        if (it?.id) {
          // If quantity_ordered_po > 0, use that value instead of quantity_ordered
          const originalValue = String(defaultQuantityOrdered(it));
          newDraft[it.id] = originalValue;
          newOriginal[it.id] = originalValue;
        }
      });
    });

    setQuantityOrderedDraftById((prev) => {
      const next = { ...prev };
      Object.keys(newDraft).forEach((id) => {
        if (next[id] === undefined) {
          next[id] = newDraft[id];
        }
      });
      return next;
    });

    setOriginalQuantityOrderedById((prev) => {
      const next = { ...prev };
      Object.keys(newOriginal).forEach((id) => {
        if (next[id] === undefined) {
          next[id] = newOriginal[id];
        }
      });
      return next;
    });
  }, [mtos]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      const timers = quantityOrderedTimersRef.current;
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  // Close menus when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) {
        setShowSortDropdown(false);
        setShowColumnDropdown(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowSortDropdown(false);
        setShowColumnDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const fetchMTOs = async () => {
    try {
      setLoading(true);
      setError("");
      const sessionToken = getToken();
      if (!sessionToken) {
        setError(SESSION_ERROR);
        return;
      }
      const response = await axios.get("/api/v1/materials_to_order/all", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.data.status) {
        // Ensure data is always an array
        const data = response.data.data || [];
        setMtos(Array.isArray(data) ? data : []);
      } else {
        setError(response.data.message || LOAD_ERROR);
      }
    } catch (err) {
      const message = err?.response?.data?.message || LOAD_ERROR;
      setError(message);
      // With a list already on screen the inline error state is not shown, so
      // say so in a toast instead.
      if (mtos.length > 0) toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Handle clicking on item image to view in modal
  const handleImageClick = (imageObj) => {
    if (!imageObj?.url) return;

    // Ensure URL starts with / for proper Next.js Image handling
    const formattedUrl = imageObj.url.startsWith("/")
      ? imageObj.url
      : `/${imageObj.url}`;

    // Create a file object compatible with ViewMedia component
    const fileObj = {
      url: formattedUrl,
      type: "image/jpeg", // ViewMedia checks for selectedFile.type?.includes("image")
      name: imageObj.filename || imageObj.name || "Item image",
      size: imageObj.size || 0,
      isExisting: true,
    };

    setSelectedFile(fileObj);
    setViewFileModal(true);
  };

  const saveQuantityOrdered = async (mtoItemId, rawValue) => {
    const sessionToken = getToken();
    if (!sessionToken) {
      toast.error(SESSION_ERROR, TOAST_OPTIONS);
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
          response?.data?.message || "Couldn't update the quantity ordered.",
        );
      }

      const saved = response?.data?.data?.quantity_ordered ?? parsed;
      const orderedBy = response?.data?.data?.ordered_by;

      setQuantityOrderedDraftById((prev) => ({
        ...prev,
        [mtoItemId]: String(saved),
      }));

      // Update local state with the saved quantity and ordered_by info
      setMtos((prev) =>
        (prev || []).map((mto) => ({
          ...mto,
          items: (mto.items || []).map((it) =>
            it.id === mtoItemId
              ? {
                  ...it,
                  quantity_ordered: saved,
                  ordered_by: orderedBy,
                }
              : it,
          ),
        })),
      );

      // Update original value to the saved value
      setOriginalQuantityOrderedById((prev) => ({
        ...prev,
        [mtoItemId]: String(saved),
      }));

      // Clear pending changes after successful save
      setPendingChangesById((prev) => {
        const next = { ...prev };
        delete next[mtoItemId];
        return next;
      });
    } catch (err) {
      console.error("Failed to update quantity_ordered:", err);
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
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

    // Check if the value has changed from the original
    setOriginalQuantityOrderedById((prevOrig) => {
      const originalValue = prevOrig[mtoItemId];
      if (nextValue !== originalValue) {
        setPendingChangesById((prev) => ({ ...prev, [mtoItemId]: true }));
      } else {
        setPendingChangesById((prev) => {
          const next = { ...prev };
          delete next[mtoItemId];
          return next;
        });
      }
      return prevOrig;
    });
  };

  const handleCancelQuantityOrdered = (mtoItemId) => {
    // Get original value from state, or find it from mtos if not in state
    let originalValue = originalQuantityOrderedById[mtoItemId];
    if (!originalValue) {
      // Fallback: find the item in mtos to get the current quantity_ordered
      const mtosArray = Array.isArray(mtos) ? mtos : [];
      for (const mto of mtosArray) {
        const foundItem = (mto?.items || []).find((it) => it.id === mtoItemId);
        if (foundItem) {
          originalValue = String(foundItem.quantity_ordered ?? 0);
          break;
        }
      }
    }
    if (originalValue !== undefined) {
      setQuantityOrderedDraftById((prev) => ({
        ...prev,
        [mtoItemId]: originalValue,
      }));
    }
    setPendingChangesById((prev) => {
      const next = { ...prev };
      delete next[mtoItemId];
      return next;
    });
  };

  const handleSaveQuantityOrdered = async (mtoItemId) => {
    const value = quantityOrderedDraftById[mtoItemId];
    await saveQuantityOrdered(mtoItemId, value);
    // Note: original value is updated in saveQuantityOrdered after successful save
  };

  const openCreatePOForSupplier = (supplierName, supplierId, mtoId = null) => {
    // Build materialsToOrder list filtered to only include items from the selected supplier
    // and exclude items that have stock reserved
    const filteredMTOs = (mtos || [])
      .map((mto) => {
        const supplierItems = (mto.items || []).filter((it) => {
          // Check if item has itemSuppliers array (new multi-supplier structure)
          if (it.item?.itemSuppliers && it.item.itemSuppliers.length > 0) {
            // Check if any of this item's suppliers matches the selected supplier ID
            return (
              it.item.itemSuppliers.some(
                (is) => is.supplier?.supplier_id === supplierId,
              ) && !reservedItemsMap[it.id]
            );
          } else {
            // Fallback: Legacy single supplier structure
            return (
              (it.item?.supplier?.supplier_id ||
                it.item?.supplier_id ||
                null) === supplierId && !reservedItemsMap[it.id]
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

  // Search filter (project name, lot name, status), applied before the tab
  // split so the tab counts match what each tab would show.
  const searchedMTOs = useMemo(() => {
    // Ensure mtos is always an array
    const mtosArray = Array.isArray(mtos) ? mtos : [];
    if (!search) return mtosArray;

    const q = search.toLowerCase();
    return mtosArray.filter((mto) => {
      const proj = (mto.project?.name || "").toLowerCase();
      const lots = (mto.lots || [])
        .map((l) => (l.name || "").toLowerCase())
        .join(" ");
      const status = (mto.status || "").toLowerCase();
      return proj.includes(q) || lots.includes(q) || status.includes(q);
    });
  }, [mtos, search]);

  const tabCounts = useMemo(
    () => ({
      active: searchedMTOs.filter((mto) => ACTIVE_STATUSES.includes(mto.status))
        .length,
      completed: searchedMTOs.filter((mto) =>
        COMPLETED_STATUSES.includes(mto.status),
      ).length,
    }),
    [searchedMTOs],
  );

  const filteredAndSortedMTOs = useMemo(() => {
    // Tab filter
    const list = searchedMTOs.filter((mto) =>
      activeTab === "active"
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
  }, [searchedMTOs, activeTab, sortField, sortOrder]);

  // Pagination
  const totalItems = filteredAndSortedMTOs.length;
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedMTOs = filteredAndSortedMTOs.slice(startIndex, endIndex);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setShowSortDropdown(false);
  };

  // Only the active field shows a sort indicator (DESIGN.md 15.4).
  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    if (sortOrder === "asc")
      return <ArrowUp className="h-4 w-4 text-primary" aria-hidden="true" />;
    if (sortOrder === "desc")
      return <ArrowDown className="h-4 w-4 text-primary" aria-hidden="true" />;
    return null;
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Reset to first page when the table filters or active tab changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeTab]);

  const handleReset = () => {
    resetFilters();
    setCurrentPage(1);
  };

  // Filters that narrow the list (sort does not hide records), used to tell
  // "no records" apart from "no results for this filter" (DESIGN.md 15.4).
  const isNarrowingFilterActive = search !== "";

  const isAnyFilterActive =
    search !== "" || sortField !== "project" || sortOrder !== "asc";

  const handleColumnToggle = (column) => {
    if (column === "Select All") {
      if (selectedColumns.length === availableColumns.length) {
        // If all columns are selected, unselect all
        setSelectedColumns([]);
      } else {
        // If not all columns are selected, select all
        setSelectedColumns([...availableColumns]);
      }
    } else {
      setSelectedColumns((prev) =>
        prev.includes(column)
          ? prev.filter((c) => c !== column)
          : [...prev, column],
      );
    }
  };

  const handleExportToExcel = async () => {
    if (filteredAndSortedMTOs.length === 0) {
      toast.warning("No data to export.", TOAST_OPTIONS);
      return;
    }
    setIsExporting(true);
    try {
      const XLSX = await import("xlsx");
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      // Column width map
      const columnWidthMap = {
        Project: 22,
        Lot: 24,
        Items: 8,
        "Items Remaining": 12,
        Status: 14,
        "Supplier Name": 22,
        "Image URL": 28,
        Category: 12,
        "Sheet Color": 14,
        "Sheet Finish": 14,
        "Sheet Face": 12,
        "Sheet Dimensions": 18,
        "Handle Color": 14,
        "Handle Type": 14,
        "Handle Dimensions": 18,
        "Handle Material": 16,
        "Hardware Name": 18,
        "Hardware Type": 16,
        "Hardware Dimensions": 18,
        "Hardware Sub Category": 20,
        "Accessory Name": 18,
        Quantity: 10,
        "Quantity Ordered": 16,
        "Created At": 20,
        "Created By": 22,
        Notes: 30,
      };

      // Flatten to one row per item with detailed columns
      const exportData = filteredAndSortedMTOs.flatMap((mto) => {
        const projectName = mto.project?.name || "";
        const lotsJoined = (mto.lots || []).map((l) => l.name).join(", ");
        const itemsCount = mto.__itemsCount || mto.items?.length || 0;
        const itemsRemaining =
          mto.__itemsRemaining ||
          mto.items?.filter(
            (it) => (it.quantity_ordered_po || 0) < (it.quantity || 0),
          ).length ||
          0;
        const createdAtStr = mto.createdAt
          ? new Date(mto.createdAt).toLocaleString()
          : "";
        const createdByName = mto.createdBy?.employee
          ? `${mto.createdBy.employee.first_name || ""} ${
              mto.createdBy.employee.last_name || ""
            }`.trim()
          : "";
        const notes = mto.notes || "";

        const rows = (mto.items || []).map((it) => {
          const item = it.item || {};
          const supplierName = item.supplier?.name || "";
          const imageUrl = item.image?.url ? `${origin}/${item.image.url}` : "";
          const category = item.category || "";
          // Sheet details
          const sheetColor = item.sheet?.color || "";
          const sheetFinish = item.sheet?.finish || "";
          const sheetFace = item.sheet?.face || "";
          const sheetDimensions = item.sheet?.dimensions || "";
          // Handle details
          const handleColor = item.handle?.color || "";
          const handleType = item.handle?.type || "";
          const handleDimensions = item.handle?.dimensions || "";
          const handleMaterial = item.handle?.material || "";
          // Hardware details
          const hwName = item.hardware?.name || "";
          const hwType = item.hardware?.type || "";
          const hwDimensions = item.hardware?.dimensions || "";
          const hwSubCategory = item.hardware?.sub_category || "";
          // Accessory details
          const accName = item.accessory?.name || "";

          // Calculate actual quantity ordered from purchase order items
          const actualQuantityOrdered = (it.ordered_items || []).reduce(
            (sum, poItem) => sum + (poItem.quantity || 0),
            0,
          );

          // Build full row with all columns
          const fullRow = {
            Project: projectName,
            Lot: lotsJoined,
            Items: itemsCount,
            "Items Remaining": itemsRemaining,
            Status: mto.status || "",
            "Supplier Name": supplierName,
            "Image URL": imageUrl,
            Category: category,
            "Sheet Color": sheetColor,
            "Sheet Finish": sheetFinish,
            "Sheet Face": sheetFace,
            "Sheet Dimensions": sheetDimensions,
            "Handle Color": handleColor,
            "Handle Type": handleType,
            "Handle Dimensions": handleDimensions,
            "Handle Material": handleMaterial,
            "Hardware Name": hwName,
            "Hardware Type": hwType,
            "Hardware Dimensions": hwDimensions,
            "Hardware Sub Category": hwSubCategory,
            "Accessory Name": accName,
            Quantity: it.quantity ?? "",
            "Quantity Ordered": actualQuantityOrdered || "",
            "Created At": createdAtStr,
            "Created By": createdByName,
            Notes: notes,
          };

          // Filter to only selected columns
          const filteredRow = {};
          selectedColumns.forEach((column) => {
            if (fullRow.hasOwnProperty(column)) {
              filteredRow[column] = fullRow[column];
            }
          });

          return filteredRow;
        });

        // If no items, still output one row for the MTO with blanks for item columns
        if (rows.length === 0) {
          const fullRow = {
            Project: projectName,
            Lot: lotsJoined,
            Items: itemsCount,
            "Items Remaining": itemsRemaining,
            Status: mto.status || "",
            "Supplier Name": "",
            "Image URL": "",
            Category: "",
            "Sheet Color": "",
            "Sheet Finish": "",
            "Sheet Face": "",
            "Sheet Dimensions": "",
            "Handle Color": "",
            "Handle Type": "",
            "Handle Dimensions": "",
            "Handle Material": "",
            "Hardware Name": "",
            "Hardware Type": "",
            "Hardware Dimensions": "",
            "Hardware Sub Category": "",
            "Accessory Name": "",
            Quantity: "",
            "Quantity Ordered": "",
            "Created At": createdAtStr,
            "Created By": createdByName,
            Notes: notes,
          };

          // Filter to only selected columns
          const filteredRow = {};
          selectedColumns.forEach((column) => {
            if (fullRow.hasOwnProperty(column)) {
              filteredRow[column] = fullRow[column];
            }
          });

          rows.push(filteredRow);
        }
        return rows;
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for selected columns only
      const colWidths = selectedColumns.map((column) => ({
        wch: columnWidthMap[column] || 15,
      }));
      ws["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "MaterialsToOrder");
      const currentDate = new Date().toISOString().split("T")[0];
      const filename = `materials_to_order_${currentDate}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`Exported ${exportData.length} rows to ${filename}`);
    } catch (err) {
      toast.error("Couldn't export to Excel. Try again.");
    } finally {
      setIsExporting(false);
    }
  };

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
        toast.error(SESSION_ERROR, TOAST_OPTIONS);
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
        toast.success(
          response.data.message || "Files uploaded.",
          TOAST_OPTIONS,
        );
        // Refresh media files
        const updatedMedia = [...mediaFiles, ...(response.data.data || [])];
        setMediaFiles(updatedMedia);
        // Refresh MTO list
        fetchMTOs();
        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        toast.error(
          response.data.message ||
            "Couldn't upload the files. Check your connection and try again.",
          TOAST_OPTIONS,
        );
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Couldn't upload the files. Check your connection and try again.",
        TOAST_OPTIONS,
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
        toast.error(SESSION_ERROR, TOAST_OPTIONS);
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
        toast.success("File deleted.", TOAST_OPTIONS);
        // Remove from local state
        setMediaFiles((prev) =>
          prev.filter((f) => f.id !== pendingDeleteMediaId),
        );
        // Refresh MTO list
        fetchMTOs();
        setShowDeleteMediaModal(false);
        setPendingDeleteMediaId(null);
      } else {
        toast.error(
          response.data.message ||
            "Couldn't delete the file. Check your connection and try again.",
          TOAST_OPTIONS,
        );
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Couldn't delete the file. Check your connection and try again.",
        TOAST_OPTIONS,
      );
    } finally {
      setDeletingMediaId(null);
    }
  };

  const handleDeleteMediaCancel = () => {
    setShowDeleteMediaModal(false);
    setPendingDeleteMediaId(null);
  };

  const handleMTODelete = (mtoId) => {
    const mto = mtos.find((m) => m.id === mtoId);
    if (mto) {
      setMtoPendingDelete(mto);
      setShowDeleteMTOModal(true);
    }
  };

  const handleMTODeleteConfirm = async () => {
    if (!mtoPendingDelete) return;

    setDeletingMTOId(mtoPendingDelete.id);
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR, TOAST_OPTIONS);
        return;
      }

      const response = await axios.delete(
        `/api/v1/materials_to_order/${mtoPendingDelete.id}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );

      if (response.data.status) {
        toast.success("Materials to order deleted.", TOAST_OPTIONS);
        // Refresh the MTO list
        fetchMTOs();
        setShowDeleteMTOModal(false);
        setMtoPendingDelete(null);
        // Close accordion if it was open
        if (openAccordionId === mtoPendingDelete.id) {
          setOpenAccordionId(null);
        }
      } else {
        toast.error(
          response.data.message ||
            "Couldn't delete the materials to order. Check your connection and try again.",
          TOAST_OPTIONS,
        );
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Couldn't delete the materials to order. Check your connection and try again.",
        TOAST_OPTIONS,
      );
    } finally {
      setDeletingMTOId(null);
    }
  };

  const handleMTODeleteCancel = () => {
    setShowDeleteMTOModal(false);
    setMtoPendingDelete(null);
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

  const openCreateMTO = () => setShowCreateMTOModal(true);

  const tabClass = (tab) =>
    `cursor-pointer py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-t-sm ${
      activeTab === tab
        ? "border-primary text-primary"
        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
    }`;

  const exportDisabled =
    isExporting ||
    filteredAndSortedMTOs.length === 0 ||
    selectedColumns.length === 0;
  const columnPickerDisabled =
    isExporting || filteredAndSortedMTOs.length === 0;

  // Categorised uploads for the media modal
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
  const pendingDeleteMtoName = mtoPendingDelete?.project?.name;

  const otherTab = activeTab === "active" ? "completed" : "active";
  const showInitialLoading = loading && mtos.length === 0;
  const showLoadError = !!error && !loading && mtos.length === 0;
  const showCumulativeLoading =
    loadingCumulative || (!cumulativeLoaded && !cumulativeError);

  // The items of one materials to order, grouped by supplier.
  const renderSupplierGroups = (mto) => {
    const { groups, orderedGroupNames } = groupItemsBySupplier(mto.items);

    return (
      <div className="space-y-4">
        {orderedGroupNames.map((name) => {
          const groupItems = groups.get(name) || [];

          // Show the button only if there are items to order (not reserved
          // and not fully ordered)
          const hasItemsToOrder = groupItems.some(
            (it) =>
              !reservedItemsMap[it.id] &&
              Number(it.quantity_ordered_po || 0) < Number(it.quantity || 0),
          );

          return (
            <div key={name}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="text-sm font-semibold text-slate-700">{name}</h3>
                {activeTab === "active" &&
                  name !== "Unassigned" &&
                  hasItemsToOrder && (
                    <button
                      type="button"
                      onClick={() => {
                        const supplierId = resolveSupplierId(
                          groupItems[0],
                          name,
                        );
                        if (!supplierId) return;
                        openCreatePOForSupplier(name, supplierId, mto.id);
                      }}
                      className={BTN_SECONDARY_COMPACT}
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
                        In stock
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
                    {groupItems.map((item) => {
                      const stockOnHand = Number(item.item?.quantity ?? 0);
                      const measurementUnit = item.item?.measurement_unit || "";

                      // Check if this item has a reservation
                      const reservation = reservedItemsMap[item.id];
                      const isReserved = !!reservation;

                      // Check if item has been ordered via PO
                      const isOrdered =
                        Number(item.quantity_ordered_po || 0) > 0;

                      // Quantity actually ordered on purchase orders
                      const actualQuantityOrdered = (
                        item.ordered_items || []
                      ).reduce(
                        (sum, poItem) => sum + (poItem.quantity || 0),
                        0,
                      );

                      const supplierRef =
                        item.item?.itemSuppliers?.find(
                          (is) => (is.supplier?.name || "Unassigned") === name,
                        )?.supplier_reference || item.item?.supplier_reference;

                      const label = itemLabel(item.item, item.item_id);
                      const isSaving = !!isSavingQuantityOrderedById[item.id];

                      return (
                        <tr
                          key={item.id}
                          className={
                            isReserved || isOrdered
                              ? "bg-slate-100"
                              : "hover:bg-slate-50 transition-colors"
                          }
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <ItemThumb
                              image={item.item?.image}
                              label={label}
                              onOpen={handleImageClick}
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <CategoryBadge category={item.item?.category} />
                          </td>
                          <td className="px-4 py-3">
                            <ItemDetails
                              detail={item.item}
                              supplierRef={supplierRef}
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <StockLevel
                              stock={stockOnHand}
                              unit={measurementUnit}
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <p className="text-sm font-mono text-slate-700">
                              {formatQty(
                                item.quantity,
                                item.item?.measurement_unit,
                              )}
                            </p>
                            {actualQuantityOrdered > 0 && (
                              <p className="text-xs font-mono text-slate-600">
                                Ordered {formatQty(actualQuantityOrdered)}
                              </p>
                            )}
                            {item.quantity_received > 0 && (
                              <p className="text-xs font-mono text-slate-600">
                                Received {formatQty(item.quantity_received)}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="flex flex-col items-end gap-1">
                              <div className="flex items-center gap-1">
                                {pendingChangesById[item.id] && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSaveQuantityOrdered(item.id)
                                      }
                                      disabled={isSaving}
                                      aria-label={`Save quantity ordered for ${label}`}
                                      title="Save"
                                      className={ICON_BTN_ACCENT}
                                    >
                                      <Check
                                        className="w-4 h-4"
                                        aria-hidden="true"
                                      />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleCancelQuantityOrdered(item.id)
                                      }
                                      disabled={isSaving}
                                      aria-label={`Discard quantity change for ${label}`}
                                      title="Cancel"
                                      className={ICON_BTN}
                                    >
                                      <X
                                        className="w-4 h-4"
                                        aria-hidden="true"
                                      />
                                    </button>
                                  </>
                                )}
                                <input
                                  type="number"
                                  min="0"
                                  aria-label={`Quantity ordered for ${label}`}
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
                                  disabled={isSaving || isOrdered || isReserved}
                                  title={
                                    isOrdered
                                      ? "A purchase order already covers this line"
                                      : isReserved
                                        ? "Stock is reserved for this line"
                                        : undefined
                                  }
                                  className={`w-24 text-right font-mono ${FIELD_COMPACT}`}
                                />
                              </div>
                              {item.ordered_by?.username &&
                                !pendingChangesById[item.id] && (
                                  <div className="text-xs text-slate-500">
                                    Ordered by {item.ordered_by.username}
                                  </div>
                                )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-start gap-2">
                              {isOrdered && (
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
                              {!isOrdered && item.quantity_received === 0 && (
                                <span
                                  className={`${BADGE} ${BADGE_TONES.warning}`}
                                >
                                  Pending
                                </span>
                              )}
                              {/* Reserve stock button */}
                              {!isOrdered &&
                                (stockOnHand > 0 || isReserved) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      !isReserved
                                        ? handleReserveStock(item, stockOnHand)
                                        : handleDeleteReservation(
                                            reservation.id,
                                            item.id,
                                          )
                                    }
                                    disabled={reservingItemId === item.id}
                                    className={BTN_SECONDARY_COMPACT}
                                  >
                                    {reservingItemId === item.id
                                      ? !isReserved
                                        ? "Reserving…"
                                        : "Unreserving…"
                                      : !isReserved
                                        ? "Reserve stock"
                                        : "Unreserve"}
                                  </button>
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

  return (
    <AdminShell>
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="px-4 py-2 shrink-0">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-slate-800">
              Materials to order
            </h1>
            <div className="flex items-center gap-2">
              <SearchBar />
              <button
                type="button"
                onClick={openCreateMTO}
                className={BTN_PRIMARY}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Create materials to order
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
          <div className="bg-white rounded-lg border border-slate-200 flex flex-col h-full overflow-hidden">
            {/* Fixed header section */}
            <div className="p-4 shrink-0 border-b border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Search */}
                <div className="flex items-center gap-2 flex-1 min-w-64 max-w-2xl relative">
                  <Search
                    className="h-4 w-4 absolute left-3 text-slate-400 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    aria-label="Search materials to order"
                    placeholder="Search by project, lot or status"
                    className="w-full text-sm text-slate-800 py-2 pr-3 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Reset, sort, export */}
                <div className="flex flex-wrap items-center gap-2">
                  {isAnyFilterActive && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className={BTN_SECONDARY}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      <span>Reset</span>
                    </button>
                  )}

                  <div className="relative dropdown-container">
                    <button
                      type="button"
                      onClick={() => {
                        setShowColumnDropdown(false);
                        setShowSortDropdown(!showSortDropdown);
                      }}
                      aria-haspopup="true"
                      aria-expanded={showSortDropdown}
                      className={BTN_SECONDARY}
                    >
                      <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                      <span>Sort by</span>
                    </button>
                    {showSortDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-300 rounded-lg z-40">
                        <div className="py-1">
                          {SORT_OPTIONS.map(({ field, label }) => (
                            <button
                              type="button"
                              key={field}
                              onClick={() => handleSort(field)}
                              className={MENU_ITEM}
                            >
                              {label} {getSortIcon(field)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative dropdown-container flex items-stretch">
                    <button
                      type="button"
                      onClick={handleExportToExcel}
                      disabled={exportDisabled}
                      className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 border-r-0 hover:bg-slate-100 rounded-l-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sheet className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {isExporting ? "Exporting…" : "Export to Excel"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSortDropdown(false);
                        setShowColumnDropdown(!showColumnDropdown);
                      }}
                      disabled={columnPickerDisabled}
                      aria-label="Choose columns to export"
                      aria-haspopup="true"
                      aria-expanded={showColumnDropdown}
                      className="cursor-pointer flex items-center px-2 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-r-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {showColumnDropdown && (
                      <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg z-40 max-h-96 overflow-y-auto">
                        <div className="py-1">
                          <label
                            className={`${MENU_CHECK_ROW} sticky top-0 bg-white border-b border-slate-200`}
                          >
                            <span className="font-medium">Select all</span>
                            <input
                              type="checkbox"
                              checked={
                                selectedColumns.length ===
                                availableColumns.length
                              }
                              onChange={() => handleColumnToggle("Select All")}
                              className={CHECKBOX}
                            />
                          </label>
                          {availableColumns.map((column) => (
                            <label key={column} className={MENU_CHECK_ROW}>
                              <span>{column}</span>
                              <input
                                type="checkbox"
                                checked={selectedColumns.includes(column)}
                                onChange={() => handleColumnToggle(column)}
                                className={CHECKBOX}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs section */}
            <div className="px-4 shrink-0 border-b border-slate-200">
              <div
                className="flex space-x-6"
                role="tablist"
                aria-label="Materials to order view"
              >
                <button
                  type="button"
                  role="tab"
                  id="mto-tab-cumulative"
                  aria-selected={activeTab === "cumulative"}
                  aria-controls="mto-panel"
                  onClick={() => setActiveTab("cumulative")}
                  className={tabClass("cumulative")}
                >
                  Cumulative list
                </button>
                <button
                  type="button"
                  role="tab"
                  id="mto-tab-active"
                  aria-selected={activeTab === "active"}
                  aria-controls="mto-panel"
                  onClick={() => setActiveTab("active")}
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
                  aria-selected={activeTab === "completed"}
                  aria-controls="mto-panel"
                  onClick={() => setActiveTab("completed")}
                  className={tabClass("completed")}
                >
                  <span className="flex items-center gap-2">
                    Completed
                    {tabCounts.completed > 0 && (
                      <span className={COUNT_BADGE}>{tabCounts.completed}</span>
                    )}
                  </span>
                </button>
              </div>
            </div>

            {/* Scrollable content section */}
            <div
              id="mto-panel"
              role="tabpanel"
              aria-labelledby={`mto-tab-${activeTab}`}
              className="flex-1 overflow-auto"
            >
              {activeTab === "cumulative" ? (
                <div className="p-4">
                  {showCumulativeLoading ? (
                    <div className="px-4 py-12 text-center">
                      <div
                        className="flex flex-col items-center gap-2"
                        role="status"
                      >
                        <span
                          className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin"
                          aria-hidden="true"
                        />
                        <p className="text-sm text-slate-600">
                          Loading cumulative list…
                        </p>
                      </div>
                    </div>
                  ) : cumulativeError ? (
                    <div className="px-4 py-12 text-center">
                      <div
                        className="flex flex-col items-center gap-2"
                        role="alert"
                      >
                        <AlertTriangle
                          className="w-8 h-8 text-red-500"
                          aria-hidden="true"
                        />
                        <p className="text-sm text-red-600">
                          {cumulativeError}
                        </p>
                        <button
                          type="button"
                          onClick={fetchCumulativeData}
                          className={BTN_SECONDARY_COMPACT}
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  ) : cumulativeData.length === 0 ? (
                    <div className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Package
                          className="w-8 h-8 text-slate-300"
                          aria-hidden="true"
                        />
                        <p className="text-sm text-slate-600">
                          No materials to order yet
                        </p>
                        <button
                          type="button"
                          onClick={openCreateMTO}
                          className={BTN_SECONDARY_COMPACT}
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          Create materials to order
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {cumulativeData.map((supplier) => (
                        <div
                          key={supplier.supplier_id}
                          className="bg-white border border-slate-200 rounded-lg overflow-hidden"
                        >
                          <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-800">
                                {supplier.supplier_name}
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {supplier.items.length} unique{" "}
                                {supplier.items.length === 1 ? "item" : "items"}
                              </p>
                            </div>
                            {supplier.supplier_id !== "unassigned" && (
                              <button
                                type="button"
                                onClick={() => {
                                  openCreatePOForSupplier(
                                    supplier.supplier_name,
                                    supplier.supplier_id,
                                  );
                                }}
                                className={BTN_SECONDARY_COMPACT}
                              >
                                <Plus className="w-4 h-4" aria-hidden="true" />
                                Create purchase order
                              </button>
                            )}
                          </div>
                          <div className="overflow-x-auto">
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
                                  <th
                                    scope="col"
                                    className={`${TH} text-right`}
                                  >
                                    Stock on hand
                                  </th>
                                  <th
                                    scope="col"
                                    className={`${TH} text-right`}
                                  >
                                    Cumulative qty
                                  </th>
                                  <th scope="col" className={`${TH} text-left`}>
                                    Sources
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-slate-200">
                                {supplier.items.map((item) => (
                                  <tr
                                    key={item.item_id}
                                    className="hover:bg-slate-50 transition-colors"
                                  >
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <ItemThumb
                                        image={item.image}
                                        label={itemLabel(item, item.item_id)}
                                        onOpen={handleImageClick}
                                      />
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <CategoryBadge category={item.category} />
                                    </td>
                                    <td className="px-4 py-3">
                                      <ItemDetails
                                        detail={item}
                                        supplierRef={item?.supplier_reference}
                                      />
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                      <StockLevel
                                        stock={Number(item.stock_on_hand)}
                                        unit={item.measurement_unit}
                                      />
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-mono font-semibold text-slate-800">
                                      {formatQty(
                                        item.cumulative_quantity,
                                        item.measurement_unit,
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="text-xs text-slate-600 space-y-1">
                                        {item.mto_sources.map((source, idx) => (
                                          <div key={idx}>
                                            <span className="font-medium">
                                              {source.project_name ||
                                                "Manually added"}
                                              :
                                            </span>{" "}
                                            {formatQty(
                                              source.quantity,
                                              item.measurement_unit,
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="min-w-full">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0 z-10">
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
                      {showInitialLoading ? (
                        <tr>
                          <td
                            className="px-4 py-12 text-center"
                            colSpan={TABLE_COLUMNS}
                          >
                            <div
                              className="flex flex-col items-center gap-2"
                              role="status"
                            >
                              <span
                                className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin"
                                aria-hidden="true"
                              />
                              <p className="text-sm text-slate-600">
                                Loading materials to order…
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : showLoadError ? (
                        <tr>
                          <td
                            className="px-4 py-12 text-center"
                            colSpan={TABLE_COLUMNS}
                          >
                            <div
                              className="flex flex-col items-center gap-2"
                              role="alert"
                            >
                              <AlertTriangle
                                className="w-8 h-8 text-red-500"
                                aria-hidden="true"
                              />
                              <p className="text-sm text-red-600">{error}</p>
                              <button
                                type="button"
                                onClick={fetchMTOs}
                                className={BTN_SECONDARY_COMPACT}
                              >
                                Try again
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : paginatedMTOs.length === 0 ? (
                        <tr>
                          <td
                            className="px-4 py-12 text-center"
                            colSpan={TABLE_COLUMNS}
                          >
                            <div className="flex flex-col items-center gap-2">
                              <Package
                                className="w-8 h-8 text-slate-300"
                                aria-hidden="true"
                              />
                              {mtos.length > 0 && isNarrowingFilterActive ? (
                                <>
                                  <p className="text-sm text-slate-600">
                                    No materials to order match your filters
                                  </p>
                                  <button
                                    type="button"
                                    onClick={handleReset}
                                    className={BTN_SECONDARY_COMPACT}
                                  >
                                    <RotateCcw
                                      className="h-4 w-4"
                                      aria-hidden="true"
                                    />
                                    Clear filters
                                  </button>
                                </>
                              ) : (
                                <>
                                  <p className="text-sm text-slate-600">
                                    {activeTab === "active"
                                      ? "No active materials to order yet"
                                      : "No completed materials to order yet"}
                                  </p>
                                  <div className="flex flex-wrap items-center justify-center gap-2">
                                    {activeTab === "active" && (
                                      <button
                                        type="button"
                                        onClick={openCreateMTO}
                                        className={BTN_SECONDARY_COMPACT}
                                      >
                                        <Plus
                                          className="h-4 w-4"
                                          aria-hidden="true"
                                        />
                                        Create materials to order
                                      </button>
                                    )}
                                    {tabCounts[otherTab] > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => setActiveTab(otherTab)}
                                        className={BTN_SECONDARY_COMPACT}
                                      >
                                        View {otherTab} ({tabCounts[otherTab]})
                                      </button>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedMTOs.map((mto) => {
                          const isOpen = openAccordionId === mto.id;
                          const projectName = mto.project?.name || EMPTY;
                          const rowName =
                            mto.project?.name || "these materials to order";
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
                                      setOpenAccordionId(
                                        isOpen ? null : mto.id,
                                      );
                                    }}
                                    aria-expanded={isOpen}
                                    aria-controls={
                                      isOpen ? `mto-${mto.id}` : undefined
                                    }
                                    aria-label={`${
                                      isOpen ? "Hide" : "Show"
                                    } items for ${rowName}`}
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
                                  <td
                                    colSpan={TABLE_COLUMNS}
                                    className="px-4 py-4 bg-slate-50"
                                  >
                                    <div
                                      id={`mto-${mto.id}`}
                                      className="space-y-4"
                                    >
                                      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
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
                                            Media files (
                                            {(mto.media || []).length})
                                          </button>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleMTODelete(mto.id);
                                          }}
                                          disabled={deletingMTOId === mto.id}
                                          aria-label={`Delete materials to order for ${rowName}`}
                                          className={BTN_DANGER_COMPACT}
                                        >
                                          {deletingMTOId === mto.id ? (
                                            <>
                                              <span
                                                className="w-4 h-4 border-2 border-red-200 border-t-red-700 rounded-full animate-spin"
                                                aria-hidden="true"
                                              />
                                              Deleting…
                                            </>
                                          ) : (
                                            <>
                                              <Trash2
                                                className="w-4 h-4"
                                                aria-hidden="true"
                                              />
                                              Delete
                                            </>
                                          )}
                                        </button>
                                      </div>

                                      {/* Items grouped by supplier */}
                                      {!!(mto.items && mto.items.length) &&
                                        renderSupplierGroups(mto)}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Fixed pagination footer */}
            {activeTab !== "cumulative" &&
              !showInitialLoading &&
              !showLoadError &&
              paginatedMTOs.length > 0 && (
                <PaginationFooter
                  totalItems={totalItems}
                  itemsPerPage={itemsPerPage}
                  currentPage={currentPage}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                  itemsPerPageOptions={[50, 100, 250, 0]}
                  showItemsPerPage={true}
                />
              )}
          </div>
        </div>
      </main>
      {showCreatePurchaseOrderModal && selectedSupplierForPO && (
        <PurchaseOrder
          materialsToOrder={mtosForSelectedSupplier}
          supplier={selectedSupplierForPO}
          setShowCreatePurchaseOrderModal={setShowCreatePurchaseOrderModal}
          fetchMaterialsToOrder={fetchMTOs}
          selectedMtoId={preSelectedMtoId}
        />
      )}

      {/* Media files modal */}
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
              {/* Display existing files first */}
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

              {/* Upload new files section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700">
                  Upload new files
                </h3>

                {/* File upload area */}
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
                            Uploading files…
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

      {/* File view modal */}
      {viewFileModal && selectedFile && (
        <ViewMedia
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          setViewFileModal={setViewFileModal}
          setPageNumber={setPageNumber}
        />
      )}

      {/* Delete media confirmation modal */}
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

      {/* Delete materials to order confirmation modal */}
      <DeleteConfirmation
        isOpen={showDeleteMTOModal}
        onClose={handleMTODeleteCancel}
        onConfirm={handleMTODeleteConfirm}
        deleteWithInput={true}
        heading="materials to order"
        title={
          pendingDeleteMtoName
            ? `Delete materials to order for ${pendingDeleteMtoName}?`
            : "Delete materials to order?"
        }
        warningHeading="This removes the materials to order and its items"
        message={
          pendingDeleteMtoName
            ? `The materials to order for ${pendingDeleteMtoName} and all of its items will be deleted.`
            : "These materials to order and all of their items will be deleted."
        }
        confirmButtonText="Delete materials to order"
        comparingName={
          mtoPendingDelete?.project?.name || mtoPendingDelete?.id || ""
        }
        isDeleting={deletingMTOId !== null}
        entityType="materials_to_order"
      />

      {/* Create materials to order modal */}
      {showCreateMTOModal && (
        <CreateMaterialsToOrderModal
          setShowModal={setShowCreateMTOModal}
          onSuccess={() => {
            fetchMTOs();
            setShowCreateMTOModal(false);
          }}
        />
      )}
    </AdminShell>
  );
}
