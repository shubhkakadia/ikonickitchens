"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import AdminShell from "@/components/AdminShell";
import PaginationFooter from "@/components/PaginationFooter";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import DeleteConfirmation from "@/components/DeleteConfirmation";
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
  NotebookText,
  User,
  X,
  Check,
  Upload,
  Trash2,
  AlertTriangle,
  Plus,
  Funnel,
} from "lucide-react";
import Image from "next/image";
import CreatePurchaseOrderModal from "./components/CreatePurchaseOrderModal";
import SearchBar from "@/components/SearchBar";
import useModalFocus from "@/hooks/useModalFocus";
import {
  usePersistedTableFilter,
  useTableFilterActions,
} from "@/hooks/usePersistedTableFilter";
import {
  BADGE,
  BADGE_TONES,
  BUTTON_COUNT_BADGE,
  COUNT_BADGE,
  STATUS_COLORS,
  formatQty,
  formatTime,
} from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";

const TABLE_KEY = "purchase-orders";
const EMPTY = "—";
const TABLE_COLUMNS = 6;
const SESSION_ERROR = "Your session has expired. Sign in again to continue.";
const LOAD_ERROR =
  "Couldn't load purchase orders. Check your connection and try again.";
const TOAST_OPTIONS = { position: "top-right", autoClose: 3000 };

const ACTIVE_STATUSES = ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"];

