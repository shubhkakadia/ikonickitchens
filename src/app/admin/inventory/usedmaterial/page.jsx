"use client";
import React, { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  ChevronDown,
  ChevronUp,
  Package,
  Layers,
  Image as ImageIcon,
  Check,
  X,
  AlertTriangle,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import SearchBar from "@/components/SearchBar";

export default function page() {
  const { getToken } = useAuth();
  const [mtos, setMtos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedMto, setExpandedMto] = useState(null);
  const [quantityInputs, setQuantityInputs] = useState({});
  const [saving, setSaving] = useState(false);

  // Used material MTO completion (Active/Completed) UI
  const [mtoTab, setMtoTab] = useState("active"); // active | completed
  const [openMtoStatusDropdownId, setOpenMtoStatusDropdownId] = useState(null);
  const [updatingMtoStatusId, setUpdatingMtoStatusId] = useState(null);

  // Manual add modal states
  const [showManualAddModal, setShowManualAddModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [allItems, setAllItems] = useState([]);
  const [itemSearch, setItemSearch] = useState("");
  const [showItemSearchResults, setShowItemSearchResults] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [manualNotes, setManualNotes] = useState("");
  const [loadingItems, setLoadingItems] = useState(false);
  const [savingManual, setSavingManual] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedProjectName, setSelectedProjectName] = useState("");
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState("");
  const projectDropdownRef = useRef(null);

  // Category options
  const categoryOptions = [
    { label: "Sheet", value: "sheet" },
    { label: "Edging Tape", value: "edging_tape" },
    { label: "Handle", value: "handle" },
    { label: "Hardware", value: "hardware" },
    { label: "Accessory", value: "accessory" },
  ];

  useEffect(() => {
    fetchMTOs();
    fetchProjectsWithAllActiveLots();
  }, []);

  const fetchProjectsWithAllActiveLots = async () => {
    try {
      setLoadingProjects(true);
      const sessionToken = getToken();
      if (!sessionToken) return;

      const response = await axios.get("/api/project/all", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        // Filter projects where ALL lots are ACTIVE
        const filteredProjects = response.data.data.filter((project) => {
          const lots = project.lots || [];
          // If project has no lots, exclude it
          if (lots.length === 0) return false;
          // Check if all lots are ACTIVE
          return lots.every((lot) => lot.status === "ACTIVE");
        });
        setProjects(filteredProjects);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error("Error fetching projects", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setLoadingProjects(false);
    }
  };

  const fetchMTOs = async () => {
    try {
      setLoading(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      const response = await axios.get(
        "/api/materials_to_order/used_material_list",
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (response.data.status) {
        // Store both ready_to_use and upcoming MTOs
        const { ready_to_use, upcoming } = response.data.data;
        // Combine both for compatibility with existing code
        setMtos([...ready_to_use, ...upcoming]);
      } else {
        toast.error(response.data.message || "Failed to fetch MTOs", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (error) {
      console.error("Error fetching MTOs:", error);
      toast.error("Error fetching MTOs. Please try again.", {
        position: "top-right",
        autoClose: 3000,
      });
      setError(error.response.data.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleAccordion = (mtoId) => {
    setExpandedMto(expandedMto === mtoId ? null : mtoId);
  };

  // Close MTO status dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest("[data-mto-status-dropdown]")) {
        setOpenMtoStatusDropdownId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleUpdateMtoUsedMaterialStatus = async (mtoId, completed) => {
    try {
      setUpdatingMtoStatusId(mtoId);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      const response = await axios.patch(
        `/api/materials_to_order/${mtoId}`,
        { used_material_completed: completed },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status) {
        const updatedMto = response?.data?.data;
        setMtos((prev) =>
          prev.map((mto) => (mto.id === mtoId ? updatedMto || mto : mto))
        );
        if (expandedMto === mtoId) setExpandedMto(null);
        setOpenMtoStatusDropdownId(null);
        toast.success(`MTO marked as ${completed ? "completed" : "active"}`, {
          position: "top-right",
          autoClose: 2500,
        });
      } else {
        toast.error(response.data.message || "Failed to update MTO status", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Error updating MTO status. Please try again.",
        {
          position: "top-right",
          autoClose: 3000,
        }
      );
    } finally {
      setUpdatingMtoStatusId(null);
    }
  };

  // Group items by category
  const groupItemsByCategory = (items) => {
    const grouped = {};
    items.forEach((mtoItem) => {
      const category = mtoItem.item?.category || "UNCATEGORIZED";
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(mtoItem);
    });
    return grouped;
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case "SHEET":
        return <Layers className="w-4 h-4" />;
      case "HANDLE":
      case "HARDWARE":
      case "ACCESSORY":
      case "EDGING_TAPE":
        return <Package className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const formatCategoryName = (category) => {
    return category
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");
  };

  const handleQuantityInputChange = (mtoItemId, value) => {
    setQuantityInputs((prev) => ({
      ...prev,
      [mtoItemId]: value,
    }));
  };

  // Initialize quantity inputs when MTOs are loaded
  useEffect(() => {
    if (mtos.length > 0) {
      const initialInputs = {};
      mtos.forEach((mto) => {
        mto.items?.forEach((item) => {
          // Store as string to allow empty input during editing
          initialInputs[item.id] = String(item.quantity_used || 0);
        });
      });
      setQuantityInputs(initialInputs);
    }
  }, [mtos]);

  const handleCancelEdit = (mtoItemId) => {
    // Reset to original value
    const mtoItem = mtos
      .flatMap((mto) => mto.items || [])
      .find((item) => item.id === mtoItemId);
    if (mtoItem) {
      setQuantityInputs((prev) => ({
        ...prev,
        [mtoItemId]: String(mtoItem.quantity_used || 0),
      }));
    }
  };

  const handleSaveUsage = async (mtoId, mtoItem) => {
    try {
      setSaving(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      // Parse string input to number, treating empty string as 0
      const inputString = quantityInputs[mtoItem.id] || "";
      const inputValue = inputString === "" ? 0 : parseFloat(inputString);
      const currentUsed = mtoItem.quantity_used || 0;
      const totalQuantity = mtoItem.quantity;

      // Validate that input is a valid number
      if (isNaN(inputValue)) {
        toast.error("Please enter a valid number", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      // Validate: input should not exceed total
      if (inputValue > totalQuantity) {
        toast.error(
          `Used quantity (${inputValue}) cannot exceed total quantity (${totalQuantity})`,
          {
            position: "top-right",
            autoClose: 3000,
          }
        );
        return;
      }

      if (inputValue < 0) {
        toast.error("Used quantity cannot be negative", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      // Calculate the increment (difference between new and current)
      const increment = inputValue - currentUsed;

      // If no change, do nothing
      if (increment === 0) {
        return;
      }

      // Stock transaction API only handles increments (positive changes)
      // If user tries to decrease, show an error
      if (increment < 0) {
        toast.error(
          "Cannot decrease used quantity. Stock transactions only support increments.",
          {
            position: "top-right",
            autoClose: 3000,
          }
        );
        return;
      }

      // Validate that item has item_id
      const itemId = mtoItem.item?.item_id;
      if (!itemId) {
        toast.error("Item ID not found. Cannot create stock transaction.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      // Ensure quantity is a number
      const quantityToUse = parseFloat(increment);
      if (isNaN(quantityToUse) || quantityToUse <= 0) {
        toast.error("Invalid quantity. Please enter a valid number.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      // Create stock transaction with type USED
      const response = await axios.post(
        `/api/stock_transaction/create`,
        {
          item_id: itemId,
          quantity: quantityToUse,
          type: "USED",
          materials_to_order_id: mtoId,
        },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status) {
        toast.success("Quantity used updated successfully", {
          position: "top-right",
          autoClose: 3000,
        });
        // Refresh MTOs
        await fetchMTOs();
      } else {
        toast.error(response.data.message || "Failed to update quantity used", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Error updating quantity used. Please try again.",
        {
          position: "top-right",
          autoClose: 3000,
        }
      );
    } finally {
      setSaving(false);
    }
  };

  // Validate and format image URL
  const getImageUrl = (image) => {
    // Handle image object (media relation) - extract URL
    if (image && typeof image === "object" && image.url) {
      const url = image.url;
      // If it's already a full URL, return as is
      if (url.startsWith("http://") || url.startsWith("https://")) {
        return url;
      }
      // If it's a relative path, ensure it starts with /
      if (url.startsWith("/")) {
        return url;
      }
      // Otherwise, add leading slash
      return `/${url}`;
    }
    // Handle string format (backward compatibility)
    if (
      !image ||
      typeof image !== "string" ||
      image.trim() === "" ||
      image === "null" ||
      image === "undefined"
    ) {
      return null;
    }
    const trimmed = image.trim();
    // If it's already a full URL, return as is
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    // If it's a relative path, ensure it starts with /
    if (trimmed.startsWith("/")) {
      return trimmed;
    }
    // Otherwise, add leading slash
    return `/${trimmed}`;
  };

  // Fetch items when category is selected
  useEffect(() => {
    if (selectedCategory && showManualAddModal) {
      fetchItemsByCategory(selectedCategory);
    } else {
      setAllItems([]);
    }
  }, [selectedCategory, showManualAddModal]);

  // Close search results on click outside
  useEffect(() => {
    if (!showManualAddModal) return;

    const handleClickOutside = (event) => {
      const searchElement = document.querySelector("[data-search-container]");
      if (searchElement && !searchElement.contains(event.target)) {
        setShowItemSearchResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showManualAddModal]);

  // Close project dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        projectDropdownRef.current &&
        !projectDropdownRef.current.contains(event.target)
      ) {
        setIsProjectDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter projects based on search term
  const filteredProjects = projects.filter((project) => {
    if (!projectSearchTerm) return true;
    const searchLower = projectSearchTerm.toLowerCase();
    const projectName = project.name?.toLowerCase() || "";
    const clientName = project.client?.client_name?.toLowerCase() || "";
    return (
      projectName.includes(searchLower) || clientName.includes(searchLower)
    );
  });

  const handleProjectSelect = (project) => {
    setSelectedProjectId(project.project_id);
    setSelectedProjectName(project.name);
    setProjectSearchTerm(
      `${project.name}${
        project.client ? ` (${project.client.client_name})` : ""
      }`
    );
    setIsProjectDropdownOpen(false);
  };

  const handleProjectSearchChange = (e) => {
    const value = e.target.value;
    setProjectSearchTerm(value);
    setIsProjectDropdownOpen(true);
    // If user clears the input, clear the selection
    if (!value.trim()) {
      setSelectedProjectId("");
      setSelectedProjectName("");
    }
  };

  const fetchItemsByCategory = async (category) => {
    try {
      setLoadingItems(true);
      setAllItems([]);
      setItemSearch("");
      const sessionToken = getToken();
      if (!sessionToken) return;

      const response = await axios.get(`/api/item/all/${category}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.data.status) {
        setAllItems(response.data.data || []);
      } else {
        toast.error("Failed to fetch items");
        setAllItems([]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Error fetching items");
      setAllItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  // Filter items based on search
  const filteredItems = allItems.filter((item) => {
    if (!itemSearch) return false;
    const searchLower = itemSearch.toLowerCase();

    const matchesCategory = item.category?.toLowerCase().includes(searchLower);
    const matchesDesc = item.description?.toLowerCase().includes(searchLower);

    let matchesDetails = false;
    if (item.sheet) {
      matchesDetails =
        item.sheet.brand?.toLowerCase().includes(searchLower) ||
        item.sheet.color?.toLowerCase().includes(searchLower) ||
        item.sheet.finish?.toLowerCase().includes(searchLower);
    } else if (item.handle) {
      matchesDetails =
        item.handle.brand?.toLowerCase().includes(searchLower) ||
        item.handle.color?.toLowerCase().includes(searchLower) ||
        item.handle.type?.toLowerCase().includes(searchLower);
    } else if (item.hardware) {
      matchesDetails =
        item.hardware.brand?.toLowerCase().includes(searchLower) ||
        item.hardware.name?.toLowerCase().includes(searchLower);
    } else if (item.accessory) {
      matchesDetails = item.accessory.name?.toLowerCase().includes(searchLower);
    } else if (item.edging_tape) {
      matchesDetails =
        item.edging_tape.brand?.toLowerCase().includes(searchLower) ||
        item.edging_tape.color?.toLowerCase().includes(searchLower);
    }

    return matchesCategory || matchesDesc || matchesDetails;
  });

  // Reset modal state when closed
  const handleCloseManualModal = () => {
    setShowManualAddModal(false);
    setSelectedCategory("");
    setAllItems([]);
    setItemSearch("");
    setShowItemSearchResults(false);
    setSelectedItems([]);
    setManualNotes("");
    setSelectedProjectId("");
    setSelectedProjectName("");
    setProjectSearchTerm("");
    setIsProjectDropdownOpen(false);
  };

  // Handle add item to table
  const handleAddItem = (item) => {
    // Check if already added
    if (selectedItems.some((i) => i.item_id === item.item_id)) {
      toast.info("Item already added");
      return;
    }

    setSelectedItems((prev) => [
      ...prev,
      {
        ...item,
        item_id: item.item_id,
        stock_quantity: item.quantity, // Preserve original stock quantity
        quantity: 1, // Default quantity
      },
    ]);
    setItemSearch("");
    setShowItemSearchResults(false);
  };

  // Handle update item quantity
  const handleUpdateItem = (itemId, field, value) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.item_id === itemId) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  // Handle remove item from table
  const handleRemoveItem = (itemId) => {
    setSelectedItems((prev) => prev.filter((item) => item.item_id !== itemId));
  };

  // Get item display name
  const getItemDisplayName = (item) => {
    if (item.sheet)
      return `${item.sheet.brand} ${item.sheet.color} ${item.sheet.finish}`;
    if (item.handle)
      return `${item.handle.brand} ${item.handle.color} ${item.handle.type}`;
    if (item.hardware) return `${item.hardware.brand} ${item.hardware.name}`;
    if (item.accessory) return item.accessory.name;
    if (item.edging_tape)
      return `${item.edging_tape.brand} ${item.edging_tape.color}`;
    return item.description || "Item";
  };

  // Save manual material used
  const handleSaveManualMaterial = async () => {
    if (selectedItems.length === 0) {
      toast.error("Please add at least one item", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    // Validate quantities
    const invalidItems = selectedItems.some(
      (item) => !item.quantity || item.quantity <= 0
    );
    if (invalidItems) {
      toast.error("All items must have a quantity greater than 0", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    // Check if sufficient quantity is available for all items
    const insufficientItems = selectedItems.filter((item) => {
      const requestedQty = parseFloat(item.quantity);
      const availableQty = item.stock_quantity ?? item.quantity;
      return requestedQty > availableQty;
    });

    if (insufficientItems.length > 0) {
      const itemNames = insufficientItems
        .map((item) => getItemDisplayName(item))
        .join(", ");
      toast.error(`Insufficient quantity for: ${itemNames}`, {
        position: "top-right",
        autoClose: 5000,
      });
      return;
    }

    try {
      setSavingManual(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }

      // Create stock transactions for all items
      const promises = selectedItems.map((item) =>
        axios.post(
          `/api/stock_transaction/create`,
          {
            item_id: item.item_id,
            quantity: parseFloat(item.quantity),
            type: "USED",
            notes: manualNotes || `Manually recorded used quantity`,
            project_id: selectedProjectId || null,
          },
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              "Content-Type": "application/json",
            },
          }
        )
      );

      const results = await Promise.allSettled(promises);
      const failed = results.filter(
        (r) => r.status === "rejected" || !r.value?.data?.status
      );

      if (failed.length > 0) {
        toast.error(
          `Failed to record ${failed.length} item(s). Please try again.`,
          {
            position: "top-right",
            autoClose: 5000,
          }
        );
      } else {
        toast.success("All materials used recorded successfully", {
          position: "top-right",
          autoClose: 3000,
        });
        handleCloseManualModal();
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Error recording material used. Please try again.",
        {
          position: "top-right",
          autoClose: 3000,
        }
      );
    } finally {
      setSavingManual(false);
    }
  };

  // Get item details based on category
  const getItemDetails = (item) => {
    if (!item) return null;

    const category = item.category;
    const details = {
      name: item.description || "Unknown Item",
      image: getImageUrl(item.image),
      brand: null,
      color: null,
      finish: null,
      material: null,
      type: null,
      dimensions: null,
      face: null,
      sub_category: null,
    };

    switch (category) {
      case "SHEET":
        if (item.sheet) {
          details.name = item.sheet.brand || details.name;
          details.brand = item.sheet.brand;
          details.color = item.sheet.color;
          details.finish = item.sheet.finish;
          details.face = item.sheet.face;
          details.dimensions = item.sheet.dimensions;
        }
        break;
      case "HANDLE":
        if (item.handle) {
          details.name = item.handle.brand || details.name;
          details.brand = item.handle.brand;
          details.color = item.handle.color;
          details.type = item.handle.type;
          details.material = item.handle.material;
          details.dimensions = item.handle.dimensions;
        }
        break;
      case "HARDWARE":
        if (item.hardware) {
          details.name = item.hardware.name || details.name;
          details.brand = item.hardware.brand;
          details.type = item.hardware.type;
          details.sub_category = item.hardware.sub_category;
          details.dimensions = item.hardware.dimensions;
        }
        break;
      case "ACCESSORY":
        if (item.accessory) {
          details.name = item.accessory.name || details.name;
        }
        break;
      case "EDGING_TAPE":
        if (item.edging_tape) {
          details.name = item.edging_tape.brand || details.name;
          details.brand = item.edging_tape.brand;
          details.color = item.edging_tape.color;
          details.finish = item.edging_tape.finish;
          details.dimensions = item.edging_tape.dimensions;
        }
        break;
      default:
        break;
    }

    return details;
  };

  // Filter MTOs by status and readiness
  const activeMtos = mtos.filter(
    (mto) => !Boolean(mto.used_material_completed) && mto.is_ready === true
  );
  const upcomingMtos = mtos.filter(
    (mto) => !Boolean(mto.used_material_completed) && mto.is_ready === false
  );
  const completedMtos = mtos.filter((mto) =>
    Boolean(mto.used_material_completed)
  );

  const displayedMtos =
    mtoTab === "completed"
      ? completedMtos
      : mtoTab === "upcoming"
      ? upcomingMtos
      : activeMtos;

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
                    Loading used material details...
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
                <div className="px-4 py-2 shrink-0 flex items-center justify-between">
                  <h1 className="text-xl font-bold text-slate-700">
                    Used Material
                  </h1>
                  <div className="flex items-center gap-2">
                    <SearchBar />
                    <button
                      onClick={() => setShowManualAddModal(true)}
                      className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Manually Add Material Used
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                    {loading ? (
                      <div className="flex justify-center items-center h-full">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
                          <p className="text-sm text-slate-600 font-medium">
                            Loading MTOs...
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Tabs Section */}
                        <div className="px-4 shrink-0 border-b border-slate-200">
                          <nav className="flex space-x-6">
                            <button
                              onClick={() => setMtoTab("active")}
                              className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
                                mtoTab === "active"
                                  ? "border-primary text-primary"
                                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                              }`}
                            >
                              Active ({activeMtos.length})
                            </button>
                            <button
                              onClick={() => setMtoTab("upcoming")}
                              className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
                                mtoTab === "upcoming"
                                  ? "border-primary text-primary"
                                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                              }`}
                            >
                              Upcoming ({upcomingMtos.length})
                            </button>
                            <button
                              onClick={() => setMtoTab("completed")}
                              className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
                                mtoTab === "completed"
                                  ? "border-primary text-primary"
                                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                              }`}
                            >
                              Completed ({completedMtos.length})
                            </button>
                          </nav>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-auto px-4 py-3">
                          {mtos.length === 0 ? (
                            <div className="flex justify-center items-center py-10">
                              <div className="text-center">
                                <div className="h-12 w-12 text-slate-400 mx-auto mb-4">
                                  📦
                                </div>
                                <p className="text-sm text-slate-500 font-medium">
                                  No Jobs found
                                </p>
                              </div>
                            </div>
                          ) : displayedMtos.length === 0 ? (
                            <div className="flex justify-center items-center py-10">
                              <p className="text-sm text-slate-500 font-medium">
                                {mtoTab === "active"
                                  ? "No Active MTOs"
                                  : "No Completed MTOs"}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {displayedMtos.map((mto) => {
                                const isExpanded = expandedMto === mto.id;
                                const groupedItems = groupItemsByCategory(
                                  mto.items || []
                                );
                                const lotIds =
                                  mto.lots && mto.lots.length > 0
                                    ? mto.lots
                                        .map((lot) => lot.lot_id)
                                        .join(", ")
                                    : "N/A";

                                return (
                                  <div
                                    key={mto.id}
                                    className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
                                  >
                                    {/* Accordion Header */}
                                    <div className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                      <button
                                        type="button"
                                        onClick={() => toggleAccordion(mto.id)}
                                        className="flex items-center gap-3 flex-1 text-left"
                                      >
                                        <div className="shrink-0">
                                          {isExpanded ? (
                                            <ChevronUp className="w-4 h-4 text-slate-500" />
                                          ) : (
                                            <ChevronDown className="w-4 h-4 text-slate-500" />
                                          )}
                                        </div>
                                        <div className="flex-1">
                                          <div className="text-sm font-semibold text-slate-700">
                                            {mto.project?.name ||
                                              "Manually Added"}
                                          </div>
                                          <div className="text-sm text-slate-500 mt-0.5">
                                            Lot ID: {lotIds}
                                          </div>
                                        </div>
                                      </button>

                                      {/* Used Material Status (one-way: Active -> Completed) */}
                                      {mtoTab === "upcoming" ? (
                                        <div className="shrink-0 ml-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-orange-50 text-sm font-semibold text-orange-700">
                                          <span className="h-2 w-2 rounded-full bg-orange-500" />
                                          Upcoming
                                        </div>
                                      ) : !Boolean(
                                          mto.used_material_completed
                                        ) ? (
                                        <div
                                          className="relative shrink-0 ml-4"
                                          data-mto-status-dropdown
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setOpenMtoStatusDropdownId(
                                                (prev) =>
                                                  prev === mto.id
                                                    ? null
                                                    : mto.id
                                              );
                                            }}
                                            disabled={
                                              updatingMtoStatusId === mto.id
                                            }
                                            className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                                            title="Mark this MTO as completed"
                                          >
                                            <span className="inline-flex items-center gap-2">
                                              <span className="h-2 w-2 rounded-full bg-blue-500" />
                                              Active
                                            </span>
                                            <ChevronDown className="w-4 h-4 text-slate-500" />
                                          </button>

                                          {openMtoStatusDropdownId ===
                                            mto.id && (
                                            <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-30 overflow-hidden">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleUpdateMtoUsedMaterialStatus(
                                                    mto.id,
                                                    true
                                                  );
                                                }}
                                                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between"
                                              >
                                                <span className="font-medium text-slate-700">
                                                  Mark Completed
                                                </span>
                                                <Check className="w-4 h-4 text-green-600" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="shrink-0 ml-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                                          <span className="h-2 w-2 rounded-full bg-green-500" />
                                          Completed
                                        </div>
                                      )}
                                    </div>

                                    {/* Accordion Content */}
                                    {isExpanded && (
                                      <div className="border-t border-slate-200 px-4 py-3 bg-slate-50">
                                        {Object.keys(groupedItems).length ===
                                        0 ? (
                                          <div className="text-sm text-slate-500 text-center py-4 font-medium">
                                            No items in this MTO
                                          </div>
                                        ) : (
                                          <div className="space-y-3">
                                            {Object.entries(groupedItems).map(
                                              ([category, items]) => (
                                                <div
                                                  key={category}
                                                  className="bg-white rounded-lg p-3 border border-slate-200"
                                                >
                                                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-200">
                                                    {getCategoryIcon(category)}
                                                    <h3 className="text-sm font-semibold text-slate-700">
                                                      {formatCategoryName(
                                                        category
                                                      )}
                                                    </h3>
                                                    <span className="text-sm text-slate-500 ml-auto font-medium">
                                                      {items.length} item(s)
                                                    </span>
                                                  </div>
                                                  <div className="space-y-3">
                                                    {items.map((mtoItem) => {
                                                      const itemDetails =
                                                        getItemDetails(
                                                          mtoItem.item
                                                        );
                                                      // Compare string input with original number value
                                                      const inputString =
                                                        quantityInputs[
                                                          mtoItem.id
                                                        ];
                                                      const originalValue =
                                                        String(
                                                          mtoItem.quantity_used ||
                                                            0
                                                        );
                                                      const hasChanges =
                                                        inputString !==
                                                          undefined &&
                                                        inputString !==
                                                          originalValue;
                                                      return (
                                                        <div
                                                          key={mtoItem.id}
                                                          className="bg-slate-50 rounded-lg p-3 border border-slate-200 hover:bg-slate-100 transition-colors"
                                                        >
                                                          {/* Single Row: Item Details + Quantity Columns */}
                                                          <div className="flex gap-4 items-center">
                                                            {/* Item Image */}
                                                            <div className="shrink-0">
                                                              {itemDetails?.image ? (
                                                                <div className="w-16 h-16 rounded-lg overflow-hidden border border-slate-300 bg-white flex items-center justify-center relative">
                                                                  <Image
                                                                    loading="lazy"
                                                                    src={
                                                                      itemDetails.image
                                                                    }
                                                                    alt={
                                                                      itemDetails.name ||
                                                                      "Item"
                                                                    }
                                                                    className="object-cover w-full h-full"
                                                                    width={64}
                                                                    height={64}
                                                                    onError={(
                                                                      e
                                                                    ) => {
                                                                      e.target.style.display =
                                                                        "none";
                                                                      const fallback =
                                                                        e.target.parentElement?.querySelector(
                                                                          ".image-fallback"
                                                                        );
                                                                      if (
                                                                        fallback
                                                                      ) {
                                                                        fallback.style.display =
                                                                          "flex";
                                                                      }
                                                                    }}
                                                                  />
                                                                  <div className="hidden image-fallback absolute inset-0 w-16 h-16 rounded-lg border border-slate-300 bg-slate-200 items-center justify-center">
                                                                    <ImageIcon className="w-6 h-6 text-slate-400" />
                                                                  </div>
                                                                </div>
                                                              ) : (
                                                                <div className="w-16 h-16 rounded-lg border border-slate-300 bg-slate-200 flex items-center justify-center">
                                                                  <ImageIcon className="w-6 h-6 text-slate-400" />
                                                                </div>
                                                              )}
                                                            </div>

                                                            {/* Item Details */}
                                                            <div className="flex-1 min-w-0">
                                                              <div className="text-sm font-semibold text-slate-800 mb-1.5">
                                                                {itemDetails?.name ||
                                                                  "Unknown Item"}
                                                              </div>

                                                              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm">
                                                                {itemDetails?.brand && (
                                                                  <div>
                                                                    <span className="text-slate-500 font-bold">
                                                                      Brand:
                                                                    </span>{" "}
                                                                    <span className="text-slate-700">
                                                                      {
                                                                        itemDetails.brand
                                                                      }
                                                                    </span>
                                                                  </div>
                                                                )}
                                                                {itemDetails?.color && (
                                                                  <div>
                                                                    <span className="text-slate-500 font-bold">
                                                                      Color:
                                                                    </span>{" "}
                                                                    <span className="text-slate-700">
                                                                      {
                                                                        itemDetails.color
                                                                      }
                                                                    </span>
                                                                  </div>
                                                                )}
                                                                {itemDetails?.finish && (
                                                                  <div>
                                                                    <span className="text-slate-500 font-bold">
                                                                      Finish:
                                                                    </span>{" "}
                                                                    <span className="text-slate-700">
                                                                      {
                                                                        itemDetails.finish
                                                                      }
                                                                    </span>
                                                                  </div>
                                                                )}
                                                                {itemDetails?.material && (
                                                                  <div>
                                                                    <span className="text-slate-500 font-bold">
                                                                      Material:
                                                                    </span>{" "}
                                                                    <span className="text-slate-700">
                                                                      {
                                                                        itemDetails.material
                                                                      }
                                                                    </span>
                                                                  </div>
                                                                )}
                                                                {itemDetails?.type && (
                                                                  <div>
                                                                    <span className="text-slate-500 font-bold">
                                                                      Type:
                                                                    </span>{" "}
                                                                    <span className="text-slate-700">
                                                                      {
                                                                        itemDetails.type
                                                                      }
                                                                    </span>
                                                                  </div>
                                                                )}
                                                                {itemDetails?.sub_category && (
                                                                  <div>
                                                                    <span className="text-slate-500 font-bold">
                                                                      Sub
                                                                      Category:
                                                                    </span>{" "}
                                                                    <span className="text-slate-700">
                                                                      {
                                                                        itemDetails.sub_category
                                                                      }
                                                                    </span>
                                                                  </div>
                                                                )}
                                                                {itemDetails?.face && (
                                                                  <div>
                                                                    <span className="text-slate-500 font-bold">
                                                                      Face:
                                                                    </span>{" "}
                                                                    <span className="text-slate-700">
                                                                      {
                                                                        itemDetails.face
                                                                      }
                                                                    </span>
                                                                  </div>
                                                                )}
                                                                {itemDetails?.dimensions && (
                                                                  <div>
                                                                    <span className="text-slate-500 font-bold">
                                                                      Dimensions:
                                                                    </span>{" "}
                                                                    <span className="text-slate-700">
                                                                      {
                                                                        itemDetails.dimensions
                                                                      }
                                                                    </span>
                                                                  </div>
                                                                )}
                                                                {mtoItem.item
                                                                  ?.supplier && (
                                                                  <div>
                                                                    <span className="text-slate-500 font-bold">
                                                                      Supplier:
                                                                    </span>{" "}
                                                                    <span className="text-slate-700">
                                                                      {
                                                                        mtoItem
                                                                          .item
                                                                          .supplier
                                                                          .name
                                                                      }
                                                                    </span>
                                                                  </div>
                                                                )}
                                                              </div>
                                                            </div>

                                                            {/* Total Quantity Column */}
                                                            <div className="text-center min-w-[90px]">
                                                              <div className="text-sm text-slate-500 mb-1.5 font-medium">
                                                                Total
                                                              </div>
                                                              <div className="text-base font-bold text-slate-700">
                                                                {
                                                                  mtoItem.quantity
                                                                }
                                                              </div>
                                                              {mtoItem.item
                                                                ?.measurement_unit && (
                                                                <div className="text-xs text-slate-500 mt-1">
                                                                  {
                                                                    mtoItem.item
                                                                      .measurement_unit
                                                                  }
                                                                </div>
                                                              )}
                                                            </div>

                                                            {/* Used Count Column */}
                                                            <div className="text-center min-w-20">
                                                              <div className="text-sm text-slate-500 mb-1.5 font-medium">
                                                                Used
                                                              </div>
                                                              <div className="text-base font-bold text-slate-700">
                                                                {mtoItem.quantity_used ||
                                                                  0}
                                                              </div>
                                                              {mtoItem.item
                                                                ?.measurement_unit && (
                                                                <div className="text-xs text-slate-500 mt-1">
                                                                  {
                                                                    mtoItem.item
                                                                      .measurement_unit
                                                                  }
                                                                </div>
                                                              )}
                                                            </div>

                                                            {/* Input Field Column */}
                                                            <div className="text-center min-w-[100px]">
                                                              <div className="text-sm text-slate-500 mb-1.5 font-medium">
                                                                New Used
                                                              </div>
                                                              <div className="space-y-1">
                                                                <input
                                                                  type="number"
                                                                  min="0"
                                                                  max={
                                                                    mtoItem.quantity
                                                                  }
                                                                  value={
                                                                    quantityInputs[
                                                                      mtoItem.id
                                                                    ] !==
                                                                    undefined
                                                                      ? quantityInputs[
                                                                          mtoItem
                                                                            .id
                                                                        ]
                                                                      : String(
                                                                          mtoItem.quantity_used ||
                                                                            0
                                                                        )
                                                                  }
                                                                  onChange={(
                                                                    e
                                                                  ) => {
                                                                    // Store raw string value to allow empty input
                                                                    const value =
                                                                      e.target
                                                                        .value;
                                                                    handleQuantityInputChange(
                                                                      mtoItem.id,
                                                                      value
                                                                    );
                                                                  }}
                                                                  className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none text-center font-medium"
                                                                  disabled={
                                                                    saving ||
                                                                    mtoTab ===
                                                                      "upcoming"
                                                                  }
                                                                />
                                                                {mtoItem.item
                                                                  ?.measurement_unit && (
                                                                  <div className="text-xs text-slate-500 mt-1">
                                                                    {
                                                                      mtoItem
                                                                        .item
                                                                        .measurement_unit
                                                                    }
                                                                  </div>
                                                                )}
                                                                {(() => {
                                                                  const inputString =
                                                                    quantityInputs[
                                                                      mtoItem.id
                                                                    ];
                                                                  if (
                                                                    inputString ===
                                                                    undefined
                                                                  )
                                                                    return null;
                                                                  const inputValue =
                                                                    inputString ===
                                                                    ""
                                                                      ? 0
                                                                      : parseFloat(
                                                                          inputString
                                                                        );
                                                                  if (
                                                                    !isNaN(
                                                                      inputValue
                                                                    ) &&
                                                                    inputValue >
                                                                      mtoItem.quantity
                                                                  ) {
                                                                    return (
                                                                      <div className="text-xs text-red-600 font-medium">
                                                                        Max:{" "}
                                                                        {
                                                                          mtoItem.quantity
                                                                        }
                                                                      </div>
                                                                    );
                                                                  }
                                                                  return null;
                                                                })()}
                                                              </div>
                                                            </div>

                                                            {/* Actions Column */}
                                                            <div className="text-center min-w-20">
                                                              <div className="text-sm text-slate-500 mb-1.5 font-medium">
                                                                Actions
                                                              </div>
                                                              {hasChanges ? (
                                                                <div className="flex gap-1.5 justify-center">
                                                                  <button
                                                                    onClick={() =>
                                                                      handleCancelEdit(
                                                                        mtoItem.id
                                                                      )
                                                                    }
                                                                    disabled={
                                                                      saving ||
                                                                      mtoTab ===
                                                                        "upcoming"
                                                                    }
                                                                    className="cursor-pointer p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
                                                                    title="Cancel"
                                                                  >
                                                                    <X className="w-4 h-4" />
                                                                  </button>
                                                                  <button
                                                                    onClick={() =>
                                                                      handleSaveUsage(
                                                                        mto.id,
                                                                        mtoItem
                                                                      )
                                                                    }
                                                                    disabled={(() => {
                                                                      if (
                                                                        saving ||
                                                                        mtoTab ===
                                                                          "upcoming"
                                                                      )
                                                                        return true;
                                                                      const inputString =
                                                                        quantityInputs[
                                                                          mtoItem
                                                                            .id
                                                                        ];
                                                                      if (
                                                                        inputString ===
                                                                        undefined
                                                                      )
                                                                        return false;
                                                                      const inputValue =
                                                                        inputString ===
                                                                        ""
                                                                          ? 0
                                                                          : parseFloat(
                                                                              inputString
                                                                            );
                                                                      return (
                                                                        !isNaN(
                                                                          inputValue
                                                                        ) &&
                                                                        inputValue >
                                                                          mtoItem.quantity
                                                                      );
                                                                    })()}
                                                                    className="cursor-pointer p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                                    title="Save"
                                                                  >
                                                                    <Check className="w-4 h-4" />
                                                                  </button>
                                                                </div>
                                                              ) : (
                                                                <div className="text-sm text-slate-400">
                                                                  -
                                                                </div>
                                                              )}
                                                            </div>
                                                          </div>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              )
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Manual Add Material Modal */}
      {showManualAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={handleCloseManualModal}
          />

          <div className="relative bg-white w-full max-w-6xl mx-4 rounded-xl shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="text-xl font-semibold text-slate-800">
                Manually Add Material Used
              </h2>
              <button
                onClick={handleCloseManualModal}
                className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors"
                disabled={savingManual}
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Project Selection */}
              <div className="relative" ref={projectDropdownRef}>
                <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                  Project (Optional)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={projectSearchTerm}
                    onChange={handleProjectSearchChange}
                    onFocus={() => setIsProjectDropdownOpen(true)}
                    className="w-full text-sm text-slate-800 px-4 py-2.5 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                    placeholder="Search or select a project..."
                    disabled={savingManual || loadingProjects}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setIsProjectDropdownOpen(!isProjectDropdownOpen)
                    }
                    className="cursor-pointer absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                    disabled={savingManual || loadingProjects}
                  >
                    <ChevronDown
                      className={`w-5 h-5 transition-transform ${
                        isProjectDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </div>

                {isProjectDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                    {loadingProjects ? (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center">
                        Loading projects...
                      </div>
                    ) : filteredProjects.length > 0 ? (
                      filteredProjects.map((project) => {
                        const displayText = `${project.name}${
                          project.client ? ` ${project.client.client_name}` : ""
                        }`;
                        return (
                          <button
                            key={project.project_id}
                            type="button"
                            onClick={() => handleProjectSelect(project)}
                            className="cursor-pointer w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg"
                          >
                            <span>
                              <p className="font-bold">{project.name}</p>
                              <p className="text-xs text-slate-500">
                                {project.client
                                  ? ` ${project.client.client_name}`
                                  : ""}
                              </p>
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center">
                        {projectSearchTerm
                          ? "No matching projects found"
                          : "No projects with all active lots available"}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <hr className="border-slate-100" />

              {/* Item Selection & List */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                    Items
                  </h3>
                </div>

                {/* Category Dropdown and Search Bar */}
                <div className="mb-6 flex gap-3">
                  {/* Category Dropdown */}
                  <div className="shrink-0">
                    <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-48 px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-primary focus:border-primary outline-none bg-white"
                      disabled={savingManual}
                    >
                      <option value="">-- Select --</option>
                      {categoryOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search Bar */}
                  <div className="relative flex-1" data-search-container>
                    <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                      Search Items
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder={
                          selectedCategory
                            ? "Search items by name, category, brand..."
                            : "Please select a category first"
                        }
                        value={itemSearch}
                        onChange={(e) => {
                          setItemSearch(e.target.value);
                          setShowItemSearchResults(true);
                        }}
                        onFocus={() => {
                          if (selectedCategory) {
                            setShowItemSearchResults(true);
                          }
                        }}
                        disabled={!selectedCategory || savingManual}
                        className="w-full p-2.5 pl-10 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                      />
                    </div>

                    {/* Search Results Dropdown */}
                    {showItemSearchResults &&
                      itemSearch &&
                      selectedCategory && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                          {loadingItems ? (
                            <div className="p-4 text-center text-slate-500 text-sm">
                              Loading items...
                            </div>
                          ) : filteredItems.length === 0 ? (
                            <div className="p-4 text-center text-slate-500 text-sm">
                              No items found
                            </div>
                          ) : (
                            filteredItems.map((item) => (
                              <div
                                key={item.item_id}
                                onClick={() => handleAddItem(item)}
                                className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center gap-3"
                              >
                                <div className="w-10 h-10 bg-slate-100 rounded border border-slate-200 shrink-0 flex items-center justify-center overflow-hidden">
                                  {item.image?.url ? (
                                    <Image
                                      src={`/${item.image.url}`}
                                      alt="Item"
                                      width={40}
                                      height={40}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Package className="w-5 h-5 text-slate-400" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-800">
                                    {getItemDisplayName(item)}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {item.category} • Stock: {item.quantity}{" "}
                                    {item.measurement_unit}
                                  </p>
                                </div>
                                <Plus className="w-4 h-4 text-primary ml-auto" />
                              </div>
                            ))
                          )}
                        </div>
                      )}
                  </div>
                </div>

                {/* Selected Items Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          Image
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          Category
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          Details
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          In Stock
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedItems.length === 0 ? (
                        <tr>
                          <td
                            colSpan="6"
                            className="px-4 py-8 text-center text-slate-500 text-sm"
                          >
                            No items selected. Search and add items above.
                          </td>
                        </tr>
                      ) : (
                        selectedItems.map((item) => (
                          <tr key={item.item_id} className="hover:bg-slate-50">
                            {/* Image Column */}
                            <td className="px-4 py-3">
                              <div className="w-10 h-10 bg-slate-100 rounded border border-slate-200 shrink-0 flex items-center justify-center overflow-hidden">
                                {item.image?.url ? (
                                  <Image
                                    src={`/${item.image.url}`}
                                    alt="Item"
                                    width={40}
                                    height={40}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Package className="w-5 h-5 text-slate-400" />
                                )}
                              </div>
                            </td>

                            {/* Category Column */}
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                {item.category}
                              </span>
                            </td>

                            {/* Details Column */}
                            <td className="px-4 py-3">
                              <div className="text-xs text-slate-600 space-y-1">
                                {item.sheet && (
                                  <>
                                    <div>
                                      <span className="font-medium">
                                        Color:
                                      </span>{" "}
                                      {item.sheet.color}
                                    </div>
                                    <div>
                                      <span className="font-medium">
                                        Finish:
                                      </span>{" "}
                                      {item.sheet.finish}
                                    </div>
                                    <div>
                                      <span className="font-medium">Face:</span>{" "}
                                      {item.sheet.face || "-"}
                                    </div>
                                    <div>
                                      <span className="font-medium">
                                        Dimensions:
                                      </span>{" "}
                                      {item.sheet.dimensions}
                                    </div>
                                  </>
                                )}
                                {item.handle && (
                                  <>
                                    <div>
                                      <span className="font-medium">
                                        Color:
                                      </span>{" "}
                                      {item.handle.color}
                                    </div>
                                    <div>
                                      <span className="font-medium">Type:</span>{" "}
                                      {item.handle.type}
                                    </div>
                                    <div>
                                      <span className="font-medium">
                                        Dimensions:
                                      </span>{" "}
                                      {item.handle.dimensions}
                                    </div>
                                    <div>
                                      <span className="font-medium">
                                        Material:
                                      </span>{" "}
                                      {item.handle.material || "-"}
                                    </div>
                                  </>
                                )}
                                {item.hardware && (
                                  <>
                                    <div>
                                      <span className="font-medium">Name:</span>{" "}
                                      {item.hardware.name}
                                    </div>
                                    <div>
                                      <span className="font-medium">Type:</span>{" "}
                                      {item.hardware.type}
                                    </div>
                                    <div>
                                      <span className="font-medium">
                                        Dimensions:
                                      </span>{" "}
                                      {item.hardware.dimensions}
                                    </div>
                                    <div>
                                      <span className="font-medium">
                                        Sub Category:
                                      </span>{" "}
                                      {item.hardware.sub_category}
                                    </div>
                                  </>
                                )}
                                {item.accessory && (
                                  <>
                                    <div>
                                      <span className="font-medium">Name:</span>{" "}
                                      {item.accessory.name}
                                    </div>
                                  </>
                                )}
                                {item.edging_tape && (
                                  <>
                                    <div>
                                      <span className="font-medium">
                                        Brand:
                                      </span>{" "}
                                      {item.edging_tape.brand || "-"}
                                    </div>
                                    <div>
                                      <span className="font-medium">
                                        Color:
                                      </span>{" "}
                                      {item.edging_tape.color || "-"}
                                    </div>
                                    <div>
                                      <span className="font-medium">
                                        Finish:
                                      </span>{" "}
                                      {item.edging_tape.finish || "-"}
                                    </div>
                                    <div>
                                      <span className="font-medium">
                                        Dimensions:
                                      </span>{" "}
                                      {item.edging_tape.dimensions || "-"}
                                    </div>
                                  </>
                                )}
                                {!item.sheet &&
                                  !item.handle &&
                                  !item.hardware &&
                                  !item.accessory &&
                                  !item.edging_tape && (
                                    <div>{item.description || "-"}</div>
                                  )}
                              </div>
                            </td>

                            {/* In Stock Column */}
                            <td className="px-4 py-3 text-sm text-slate-600">
                              {item.stock_quantity ?? item.quantity}{" "}
                              {item.measurement_unit}
                            </td>

                            {/* Quantity Column */}
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    item.item_id,
                                    "quantity",
                                    e.target.value
                                  )
                                }
                                className="w-20 p-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-primary outline-none"
                                disabled={savingManual}
                              />
                            </td>

                            {/* Actions Column */}
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleRemoveItem(item.item_id)}
                                className="cursor-pointer p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                disabled={savingManual}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Notes */}
              <div>
                <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                  Notes
                </label>
                <textarea
                  rows={5}
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
                  placeholder="Add any additional notes..."
                  disabled={savingManual}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
              <button
                onClick={handleCloseManualModal}
                disabled={savingManual}
                className="cursor-pointer px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveManualMaterial}
                disabled={savingManual || selectedItems.length === 0}
                className="cursor-pointer px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {savingManual ? (
                  <>
                    <div className="cursor-pointer animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Save Material Used
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminRoute>
  );
}
