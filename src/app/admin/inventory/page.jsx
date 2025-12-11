"use client";
import React from "react";
import Sidebar from "@/components/Sidebar.jsx";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
import TabsController from "@/components/tabscontroller";
import PaginationFooter from "@/components/PaginationFooter";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { replaceTab } from "@/state/reducer/tabs";
import { v4 as uuidv4 } from "uuid";
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
  X,
  AlertTriangle,
  ClipboardList,
} from "lucide-react";
import { ToastContainer } from "react-toastify";
import MultiSelectDropdown from "@/components/MultiSelectDropdown.jsx";
import StockTally from "@/components/StockTally.jsx";

export default function page() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("sheet");
  const { getToken } = useAuth();
  const tabs = [
    { id: "sheet", label: "Sheet" },
    { id: "sunmica", label: "Sunmica" },
    { id: "edging_tape", label: "Edging Tape" },
    { id: "handle", label: "Handle" },
    { id: "hardware", label: "Hardware" },
    { id: "accessory", label: "Accessory" },
  ];
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("quantity");
  const [sortOrder, setSortOrder] = useState("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showCategoryFilterDropdown, setShowCategoryFilterDropdown] =
    useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

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
        "Price",
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
        "Price",
        "CreatedAt",
        "UpdatedAt",
      ];
    } else if (activeTab === "hardware") {
      return [
        "Quantity",
        "Description",
        "Category",
        "Price",
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
        "Price",
        "Name",
        "CreatedAt",
        "UpdatedAt",
      ];
    } else if (activeTab === "edging_tape") {
      return [
        "Quantity",
        "Description",
        "Category",
        "Price",
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
  const [filters, setFilters] = useState({
    // Common filters
    quantity_min: "",
    quantity_max: "",
    // Sheet filters
    sheet_brand: [],
    sheet_color: [],
    sheet_finish: [],
    sheet_face: [],
    // Handle filters
    handle_brand: [],
    handle_color: [],
    handle_type: [],
    handle_material: [],
    // Hardware filters
    hardware_brand: [],
    hardware_name: [],
    hardware_type: [],
    hardware_sub_category: [],
    // Accessory filters
    accessory_name: [],
    // Edging Tape filters
    edging_tape_brand: [],
    edging_tape_color: [],
    edging_tape_finish: [],
    edging_tape_dimensions: [],
  });

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
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }
      // For sunmica, fetch sheet items and filter client-side
      const apiCategory = category === "sunmica" ? "sheet" : category;
      let config = {
        method: "get",
        maxBodyLength: Infinity,
        url: `/api/item/all/${apiCategory}`,
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          ...{},
        },
      };
      axios
        .request(config)
        .then((response) => {
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
                  !item.sheet?.is_sunmica || item.sheet?.is_sunmica === false
              );
            }
            setData(items);
            setLoading(false);
          } else {
            setLoading(false);
            setError(response.data.message);
          }
        })
        .catch((error) => {
          console.error(error);
          setLoading(false);
          setError(error.response.data.message);
        });
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) {
        setShowSortDropdown(false);
        setShowCategoryFilterDropdown(false);
        setShowColumnDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close dropdown when clicking outside the filter popup
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showFilterPopup && !event.target.closest(".filter-popup")) {
        setShowFilterPopup(false);
      }
    };

    if (showFilterPopup) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showFilterPopup]);

  useEffect(() => {
    fetchData(activeTab);
    setSelectedCategories([activeTab]); // Initialize with current active tab
  }, [activeTab]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = data.filter((item) => {
      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          (item.description || "").toLowerCase().includes(searchLower) ||
          (item.supplier_reference || "").toLowerCase().includes(searchLower) ||
          (item.sheet?.brand || "").toLowerCase().includes(searchLower) ||
          (item.sheet?.color || "").toLowerCase().includes(searchLower) ||
          (item.sheet?.description || "").toLowerCase().includes(searchLower) ||
          (item.handle?.brand || "").toLowerCase().includes(searchLower) ||
          (item.handle?.color || "").toLowerCase().includes(searchLower) ||
          (item.edging_tape?.brand || "").toLowerCase().includes(searchLower) ||
          (item.edging_tape?.color || "").toLowerCase().includes(searchLower) ||
          (item.edging_tape?.description || "").toLowerCase().includes(searchLower);
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
            item.sheet?.brand?.toLowerCase().includes(brand.toLowerCase())
          )
        ) {
          return false;
        }
        if (
          filters.sheet_color.length > 0 &&
          !filters.sheet_color.some((color) =>
            item.sheet?.color?.toLowerCase().includes(color.toLowerCase())
          )
        ) {
          return false;
        }
        if (
          filters.sheet_finish.length > 0 &&
          !filters.sheet_finish.some((finish) =>
            item.sheet?.finish?.toLowerCase().includes(finish.toLowerCase())
          )
        ) {
          return false;
        }
        if (
          filters.sheet_face.length > 0 &&
          !filters.sheet_face.some((face) =>
            item.sheet?.face?.toLowerCase().includes(face.toLowerCase())
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
            item.handle?.brand?.toLowerCase().includes(brand.toLowerCase())
          )
        ) {
          return false;
        }
        if (
          filters.handle_color.length > 0 &&
          !filters.handle_color.some((color) =>
            item.handle?.color?.toLowerCase().includes(color.toLowerCase())
          )
        ) {
          return false;
        }
        if (
          filters.handle_type.length > 0 &&
          !filters.handle_type.some((type) =>
            item.handle?.type?.toLowerCase().includes(type.toLowerCase())
          )
        ) {
          return false;
        }
        if (
          filters.handle_material.length > 0 &&
          !filters.handle_material.some((material) =>
            item.handle?.material
              ?.toLowerCase()
              .includes(material.toLowerCase())
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
            item.hardware?.brand?.toLowerCase().includes(brand.toLowerCase())
          )
        ) {
          return false;
        }
        if (
          filters.hardware_name.length > 0 &&
          !filters.hardware_name.some((name) =>
            item.hardware?.name?.toLowerCase().includes(name.toLowerCase())
          )
        ) {
          return false;
        }
        if (
          filters.hardware_type.length > 0 &&
          !filters.hardware_type.some((type) =>
            item.hardware?.type?.toLowerCase().includes(type.toLowerCase())
          )
        ) {
          return false;
        }
        if (
          filters.hardware_sub_category.length > 0 &&
          !filters.hardware_sub_category.some((subCategory) =>
            item.hardware?.sub_category
              ?.toLowerCase()
              .includes(subCategory.toLowerCase())
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
            item.accessory?.name?.toLowerCase().includes(name.toLowerCase())
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
            item.edging_tape?.brand?.toLowerCase().includes(brand.toLowerCase())
          )
        ) {
          return false;
        }
        if (
          filters.edging_tape_color.length > 0 &&
          !filters.edging_tape_color.some((color) =>
            item.edging_tape?.color?.toLowerCase().includes(color.toLowerCase())
          )
        ) {
          return false;
        }
        if (
          filters.edging_tape_finish.length > 0 &&
          !filters.edging_tape_finish.some((finish) =>
            item.edging_tape?.finish
              ?.toLowerCase()
              .includes(finish.toLowerCase())
          )
        ) {
          return false;
        }
        if (
          filters.edging_tape_dimensions.length > 0 &&
          !filters.edging_tape_dimensions.some((dimensions) =>
            item.edging_tape?.dimensions
              ?.toLowerCase()
              .includes(dimensions.toLowerCase())
          )
        ) {
          return false;
        }
      }

      return true;
    });

    // Sort data
    filtered.sort((a, b) => {
      let aValue = a[sortField] || "";
      let bValue = b[sortField] || "";

      // Handle nested object sorting
      if (sortField === "brand") {
        aValue = a.sheet?.brand || a.handle?.brand || a.hardware?.brand || "";
        bValue = b.sheet?.brand || b.handle?.brand || b.hardware?.brand || "";
      } else if (sortField === "color") {
        aValue = a.sheet?.color || a.handle?.color || "";
        bValue = b.sheet?.color || b.handle?.color || "";
      } else if (sortField === "finish") {
        aValue = a.sheet?.finish || "";
        bValue = b.sheet?.finish || "";
      } else if (sortField === "type") {
        aValue = a.handle?.type || a.hardware?.type || "";
        bValue = b.handle?.type || b.hardware?.type || "";
      } else if (sortField === "material") {
        aValue = a.handle?.material || "";
        bValue = b.handle?.material || "";
      } else if (sortField === "name") {
        aValue = a.hardware?.name || a.accessory?.name || "";
        bValue = b.hardware?.name || b.accessory?.name || "";
      } else if (sortField === "sub_category") {
        aValue = a.hardware?.sub_category || "";
        bValue = b.hardware?.sub_category || "";
      } else if (sortField === "brand") {
        aValue = a.edging_tape?.brand || "";
        bValue = b.edging_tape?.brand || "";
      } else if (sortField === "color") {
        aValue = a.edging_tape?.color || "";
        bValue = b.edging_tape?.color || "";
      } else if (sortField === "finish") {
        aValue = a.edging_tape?.finish || "";
        bValue = b.edging_tape?.finish || "";
      } else if (sortField === "dimensions") {
        aValue = a.edging_tape?.dimensions || "";
        bValue = b.edging_tape?.dimensions || "";
      }

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

  // Reset to first page when search or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

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
    return (
      search !== "" || // Search is not empty
      selectedCategories.length !== 1 || // Category filter is not showing current tab only
      sortField !== "quantity" || // Sort field is not default
      sortOrder !== "asc" || // Sort order is not default
      hasActiveFilters // Any filter is active
    );
  };

  const handleReset = () => {
    setSearch("");
    setSortField("quantity");
    setSortOrder("asc");
    setSelectedCategories([activeTab]); // Reset to current active tab
    setCurrentPage(1);
    // Reset all filters
    setFilters({
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
    });
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
          : [...prev, column]
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
    setFilters({
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
    });
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

  const getSortIcon = (field) => {
    if (sortField !== field)
      return <ArrowUpDown className="h-4 w-4 text-slate-400" />;
    if (sortOrder === "asc")
      return <ArrowUp className="h-4 w-4 text-primary" />;
    if (sortOrder === "desc")
      return <ArrowDown className="h-4 w-4 text-primary" />;
    return null; // No icon for relevance
  };

  const handleExportToExcel = async () => {
    if (filteredAndSortedData.length === 0) {
      toast.warning(
        "No data to export. Please adjust your filters or add items.",
        {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        }
      );
      return;
    }

    setIsExporting(true);

    try {
      // Dynamic import of xlsx to avoid SSR issues
      const XLSX = await import("xlsx");

      // Column width map
      const columnWidthMap = {
        Brand: 20,
        Color: 15,
        Finish: 15,
        Dimensions: 18,
        Quantity: 12,
        Description: 30,
        Category: 15,
        Price: 12,
        Face: 12,
        IsSunmica: 12,
        Type: 15,
        Material: 15,
        Name: 20,
        CreatedAt: 20,
        UpdatedAt: 20,
      };

      // Prepare data for export based on active tab
      let fullExportData = [];
      if (activeTab === "sheet" || activeTab === "sunmica") {
        fullExportData = filteredAndSortedData.map((item) => ({
          Brand: item.sheet?.brand || "",
          Color: item.sheet?.color || "",
          Finish: item.sheet?.finish || "",
          Dimensions: item.sheet?.dimensions || "",
          Quantity: item.quantity || 0,
          Description: item.description || "",
          Category: item.category || "",
          Price: item.price || 0,
          Face: item.sheet?.face || "",
          IsSunmica: item.sheet?.is_sunmica ? "Yes" : "No",
          CreatedAt: item.createdAt
            ? new Date(item.createdAt).toLocaleDateString()
            : "",
          UpdatedAt: item.updatedAt
            ? new Date(item.updatedAt).toLocaleDateString()
            : "",
        }));
      } else if (activeTab === "handle") {
        fullExportData = filteredAndSortedData.map((item) => ({
          Brand: item.handle?.brand || "",
          Color: item.handle?.color || "",
          Type: item.handle?.type || "",
          Material: item.handle?.material || "",
          Dimensions: item.handle?.dimensions || "",
          Quantity: item.quantity || 0,
          Description: item.description || "",
          Category: item.category || "",
          Price: item.price || 0,
          CreatedAt: item.createdAt
            ? new Date(item.createdAt).toLocaleDateString()
            : "",
          UpdatedAt: item.updatedAt
            ? new Date(item.updatedAt).toLocaleDateString()
            : "",
        }));
      } else if (activeTab === "hardware") {
        fullExportData = filteredAndSortedData.map((item) => ({
          Quantity: item.quantity || 0,
          Description: item.description || "",
          Category: item.category || "",
          Price: item.price || 0,
          Name: item.hardware?.name || "",
          Type: item.hardware?.type || "",
          Dimensions: item.hardware?.dimensions || "",
          CreatedAt: item.createdAt
            ? new Date(item.createdAt).toLocaleDateString()
            : "",
          UpdatedAt: item.updatedAt
            ? new Date(item.updatedAt).toLocaleDateString()
            : "",
        }));
      } else if (activeTab === "accessory") {
        fullExportData = filteredAndSortedData.map((item) => ({
          Quantity: item.quantity || 0,
          Description: item.description || "",
          Category: item.category || "",
          Price: item.price || 0,
          Name: item.accessory?.name || "",
          CreatedAt: item.createdAt
            ? new Date(item.createdAt).toLocaleDateString()
            : "",
          UpdatedAt: item.updatedAt
            ? new Date(item.updatedAt).toLocaleDateString()
            : "",
        }));
      } else if (activeTab === "edging_tape") {
        fullExportData = filteredAndSortedData.map((item) => ({
          Quantity: item.quantity || 0,
          Description: item.description || "",
          Category: item.category || "",
          Price: item.price || 0,
          Brand: item.edging_tape?.brand || "",
          Color: item.edging_tape?.color || "",
          Finish: item.edging_tape?.finish || "",
          Dimensions: item.edging_tape?.dimensions || "",
          CreatedAt: item.createdAt
            ? new Date(item.createdAt).toLocaleDateString()
            : "",
          UpdatedAt: item.updatedAt
            ? new Date(item.updatedAt).toLocaleDateString()
            : "",
        }));
      }

      // Filter to only selected columns
      const exportData = fullExportData.map((row) => {
        const filteredRow = {};
        selectedColumns.forEach((column) => {
          if (row.hasOwnProperty(column)) {
            filteredRow[column] = row[column];
          }
        });
        return filteredRow;
      });

      // Create a new workbook
      const wb = XLSX.utils.book_new();

      // Create a worksheet from the data
      const ws = XLSX.utils.json_to_sheet(exportData);

      // Set column widths for selected columns only
      const colWidths = selectedColumns.map((column) => ({
        wch: columnWidthMap[column] || 15,
      }));
      ws["!cols"] = colWidths;

      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(
        wb,
        ws,
        `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Inventory`
      );

      // Generate filename with current date
      const currentDate = new Date().toISOString().split("T")[0];
      const filename = `${activeTab}_inventory_export_${currentDate}.xlsx`;

      // Save the file
      XLSX.writeFile(wb, filename);

      // Show success message
      toast.success(
        `Successfully exported ${exportData.length} ${activeTab} items to ${filename}`,
        {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        }
      );
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast.error("Failed to export data to Excel. Please try again.", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Stock Tally Functions
  const handleOpenStockTally = () => {
    setShowStockTallyModal(true);
  };
  // Compute dynamic column count for table states
  const columnCount = useMemo(() => {
    // Base: Image, Quantity
    if (activeTab === "sheet" || activeTab === "sunmica") return 1 + 4 + 1; // brand,color,finish,dimensions
    if (activeTab === "handle") return 1 + 5 + 1; // brand,color,type,material,dimensions
    if (activeTab === "hardware") return 1 + 4 + 1; // brand,name,type,dimensions
    if (activeTab === "accessory") return 1 + 1 + 1; // name
    if (activeTab === "edging_tape") return 1 + 4 + 1; // brand,color,finish,dimensions
    return 6;
  }, [activeTab]);

  const getItemTitle = (item) => {
    if (!item) return "";
    const category = item.category.toLowerCase();
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

  return (
    <AdminRoute>
      <div className="flex h-screen bg-tertiary">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CRMLayout />
          <div className="flex-1 flex flex-col overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
                  <p className="text-sm text-slate-600 font-medium">
                    Loading inventory details...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-sm text-red-600 mb-4 font-medium">
                    {error}
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="cursor-pointer btn-primary px-4 py-2 text-sm font-medium rounded-lg"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="px-4 py-2 flex-shrink-0">
                  <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-slate-700">
                      Inventory
                    </h1>
                    <TabsController
                      href="/admin/inventory/additem"
                      title="Add Item"
                    >
                      <div className="cursor-pointer hover:bg-primary transition-all duration-200 bg-primary/80 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm">
                        <Plus className="h-4 w-4" />
                        Add Item
                      </div>
                    </TabsController>
                  </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                    {/* Tabs Section */}
                    <div className="px-4 flex-shrink-0 border-b border-slate-200">
                      <nav className="-mb-px flex space-x-8 overflow-x-auto">
                        {tabs.map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                              ? "border-secondary text-secondary"
                              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                              }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </nav>
                    </div>

                    {/* Fixed Header Section */}
                    <div className="p-4 flex-shrink-0 border-b border-slate-200">
                      <div className="flex items-center justify-between gap-3">
                        {/* search bar */}
                        <div className="flex items-center gap-2 flex-1 max-w-lg relative">
                          <Search className="h-4 w-4 absolute left-3 text-slate-400" />
                          <input
                            type="text"
                            placeholder={`Search ${activeTab === "edging_tape"
                              ? "edging tape"
                              : activeTab
                              } items by description, supplier reference, brand, color`}
                            className="w-full text-slate-800 p-2 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm font-normal"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>
                        {/* reset, sort by, filter by, export to excel */}
                        <div className="flex items-center gap-2">
                          {isAnyFilterActive() && (
                            <button
                              onClick={handleReset}
                              className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                            >
                              <RotateCcw className="h-4 w-4" />
                              <span>Reset</span>
                            </button>
                          )}

                          <div className="relative dropdown-container">
                            <button
                              onClick={() =>
                                setShowSortDropdown(!showSortDropdown)
                              }
                              className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                            >
                              <ArrowUpDown className="h-4 w-4" />
                              <span>Sort by</span>
                            </button>
                            {showSortDropdown && (
                              <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                                <div className="py-1">
                                  {activeTab !== "accessory" && (
                                    <button
                                      onClick={() => handleSort("brand")}
                                      className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                    >
                                      Brand {getSortIcon("brand")}
                                    </button>
                                  )}
                                  {activeTab !== "accessory" &&
                                    activeTab !== "hardware" && (
                                      <button
                                        onClick={() => handleSort("color")}
                                        className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                      >
                                        Color {getSortIcon("color")}
                                      </button>
                                    )}
                                  {activeTab === "accessory" && (
                                    <button
                                      onClick={() => handleSort("name")}
                                      className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                    >
                                      Name {getSortIcon("name")}
                                    </button>
                                  )}
                                  {(activeTab === "sheet" ||
                                    activeTab === "sunmica") && (
                                      <button
                                        onClick={() => handleSort("finish")}
                                        className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                      >
                                        Finish {getSortIcon("finish")}
                                      </button>
                                    )}
                                  {activeTab === "handle" && (
                                    <button
                                      onClick={() => handleSort("type")}
                                      className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                    >
                                      Type {getSortIcon("type")}
                                    </button>
                                  )}
                                  {activeTab === "hardware" && (
                                    <button
                                      onClick={() => handleSort("name")}
                                      className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                    >
                                      Name {getSortIcon("name")}
                                    </button>
                                  )}
                                  {activeTab === "hardware" && (
                                    <button
                                      onClick={() => handleSort("sub_category")}
                                      className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                    >
                                      Sub Category {getSortIcon("sub_category")}
                                    </button>
                                  )}
                                  {activeTab === "handle" && (
                                    <button
                                      onClick={() => handleSort("material")}
                                      className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                    >
                                      Material {getSortIcon("material")}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleSort("quantity")}
                                    className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Quantity {getSortIcon("quantity")}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={() => setShowFilterPopup(true)}
                            className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium relative"
                          >
                            <Funnel className="h-4 w-4" />
                            <span>Filter</span>
                            {getActiveFilterCount() > 0 && (
                              <span className="absolute -top-1 -right-1 bg-primary text-white text-xs font-semibold rounded-full h-5 w-5 flex items-center justify-center">
                                {getActiveFilterCount()}
                              </span>
                            )}
                          </button>

                          <button
                            onClick={handleOpenStockTally}
                            disabled={filteredAndSortedData.length === 0}
                            className={`flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium relative ${filteredAndSortedData.length === 0
                              ? "opacity-50 cursor-not-allowed"
                              : "cursor-pointer hover:bg-slate-100"
                              }`}
                          >
                            <ClipboardList className="h-4 w-4" />
                            <span>Stock Tally</span>
                          </button>

                          <div className="relative dropdown-container flex items-center">
                            <button
                              onClick={handleExportToExcel}
                              disabled={
                                isExporting ||
                                filteredAndSortedData.length === 0 ||
                                selectedColumns.length === 0
                              }
                              className={`flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 border-r-0 px-3 py-2 rounded-l-lg text-sm font-medium ${isExporting ||
                                filteredAndSortedData.length === 0 ||
                                selectedColumns.length === 0
                                ? "opacity-50 cursor-not-allowed"
                                : "cursor-pointer hover:bg-slate-100"
                                }`}
                            >
                              <Sheet className="h-4 w-4" />
                              <span>
                                {isExporting
                                  ? "Exporting..."
                                  : "Export to Excel"}
                              </span>
                            </button>
                            <button
                              onClick={() =>
                                setShowColumnDropdown(!showColumnDropdown)
                              }
                              disabled={
                                isExporting ||
                                filteredAndSortedData.length === 0
                              }
                              className={`flex items-center transition-all duration-200 text-slate-700 border border-slate-300 px-2 py-2 rounded-r-lg text-sm font-medium ${isExporting ||
                                filteredAndSortedData.length === 0
                                ? "opacity-50 cursor-not-allowed"
                                : "cursor-pointer hover:bg-slate-100"
                                }`}
                            >
                              <ChevronDown className="h-5 w-5" />
                            </button>
                            {showColumnDropdown && (
                              <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                                <div className="py-1">
                                  <label className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 sticky top-0 bg-white border-b border-slate-200 cursor-pointer">
                                    <span className="font-semibold">Select All</span>
                                    <input
                                      type="checkbox"
                                      checked={selectedColumns.length === availableColumns.length}
                                      onChange={() => handleColumnToggle("Select All")}
                                      className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                                    />
                                  </label>
                                  {availableColumns.map((column) => (
                                    <label
                                      key={column}
                                      className="flex items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 cursor-pointer"
                                    >
                                      <span>{column}</span>
                                      <input
                                        type="checkbox"
                                        checked={selectedColumns.includes(column)}
                                        onChange={() => handleColumnToggle(column)}
                                        className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
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
                    {/* Scrollable Table Section */}
                    <div className="flex-1 overflow-auto">
                      <div className="min-w-full">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider">
                                Image
                              </th>
                              {(activeTab === "sheet" ||
                                activeTab === "sunmica" ||
                                activeTab === "handle" ||
                                activeTab === "hardware" ||
                                activeTab === "edging_tape") && (
                                  <th
                                    className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                    onClick={() => handleSort("brand")}
                                  >
                                    <div className="flex items-center gap-2">
                                      Brand
                                      {getSortIcon("brand")}
                                    </div>
                                  </th>
                                )}
                              {(activeTab === "sheet" ||
                                activeTab === "sunmica" ||
                                activeTab === "handle" ||
                                activeTab === "edging_tape") && (
                                  <th
                                    className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                    onClick={() => handleSort("color")}
                                  >
                                    <div className="flex items-center gap-2">
                                      Color
                                      {getSortIcon("color")}
                                    </div>
                                  </th>
                                )}
                              {(activeTab === "sheet" ||
                                activeTab === "sunmica" ||
                                activeTab === "edging_tape") && (
                                  <>
                                    <th
                                      className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                      onClick={() => handleSort("finish")}
                                    >
                                      <div className="flex items-center gap-2">
                                        Finish
                                        {getSortIcon("finish")}
                                      </div>
                                    </th>
                                    <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider">
                                      Dimensions
                                    </th>
                                  </>
                                )}
                              {activeTab === "handle" && (
                                <>
                                  <th
                                    className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                    onClick={() => handleSort("type")}
                                  >
                                    <div className="flex items-center gap-2">
                                      Type
                                      {getSortIcon("type")}
                                    </div>
                                  </th>
                                  <th
                                    className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                    onClick={() => handleSort("material")}
                                  >
                                    <div className="flex items-center gap-2">
                                      Material
                                      {getSortIcon("material")}
                                    </div>
                                  </th>
                                  <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider">
                                    Dimensions
                                  </th>
                                </>
                              )}
                              {activeTab === "hardware" && (
                                <>
                                  <th
                                    className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                    onClick={() => handleSort("name")}
                                  >
                                    <div className="flex items-center gap-2">
                                      Name
                                      {getSortIcon("name")}
                                    </div>
                                  </th>
                                  <th
                                    className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                    onClick={() => handleSort("sub_category")}
                                  >
                                    <div className="flex items-center gap-2">
                                      Sub Category
                                      {getSortIcon("sub_category")}
                                    </div>
                                  </th>
                                  <th className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider">
                                    Dimensions
                                  </th>
                                </>
                              )}
                              {activeTab === "accessory" && (
                                <>
                                  <th
                                    className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                    onClick={() => handleSort("name")}
                                  >
                                    <div className="flex items-center gap-2">
                                      Name
                                      {getSortIcon("name")}
                                    </div>
                                  </th>
                                </>
                              )}
                              <th
                                className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                                onClick={() => handleSort("quantity")}
                              >
                                <div className="flex items-center gap-2">
                                  Quantity
                                  {getSortIcon("quantity")}
                                </div>
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-200">
                            {loading ? (
                              <tr>
                                <td
                                  className="px-4 py-4 text-sm text-slate-500 text-center"
                                  colSpan={columnCount}
                                >
                                  Loading {activeTab} items...
                                </td>
                              </tr>
                            ) : error ? (
                              <tr>
                                <td
                                  className="px-4 py-4 text-sm text-red-600 text-center"
                                  colSpan={columnCount}
                                >
                                  {error}
                                </td>
                              </tr>
                            ) : paginatedData.length === 0 ? (
                              <tr>
                                <td
                                  className="px-4 py-4 text-sm text-slate-500 text-center"
                                  colSpan={columnCount}
                                >
                                  {search
                                    ? `No ${activeTab} items found matching your search`
                                    : `No ${activeTab} items found`}
                                </td>
                              </tr>
                            ) : (
                              paginatedData.map((item) => (
                                <tr
                                  key={item.item_id}
                                  onClick={() => {
                                    router.push(
                                      `/admin/inventory/${item.item_id}`
                                    );
                                    dispatch(
                                      replaceTab({
                                        id: uuidv4(),
                                        title: getItemTitle(item),
                                        href: `/admin/inventory/${item.item_id}`,
                                      })
                                    );
                                  }}
                                  className="cursor-pointer hover:bg-slate-50 transition-colors duration-200"
                                >
                                  <td className="px-4 py-2">
                                    <div className="w-10 h-10">
                                      {item.image?.url ? (
                                        <Image
                                          src={`/${item.image.url}`}
                                          alt={item.description || "Item"}
                                          width={40}
                                          height={40}
                                          className="w-full h-full object-cover rounded-md"
                                        />
                                      ) : (
                                        <div className="w-10 h-10 bg-slate-200 rounded-md text-center flex items-center justify-center">
                                          <ImageIcon className="h-4 w-4" />
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  {(activeTab === "sheet" ||
                                    activeTab === "sunmica" ||
                                    activeTab === "handle" ||
                                    activeTab === "hardware" ||
                                    activeTab === "edging_tape") && (
                                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap font-medium">
                                        {item.sheet?.brand ||
                                          item.handle?.brand ||
                                          item.hardware?.brand ||
                                          item.edging_tape?.brand ||
                                          "N/A"}
                                      </td>
                                    )}
                                  {(activeTab === "sheet" ||
                                    activeTab === "sunmica" ||
                                    activeTab === "handle" ||
                                    activeTab === "edging_tape") && (
                                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                        {item.sheet?.color ||
                                          item.handle?.color ||
                                          item.edging_tape?.color ||
                                          "N/A"}
                                      </td>
                                    )}
                                  {(activeTab === "sheet" ||
                                    activeTab === "sunmica" ||
                                    activeTab === "edging_tape") && (
                                      <>
                                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                          {item.sheet?.finish ||
                                            item.edging_tape?.finish ||
                                            "N/A"}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                          {item.sheet?.dimensions ||
                                            item.edging_tape?.dimensions ||
                                            "N/A"}
                                        </td>
                                      </>
                                    )}
                                  {activeTab === "handle" && (
                                    <>
                                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                        {item.handle?.type || "N/A"}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                        {item.handle?.material || "N/A"}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                        {item.handle?.dimensions || "N/A"}
                                      </td>
                                    </>
                                  )}
                                  {activeTab === "hardware" && (
                                    <>
                                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap font-medium">
                                        {item.hardware?.name || "N/A"}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                        {item.hardware?.sub_category || "N/A"}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                        {item.hardware?.dimensions || "N/A"}
                                      </td>
                                    </>
                                  )}
                                  {activeTab === "accessory" && (
                                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap font-medium">
                                      {item.accessory?.name || "N/A"}
                                    </td>
                                  )}
                                  <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 border border-green-200">
                                      {item.quantity || 0}
                                      {item.measurement_unit && (
                                        <span className="ml-1 text-green-700">
                                          {item.measurement_unit}
                                        </span>
                                      )}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Fixed Pagination Footer */}
                    {!loading && !error && paginatedData.length > 0 && (
                      <PaginationFooter
                        totalItems={totalItems}
                        itemsPerPage={itemsPerPage}
                        currentPage={currentPage}
                        onPageChange={handlePageChange}
                        onItemsPerPageChange={handleItemsPerPageChange}
                        itemsPerPageOptions={[25, 50, 100, 0]}
                        showItemsPerPage={true}
                      />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Filter Popup Modal */}
        {showFilterPopup && (
          <div className="fixed inset-0 backdrop-blur-xs bg-opacity-50 flex items-center justify-center z-50">
            <div className="filter-popup bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] m-4 flex flex-col">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-800">
                  Filter{" "}
                  {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Items
                </h2>
                <button
                  onClick={() => setShowFilterPopup(false)}
                  className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {/* Common Filters */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Quantity Range
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="number"
                          value={filters.quantity_min}
                          onChange={(e) =>
                            handleFilterChange("quantity_min", e.target.value)
                          }
                          placeholder="Min quantity"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          min="0"
                        />
                        <input
                          type="number"
                          value={filters.quantity_max}
                          onChange={(e) =>
                            handleFilterChange("quantity_max", e.target.value)
                          }
                          placeholder="Max quantity"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          min="0"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sheet Filters */}
                {(activeTab === "sheet" || activeTab === "sunmica") && (
                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    <h3 className="font-medium text-slate-700 text-sm tracking-wide">
                      {activeTab === "sunmica" ? "Sunmica" : "Sheet"} Specific
                      Filters
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <MultiSelectDropdown
                        label="Brand"
                        field="sheet_brand"
                        options={getDistinctValues("sheet_brand", data)}
                        selectedValues={filters.sheet_brand}
                        onSelectionChange={handleFilterChange}
                        placeholder="Select brands..."
                      />

                      <MultiSelectDropdown
                        label="Color"
                        field="sheet_color"
                        options={getDistinctValues("sheet_color", data)}
                        selectedValues={filters.sheet_color}
                        onSelectionChange={handleFilterChange}
                        placeholder="Select colors..."
                      />

                      <MultiSelectDropdown
                        label="Finish"
                        field="sheet_finish"
                        options={getDistinctValues("sheet_finish", data)}
                        selectedValues={filters.sheet_finish}
                        onSelectionChange={handleFilterChange}
                        placeholder="Select finishes..."
                      />

                      <MultiSelectDropdown
                        label="Face"
                        field="sheet_face"
                        options={getDistinctValues("sheet_face", data)}
                        selectedValues={filters.sheet_face}
                        onSelectionChange={handleFilterChange}
                        placeholder="Select faces..."
                      />
                    </div>
                  </div>
                )}

                {/* Handle Filters */}
                {activeTab === "handle" && (
                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    <h3 className="font-medium text-slate-700 text-sm uppercase tracking-wide">
                      Handle Specific Filters
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <MultiSelectDropdown
                        label="Brand"
                        field="handle_brand"
                        options={getDistinctValues("handle_brand", data)}
                        selectedValues={filters.handle_brand}
                        onSelectionChange={handleFilterChange}
                        placeholder="Select brands..."
                      />

                      <MultiSelectDropdown
                        label="Color"
                        field="handle_color"
                        options={getDistinctValues("handle_color", data)}
                        selectedValues={filters.handle_color}
                        onSelectionChange={handleFilterChange}
                        placeholder="Select colors..."
                      />

                      <MultiSelectDropdown
                        label="Type"
                        field="handle_type"
                        options={getDistinctValues("handle_type", data)}
                        selectedValues={filters.handle_type}
                        onSelectionChange={handleFilterChange}
                        placeholder="Select types..."
                      />

                      <MultiSelectDropdown
                        label="Material"
                        field="handle_material"
                        options={getDistinctValues("handle_material", data)}
                        selectedValues={filters.handle_material}
                        onSelectionChange={handleFilterChange}
                        placeholder="Select materials..."
                      />
                    </div>
                  </div>
                )}

                {/* Hardware Filters */}
                {activeTab === "hardware" && (
                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    <h3 className="font-medium text-slate-700 text-sm uppercase tracking-wide">
                      Hardware Specific Filters
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <MultiSelectDropdown
                        label="Brand"
                        field="hardware_brand"
                        options={getDistinctValues("hardware_brand", data)}
                        selectedValues={filters.hardware_brand}
                        onSelectionChange={handleFilterChange}
                        placeholder="Select brands..."
                      />

                      <MultiSelectDropdown
                        label="Name"
                        field="hardware_name"
                        options={getDistinctValues("hardware_name", data)}
                        selectedValues={filters.hardware_name}
                        onSelectionChange={handleFilterChange}
                        placeholder="Select names..."
                      />

                      <MultiSelectDropdown
                        label="Type"
                        field="hardware_type"
                        options={getDistinctValues("hardware_type", data)}
                        selectedValues={filters.hardware_type}
                        onSelectionChange={handleFilterChange}
                        placeholder="Select types..."
                      />

                      <MultiSelectDropdown
                        label="Sub Category"
                        field="hardware_sub_category"
                        options={getDistinctValues(
                          "hardware_sub_category",
                          data
                        )}
                        selectedValues={filters.hardware_sub_category}
                        onSelectionChange={handleFilterChange}
                        placeholder="Select sub categories..."
                      />
                    </div>
                  </div>
                )}

                {/* Accessory Filters */}
                {activeTab === "accessory" && (
                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    <h3 className="font-medium text-slate-700 text-sm uppercase tracking-wide">
                      Accessory Specific Filters
                    </h3>

                    <div className="grid grid-cols-1 gap-4">
                      <MultiSelectDropdown
                        label="Name"
                        field="accessory_name"
                        options={getDistinctValues("accessory_name", data)}
                        selectedValues={filters.accessory_name}
                        onSelectionChange={handleFilterChange}
                        placeholder="Select names..."
                      />
                    </div>
                  </div>
                )}
                {/* Edging Tape Filters */}
                {activeTab === "edging_tape" && (
                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    <h3 className="font-medium text-slate-700 text-sm uppercase tracking-wide">
                      Edging Tape Specific Filters
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <MultiSelectDropdown
                        label="Brand"
                        field="edging_tape_brand"
                        options={getDistinctValues("edging_tape_brand", data)}
                        selectedValues={filters.edging_tape_brand}
                        onSelectionChange={handleFilterChange}
                        placeholder="Select brands..."
                      />
                      <MultiSelectDropdown
                        label="Color"
                        field="edging_tape_color"
                        options={getDistinctValues("edging_tape_color", data)}
                        selectedValues={filters.edging_tape_color}
                        onSelectionChange={handleFilterChange}
                        placeholder="Select colors..."
                      />
                      <MultiSelectDropdown
                        label="Finish"
                        field="edging_tape_finish"
                        options={getDistinctValues("edging_tape_finish", data)}
                        selectedValues={filters.edging_tape_finish}
                        onSelectionChange={handleFilterChange}
                        placeholder="Select finishes..."
                      />
                      <MultiSelectDropdown
                        label="Dimensions"
                        field="edging_tape_dimensions"
                        options={getDistinctValues(
                          "edging_tape_dimensions",
                          data
                        )}
                        selectedValues={filters.edging_tape_dimensions}
                        onSelectionChange={handleFilterChange}
                        placeholder="Select dimensions..."
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center">
                <button
                  onClick={clearFilters}
                  className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Clear All Filters
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowFilterPopup(false)}
                    className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowFilterPopup(false)}
                    className="cursor-pointer px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stock Tally Modal */}
        {showStockTallyModal && (
          <StockTally
            activeTab={activeTab}
            setShowStockTallyModal={setShowStockTallyModal}
            filteredAndSortedData={filteredAndSortedData}
          />
        )}

        <ToastContainer />
      </div>
    </AdminRoute>
  );
}
