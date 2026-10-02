"use client";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState, useMemo, useRef } from "react";
import TabsController from "@/components/tabscontroller";
import {
  ChevronLeft,
  Edit,
  Mail,
  Phone,
  Link2,
  NotebookText,
  MapPin,
  Trash2,
  AlertTriangle,
  Building,
  Package,
  FileText,
  PackagePlus,
  Search,
  Receipt,
  BarChart3,
  Boxes,
  Check,
  MoreVertical,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import ContactSection from "@/components/ContactSection";
import MaterialsToOrder from "../components/MaterialsToOrder";
import PurchaseOrder from "../components/PurchaseOrder";
import Statement from "../components/Statement";
import Image from "next/image";
import AdminShell from "@/components/AdminShell";
import { validatePhone, formatPhoneToNational } from "@/components/validators";
import {
  BADGE,
  BADGE_TONES,
  COUNT_BADGE,
} from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";

const EMPTY = "—";

// Form-field rules (DESIGN.md 9.2): 14px, slate-300 border, primary focus ring.
// Error state swaps the border and ring to red and is paired with a message.
const FIELD =
  "w-full text-sm text-slate-800 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-colors duration-200";
const fieldTone = (hasError) =>
  hasError
    ? "border-red-500 focus:ring-red-500"
    : "border-slate-300 focus:ring-primary";

const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const MENU_ITEM =
  "cursor-pointer w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 transition-colors flex items-center gap-2";
const TH =
  "px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider";

const MAIN_TABS = [
  { value: "materials-to-order", label: "Materials to order", icon: Package },
  { value: "purchase-order", label: "Purchase orders", icon: PackagePlus },
  { value: "statements", label: "Statements", icon: Receipt },
  { value: "cost-sheet", label: "Cost sheet", icon: FileText },
  { value: "items", label: "Items", icon: Boxes },
];

const ITEM_CATEGORIES = [
  "SHEET",
  "HANDLE",
  "HARDWARE",
  "ACCESSORY",
  "EDGING_TAPE",
];

// Currency is AUD and prices carry cents, so this stays local rather than
// using the whole-dollar shared formatCurrency (DESIGN.md 15.7).
const PRICE = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
});

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-red-600 mt-1">
      {message}
    </p>
  );
}

function Spinner() {
  return (
    <span
      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
      aria-hidden="true"
    />
  );
}

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

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return `${parts[0][0] || ""}${
    parts[parts.length - 1][0] || ""
  }`.toUpperCase();
};

// The label/value rows shown in the Details column, by item category.
const getItemDetails = (item) => {
  const details = [];
  if (item.sheet) {
    details.push(
      ["Brand", item.sheet.brand],
      ["Colour", item.sheet.color],
      ["Finish", item.sheet.finish],
    );
    if (item.sheet.face) details.push(["Face", item.sheet.face]);
    details.push(["Dimensions", item.sheet.dimensions]);
  }
  if (item.handle) {
    details.push(
      ["Brand", item.handle.brand],
      ["Colour", item.handle.color],
      ["Type", item.handle.type],
      ["Dimensions", item.handle.dimensions],
    );
    if (item.handle.material) details.push(["Material", item.handle.material]);
  }
  if (item.hardware) {
    details.push(["Name", item.hardware.name], ["Type", item.hardware.type]);
    if (item.hardware.dimensions)
      details.push(["Dimensions", item.hardware.dimensions]);
    if (item.hardware.sub_category)
      details.push(["Sub category", item.hardware.sub_category]);
  }
  if (item.accessory) {
    details.push(["Name", item.accessory.name]);
  }
  if (item.edging_tape) {
    details.push(
      ["Brand", item.edging_tape.brand],
      ["Colour", item.edging_tape.color],
      ["Finish", item.edging_tape.finish],
      ["Dimensions", item.edging_tape.dimensions],
    );
  }
  return details;
};

