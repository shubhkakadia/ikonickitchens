import React, { useEffect, useState, useRef, useMemo } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import PaginationFooter from "@/components/PaginationFooter";
import { useUploadProgress } from "@/hooks/useUploadProgress";
import {
  AlertTriangle,
  Package,
  PackagePlus,
  ChevronDown,
  Calendar,
  NotebookText,
  User,
  FileText,
  Upload,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import Image from "next/image";
import CreatePurchaseOrderModal from "@/app/admin/suppliers/purchaseorder/components/CreatePurchaseOrderModal";
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
const TABLE_COLUMNS = 6;
const DEFAULT_ROWS_PER_PAGE = 25;
const TOAST_OPTIONS = { position: "top-right", autoClose: 3000 };

// Button recipes from DESIGN.md 9.1 (compact variants for in-table actions).
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
// A red-ink outline for destructive actions that sit beside secondary buttons;
// the solid red button lives in the confirmation dialog.
const BTN_DANGER =
  "cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-red-600 disabled:opacity-50 disabled:cursor-not-allowed";
const TH =
  "px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider";

const PO_TABS = [
  {
    key: "active",
    label: "Active",
    statuses: ["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"],
  },
  { key: "completed", label: "Completed", statuses: ["FULLY_RECEIVED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
];

// Item detail fields per category, in the order the item record carries them.
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

// Purchase order totals need cents, which the shared whole-dollar
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

const orderSubtotal = (po) =>
  (po.items || []).reduce((sum, item) => sum + lineTotal(item), 0);

const gstOf = (subtotal) => Math.ceil(subtotal * 0.1 * 100) / 100;

const invoiceHref = (invoice) =>
  invoice.url.startsWith("/") ? invoice.url : `/${invoice.url}`;

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

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`${TH} ${alignRight ? "text-right" : ""}`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`cursor-pointer flex items-center gap-2 uppercase tracking-wider hover:text-slate-700 transition-colors duration-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary ${
          alignRight ? "ml-auto" : ""
        }`}
      >
        {label}
        {isActive &&
          (sortOrder === "asc" ? (
            <ArrowUp className="w-4 h-4 text-primary" aria-hidden="true" />
          ) : (
            <ArrowDown className="w-4 h-4 text-primary" aria-hidden="true" />
          ))}
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

// Category-specific details for one order line.
function ItemDetails({ lineItem, notes }) {
  const item = lineItem;
  const sections = Object.keys(DETAIL_FIELDS).filter((key) => item?.[key]);

  return (
    <>
      <div className="text-xs text-slate-600 space-y-1">
        {sections.flatMap((key) =>
          DETAIL_FIELDS[key].map(([label, field]) => (
            <div key={`${key}-${field}`}>
              <span className="font-medium text-slate-700">{label}:</span>{" "}
              {item[key][field] || EMPTY}
            </div>
          )),
        )}
        {sections.length === 0 && (
          <div>{item?.description || notes || EMPTY}</div>
        )}
      </div>
      {notes && item?.description && notes !== item.description && (
        <div className="text-xs text-slate-500 mt-1 flex items-start gap-2">
          <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{notes}</span>
        </div>
      )}
    </>
  );
}

export default function PurchaseOrder({ supplierId, onCountChange }) {
  const { getToken } = useAuth();
  const {
    showProgressToast,
    completeUpload,
    dismissProgressToast,
    getUploadProgressHandler,
  } = useUploadProgress();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loadingPO, setLoadingPO] = useState(true);
  const [error, setError] = useState("");
  const [poActiveTab, setPoActiveTab] = useState("active");
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [openAccordionId, setOpenAccordionId] = useState(null);
  const [showCreatePurchaseOrderModal, setShowCreatePurchaseOrderModal] =
    useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

  // invoice preview
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
  // Purchase order delete
  const [deletingPOId, setDeletingPOId] = useState(null);
  const [showDeletePOModal, setShowDeletePOModal] = useState(false);
  const [poPendingDelete, setPoPendingDelete] = useState(null);
  // Purchase order cancel
  const [cancellingPOId, setCancellingPOId] = useState(null);
  const [showCancelPOModal, setShowCancelPOModal] = useState(false);
  const [poPendingCancel, setPoPendingCancel] = useState(null);

  const fetchPurchaseOrders = async () => {
    try {
      setLoadingPO(true);
      setError("");
      const sessionToken = getToken();
      if (!sessionToken) {
        setError("Your session has expired. Sign in again to continue.");
        return;
      }
      const response = await axios.get(
        `/api/v1/purchase_order/by-supplier/${supplierId}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );
      if (response.data.status) {
        const data = response.data.data || [];
        setPurchaseOrders(data);
        if (onCountChange) onCountChange(data.length || 0);
      } else {
        console.error(
          "Failed to fetch purchase orders:",
          response.data.message,
        );
        setError(
          response.data.message ||
            "Couldn't load purchase orders. Check your connection and try again.",
        );
      }
    } catch (err) {
      console.error("Error fetching purchase orders:", err);
      console.error("Error details:", err.response?.data);
      setError(
        err.response?.data?.message ||
          "Couldn't load purchase orders. Check your connection and try again.",
      );
      setPurchaseOrders([]);
    } finally {
      setLoadingPO(false);
    }
  };

  useEffect(() => {
    if (!supplierId) return;
    fetchPurchaseOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const handleInvoiceUpload = async (poId, file) => {
    if (!file) return;

    setUploadingInvoicePOId(poId);
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error(
          "Your session has expired. Sign in again to continue.",
          TOAST_OPTIONS,
        );
        return;
      }

      const formData = new FormData();
      formData.append("invoice", file);

      // Show progress toast
      showProgressToast(1);

      const response = await axios.patch(
        `/api/v1/purchase_order/${poId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
          onUploadProgress: getUploadProgressHandler(1),
        },
      );

      if (response.data.status) {
        toast.success("Invoice uploaded.", TOAST_OPTIONS);
        completeUpload(1);
        // Refresh the PO list
        fetchPurchaseOrders();
      } else {
        dismissProgressToast();
        toast.error(
          response.data.message ||
            "Couldn't upload the invoice. Check the file and try again.",
          TOAST_OPTIONS,
        );
      }
    } catch (err) {
      dismissProgressToast();
      toast.error(
        err?.response?.data?.message ||
          "Couldn't upload the invoice. Check your connection and try again.",
        TOAST_OPTIONS,
      );
    } finally {
      setUploadingInvoicePOId(null);
      // Clear the file input regardless of success or failure
      if (invoiceFileInputRefs.current[poId]) {
        invoiceFileInputRefs.current[poId].value = "";
      }
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
        toast.error(
          "Your session has expired. Sign in again to continue.",
          TOAST_OPTIONS,
        );
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
        fetchPurchaseOrders();
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
    const po = purchaseOrders.find((p) => p.id === poId);
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
        toast.error(
          "Your session has expired. Sign in again to continue.",
          TOAST_OPTIONS,
        );
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
        fetchPurchaseOrders();
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
        toast.error(
          "Your session has expired. Sign in again to continue.",
          TOAST_OPTIONS,
        );
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
        fetchPurchaseOrders();
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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const tabCounts = useMemo(() => {
    const counts = {};
    PO_TABS.forEach((tab) => {
      counts[tab.key] = purchaseOrders.filter((po) =>
        tab.statuses.includes(po.status),
      ).length;
    });
    return counts;
  }, [purchaseOrders]);

  const filteredPOs = useMemo(() => {
    const statuses = PO_TABS.find((tab) => tab.key === poActiveTab)?.statuses;
    const list = purchaseOrders.filter((po) => statuses?.includes(po.status));

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
  }, [purchaseOrders, poActiveTab, sortField, sortOrder]);

  // Pagination is applied client side: the supplier's orders are fetched in full.
  const paginatedPOs = useMemo(() => {
    if (rowsPerPage === 0) return filteredPOs;
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredPOs.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredPOs, currentPage, rowsPerPage]);

  // A new tab or sort order is a new result set.
  useEffect(() => {
    setCurrentPage(1);
  }, [poActiveTab, sortField, sortOrder]);

  // Keep the page in range when the list shrinks (e.g. after a cancel).
  useEffect(() => {
    if (rowsPerPage === 0) return;
    const totalPages = Math.max(1, Math.ceil(filteredPOs.length / rowsPerPage));
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, filteredPOs.length, rowsPerPage]);

  const activeTabLabel =
    PO_TABS.find((tab) => tab.key === poActiveTab)?.label || "";
  const showLoading = loadingPO && purchaseOrders.length === 0;
  const showError = !loadingPO && Boolean(error);

  const tabClass = (key) =>
    `cursor-pointer py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-t-sm ${
      poActiveTab === key
        ? "border-primary text-primary"
        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
    }`;

  const invoiceDeletePO = purchaseOrders.find(
    (po) => po.id === invoicePendingDelete,
  );

  return (
    <div>
      {/* Sub-tabs for Purchase Order */}
      <div className="border-b border-slate-200 mb-4 flex items-center justify-between gap-3 pl-4">
        <nav
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
              aria-selected={poActiveTab === tab.key}
              aria-controls="po-panel"
              onClick={() => setPoActiveTab(tab.key)}
              className={tabClass(tab.key)}
            >
              <div className="flex items-center gap-2">
                {tab.label}
                {tabCounts[tab.key] > 0 && (
                  <span className={COUNT_BADGE}>{tabCounts[tab.key]}</span>
                )}
              </div>
            </button>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setShowCreatePurchaseOrderModal(true)}
          className={`${BTN_PRIMARY} mb-2`}
        >
          <PackagePlus className="w-4 h-4" aria-hidden="true" />
          Create purchase order
        </button>
      </div>

      {/* Purchase Order Content */}
      <div
        id="po-panel"
        role="tabpanel"
        aria-labelledby={`po-tab-${poActiveTab}`}
        className="bg-white rounded-lg border border-slate-200 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <SortHeader
                  field="order"
                  label="Order / supplier"
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
              {showLoading ? (
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
              ) : showError ? (
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
                        onClick={fetchPurchaseOrders}
                        className={BTN_SECONDARY}
                      >
                        Try again
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredPOs.length === 0 ? (
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
                      <p className="text-sm text-slate-600">
                        {purchaseOrders.length === 0
                          ? "No purchase orders yet"
                          : `No ${activeTabLabel.toLowerCase()} purchase orders`}
                      </p>
                      {purchaseOrders.length === 0 && (
                        <p className="text-xs text-slate-500">
                          Create a purchase order to order materials from this
                          supplier.
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPOs.map((po) => {
                  const isOpen = openAccordionId === po.id;
                  const invoice = po.invoice_url;
                  const subtotal = orderSubtotal(po);
                  const gst = gstOf(subtotal);
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
                            <span className="text-sm font-mono font-semibold text-slate-800 truncate">
                              {po.order_no || EMPTY}
                            </span>
                            <span className="text-xs text-slate-600 truncate">
                              {po.supplier?.name || EMPTY}
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
                          {formatMoney(po.total_amount)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`${BADGE} ${
                              STATUS_COLORS[po.status] || BADGE_TONES.neutral
                            }`}
                          >
                            {po.status ? formatLabel(po.status) : EMPTY}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenAccordionId(isOpen ? null : po.id);
                            }}
                            aria-expanded={isOpen}
                            aria-controls={`po-${po.id}`}
                            aria-label={`${
                              isOpen ? "Hide" : "Show"
                            } details for purchase order ${po.order_no || ""}`}
                            className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
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
                            className="px-4 pb-4 border-t border-slate-200 bg-slate-50"
                          >
                            <div id={`po-${po.id}`} className="mt-4 space-y-4">
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
                                  {po.total_amount && (
                                    <Meta icon={FileText} label="Total">
                                      <span className="font-mono font-semibold text-slate-800">
                                        {formatMoney(po.total_amount)}
                                      </span>
                                    </Meta>
                                  )}
                                  {po.delivery_charge && (
                                    <Meta
                                      icon={FileText}
                                      label="Delivery charge"
                                    >
                                      <span className="font-mono font-semibold text-slate-800">
                                        {formatMoney(po.delivery_charge)}
                                      </span>
                                    </Meta>
                                  )}
                                  {po.invoice_date && (
                                    <Meta icon={Calendar} label="Invoice date">
                                      {formatRecordDate(po.invoice_date)}
                                    </Meta>
                                  )}
                                  {po.mto?.project && (
                                    <span
                                      className={`${BADGE} ${BADGE_TONES.neutral}`}
                                    >
                                      Project {po.mto.project.project_id} -{" "}
                                      {po.mto.project.name}
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
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePOCancel(po);
                                      }}
                                      disabled={cancellingPOId === po.id}
                                      className={BTN_SECONDARY}
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePODelete(po.id);
                                    }}
                                    disabled={deletingPOId === po.id}
                                    className={BTN_DANGER}
                                  >
                                    {deletingPOId === po.id ? (
                                      <>
                                        <Spinner />
                                        Deleting...
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

                              {po.notes && (
                                <div className="flex items-start gap-2 text-xs text-slate-600">
                                  <NotebookText
                                    className="w-4 h-4 shrink-0 text-slate-500"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    <span className="font-medium text-slate-700">
                                      Notes
                                    </span>{" "}
                                    {po.notes}
                                  </span>
                                </div>
                              )}

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
                                        title={invoice.filename || "Invoice"}
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
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedInvoiceFile({
                                          name: invoice.filename || "Invoice",
                                          url: invoiceHref(invoice),
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
                                      aria-label={`View invoice for purchase order ${po.order_no || ""}`}
                                      className={BTN_SECONDARY}
                                    >
                                      View
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleInvoiceDelete(po.id);
                                      }}
                                      disabled={deletingInvoicePOId === po.id}
                                      aria-label={`Delete invoice for purchase order ${po.order_no || ""}`}
                                      className={BTN_DANGER}
                                    >
                                      {deletingInvoicePOId === po.id ? (
                                        <>
                                          <Spinner />
                                          Deleting...
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
                                      onClick={(e) => e.stopPropagation()}
                                      aria-label={`Download invoice for purchase order ${po.order_no || ""}`}
                                      className={BTN_SECONDARY}
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
                                        Upload an invoice file for this purchase
                                        order
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      ref={(el) => {
                                        invoiceFileInputRefs.current[po.id] =
                                          el;
                                      }}
                                      type="file"
                                      accept=".pdf,.doc,.docx,image/*"
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        handleInvoiceFileChange(po.id, e);
                                      }}
                                      className="sr-only peer"
                                      id={`invoice-upload-${po.id}`}
                                      disabled={uploadingInvoicePOId === po.id}
                                    />
                                    <label
                                      htmlFor={`invoice-upload-${po.id}`}
                                      className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${
                                        uploadingInvoicePOId === po.id
                                          ? "opacity-50 cursor-not-allowed"
                                          : "cursor-pointer"
                                      }`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {uploadingInvoicePOId === po.id ? (
                                        <>
                                          <Spinner />
                                          Uploading...
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
                                <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
                                  <table className="w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                      <tr>
                                        <th scope="col" className={TH}>
                                          Image
                                        </th>
                                        <th scope="col" className={TH}>
                                          Category
                                        </th>
                                        <th scope="col" className={TH}>
                                          Details
                                        </th>
                                        <th
                                          scope="col"
                                          className={`${TH} text-right`}
                                        >
                                          Quantity
                                        </th>
                                        <th
                                          scope="col"
                                          className={`${TH} text-right`}
                                        >
                                          Received
                                        </th>
                                        <th
                                          scope="col"
                                          className={`${TH} text-right`}
                                        >
                                          Unit price (excl. GST)
                                        </th>
                                        <th
                                          scope="col"
                                          className={`${TH} text-right`}
                                        >
                                          Total
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-200">
                                      {po.items.map((item) => {
                                        const unit =
                                          item.item?.measurement_unit;
                                        return (
                                          <tr
                                            key={item.id}
                                            className="hover:bg-slate-50 transition-colors duration-200"
                                          >
                                            <td className="px-4 py-3 whitespace-nowrap">
                                              {item.item?.image?.url ? (
                                                <Image
                                                  loading="lazy"
                                                  src={`/${item.item.image.url}`}
                                                  alt={
                                                    item.item.item_id ||
                                                    item.item?.category ||
                                                    "Item image"
                                                  }
                                                  className="w-10 h-10 object-cover rounded-lg border border-slate-200"
                                                  onError={(e) => {
                                                    e.target.style.display =
                                                      "none";
                                                    if (e.target.nextSibling) {
                                                      e.target.nextSibling.style.display =
                                                        "flex";
                                                    }
                                                  }}
                                                  width={40}
                                                  height={40}
                                                />
                                              ) : (
                                                <div className="w-10 h-10 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
                                                  <Package
                                                    className="w-5 h-5 text-slate-400"
                                                    aria-hidden="true"
                                                  />
                                                </div>
                                              )}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                              {item.item?.category ? (
                                                <span
                                                  className={`${BADGE} ${BADGE_TONES.neutral}`}
                                                >
                                                  {formatLabel(
                                                    item.item.category,
                                                  )}
                                                </span>
                                              ) : (
                                                <span className="text-sm text-slate-500">
                                                  {EMPTY}
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-4 py-3">
                                              <ItemDetails
                                                lineItem={item.item}
                                                notes={item.notes}
                                              />
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-mono text-slate-700">
                                              {formatQty(item.quantity, unit)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-mono text-slate-700">
                                              {formatQty(
                                                item.quantity_received || 0,
                                                unit,
                                              )}
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
                                          {formatMoney(subtotal)}
                                        </td>
                                      </tr>
                                      <tr>
                                        <th
                                          scope="row"
                                          colSpan={6}
                                          className="px-4 py-2 text-right text-sm font-medium text-slate-700"
                                        >
                                          GST amount (10%)
                                        </th>
                                        <td className="px-4 py-2 text-right text-sm font-mono font-semibold text-slate-800">
                                          {formatMoney(gst)}
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
                                          {formatMoney(subtotal + gst)}
                                        </td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
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

        {!showLoading && !showError && filteredPOs.length > 0 && (
          <PaginationFooter
            totalItems={filteredPOs.length}
            itemsPerPage={rowsPerPage}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setRowsPerPage}
            showItemsPerPage={true}
          />
        )}
      </div>

      {showCreatePurchaseOrderModal && (
        <CreatePurchaseOrderModal
          setShowModal={setShowCreatePurchaseOrderModal}
          onSuccess={fetchPurchaseOrders}
        />
      )}

      {showInvoicePreview && selectedInvoiceFile && (
        <ViewMedia
          selectedFile={selectedInvoiceFile}
          setSelectedFile={setSelectedInvoiceFile}
          setViewFileModal={setShowInvoicePreview}
          setPageNumber={setPageNumber}
        />
      )}

      {/* Delete Invoice Confirmation Modal */}
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

      {/* Cancel Purchase Order Confirmation Modal */}
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

      {/* Delete Purchase Order Confirmation Modal */}
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
    </div>
  );
}
