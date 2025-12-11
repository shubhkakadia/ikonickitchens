"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
import PaginationFooter from "@/components/PaginationFooter";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
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
} from "lucide-react";
import { pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import Image from "next/image";
import CreatePurchaseOrderModal from "./components/CreatePurchaseOrderModal";
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
  const [showCreatePOModal, setShowCreatePOModal] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(25);
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
    "Unit Price",
    "Total",
  ];

  // Initialize selected columns with all columns
  const [selectedColumns, setSelectedColumns] = useState([...availableColumns]);
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
  const sortDropdownRef = useRef(null);
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
  const [openAccordionId, setOpenAccordionId] = useState(null);
  // Purchase order delete
  const [deletingPOId, setDeletingPOId] = useState(null);
  const [showDeletePOModal, setShowDeletePOModal] = useState(false);
  const [poPendingDelete, setPoPendingDelete] = useState(null);

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
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Reset to first page when search or items per page changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleReset = () => {
    setSearch("");
    setSortField("date");
    setSortOrder("desc");
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

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(event.target)
      ) {
        setShowSortDropdown(false);
      }
      if (!event.target.closest(".dropdown-container")) {
        setShowColumnDropdown(false);
      }
    };

    if (showSortDropdown) {
      // Use setTimeout to avoid immediate closure
      setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
      }, 0);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    } else {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showSortDropdown]);

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
              message:
                result.reason?.response?.data?.message ||
                result.reason?.message ||
                "Transaction failed",
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
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      const response = await axios.delete(
        `/api/purchase_order/${poPendingDelete.id}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (response.data.status) {
        toast.success("Purchase order deleted successfully", {
          position: "top-right",
          autoClose: 3000,
        });
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
          response.data.message || "Failed to delete purchase order",
          {
            position: "top-right",
            autoClose: 3000,
          }
        );
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message || "Failed to delete purchase order",
        {
          position: "top-right",
          autoClose: 3000,
        }
      );
    } finally {
      setDeletingPOId(null);
    }
  };

  const handlePODeleteCancel = () => {
    setShowDeletePOModal(false);
    setPoPendingDelete(null);
  };

  const handleCloseMaterialsReceivedModal = () => {
    setShowMaterialsReceivedModal(false);
    setSelectedPOId("");
    setSelectedPO(null);
    setQuantityReceived({});
    setPoSearchTerm("");
    setIsPODropdownOpen(false);
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
        "Unit Price": 12,
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
          ? `${po.orderedBy.employee.first_name || ""} ${po.orderedBy.employee.last_name || ""
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
            "Unit Price": it.unit_price ?? "",
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
            "Unit Price": "",
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
          <div className="flex-1 flex flex-col overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
                  <p className="text-sm text-slate-600 font-medium">
                    Loading purchase orders details...
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
                <div className="px-3 py-2 shrink-0">
                  <div className="flex justify-between items-center">
                    <h1 className="text-xl font-bold text-slate-600">
                      Purchase Orders
                    </h1>
                    <button
                      onClick={() => setShowCreatePOModal(true)}
                      className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-primary/80 hover:bg-primary text-white rounded-lg transition-all duration-200 text-xs font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      Create Purchase Order
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden px-3 pb-3">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                    {/* Fixed Header Section */}
                    <div className="p-3 shrink-0">
                      <div className="flex items-center justify-between">
                        {/* Search */}
                        <div className="flex items-center gap-2 flex-1 max-w-sm relative">
                          <Search className="h-4 w-4 absolute left-3 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search by order no, supplier or status"
                            className="w-full text-slate-800 p-2 pl-9 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>

                        {/* Reset, Sort, Export */}
                        <div className="flex items-center gap-2">
                          {(search !== "" ||
                            sortField !== "date" ||
                            sortOrder !== "desc") && (
                              <button
                                onClick={handleReset}
                                className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-600 border border-slate-300 px-3 py-2 rounded-lg text-xs font-medium"
                              >
                                <RotateCcw className="h-4 w-4" />
                                <span>Reset</span>
                              </button>
                            )}

                          <div
                            className="relative dropdown-container"
                            ref={sortDropdownRef}
                          >
                            <button
                              onClick={() =>
                                setShowSortDropdown(!showSortDropdown)
                              }
                              className="cursor-pointer flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                            >
                              <ArrowUpDown className="h-4 w-4" />
                              <span>Sort by</span>
                            </button>
                            {showSortDropdown && (
                              <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
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
                                      className="cursor-pointer w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 flex items-center justify-between"
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
                            className="cursor-pointer flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                          >
                            <Package className="h-4 w-4" />
                            <span>Materials Received</span>
                          </button>

                          <div className="relative dropdown-container flex items-center">
                            <button
                              onClick={handleExportToExcel}
                              disabled={
                                isExporting ||
                                filteredAndSortedPOs.length === 0 ||
                                selectedColumns.length === 0
                              }
                              className={`flex items-center gap-2 transition-all duration-200 text-slate-700 border border-slate-300 border-r-0 px-3 py-2 rounded-l-lg text-sm font-medium ${isExporting ||
                                filteredAndSortedPOs.length === 0 ||
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
                                isExporting || filteredAndSortedPOs.length === 0
                              }
                              className={`flex items-center transition-all duration-200 text-slate-600 border border-slate-300 px-2 py-2 rounded-r-lg text-xs font-medium ${isExporting || filteredAndSortedPOs.length === 0
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
                    <div className="px-3 shrink-0 border-b border-slate-200">
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
                    <div className="flex-1 overflow-auto px-3">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                          <tr>
                            <th
                              className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("order")}
                            >
                              <div className="flex items-center gap-2">
                                Order / Supplier
                                {getSortIcon("order")}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("date")}
                            >
                              <div className="flex items-center gap-2">
                                Date
                                {getSortIcon("date")}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("items")}
                            >
                              <div className="flex items-center gap-2">
                                Items
                                {getSortIcon("items")}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("total")}
                            >
                              <div className="flex items-center gap-2">
                                Total
                                {getSortIcon("total")}
                              </div>
                            </th>
                            <th
                              className="px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors duration-200"
                              onClick={() => handleSort("status")}
                            >
                              <div className="flex items-center gap-2">
                                Status
                                {getSortIcon("status")}
                              </div>
                            </th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                          {paginatedPOs.length === 0 ? (
                            <tr>
                              <td
                                className="px-3 py-10 text-xs text-slate-500 text-center"
                                colSpan={6}
                              >
                                No purchase orders found
                              </td>
                            </tr>
                          ) : (
                            paginatedPOs.map((po) => {
                              return (
                                <React.Fragment key={po.id}>
                                  <tr
                                    onClick={() => {
                                      if (openAccordionId === po.id) {
                                        setOpenAccordionId(null);
                                      } else {
                                        setOpenAccordionId(po.id);
                                      }
                                    }}
                                    className="cursor-pointer hover:bg-slate-50 transition-colors duration-200"
                                  >
                                    <td className="px-3 py-2">
                                      <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-gray-800 truncate">
                                          {po.order_no}
                                        </span>
                                        <span className="text-xs text-slate-600 truncate">
                                          {po.supplier?.name || "-"}
                                        </span>
                                      </div>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-700">
                                      {po.ordered_at
                                        ? `Ordered: ${new Date(
                                          po.ordered_at
                                        ).toLocaleDateString()}`
                                        : `Created: ${po.createdAt
                                          ? new Date(
                                            po.createdAt
                                          ).toLocaleDateString()
                                          : "-"
                                        }`}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-700">
                                      {(po.items || []).reduce(
                                        (sum, it) =>
                                          sum + (parseFloat(it.quantity) || 0),
                                        0
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-700">
                                      ${formatMoney(po.total_amount)}
                                    </td>
                                    <td className="px-3 py-2">
                                      <span
                                        className={`px-2 py-1 text-xs font-medium rounded ${po.status === "DRAFT"
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
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      <ChevronDown
                                        className={`w-4 h-4 text-slate-500 inline-block transition-transform duration-200 ${openAccordionId === po.id
                                          ? "rotate-180"
                                          : ""
                                          }`}
                                      />
                                    </td>
                                  </tr>

                                  {/* Accordion content */}
                                  {openAccordionId === po.id && (
                                    <tr>
                                      <td
                                        colSpan={6}
                                        className="px-3 pb-3 border-t border-slate-200 bg-slate-50"
                                      >
                                        <div
                                          id={`po-${po.id}`}
                                          className="mt-2"
                                        >
                                          <div className="mb-2 p-2 bg-slate-50 rounded-lg">
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap">
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
                                                        $
                                                        {formatMoney(
                                                          po.total_amount
                                                        )}
                                                      </span>
                                                    </span>
                                                  </div>
                                                )}
                                                {po.mto?.project && (
                                                  <span className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded border border-slate-200">
                                                    Project:{" "}
                                                    {po.mto.project.project_id}{" "}
                                                    - {po.mto.project.name}
                                                  </span>
                                                )}
                                                {po.orderedBy?.employee && (
                                                  <div className="flex items-center gap-1.5">
                                                    <User className="w-4 h-4" />
                                                    <span>
                                                      <span className="font-medium">
                                                        Ordered by:
                                                      </span>{" "}
                                                      {
                                                        po.orderedBy.employee
                                                          .first_name
                                                      }{" "}
                                                      {
                                                        po.orderedBy.employee
                                                          .last_name
                                                      }
                                                    </span>
                                                  </div>
                                                )}
                                              </div>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handlePODelete(po.id);
                                                }}
                                                disabled={
                                                  deletingPOId === po.id
                                                }
                                                className={`cursor-pointer px-2 py-1 border border-red-300 rounded-lg hover:bg-red-50 text-xs text-red-700 flex items-center gap-1.5 ${deletingPOId === po.id
                                                  ? "opacity-50 cursor-not-allowed"
                                                  : ""
                                                  }`}
                                              >
                                                {deletingPOId === po.id ? (
                                                  <>
                                                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-red-600"></div>
                                                    <span>Deleting...</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <Trash2 className="w-3 h-3" />
                                                    <span>Delete PO</span>
                                                  </>
                                                )}
                                              </button>
                                            </div>
                                            {po.notes && (
                                              <div className="mt-2 flex items-start gap-2 text-xs text-gray-600">
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
                                              <div className="mt-2">
                                                <div className="border border-slate-200 rounded-lg p-2 flex items-center justify-between bg-white">
                                                  <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded flex items-center justify-center">
                                                      <FileText className="w-5 h-5 text-slate-500" />
                                                    </div>
                                                    <div className="min-w-0">
                                                      <div className="text-xs font-medium text-gray-800 truncate">
                                                        {po.invoice_url
                                                          .filename ||
                                                          "Invoice"}
                                                      </div>
                                                      <div className="text-xs text-slate-500 truncate">
                                                        {po.invoice_url
                                                          .mime_type ||
                                                          po.invoice_url
                                                            .extension}
                                                      </div>
                                                    </div>
                                                  </div>
                                                  <div className="flex items-center gap-2 shrink-0">
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedInvoiceFile({
                                                          name:
                                                            po.invoice_url
                                                              .filename ||
                                                            "Invoice",
                                                          url: `/${po.invoice_url.url}`,
                                                          type:
                                                            po.invoice_url
                                                              .mime_type ||
                                                            (po.invoice_url
                                                              .extension
                                                              ? `application/${po.invoice_url.extension}`
                                                              : "application/pdf"),
                                                          size:
                                                            po.invoice_url
                                                              .size || 0,
                                                          isExisting: true,
                                                        });
                                                        setShowInvoicePreview(
                                                          true
                                                        );
                                                      }}
                                                      className="cursor-pointer px-2 py-1 border border-slate-300 rounded-lg hover:bg-slate-50 text-xs text-slate-700"
                                                    >
                                                      View
                                                    </button>
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleInvoiceDelete(
                                                          po.id
                                                        );
                                                      }}
                                                      disabled={
                                                        deletingInvoicePOId ===
                                                        po.id
                                                      }
                                                      className={`cursor-pointer px-2 py-1 border border-red-300 rounded-lg hover:bg-red-50 text-xs text-red-700 flex items-center gap-1.5 ${deletingInvoicePOId ===
                                                        po.id
                                                        ? "opacity-50 cursor-not-allowed"
                                                        : ""
                                                        }`}
                                                    >
                                                      {deletingInvoicePOId ===
                                                        po.id ? (
                                                        <>
                                                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-red-600"></div>
                                                          <span>
                                                            Deleting...
                                                          </span>
                                                        </>
                                                      ) : (
                                                        <>
                                                          <Trash2 className="w-3 h-3" />
                                                          <span>Delete</span>
                                                        </>
                                                      )}
                                                    </button>
                                                    <a
                                                      href={`/${po.invoice_url.url}`}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="cursor-pointer px-2 py-1 bg-primary/80 hover:bg-primary text-white rounded-lg text-xs"
                                                    >
                                                      Download
                                                    </a>
                                                  </div>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="mt-2">
                                                <div className="border border-slate-200 rounded-lg p-2 bg-white">
                                                  <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                      <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded flex items-center justify-center">
                                                        <FileText className="w-5 h-5 text-slate-400" />
                                                      </div>
                                                      <div>
                                                        <div className="text-xs font-medium text-gray-800">
                                                          No invoice uploaded
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                          Upload an invoice file
                                                          for this purchase
                                                          order
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
                                                          uploadingInvoicePOId ===
                                                          po.id
                                                        }
                                                      />
                                                      <label
                                                        htmlFor={`invoice-upload-${po.id}`}
                                                        className={`cursor-pointer px-2 py-1 border border-slate-300 rounded-lg hover:bg-slate-50 text-xs text-slate-700 flex items-center gap-2 ${uploadingInvoicePOId ===
                                                          po.id
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
                                                            <span>
                                                              Uploading...
                                                            </span>
                                                          </>
                                                        ) : (
                                                          <>
                                                            <Upload className="w-3 h-3" />
                                                            <span>
                                                              Upload Invoice
                                                            </span>
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
                                                      Quantity
                                                    </th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                      Remaining/Received
                                                    </th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                      Unit Price
                                                    </th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                      Total
                                                    </th>
                                                  </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-slate-200">
                                                  {po.items.map((item) => {
                                                    const orderedQty =
                                                      parseFloat(
                                                        item.quantity || 0
                                                      ) || 0;
                                                    const receivedQty =
                                                      parseFloat(
                                                        item.quantity_received ||
                                                        0
                                                      ) || 0;
                                                    const remainingQty =
                                                      Math.max(
                                                        0,
                                                        orderedQty - receivedQty
                                                      );
                                                    const measurementUnit =
                                                      item.item
                                                        ?.measurement_unit ||
                                                      "";
                                                    return (
                                                      <tr
                                                        key={item.id}
                                                        className="hover:bg-slate-50"
                                                      >
                                                        <td className="px-3 py-2 whitespace-nowrap">
                                                          <div className="flex items-center">
                                                            {item.item?.image
                                                              ?.url ? (
                                                              <Image
                                                                loading="lazy"
                                                                src={`/${item.item.image.url}`}
                                                                alt={
                                                                  item.item
                                                                    .item_id
                                                                }
                                                                className="w-10 h-10 object-cover rounded border border-slate-200"
                                                                width={40}
                                                                height={40}
                                                              />
                                                            ) : (
                                                              <div className="w-10 h-10 bg-slate-100 rounded border border-slate-200 flex items-center justify-center">
                                                                <Package className="w-5 h-5 text-slate-400" />
                                                              </div>
                                                            )}
                                                          </div>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                                            {item.item
                                                              ?.category || "-"}
                                                          </span>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                          <div className="text-xs text-gray-600 space-y-1">
                                                            {item.item
                                                              ?.sheet && (
                                                                <>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Brand:
                                                                    </span>{" "}
                                                                    {item.item
                                                                      .sheet
                                                                      .brand ||
                                                                      "-"}
                                                                  </div>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Color:
                                                                    </span>{" "}
                                                                    {
                                                                      item.item
                                                                        .sheet
                                                                        .color
                                                                    }
                                                                  </div>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Finish:
                                                                    </span>{" "}
                                                                    {
                                                                      item.item
                                                                        .sheet
                                                                        .finish
                                                                    }
                                                                  </div>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Face:
                                                                    </span>{" "}
                                                                    {item.item
                                                                      .sheet
                                                                      .face ||
                                                                      "-"}
                                                                  </div>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Dimensions:
                                                                    </span>{" "}
                                                                    {
                                                                      item.item
                                                                        .sheet
                                                                        .dimensions
                                                                    }
                                                                  </div>
                                                                </>
                                                              )}
                                                            {item.item
                                                              ?.handle && (
                                                                <>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Brand:
                                                                    </span>{" "}
                                                                    {item.item
                                                                      .handle
                                                                      .brand ||
                                                                      "-"}
                                                                  </div>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Color:
                                                                    </span>{" "}
                                                                    {
                                                                      item.item
                                                                        .handle
                                                                        .color
                                                                    }
                                                                  </div>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Type:
                                                                    </span>{" "}
                                                                    {
                                                                      item.item
                                                                        .handle
                                                                        .type
                                                                    }
                                                                  </div>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Dimensions:
                                                                    </span>{" "}
                                                                    {
                                                                      item.item
                                                                        .handle
                                                                        .dimensions
                                                                    }
                                                                  </div>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Material:
                                                                    </span>{" "}
                                                                    {item.item
                                                                      .handle
                                                                      .material ||
                                                                      "-"}
                                                                  </div>
                                                                </>
                                                              )}
                                                            {item.item
                                                              ?.hardware && (
                                                                <>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Brand:
                                                                    </span>{" "}
                                                                    {item.item
                                                                      .hardware
                                                                      .brand ||
                                                                      "-"}
                                                                  </div>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Name:
                                                                    </span>{" "}
                                                                    {
                                                                      item.item
                                                                        .hardware
                                                                        .name
                                                                    }
                                                                  </div>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Type:
                                                                    </span>{" "}
                                                                    {
                                                                      item.item
                                                                        .hardware
                                                                        .type
                                                                    }
                                                                  </div>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Dimensions:
                                                                    </span>{" "}
                                                                    {
                                                                      item.item
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
                                                                      item.item
                                                                        .hardware
                                                                        .sub_category
                                                                    }
                                                                  </div>
                                                                </>
                                                              )}
                                                            {item.item
                                                              ?.accessory && (
                                                                <>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Name:
                                                                    </span>{" "}
                                                                    {
                                                                      item.item
                                                                        .accessory
                                                                        .name
                                                                    }
                                                                  </div>
                                                                </>
                                                              )}
                                                            {item.item
                                                              ?.edging_tape && (
                                                                <>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Brand:
                                                                    </span>{" "}
                                                                    {item.item
                                                                      .edging_tape
                                                                      .brand ||
                                                                      "-"}
                                                                  </div>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Color:
                                                                    </span>{" "}
                                                                    {item.item
                                                                      .edging_tape
                                                                      .color ||
                                                                      "-"}
                                                                  </div>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Finish:
                                                                    </span>{" "}
                                                                    {item.item
                                                                      .edging_tape
                                                                      .finish ||
                                                                      "-"}
                                                                  </div>
                                                                  <div>
                                                                    <span className="font-medium">
                                                                      Dimensions:
                                                                    </span>{" "}
                                                                    {item.item
                                                                      .edging_tape
                                                                      .dimensions ||
                                                                      "-"}
                                                                  </div>
                                                                </>
                                                              )}
                                                            {!item.item
                                                              ?.sheet &&
                                                              !item.item
                                                                ?.handle &&
                                                              !item.item
                                                                ?.hardware &&
                                                              !item.item
                                                                ?.accessory &&
                                                              !item.item
                                                                ?.edging_tape && (
                                                                <div>
                                                                  {item.item
                                                                    ?.description ||
                                                                    item.notes ||
                                                                    "-"}
                                                                </div>
                                                              )}
                                                          </div>
                                                          {item.notes &&
                                                            item.item
                                                              ?.description &&
                                                            item.notes !==
                                                            item.item
                                                              ?.description && (
                                                              <div className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                                                                <FileText className="w-3 h-3 mt-0.5" />
                                                                <span>
                                                                  {item.notes}
                                                                </span>
                                                              </div>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap">
                                                          <div className="text-xs text-gray-600">
                                                            {orderedQty}
                                                            {measurementUnit && (
                                                              <span className="text-gray-400 ml-1">
                                                                {
                                                                  measurementUnit
                                                                }
                                                              </span>
                                                            )}
                                                          </div>
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap">
                                                          <div className="flex flex-col gap-1">
                                                            <div className="text-sm text-gray-600">
                                                              <span className="font-medium">
                                                                Remaining:
                                                              </span>{" "}
                                                              {remainingQty}
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
                                                            <div className="text-sm text-gray-600">
                                                              <span className="font-medium">
                                                                Received:
                                                              </span>{" "}
                                                              {receivedQty}
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
                                                          </div>
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap">
                                                          <span className="text-xs text-gray-600">
                                                            $
                                                            {parseFloat(
                                                              item.unit_price
                                                            ).toFixed(2)}
                                                          </span>
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap">
                                                          <span className="text-xs font-semibold text-gray-900">
                                                            $
                                                            {formatMoney(
                                                              parseFloat(
                                                                item.quantity
                                                              ) *
                                                              parseFloat(
                                                                item.unit_price
                                                              )
                                                            )}
                                                          </span>
                                                        </td>
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
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

                    {/* Fixed Pagination Footer */}
                    {paginatedPOs.length > 0 && (
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
      </div>

      {/* Materials Received Modal */}
      {showMaterialsReceivedModal && (
        <div
          className="fixed inset-0 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50"
          onClick={handleCloseMaterialsReceivedModal}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-6xl w-full mx-4 max-h-[90vh] flex flex-col relative z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Materials Received
              </h2>
              <button
                onClick={handleCloseMaterialsReceivedModal}
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
                          ? `${pos.find((p) => p.id === selectedPOId)
                            ?.order_no || ""
                          } - ${pos.find((p) => p.id === selectedPOId)?.supplier
                            ?.name || "Unknown Supplier"
                          } (${pos.find((p) => p.id === selectedPOId)?.status ||
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
                        className={`w-5 h-5 transition-transform ${isPODropdownOpen ? "rotate-180" : ""
                          }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {isPODropdownOpen && (
                <div
                  data-dropdown="po-dropdown"
                  className="fixed z-9999 bg-white border border-slate-300 rounded-lg shadow-xl max-h-60 overflow-auto"
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
                                  {item.item?.image?.url ? (
                                    <Image
                                      loading="lazy"
                                      src={`/${item.item.image.url}`}
                                      alt={item.item.item_id}
                                      className="w-12 h-12 object-cover rounded border border-slate-200"
                                      width={48}
                                      height={48}
                                    />
                                  ) : (
                                    <div className="w-12 h-12 bg-slate-100 rounded border border-slate-200 flex items-center justify-center">
                                      <Package className="w-6 h-6 text-slate-400" />
                                    </div>
                                  )}
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
                                          Brand:
                                        </span>{" "}
                                        {item.item.sheet.brand || "-"}
                                      </div>
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
                                          Brand:
                                        </span>{" "}
                                        {item.item.handle.brand || "-"}
                                      </div>
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
                                          Brand:
                                        </span>{" "}
                                        {item.item.hardware.brand || "-"}
                                      </div>
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
                                  {item.item?.edging_tape && (
                                    <>
                                      <div>
                                        <span className="font-medium">
                                          Brand:
                                        </span>{" "}
                                        {item.item.edging_tape.brand || "-"}
                                      </div>
                                      <div>
                                        <span className="font-medium">
                                          Color:
                                        </span>{" "}
                                        {item.item.edging_tape.color || "-"}
                                      </div>
                                      <div>
                                        <span className="font-medium">
                                          Finish:
                                        </span>{" "}
                                        {item.item.edging_tape.finish || "-"}
                                      </div>
                                      <div>
                                        <span className="font-medium">
                                          Dimensions:
                                        </span>{" "}
                                        {item.item.edging_tape.dimensions ||
                                          "-"}
                                      </div>
                                    </>
                                  )}
                                  {!item.item?.sheet &&
                                    !item.item?.handle &&
                                    !item.item?.hardware &&
                                    !item.item?.accessory &&
                                    !item.item?.edging_tape && (
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
                                  className={`w-24 text-sm text-slate-800 px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${exceedsRemaining
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
                onClick={handleCloseMaterialsReceivedModal}
                className="cursor-pointer px-4 py-2 text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all duration-200 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitMaterialsReceived}
                disabled={!selectedPOId || isSubmitting}
                className={`cursor-pointer px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all duration-200 text-sm font-medium flex items-center gap-2 ${!selectedPOId || isSubmitting
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

      {/* Delete Purchase Order Confirmation Modal */}
      <DeleteConfirmation
        isOpen={showDeletePOModal}
        onClose={handlePODeleteCancel}
        onConfirm={handlePODeleteConfirm}
        deleteWithInput={true}
        heading="Purchase Order"
        message="This will permanently delete the purchase order and all its associated data. This action cannot be undone."
        comparingName={poPendingDelete?.order_no || ""}
        isDeleting={deletingPOId !== null}
      />

      {showCreatePOModal && (
        <CreatePurchaseOrderModal
          setShowModal={setShowCreatePOModal}
          onSuccess={fetchPOs}
        />
      )}

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
