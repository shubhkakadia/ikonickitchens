"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  NotebookText,
  User,
  X,
  Check,
  Upload,
  Trash2,
} from "lucide-react";
import { pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function page() {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pos, setPos] = useState([]);
  const [activeTab, setActiveTab] = useState("active");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortOrder, setSortOrder] = useState("desc");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] =
    useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showMaterialsReceivedModal, setShowMaterialsReceivedModal] =
    useState(false);
  const [selectedPOId, setSelectedPOId] = useState("");
  const [selectedPO, setSelectedPO] = useState(null);
  const [quantityReceived, setQuantityReceived] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [poSearchTerm, setPoSearchTerm] = useState("");
  const [isPODropdownOpen, setIsPODropdownOpen] = useState(false);
  const poDropdownRef = useRef(null);
  const poInputRef = useRef(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  // Invoice preview
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [selectedInvoiceFile, setSelectedInvoiceFile] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  // Invoice upload
  const [uploadingInvoicePOId, setUploadingInvoicePOId] = useState(null);
  // Invoice delete
  const [deletingInvoicePOId, setDeletingInvoicePOId] = useState(null);
  const [showDeleteInvoiceModal, setShowDeleteInvoiceModal] = useState(false);
  const [invoicePendingDelete, setInvoicePendingDelete] = useState(null);
  const invoiceFileInputRefs = useRef({});

  const formatMoney = (value) => {
    const num = Number(value || 0);
    if (Number.isNaN(num)) return "0.00";
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  useEffect(() => {
    fetchPOs();
  }, []);

  const fetchPOs = async () => {
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
      const response = await axios.get("/api/purchase_order/all", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (response.data.status) {
        setPos(response.data.data || []);
      } else {
        setError(response.data.message || "Failed to fetch purchase orders");
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || "Failed to fetch purchase orders"
      );
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedPOs = useMemo(() => {
    let list = (pos || []).filter((po) =>
      activeTab === "active"
        ? po.status === "DRAFT" ||
          po.status === "ORDERED" ||
          po.status === "PARTIALLY_RECEIVED"
        : po.status === "FULLY_RECEIVED" || po.status === "CANCELLED"
    );

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

    const withCounts = list.map((po) => {
      const itemsCount = po.items?.length || 0;
      const totalQty = (po.items || []).reduce(
        (sum, it) => sum + (parseFloat(it.quantity) || 0),
        0
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
  }, [pos, activeTab, search, sortField, sortOrder]);

  // Pagination
  const totalItems = filteredAndSortedPOs.length;
  const totalPages =
    itemsPerPage === 0 ? 1 : Math.ceil(totalItems / itemsPerPage);
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

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    if (sortOrder === "asc") return <ArrowUp className="h-4 w-4" />;
    if (sortOrder === "desc") return <ArrowDown className="h-4 w-4" />;
    return null;
  };

  const handleItemsPerPageChange = (value) => {
    setItemsPerPage(value);
    setShowItemsPerPageDropdown(false);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setSearch("");
    setSortField("date");
    setSortOrder("desc");
    setCurrentPage(1);
  };

  const activePOs = useMemo(() => {
    return (pos || []).filter(
      (po) =>
        po.status === "DRAFT" ||
        po.status === "ORDERED" ||
        po.status === "PARTIALLY_RECEIVED"
    );
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

  // Close dropdown when clicking outside and update position
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is outside the input and dropdown
      const isClickOnInput = poInputRef.current?.contains(event.target);
      const isClickOnDropdown = event.target.closest(
        '[data-dropdown="po-dropdown"]'
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
    if (!selectedPOId || !selectedPO) {
      toast.error("Please select a purchase order", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    // Validate quantities - new delivery should not exceed remaining
    const hasInvalidQuantity = selectedPO.items?.some((item) => {
      const newDelivery = quantityReceived[item.id] || 0;
      const remaining = getRemaining(item);
      return newDelivery > remaining;
    });

    if (hasInvalidQuantity) {
      toast.error("New delivery quantity cannot exceed remaining quantity", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    // Filter items with new delivery quantity > 0
    const itemsToProcess = selectedPO.items.filter((item) => {
      const newDelivery = quantityReceived[item.id] || 0;
      return newDelivery > 0 && (item.item?.item_id || item.item_id);
    });

    if (itemsToProcess.length === 0) {
      toast.warning("No items with new delivery quantities to process", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      // Create stock transactions for each item with new delivery
      const transactionPromises = itemsToProcess.map((item) => {
        const newDelivery = parseFloat(quantityReceived[item.id] || 0);
        const itemId = item.item?.item_id || item.item_id;
        
        if (!itemId) {
          return Promise.reject(new Error("Missing item_id"));
        }
        
        return axios.post(
          `/api/stock_transaction/create`,
          {
            item_id: itemId,
            quantity: newDelivery,
            type: "ADDED",
            purchase_order_id: selectedPOId,
          },
          {
            headers: { Authorization: `Bearer ${sessionToken}` },
          }
        );
      });

      // Execute all transactions in parallel with better error handling
      const results = await Promise.allSettled(transactionPromises);
      
      // Process results
      const responses = results.map((result) => {
        if (result.status === "fulfilled") {
          return result.value;
        } else {
          return {
            data: {
              status: false,
              message: result.reason?.response?.data?.message || result.reason?.message || "Transaction failed",
            },
          };
        }
      });

      // Check if all transactions succeeded
      const allSucceeded = responses.every((res) => res.data?.status);
      const failedCount = responses.filter((res) => !res.data?.status).length;

      if (allSucceeded) {
        toast.success(
          `Materials received updated successfully for ${itemsToProcess.length} item(s)`,
          {
            position: "top-right",
            autoClose: 3000,
          }
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
          `Failed to update ${failedCount} of ${itemsToProcess.length} item(s)`,
          {
            position: "top-right",
            autoClose: 3000,
          }
        );
        // Still refresh to show partial updates
        fetchPOs();
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to update received quantities",
        {
          position: "top-right",
          autoClose: 3000,
        }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInvoiceUpload = async (poId, file) => {
    if (!file) {
      toast.error("Please select a file to upload", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    setUploadingInvoicePOId(poId);
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
      formData.append("invoice", file);

      const response = await axios.patch(
        `/api/purchase_order/${poId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (response.data.status) {
        toast.success("Invoice uploaded successfully", {
          position: "top-right",
          autoClose: 3000,
        });
        // Clear the file input
        if (invoiceFileInputRefs.current[poId]) {
          invoiceFileInputRefs.current[poId].value = "";
        }
        // Refresh the PO list
        fetchPOs();
      } else {
        toast.error(response.data.message || "Failed to upload invoice", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to upload invoice", {
        position: "top-right",
        autoClose: 3000,
      });
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
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      const response = await axios.patch(
        `/api/purchase_order/${invoicePendingDelete}`,
        { invoice_url: null },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status) {
        toast.success("Invoice deleted successfully", {
          position: "top-right",
          autoClose: 3000,
        });
        // Refresh the PO list
        fetchPOs();
        setShowDeleteInvoiceModal(false);
        setInvoicePendingDelete(null);
      } else {
        toast.error(response.data.message || "Failed to delete invoice", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete invoice", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setDeletingInvoicePOId(null);
    }
  };

  const handleInvoiceDeleteCancel = () => {
    setShowDeleteInvoiceModal(false);
    setInvoicePendingDelete(null);
  };

  const handleExportToExcel = async () => {
    if (filteredAndSortedPOs.length === 0) {
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
          const imageUrl = item.image ? `${origin}/${item.image}` : "";
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
          return {
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
            "Unit Price": it.unit_price ?? "",
            Total: (
              parseFloat(it.quantity || 0) * parseFloat(it.unit_price || 0)
            ).toFixed(2),
          };
        });

        if (rows.length === 0) {
          rows.push({
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
            "Unit Price": "",
            Total: "",
          });
        }
        return rows;
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws["!cols"] = [
        { wch: 16 }, // Order No
        { wch: 24 }, // Supplier
        { wch: 12 }, // Status
        { wch: 20 }, // Created At
        { wch: 14 }, // Ordered At
        { wch: 22 }, // Ordered By
        { wch: 30 }, // Notes
        { wch: 28 }, // Image URL
        { wch: 12 }, // Sheet Color
        { wch: 12 }, // Sheet Finish
        { wch: 10 }, // Sheet Face
        { wch: 18 }, // Sheet Dimensions
        { wch: 12 }, // Handle Color
        { wch: 12 }, // Handle Type
        { wch: 18 }, // Handle Dimensions
        { wch: 16 }, // Handle Material
        { wch: 16 }, // Hardware Name
        { wch: 12 }, // Hardware Type
        { wch: 18 }, // Hardware Dimensions
        { wch: 18 }, // Hardware Sub Category
        { wch: 16 }, // Accessory Name
        { wch: 12 }, // Category
        { wch: 10 }, // Quantity
        { wch: 12 }, // Unit Price
        { wch: 12 }, // Total
      ];
      XLSX.utils.book_append_sheet(wb, ws, "PurchaseOrders");
      const currentDate = new Date().toISOString().split("T")[0];
      const filename = `purchase_orders_${currentDate}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`Exported ${exportData.length} rows to ${filename}`);
    } catch (err) {
      toast.error("Failed to export data to Excel.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AdminRoute>
      <div className="flex h-screen bg-tertiary">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CRMLayout />
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
                  <p className="text-slate-600">Loading purchase orders...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="h-12 w-12 text-red-500 mx-auto mb-4">⚠️</div>
                  <p className="text-red-600 mb-4">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="cursor-pointer px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-2">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-slate-600">
                    Purchase Orders
                  </h1>
                </div>

                <div className="mt-4 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-6">
                    {/* Search */}
                    <div className="flex items-center gap-2 w-[500px] relative">
                      <Search className="h-5 w-5 absolute left-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by order no, supplier or status"
                        className="w-full text-slate-800 p-3 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>

                    {/* Reset, Sort, Export */}
                    <div className="flex items-center gap-3">
                      {(search !== "" ||
                        sortField !== "date" ||
                        sortOrder !== "desc") && (
                        <button
                          onClick={handleReset}
                          className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-600 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium"
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span>Reset</span>
                        </button>
                      )}

                      <div className="relative dropdown-container">
                        <button
                          onClick={() => setShowSortDropdown(!showSortDropdown)}
                          className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-600 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium"
                        >
                          <ArrowUpDown className="h-4 w-4" />
                          <span>Sort by</span>
                        </button>
                        {showSortDropdown && (
                          <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                            <div className="py-1">
                              {[
                                { key: "date", label: "Date" },
                                { key: "order", label: "Order No" },
                                { key: "supplier", label: "Supplier" },
                                { key: "status", label: "Status" },
                                { key: "items", label: "Items" },
                                { key: "total", label: "Total" },
                              ].map((opt) => (
                                <button
                                  key={opt.key}
                                  onClick={() => handleSort(opt.key)}
                                  className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                >
                                  {opt.label} {getSortIcon(opt.key)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setShowMaterialsReceivedModal(true)}
                        className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-600 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium"
                      >
                        <Package className="h-4 w-4" />
                        <span>Materials Received</span>
                      </button>

                      <button
                        onClick={handleExportToExcel}
                        disabled={
                          isExporting || filteredAndSortedPOs.length === 0
                        }
                        className={`flex items-center gap-2 transition-all duration-200 text-slate-600 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium ${
                          isExporting || filteredAndSortedPOs.length === 0
                            ? "opacity-50 cursor-not-allowed"
                            : "cursor-pointer hover:bg-slate-100"
                        }`}
                      >
                        <Sheet className="h-4 w-4" />
                        <span>
                          {isExporting ? "Exporting..." : "Export to Excel"}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg">
                    {/* Sub-tabs */}
                    <div className="border-b border-slate-200 mb-2 flex items-center justify-between px-4">
                      <nav className="flex space-x-6">
                        <button
                          onClick={() => setActiveTab("active")}
                          className={`cursor-pointer py-3 px-1 border-b-2 font-medium text-sm ${
                            activeTab === "active"
                              ? "border-primary text-primary"
                              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                          }`}
                        >
                          Active
                        </button>
                        <button
                          onClick={() => setActiveTab("completed")}
                          className={`cursor-pointer py-3 px-1 border-b-2 font-medium text-sm ${
                            activeTab === "completed"
                              ? "border-primary text-primary"
                              : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                          }`}
                        >
                          Completed
                        </button>
                      </nav>
                    </div>

                    {/* Header */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 border-t border-b border-slate-200 text-xs font-medium text-slate-600 uppercase tracking-wider">
                      <div className="col-span-3">Order / Supplier</div>
                      <div className="col-span-2">Date</div>
                      <div className="col-span-2">Items</div>
                      <div className="col-span-2">Total</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-1 text-right">Actions</div>
                    </div>

                    {/* Rows */}
                    <div className="space-y-2">
                      {paginatedPOs.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                          No purchase orders found
                        </div>
                      ) : (
                        paginatedPOs.map((po) => {
                          return (
                            <div
                              key={po.id}
                              className="border border-slate-200 rounded-lg overflow-hidden"
                            >
                              <button
                                onClick={() => {
                                  const element = document.getElementById(
                                    `po-${po.id}`
                                  );
                                  if (element)
                                    element.classList.toggle("hidden");
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                              >
                                <div className="grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-3 flex flex-col">
                                    <span className="text-sm font-semibold text-gray-800 truncate">
                                      {po.order_no}
                                    </span>
                                    <span className="text-xs text-slate-600 truncate">
                                      {po.supplier?.name || "-"}
                                    </span>
                                  </div>
                                  <div className="col-span-2 text-sm text-slate-700">
                                    {po.ordered_at
                                      ? `Ordered: ${new Date(
                                          po.ordered_at
                                        ).toLocaleDateString()}`
                                      : `Created: ${
                                          po.createdAt
                                            ? new Date(
                                                po.createdAt
                                              ).toLocaleDateString()
                                            : "-"
                                        }`}
                                  </div>
                                  <div className="col-span-2 text-sm text-slate-700">
                                    {(po.items || []).reduce(
                                      (sum, it) =>
                                        sum + (parseFloat(it.quantity) || 0),
                                      0
                                    )}
                                  </div>
                                  <div className="col-span-2 text-sm text-slate-700">
                                    ${formatMoney(po.total_amount)}
                                  </div>
                                  <div className="col-span-2">
                                    <span
                                      className={`px-2 py-1 text-xs font-medium rounded ${
                                        po.status === "DRAFT"
                                          ? "bg-yellow-100 text-yellow-800"
                                          : po.status === "ORDERED"
                                          ? "bg-blue-100 text-blue-800"
                                          : po.status === "PARTIALLY_RECEIVED"
                                          ? "bg-purple-100 text-purple-800"
                                          : po.status === "FULLY_RECEIVED"
                                          ? "bg-green-100 text-green-800"
                                          : po.status === "CANCELLED"
                                          ? "bg-red-100 text-red-800"
                                          : "bg-gray-100 text-gray-800"
                                      }`}
                                    >
                                      {po.status}
                                    </span>
                                  </div>
                                  <div className="col-span-1 text-right">
                                    <ChevronDown className="w-5 h-5 text-slate-500 inline-block" />
                                  </div>
                                </div>
                              </button>

                              {/* Accordion content */}
                              <div
                                id={`po-${po.id}`}
                                className="hidden px-4 pb-4 border-t border-slate-100"
                              >
                                <div className="mt-4">
                                  <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                                    <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                                      <div className="flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4" />
                                        <span>
                                          <span className="font-medium">
                                            Created:
                                          </span>{" "}
                                          {po.createdAt
                                            ? new Date(
                                                po.createdAt
                                              ).toLocaleString()
                                            : "No date"}
                                        </span>
                                      </div>
                                      {po.ordered_at && (
                                        <div className="flex items-center gap-1.5">
                                          <Calendar className="w-4 h-4" />
                                          <span>
                                            <span className="font-medium">
                                              Ordered:
                                            </span>{" "}
                                            {new Date(
                                              po.ordered_at
                                            ).toLocaleDateString()}
                                          </span>
                                        </div>
                                      )}
                                      {po.total_amount && (
                                        <div className="flex items-center gap-1.5">
                                          <FileText className="w-4 h-4" />
                                          <span>
                                            <span className="font-medium">
                                              Total:
                                            </span>{" "}
                                            <span className="font-semibold">
                                              ${formatMoney(po.total_amount)}
                                            </span>
                                          </span>
                                        </div>
                                      )}
                                      {po.mto?.project && (
                                        <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-700 rounded border border-slate-200">
                                          Project: {po.mto.project.project_id} -{" "}
                                          {po.mto.project.name}
                                        </span>
                                      )}
                                      {po.orderedBy?.employee && (
                                        <div className="flex items-center gap-1.5">
                                          <User className="w-4 h-4" />
                                          <span>
                                            <span className="font-medium">
                                              Ordered by:
                                            </span>{" "}
                                            {po.orderedBy.employee.first_name}{" "}
                                            {po.orderedBy.employee.last_name}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    {po.notes && (
                                      <div className="mt-3 flex items-start gap-2 text-sm text-gray-600">
                                        <NotebookText className="w-4 h-4 mt-0.5" />
                                        <span>
                                          <span className="font-medium">
                                            Notes:
                                          </span>{" "}
                                          {po.notes}
                                        </span>
                                      </div>
                                    )}
                                    {/* Invoice Section */}
                                    {po.invoice_url ? (
                                      <div className="mt-3">
                                        <div className="border border-slate-200 rounded-lg p-3 flex items-center justify-between bg-white">
                                          <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded flex items-center justify-center">
                                              <FileText className="w-5 h-5 text-slate-500" />
                                            </div>
                                            <div className="min-w-0">
                                              <div className="text-sm font-medium text-gray-800 truncate">
                                                {po.invoice_url.filename ||
                                                  "Invoice"}
                                              </div>
                                              <div className="text-xs text-slate-500 truncate">
                                                {po.invoice_url.mime_type ||
                                                  po.invoice_url.extension}
                                              </div>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedInvoiceFile({
                                                  name:
                                                    po.invoice_url.filename ||
                                                    "Invoice",
                                                  url: po.invoice_url.url,
                                                  type:
                                                    po.invoice_url.mime_type ||
                                                    (po.invoice_url.extension
                                                      ? `application/${po.invoice_url.extension}`
                                                      : "application/pdf"),
                                                  size:
                                                    po.invoice_url.size || 0,
                                                  isExisting: true,
                                                });
                                                setShowInvoicePreview(true);
                                              }}
                                              className="cursor-pointer px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm text-slate-700"
                                            >
                                              View
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleInvoiceDelete(po.id);
                                              }}
                                              disabled={
                                                deletingInvoicePOId === po.id
                                              }
                                              className={`cursor-pointer px-3 py-1.5 border border-red-300 rounded-lg hover:bg-red-50 text-sm text-red-700 flex items-center gap-1.5 ${
                                                deletingInvoicePOId === po.id
                                                  ? "opacity-50 cursor-not-allowed"
                                                  : ""
                                              }`}
                                            >
                                              {deletingInvoicePOId === po.id ? (
                                                <>
                                                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-red-600"></div>
                                                  <span>Deleting...</span>
                                                </>
                                              ) : (
                                                <>
                                                  <Trash2 className="w-4 h-4" />
                                                  <span>Delete</span>
                                                </>
                                              )}
                                            </button>
                                            <a
                                              href={po.invoice_url.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="cursor-pointer px-3 py-1.5 bg-primary/80 hover:bg-primary text-white rounded-lg text-sm"
                                            >
                                              Download
                                            </a>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="mt-3">
                                        <div className="border border-slate-200 rounded-lg p-3 bg-white">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                              <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded flex items-center justify-center">
                                                <FileText className="w-5 h-5 text-slate-400" />
                                              </div>
                                              <div>
                                                <div className="text-sm font-medium text-gray-800">
                                                  No invoice uploaded
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                  Upload an invoice file for
                                                  this purchase order
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
                                                onChange={(e) => {
                                                  e.stopPropagation();
                                                  handleInvoiceFileChange(
                                                    po.id,
                                                    e
                                                  );
                                                }}
                                                className="hidden"
                                                id={`invoice-upload-${po.id}`}
                                                disabled={
                                                  uploadingInvoicePOId === po.id
                                                }
                                              />
                                              <label
                                                htmlFor={`invoice-upload-${po.id}`}
                                                className={`cursor-pointer px-3 py-1.5 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm text-slate-700 flex items-center gap-2 ${
                                                  uploadingInvoicePOId === po.id
                                                    ? "opacity-50 cursor-not-allowed"
                                                    : ""
                                                }`}
                                                onClick={(e) =>
                                                  e.stopPropagation()
                                                }
                                              >
                                                {uploadingInvoicePOId ===
                                                po.id ? (
                                                  <>
                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600"></div>
                                                    <span>Uploading...</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Upload className="w-4 h-4" />
                                                    <span>Upload Invoice</span>
                                                  </>
                                                )}
                                              </label>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Items table */}
                                  {po.items && po.items.length > 0 && (
                                    <div className="overflow-x-auto">
                                      <table className="w-full border border-slate-200 rounded-lg">
                                        <thead className="bg-slate-50">
                                          <tr>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                              Image
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                              Category
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                              Details
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                              Quantity
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                              Received
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                              Unit Price
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                              Total
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-slate-200">
                                          {po.items.map((item) => (
                                            <tr
                                              key={item.id}
                                              className="hover:bg-slate-50"
                                            >
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center">
                                                  {item.item?.image ? (
                                                    <img
                                                      src={`/${item.item.image}`}
                                                      alt={item.item.item_id}
                                                      className="w-12 h-12 object-cover rounded border border-slate-200"
                                                      onError={(e) => {
                                                        e.target.style.display =
                                                          "none";
                                                        e.target.nextSibling.style.display =
                                                          "flex";
                                                      }}
                                                    />
                                                  ) : null}
                                                  <div
                                                    className={`w-12 h-12 bg-slate-100 rounded border border-slate-200 flex items-center justify-center ${
                                                      item.item?.image
                                                        ? "hidden"
                                                        : "flex"
                                                    }`}
                                                  >
                                                    <Package className="w-6 h-6 text-slate-400" />
                                                  </div>
                                                </div>
                                              </td>
                                              <td className="px-4 py-3">
                                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                                  {item.item?.category || "-"}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3">
                                                <div className="text-sm text-gray-600 space-y-1">
                                                  {item.item?.sheet && (
                                                    <>
                                                      <div>
                                                        <span className="font-medium">
                                                          Color:
                                                        </span>{" "}
                                                        {item.item.sheet.color}
                                                      </div>
                                                      <div>
                                                        <span className="font-medium">
                                                          Finish:
                                                        </span>{" "}
                                                        {item.item.sheet.finish}
                                                      </div>
                                                      <div>
                                                        <span className="font-medium">
                                                          Face:
                                                        </span>{" "}
                                                        {item.item.sheet.face ||
                                                          "-"}
                                                      </div>
                                                      <div>
                                                        <span className="font-medium">
                                                          Dimensions:
                                                        </span>{" "}
                                                        {
                                                          item.item.sheet
                                                            .dimensions
                                                        }
                                                      </div>
                                                    </>
                                                  )}
                                                  {item.item?.handle && (
                                                    <>
                                                      <div>
                                                        <span className="font-medium">
                                                          Color:
                                                        </span>{" "}
                                                        {item.item.handle.color}
                                                      </div>
                                                      <div>
                                                        <span className="font-medium">
                                                          Type:
                                                        </span>{" "}
                                                        {item.item.handle.type}
                                                      </div>
                                                      <div>
                                                        <span className="font-medium">
                                                          Dimensions:
                                                        </span>{" "}
                                                        {
                                                          item.item.handle
                                                            .dimensions
                                                        }
                                                      </div>
                                                      <div>
                                                        <span className="font-medium">
                                                          Material:
                                                        </span>{" "}
                                                        {item.item.handle
                                                          .material || "-"}
                                                      </div>
                                                    </>
                                                  )}
                                                  {item.item?.hardware && (
                                                    <>
                                                      <div>
                                                        <span className="font-medium">
                                                          Name:
                                                        </span>{" "}
                                                        {
                                                          item.item.hardware
                                                            .name
                                                        }
                                                      </div>
                                                      <div>
                                                        <span className="font-medium">
                                                          Type:
                                                        </span>{" "}
                                                        {
                                                          item.item.hardware
                                                            .type
                                                        }
                                                      </div>
                                                      <div>
                                                        <span className="font-medium">
                                                          Dimensions:
                                                        </span>{" "}
                                                        {
                                                          item.item.hardware
                                                            .dimensions
                                                        }
                                                      </div>
                                                      <div>
                                                        <span className="font-medium">
                                                          Sub Category:
                                                        </span>{" "}
                                                        {
                                                          item.item.hardware
                                                            .sub_category
                                                        }
                                                      </div>
                                                    </>
                                                  )}
                                                  {item.item?.accessory && (
                                                    <>
                                                      <div>
                                                        <span className="font-medium">
                                                          Name:
                                                        </span>{" "}
                                                        {
                                                          item.item.accessory
                                                            .name
                                                        }
                                                      </div>
                                                    </>
                                                  )}
                                                  {!item.item?.sheet &&
                                                    !item.item?.handle &&
                                                    !item.item?.hardware &&
                                                    !item.item?.accessory && (
                                                      <div>
                                                        {item.item
                                                          ?.description ||
                                                          item.notes ||
                                                          "-"}
                                                      </div>
                                                    )}
                                                </div>
                                                {item.notes &&
                                                  item.item?.description &&
                                                  item.notes !==
                                                    item.item?.description && (
                                                    <div className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                                                      <FileText className="w-3 h-3 mt-0.5" />
                                                      <span>{item.notes}</span>
                                                    </div>
                                                  )}
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="text-sm text-gray-600">
                                                  {item.quantity}
                                                  {item.item
                                                    ?.measurement_unit && (
                                                    <span className="text-gray-400 ml-1">
                                                      {
                                                        item.item
                                                          .measurement_unit
                                                      }
                                                    </span>
                                                  )}
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="text-sm text-gray-600">
                                                  {item.quantity_received || 0}
                                                  {item.item
                                                    ?.measurement_unit && (
                                                    <span className="text-gray-400 ml-1">
                                                      {
                                                        item.item
                                                          .measurement_unit
                                                      }
                                                    </span>
                                                  )}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="text-sm text-gray-600">
                                                  $
                                                  {parseFloat(
                                                    item.unit_price
                                                  ).toFixed(2)}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                <span className="text-sm font-semibold text-gray-900">
                                                  $
                                                  {formatMoney(
                                                    parseFloat(item.quantity) *
                                                      parseFloat(
                                                        item.unit_price
                                                      )
                                                  )}
                                                </span>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Pagination Controls */}
                  {paginatedPOs.length > 0 && (
                    <div className="mt-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-600">
                            Showing
                          </span>
                          <div className="relative dropdown-container">
                            <button
                              onClick={() =>
                                setShowItemsPerPageDropdown(
                                  !showItemsPerPageDropdown
                                )
                              }
                              className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors duration-200"
                            >
                              <span>
                                {itemsPerPage === 0 ? "All" : itemsPerPage}
                              </span>
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            {showItemsPerPageDropdown && (
                              <div className="absolute top-full left-0 mt-1 w-20 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                                <div className="py-1">
                                  {[10, 25, 50, 100, 0].map((value) => (
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
                          <span className="text-sm text-slate-600">
                            of {totalItems} results
                          </span>
                        </div>
                      </div>

                      {itemsPerPage > 0 && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCurrentPage(1)}
                            disabled={currentPage === 1}
                            className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                          >
                            <ChevronsLeft className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              setCurrentPage((p) => Math.max(1, p - 1))
                            }
                            disabled={currentPage === 1}
                            className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
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
                                    className={`cursor-pointer px-3 py-2 text-sm rounded-lg transition-colors duration-200 ${
                                      currentPage === pageNum
                                        ? "bg-primary text-white"
                                        : "text-slate-600 hover:bg-slate-100"
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
                              setCurrentPage((p) => Math.min(totalPages, p + 1))
                            }
                            disabled={currentPage === totalPages}
                            className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setCurrentPage(totalPages)}
                            disabled={currentPage === totalPages}
                            className="cursor-pointer p-2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                          >
                            <ChevronsRight className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Materials Received Modal */}
      {showMaterialsReceivedModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col relative z-50">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Materials Received
              </h2>
              <button
                onClick={() => {
                  setShowMaterialsReceivedModal(false);
                  setSelectedPOId("");
                  setSelectedPO(null);
                  setQuantityReceived({});
                  setPoSearchTerm("");
                  setIsPODropdownOpen(false);
                }}
                className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select Purchase Order
                </label>
                <div className="relative" ref={poDropdownRef}>
                  <div className="relative">
                    <input
                      ref={poInputRef}
                      type="text"
                      value={
                        selectedPOId
                          ? `${
                              pos.find((p) => p.id === selectedPOId)
                                ?.order_no || ""
                            } - ${
                              pos.find((p) => p.id === selectedPOId)?.supplier
                                ?.name || "Unknown Supplier"
                            } (${
                              pos.find((p) => p.id === selectedPOId)?.status ||
                              ""
                            })`
                          : poSearchTerm
                      }
                      onChange={(e) => {
                        const value = e.target.value;
                        setPoSearchTerm(value);
                        setIsPODropdownOpen(true);
                        if (selectedPOId) {
                          // If PO is selected, clear selection when typing
                          setSelectedPOId("");
                          setSelectedPO(null);
                          setQuantityReceived({});
                        }
                      }}
                      onFocus={() => {
                        setIsPODropdownOpen(true);
                        updateDropdownPosition();
                      }}
                      placeholder="Search or select purchase order..."
                      className="w-full text-slate-800 p-3 pr-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsPODropdownOpen(!isPODropdownOpen);
                        if (!isPODropdownOpen) {
                          updateDropdownPosition();
                        } else if (!selectedPOId) {
                          setPoSearchTerm("");
                        }
                      }}
                      className="cursor-pointer absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <ChevronDown
                        className={`w-5 h-5 transition-transform ${
                          isPODropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {isPODropdownOpen && (
                <div
                  data-dropdown="po-dropdown"
                  className="fixed z-[9999] bg-white border border-slate-300 rounded-lg shadow-xl max-h-60 overflow-auto"
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePOSelect(po.id);
                        }}
                        className="cursor-pointer w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        <div className="font-medium">{po.order_no}</div>
                        <div className="text-xs text-slate-500">
                          {po.supplier?.name || "Unknown Supplier"} -{" "}
                          {po.status}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-sm text-slate-500">
                      No matching purchase orders found
                    </div>
                  )}
                </div>
              )}

              {selectedPO &&
                selectedPO.items &&
                selectedPO.items.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full border border-slate-200 rounded-lg">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Image
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Category
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Details
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantity Ordered
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Remaining / Received
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            New Delivery
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                          return (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                  {item.item?.image ? (
                                    <img
                                      src={`/${item.item.image}`}
                                      alt={item.item.item_id}
                                      className="w-12 h-12 object-cover rounded border border-slate-200"
                                      onError={(e) => {
                                        e.target.style.display = "none";
                                        e.target.nextSibling.style.display =
                                          "flex";
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    className={`w-12 h-12 bg-slate-100 rounded border border-slate-200 flex items-center justify-center ${
                                      item.item?.image ? "hidden" : "flex"
                                    }`}
                                  >
                                    <Package className="w-6 h-6 text-slate-400" />
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                  {item.item?.category || "-"}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm text-gray-600 space-y-1">
                                  {item.item?.sheet && (
                                    <>
                                      <div>
                                        <span className="font-medium">
                                          Color:
                                        </span>{" "}
                                        {item.item.sheet.color}
                                      </div>
                                      <div>
                                        <span className="font-medium">
                                          Finish:
                                        </span>{" "}
                                        {item.item.sheet.finish}
                                      </div>
                                      <div>
                                        <span className="font-medium">
                                          Face:
                                        </span>{" "}
                                        {item.item.sheet.face || "-"}
                                      </div>
                                      <div>
                                        <span className="font-medium">
                                          Dimensions:
                                        </span>{" "}
                                        {item.item.sheet.dimensions}
                                      </div>
                                    </>
                                  )}
                                  {item.item?.handle && (
                                    <>
                                      <div>
                                        <span className="font-medium">
                                          Color:
                                        </span>{" "}
                                        {item.item.handle.color}
                                      </div>
                                      <div>
                                        <span className="font-medium">
                                          Type:
                                        </span>{" "}
                                        {item.item.handle.type}
                                      </div>
                                      <div>
                                        <span className="font-medium">
                                          Dimensions:
                                        </span>{" "}
                                        {item.item.handle.dimensions}
                                      </div>
                                      <div>
                                        <span className="font-medium">
                                          Material:
                                        </span>{" "}
                                        {item.item.handle.material || "-"}
                                      </div>
                                    </>
                                  )}
                                  {item.item?.hardware && (
                                    <>
                                      <div>
                                        <span className="font-medium">
                                          Name:
                                        </span>{" "}
                                        {item.item.hardware.name}
                                      </div>
                                      <div>
                                        <span className="font-medium">
                                          Type:
                                        </span>{" "}
                                        {item.item.hardware.type}
                                      </div>
                                      <div>
                                        <span className="font-medium">
                                          Dimensions:
                                        </span>{" "}
                                        {item.item.hardware.dimensions}
                                      </div>
                                      <div>
                                        <span className="font-medium">
                                          Sub Category:
                                        </span>{" "}
                                        {item.item.hardware.sub_category}
                                      </div>
                                    </>
                                  )}
                                  {item.item?.accessory && (
                                    <>
                                      <div>
                                        <span className="font-medium">
                                          Name:
                                        </span>{" "}
                                        {item.item.accessory.name}
                                      </div>
                                    </>
                                  )}
                                  {!item.item?.sheet &&
                                    !item.item?.handle &&
                                    !item.item?.hardware &&
                                    !item.item?.accessory && (
                                      <div>
                                        {item.item?.description ||
                                          item.notes ||
                                          "-"}
                                      </div>
                                    )}
                                </div>
                                {item.notes &&
                                  item.item?.description &&
                                  item.notes !== item.item?.description && (
                                    <div className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                                      <FileText className="w-3 h-3 mt-0.5" />
                                      <span>{item.notes}</span>
                                    </div>
                                  )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="text-sm text-gray-600">
                                  {orderedQty}
                                  {item.item?.measurement_unit && (
                                    <span className="text-gray-400 ml-1">
                                      {item.item.measurement_unit}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <div className="flex flex-col gap-1">
                                  <div className="text-sm text-gray-600">
                                    <span className="font-medium">
                                      Remaining:
                                    </span>{" "}
                                    {remainingQty}
                                    {item.item?.measurement_unit && (
                                      <span className="text-gray-400 ml-1">
                                        {item.item.measurement_unit}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    <span className="font-medium">
                                      Received:
                                    </span>{" "}
                                    {existingReceived}
                                    {item.item?.measurement_unit && (
                                      <span className="text-gray-400 ml-1">
                                        {item.item.measurement_unit}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <input
                                  type="number"
                                  min="0"
                                  max={remainingQty}
                                  value={newDelivery || ""}
                                  onChange={(e) =>
                                    handleQuantityReceivedChange(
                                      item.id,
                                      e.target.value
                                    )
                                  }
                                  className={`w-24 text-sm text-slate-800 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                                    exceedsRemaining
                                      ? "border-red-300 bg-red-50"
                                      : "border-slate-300"
                                  }`}
                                  placeholder="0"
                                />
                                {item.item?.measurement_unit && (
                                  <span className="text-gray-400 ml-1 text-sm">
                                    {item.item.measurement_unit}
                                  </span>
                                )}
                                {exceedsRemaining && (
                                  <div className="text-xs text-red-500 mt-1">
                                    Exceeds remaining
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {isComplete && newDelivery > 0 && (
                                  <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                                    <Check className="w-3 h-3 inline mr-1" />
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
                  <div className="text-center py-10 text-slate-500">
                    No items found for this purchase order
                  </div>
                )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200">
              <button
                onClick={() => {
                  setShowMaterialsReceivedModal(false);
                  setSelectedPOId("");
                  setSelectedPO(null);
                  setQuantityReceived({});
                  setPoSearchTerm("");
                  setIsPODropdownOpen(false);
                }}
                className="cursor-pointer px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all duration-200 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitMaterialsReceived}
                disabled={!selectedPOId || isSubmitting}
                className={`cursor-pointer px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all duration-200 text-sm font-medium flex items-center gap-2 ${
                  !selectedPOId || isSubmitting
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Update Received Quantities</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
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
        message="This will permanently delete the invoice file. This action cannot be undone."
        isDeleting={deletingInvoicePOId !== null}
      />
    </AdminRoute>
  );
}
