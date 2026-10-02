"use client";
import React from "react";
import AdminShell from "@/components/AdminShell";
import PaginationFooter from "@/components/PaginationFooter";
import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { setActiveTab } from "@/state/reducer/inventoryTabs";
import { useExcelExport } from "@/hooks/useExcelExport";
import {
  Plus,
  Search,
  RotateCcw,
  Funnel,
  ArrowUpDown,
  Sheet,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ImageIcon,
  Package,
  X,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import StockTally from "@/components/StockTally.jsx";
import MultiSelectDropdown from "./components/MultiSelectDropdown";
import SearchBar from "@/components/SearchBar";
import useModalFocus from "@/hooks/useModalFocus";
import {
  usePersistedTableFilter,
  useTableFilterActions,
} from "@/hooks/usePersistedTableFilter";
import {
  BUTTON_COUNT_BADGE,
  formatQty,
} from "@/app/admin/dashboard/lib/format";

const TABLE_KEY = "inventory";
const EMPTY = "—";
const SESSION_ERROR = "Your session has expired. Sign in again to continue.";
const LOAD_ERROR =
  "Couldn't load inventory. Check your connection and try again.";

const TABS = [
  { id: "sheet", label: "Sheet" },
  { id: "sunmica", label: "Sunmica" },
  { id: "edging_tape", label: "Edging tape" },
  { id: "handle", label: "Handle" },
  { id: "hardware", label: "Hardware" },
  { id: "accessory", label: "Accessory" },
];

// Button, field, menu and table recipes from DESIGN.md 9.1 / 9.2 / 9.5 / 9.8.
const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY_COMPACT =
  "cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_GHOST =
  "cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const ICON_BTN =
  "cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const FIELD_COMPACT =
  "w-full text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors duration-200";
const MENU_ITEM =
  "cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between";
const MENU_CHECK_ROW =
  "cursor-pointer flex items-center justify-between px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors";
const CHECKBOX =
  "h-4 w-4 accent-primary border-slate-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const TH =
  "px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider";

// The columns shown for each tab, in display order, and how each is labelled.
const COLUMN_DEFS = {
  brand: { label: "Brand", strong: true },
  color: { label: "Colour" },
  finish: { label: "Finish" },
  type: { label: "Type" },
  material: { label: "Material" },
  name: { label: "Name", strong: true },
  sub_category: { label: "Sub-category" },
  dimensions: { label: "Dimensions", sortable: false },
};
const TAB_COLUMNS = {
  sheet: ["brand", "color", "finish", "dimensions"],
  sunmica: ["brand", "color", "finish", "dimensions"],
  edging_tape: ["brand", "color", "finish", "dimensions"],
  handle: ["brand", "color", "type", "material", "dimensions"],
  hardware: ["brand", "name", "sub_category", "dimensions"],
  accessory: ["name"],
};

// The category-specific filters in the filter dialog: [label, filter key,
// plural noun for the placeholder].
const FILTER_FIELDS = {
  sheet: [
    ["Brand", "sheet_brand", "brands"],
    ["Colour", "sheet_color", "colours"],
    ["Finish", "sheet_finish", "finishes"],
    ["Face", "sheet_face", "faces"],
  ],
  handle: [
    ["Brand", "handle_brand", "brands"],
    ["Colour", "handle_color", "colours"],
    ["Type", "handle_type", "types"],
    ["Material", "handle_material", "materials"],
  ],
  hardware: [
    ["Brand", "hardware_brand", "brands"],
    ["Name", "hardware_name", "names"],
    ["Type", "hardware_type", "types"],
    ["Sub-category", "hardware_sub_category", "sub-categories"],
  ],
  accessory: [["Name", "accessory_name", "names"]],
  edging_tape: [
    ["Brand", "edging_tape_brand", "brands"],
    ["Colour", "edging_tape_color", "colours"],
    ["Finish", "edging_tape_finish", "finishes"],
    ["Dimensions", "edging_tape_dimensions", "dimensions"],
  ],
};

// On-screen names for the export columns. The keys stay the Excel headers.
const EXPORT_COLUMN_LABELS = {
  Color: "Colour",
  IsSunmica: "Is sunmica",
  CreatedAt: "Created at",
  UpdatedAt: "Updated at",
};

// The value of one sortable / displayable field for an item, whichever
// category it belongs to.
const getFieldValue = (item, field) => {
  if (field === "brand") {
    return (
      item.sheet?.brand ||
      item.handle?.brand ||
      item.hardware?.brand ||
      item.edging_tape?.brand ||
      ""
    );
  } else if (field === "color") {
    return (
      item.sheet?.color || item.handle?.color || item.edging_tape?.color || ""
    );
  } else if (field === "finish") {
    return item.sheet?.finish || item.edging_tape?.finish || "";
  } else if (field === "type") {
    return item.handle?.type || item.hardware?.type || "";
  } else if (field === "material") {
    return item.handle?.material || "";
  } else if (field === "name") {
    return item.hardware?.name || item.accessory?.name || "";
  } else if (field === "sub_category") {
    return item.hardware?.sub_category || "";
  } else if (field === "dimensions") {
    return (
      item.sheet?.dimensions ||
      item.handle?.dimensions ||
      item.hardware?.dimensions ||
      item.edging_tape?.dimensions ||
      ""
    );
  }
  return item[field] || "";
};

// Stock level as coloured text plus a label, so colour is never the only
// signal (DESIGN.md 13.4).
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

// Item thumbnail with a placeholder when there is no image or it fails to
// load. The row's name link carries the accessible name, so the image is
// decorative.
function ItemThumb({ image }) {
  const [failed, setFailed] = useState(false);

  if (!image?.url || failed) {
    return (
      <div className="w-10 h-10 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center">
        <ImageIcon className="w-5 h-5 text-slate-400" aria-hidden="true" />
      </div>
    );
  }

  return (
    <Image
      loading="lazy"
      src={`/${image.url}`}
      alt=""
      className="w-10 h-10 object-cover rounded-lg border border-slate-200"
      onError={() => setFailed(true)}
      width={40}
      height={40}
    />
  );
}

// Sortable column header. The label is a real button so the sort is reachable
// by keyboard (DESIGN.md 13.7); the active column carries the only indicator.
// The "relevance" step of the sort cycle has no direction, so it shows neither.
function SortHeader({
  field,
  label,
  sortField,
  sortOrder,
  onSort,
  alignRight = false,
}) {
  const isActive = sortField === field;
  const ariaSort =
    isActive && sortOrder === "asc"
      ? "ascending"
      : isActive && sortOrder === "desc"
        ? "descending"
        : undefined;
  const Icon =
    isActive && sortOrder === "asc"
      ? ArrowUp
      : isActive && sortOrder === "desc"
        ? ArrowDown
        : ArrowUpDown;

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
          className={`w-4 h-4 ${
            Icon === ArrowUpDown ? "text-slate-400" : "text-primary"
          }`}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

// A truncated text cell with the full value in a title (DESIGN.md 15.4).
function TextCell({ value, strong = false }) {
  const text = value || EMPTY;
  return (
    <span
      title={value || undefined}
      className={`block max-w-64 truncate ${strong ? "font-medium" : ""}`}
    >
      {text}
    </span>
  );
}
const DEFAULT_FILTERS = {
  quantity_min: "",
  quantity_max: "",
  sheet_brand: [],
  sheet_color: [],
  sheet_finish: [],
  sheet_face: [],
  handle_brand: [],
  handle_color: [],
  handle_type: [],
  handle_material: [],
  hardware_brand: [],
  hardware_name: [],
  hardware_type: [],
  hardware_sub_category: [],
  accessory_name: [],
  edging_tape_brand: [],
  edging_tape_color: [],
  edging_tape_finish: [],
  edging_tape_dimensions: [],
};

export default function InventoryPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { activeTab } = useSelector((state) => state.inventoryTabs);
  const { getToken } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = usePersistedTableFilter(TABLE_KEY, "search", "");
  const [sortField, setSortField] = usePersistedTableFilter(
    TABLE_KEY,
    "sortField",
    activeTab === "accessory" ? "name" : "brand",
  );
  const [sortOrder, setSortOrder] = usePersistedTableFilter(
    TABLE_KEY,
    "sortOrder",
    "asc",
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [selectedCategories, setSelectedCategories] = usePersistedTableFilter(
    TABLE_KEY,
    "selectedCategories",
    [activeTab],
  );
  const { resetFilters } = useTableFilterActions(TABLE_KEY);
  const previousActiveTab = useRef(activeTab);
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const filterModalRef = useRef(null);

  // Focus moves into the filter dialog, stays inside it, and returns to the
  // trigger on close (DESIGN.md 13.6).
  useModalFocus(filterModalRef, showFilterPopup);

  // Stock Tally states
  const [showStockTallyModal, setShowStockTallyModal] = useState(false);

  // Define available columns for export based on active tab
  const getAvailableColumns = () => {
    if (activeTab === "sheet" || activeTab === "sunmica") {
      return [
        "Brand",
        "Color",
        "Finish",
        "Dimensions",
        "Quantity",
        "Description",
        "Category",
        "Price (including GST)",
        "Face",
        "IsSunmica",
        "CreatedAt",
        "UpdatedAt",
      ];
    } else if (activeTab === "handle") {
      return [
        "Brand",
        "Color",
        "Type",
        "Material",
        "Dimensions",
        "Quantity",
        "Description",
        "Category",
        "Price (including GST)",
        "CreatedAt",
        "UpdatedAt",
      ];
    } else if (activeTab === "hardware") {
      return [
        "Quantity",
        "Description",
        "Category",
        "Price (including GST)",
        "Name",
        "Type",
        "Dimensions",
        "CreatedAt",
        "UpdatedAt",
      ];
    } else if (activeTab === "accessory") {
      return [
        "Quantity",
        "Description",
        "Category",
        "Price (including GST)",
        "Name",
        "CreatedAt",
        "UpdatedAt",
      ];
    } else if (activeTab === "edging_tape") {
      return [
        "Quantity",
        "Description",
        "Category",
        "Price (including GST)",
        "Brand",
        "Color",
        "Finish",
        "Dimensions",
        "CreatedAt",
        "UpdatedAt",
      ];
    }
    return [];
  };

  const availableColumns = getAvailableColumns();

  // Initialize selected columns with all columns
  const [selectedColumns, setSelectedColumns] = useState(() => [
    ...getAvailableColumns(),
  ]);

  // Update selected columns when active tab changes
  useEffect(() => {
    const newColumns = getAvailableColumns();
    setSelectedColumns([...newColumns]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Filter states - now supporting multiple selections
  const [filters, setFilters] = usePersistedTableFilter(
    TABLE_KEY,
    "filters",
    DEFAULT_FILTERS,
  );

  // Utility functions to extract distinct values for dropdowns
  const getDistinctValues = (field, data) => {
    const values = new Set();
    data.forEach((item) => {
      let value = null;
      if (field.startsWith("sheet_")) {
        const sheetField = field.replace("sheet_", "");
        value = item.sheet?.[sheetField];
      } else if (field.startsWith("handle_")) {
        const handleField = field.replace("handle_", "");
        value = item.handle?.[handleField];
      } else if (field.startsWith("hardware_")) {
        const hardwareField = field.replace("hardware_", "");
        value = item.hardware?.[hardwareField];
      } else if (field.startsWith("accessory_")) {
        const accessoryField = field.replace("accessory_", "");
        value = item.accessory?.[accessoryField];
      } else if (field.startsWith("edging_tape_")) {
        const edging_tapeField = field.replace("edging_tape_", "");
        value = item.edging_tape?.[edging_tapeField];
      }

      if (value && value.trim() !== "") {
        values.add(value.trim());
      }
    });
    return Array.from(values).sort();
  };

  const fetchData = async (category) => {
    if (!category) {
      toast.error("Category is required");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const sessionToken = getToken();
      if (!sessionToken) {
        setError(SESSION_ERROR);
        return;
      }
      // For sunmica, fetch sheet items and filter client-side
      const apiCategory = category === "sunmica" ? "sheet" : category;
      let config = {
        method: "get",
        maxBodyLength: Infinity,
        url: `/api/v1/item/all/${apiCategory}`,
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          ...{},
        },
      };
      const response = await axios.request(config);

      if (response.data.status) {
        let items = response.data.data;
        // Filter items based on category
        if (category === "sunmica") {
          // Sunmica tab: show ONLY sunmica items
          items = items.filter((item) => item.sheet?.is_sunmica === true);
        } else if (category === "sheet") {
          // Sheet tab: show ONLY non-sunmica items (exclude sunmica)
          items = items.filter(
            (item) =>
              !item.sheet?.is_sunmica || item.sheet?.is_sunmica === false,
          );
        }
        setData(items);
      } else {
        setError(response.data.message || LOAD_ERROR);
      }
    } catch (error) {
      console.error(error);
      setError(error.response?.data?.message || LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  };

  // Close the toolbar menus when clicking outside or pressing Escape. Escape
  // also closes the filter dialog (DESIGN.md 9.4).
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
        setShowFilterPopup(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    fetchData(activeTab);
    if (previousActiveTab.current !== activeTab) {
      setSelectedCategories([activeTab]);
      setSortField(activeTab === "accessory" ? "name" : "brand");
      previousActiveTab.current = activeTab;
    }
  }, [activeTab]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = data.filter((item) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          (item.description || "").toLowerCase().includes(searchLower) ||
          item.itemSuppliers?.some((s) =>
            (s.supplier_reference || "").toLowerCase().includes(searchLower),
          ) ||
          (item.sheet?.brand || "").toLowerCase().includes(searchLower) ||
          (item.sheet?.color || "").toLowerCase().includes(searchLower) ||
          (item.sheet?.description || "").toLowerCase().includes(searchLower) ||
          (item.handle?.brand || "").toLowerCase().includes(searchLower) ||
          (item.handle?.color || "").toLowerCase().includes(searchLower) ||
          (item.edging_tape?.brand || "").toLowerCase().includes(searchLower) ||
          (item.edging_tape?.color || "").toLowerCase().includes(searchLower) ||
          (item.edging_tape?.description || "")
            .toLowerCase()
            .includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Quantity range filter
      if (
        filters.quantity_min !== "" &&
        item.quantity < Number(filters.quantity_min)
      ) {
        return false;
      }
      if (
        filters.quantity_max !== "" &&
        item.quantity > Number(filters.quantity_max)
      ) {
        return false;
      }

      // Sheet specific filters
      if (activeTab === "sheet" || activeTab === "sunmica") {
        if (
          filters.sheet_brand.length > 0 &&
          !filters.sheet_brand.some((brand) =>
            item.sheet?.brand?.toLowerCase().includes(brand.toLowerCase()),
          )
        ) {
          return false;
        }
        if (
          filters.sheet_color.length > 0 &&
          !filters.sheet_color.some((color) =>
            item.sheet?.color?.toLowerCase().includes(color.toLowerCase()),
          )
        ) {
          return false;
        }
        if (
          filters.sheet_finish.length > 0 &&
          !filters.sheet_finish.some((finish) =>
            item.sheet?.finish?.toLowerCase().includes(finish.toLowerCase()),
          )
        ) {
          return false;
        }
        if (
          filters.sheet_face.length > 0 &&
          !filters.sheet_face.some((face) =>
            item.sheet?.face?.toLowerCase().includes(face.toLowerCase()),
          )
        ) {
          return false;
        }
      }

      // Handle specific filters
      if (activeTab === "handle") {
        if (
          filters.handle_brand.length > 0 &&
          !filters.handle_brand.some((brand) =>
            item.handle?.brand?.toLowerCase().includes(brand.toLowerCase()),
          )
        ) {
          return false;
        }
        if (
          filters.handle_color.length > 0 &&
          !filters.handle_color.some((color) =>
            item.handle?.color?.toLowerCase().includes(color.toLowerCase()),
          )
        ) {
          return false;
        }
        if (
          filters.handle_type.length > 0 &&
          !filters.handle_type.some((type) =>
            item.handle?.type?.toLowerCase().includes(type.toLowerCase()),
          )
        ) {
          return false;
        }
        if (
          filters.handle_material.length > 0 &&
          !filters.handle_material.some((material) =>
            item.handle?.material
              ?.toLowerCase()
              .includes(material.toLowerCase()),
          )
        ) {
          return false;
        }
      }

      // Hardware specific filters
      if (activeTab === "hardware") {
        if (
          filters.hardware_brand.length > 0 &&
          !filters.hardware_brand.some((brand) =>
            item.hardware?.brand?.toLowerCase().includes(brand.toLowerCase()),
          )
        ) {
          return false;
        }
        if (
          filters.hardware_name.length > 0 &&
          !filters.hardware_name.some((name) =>
            item.hardware?.name?.toLowerCase().includes(name.toLowerCase()),
          )
        ) {
          return false;
        }
        if (
          filters.hardware_type.length > 0 &&
          !filters.hardware_type.some((type) =>
            item.hardware?.type?.toLowerCase().includes(type.toLowerCase()),
          )
        ) {
          return false;
        }
        if (
          filters.hardware_sub_category.length > 0 &&
          !filters.hardware_sub_category.some((subCategory) =>
            item.hardware?.sub_category
              ?.toLowerCase()
              .includes(subCategory.toLowerCase()),
          )
        ) {
          return false;
        }
      }

      // Accessory specific filters
      if (activeTab === "accessory") {
        if (
          filters.accessory_name.length > 0 &&
          !filters.accessory_name.some((name) =>
            item.accessory?.name?.toLowerCase().includes(name.toLowerCase()),
          )
        ) {
          return false;
        }
      }
      // Edging Tape specific filters
      if (activeTab === "edging_tape") {
        if (
          filters.edging_tape_brand.length > 0 &&
          !filters.edging_tape_brand.some((brand) =>
            item.edging_tape?.brand
              ?.toLowerCase()
              .includes(brand.toLowerCase()),
          )
        ) {
          return false;
        }
        if (
          filters.edging_tape_color.length > 0 &&
          !filters.edging_tape_color.some((color) =>
            item.edging_tape?.color
              ?.toLowerCase()
              .includes(color.toLowerCase()),
          )
        ) {
          return false;
        }
        if (
          filters.edging_tape_finish.length > 0 &&
          !filters.edging_tape_finish.some((finish) =>
            item.edging_tape?.finish
              ?.toLowerCase()
              .includes(finish.toLowerCase()),
          )
        ) {
          return false;
        }
        if (
          filters.edging_tape_dimensions.length > 0 &&
          !filters.edging_tape_dimensions.some((dimensions) =>
            item.edging_tape?.dimensions
              ?.toLowerCase()
              .includes(dimensions.toLowerCase()),
          )
        ) {
          return false;
        }
      }

      return true;
    });

    // Sort data (getFieldValue is declared at module level)
    filtered.sort((a, b) => {
      // Multi-level sorting when default sort is active (brand asc for most categories, name asc for accessory)
      const isDefaultSort =
        (activeTab === "accessory" &&
          sortField === "name" &&
          sortOrder === "asc") ||
        (activeTab !== "accessory" &&
          sortField === "brand" &&
          sortOrder === "asc");

      if (isDefaultSort) {
        // Apply multi-level sorting based on category
        if (
          activeTab === "sheet" ||
          activeTab === "sunmica" ||
          activeTab === "edging_tape"
        ) {
          // Brand → Color → Finish → Dimensions
          const aBrand = getFieldValue(a, "brand").toString().toLowerCase();
          const bBrand = getFieldValue(b, "brand").toString().toLowerCase();
          if (aBrand !== bBrand) {
            return aBrand < bBrand ? -1 : aBrand > bBrand ? 1 : 0;
          }

          const aColor = getFieldValue(a, "color").toString().toLowerCase();
          const bColor = getFieldValue(b, "color").toString().toLowerCase();
          if (aColor !== bColor) {
            return aColor < bColor ? -1 : aColor > bColor ? 1 : 0;
          }

          const aFinish = getFieldValue(a, "finish").toString().toLowerCase();
          const bFinish = getFieldValue(b, "finish").toString().toLowerCase();
          if (aFinish !== bFinish) {
            return aFinish < bFinish ? -1 : aFinish > bFinish ? 1 : 0;
          }

          const aDimensions = getFieldValue(a, "dimensions")
            .toString()
            .toLowerCase();
          const bDimensions = getFieldValue(b, "dimensions")
            .toString()
            .toLowerCase();
          return aDimensions < bDimensions
            ? -1
            : aDimensions > bDimensions
              ? 1
              : 0;
        } else if (activeTab === "handle") {
          // Brand → Color → Type → Material → Dimensions
          const aBrand = getFieldValue(a, "brand").toString().toLowerCase();
          const bBrand = getFieldValue(b, "brand").toString().toLowerCase();
          if (aBrand !== bBrand) {
            return aBrand < bBrand ? -1 : aBrand > bBrand ? 1 : 0;
          }

          const aColor = getFieldValue(a, "color").toString().toLowerCase();
          const bColor = getFieldValue(b, "color").toString().toLowerCase();
          if (aColor !== bColor) {
            return aColor < bColor ? -1 : aColor > bColor ? 1 : 0;
          }

          const aType = getFieldValue(a, "type").toString().toLowerCase();
          const bType = getFieldValue(b, "type").toString().toLowerCase();
          if (aType !== bType) {
            return aType < bType ? -1 : aType > bType ? 1 : 0;
          }

          const aMaterial = getFieldValue(a, "material")
            .toString()
            .toLowerCase();
          const bMaterial = getFieldValue(b, "material")
            .toString()
            .toLowerCase();
          if (aMaterial !== bMaterial) {
            return aMaterial < bMaterial ? -1 : aMaterial > bMaterial ? 1 : 0;
          }

          const aDimensions = getFieldValue(a, "dimensions")
            .toString()
            .toLowerCase();
          const bDimensions = getFieldValue(b, "dimensions")
            .toString()
            .toLowerCase();
          return aDimensions < bDimensions
            ? -1
            : aDimensions > bDimensions
              ? 1
              : 0;
        } else if (activeTab === "hardware") {
          // Brand → Name → Type → Sub Category → Dimensions
          const aBrand = getFieldValue(a, "brand").toString().toLowerCase();
          const bBrand = getFieldValue(b, "brand").toString().toLowerCase();
          if (aBrand !== bBrand) {
            return aBrand < bBrand ? -1 : aBrand > bBrand ? 1 : 0;
          }

          const aName = getFieldValue(a, "name").toString().toLowerCase();
          const bName = getFieldValue(b, "name").toString().toLowerCase();
          if (aName !== bName) {
            return aName < bName ? -1 : aName > bName ? 1 : 0;
          }

          const aType = getFieldValue(a, "type").toString().toLowerCase();
          const bType = getFieldValue(b, "type").toString().toLowerCase();
          if (aType !== bType) {
            return aType < bType ? -1 : aType > bType ? 1 : 0;
          }

          const aSubCategory = getFieldValue(a, "sub_category")
            .toString()
            .toLowerCase();
          const bSubCategory = getFieldValue(b, "sub_category")
            .toString()
            .toLowerCase();
          if (aSubCategory !== bSubCategory) {
            return aSubCategory < bSubCategory
              ? -1
              : aSubCategory > bSubCategory
                ? 1
                : 0;
          }

          const aDimensions = getFieldValue(a, "dimensions")
            .toString()
            .toLowerCase();
          const bDimensions = getFieldValue(b, "dimensions")
            .toString()
            .toLowerCase();
          return aDimensions < bDimensions
            ? -1
            : aDimensions > bDimensions
              ? 1
              : 0;
        }
      }

      // Single field sorting for non-default sorts
      let aValue = getFieldValue(a, sortField);
      let bValue = getFieldValue(b, sortField);

      // Handle relevance sorting (by search match)
      if (sortOrder === "relevance" && search) {
        const searchLower = search.toLowerCase();
        const aMatch = aValue.toString().toLowerCase().includes(searchLower);
        const bMatch = bValue.toString().toLowerCase().includes(searchLower);
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }

      // Convert to string for comparison
      aValue = aValue.toString().toLowerCase();
      bValue = bValue.toString().toLowerCase();

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else if (sortOrder === "desc") {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
      return 0;
    });

    return filtered;
  }, [
    data,
    search,
    sortField,
    sortOrder,
    selectedCategories,
    activeTab,
    filters,
  ]);

  // Pagination logic
  const totalItems = filteredAndSortedData.length;
  const totalPages =
    itemsPerPage === 0 ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedData = filteredAndSortedData.slice(startIndex, endIndex);

  // Reset to the first page when the displayed inventory set changes.
  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeTab, filters]);

  const handleSort = (field) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> relevance -> asc
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else if (sortOrder === "desc") {
        setSortOrder("relevance");
      } else {
        setSortOrder("asc");
      }
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setShowSortDropdown(false);
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Check if any filters are active (not in default state)
  const isAnyFilterActive = () => {
    const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
      if (key === "quantity_min" || key === "quantity_max") {
        return value !== "";
      }
      return Array.isArray(value) ? value.length > 0 : value !== "";
    });
    const defaultSortField = activeTab === "accessory" ? "name" : "brand";
    return (
      search !== "" || // Search is not empty
      selectedCategories.length !== 1 || // Category filter is not showing current tab only
      sortField !== defaultSortField || // Sort field is not default
      sortOrder !== "asc" || // Sort order is not default
      hasActiveFilters // Any filter is active
    );
  };

  const handleReset = () => {
    resetFilters();
    setCurrentPage(1);
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

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  // Count active filters
  const getActiveFilterCount = () => {
    return Object.entries(filters).reduce((count, [key, value]) => {
      if (key === "quantity_min" || key === "quantity_max") {
        return count + (value !== "" ? 1 : 0);
      }
      return (
        count + (Array.isArray(value) ? value.length : value !== "" ? 1 : 0)
      );
    }, 0);
  };

  // Only the active field shows a sort indicator in the menu (DESIGN.md 15.4);
  // the relevance step has no direction, so it shows none.
  const getSortIcon = (field) => {
    if (sortField !== field) return null;
    if (sortOrder === "asc")
      return <ArrowUp className="h-4 w-4 text-primary" aria-hidden="true" />;
    if (sortOrder === "desc")
      return <ArrowDown className="h-4 w-4 text-primary" aria-hidden="true" />;
    return null;
  };

  // Column mapping for Excel export - dynamic based on activeTab
  const columnMap = useMemo(() => {
    const baseMap = {
      Quantity: (item) => item.quantity || 0,
      Description: (item) => item.description || "",
      Category: (item) => item.category || "",
      "Price (including GST)": (item) => item.price || 0,
      CreatedAt: (item) =>
        item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "",
      UpdatedAt: (item) =>
        item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "",
    };

    if (activeTab === "sheet" || activeTab === "sunmica") {
      return {
        ...baseMap,
        Brand: (item) => item.sheet?.brand || "",
        Color: (item) => item.sheet?.color || "",
        Finish: (item) => item.sheet?.finish || "",
        Dimensions: (item) => item.sheet?.dimensions || "",
        Face: (item) => item.sheet?.face || "",
        IsSunmica: (item) => (item.sheet?.is_sunmica ? "Yes" : "No"),
      };
    } else if (activeTab === "handle") {
      return {
        ...baseMap,
        Brand: (item) => item.handle?.brand || "",
        Color: (item) => item.handle?.color || "",
        Type: (item) => item.handle?.type || "",
        Material: (item) => item.handle?.material || "",
        Dimensions: (item) => item.handle?.dimensions || "",
      };
    } else if (activeTab === "hardware") {
      return {
        ...baseMap,
        Name: (item) => item.hardware?.name || "",
        Type: (item) => item.hardware?.type || "",
        Dimensions: (item) => item.hardware?.dimensions || "",
      };
    } else if (activeTab === "accessory") {
      return {
        ...baseMap,
        Name: (item) => item.accessory?.name || "",
      };
    } else if (activeTab === "edging_tape") {
      return {
        ...baseMap,
        Brand: (item) => item.edging_tape?.brand || "",
        Color: (item) => item.edging_tape?.color || "",
        Finish: (item) => item.edging_tape?.finish || "",
        Dimensions: (item) => item.edging_tape?.dimensions || "",
      };
    }
    return baseMap;
  }, [activeTab]);

  // Initialize Excel export hook
  const { exportToExcel, isExporting } = useExcelExport({
    columnMap,
    filenamePrefix: `${activeTab}_inventory_export`,
    sheetName: `${
      activeTab.charAt(0).toUpperCase() + activeTab.slice(1)
    } Inventory`,
    selectedColumns,
  });

  const handleExportToExcel = () => {
    exportToExcel(filteredAndSortedData);
  };

  // Stock Tally Functions
  const handleOpenStockTally = () => {
    setShowStockTallyModal(true);
  };

  // Table column count for the loading / error / empty rows: image, the
  // tab's columns, and quantity.
  const tabColumns = TAB_COLUMNS[activeTab] || [];
  const columnCount = tabColumns.length + 2;

  const getItemTitle = (item) => {
    if (!item) return "";
    const category = (item.category || "").toLowerCase();
    if ((category === "sheet" || activeTab === "sunmica") && item.sheet) {
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

  const tabLabel = TABS.find((tab) => tab.id === activeTab)?.label || "";
  const tabNoun = tabLabel.toLowerCase();
  const filterFields =
    FILTER_FIELDS[activeTab === "sunmica" ? "sheet" : activeTab] || [];
  const activeFilterCount = getActiveFilterCount();

  // Filters that narrow the list (sort does not hide records), used to tell
  // "no records" apart from "no results for this filter" (DESIGN.md 15.4).
  const isNarrowingFilterActive = search !== "" || activeFilterCount > 0;

  // The "Sort by" menu offers the sortable columns of the active tab, then
  // quantity.
  const sortOptions = [
    ...tabColumns
      .filter((key) => COLUMN_DEFS[key].sortable !== false)
      .map((key) => ({ field: key, label: COLUMN_DEFS[key].label })),
    { field: "quantity", label: "Quantity" },
  ];

  // The list can briefly hold the previous tab's rows while a tab loads or
  // after a failed load, so actions that read it stay off until it is current.
  const hasCurrentRows = !loading && !error && filteredAndSortedData.length > 0;
  const exportDisabled =
    isExporting || !hasCurrentRows || selectedColumns.length === 0;
  const columnPickerDisabled = isExporting || !hasCurrentRows;

  const tabClass = (tab) =>
    `cursor-pointer py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary rounded-t-sm ${
      activeTab === tab
        ? "border-primary text-primary"
        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
    }`;

  const sortHeaderProps = { sortField, sortOrder, onSort: handleSort };
  const goToAddItem = () => router.push("/admin/inventory/additem");

  return (
    <AdminShell>
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="px-4 py-2 shrink-0">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-slate-800">Inventory</h1>
            <div className="flex items-center gap-2">
              <SearchBar />
              <button
                type="button"
                onClick={goToAddItem}
                className={BTN_PRIMARY}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add item
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
                    aria-label={`Search ${tabNoun} items`}
                    placeholder="Search by description, supplier reference, brand or colour"
                    className="w-full text-sm text-slate-800 py-2 pr-3 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Reset, sort, filter, stock tally, export */}
                <div className="flex flex-wrap items-center gap-2">
                  {isAnyFilterActive() && (
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
                          {sortOptions.map(({ field, label }) => (
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
                    onClick={() => {
                      setShowSortDropdown(false);
                      setShowColumnDropdown(false);
                      setShowFilterPopup(true);
                    }}
                    aria-haspopup="dialog"
                    className={BTN_SECONDARY}
                  >
                    <Funnel className="h-4 w-4" aria-hidden="true" />
                    <span>Filter</span>
                    {activeFilterCount > 0 && (
                      <span className={BUTTON_COUNT_BADGE}>
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenStockTally}
                    disabled={!hasCurrentRows}
                    className={BTN_SECONDARY}
                  >
                    <ClipboardList className="h-4 w-4" aria-hidden="true" />
                    <span>Stock tally</span>
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
                              <span>
                                {EXPORT_COLUMN_LABELS[column] || column}
                              </span>
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
                className="flex space-x-6 overflow-x-auto"
                role="tablist"
                aria-label="Inventory category"
              >
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`inventory-tab-${tab.id}`}
                    aria-selected={activeTab === tab.id}
                    aria-controls="inventory-panel"
                    onClick={() => dispatch(setActiveTab(tab.id))}
                    className={tabClass(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable table section */}
            <div
              id="inventory-panel"
              role="tabpanel"
              aria-labelledby={`inventory-tab-${activeTab}`}
              className="flex-1 overflow-auto"
            >
              <div className="min-w-full">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className={`${TH} text-left`}>
                        Image
                      </th>
                      {tabColumns.map((key) =>
                        COLUMN_DEFS[key].sortable === false ? (
                          <th
                            key={key}
                            scope="col"
                            className={`${TH} text-left`}
                          >
                            {COLUMN_DEFS[key].label}
                          </th>
                        ) : (
                          <SortHeader
                            key={key}
                            field={key}
                            label={COLUMN_DEFS[key].label}
                            {...sortHeaderProps}
                          />
                        ),
                      )}
                      <SortHeader
                        field="quantity"
                        label="Quantity"
                        alignRight
                        {...sortHeaderProps}
                      />
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {loading ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={columnCount}
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
                              Loading {tabNoun} items…
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : error ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={columnCount}
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
                              onClick={() => fetchData(activeTab)}
                              className={BTN_SECONDARY_COMPACT}
                            >
                              Try again
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : paginatedData.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={columnCount}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <Package
                              className="w-8 h-8 text-slate-300"
                              aria-hidden="true"
                            />
                            {data.length > 0 && isNarrowingFilterActive ? (
                              <>
                                <p className="text-sm text-slate-600">
                                  No {tabNoun} items match your filters
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
                                  No {tabNoun} items yet
                                </p>
                                <button
                                  type="button"
                                  onClick={goToAddItem}
                                  className={BTN_SECONDARY_COMPACT}
                                >
                                  <Plus
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Add item
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((item) => {
                        const href = `/admin/inventory/${item.item_id}`;
                        return (
                          <tr
                            key={item.item_id}
                            onClick={() => router.push(href)}
                            className="cursor-pointer hover:bg-slate-50 transition-colors duration-200"
                          >
                            <td className="px-4 py-3">
                              <ItemThumb image={item.image} />
                            </td>
                            {tabColumns.map((key, index) => {
                              const value = getFieldValue(item, key);
                              return (
                                <td
                                  key={key}
                                  className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap"
                                >
                                  {index === 0 ? (
                                    <Link
                                      href={href}
                                      onClick={(e) => e.stopPropagation()}
                                      title={getItemTitle(item) || undefined}
                                      className="block max-w-64 truncate font-medium rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    >
                                      {value || EMPTY}
                                    </Link>
                                  ) : (
                                    <TextCell
                                      value={value}
                                      strong={COLUMN_DEFS[key].strong}
                                    />
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <StockLevel
                                stock={Number(item.quantity) || 0}
                                unit={item.measurement_unit}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fixed pagination footer */}
            {!loading && !error && paginatedData.length > 0 && (
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

      {/* Filter dialog. Filters apply as they are chosen, so closing the
          dialog never discards anything and the backdrop can close it. */}
      {showFilterPopup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
          onClick={() => setShowFilterPopup(false)}
        >
          <div
            ref={filterModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-filter-title"
            className="bg-white rounded-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <h2
                id="inventory-filter-title"
                className="text-lg font-semibold text-slate-800"
              >
                Filter {tabNoun} items
              </h2>
              <button
                type="button"
                onClick={() => setShowFilterPopup(false)}
                className={ICON_BTN}
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Common filters */}
              <fieldset>
                <legend className="block text-sm font-medium text-slate-700 mb-1.5">
                  Quantity range
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="inventory-filter-qty-min"
                      className="block text-xs text-slate-500 mb-1.5"
                    >
                      Minimum
                    </label>
                    <input
                      id="inventory-filter-qty-min"
                      data-autofocus
                      type="number"
                      value={filters.quantity_min}
                      onChange={(e) =>
                        handleFilterChange("quantity_min", e.target.value)
                      }
                      className={FIELD_COMPACT}
                      min="0"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="inventory-filter-qty-max"
                      className="block text-xs text-slate-500 mb-1.5"
                    >
                      Maximum
                    </label>
                    <input
                      id="inventory-filter-qty-max"
                      type="number"
                      value={filters.quantity_max}
                      onChange={(e) =>
                        handleFilterChange("quantity_max", e.target.value)
                      }
                      className={FIELD_COMPACT}
                      min="0"
                    />
                  </div>
                </div>
              </fieldset>

              {/* Category-specific filters */}
              {filterFields.length > 0 && (
                <div className="space-y-4 pt-6 border-t border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700">
                    {tabLabel} filters
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filterFields.map(([label, field, noun]) => (
                      <MultiSelectDropdown
                        key={field}
                        label={label}
                        field={field}
                        options={getDistinctValues(field, data)}
                        selectedValues={filters[field]}
                        onSelectionChange={handleFilterChange}
                        placeholder={`Select ${noun}…`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 shrink-0">
              <button
                type="button"
                onClick={clearFilters}
                disabled={activeFilterCount === 0}
                className={BTN_GHOST}
              >
                Clear all filters
              </button>
              <button
                type="button"
                onClick={() => setShowFilterPopup(false)}
                className={BTN_PRIMARY}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock tally modal */}
      {showStockTallyModal && (
        <StockTally
          activeTab={activeTab}
          setShowStockTallyModal={setShowStockTallyModal}
          filteredAndSortedData={filteredAndSortedData}
        />
      )}
    </AdminShell>
  );
}
