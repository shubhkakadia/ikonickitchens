"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  FileUp,
  Trash,
  X,
  File,
  AlertTriangle,
} from "lucide-react";
import Image from "next/image";
import PurchaseOrder from "../components/PurchaseOrderForm";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import DeleteConfirmation from "@/components/DeleteConfirmation";

export default function page() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mtos, setMtos] = useState([]);
  const [activeTab, setActiveTab] = useState("active");
  const [showCreatePurchaseOrderModal, setShowCreatePurchaseOrderModal] =
    useState(false);
  const [selectedSupplierForPO, setSelectedSupplierForPO] = useState(null);
  const [mtosForSelectedSupplier, setMtosForSelectedSupplier] = useState([]);
  const [preSelectedMtoId, setPreSelectedMtoId] = useState(null);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("project");
  const [sortOrder, setSortOrder] = useState("asc");
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] =
    useState(false);
  const [isExporting, setIsExporting] = useState(false);
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

  useEffect(() => {
    fetchMTOs();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) {
        setShowItemsPerPageDropdown(false);
        setShowColumnDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fetchMTOs = async () => {
    try {
      setLoading(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }
      const response = await axios.get("/api/materials_to_order/all", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.data.status) {
        // Ensure data is always an array
        const data = response.data.data || [];
        setMtos(Array.isArray(data) ? data : []);
      } else {
        setError(response.data.message || "Failed to fetch materials to order");
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to fetch materials to order"
      );
    } finally {
      setLoading(false);
    }
  };

  const openCreatePOForSupplier = (supplierName, supplierId, mtoId = null) => {
    // Build materialsToOrder list filtered to only include items from the selected supplier
    const filteredMTOs = (mtos || [])
      .map((mto) => {
        const supplierItems = (mto.items || []).filter(
          (it) =>
            (it.item?.supplier?.supplier_id || it.item?.supplier_id || null) ===
            supplierId
        );
        return { ...mto, items: supplierItems };
      })
      .filter((mto) => (mto.items || []).length > 0);

    setMtosForSelectedSupplier(filteredMTOs);
    setSelectedSupplierForPO({ name: supplierName, supplier_id: supplierId });
    setPreSelectedMtoId(mtoId);
    setShowCreatePurchaseOrderModal(true);
  };

  const filteredAndSortedMTOs = useMemo(() => {
    // Ensure mtos is always an array
    const mtosArray = Array.isArray(mtos) ? mtos : [];

    // Tab filter
    let list = mtosArray.filter((mto) =>
      activeTab === "active"
        ? mto.status === "DRAFT" || mto.status === "PARTIALLY_ORDERED"
        : mto.status === "FULLY_ORDERED" || mto.status === "CLOSED"
    );

    // Search filter (project name, lot name, status)
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((mto) => {
        const proj = (mto.project?.name || "").toLowerCase();
        const lots = (mto.lots || [])
          .map((l) => (l.name || "").toLowerCase())
          .join(" ");
        const status = (mto.status || "").toLowerCase();
        return proj.includes(q) || lots.includes(q) || status.includes(q);
      });
    }

    // Precompute counts
    const withCounts = list.map((mto) => {
      const itemsCount = mto.items?.length || 0;
      const itemsRemainingCount =
        mto.items?.filter(
          (it) => (it.quantity_ordered || 0) < (it.quantity || 0)
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
  }, [mtos, activeTab, search, sortField, sortOrder]);

  // Pagination
  const totalItems = filteredAndSortedMTOs.length;
  const totalPages =
    itemsPerPage === 0 ? 1 : Math.ceil(totalItems / itemsPerPage);
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
  };

  const getSortIcon = (field) => {
    if (sortField !== field)
      return <ArrowUpDown className="h-4 w-4 text-slate-400" />;
    if (sortOrder === "asc")
      return <ArrowUp className="h-4 w-4 text-primary" />;
    if (sortOrder === "desc")
      return <ArrowDown className="h-4 w-4 text-primary" />;
    return null;
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
    setShowItemsPerPageDropdown(false);
    setCurrentPage(1);
  };

  // Reset to first page when search or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, itemsPerPage]);

  const handleReset = () => {
    setSearch("");
    setSortField("project");
    setSortOrder("asc");
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
          : [...prev, column]
      );
    }
  };

  const handleExportToExcel = async () => {
    if (filteredAndSortedMTOs.length === 0) {
      toast.warning("No data to export.", {
        position: "top-right",
        autoClose: 3000,
      });
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
            (it) => (it.quantity_ordered || 0) < (it.quantity || 0)
          ).length ||
          0;
        const createdAtStr = mto.createdAt
          ? new Date(mto.createdAt).toLocaleString()
          : "";
        const createdByName = mto.createdBy?.employee
          ? `${mto.createdBy.employee.first_name || ""} ${mto.createdBy.employee.last_name || ""
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
            "Quantity Ordered": it.quantity_ordered ?? "",
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
      toast.error("Failed to export data to Excel.");
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

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

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
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await axios.post(
        `/api/uploads/materials-to-order/${selectedMtoForMedia.id}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.status) {
        toast.success(response.data.message || "Files uploaded successfully", {
          position: "top-right",
          autoClose: 3000,
        });
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
        toast.error(response.data.message || "Failed to upload files", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to upload files", {
        position: "top-right",
        autoClose: 3000,
      });
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
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      const response = await axios.delete(
        `/api/uploads/materials-to-order/${selectedMtoForMedia.id}?mediaId=${pendingDeleteMediaId}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (response.data.status) {
        toast.success("File deleted successfully", {
          position: "top-right",
          autoClose: 3000,
        });
        // Remove from local state
        setMediaFiles((prev) =>
          prev.filter((f) => f.id !== pendingDeleteMediaId)
        );
        // Refresh MTO list
        fetchMTOs();
        setShowDeleteMediaModal(false);
        setPendingDeleteMediaId(null);
      } else {
        toast.error(response.data.message || "Failed to delete file", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete file", {
        position: "top-right",
        autoClose: 3000,
      });
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
                    Loading materials to order details...
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
                      Materials to Order
                    </h1>
                  </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                    {/* Fixed Header Section */}
                    <div className="p-4 flex-shrink-0 border-b border-slate-200">
                      <div className="flex items-center justify-between gap-3">
                        {/* Search */}
                        <div className="flex items-center gap-2 flex-1 max-w-sm relative">
                          <Search className="h-4 w-4 absolute left-3 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search by project, lot or status"
                            className="w-full text-slate-800 p-2 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm font-normal"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>

                        {/* Reset, Sort, Export */}
                        <div className="flex items-center gap-2">
                          {(search !== "" ||
                            sortField !== "project" ||
                            sortOrder !== "asc") && (
                              <button
                                onClick={handleReset}
                                className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                              >
                                <RotateCcw className="h-4 w-4" />
                                <span>Reset</span>
                              </button>
                            )}

                          <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild>
                              <button className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium">
                                <ArrowUpDown className="h-4 w-4" />
                                <span>Sort by</span>
                              </button>
                            </DropdownMenu.Trigger>

                            <DropdownMenu.Content
                              className="w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1"
                              sideOffset={4}
                            >
                              {[
                                { key: "project", label: "Project" },
                                { key: "status", label: "Status" },
                                { key: "items", label: "Items" },
                                {
                                  key: "remaining",
                                  label: "Items Remaining",
                                },
                              ].map((opt) => (
                                <DropdownMenu.Item
                                  key={opt.key}
                                  className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between outline-none"
                                  onSelect={() => handleSort(opt.key)}
                                >
                                  {opt.label} {getSortIcon(opt.key)}
                                </DropdownMenu.Item>
                              ))}
                            </DropdownMenu.Content>
                          </DropdownMenu.Root>

                          <div className="relative dropdown-container flex items-center">
                            <button
                              onClick={handleExportToExcel}
                              disabled={
                                isExporting ||
                                filteredAndSortedMTOs.length === 0 ||
                                selectedColumns.length === 0
                              }
                              className={`flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 border-r-0 px-3 py-2 rounded-l-lg text-sm font-medium ${isExporting ||
                                filteredAndSortedMTOs.length === 0 ||
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
                                filteredAndSortedMTOs.length === 0
                              }
                              className={`flex items-center transition-all duration-200 text-slate-700 border border-slate-300 px-2 py-2 rounded-r-lg text-sm font-medium ${isExporting ||
                                filteredAndSortedMTOs.length === 0
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

                    {/* Tabs Section */}
                    <div className="px-4 flex-shrink-0 border-b border-slate-200">
                      <nav className="flex space-x-6">
                        <button
                          onClick={() => setActiveTab("active")}
                          className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "active"
                            ? "border-primary text-primary"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                        >
                          Active
                        </button>
                        <button
                          onClick={() => setActiveTab("completed")}
                          className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "completed"
                            ? "border-primary text-primary"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                        >
                          Completed
                        </button>
                      </nav>
                    </div>

                    {/* Scrollable Content Section */}
                    <div className="flex-1 overflow-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                          <tr>
                            <th
                              className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("project")}
                            >
                              <div className="flex items-center gap-2">
                                Project / Lots
                                {getSortIcon("project")}
                              </div>
                            </th>
                            <th
                              className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("items")}
                            >
                              <div className="flex items-center gap-2">
                                Items
                                {getSortIcon("items")}
                              </div>
                            </th>
                            <th
                              className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("remaining")}
                            >
                              <div className="flex items-center gap-2">
                                Items Remaining
                                {getSortIcon("remaining")}
                              </div>
                            </th>
                            <th
                              className="px-4 py-2 text-left text-sm font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("status")}
                            >
                              <div className="flex items-center gap-2">
                                Status
                                {getSortIcon("status")}
                              </div>
                            </th>
                            <th className="px-4 py-2 text-right text-sm font-semibold text-slate-600 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {paginatedMTOs.length === 0 ? (
                            <tr>
                              <td
                                className="px-4 py-10 text-sm text-slate-500 text-center"
                                colSpan={5}
                              >
                                No materials to order found
                              </td>
                            </tr>
                          ) : (
                            paginatedMTOs.map((mto) => {
                              return (
                                <React.Fragment key={mto.id}>
                                  <tr
                                    onClick={() => {
                                      if (openAccordionId === mto.id) {
                                        setOpenAccordionId(null);
                                      } else {
                                        setOpenAccordionId(mto.id);
                                      }
                                    }}
                                    className="cursor-pointer hover:bg-slate-50 transition-colors duration-200"
                                  >
                                    <td className="px-4 py-3">
                                      <div className="flex flex-row items-center gap-3">
                                        <span className="text-sm font-semibold text-gray-800 truncate">
                                          {mto.project?.name || "Project"}
                                        </span>
                                        <div className="flex flex-wrap gap-1 mt-1 md:mt-0">
                                          {mto.lots?.map((lot) => (
                                            <span
                                              key={lot.lot_id || lot.id}
                                              className="text-[10px] px-2 py-1 bg-purple-100 text-purple-800 rounded"
                                            >
                                              {lot.name}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700">
                                      {mto.__itemsCount ??
                                        (mto.items?.length || 0)}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700">
                                      {mto.__itemsRemaining ??
                                        (mto.items?.filter(
                                          (it) =>
                                            (it.quantity_ordered || 0) <
                                            (it.quantity || 0)
                                        ).length ||
                                          0)}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={`px-2 py-1 text-xs font-medium rounded ${mto.status === "DRAFT"
                                          ? "bg-yellow-100 text-yellow-800"
                                          : mto.status === "PARTIALLY_ORDERED"
                                            ? "bg-blue-100 text-blue-800"
                                            : mto.status === "FULLY_ORDERED"
                                              ? "bg-green-100 text-green-800"
                                              : "bg-gray-100 text-gray-800"
                                          }`}
                                      >
                                        {mto.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <ChevronDown
                                        className={`w-4 h-4 text-slate-500 inline-block transition-transform duration-200 ${openAccordionId === mto.id
                                          ? "rotate-180"
                                          : ""
                                          }`}
                                      />
                                    </td>
                                  </tr>

                                  {/* Accordion content */}
                                  {openAccordionId === mto.id && (
                                    <tr>
                                      <td
                                        colSpan={5}
                                        className="px-4 pb-4 border-t border-slate-200 bg-slate-50"
                                      >
                                        <div
                                          id={`mto-${mto.id}`}
                                          className="mt-2"
                                        >
                                          <div className="mb-2 p-2 bg-slate-50 rounded-lg">
                                            <div className="flex items-center gap-4 text-xs text-gray-600">
                                              <div className="flex items-center gap-1.5">
                                                <Calendar className="w-4 h-4" />
                                                <span>
                                                  <span className="font-medium">
                                                    Created:
                                                  </span>{" "}
                                                  {mto.createdAt
                                                    ? new Date(
                                                      mto.createdAt
                                                    ).toLocaleString()
                                                    : "No date"}
                                                </span>
                                              </div>
                                              {mto.notes && (
                                                <div className="flex items-center gap-1.5">
                                                  <FileText className="w-4 h-4" />
                                                  <span>
                                                    <span className="font-medium">
                                                      Notes:
                                                    </span>{" "}
                                                    {mto.notes}
                                                  </span>
                                                </div>
                                              )}
                                              <div className="flex items-center gap-1.5">
                                                <FileText className="w-4 h-4" />
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenMediaModal(mto);
                                                  }}
                                                  className="cursor-pointer text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                                                >
                                                  <span>Media Files:</span>
                                                  <span className="px-2 py-0.5 bg-primary/10 text-primary rounded">
                                                    {(mto.media || []).length}
                                                  </span>
                                                </button>
                                              </div>
                                            </div>
                                          </div>

                                          {/* Items grouped by supplier */}
                                          {!!(
                                            mto.items && mto.items.length
                                          ) && (
                                              <div className="space-y-2">
                                                {(() => {
                                                  // Group items by supplier name (Unassigned last)
                                                  const groups = new Map();
                                                  mto.items.forEach((it) => {
                                                    const supplierName =
                                                      it.item?.supplier?.name ||
                                                      "Unassigned";
                                                    if (!groups.has(supplierName))
                                                      groups.set(
                                                        supplierName,
                                                        []
                                                      );
                                                    groups
                                                      .get(supplierName)
                                                      .push(it);
                                                  });
                                                  const orderedGroupNames =
                                                    Array.from(
                                                      groups.keys()
                                                    ).sort((a, b) => {
                                                      if (
                                                        a === "Unassigned" &&
                                                        b !== "Unassigned"
                                                      )
                                                        return 1;
                                                      if (
                                                        b === "Unassigned" &&
                                                        a !== "Unassigned"
                                                      )
                                                        return -1;
                                                      return a.localeCompare(b);
                                                    });
                                                  return orderedGroupNames.map(
                                                    (name) => (
                                                      <div key={name}>
                                                        <div className="flex items-center justify-between mb-2">
                                                          <div className="text-xs font-semibold text-slate-700">
                                                            {name}
                                                          </div>
                                                          {activeTab ===
                                                            "active" &&
                                                            name !==
                                                            "Unassigned" && (
                                                              <button
                                                                type="button"
                                                                onClick={() => {
                                                                  const firstItem =
                                                                    groups.get(
                                                                      name
                                                                    )?.[0];
                                                                  const supplierId =
                                                                    firstItem
                                                                      ?.item
                                                                      ?.supplier
                                                                      ?.supplier_id ||
                                                                    firstItem
                                                                      ?.item
                                                                      ?.supplier_id ||
                                                                    null;
                                                                  if (!supplierId)
                                                                    return;
                                                                  openCreatePOForSupplier(
                                                                    name,
                                                                    supplierId,
                                                                    mto.id
                                                                  );
                                                                }}
                                                                className="cursor-pointer px-2 py-1 text-xs border border-primary text-primary rounded-md hover:bg-primary hover:text-white transition-colors"
                                                              >
                                                                <Plus className="inline w-3 h-3 mr-1" />{" "}
                                                                Create Purchase
                                                                Order
                                                              </button>
                                                            )}
                                                        </div>
                                                        <div className="overflow-x-auto">
                                                          <table className="w-full border border-slate-200 rounded-lg table-fixed">
                                                            <colgroup>
                                                              <col className="w-40" />
                                                              <col className="w-60" />
                                                              <col className="w-80" />
                                                              <col className="w-32" />
                                                              <col className="w-40" />
                                                              <col className="w-40" />
                                                            </colgroup>
                                                            <thead className="bg-slate-50">
                                                              <tr>
                                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                  Image
                                                                </th>
                                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                  Category
                                                                </th>
                                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                  Details
                                                                </th>
                                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                  In Stock
                                                                </th>
                                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                  Quantity
                                                                </th>
                                                                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                  Status
                                                                </th>
                                                              </tr>
                                                            </thead>
                                                            <tbody className="bg-white divide-y divide-slate-200">
                                                              {groups
                                                                .get(name)
                                                                .map((item) => {
                                                                  const stockOnHand =
                                                                    Number(
                                                                      item.item
                                                                        ?.quantity ??
                                                                      0
                                                                    );
                                                                  const measurementUnit =
                                                                    item.item
                                                                      ?.measurement_unit ||
                                                                    "";

                                                                  return (
                                                                    <tr
                                                                      key={
                                                                        item.id
                                                                      }
                                                                      className="hover:bg-slate-50"
                                                                    >
                                                                      <td className="px-3 py-2 whitespace-nowrap">
                                                                        <div className="flex items-center">
                                                                          {item
                                                                            .item
                                                                            ?.image
                                                                            ?.url ? (
                                                                            <Image
                                                                              loading="lazy"
                                                                              src={`/${item.item.image.url}`}
                                                                              alt={
                                                                                item
                                                                                  .item
                                                                                  ?.category
                                                                                  ? `${item.item.category} item image`
                                                                                  : item.item_id
                                                                                    ? `Item ${item.item_id} image`
                                                                                    : "Item image"
                                                                              }
                                                                              className="w-10 h-10 object-cover rounded border border-slate-200"
                                                                              width={
                                                                                40
                                                                              }
                                                                              height={
                                                                                40
                                                                              }
                                                                            />
                                                                          ) : (
                                                                            <div className="w-10 h-10 bg-slate-100 rounded border border-slate-200 flex items-center justify-center">
                                                                              <Package className="w-5 h-5 text-slate-400" />
                                                                            </div>
                                                                          )}
                                                                        </div>
                                                                      </td>
                                                                      <td className="px-3 py-2 whitespace-nowrap">
                                                                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                                                          {
                                                                            item
                                                                              .item
                                                                              ?.category
                                                                          }
                                                                        </span>
                                                                      </td>
                                                                      <td className="px-3 py-2">
                                                                        <div className="text-xs text-gray-600 space-y-1">
                                                                          {item
                                                                            .item
                                                                            ?.sheet && (
                                                                              <>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Brand:
                                                                                  </span>{" "}
                                                                                  {item
                                                                                    .item
                                                                                    .sheet
                                                                                    .brand ||
                                                                                    "-"}
                                                                                </div>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Color:
                                                                                  </span>{" "}
                                                                                  {
                                                                                    item
                                                                                      .item
                                                                                      .sheet
                                                                                      .color
                                                                                  }
                                                                                </div>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Finish:
                                                                                  </span>{" "}
                                                                                  {
                                                                                    item
                                                                                      .item
                                                                                      .sheet
                                                                                      .finish
                                                                                  }
                                                                                </div>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Face:
                                                                                  </span>{" "}
                                                                                  {item
                                                                                    .item
                                                                                    .sheet
                                                                                    .face ||
                                                                                    "-"}
                                                                                </div>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Dimensions:
                                                                                  </span>{" "}
                                                                                  {
                                                                                    item
                                                                                      .item
                                                                                      .sheet
                                                                                      .dimensions
                                                                                  }
                                                                                </div>
                                                                              </>
                                                                            )}
                                                                          {item
                                                                            .item
                                                                            ?.handle && (
                                                                              <>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Brand:
                                                                                  </span>{" "}
                                                                                  {item
                                                                                    .item
                                                                                    .handle
                                                                                    .brand ||
                                                                                    "-"}
                                                                                </div>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Color:
                                                                                  </span>{" "}
                                                                                  {
                                                                                    item
                                                                                      .item
                                                                                      .handle
                                                                                      .color
                                                                                  }
                                                                                </div>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Type:
                                                                                  </span>{" "}
                                                                                  {
                                                                                    item
                                                                                      .item
                                                                                      .handle
                                                                                      .type
                                                                                  }
                                                                                </div>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Dimensions:
                                                                                  </span>{" "}
                                                                                  {
                                                                                    item
                                                                                      .item
                                                                                      .handle
                                                                                      .dimensions
                                                                                  }
                                                                                </div>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Material:
                                                                                  </span>{" "}
                                                                                  {item
                                                                                    .item
                                                                                    .handle
                                                                                    .material ||
                                                                                    "-"}
                                                                                </div>
                                                                              </>
                                                                            )}
                                                                          {item
                                                                            .item
                                                                            ?.hardware && (
                                                                              <>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Brand:
                                                                                  </span>{" "}
                                                                                  {item
                                                                                    .item
                                                                                    .hardware
                                                                                    .brand ||
                                                                                    "-"}
                                                                                </div>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Name:
                                                                                  </span>{" "}
                                                                                  {
                                                                                    item
                                                                                      .item
                                                                                      .hardware
                                                                                      .name
                                                                                  }
                                                                                </div>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Type:
                                                                                  </span>{" "}
                                                                                  {
                                                                                    item
                                                                                      .item
                                                                                      .hardware
                                                                                      .type
                                                                                  }
                                                                                </div>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Dimensions:
                                                                                  </span>{" "}
                                                                                  {
                                                                                    item
                                                                                      .item
                                                                                      .hardware
                                                                                      .dimensions
                                                                                  }
                                                                                </div>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Sub
                                                                                    Category:
                                                                                  </span>{" "}
                                                                                  {
                                                                                    item
                                                                                      .item
                                                                                      .hardware
                                                                                      .sub_category
                                                                                  }
                                                                                </div>
                                                                              </>
                                                                            )}
                                                                          {item
                                                                            .item
                                                                            ?.accessory && (
                                                                              <>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Name:
                                                                                  </span>{" "}
                                                                                  {
                                                                                    item
                                                                                      .item
                                                                                      .accessory
                                                                                      .name
                                                                                  }
                                                                                </div>
                                                                              </>
                                                                            )}
                                                                          {item
                                                                            .item
                                                                            ?.edging_tape && (
                                                                              <>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Brand:
                                                                                  </span>{" "}
                                                                                  {item
                                                                                    .item
                                                                                    .edging_tape
                                                                                    .brand ||
                                                                                    "-"}
                                                                                </div>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Color:
                                                                                  </span>{" "}
                                                                                  {item
                                                                                    .item
                                                                                    .edging_tape
                                                                                    .color ||
                                                                                    "-"}
                                                                                </div>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Finish:
                                                                                  </span>{" "}
                                                                                  {item
                                                                                    .item
                                                                                    .edging_tape
                                                                                    .finish ||
                                                                                    "-"}
                                                                                </div>
                                                                                <div>
                                                                                  <span className="font-medium">
                                                                                    Dimensions:
                                                                                  </span>{" "}
                                                                                  {item
                                                                                    .item
                                                                                    .edging_tape
                                                                                    .dimensions ||
                                                                                    "-"}
                                                                                </div>
                                                                              </>
                                                                            )}
                                                                        </div>
                                                                      </td>
                                                                      <td className="px-3 py-2 whitespace-nowrap">
                                                                        <div className="text-xs">
                                                                          <div className="font-semibold text-green-600">
                                                                            {
                                                                              stockOnHand
                                                                            }{" "}
                                                                            {
                                                                              measurementUnit
                                                                            }
                                                                          </div>
                                                                          <div className="text-[11px] text-slate-500">
                                                                            in
                                                                            stock
                                                                          </div>
                                                                        </div>
                                                                      </td>
                                                                      <td className="px-3 py-2 whitespace-nowrap">
                                                                        <div className="text-xs text-gray-600">
                                                                          <div className="flex items-center gap-1.5 mb-1">
                                                                            <Package className="w-4 h-4 text-gray-500" />
                                                                            <span>
                                                                              <span className="font-medium">
                                                                                Qty:
                                                                              </span>{" "}
                                                                              {
                                                                                item.quantity
                                                                              }{" "}
                                                                              {
                                                                                item
                                                                                  .item
                                                                                  ?.measurement_unit
                                                                              }
                                                                            </span>
                                                                          </div>
                                                                          {item.quantity_ordered >
                                                                            0 && (
                                                                              <div className="flex items-center gap-1.5 text-blue-600 text-xs">
                                                                                <span>
                                                                                  Ordered:{" "}
                                                                                  {
                                                                                    item.quantity_ordered
                                                                                  }
                                                                                </span>
                                                                              </div>
                                                                            )}
                                                                          {item.quantity_received >
                                                                            0 && (
                                                                              <div className="flex items-center gap-1.5 text-green-600 text-xs">
                                                                                <span>
                                                                                  Received:{" "}
                                                                                  {
                                                                                    item.quantity_received
                                                                                  }
                                                                                </span>
                                                                              </div>
                                                                            )}
                                                                        </div>
                                                                      </td>
                                                                      <td className="px-3 py-2 whitespace-nowrap">
                                                                        {item.quantity_ordered >
                                                                          0 && (
                                                                            <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                                                              Ordered
                                                                            </span>
                                                                          )}
                                                                        {item.quantity_received >
                                                                          0 && (
                                                                            <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                                                                              Received
                                                                            </span>
                                                                          )}
                                                                        {item.quantity_ordered ===
                                                                          0 &&
                                                                          item.quantity_received ===
                                                                          0 && (
                                                                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                                                                              Pending
                                                                            </span>
                                                                          )}
                                                                      </td>
                                                                    </tr>
                                                                  );
                                                                })}
                                                            </tbody>
                                                          </table>
                                                        </div>
                                                      </div>
                                                    )
                                                  );
                                                })()}
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

                    {/* Fixed Pagination Footer */}
                    {paginatedMTOs.length > 0 && (
                      <div className="px-4 py-3 flex-shrink-0 border-t border-slate-200 bg-slate-50">
                        <div className="flex items-center justify-between">
                          {/* Items per page */}
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-600 font-medium">
                                Showing
                              </span>
                              <div className="relative dropdown-container">
                                <button
                                  onClick={() =>
                                    setShowItemsPerPageDropdown(
                                      !showItemsPerPageDropdown
                                    )
                                  }
                                  className="cursor-pointer flex items-center gap-2 px-2 py-1 text-sm border border-slate-300 rounded-lg hover:bg-white transition-colors duration-200 bg-white font-medium"
                                >
                                  <span>
                                    {itemsPerPage === 0 ? "All" : itemsPerPage}
                                  </span>
                                  <ChevronDown className="h-4 w-4" />
                                </button>
                                {showItemsPerPageDropdown && (
                                  <div className="absolute bottom-full left-0 mb-1 w-20 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                                    <div className="py-1">
                                      {[25, 50, 100, 0].map((value) => (
                                        <button
                                          key={value}
                                          onClick={() =>
                                            handleItemsPerPageChange(value)
                                          }
                                          className="cursor-pointer w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                        >
                                          {value === 0 ? "All" : value}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <span className="text-sm text-slate-600 font-medium">
                                of {totalItems} results
                              </span>
                            </div>
                          </div>

                          {/* Pagination buttons */}
                          {itemsPerPage > 0 && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                              >
                                <ChevronsLeft className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() =>
                                  setCurrentPage((p) => Math.max(1, p - 1))
                                }
                                disabled={currentPage === 1}
                                className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <div className="flex items-center gap-1">
                                {Array.from(
                                  { length: Math.min(5, totalPages) },
                                  (_, i) => {
                                    let pageNum;
                                    if (totalPages <= 5) pageNum = i + 1;
                                    else if (currentPage <= 3) pageNum = i + 1;
                                    else if (currentPage >= totalPages - 2)
                                      pageNum = totalPages - 4 + i;
                                    else pageNum = currentPage - 2 + i;
                                    return (
                                      <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`cursor-pointer px-3 py-1 text-sm rounded-lg transition-colors duration-200 font-medium ${currentPage === pageNum
                                          ? "bg-primary text-white shadow-sm"
                                          : "text-slate-600 hover:bg-white"
                                          }`}
                                      >
                                        {pageNum}
                                      </button>
                                    );
                                  }
                                )}
                              </div>
                              <button
                                onClick={() =>
                                  setCurrentPage((p) =>
                                    Math.min(totalPages, p + 1)
                                  )
                                }
                                disabled={currentPage === totalPages}
                                className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                              >
                                <ChevronsRight className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {showCreatePurchaseOrderModal && selectedSupplierForPO && (
        <PurchaseOrder
          materialsToOrder={mtosForSelectedSupplier}
          supplier={selectedSupplierForPO}
          setShowCreatePurchaseOrderModal={setShowCreatePurchaseOrderModal}
          fetchMaterialsToOrder={fetchMTOs}
          selectedMtoId={preSelectedMtoId}
        />
      )}

      {/* Media Files Modal */}
      {showMediaModal && selectedMtoForMedia && (
        <div className="fixed inset-0 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col relative z-50">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Media Files - {selectedMtoForMedia.project?.name || "Project"}
              </h2>
              <button
                onClick={handleCloseMediaModal}
                className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Display Existing Files First */}
              {(() => {
                // Categorize files by type
                const categorizeFiles = () => {
                  const images = [];
                  const videos = [];
                  const pdfs = [];
                  const others = [];

                  mediaFiles.forEach((file) => {
                    if (
                      file.mime_type?.includes("image") ||
                      file.file_type === "image"
                    ) {
                      images.push(file);
                    } else if (
                      file.mime_type?.includes("video") ||
                      file.file_type === "video"
                    ) {
                      videos.push(file);
                    } else if (
                      file.mime_type?.includes("pdf") ||
                      file.file_type === "pdf" ||
                      file.extension === "pdf"
                    ) {
                      pdfs.push(file);
                    } else {
                      others.push(file);
                    }
                  });

                  return { images, videos, pdfs, others };
                };

                const { images, videos, pdfs, others } = categorizeFiles();

                // File Category Section Component
                const FileCategorySection = ({
                  title,
                  files,
                  isSmall = false,
                  sectionKey,
                }) => {
                  if (files.length === 0) return null;

                  const isExpanded = expandedSections[sectionKey];

                  return (
                    <div className="mb-4">
                      {/* Category Header with Toggle */}
                      <button
                        onClick={() => toggleSection(sectionKey)}
                        className="w-full flex items-center justify-between text-sm font-semibold text-slate-700 mb-3 hover:text-slate-900 transition-colors"
                      >
                        <span>
                          {title} ({files.length})
                        </span>
                        <div
                          className={`transform transition-transform duration-200 ${isExpanded ? "rotate-180" : ""
                            }`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </div>
                      </button>

                      {/* Collapsible Content */}
                      {isExpanded && (
                        <div className="flex flex-wrap gap-3">
                          {files.map((file) => (
                            <div
                              key={file.id}
                              onClick={() => handleViewExistingFile(file)}
                              title="Click to view file"
                              className={`cursor-pointer relative bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md transition-all group ${isSmall ? "w-32" : "w-40"
                                }`}
                            >
                              {/* File Preview */}
                              <div
                                className={`w-full ${isSmall ? "aspect-[4/3]" : "aspect-square"
                                  } rounded-lg flex items-center justify-center mb-2 overflow-hidden bg-slate-50`}
                              >
                                {file.mime_type?.includes("image") ||
                                  file.file_type === "image" ? (
                                  <Image
                                    height={100}
                                    width={100}
                                    src={`/${file.url}`}
                                    alt={file.filename || "Media file image"}
                                    className="w-full h-full object-cover rounded-lg"
                                  />
                                ) : file.mime_type?.includes("video") ||
                                  file.file_type === "video" ? (
                                  <video
                                    src={`/${file.url}`}
                                    className="w-full h-full object-cover rounded-lg"
                                    muted
                                    playsInline
                                  />
                                ) : (
                                  <div
                                    className={`w-full h-full flex items-center justify-center rounded-lg ${file.mime_type?.includes("pdf") ||
                                      file.file_type === "pdf" ||
                                      file.extension === "pdf"
                                      ? "bg-red-50"
                                      : "bg-green-50"
                                      }`}
                                  >
                                    {file.mime_type?.includes("pdf") ||
                                      file.file_type === "pdf" ||
                                      file.extension === "pdf" ? (
                                      <FileText
                                        className={`${isSmall ? "w-6 h-6" : "w-8 h-8"
                                          } text-red-600`}
                                      />
                                    ) : (
                                      <File
                                        className={`${isSmall ? "w-6 h-6" : "w-8 h-8"
                                          } text-green-600`}
                                      />
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* File Info */}
                              <div className="space-y-1">
                                <p
                                  className="text-xs font-medium text-slate-700 truncate"
                                  title={file.filename}
                                >
                                  {file.filename}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {formatFileSize(file.size || 0)}
                                </p>
                              </div>

                              {/* Delete Button */}
                              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteMedia(file.id);
                                  }}
                                  disabled={deletingMediaId === file.id}
                                  className="p-1.5 cursor-pointer bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                                  title="Delete file"
                                >
                                  {deletingMediaId === file.id ? (
                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                                  ) : (
                                    <Trash className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-slate-700 mb-4">
                      Uploaded Files
                    </h3>

                    {mediaFiles.length > 0 ? (
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        {/* Images Section */}
                        <FileCategorySection
                          title="Images"
                          files={images}
                          isSmall={false}
                          sectionKey="images"
                        />

                        {/* Videos Section */}
                        <FileCategorySection
                          title="Videos"
                          files={videos}
                          isSmall={false}
                          sectionKey="videos"
                        />

                        {/* PDFs Section - Smaller cards */}
                        <FileCategorySection
                          title="PDFs"
                          files={pdfs}
                          isSmall={true}
                          sectionKey="pdfs"
                        />

                        {/* Other Files Section - Smaller cards */}
                        <FileCategorySection
                          title="Other Files"
                          files={others}
                          isSmall={true}
                          sectionKey="others"
                        />
                      </div>
                    ) : (
                      <div className="bg-slate-50 rounded-lg p-8 border border-slate-200 text-center">
                        <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                        <p className="text-slate-600">No files uploaded yet</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Upload New Files Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-700">
                  Upload New Files
                </h3>

                {/* File Upload Area */}
                <div className="relative">
                  <label className="block text-sm font-medium text-slate-600 mb-2">
                    Select Files {uploadingMedia && "(Uploading...)"}
                  </label>
                  <div
                    className={`border-2 border-dashed border-slate-300 hover:border-secondary rounded-lg transition-all duration-200 bg-slate-50 hover:bg-slate-100 ${uploadingMedia ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                  >
                    <input
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
                        <>
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-3"></div>
                          <p className="text-sm font-medium text-slate-700 mb-1">
                            Uploading files...
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mb-3">
                            <FileUp className="w-6 h-6 text-secondary" />
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
        heading="Media File"
        message="This will permanently delete the media file. This action cannot be undone."
        isDeleting={deletingMediaId !== null}
      />
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </AdminRoute>
  );
}
