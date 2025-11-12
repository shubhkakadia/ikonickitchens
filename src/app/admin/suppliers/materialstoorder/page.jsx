"use client";
import React, { useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Plus,
} from "lucide-react";
import PurchaseOrder from "../components/PurchaseOrderForm";

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
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [showItemsPerPageDropdown, setShowItemsPerPageDropdown] =
    useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchMTOs();
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
        setMtos(response.data.data || []);
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
    // Tab filter
    let list = mtos.filter((mto) =>
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
    setSortField("project");
    setSortOrder("asc");
    setCurrentPage(1);
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
          ? `${mto.createdBy.employee.first_name || ""} ${
              mto.createdBy.employee.last_name || ""
            }`.trim()
          : "";
        const notes = mto.notes || "";

        const rows = (mto.items || []).map((it) => {
          const item = it.item || {};
          const supplierName = item.supplier?.name || "";
          const imageUrl = item.image ? `${origin}/${item.image}` : "";
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

          return {
            Project: projectName,
            Lot: lotsJoined,
            Items: itemsCount,
            "Items Remaining": itemsRemaining,
            Status: mto.status || "",
            "Supplier Name": supplierName,
            "Image URL": imageUrl,
            Category: category,
            // Details in separate columns
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
        });

        // If no items, still output one row for the MTO with blanks for item columns
        if (rows.length === 0) {
          rows.push({
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
          });
        }
        return rows;
      });
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws["!cols"] = [
        { wch: 22 }, // Project
        { wch: 24 }, // Lot
        { wch: 8 }, // Items
        { wch: 12 }, // Items Remaining
        { wch: 14 }, // Status
        { wch: 22 }, // Supplier Name
        { wch: 28 }, // Image URL
        { wch: 12 }, // Category
        { wch: 14 }, // Sheet Color
        { wch: 14 }, // Sheet Finish
        { wch: 12 }, // Sheet Face
        { wch: 18 }, // Sheet Dimensions
        { wch: 14 }, // Handle Color
        { wch: 14 }, // Handle Type
        { wch: 18 }, // Handle Dimensions
        { wch: 16 }, // Handle Material
        { wch: 18 }, // Hardware Name
        { wch: 16 }, // Hardware Type
        { wch: 18 }, // Hardware Dimensions
        { wch: 20 }, // Hardware Sub Category
        { wch: 18 }, // Accessory Name
        { wch: 10 }, // Quantity
        { wch: 16 }, // Quantity Ordered
        { wch: 20 }, // Created At
        { wch: 22 }, // Created By
        { wch: 30 }, // Notes
      ];
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
                  <p className="text-slate-600">
                    Loading materials to order...
                  </p>
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
                {/* Heading and actions - mirroring suppliers list */}
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-slate-600">
                    Materials to Order
                  </h1>
                </div>

                <div className="mt-4 bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                  <div className="flex items-center justify-between mb-6">
                    {/* Search */}
                    <div className="flex items-center gap-2 w-[500px] relative">
                      <Search className="h-5 w-5 absolute left-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by project, lot or status"
                        className="w-full text-slate-800 p-3 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>

                    {/* Reset, Sort, Export */}
                    <div className="flex items-center gap-3">
                      {(search !== "" ||
                        sortField !== "project" ||
                        sortOrder !== "asc") && (
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
                                { key: "project", label: "Project" },
                                { key: "status", label: "Status" },
                                { key: "items", label: "Items" },
                                { key: "remaining", label: "Items Remaining" },
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
                        onClick={handleExportToExcel}
                        disabled={
                          isExporting || filteredAndSortedMTOs.length === 0
                        }
                        className={`flex items-center gap-2 transition-all duration-200 text-slate-600 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium ${
                          isExporting || filteredAndSortedMTOs.length === 0
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

                  {/* Container for tabs and table */}
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
                      <div className="col-span-5">Project / Lots</div>
                      <div className="col-span-2">Items</div>
                      <div className="col-span-2">Items Remaining</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-1 text-right">Actions</div>
                    </div>

                    {/* Rows */}
                    <div className="space-y-2">
                      {paginatedMTOs.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                          No materials to order found
                        </div>
                      ) : (
                        paginatedMTOs.map((mto) => {
                          return (
                            <div
                              key={mto.id}
                              className="border border-slate-200 rounded-lg overflow-hidden"
                            >
                              <button
                                onClick={() => {
                                  const element = document.getElementById(
                                    `mto-${mto.id}`
                                  );
                                  if (element)
                                    element.classList.toggle("hidden");
                                }}
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                              >
                                <div className="grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-5 flex flex-row items-center gap-3">
                                    <span className="text-sm font-semibold text-gray-800 truncate">
                                      {mto.project?.name || "Project"}
                                    </span>
                                    <div className="flex flex-wrap gap-1 mt-1 md:mt-0">
                                      {mto.lots?.map((lot) => (
                                        <span
                                          key={lot.lot_id || lot.id}
                                          className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-800 rounded"
                                        >
                                          {lot.name}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="col-span-2 text-sm text-slate-700">
                                    {mto.__itemsCount ??
                                      (mto.items?.length || 0)}
                                  </div>
                                  <div className="col-span-2 text-sm text-slate-700">
                                    {mto.__itemsRemaining ??
                                      (mto.items?.filter(
                                        (it) =>
                                          (it.quantity_ordered || 0) <
                                          (it.quantity || 0)
                                      ).length ||
                                        0)}
                                  </div>
                                  <div className="col-span-2">
                                    <span
                                      className={`px-2 py-1 text-xs font-medium rounded ${
                                        mto.status === "DRAFT"
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
                                  </div>
                                  <div className="col-span-1 text-right">
                                    <ChevronDown className="w-5 h-5 text-slate-500 inline-block" />
                                  </div>
                                </div>
                              </button>

                              {/* Accordion content */}
                              <div
                                id={`mto-${mto.id}`}
                                className="hidden px-4 pb-4 border-t border-slate-100"
                              >
                                <div className="mt-4">
                                  <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
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
                                    </div>
                                  </div>

                                  {/* Items grouped by supplier */}
                                  {!!(mto.items && mto.items.length) && (
                                    <div className="space-y-6">
                                      {(() => {
                                        // Group items by supplier name (Unassigned last)
                                        const groups = new Map();
                                        mto.items.forEach((it) => {
                                          const supplierName =
                                            it.item?.supplier?.name ||
                                            "Unassigned";
                                          if (!groups.has(supplierName))
                                            groups.set(supplierName, []);
                                          groups.get(supplierName).push(it);
                                        });
                                        const orderedGroupNames = Array.from(
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
                                        return orderedGroupNames.map((name) => (
                                          <div key={name}>
                                            <div className="flex items-center justify-between mb-2">
                                              <div className="text-sm font-semibold text-slate-700">
                                                {name}
                                              </div>
                                              {activeTab === "active" &&
                                                name !== "Unassigned" && (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const firstItem =
                                                        groups.get(name)?.[0];
                                                      const supplierId =
                                                        firstItem?.item
                                                          ?.supplier
                                                          ?.supplier_id ||
                                                        firstItem?.item
                                                          ?.supplier_id ||
                                                        null;
                                                      if (!supplierId) return;
                                                      openCreatePOForSupplier(
                                                        name,
                                                        supplierId,
                                                        mto.id
                                                      );
                                                    }}
                                                    className="cursor-pointer px-2 py-1 text-xs border border-primary text-primary rounded-md hover:bg-primary hover:text-white transition-colors"
                                                  >
                                                    <Plus className="inline w-3 h-3 mr-1" />{" "}
                                                    Create Purchase Order
                                                  </button>
                                                )}
                                            </div>
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
                                                      Status
                                                    </th>
                                                  </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-slate-200">
                                                  {groups
                                                    .get(name)
                                                    .map((item) => (
                                                      <tr
                                                        key={item.id}
                                                        className="hover:bg-slate-50"
                                                      >
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                          <div className="flex items-center">
                                                            {item.item
                                                              ?.image ? (
                                                              <img
                                                                src={`/${item.item.image}`}
                                                                alt={
                                                                  item.item_id
                                                                }
                                                                className="w-12 h-12 object-cover rounded border border-slate-200"
                                                                onError={(
                                                                  e
                                                                ) => {
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
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                                            {
                                                              item.item
                                                                ?.category
                                                            }
                                                          </span>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                          <div className="text-sm text-gray-600 space-y-1">
                                                            {item.item
                                                              ?.sheet && (
                                                              <>
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
                                                          </div>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap">
                                                          <div className="text-sm text-gray-600">
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                              <Package className="w-4 h-4 text-gray-500" />
                                                              <span>
                                                                <span className="font-medium">
                                                                  Qty:
                                                                </span>{" "}
                                                                {item.quantity}{" "}
                                                                {
                                                                  item.item
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
                                                        <td className="px-4 py-3 whitespace-nowrap">
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
                                                    ))}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        ));
                                      })()}
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
                  {paginatedMTOs.length > 0 && (
                    <div className="mt-6 flex items-center justify-between">
                      {/* Items per page */}
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

                      {/* Pagination buttons */}
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
      {showCreatePurchaseOrderModal && selectedSupplierForPO && (
        <PurchaseOrder
          materialsToOrder={mtosForSelectedSupplier}
          supplier={selectedSupplierForPO}
          setShowCreatePurchaseOrderModal={setShowCreatePurchaseOrderModal}
          fetchMaterialsToOrder={fetchMTOs}
          selectedMtoId={preSelectedMtoId}
        />
      )}
    </AdminRoute>
  );
}