const PO_TABS = [
  { key: "active", label: "Active", statuses: ACTIVE_STATUSES },
  { key: "completed", label: "Completed", statuses: ["FULLY_RECEIVED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
];

// Fields the list can be sorted by. Used by both the "Sort by" menu and the
// column headers so the two never drift apart.
const SORT_OPTIONS = [
  { field: "date", label: "Date" },
  { field: "order", label: "Order no" },
  { field: "supplier", label: "Supplier" },
  { field: "status", label: "Status" },
  { field: "items", label: "Items" },
  { field: "total", label: "Total" },
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
const FIELD_FORM =
  "w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors duration-200 disabled:bg-slate-50 disabled:text-slate-600 disabled:cursor-not-allowed";
const FIELD_COMPACT =
  "text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors duration-200 disabled:bg-slate-50 disabled:text-slate-600 disabled:cursor-not-allowed";
const MENU_ITEM =
  "cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between";
const MENU_CHECK_ROW =
  "cursor-pointer flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors";
const CHECKBOX =
  "h-4 w-4 shrink-0 accent-primary border-slate-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
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

// Purchase order amounts carry cents, which the shared whole-dollar
// formatCurrency drops, so the AUD formatter is kept here.
const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatMoney = (value) => {
  if (value === null || value === undefined || value === "") return EMPTY;
  const num = Number(value);
  return Number.isNaN(num) ? EMPTY : AUD.format(num);
};

// Records show the year (an order date without one is ambiguous), so this stays
// local rather than using the compact shared formatDate.
const formatRecordDate = (value) => {
  if (!value) return EMPTY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY;
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatRecordDateTime = (value) => {
  if (!value) return EMPTY;
  const date = formatRecordDate(value);
  return date === EMPTY ? EMPTY : `${date}, ${formatTime(value)}`;
};

const lineTotal = (item) =>
  parseFloat(item.quantity) * parseFloat(item.unit_price);

// The list total: the order total plus the delivery charge with 10% GST.
const orderGrandTotal = (po) =>
  (parseFloat(po.total_amount) || 0) +
  (parseFloat(po.delivery_charge) || 0) * 1.1;

const invoiceHref = (invoice) =>
  invoice.url.startsWith("/") ? invoice.url : `/${invoice.url}`;

// The supplier's own reference for a line, falling back to the item's.
const supplierRefFor = (lineItem, supplier) =>
  lineItem?.itemSuppliers?.find(
    (is) => is.supplier?.supplier_id === supplier?.supplier_id,
  )?.supplier_reference || lineItem?.supplier_reference;

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

function Spinner({ className = "w-4 h-4" }) {
  return (
    <span
      className={`${className} border-2 border-slate-200 border-t-primary rounded-full animate-spin`}
      aria-hidden="true"
    />
  );
}

// Label/value pair in the order summary strip.
function Meta({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-600">
      <Icon className="w-4 h-4 text-slate-500" aria-hidden="true" />
      <span>
        <span className="font-medium text-slate-700">{label}</span> {children}
      </span>
    </div>
  );
}

// Item thumbnail. Opens the image viewer when `onOpen` is given. Falls back to
// a placeholder when there is no image or it fails to load.
function ItemThumb({ image, label, onOpen }) {
  const [failed, setFailed] = useState(false);

  if (!image?.url || failed) {
    return (
      <div className="w-10 h-10 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
        <Package className="w-5 h-5 text-slate-400" aria-hidden="true" />
      </div>
    );
  }

  const picture = (
    <Image
      loading="lazy"
      src={`/${image.url}`}
      alt={onOpen ? "" : label}
      className="w-10 h-10 object-cover rounded-lg border border-slate-200"
      onError={() => setFailed(true)}
      width={40}
      height={40}
    />
  );

  if (!onOpen) return picture;

  return (
    <button
      type="button"
      onClick={() => onOpen(image)}
      aria-label={`View image of ${label}`}
      title="View image"
      className="cursor-pointer block rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {picture}
    </button>
  );
}

// The category-specific attributes of an item, driven by DETAIL_FIELDS.
function ItemDetails({ detail, supplierRef, notes }) {
  const sections = Object.keys(DETAIL_FIELDS).filter((key) => detail?.[key]);

  return (
    <>
      <div className="text-xs text-slate-600 space-y-1">
        {supplierRef && (
          <div>
            <span className="font-medium text-slate-700">Supplier ref:</span>{" "}
            {supplierRef}
          </div>
        )}
        {sections.flatMap((key) =>
          DETAIL_FIELDS[key].map(([label, field]) => (
            <div key={`${key}-${field}`}>
              <span className="font-medium text-slate-700">{label}:</span>{" "}
              {detail[key][field] || EMPTY}
            </div>
          )),
        )}
        {sections.length === 0 && (
          <div>{detail?.description || notes || EMPTY}</div>
        )}
      </div>
      {notes && detail?.description && notes !== detail.description && (
        <div className="text-xs text-slate-500 mt-1 flex items-start gap-2">
          <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{notes}</span>
        </div>
      )}
    </>
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

// The lines of one purchase order with their totals.
function PurchaseOrderItems({ po, onOpenImage }) {
  return (
    <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
      <table className="w-full divide-y divide-slate-200">
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
              Remaining / received
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Unit price (excl. GST)
            </th>
            <th scope="col" className={`${TH} text-right`}>
              Total
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-200">
          {po.items.map((item) => {
            const orderedQty = parseFloat(item.quantity || 0) || 0;
            const receivedQty = parseFloat(item.quantity_received || 0) || 0;
            const remainingQty = Math.max(0, orderedQty - receivedQty);
            const unit = item.item?.measurement_unit || "";
            return (
              <tr
                key={item.id}
                className="hover:bg-slate-50 transition-colors duration-200"
              >
                <td className="px-4 py-3 whitespace-nowrap">
                  <ItemThumb
                    image={item.item?.image}
                    label={itemLabel(item.item, item.item?.item_id)}
                    onOpen={onOpenImage}
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <CategoryBadge category={item.item?.category} />
                </td>
                <td className="px-4 py-3">
                  <ItemDetails
                    detail={item.item}
                    supplierRef={supplierRefFor(item.item, po.supplier)}
                    notes={item.notes}
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-mono text-slate-700">
                  {formatQty(orderedQty, unit)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right">
                  <p className="text-xs font-mono text-slate-600">
                    Remaining {formatQty(remainingQty, unit)}
                  </p>
                  <p className="text-xs font-mono text-slate-600">
                    Received {formatQty(receivedQty, unit)}
                  </p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-mono text-slate-700">
                  {formatMoney(item.unit_price)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-mono font-semibold text-slate-800">
                  {formatMoney(lineTotal(item))}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-slate-50 divide-y divide-slate-200">
          <tr>
            <th
              scope="row"
              colSpan={6}
              className="px-4 py-2 text-right text-sm font-medium text-slate-700"
            >
              Order total
            </th>
            <td className="px-4 py-2 text-right text-sm font-mono font-semibold text-slate-800">
              {formatMoney(po.total_amount || 0)}
            </td>
          </tr>
          <tr>
            <th
              scope="row"
              colSpan={6}
              className="px-4 py-2 text-right text-sm font-medium text-slate-700"
            >
              Delivery charge (inc. 10% GST)
            </th>
            <td className="px-4 py-2 text-right text-sm font-mono font-semibold text-slate-800">
              {formatMoney((parseFloat(po.delivery_charge) || 0) * 1.1)}
            </td>
          </tr>
          <tr>
            <th
              scope="row"
              colSpan={6}
              className="px-4 py-2 text-right text-sm font-semibold text-slate-800"
            >
              Grand total
            </th>
            <td className="px-4 py-2 text-right text-sm font-mono font-semibold text-slate-900">
              {formatMoney(orderGrandTotal(po))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default function PurchaseOrdersPage() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pos, setPos] = useState([]);
  const [activeTab, setActiveTab] = usePersistedTableFilter(
    TABLE_KEY,
    "activeTab",
    "active",
  );
  const [search, setSearch] = usePersistedTableFilter(TABLE_KEY, "search", "");
  const [sortField, setSortField] = usePersistedTableFilter(
    TABLE_KEY,
    "sortField",
    "date",
  );
  const [sortOrder, setSortOrder] = usePersistedTableFilter(
    TABLE_KEY,
    "sortOrder",
    "desc",
  );
  const { resetFilters } = useTableFilterActions(TABLE_KEY);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showSupplierFilterDropdown, setShowSupplierFilterDropdown] =
    useState(false);
  const [showCreatePOModal, setShowCreatePOModal] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Define all available columns for export
  const availableColumns = [
    "Order No",
    "Supplier",
    "Status",
    "Created At",
    "Ordered At",
    "Ordered By",
    "Project ID",
    "Project Name",
    "Notes",
    "Image URL",
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
    "Category",
    "Quantity",
    "Unit Price (excluding GST)",
    "Total",
  ];

  // Initialize selected columns with all columns
  const [selectedColumns, setSelectedColumns] = useState([...availableColumns]);
  const [showMaterialsReceivedModal, setShowMaterialsReceivedModal] =
    useState(false);
  const [selectedPOId, setSelectedPOId] = useState("");
  const [selectedPO, setSelectedPO] = useState(null);
  const [quantityReceived, setQuantityReceived] = useState({});
  const [receiveError, setReceiveError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [poSearchTerm, setPoSearchTerm] = useState("");
  const [isPODropdownOpen, setIsPODropdownOpen] = useState(false);
  const poDropdownRef = useRef(null);
  const poInputRef = useRef(null);
  const receivedModalRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  // Invoice preview
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [selectedInvoiceFile, setSelectedInvoiceFile] = useState(null);
  const [, setPageNumber] = useState(1);
  // Invoice upload
  const [uploadingInvoicePOId, setUploadingInvoicePOId] = useState(null);
  // Invoice delete
  const [deletingInvoicePOId, setDeletingInvoicePOId] = useState(null);
  const [showDeleteInvoiceModal, setShowDeleteInvoiceModal] = useState(false);
  const [invoicePendingDelete, setInvoicePendingDelete] = useState(null);
  const invoiceFileInputRefs = useRef({});
  const [openAccordionId, setOpenAccordionId] = useState(null);
  // Purchase order delete
  const [deletingPOId, setDeletingPOId] = useState(null);
  const [showDeletePOModal, setShowDeletePOModal] = useState(false);
  const [poPendingDelete, setPoPendingDelete] = useState(null);
  // Purchase order cancel
  const [cancellingPOId, setCancellingPOId] = useState(null);
  const [showCancelPOModal, setShowCancelPOModal] = useState(false);
  const [poPendingCancel, setPoPendingCancel] = useState(null);
  // Editable notes state
  const [editableNotes, setEditableNotes] = useState({});
  const [saveStatus, setSaveStatus] = useState({});
  const notesDebounceTimers = useRef({});
  // ViewMedia state for item images
  const [viewFileModal, setViewFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Focus moves into the materials received modal, stays inside it, and
  // returns to the trigger on close (DESIGN.md 13.6).
  useModalFocus(receivedModalRef, showMaterialsReceivedModal);

  useEffect(() => {
    fetchPOs();
  }, []);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      Object.values(notesDebounceTimers.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  const fetchPOs = async () => {
    try {
      setLoading(true);
      setError("");
      const sessionToken = getToken();
      if (!sessionToken) {
        setError(SESSION_ERROR);
        return;
      }
      const response = await axios.get("/api/v1/purchase_order/all", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.data.status) {
        setPos(response.data.data || []);
      } else {
        const message = response.data.message || LOAD_ERROR;
        setError(message);
        // With a list already on screen the inline error state is not shown,
        // so say so in a toast instead.
        if (pos.length > 0) toast.error(message, TOAST_OPTIONS);
      }
    } catch (err) {
      const message = err?.response?.data?.message || LOAD_ERROR;
      setError(message);
      if (pos.length > 0) toast.error(message, TOAST_OPTIONS);
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

  // Get distinct suppliers from POs
  const distinctSuppliers = useMemo(() => {
    const suppliers = [
      ...new Set(pos.map((po) => po.supplier?.name).filter((name) => name)),
    ];
    return suppliers.sort();
  }, [pos]);

  const [selectedSuppliers, setSelectedSuppliers] = usePersistedTableFilter(
    TABLE_KEY,
    "selectedSuppliers",
    distinctSuppliers,
  );

  // Supplier and search filters, applied before the tab split so the tab
  // counts match what each tab would show.
  const searchedPOs = useMemo(() => {
    let list = pos || [];

    // Supplier filter
    if (selectedSuppliers.length > 0) {
      list = list.filter((po) => {
        const supplierName = po.supplier?.name;
        return supplierName && selectedSuppliers.includes(supplierName);
      });
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter((po) => {
        const orderNo = (po.order_no || "").toLowerCase();
        const supplierName = (po.supplier?.name || "").toLowerCase();
        const status = (po.status || "").toLowerCase();
        return (
          orderNo.includes(q) || supplierName.includes(q) || status.includes(q)
        );
      });
    }

    return list;
  }, [pos, search, selectedSuppliers]);

  const tabCounts = useMemo(() => {
    const counts = {};
    PO_TABS.forEach((tab) => {
      counts[tab.key] = searchedPOs.filter((po) =>
        tab.statuses.includes(po.status),
      ).length;
    });
    return counts;
  }, [searchedPOs]);

  const filteredAndSortedPOs = useMemo(() => {
    const statuses = PO_TABS.find((tab) => tab.key === activeTab)?.statuses;
    const list = searchedPOs.filter((po) => statuses?.includes(po.status));

    const withCounts = list.map((po) => {
      const itemsCount = po.items?.length || 0;
      const totalQty = (po.items || []).reduce(
        (sum, it) => sum + (parseFloat(it.quantity) || 0),
        0,
      );
      return { ...po, __itemsCount: itemsCount, __totalQty: totalQty };
    });

    withCounts.sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      let aVal;
      let bVal;
      switch (sortField) {
        case "order":
          aVal = (a.order_no || "").toLowerCase();
          bVal = (b.order_no || "").toLowerCase();
          break;
        case "supplier":
          aVal = (a.supplier?.name || "").toLowerCase();
          bVal = (b.supplier?.name || "").toLowerCase();
          break;
        case "status":
          aVal = (a.status || "").toLowerCase();
          bVal = (b.status || "").toLowerCase();
          break;
        case "items":
          aVal = a.__itemsCount;
          bVal = b.__itemsCount;
          break;
        case "total":
          aVal = parseFloat(a.total_amount || 0);
          bVal = parseFloat(b.total_amount || 0);
          break;
        case "date":
        default:
          aVal = new Date(a.ordered_at || a.createdAt || 0).getTime();
          bVal = new Date(b.ordered_at || b.createdAt || 0).getTime();
      }
      if (aVal < bVal) return -1 * dir;
      if (aVal > bVal) return 1 * dir;
      return 0;
    });

    return withCounts;
  }, [searchedPOs, activeTab, sortField, sortOrder]);

  // Pagination
  const totalItems = filteredAndSortedPOs.length;
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedPOs = filteredAndSortedPOs.slice(startIndex, endIndex);

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

  // A new search, supplier filter or tab is a new result set, so go back to the
  // first page. The supplier filter is keyed by its contents because the
  // persisted array is a new object on every render.
  const supplierFilterKey = selectedSuppliers.join("\u0000");
  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeTab, supplierFilterKey]);

  const handleReset = () => {
    resetFilters();
    setCurrentPage(1);
  };

  // Filters that narrow the list (sort does not hide records), used to tell
  // "no records" apart from "no results for this filter" (DESIGN.md 15.4).
  const isNarrowingFilterActive =
    search !== "" || selectedSuppliers.length !== distinctSuppliers.length;

  const isAnyFilterActive =
    isNarrowingFilterActive || sortField !== "date" || sortOrder !== "desc";

  const handleSupplierToggle = (supplier) => {
    if (supplier === "Select All") {
      if (selectedSuppliers.length === distinctSuppliers.length) {
        // If all suppliers are selected, unselect all
        setSelectedSuppliers([]);
      } else {
        // If not all suppliers are selected, select all
        setSelectedSuppliers([...distinctSuppliers]);
      }
    } else {
      setSelectedSuppliers((prev) =>
        prev.includes(supplier)
          ? prev.filter((s) => s !== supplier)
          : [...prev, supplier],
      );
    }
  };

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

  const activePOs = useMemo(() => {
    return (pos || []).filter((po) => ACTIVE_STATUSES.includes(po.status));
  }, [pos]);

  const filteredPOs = useMemo(() => {
    if (!poSearchTerm) return activePOs;
    const searchLower = poSearchTerm.toLowerCase();
    return activePOs.filter((po) => {
      const orderNo = (po.order_no || "").toLowerCase();
      const supplierName = (po.supplier?.name || "").toLowerCase();
      const status = (po.status || "").toLowerCase();
      return (
        orderNo.includes(searchLower) ||
        supplierName.includes(searchLower) ||
        status.includes(searchLower)
      );
    });
  }, [activePOs, poSearchTerm]);

  // Close the toolbar menus when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) {
        setShowSortDropdown(false);
        setShowSupplierFilterDropdown(false);
        setShowColumnDropdown(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowSortDropdown(false);
        setShowSupplierFilterDropdown(false);
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

  // Close the purchase order list when clicking outside and update position
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside the input and dropdown
      const isClickOnInput = poInputRef.current?.contains(event.target);
      const isClickOnDropdown = event.target.closest(
        '[data-dropdown="po-dropdown"]',
      );

      if (!isClickOnInput && !isClickOnDropdown) {
        setIsPODropdownOpen(false);
      }
    };

    const handleScroll = () => {
      if (isPODropdownOpen) {
        updateDropdownPosition();
      }
    };

    if (isPODropdownOpen) {
      updateDropdownPosition();
      // Use setTimeout to avoid immediate closure
      setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 0);
      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", updateDropdownPosition);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", updateDropdownPosition);
      };
    }
  }, [isPODropdownOpen]);

  const handlePOSelect = (poId) => {
    setSelectedPOId(poId);
    const po = pos.find((p) => p.id === poId);
    setSelectedPO(po);
    // Initialize new delivery quantities with 0 (not existing received)
    const initialQuantities = {};
    if (po && po.items) {
      po.items.forEach((item) => {
        initialQuantities[item.id] = 0;
      });
    }
    setQuantityReceived(initialQuantities);
    setReceiveError("");
    setIsPODropdownOpen(false);
    setPoSearchTerm("");
  };

  const updateDropdownPosition = () => {
    if (poInputRef.current) {
      const rect = poInputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  const handleQuantityReceivedChange = (itemId, value) => {
    const numValue = value === "" ? 0 : parseFloat(value);
    if (!isNaN(numValue) && numValue >= 0) {
      setQuantityReceived((prev) => ({
        ...prev,
        [itemId]: numValue,
      }));
      setReceiveError("");
    }
  };

  const getExistingReceived = (item) => {
    return item.quantity_received || 0;
  };

  const getRemaining = (item) => {
    const ordered = parseFloat(item.quantity || 0);
    const existing = getExistingReceived(item);
    return ordered - existing;
  };

  const handleSubmitMaterialsReceived = async () => {
    if (isSubmitting) return;

    if (!selectedPOId || !selectedPO) {
      setReceiveError("Select a purchase order.");
      return;
    }

    // Filter items with new delivery quantity > 0
    const itemsToProcess = selectedPO.items
      .filter((item) => {
        const newDelivery = quantityReceived[item.id] || 0;
        return newDelivery > 0 && (item.item?.item_id || item.item_id);
      })
      .map((item) => ({
        item_id: item.item?.item_id || item.item_id,
        quantity: parseFloat(quantityReceived[item.id] || 0),
        notes: `Goods received from supplier invoice`,
      }));

    // Validate inline and move focus to the first line that can be received.
    if (itemsToProcess.length === 0) {
      setReceiveError("Enter a new delivery quantity for at least one item.");
      const firstOpen = selectedPO.items.find((item) => getRemaining(item) > 0);
      if (firstOpen) {
        setTimeout(() => {
          document.getElementById(`receive-qty-${firstOpen.id}`)?.focus();
        }, 0);
      }
      return;
    }

    setReceiveError("");
    setIsSubmitting(true);
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR, TOAST_OPTIONS);
        return;
      }

      // Use the new batch receive endpoint (atomic transaction)
      const response = await axios.post(
        `/api/v1/purchase_order/received_items`,
        {
          purchase_order_id: selectedPOId,
          items: itemsToProcess,
        },
        {
          headers: { Authorization: `Bearer ${sessionToken}` },
        },
      );

      if (response.data.status) {
        toast.success(
          `Received quantities updated for ${itemsToProcess.length} ${
            itemsToProcess.length === 1 ? "item" : "items"
          }.`,
          TOAST_OPTIONS,
        );
        setShowMaterialsReceivedModal(false);
        setSelectedPOId("");
        setSelectedPO(null);
        setQuantityReceived({});
        setPoSearchTerm("");
        setIsPODropdownOpen(false);
        fetchPOs(); // Refresh the list
      } else {
        toast.error(
          response.data.message ||
            "Couldn't update the received quantities. Try again.",
          TOAST_OPTIONS,
        );
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Couldn't update the received quantities. Check your connection and try again.",
        TOAST_OPTIONS,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInvoiceUpload = async (poId, file) => {
    if (!file) return;

    setUploadingInvoicePOId(poId);
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR, TOAST_OPTIONS);
        return;
      }

      const formData = new FormData();
      formData.append("invoice", file);

      const response = await axios.patch(
        `/api/v1/purchase_order/${poId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );

      if (response.data.status) {
        toast.success("Invoice uploaded.", TOAST_OPTIONS);
        // Clear the file input
        if (invoiceFileInputRefs.current[poId]) {
          invoiceFileInputRefs.current[poId].value = "";
        }
        // Refresh the PO list
        fetchPOs();
      } else {
        toast.error(
          response.data.message ||
            "Couldn't upload the invoice. Check the file and try again.",
          TOAST_OPTIONS,
        );
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Couldn't upload the invoice. Check your connection and try again.",
        TOAST_OPTIONS,
      );
    } finally {
      setUploadingInvoicePOId(null);
    }
  };

  const handleInvoiceFileChange = (poId, e) => {
    const file = e.target.files[0];
    if (file) {
      handleInvoiceUpload(poId, file);
    }
  };

  const handleInvoiceDelete = (poId) => {
    setInvoicePendingDelete(poId);
    setShowDeleteInvoiceModal(true);
  };

  const handleInvoiceDeleteConfirm = async () => {
    if (!invoicePendingDelete) return;

    setDeletingInvoicePOId(invoicePendingDelete);
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR, TOAST_OPTIONS);
        return;
      }

      const response = await axios.patch(
        `/api/v1/purchase_order/${invoicePendingDelete}`,
        { invoice_url: null },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status) {
        toast.success("Invoice deleted.", TOAST_OPTIONS);
        // Refresh the PO list
        fetchPOs();
        setShowDeleteInvoiceModal(false);
        setInvoicePendingDelete(null);
      } else {
        toast.error(
          response.data.message || "Couldn't delete the invoice. Try again.",
          TOAST_OPTIONS,
        );
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Couldn't delete the invoice. Check your connection and try again.",
        TOAST_OPTIONS,
      );
    } finally {
      setDeletingInvoicePOId(null);
    }
  };

  const handleInvoiceDeleteCancel = () => {
    setShowDeleteInvoiceModal(false);
    setInvoicePendingDelete(null);
  };

  const handlePODelete = (poId) => {
    const po = pos.find((p) => p.id === poId);
    if (po) {
      setPoPendingDelete(po);
      setShowDeletePOModal(true);
    }
  };

  const handlePODeleteConfirm = async () => {
    if (!poPendingDelete) return;

    setDeletingPOId(poPendingDelete.id);
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR, TOAST_OPTIONS);
        return;
      }

      const response = await axios.delete(
        `/api/v1/purchase_order/${poPendingDelete.id}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );

      if (response.data.status) {
        toast.success(
          "Purchase order cancelled. It's now in the Cancelled tab.",
          TOAST_OPTIONS,
        );
        // Refresh the PO list
        fetchPOs();
        setShowDeletePOModal(false);
        setPoPendingDelete(null);
        // Close accordion if it was open
        if (openAccordionId === poPendingDelete.id) {
          setOpenAccordionId(null);
        }
      } else {
        toast.error(
          response.data.message ||
            "Couldn't delete the purchase order. Try again.",
          TOAST_OPTIONS,
        );
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Couldn't delete the purchase order. Check your connection and try again.",
        TOAST_OPTIONS,
      );
    } finally {
      setDeletingPOId(null);
    }
  };

  const handlePODeleteCancel = () => {
    setShowDeletePOModal(false);
    setPoPendingDelete(null);
  };

  // Cancelling can't be undone (the API won't reopen a cancelled order), so it
  // goes through a confirmation that names the record (DESIGN.md 15.5).
  const handlePOCancel = (po) => {
    setPoPendingCancel(po);
    setShowCancelPOModal(true);
  };

  const handlePOCancelConfirm = async () => {
    if (!poPendingCancel) return;

    const poId = poPendingCancel.id;
    setCancellingPOId(poId);
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR, TOAST_OPTIONS);
        return;
      }

      const response = await axios.patch(
        `/api/v1/purchase_order/${poId}`,
        { status: "CANCELLED" },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status) {
        toast.success("Purchase order cancelled.", TOAST_OPTIONS);
        // Refresh the PO list
        fetchPOs();
        setShowCancelPOModal(false);
        setPoPendingCancel(null);
        // Close accordion if it was open
        if (openAccordionId === poId) {
          setOpenAccordionId(null);
        }
      } else {
        toast.error(
          response.data.message ||
            "Couldn't cancel the purchase order. Try again.",
          TOAST_OPTIONS,
        );
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
          "Couldn't cancel the purchase order. Check your connection and try again.",
        TOAST_OPTIONS,
      );
    } finally {
      setCancellingPOId(null);
    }
  };

  const handlePOCancelDismiss = () => {
    setShowCancelPOModal(false);
    setPoPendingCancel(null);
  };

  const handleCloseMaterialsReceivedModal = () => {
    setShowMaterialsReceivedModal(false);
    setSelectedPOId("");
    setSelectedPO(null);
    setQuantityReceived({});
    setReceiveError("");
    setPoSearchTerm("");
    setIsPODropdownOpen(false);
  };

  // The materials received modal closes on Escape (DESIGN.md 9.4). An open
  // purchase order list closes first, and nothing closes mid-save.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape" || !showMaterialsReceivedModal) return;
      if (isPODropdownOpen) {
        setIsPODropdownOpen(false);
        return;
      }
      if (!isSubmitting) handleCloseMaterialsReceivedModal();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  // Save notes to API
  const saveNotes = async (poId, notesValue) => {
    try {
      setSaveStatus((prev) => ({ ...prev, [poId]: "saving" }));

      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(SESSION_ERROR, TOAST_OPTIONS);
        setSaveStatus((prev) => ({ ...prev, [poId]: "idle" }));
        return;
      }

      const response = await axios.patch(
        `/api/v1/purchase_order/${poId}`,
        { notes: notesValue },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status) {
        setSaveStatus((prev) => ({ ...prev, [poId]: "saved" }));
        // Update the PO in the state with the new notes
        setPos((prevPos) =>
          prevPos.map((po) =>
            po.id === poId ? { ...po, notes: notesValue } : po,
          ),
        );
        setTimeout(() => {
          setSaveStatus((prev) => ({ ...prev, [poId]: "idle" }));
        }, 2000);
      } else {
        toast.error(
          response.data.message || "Couldn't save the notes. Try again.",
          TOAST_OPTIONS,
        );
        setSaveStatus((prev) => ({ ...prev, [poId]: "idle" }));
      }
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error(
        "Couldn't save the notes. Check your connection and try again.",
        TOAST_OPTIONS,
      );
      setSaveStatus((prev) => ({ ...prev, [poId]: "idle" }));
    }
  };

  // Debounced handler for notes changes
  const handleNotesChange = (poId, value) => {
    setEditableNotes((prev) => ({ ...prev, [poId]: value }));

    // Clear existing timer
    if (notesDebounceTimers.current[poId]) {
      clearTimeout(notesDebounceTimers.current[poId]);
    }

    // Set new timer (1 second debounce)
    notesDebounceTimers.current[poId] = setTimeout(() => {
      saveNotes(poId, value);
    }, 1000);
  };

  const handleExportToExcel = async () => {
    if (filteredAndSortedPOs.length === 0) {
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
        "Order No": 16,
        Supplier: 24,
        Status: 12,
        "Created At": 20,
        "Ordered At": 14,
        "Ordered By": 22,
        "Project ID": 12,
        "Project Name": 20,
        Notes: 30,
        "Image URL": 28,
        "Sheet Color": 12,
        "Sheet Finish": 12,
        "Sheet Face": 10,
        "Sheet Dimensions": 18,
        "Handle Color": 12,
        "Handle Type": 12,
        "Handle Dimensions": 18,
        "Handle Material": 16,
        "Hardware Name": 16,
        "Hardware Type": 12,
        "Hardware Dimensions": 18,
        "Hardware Sub Category": 18,
        "Accessory Name": 16,
        Category: 12,
        Quantity: 10,
        "Unit Price (including GST)": 12,
        Total: 12,
      };

      const exportData = filteredAndSortedPOs.flatMap((po) => {
        const orderNo = po.order_no || "";
        const supplierName = po.supplier?.name || "";
        const status = po.status || "";
        const createdAtStr = po.createdAt
          ? new Date(po.createdAt).toLocaleString()
          : "";
        const orderedAtStr = po.ordered_at
          ? new Date(po.ordered_at).toLocaleDateString()
          : "";
        const orderedByName = po.orderedBy?.employee
          ? `${po.orderedBy.employee.first_name || ""} ${
              po.orderedBy.employee.last_name || ""
            }`.trim()
          : "";
        const notes = po.notes || "";

        const rows = (po.items || []).map((it) => {
          const item = it.item || {};
          const imageUrl = item.image?.url ? `${origin}/${item.image.url}` : "";
          const category = item.category || "";
          // Separate detail columns
          const sheetColor = item.sheet?.color || "";
          const sheetFinish = item.sheet?.finish || "";
          const sheetFace = item.sheet?.face || "";
          const sheetDimensions = item.sheet?.dimensions || "";
          const handleColor = item.handle?.color || "";
          const handleType = item.handle?.type || "";
          const handleDimensions = item.handle?.dimensions || "";
          const handleMaterial = item.handle?.material || "";
          const hwName = item.hardware?.name || "";
          const hwType = item.hardware?.type || "";
          const hwDimensions = item.hardware?.dimensions || "";
          const hwSubCategory = item.hardware?.sub_category || "";
          const accName = item.accessory?.name || "";

          // Build full row with all columns
          const fullRow = {
            "Order No": orderNo,
            Supplier: supplierName,
            Status: status,
            "Created At": createdAtStr,
            "Ordered At": orderedAtStr,
            "Ordered By": orderedByName,
            "Project ID": po.mto?.project?.project_id || "",
            "Project Name": po.mto?.project?.name || "",
            Notes: notes,
            "Image URL": imageUrl,
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
            Category: category,
            Quantity: it.quantity ?? "",
            "Unit Price (including GST)": it.unit_price ?? "",
            Total: (
              parseFloat(it.quantity || 0) * parseFloat(it.unit_price || 0)
            ).toFixed(2),
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

        if (rows.length === 0) {
          const fullRow = {
            "Order No": orderNo,
            Supplier: supplierName,
            Status: status,
            "Created At": createdAtStr,
            "Ordered At": orderedAtStr,
            "Ordered By": orderedByName,
            "Project ID": po.mto?.project?.project_id || "",
            "Project Name": po.mto?.project?.name || "",
            Notes: notes,
            "Image URL": "",
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
            Category: "",
            Quantity: "",
            "Unit Price (including GST)": "",
            Total: "",
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

      XLSX.utils.book_append_sheet(wb, ws, "PurchaseOrders");
      const currentDate = new Date().toISOString().split("T")[0];
      const filename = `purchase_orders_${currentDate}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`Exported ${exportData.length} rows to ${filename}`);
    } catch (err) {
      toast.error("Couldn't export the data. Try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const tabClass = (tab) =>
    `cursor-pointer py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-t-sm ${
      activeTab === tab
        ? "border-primary text-primary"
        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
    }`;

  const exportDisabled =
    isExporting ||
    filteredAndSortedPOs.length === 0 ||
    selectedColumns.length === 0;
  const columnPickerDisabled = isExporting || filteredAndSortedPOs.length === 0;

  const showInitialLoading = loading && pos.length === 0;
  const showLoadError = !!error && !loading && pos.length === 0;
  const activeTabLabel =
    PO_TABS.find((tab) => tab.key === activeTab)?.label || "";

  // The materials received modal keeps typed-in quantities on a stray backdrop
  // click (DESIGN.md 15.1).
  const receiveDirty = Object.values(quantityReceived).some(
    (value) => value > 0,
  );
  const selectedPOFromList = selectedPOId
    ? pos.find((p) => p.id === selectedPOId)
    : null;
  const selectedPOSummary = selectedPOFromList
    ? `${selectedPOFromList.order_no || ""} - ${
        selectedPOFromList.supplier?.name || "Unknown supplier"
      } (${formatLabel(selectedPOFromList.status)})`
    : poSearchTerm;

  const invoiceDeletePO = pos.find((po) => po.id === invoicePendingDelete);

  return (
    <AdminShell>
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="px-4 py-2 shrink-0">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-slate-800">
              Purchase orders
            </h1>
            <div className="flex items-center gap-2">
              <SearchBar />
              <button
                type="button"
                onClick={() => setShowCreatePOModal(true)}
                className={BTN_PRIMARY}
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                Create purchase order
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
                    aria-label="Search purchase orders"
                    placeholder="Search by order no, supplier or status"
                    className="w-full text-sm text-slate-800 py-2 pr-3 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Reset, filter, sort, receive, export */}
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
                        setShowSortDropdown(false);
                        setShowColumnDropdown(false);
                        setShowSupplierFilterDropdown(
                          !showSupplierFilterDropdown,
                        );
                      }}
                      aria-haspopup="true"
                      aria-expanded={showSupplierFilterDropdown}
                      className={BTN_SECONDARY}
                    >
                      <Funnel className="h-4 w-4" aria-hidden="true" />
                      <span>Filter by supplier</span>
                      {distinctSuppliers.length - selectedSuppliers.length >
                        0 && (
                        <span className={BUTTON_COUNT_BADGE}>
                          {distinctSuppliers.length - selectedSuppliers.length}
                        </span>
                      )}
                    </button>
                    {showSupplierFilterDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg z-40 max-h-96 overflow-y-auto">
                        <div className="py-1">
                          <label
                            className={`${MENU_CHECK_ROW} sticky top-0 bg-white border-b border-slate-200`}
                          >
                            <span className="font-medium">Select all</span>
                            <input
                              type="checkbox"
                              checked={
                                selectedSuppliers.length ===
                                distinctSuppliers.length
                              }
                              onChange={() =>
                                handleSupplierToggle("Select All")
                              }
                              className={CHECKBOX}
                            />
                          </label>
                          {distinctSuppliers.length === 0 && (
                            <p className="px-4 py-2.5 text-sm text-slate-500">
                              No suppliers yet
                            </p>
                          )}
                          {distinctSuppliers.map((supplier) => (
                            <label key={supplier} className={MENU_CHECK_ROW}>
                              <span className="truncate" title={supplier}>
                                {supplier}
                              </span>
                              <input
                                type="checkbox"
                                checked={selectedSuppliers.includes(supplier)}
                                onChange={() => handleSupplierToggle(supplier)}
                                className={CHECKBOX}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative dropdown-container">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSupplierFilterDropdown(false);
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

                  <button
                    type="button"
                    onClick={() => setShowMaterialsReceivedModal(true)}
                    className={BTN_SECONDARY}
                  >
                    <Package className="h-4 w-4" aria-hidden="true" />
                    <span>Materials received</span>
                  </button>

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
                        setShowSupplierFilterDropdown(false);
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
                aria-label="Purchase order status"
              >
                {PO_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    id={`po-tab-${tab.key}`}
                    aria-selected={activeTab === tab.key}
                    aria-controls="po-panel"
                    onClick={() => setActiveTab(tab.key)}
                    className={tabClass(tab.key)}
                  >
                    <span className="flex items-center gap-2">
                      {tab.label}
                      {tabCounts[tab.key] > 0 && (
                        <span className={COUNT_BADGE}>
                          {tabCounts[tab.key]}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable content section */}
            <div
              id="po-panel"
              role="tabpanel"
              aria-labelledby={`po-tab-${activeTab}`}
              className="flex-1 overflow-auto"
            >
              <div className="min-w-full">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <SortHeader
                        field="order"
                        label="Supplier / order"
                        sortField={sortField}
                        sortOrder={sortOrder}
                        onSort={handleSort}
                      />
                      <SortHeader
                        field="date"
                        label="Date"
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
                        field="total"
                        label="Total"
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
                        <span className="sr-only">Show details</span>
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
                            <Spinner className="w-6 h-6" />
                            <p className="text-sm text-slate-600">
                              Loading purchase orders…
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
                              onClick={fetchPOs}
                              className={BTN_SECONDARY_COMPACT}
                            >
                              Try again
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : paginatedPOs.length === 0 ? (
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
                            {pos.length > 0 && isNarrowingFilterActive ? (
                              <>
                                <p className="text-sm text-slate-600">
                                  No {activeTabLabel.toLowerCase()} purchase
                                  orders match your filters
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
                                  {pos.length === 0
                                    ? "No purchase orders yet"
                                    : `No ${activeTabLabel.toLowerCase()} purchase orders`}
                                </p>
                                {pos.length === 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setShowCreatePOModal(true)}
                                    className={BTN_SECONDARY_COMPACT}
                                  >
                                    <Plus
                                      className="h-4 w-4"
                                      aria-hidden="true"
                                    />
                                    Create purchase order
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedPOs.map((po) => {
                        const isOpen = openAccordionId === po.id;
                        const invoice = po.invoice_url;
                        const orderNo = po.order_no || "";
                        return (
                          <React.Fragment key={po.id}>
                            <tr
                              onClick={() =>
                                setOpenAccordionId(isOpen ? null : po.id)
                              }
                              className="cursor-pointer hover:bg-slate-50 transition-colors duration-200"
                            >
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span
                                    className="text-sm font-semibold text-slate-800 truncate max-w-xs"
                                    title={po.supplier?.name || undefined}
                                  >
                                    {po.supplier?.name || EMPTY}
                                  </span>
                                  <span className="text-xs font-mono text-slate-600 truncate">
                                    {po.order_no || EMPTY}
                                  </span>
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">
                                {po.ordered_at
                                  ? `Ordered ${formatRecordDate(po.ordered_at)}`
                                  : `Created ${formatRecordDate(po.createdAt)}`}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-mono text-slate-700">
                                {formatQty(po.__totalQty)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-mono text-slate-700">
                                {formatMoney(orderGrandTotal(po))}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3">
                                {po.status ? (
                                  <span
                                    className={`${BADGE} ${
                                      STATUS_COLORS[po.status] ||
                                      BADGE_TONES.neutral
                                    }`}
                                  >
                                    {formatLabel(po.status)}
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
                                    setOpenAccordionId(isOpen ? null : po.id);
                                  }}
                                  aria-expanded={isOpen}
                                  aria-controls={
                                    isOpen ? `po-${po.id}` : undefined
                                  }
                                  aria-label={`${
                                    isOpen ? "Hide" : "Show"
                                  } details for purchase order ${orderNo}`}
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
                                  <div id={`po-${po.id}`} className="space-y-4">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                        <Meta icon={Calendar} label="Created">
                                          {formatRecordDateTime(po.createdAt)}
                                        </Meta>
                                        {po.ordered_at && (
                                          <Meta icon={Calendar} label="Ordered">
                                            {formatRecordDate(po.ordered_at)}
                                          </Meta>
                                        )}
                                        {po.total_amount ? (
                                          <Meta icon={FileText} label="Total">
                                            <span className="font-mono font-semibold text-slate-800">
                                              {formatMoney(po.total_amount)}
                                            </span>
                                          </Meta>
                                        ) : null}
                                        {po.delivery_charge ? (
                                          <Meta
                                            icon={FileText}
                                            label="Delivery charge"
                                          >
                                            <span className="font-mono font-semibold text-slate-800">
                                              {formatMoney(po.delivery_charge)}
                                            </span>
                                          </Meta>
                                        ) : null}
                                        {po.invoice_date && (
                                          <Meta
                                            icon={Calendar}
                                            label="Invoice date"
                                          >
                                            {formatRecordDate(po.invoice_date)}
                                          </Meta>
                                        )}
                                        {po.mto?.project && (
                                          <span
                                            className={`${BADGE} ${BADGE_TONES.neutral}`}
                                          >
                                            Project {po.mto.project.project_id}{" "}
                                            - {po.mto.project.name}
                                          </span>
                                        )}
                                        {po.orderedBy?.employee && (
                                          <Meta icon={User} label="Ordered by">
                                            {po.orderedBy.employee.first_name}{" "}
                                            {po.orderedBy.employee.last_name}
                                          </Meta>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {po.status !== "CANCELLED" && (
                                          <button
                                            type="button"
                                            onClick={() => handlePOCancel(po)}
                                            disabled={cancellingPOId === po.id}
                                            className={BTN_SECONDARY_COMPACT}
                                          >
                                            <X
                                              className="w-4 h-4"
                                              aria-hidden="true"
                                            />
                                            Cancel purchase order
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => handlePODelete(po.id)}
                                          disabled={deletingPOId === po.id}
                                          className={BTN_DANGER_COMPACT}
                                        >
                                          {deletingPOId === po.id ? (
                                            <>
                                              <Spinner />
                                              Deleting…
                                            </>
                                          ) : (
                                            <>
                                              <Trash2
                                                className="w-4 h-4"
                                                aria-hidden="true"
                                              />
                                              Delete purchase order
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>

                                    {/* Editable notes section */}
                                    <div>
                                      <label
                                        htmlFor={`po-notes-${po.id}`}
                                        className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5"
                                      >
                                        <NotebookText
                                          className="w-4 h-4 text-slate-500"
                                          aria-hidden="true"
                                        />
                                        Notes
                                      </label>
                                      <div className="relative">
                                        <textarea
                                          id={`po-notes-${po.id}`}
                                          rows="2"
                                          value={
                                            editableNotes[po.id] !== undefined
                                              ? editableNotes[po.id]
                                              : po.notes || ""
                                          }
                                          onChange={(e) =>
                                            handleNotesChange(
                                              po.id,
                                              e.target.value,
                                            )
                                          }
                                          placeholder="e.g. Delivery confirmed for Friday"
                                          className={`w-full ${FIELD_COMPACT}`}
                                        />
                                        {/* Save status indicator */}
                                        <span
                                          role="status"
                                          className="pointer-events-none absolute bottom-2 right-3 text-xs"
                                        >
                                          {saveStatus[po.id] === "saving" && (
                                            <span className="flex items-center gap-1 bg-white px-1 rounded-sm text-slate-600">
                                              <Spinner className="w-3 h-3" />
                                              Saving…
                                            </span>
                                          )}
                                          {saveStatus[po.id] === "saved" && (
                                            <span className="flex items-center gap-1 bg-white px-1 rounded-sm text-green-800">
                                              <Check
                                                className="w-3 h-3"
                                                aria-hidden="true"
                                              />
                                              Saved
                                            </span>
                                          )}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Invoice section */}
                                    {invoice ? (
                                      <div className="border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 bg-white">
                                        <div className="flex items-center gap-3 min-w-0">
                                          <div className="w-10 h-10 shrink-0 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center">
                                            <FileText
                                              className="w-5 h-5 text-slate-500"
                                              aria-hidden="true"
                                            />
                                          </div>
                                          <div className="min-w-0">
                                            <div
                                              className="text-sm font-medium text-slate-800 truncate"
                                              title={
                                                invoice.filename || "Invoice"
                                              }
                                            >
                                              {invoice.filename || "Invoice"}
                                            </div>
                                            <div className="text-xs text-slate-500 truncate">
                                              {invoice.mime_type ||
                                                invoice.extension ||
                                                EMPTY}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setSelectedInvoiceFile({
                                                name:
                                                  invoice.filename || "Invoice",
                                                url: `/${invoice.url}`,
                                                type:
                                                  invoice.mime_type ||
                                                  (invoice.extension
                                                    ? `application/${invoice.extension}`
                                                    : "application/pdf"),
                                                size: invoice.size || 0,
                                                isExisting: true,
                                              });
                                              setShowInvoicePreview(true);
                                            }}
                                            aria-label={`View invoice for purchase order ${orderNo}`}
                                            className={BTN_SECONDARY_COMPACT}
                                          >
                                            View
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleInvoiceDelete(po.id)
                                            }
                                            disabled={
                                              deletingInvoicePOId === po.id
                                            }
                                            aria-label={`Delete invoice for purchase order ${orderNo}`}
                                            className={BTN_DANGER_COMPACT}
                                          >
                                            {deletingInvoicePOId === po.id ? (
                                              <>
                                                <Spinner />
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
                                          <a
                                            href={invoiceHref(invoice)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={`Download invoice for purchase order ${orderNo}`}
                                            className={BTN_SECONDARY_COMPACT}
                                          >
                                            Download
                                          </a>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="border border-slate-200 rounded-lg p-3 bg-white flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                          <div className="w-10 h-10 shrink-0 bg-slate-100 border border-slate-200 rounded-lg flex items-center justify-center">
                                            <FileText
                                              className="w-5 h-5 text-slate-400"
                                              aria-hidden="true"
                                            />
                                          </div>
                                          <div>
                                            <div className="text-sm font-medium text-slate-800">
                                              No invoice uploaded
                                            </div>
                                            <div className="text-xs text-slate-500">
                                              Upload an invoice file for this
                                              purchase order
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <input
                                            ref={(el) => {
                                              invoiceFileInputRefs.current[
                                                po.id
                                              ] = el;
                                            }}
                                            type="file"
                                            accept=".pdf,.doc,.docx,image/*"
                                            onChange={(e) =>
                                              handleInvoiceFileChange(po.id, e)
                                            }
                                            className="sr-only peer"
                                            id={`invoice-upload-${po.id}`}
                                            disabled={
                                              uploadingInvoicePOId === po.id
                                            }
                                          />
                                          <label
                                            htmlFor={`invoice-upload-${po.id}`}
                                            className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${
                                              uploadingInvoicePOId === po.id
                                                ? "opacity-50 cursor-not-allowed"
                                                : "cursor-pointer"
                                            }`}
                                          >
                                            {uploadingInvoicePOId === po.id ? (
                                              <>
                                                <Spinner />
                                                Uploading…
                                              </>
                                            ) : (
                                              <>
                                                <Upload
                                                  className="w-4 h-4"
                                                  aria-hidden="true"
                                                />
                                                Upload invoice
                                              </>
                                            )}
                                          </label>
                                        </div>
                                      </div>
                                    )}

                                    {/* Items table */}
                                    {po.items && po.items.length > 0 && (
                                      <PurchaseOrderItems
                                        po={po}
                                        onOpenImage={handleImageClick}
                                      />
                                    )}
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
            </div>

            {/* Fixed pagination footer */}
            {!showInitialLoading &&
              !showLoadError &&
              paginatedPOs.length > 0 && (
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

      {/* Materials received modal */}
      {showMaterialsReceivedModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
          onClick={() => {
            // Keep typed-in work on a stray backdrop click (DESIGN.md 15.1).
            if (!receiveDirty && !isSubmitting)
              handleCloseMaterialsReceivedModal();
          }}
        >
          <div
            ref={receivedModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="materials-received-title"
            className="bg-white rounded-xl border border-slate-200 w-full max-w-6xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <h2
                id="materials-received-title"
                className="text-lg font-semibold text-slate-800 flex items-center gap-2"
              >
                <Package className="w-5 h-5" aria-hidden="true" />
                Materials received
              </h2>
              <button
                type="button"
                onClick={handleCloseMaterialsReceivedModal}
                disabled={isSubmitting}
                className={ICON_BTN}
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitMaterialsReceived();
              }}
              className="flex flex-col min-h-0 flex-1"
            >
              <div className="p-6 overflow-y-auto flex-1">
                <div className="mb-6">
                  <label
                    htmlFor="received-po"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Purchase order
                  </label>
                  <div className="relative" ref={poDropdownRef}>
                    <div className="relative">
                      <input
                        id="received-po"
                        ref={poInputRef}
                        data-autofocus
                        type="text"
                        role="combobox"
                        aria-expanded={isPODropdownOpen}
                        aria-haspopup="listbox"
                        aria-controls="received-po-list"
                        aria-autocomplete="list"
                        aria-describedby="received-po-hint"
                        autoComplete="off"
                        value={selectedPOSummary}
                        onChange={(e) => {
                          const value = e.target.value;
                          setPoSearchTerm(value);
                          setIsPODropdownOpen(true);
                          if (selectedPOId) {
                            // If PO is selected, clear selection when typing
                            setSelectedPOId("");
                            setSelectedPO(null);
                            setQuantityReceived({});
                            setReceiveError("");
                          }
                        }}
                        onFocus={() => {
                          setIsPODropdownOpen(true);
                          updateDropdownPosition();
                        }}
                        placeholder="Search by order no or supplier"
                        className={`${FIELD_FORM} pr-10`}
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        aria-label={
                          isPODropdownOpen ? "Close options" : "Open options"
                        }
                        onClick={() => {
                          setIsPODropdownOpen(!isPODropdownOpen);
                          if (!isPODropdownOpen) {
                            updateDropdownPosition();
                          } else if (!selectedPOId) {
                            setPoSearchTerm("");
                          }
                        }}
                        className="cursor-pointer absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 hover:text-slate-700 transition-colors duration-200"
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isPODropdownOpen ? "rotate-180" : ""
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </div>
                  <p
                    id="received-po-hint"
                    className="text-xs text-slate-500 mt-1"
                  >
                    Lists purchase orders that are draft, ordered or partially
                    received.
                  </p>
                </div>

                {isPODropdownOpen && (
                  <div
                    id="received-po-list"
                    role="listbox"
                    data-dropdown="po-dropdown"
                    className="fixed z-40 bg-white border border-slate-300 rounded-lg max-h-60 overflow-auto"
                    style={{
                      top: `${dropdownPosition.top}px`,
                      left: `${dropdownPosition.left}px`,
                      width: `${dropdownPosition.width}px`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {filteredPOs.length > 0 ? (
                      filteredPOs.map((po) => (
                        <button
                          key={po.id}
                          type="button"
                          role="option"
                          aria-selected={po.id === selectedPOId}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePOSelect(po.id);
                          }}
                          className="cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-800 hover:bg-slate-100 transition-colors duration-200 first:rounded-t-lg last:rounded-b-lg"
                        >
                          <div className="font-mono font-medium">
                            {po.order_no || EMPTY}
                          </div>
                          <div className="text-xs text-slate-500">
                            {po.supplier?.name || "Unknown supplier"} -{" "}
                            {formatLabel(po.status)}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center">
                        No matching purchase orders
                      </div>
                    )}
                  </div>
                )}

                {selectedPO &&
                  selectedPO.items &&
                  selectedPO.items.length > 0 && (
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
                              Quantity ordered
                            </th>
                            <th scope="col" className={`${TH} text-right`}>
                              Remaining / received
                            </th>
                            <th scope="col" className={`${TH} text-right`}>
                              New delivery
                            </th>
                            <th scope="col" className={`${TH} text-left`}>
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {selectedPO.items.map((item) => {
                            const orderedQty = parseFloat(item.quantity || 0);
                            const existingReceived = getExistingReceived(item);
                            const remainingQty = getRemaining(item);
                            const newDelivery = quantityReceived[item.id] || 0;
                            const totalAfterDelivery =
                              existingReceived + newDelivery;
                            const isComplete = totalAfterDelivery >= orderedQty;
                            const exceedsRemaining = newDelivery > remainingQty;
                            const unit = item.item?.measurement_unit || "";
                            const label = itemLabel(
                              item.item,
                              item.item?.item_id,
                            );
                            return (
                              <tr
                                key={item.id}
                                className="hover:bg-slate-50 transition-colors duration-200"
                              >
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <ItemThumb
                                    image={item.item?.image}
                                    label={label}
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <CategoryBadge
                                    category={item.item?.category}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <ItemDetails
                                    detail={item.item}
                                    supplierRef={item.item?.supplier_reference}
                                    notes={item.notes}
                                  />
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-mono text-slate-700">
                                  {formatQty(orderedQty, unit)}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                  <p className="text-xs font-mono text-slate-600">
                                    Remaining {formatQty(remainingQty, unit)}
                                  </p>
                                  <p className="text-xs font-mono text-slate-600">
                                    Received {formatQty(existingReceived, unit)}
                                  </p>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                  {remainingQty === 0 ? (
                                    <span
                                      className={`${BADGE} ${STATUS_COLORS.FULLY_RECEIVED}`}
                                    >
                                      <Check
                                        className="w-3 h-3"
                                        aria-hidden="true"
                                      />
                                      Received
                                    </span>
                                  ) : (
                                    <div className="flex flex-col items-end gap-1">
                                      <div className="flex items-center gap-2">
                                        <input
                                          id={`receive-qty-${item.id}`}
                                          type="number"
                                          min="0"
                                          max={remainingQty}
                                          value={newDelivery || ""}
                                          onChange={(e) =>
                                            handleQuantityReceivedChange(
                                              item.id,
                                              e.target.value,
                                            )
                                          }
                                          aria-label={`New delivery for ${label}`}
                                          aria-invalid={
                                            exceedsRemaining || undefined
                                          }
                                          aria-describedby={
                                            exceedsRemaining
                                              ? `receive-qty-${item.id}-error`
                                              : undefined
                                          }
                                          placeholder="0"
                                          className={`w-24 text-right font-mono ${FIELD_COMPACT} ${
                                            exceedsRemaining
                                              ? "border-red-500 focus:ring-red-500"
                                              : ""
                                          }`}
                                        />
                                        {unit && (
                                          <span className="text-sm text-slate-600">
                                            {unit}
                                          </span>
                                        )}
                                      </div>
                                      {exceedsRemaining && (
                                        <p
                                          id={`receive-qty-${item.id}-error`}
                                          className="text-xs text-red-600"
                                        >
                                          Exceeds the remaining quantity.
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {remainingQty > 0 &&
                                    isComplete &&
                                    newDelivery > 0 && (
                                      <span
                                        className={`${BADGE} ${STATUS_COLORS.FULLY_RECEIVED}`}
                                      >
                                        <Check
                                          className="w-3 h-3"
                                          aria-hidden="true"
                                        />
                                        Complete
                                      </span>
                                    )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                {selectedPO &&
                  (!selectedPO.items || selectedPO.items.length === 0) && (
                    <div className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Package
                          className="w-8 h-8 text-slate-300"
                          aria-hidden="true"
                        />
                        <p className="text-sm text-slate-600">
                          No items on this purchase order
                        </p>
                      </div>
                    </div>
                  )}

                {receiveError && (
                  <p role="alert" className="text-xs text-red-600 mt-3">
                    {receiveError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseMaterialsReceivedModal}
                  disabled={isSubmitting}
                  className={BTN_SECONDARY}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedPOId || isSubmitting}
                  aria-busy={isSubmitting}
                  className={BTN_PRIMARY}
                >
                  {isSubmitting ? (
                    <span
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Check className="w-4 h-4" aria-hidden="true" />
                  )}
                  Update received quantities
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice preview modal */}
      {showInvoicePreview && selectedInvoiceFile && (
        <ViewMedia
          selectedFile={selectedInvoiceFile}
          setSelectedFile={setSelectedInvoiceFile}
          setViewFileModal={setShowInvoicePreview}
          setPageNumber={setPageNumber}
        />
      )}

      {/* Delete invoice confirmation modal */}
      <DeleteConfirmation
        isOpen={showDeleteInvoiceModal}
        onClose={handleInvoiceDeleteCancel}
        onConfirm={handleInvoiceDeleteConfirm}
        deleteWithInput={false}
        heading="Invoice"
        title={
          invoiceDeletePO?.order_no
            ? `Delete invoice for ${invoiceDeletePO.order_no}?`
            : "Delete invoice?"
        }
        message={
          invoiceDeletePO?.order_no
            ? `This will permanently delete the invoice file attached to purchase order ${invoiceDeletePO.order_no}. This action cannot be undone.`
            : "This will permanently delete the invoice file. This action cannot be undone."
        }
        confirmButtonText="Delete invoice"
        isDeleting={deletingInvoicePOId !== null}
      />

      {/* Cancel purchase order confirmation modal */}
      <DeleteConfirmation
        isOpen={showCancelPOModal}
        onClose={handlePOCancelDismiss}
        onConfirm={handlePOCancelConfirm}
        deleteWithInput={false}
        heading="Purchase order"
        title={
          poPendingCancel?.order_no
            ? `Cancel purchase order ${poPendingCancel.order_no}?`
            : "Cancel purchase order?"
        }
        warningHeading="This can't be undone"
        message={`${
          poPendingCancel?.order_no || "The purchase order"
        } moves to the Cancelled tab and stays on record. A cancelled purchase order can't be reopened, and whatever it ordered goes back onto its Materials to Order list.`}
        cancelButtonText="Keep purchase order"
        confirmButtonText="Cancel purchase order"
        confirmingText="Cancelling..."
        isDeleting={cancellingPOId !== null}
      />

      {/* Delete purchase order confirmation modal */}
      <DeleteConfirmation
        isOpen={showDeletePOModal}
        onClose={handlePODeleteCancel}
        onConfirm={handlePODeleteConfirm}
        deleteWithInput={true}
        heading="Purchase order"
        title={
          poPendingDelete?.order_no
            ? `Delete purchase order ${poPendingDelete.order_no}?`
            : "Delete purchase order?"
        }
        warningHeading="This will cancel the purchase order"
        message="The purchase order is not erased. It moves to the Cancelled list and stays on record, and whatever it ordered goes back onto its Materials to Order list. A purchase order that has already received stock can't be deleted; cancel it instead."
        confirmButtonText="Delete purchase order"
        comparingName={poPendingDelete?.order_no || ""}
        isDeleting={deletingPOId !== null}
      />

      {showCreatePOModal && (
        <CreatePurchaseOrderModal
          setShowModal={setShowCreatePOModal}
          onSuccess={fetchPOs}
        />
      )}

      {/* Item image viewer modal */}
      {viewFileModal && selectedFile && (
        <ViewMedia
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          setViewFileModal={setViewFileModal}
          setPageNumber={setPageNumber}
        />
      )}
    </AdminShell>
  );
}