export default function SupplierDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const [supplier, setSupplier] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editData, setEditData] = useState({});
  const [showDeleteSupplierModal, setShowDeleteSupplierModal] = useState(false);
  const [isDeletingSupplier, setIsDeletingSupplier] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activeTab, setActiveTab] = useState("materials-to-order");
  const [mtoCount, setMtoCount] = useState(0);
  const [poCount, setPoCount] = useState(0);
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState(null);
  const [failedImages, setFailedImages] = useState(() => new Set());
  const [itemsCategoryTab, setItemsCategoryTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchSupplier();
  }, [id]);

  useEffect(() => {
    if (activeTab === "items") {
      fetchItems();
    }
  }, [activeTab, id]);

  // Close dropdown when clicking outside
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

  const fetchSupplier = async () => {
    try {
      setLoading(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
        return;
      }

      const response = await axios.get(`/api/v1/supplier/${id}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        setSupplier(response.data.data);
        setContacts(response.data.data.contacts || []);
      } else {
        setError(
          response.data.message ||
            "Couldn't load this supplier. Check your connection and try again.",
        );
      }
    } catch (err) {
      console.error("API Error:", err);
      console.error("Error Response:", err.response?.data);
      setError(
        err.response?.data?.message ||
          "Couldn't load this supplier. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      setLoadingItems(true);
      setItemsError(null);
      const sessionToken = getToken();

      if (!sessionToken) {
        return;
      }

      const response = await axios.get(`/api/v1/item/by-supplier/${id}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        setItems(response.data.data || []);
      }
    } catch (err) {
      console.error("Error fetching items:", err);
      const message =
        err.response?.data?.message ||
        "Couldn't load items. Check your connection and try again.";
      setItemsError(message);
      toast.error(message);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleEdit = () => {
    if (supplier) {
      setEditData({
        name: supplier.name || "",
        address: supplier.address || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        website: supplier.website || "",
        notes: supplier.notes || "",
        abn_number: supplier.abn_number || "",
      });
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (isUpdating) return;
    try {
      setIsUpdating(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
        return;
      }

      const formatPhone = (phone) => {
        return phone ? formatPhoneToNational(phone) : phone;
      };

      const dataToSend = {
        ...editData,
        phone: formatPhone(editData.phone),
      };

      const response = await axios.patch(`/api/v1/supplier/${id}`, dataToSend, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.data.status) {
        setSupplier(response.data.data);
        toast.success("Supplier updated.");
        setIsEditing(false);
      } else {
        toast.error(
          response.data.message ||
            "Couldn't save the supplier. Check the details and try again.",
        );
      }
    } catch (error) {
      console.error("Error updating supplier:", error);
      toast.error(
        error.response?.data?.message ||
          "Couldn't save the supplier. Check your connection and try again.",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
  };

  const handleInputChange = (field, value) => {
    setEditData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDeleteSupplierConfirm = async () => {
    try {
      setIsDeletingSupplier(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
        return;
      }
      const response = await axios.delete(
        `/api/v1/supplier/${supplier.supplier_id}`,
        {
          headers: { Authorization: `Bearer ${sessionToken}` },
        },
      );
      if (!response?.data?.status) {
        toast.error(
          response?.data?.message || "Couldn't delete the supplier. Try again.",
        );
        return;
      }
      toast.success("Supplier deleted.");
      setShowDeleteSupplierModal(false);
      // Navigate back to suppliers list
      router.push("/admin/suppliers");
    } catch (err) {
      console.error("Delete supplier failed", err);
      toast.error(
        err?.response?.data?.message ||
          "Couldn't delete the supplier. Check your connection and try again.",
      );
    } finally {
      setIsDeletingSupplier(false);
    }
  };

  // Memoize available categories to avoid recalculating on every render
  const availableCategories = useMemo(() => {
    const categories = new Set();
    items.forEach((item) => {
      if (item.category) {
        categories.add(item.category);
      }
    });
    return {
      SHEET: categories.has("SHEET"),
      HANDLE: categories.has("HANDLE"),
      HARDWARE: categories.has("HARDWARE"),
      ACCESSORY: categories.has("ACCESSORY"),
      EDGING_TAPE: categories.has("EDGING_TAPE"),
    };
  }, [items]);

  // Memoize filtered items to avoid recalculating on every render
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Category filter
      if (itemsCategoryTab !== "all" && item.category !== itemsCategoryTab) {
        return false;
      }
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          item.category?.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.handle?.color?.toLowerCase().includes(query) ||
          item.handle?.type?.toLowerCase().includes(query) ||
          item.sheet?.color?.toLowerCase().includes(query) ||
          item.hardware?.name?.toLowerCase().includes(query) ||
          item.accessory?.name?.toLowerCase().includes(query) ||
          item.edging_tape?.brand?.toLowerCase().includes(query) ||
          item.edging_tape?.color?.toLowerCase().includes(query) ||
          item.edging_tape?.finish?.toLowerCase().includes(query) ||
          item.edging_tape?.dimensions?.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [items, itemsCategoryTab, searchQuery]);

  const phoneError =
    editData.phone && !validatePhone(editData.phone)
      ? "Enter a valid Australian phone number."
      : null;

  const mainTabCount = {
    "materials-to-order": mtoCount,
    "purchase-order": poCount,
  };

  const tabClass = (isActive, padding) =>
    `cursor-pointer ${padding} px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
      isActive
        ? "border-primary text-primary"
        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
    }`;

  const clearItemFilters = () => {
    setSearchQuery("");
    setItemsCategoryTab("all");
  };

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
              <p className="text-sm text-slate-600">
                Loading supplier details...
              </p>
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
        ) : !supplier ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Building
                className="w-8 h-8 text-slate-300 mx-auto mb-4"
                aria-hidden="true"
              />
              <p className="text-sm text-slate-600">
                This supplier could not be found. They may have been deleted.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3">
            {/* Header: back, record name, record actions */}
            <div className="flex items-center gap-3 mb-4">
              <TabsController back={true}>
                <span className="cursor-pointer flex p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200">
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                  <span className="sr-only">Back</span>
                </span>
              </TabsController>
              <div className="flex-1 flex flex-wrap items-center gap-3 min-w-0">
                <h1 className="text-xl font-semibold text-slate-800 truncate">
                  {supplier.name}
                </h1>
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
                            Edit supplier details
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setShowDeleteSupplierModal(true);
                              setShowDropdown(false);
                            }}
                            className={`${MENU_ITEM} text-red-700 hover:bg-red-50`}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                            Delete supplier
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
                      form="supplier-edit-form"
                      disabled={isUpdating}
                      className={BTN_PRIMARY}
                    >
                      {isUpdating ? (
                        <Spinner />
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
            <div className="space-y-4">
              {/* Basic Information and Contacts Section */}
              <div className="grid grid-cols-10 gap-4">
                {/* Basic Information - 70% width */}
                <div className="col-span-7">
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-16 h-16 shrink-0 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-slate-700 text-lg font-semibold"
                        aria-hidden="true"
                      >
                        {getInitials(supplier.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <form
                            id="supplier-edit-form"
                            noValidate
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleSave();
                            }}
                            className="space-y-4"
                          >
                            <p className="text-xs text-slate-500">
                              Supplier ID:{" "}
                              <span className="font-mono">
                                {supplier.supplier_id}
                              </span>
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label
                                  htmlFor="supplier-name"
                                  className="block text-sm font-medium text-slate-700 mb-1.5"
                                >
                                  Supplier name
                                </label>
                                <input
                                  id="supplier-name"
                                  type="text"
                                  value={editData.name || ""}
                                  onChange={(e) =>
                                    handleInputChange("name", e.target.value)
                                  }
                                  placeholder="e.g. Hafele Australia"
                                  className={`${FIELD} ${fieldTone(false)}`}
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="supplier-abn"
                                  className="block text-sm font-medium text-slate-700 mb-1.5"
                                >
                                  ABN
                                </label>
                                <input
                                  id="supplier-abn"
                                  type="text"
                                  value={editData.abn_number || ""}
                                  onChange={(e) =>
                                    handleInputChange(
                                      "abn_number",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="e.g. 12 345 678 901"
                                  className={`${FIELD} font-mono ${fieldTone(false)}`}
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="supplier-email"
                                  className="block text-sm font-medium text-slate-700 mb-1.5"
                                >
                                  Email
                                </label>
                                <input
                                  id="supplier-email"
                                  type="email"
                                  value={editData.email || ""}
                                  onChange={(e) =>
                                    handleInputChange("email", e.target.value)
                                  }
                                  placeholder="e.g. orders@example.com"
                                  className={`${FIELD} ${fieldTone(false)}`}
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="supplier-phone"
                                  className="block text-sm font-medium text-slate-700 mb-1.5"
                                >
                                  Phone
                                </label>
                                <input
                                  id="supplier-phone"
                                  type="tel"
                                  value={editData.phone || ""}
                                  onChange={(e) =>
                                    handleInputChange("phone", e.target.value)
                                  }
                                  placeholder="e.g. 0400 123 456 or +61 400 123 456"
                                  aria-invalid={!!phoneError}
                                  aria-describedby={
                                    phoneError
                                      ? "supplier-phone-error"
                                      : undefined
                                  }
                                  className={`${FIELD} ${fieldTone(phoneError)}`}
                                />
                                <FieldError
                                  id="supplier-phone-error"
                                  message={phoneError}
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label
                                  htmlFor="supplier-website"
                                  className="block text-sm font-medium text-slate-700 mb-1.5"
                                >
                                  Website
                                </label>
                                <input
                                  id="supplier-website"
                                  type="url"
                                  value={editData.website || ""}
                                  onChange={(e) =>
                                    handleInputChange("website", e.target.value)
                                  }
                                  placeholder="e.g. https://example.com"
                                  className={`${FIELD} ${fieldTone(false)}`}
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label
                                  htmlFor="supplier-address"
                                  className="block text-sm font-medium text-slate-700 mb-1.5"
                                >
                                  Address
                                </label>
                                <input
                                  id="supplier-address"
                                  type="text"
                                  value={editData.address || ""}
                                  onChange={(e) =>
                                    handleInputChange("address", e.target.value)
                                  }
                                  placeholder="e.g. 5 Dundee Ave, Holden Hill SA 5088"
                                  className={`${FIELD} ${fieldTone(false)}`}
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label
                                  htmlFor="supplier-notes"
                                  className="block text-sm font-medium text-slate-700 mb-1.5"
                                >
                                  Notes
                                </label>
                                <textarea
                                  id="supplier-notes"
                                  value={editData.notes || ""}
                                  onChange={(e) =>
                                    handleInputChange("notes", e.target.value)
                                  }
                                  rows={3}
                                  className={`${FIELD} ${fieldTone(false)}`}
                                />
                              </div>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h2 className="text-lg font-semibold text-slate-800">
                                {supplier.name}
                              </h2>
                            </div>
                            <p className="text-xs text-slate-500 mb-3">
                              ID:{" "}
                              <span className="font-mono">
                                {supplier.supplier_id}
                              </span>
                            </p>
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-3 text-sm">
                                {supplier.email ? (
                                  <a
                                    href={`mailto:${supplier.email}`}
                                    className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors duration-200"
                                  >
                                    <Mail
                                      className="w-4 h-4"
                                      aria-hidden="true"
                                    />
                                    {supplier.email}
                                  </a>
                                ) : (
                                  <div className="flex items-center gap-2 text-slate-600">
                                    <Mail
                                      className="w-4 h-4"
                                      aria-hidden="true"
                                    />
                                    {EMPTY}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-slate-600">
                                  <Phone
                                    className="w-4 h-4"
                                    aria-hidden="true"
                                  />
                                  {formatValue(supplier.phone)}
                                </div>
                                <div className="flex items-center gap-2 text-slate-600">
                                  <Link2
                                    className="w-4 h-4"
                                    aria-hidden="true"
                                  />
                                  {supplier.website ? (
                                    <a
                                      className="text-primary hover:underline"
                                      href={supplier.website}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {supplier.website}
                                    </a>
                                  ) : (
                                    <span>{EMPTY}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-slate-600">
                                  <span>ABN:</span>
                                  <span className="font-mono">
                                    {formatValue(supplier.abn_number)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-slate-600 text-sm">
                                <MapPin
                                  className="w-4 h-4"
                                  aria-hidden="true"
                                />
                                {formatValue(supplier.address)}
                              </div>
                              <div className="flex items-start gap-2 text-slate-600">
                                <NotebookText
                                  className="w-4 h-4 mt-3 shrink-0"
                                  aria-hidden="true"
                                />
                                <div className="flex-1 text-sm text-slate-700 bg-slate-50 border border-slate-200 p-3 rounded-lg">
                                  {formatValue(supplier.notes)}
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contacts - 30% width */}
                <ContactSection
                  contacts={contacts}
                  onContactsUpdate={setContacts}
                  parentId={supplier?.supplier_id || ""}
                  parentType="supplier"
                  parentName={supplier?.name || ""}
                />
              </div>

              {/* Main Tab Section */}
              <div className="bg-white rounded-lg border border-slate-200">
                {/* Main Tab Navigation */}
                <div className="border-b border-slate-200">
                  <nav
                    className="flex space-x-8 px-4"
                    role="tablist"
                    aria-label="Supplier sections"
                  >
                    {MAIN_TABS.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        id={`supplier-tab-${value}`}
                        aria-selected={activeTab === value}
                        aria-controls="supplier-panel"
                        onClick={() => setActiveTab(value)}
                        className={tabClass(activeTab === value, "py-4")}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" aria-hidden="true" />
                          {label}
                          {mainTabCount[value] > 0 && (
                            <span className={COUNT_BADGE}>
                              {mainTabCount[value]}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Tab Content */}
                <div
                  id="supplier-panel"
                  role="tabpanel"
                  aria-labelledby={`supplier-tab-${activeTab}`}
                  className="p-4"
                >
                  {/* Materials to Order Tab */}
                  {activeTab === "materials-to-order" && (
                    <MaterialsToOrder
                      supplier={supplier}
                      supplierId={id}
                      onCountChange={setMtoCount}
                    />
                  )}

                  {/* Purchase Order Tab */}
                  {activeTab === "purchase-order" && (
                    <PurchaseOrder supplierId={id} onCountChange={setPoCount} />
                  )}

                  {/* Statements Tab */}
                  {activeTab === "statements" && <Statement supplierId={id} />}

                  {/* Cost Sheet Tab */}
                  {activeTab === "cost-sheet" && (
                    <div className="flex flex-col items-center text-center py-12">
                      <BarChart3
                        className="w-8 h-8 text-slate-300 mb-2"
                        aria-hidden="true"
                      />
                      <p className="text-sm text-slate-600">
                        No cost sheet found for this supplier.
                      </p>
                    </div>
                  )}

                  {/* Items Tab */}
                  {activeTab === "items" && (
                    <div>
                      {/* Search */}
                      <div className="mb-4">
                        <div className="flex items-center gap-2 w-full max-w-sm relative">
                          <Search
                            className="w-4 h-4 absolute left-3 text-slate-500"
                            aria-hidden="true"
                          />
                          <input
                            type="text"
                            placeholder="Search items..."
                            aria-label="Search items"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full text-sm text-slate-800 pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                        </div>
                      </div>

                      {/* Category Sub-tabs */}
                      <div className="border-b border-slate-200 mb-4">
                        <nav
                          className="flex space-x-6"
                          role="tablist"
                          aria-label="Item category"
                        >
                          {/* Always show "All" tab */}
                          <button
                            type="button"
                            role="tab"
                            aria-selected={itemsCategoryTab === "all"}
                            aria-controls="supplier-items-panel"
                            onClick={() => setItemsCategoryTab("all")}
                            className={tabClass(
                              itemsCategoryTab === "all",
                              "py-2",
                            )}
                          >
                            All
                          </button>
                          {/* Show category tabs only if items exist in that category */}
                          {ITEM_CATEGORIES.filter(
                            (category) => availableCategories[category],
                          ).map((category) => (
                            <button
                              key={category}
                              type="button"
                              role="tab"
                              aria-selected={itemsCategoryTab === category}
                              aria-controls="supplier-items-panel"
                              onClick={() => setItemsCategoryTab(category)}
                              className={tabClass(
                                itemsCategoryTab === category,
                                "py-2",
                              )}
                            >
                              {formatLabel(category)}
                            </button>
                          ))}
                        </nav>
                      </div>

                      <div id="supplier-items-panel" role="tabpanel">
                        {/* Items Table */}
                        {loadingItems ? (
                          <div
                            className="flex flex-col items-center py-12"
                            role="status"
                          >
                            <div
                              className="animate-spin rounded-full w-8 h-8 border-2 border-primary border-t-transparent mb-4"
                              aria-hidden="true"
                            />
                            <p className="text-sm text-slate-600">
                              Loading items...
                            </p>
                          </div>
                        ) : itemsError ? (
                          <div className="flex flex-col items-center text-center py-12">
                            <AlertTriangle
                              className="w-8 h-8 text-red-500 mb-2"
                              aria-hidden="true"
                            />
                            <p
                              className="text-sm text-red-600 mb-4"
                              role="alert"
                            >
                              {itemsError}
                            </p>
                            <button
                              type="button"
                              onClick={fetchItems}
                              className={BTN_PRIMARY}
                            >
                              Try again
                            </button>
                          </div>
                        ) : items.length === 0 ? (
                          <div className="flex flex-col items-center text-center py-12">
                            <Boxes
                              className="w-8 h-8 text-slate-300 mb-2"
                              aria-hidden="true"
                            />
                            <p className="text-sm text-slate-600">
                              No items found for this supplier.
                            </p>
                          </div>
                        ) : filteredItems.length === 0 ? (
                          <div className="flex flex-col items-center text-center py-12">
                            <Search
                              className="w-8 h-8 text-slate-300 mb-2"
                              aria-hidden="true"
                            />
                            <p className="text-sm text-slate-600">
                              No items match your search.
                            </p>
                            <button
                              type="button"
                              onClick={clearItemFilters}
                              className={`${BTN_SECONDARY} mt-4`}
                            >
                              <RotateCcw
                                className="w-4 h-4"
                                aria-hidden="true"
                              />
                              Clear filters
                            </button>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
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
                                    Description
                                  </th>
                                  <th scope="col" className={`${TH} text-left`}>
                                    Details
                                  </th>
                                  <th
                                    scope="col"
                                    className={`${TH} text-right`}
                                  >
                                    Price (incl. GST)
                                  </th>
                                  <th
                                    scope="col"
                                    className={`${TH} text-right`}
                                  >
                                    Quantity
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {filteredItems.map((item) => (
                                  <tr
                                    key={item.item_id}
                                    className="hover:bg-slate-50 transition-colors"
                                  >
                                    {/* Image Column */}
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <div className="flex items-center">
                                        {item.image?.url &&
                                        !failedImages.has(item.item_id) ? (
                                          <Image
                                            loading="lazy"
                                            src={`/${item.image.url}`}
                                            alt={
                                              item.description || item.item_id
                                            }
                                            className="w-12 h-12 object-cover rounded-lg border border-slate-200"
                                            onError={() =>
                                              setFailedImages((prev) =>
                                                new Set(prev).add(item.item_id),
                                              )
                                            }
                                            width={48}
                                            height={48}
                                          />
                                        ) : (
                                          <div className="w-12 h-12 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
                                            <Package
                                              className="w-5 h-5 text-slate-400"
                                              aria-hidden="true"
                                            />
                                            <span className="sr-only">
                                              No image
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </td>

                                    {/* Category Column: a category carries no
                                        meaning, so the badge is neutral */}
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span
                                        className={`${BADGE} ${BADGE_TONES.neutral} whitespace-nowrap`}
                                      >
                                        {item.category
                                          ? formatLabel(item.category)
                                          : EMPTY}
                                      </span>
                                    </td>

                                    {/* Description Column */}
                                    <td className="px-4 py-3 text-sm text-slate-700">
                                      {formatValue(item.description)}
                                    </td>

                                    {/* Details Column */}
                                    <td className="px-4 py-3">
                                      <dl className="text-xs text-slate-600 space-y-1">
                                        {getItemDetails(item).map(
                                          ([label, value], index) => (
                                            <div key={`${label}-${index}`}>
                                              <dt className="inline font-medium">
                                                {label}:
                                              </dt>{" "}
                                              <dd className="inline">
                                                {formatValue(value)}
                                              </dd>
                                            </div>
                                          ),
                                        )}
                                      </dl>
                                    </td>

                                    {/* Price Column */}
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 text-right font-mono">
                                      {PRICE.format(
                                        parseFloat(item.price || 0),
                                      )}
                                    </td>

                                    {/* Quantity Column */}
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 text-right font-mono">
                                      {item.quantity ?? 0}{" "}
                                      {item.measurement_unit}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Delete Supplier Confirmation Modal */}
      <DeleteConfirmation
        isOpen={showDeleteSupplierModal}
        onClose={() => setShowDeleteSupplierModal(false)}
        onConfirm={handleDeleteSupplierConfirm}
        deleteWithInput={true}
        heading="Supplier"
        title={supplier ? `Delete ${supplier.name}?` : "Delete supplier?"}
        warningHeading="This removes the supplier record"
        message={
          supplier
            ? `${supplier.name} (${supplier.supplier_id}) and all of its contacts will be deleted.`
            : "The supplier and all of its contacts will be deleted."
        }
        confirmButtonText="Delete supplier"
        comparingName={supplier?.name || ""}
        isDeleting={isDeletingSupplier}
        entityType="supplier"
      />
    </AdminShell>
  );
}
