"use client";
import React from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { useState, useEffect } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  Edit,
  Trash2,
  Package,
  Layers,
  Box,
  Hash,
  FileText,
  Tag,
  SwatchBook,
  X,
  Download,
  ChevronDown,
  ChevronUp,
  Building2,
  Ruler,
  ExternalLink,
  Plus,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import TabsController from "@/components/tabscontroller";
import Image from "next/image";
import { CiMenuKebab } from "react-icons/ci";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import { AdminRoute } from "@/components/ProtectedRoute";
import { useUploadProgress } from "@/hooks/useUploadProgress";

// InfoField component - defined outside to prevent recreation and focus loss
const InfoField = ({
  label,
  value,
  field,
  icon,
  fullWidth = false,
  isEditing,
  formData,
  handleInputChange,
  formatValue,
}) => (
  <div className={fullWidth ? "col-span-2" : ""}>
    <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1.5">
      {icon}
      {label}
    </label>
    {isEditing ? (
      <input
        type="text"
        value={formData[field] || ""}
        onChange={(e) => handleInputChange(field, e.target.value)}
        placeholder={formatValue(value)}
        className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
      />
    ) : (
      <p className="text-sm text-slate-800">{formatValue(value)}</p>
    )}
  </div>
);

export default function page() {
  const { id } = useParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const {
    showProgressToast,
    completeUpload,
    dismissProgressToast,
    getUploadProgressHandler,
  } = useUploadProgress();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [item, setItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState({});
  const [newImage, setNewImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [deleteImage, setDeleteImage] = useState(false);
  const [isSubCategoryDropdownOpen, setIsSubCategoryDropdownOpen] =
    useState(false);
  const [subCategorySearchTerm, setSubCategorySearchTerm] = useState("");
  const subCategoryDropdownRef = React.useRef(null);
  const [hardwareSubCategories, setHardwareSubCategories] = useState([]);
  const [loadingSubCategories, setLoadingSubCategories] = useState(false);
  const [showCreateSubCategoryModal, setShowCreateSubCategoryModal] = useState(false);
  const [newSubCategoryValue, setNewSubCategoryValue] = useState("");
  const [isCreatingSubCategory, setIsCreatingSubCategory] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
  const supplierDropdownRef = React.useRef(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [isMeasuringUnitDropdownOpen, setIsMeasuringUnitDropdownOpen] = useState(false);
  const [measuringUnitSearchTerm, setMeasuringUnitSearchTerm] = useState("");
  const measuringUnitDropdownRef = React.useRef(null);
  const [measuringUnitOptions, setMeasuringUnitOptions] = useState([]);
  const [loadingMeasuringUnits, setLoadingMeasuringUnits] = useState(false);
  const [showCreateMeasuringUnitModal, setShowCreateMeasuringUnitModal] = useState(false);
  const [newMeasuringUnitValue, setNewMeasuringUnitValue] = useState("");
  const [isCreatingMeasuringUnit, setIsCreatingMeasuringUnit] = useState(false);
  const [isFinishDropdownOpen, setIsFinishDropdownOpen] = useState(false);
  const [finishSearchTerm, setFinishSearchTerm] = useState("");
  const finishDropdownRef = React.useRef(null);
  const [finishOptions, setFinishOptions] = useState([]);
  const [loadingFinishes, setLoadingFinishes] = useState(false);
  const [showCreateFinishModal, setShowCreateFinishModal] = useState(false);
  const [newFinishValue, setNewFinishValue] = useState("");
  const [isCreatingFinish, setIsCreatingFinish] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState(new Set());
  const stock_tx_item_per_page = 10;
  const [stockTxCurrentPage, setStockTxCurrentPage] = useState(1);

  const sortedStockTransactions = React.useMemo(() => {
    const transactions = item?.stock_transactions ?? [];
    return [...transactions].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }, [item?.stock_transactions]);

  const stockTxTotalPages = Math.ceil(
    sortedStockTransactions.length / stock_tx_item_per_page
  );
  const stockTxStartIndex =
    (stockTxCurrentPage - 1) * stock_tx_item_per_page;
  const stockTxEndIndex = stockTxStartIndex + stock_tx_item_per_page;
  const currentStockTransactions = sortedStockTransactions.slice(
    stockTxStartIndex,
    stockTxEndIndex
  );

  const handleStockTxPageChange = (page) => {
    const safePage = Math.max(1, Math.min(page, stockTxTotalPages || 1));
    setStockTxCurrentPage(safePage);
  };

  const filteredSubCategories = hardwareSubCategories.filter((subCategory) =>
    subCategory.toLowerCase().includes(subCategorySearchTerm.toLowerCase())
  );

  // Fetch hardware sub categories from config API
  useEffect(() => {
    const fetchHardwareSubCategories = async () => {
      try {
        setLoadingSubCategories(true);
        const sessionToken = getToken();
        if (!sessionToken) {
          console.error("No valid session found");
          return;
        }

        const config = {
          method: "post",
          maxBodyLength: Infinity,
          url: `/api/config/read_all_by_category`,
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          data: { category: "hardware" },
        };

        const response = await axios.request(config);
        if (response.data.status && response.data.data) {
          // Extract the value field from each config item
          const subCategories = response.data.data.map((item) => item.value);
          setHardwareSubCategories(subCategories);
        }
      } catch (error) {
        console.error("Error fetching hardware sub categories:", error);
        // Fallback to empty array if API fails
        setHardwareSubCategories([]);
      } finally {
        setLoadingSubCategories(false);
      }
    };

    fetchHardwareSubCategories();
  }, [getToken]);

  // Fetch measuring units from config API
  useEffect(() => {
    const fetchMeasuringUnits = async () => {
      try {
        setLoadingMeasuringUnits(true);
        const sessionToken = getToken();
        if (!sessionToken) {
          console.error("No valid session found");
          return;
        }

        const config = {
          method: "post",
          maxBodyLength: Infinity,
          url: `/api/config/read_all_by_category`,
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          data: { category: "measuring_unit" },
        };

        const response = await axios.request(config);
        if (response.data.status && response.data.data) {
          // Extract the value field from each config item
          const units = response.data.data.map((item) => item.value);
          setMeasuringUnitOptions(units);
        }
      } catch (error) {
        console.error("Error fetching measuring units:", error);
        // Fallback to empty array if API fails
        setMeasuringUnitOptions([]);
      } finally {
        setLoadingMeasuringUnits(false);
      }
    };

    fetchMeasuringUnits();
  }, [getToken]);

  // Fetch finishes from config API
  useEffect(() => {
    const fetchFinishes = async () => {
      try {
        setLoadingFinishes(true);
        const sessionToken = getToken();
        if (!sessionToken) {
          console.error("No valid session found");
          return;
        }

        const config = {
          method: "post",
          maxBodyLength: Infinity,
          url: `/api/config/read_all_by_category`,
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          data: { category: "finish" },
        };

        const response = await axios.request(config);
        if (response.data.status && response.data.data) {
          // Extract the value field from each config item
          const finishes = response.data.data.map((item) => item.value);
          setFinishOptions(finishes);
        }
      } catch (error) {
        console.error("Error fetching finishes:", error);
        // Fallback to empty array if API fails
        setFinishOptions([]);
      } finally {
        setLoadingFinishes(false);
      }
    };

    fetchFinishes();
  }, [getToken]);

  useEffect(() => {
    fetchItem();
    fetchSuppliers();
  }, [id]);

  useEffect(() => {
    setStockTxCurrentPage(1);
  }, [id]);

  useEffect(() => {
    if (stockTxTotalPages > 0 && stockTxCurrentPage > stockTxTotalPages) {
      setStockTxCurrentPage(stockTxTotalPages);
    }
  }, [stockTxCurrentPage, stockTxTotalPages]);

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest(".dropdown-container")) {
        setShowDropdown(false);
      }
      if (
        subCategoryDropdownRef.current &&
        !subCategoryDropdownRef.current.contains(event.target)
      ) {
        setIsSubCategoryDropdownOpen(false);
      }
      if (
        supplierDropdownRef.current &&
        !supplierDropdownRef.current.contains(event.target)
      ) {
        setIsSupplierDropdownOpen(false);
      }
      if (
        measuringUnitDropdownRef.current &&
        !measuringUnitDropdownRef.current.contains(event.target)
      ) {
        setIsMeasuringUnitDropdownOpen(false);
      }
      if (
        finishDropdownRef.current &&
        !finishDropdownRef.current.contains(event.target)
      ) {
        setIsFinishDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown, isSubCategoryDropdownOpen, isSupplierDropdownOpen, isMeasuringUnitDropdownOpen, isFinishDropdownOpen]);

  const fetchItem = async () => {
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
      const response = await axios.get(`/api/item/${id}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (response.data.status) {
        setItem(response.data.data);
        // Set selected supplier if item has supplier
        if (response.data.data.supplier_id && response.data.data.supplier) {
          setSelectedSupplier(response.data.data.supplier);
          setSupplierSearchTerm(response.data.data.supplier.name);
        }
      } else {
        setError(response.data.message || "Failed to fetch item data");
      }
    } catch (err) {
      console.error("API Error:", err);
      console.error("Error Response:", err.response?.data);
      setError(
        err.response?.data?.message ||
        "An error occurred while fetching item data"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        return;
      }
      const response = await axios.get(`/api/supplier/all`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (response.data.status) {
        setSuppliers(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching suppliers:", err);
    }
  };

  const handleSubCategorySelect = (subCategory) => {
    setFormData({
      ...formData,
      sub_category: subCategory,
    });
    setSubCategorySearchTerm(subCategory);
    setIsSubCategoryDropdownOpen(false);
  };

  const handleSubCategorySearchChange = (e) => {
    setSubCategorySearchTerm(e.target.value);
    setIsSubCategoryDropdownOpen(true);
    // Update form data with user input
    setFormData({
      ...formData,
      sub_category: e.target.value,
    });
  };

  // Handle create new hardware sub category
  const handleCreateNewSubCategory = async () => {
    if (!newSubCategoryValue || !newSubCategoryValue.trim()) {
      toast.error("Sub category value is required");
      return;
    }

    try {
      setIsCreatingSubCategory(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `/api/config/create`,
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        data: {
          category: "hardware",
          value: newSubCategoryValue.trim(),
        },
      };

      const response = await axios.request(config);
      if (response.data.status) {
        toast.success("Hardware sub category created successfully");
        // Refresh sub categories list
        const fetchHardwareSubCategories = async () => {
          try {
            const config = {
              method: "post",
              maxBodyLength: Infinity,
              url: `/api/config/read_all_by_category`,
              headers: {
                Authorization: `Bearer ${sessionToken}`,
                "Content-Type": "application/json",
              },
              data: { category: "hardware" },
            };
            const response = await axios.request(config);
            if (response.data.status && response.data.data) {
              const subCategories = response.data.data.map((item) => item.value);
              setHardwareSubCategories(subCategories);
            }
          } catch (error) {
            console.error("Error fetching hardware sub categories:", error);
          }
        };
        await fetchHardwareSubCategories();
        // Set the new sub category as selected
        setFormData({
          ...formData,
          sub_category: newSubCategoryValue.trim(),
        });
        setSubCategorySearchTerm(newSubCategoryValue.trim());
        setShowCreateSubCategoryModal(false);
        setNewSubCategoryValue("");
        setIsSubCategoryDropdownOpen(false);
      } else {
        toast.error(response.data.message || "Failed to create sub category");
      }
    } catch (error) {
      console.error("Error creating sub category:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create sub category";
      toast.error(errorMessage);
    } finally {
      setIsCreatingSubCategory(false);
    }
  };

  const filteredSuppliers = suppliers.filter((supplier) =>
    supplier.name.toLowerCase().includes(supplierSearchTerm.toLowerCase())
  );

  const handleSupplierSelect = (supplier) => {
    setSelectedSupplier(supplier);
    setSupplierSearchTerm(supplier.name);
    setFormData({
      ...formData,
      supplier_id: supplier.supplier_id,
    });
    setIsSupplierDropdownOpen(false);
  };

  // Measuring unit handlers
  const filteredMeasuringUnits = measuringUnitOptions.filter((unit) =>
    unit.toLowerCase().includes(measuringUnitSearchTerm.toLowerCase())
  );

  const handleMeasuringUnitSelect = (unit) => {
    handleInputChange("measurement_unit", unit);
    setMeasuringUnitSearchTerm(unit);
    setIsMeasuringUnitDropdownOpen(false);
  };

  const handleMeasuringUnitSearchChange = (e) => {
    const value = e.target.value;
    setMeasuringUnitSearchTerm(value);
    setIsMeasuringUnitDropdownOpen(true);
    handleInputChange("measurement_unit", value);
  };

  // Finish handlers
  const filteredFinishes = finishOptions.filter((finish) =>
    finish.toLowerCase().includes(finishSearchTerm.toLowerCase())
  );

  const handleFinishSelect = (finish) => {
    handleInputChange("finish", finish);
    setFinishSearchTerm(finish);
    setIsFinishDropdownOpen(false);
  };

  const handleFinishSearchChange = (e) => {
    const value = e.target.value;
    setFinishSearchTerm(value);
    setIsFinishDropdownOpen(true);
    handleInputChange("finish", value);
  };

  // Handle create new finish
  const handleCreateNewFinish = async () => {
    if (!newFinishValue || !newFinishValue.trim()) {
      toast.error("Finish value is required");
      return;
    }

    try {
      setIsCreatingFinish(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `/api/config/create`,
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        data: {
          category: "finish",
          value: newFinishValue.trim(),
        },
      };

      const response = await axios.request(config);
      if (response.data.status) {
        toast.success("Finish created successfully");
        // Refresh finishes list
        const fetchFinishes = async () => {
          try {
            const config = {
              method: "post",
              maxBodyLength: Infinity,
              url: `/api/config/read_all_by_category`,
              headers: {
                Authorization: `Bearer ${sessionToken}`,
                "Content-Type": "application/json",
              },
              data: { category: "finish" },
            };
            const response = await axios.request(config);
            if (response.data.status && response.data.data) {
              const finishes = response.data.data.map((item) => item.value);
              setFinishOptions(finishes);
            }
          } catch (error) {
            console.error("Error fetching finishes:", error);
          }
        };
        await fetchFinishes();
        // Set the new finish as selected
        handleInputChange("finish", newFinishValue.trim());
        setFinishSearchTerm(newFinishValue.trim());
        setShowCreateFinishModal(false);
        setNewFinishValue("");
        setIsFinishDropdownOpen(false);
      } else {
        toast.error(response.data.message || "Failed to create finish");
      }
    } catch (error) {
      console.error("Error creating finish:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create finish";
      toast.error(errorMessage);
    } finally {
      setIsCreatingFinish(false);
    }
  };

  // Handle create new measuring unit
  const handleCreateNewMeasuringUnit = async () => {
    if (!newMeasuringUnitValue || !newMeasuringUnitValue.trim()) {
      toast.error("Measuring unit value is required");
      return;
    }

    try {
      setIsCreatingMeasuringUnit(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `/api/config/create`,
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        data: {
          category: "measuring_unit",
          value: newMeasuringUnitValue.trim(),
        },
      };

      const response = await axios.request(config);
      if (response.data.status) {
        toast.success("Measuring unit created successfully");
        // Refresh measuring units list
        const fetchMeasuringUnits = async () => {
          try {
            const config = {
              method: "post",
              maxBodyLength: Infinity,
              url: `/api/config/read_all_by_category`,
              headers: {
                Authorization: `Bearer ${sessionToken}`,
                "Content-Type": "application/json",
              },
              data: { category: "measuring_unit" },
            };
            const response = await axios.request(config);
            if (response.data.status && response.data.data) {
              const units = response.data.data.map((item) => item.value);
              setMeasuringUnitOptions(units);
            }
          } catch (error) {
            console.error("Error fetching measuring units:", error);
          }
        };
        await fetchMeasuringUnits();
        // Set the new measuring unit as selected
        handleInputChange("measurement_unit", newMeasuringUnitValue.trim());
        setMeasuringUnitSearchTerm(newMeasuringUnitValue.trim());
        setShowCreateMeasuringUnitModal(false);
        setNewMeasuringUnitValue("");
        setIsMeasuringUnitDropdownOpen(false);
      } else {
        toast.error(response.data.message || "Failed to create measuring unit");
      }
    } catch (error) {
      console.error("Error creating measuring unit:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create measuring unit";
      toast.error(errorMessage);
    } finally {
      setIsCreatingMeasuringUnit(false);
    }
  };

  const handleSupplierSearchChange = (e) => {
    setSupplierSearchTerm(e.target.value);
    setIsSupplierDropdownOpen(true);
    // Clear supplier selection if search term is empty
    if (e.target.value === "") {
      setSelectedSupplier(null);
      setFormData({
        ...formData,
        supplier_id: null,
      });
    }
  };

  // Initialize edit form with current item data
  const handleEdit = () => {
    if (item) {
      const editFormData = {
        description: item.description || "",
        price: item.price || "",
        quantity: item.quantity || "",
        supplier_id: item.supplier_id || "",
        measurement_unit: item.measurement_unit || "",
        supplier_reference: item.supplier_reference || "",
        supplier_product_link: item.supplier_product_link || "",
      };
      // Initialize measuring unit search term
      setMeasuringUnitSearchTerm(item.measurement_unit || "");
      // Initialize finish search term based on category
      if (category === "sheet" && item.sheet?.finish) {
        setFinishSearchTerm(item.sheet.finish);
      } else if (category === "edging_tape" && item.edging_tape?.finish) {
        setFinishSearchTerm(item.edging_tape.finish);
      } else {
        setFinishSearchTerm("");
      }

      // Add category-specific fields based on category
      const category = item.category.toLowerCase();
      if (category === "sheet" && item.sheet) {
        editFormData.brand = item.sheet?.brand || "";
        editFormData.color = item.sheet?.color || "";
        editFormData.finish = item.sheet?.finish || "";
        editFormData.face = item.sheet?.face || "";
        editFormData.dimensions = item.sheet?.dimensions || "";
        editFormData.is_sunmica = item.sheet?.is_sunmica || false;
      } else if (category === "handle" && item.handle) {
        editFormData.brand = item.handle?.brand || "";
        editFormData.color = item.handle?.color || "";
        editFormData.type = item.handle?.type || "";
        editFormData.material = item.handle?.material || "";
        editFormData.dimensions = item.handle?.dimensions || "";
      } else if (category === "hardware" && item.hardware) {
        editFormData.brand = item.hardware?.brand || "";
        editFormData.name = item.hardware?.name || "";
        editFormData.type = item.hardware?.type || "";
        editFormData.dimensions = item.hardware?.dimensions || "";
        editFormData.sub_category = item.hardware?.sub_category || "";
        // Initialize subcategory search term
        setSubCategorySearchTerm(item.hardware?.sub_category || "");
      } else if (category === "accessory" && item.accessory) {
        editFormData.name = item.accessory?.name || "";
      } else if (category === "edging_tape" && item.edging_tape) {
        editFormData.brand = item.edging_tape?.brand || "";
        editFormData.color = item.edging_tape?.color || "";
        editFormData.finish = item.edging_tape?.finish || "";
        editFormData.dimensions = item.edging_tape?.dimensions || "";
      }

      setFormData(editFormData);
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    try {
      setIsUpdating(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      // Convert object to FormData for API
      const formDataToSend = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        // Convert boolean to string for FormData
        if (typeof value === "boolean") {
          formDataToSend.append(key, value.toString());
        } else if (value !== null && value !== undefined && value !== "") {
          formDataToSend.append(key, value);
        }
      });

      // Add new image if selected
      if (newImage) {
        formDataToSend.append("image", newImage);
      } else if (deleteImage) {
        // Send empty string to delete the image
        formDataToSend.append("image", "");
      }

      // Show progress toast only if there's a new image file
      if (newImage) {
        showProgressToast(1);
      }

      const response = await axios.patch(`/api/item/${id}`, formDataToSend, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "multipart/form-data",
        },
        ...(newImage && {
          onUploadProgress: getUploadProgressHandler(1),
        }),
      });

      if (response.data.status) {
        setItem(response.data.data);
        if (newImage) {
          completeUpload(1);
        } else {
          toast.success("Item updated successfully!", {
            position: "top-right",
            autoClose: 3000,
          });
        }
        setItem(response.data.data);
        setIsEditing(false);
        setNewImage(null);
        setImagePreview(null);
        setDeleteImage(false);
      } else {
        if (newImage) {
          dismissProgressToast();
        }
        toast.error(response.data.message || "Failed to update item", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (error) {
      console.error("Error updating item:", error);
      if (newImage) {
        dismissProgressToast();
      }
      toast.error(
        error.response?.data?.message ||
        "Failed to update item. Please try again.",
        {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        }
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setFormData({});
    setNewImage(null);
    setImagePreview(null);
    setDeleteImage(false);
    setSubCategorySearchTerm("");
    setIsSubCategoryDropdownOpen(false);
    // Reset supplier state
    if (item && item.supplier) {
      setSelectedSupplier(item.supplier);
      setSupplierSearchTerm(item.supplier.name);
    } else {
      setSelectedSupplier(null);
      setSupplierSearchTerm("");
    }
    // Reset finish search term
    const category = item?.category?.toLowerCase();
    if (category === "sheet" && item?.sheet?.finish) {
      setFinishSearchTerm(item.sheet.finish);
    } else if (category === "edging_tape" && item?.edging_tape?.finish) {
      setFinishSearchTerm(item.edging_tape.finish);
    } else {
      setFinishSearchTerm("");
    }
    setIsFinishDropdownOpen(false);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewImage(file);
      setDeleteImage(false); // Reset delete flag when new image is selected
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteImage = () => {
    setDeleteImage(true);
    setNewImage(null);
    setImagePreview(null);
  };

  const handleDeleteConfirm = async () => {
    try {
      setIsDeleting(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const response = await axios.delete(`/api/item/${id}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        toast.success("Item deleted successfully");
        setShowDeleteModal(false);
        // Navigate back to inventory list
        window.location.href = "/admin/inventory";
      } else {
        toast.error(response.data.message || "Failed to delete item");
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Failed to delete item. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const formatValue = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      value === "null"
    ) {
      return "-";
    }
    if (typeof value === "string" && value.trim() === "") {
      return "-";
    }
    return value;
  };

  const toggleNotes = (transactionId) => {
    setExpandedNotes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(transactionId)) {
        newSet.delete(transactionId);
      } else {
        newSet.add(transactionId);
      }
      return newSet;
    });
  };

  const getItemTitle = () => {
    if (!item) return "";
    const category = item.category.toLowerCase();
    if (category === "sheet" && item.sheet) {
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

  const renderCategorySpecificFields = () => {
    if (!item) return null;

    const category = item.category.toLowerCase();

    if (category === "sheet") {
      return (
        <>
          <InfoField
            label="Brand"
            value={item.sheet.brand}
            field="brand"
            icon={<Tag className="w-3.5 h-3.5" />}
            isEditing={isEditing}
            formData={formData}
            handleInputChange={handleInputChange}
            formatValue={formatValue}
          />
          <InfoField
            label="Color"
            value={item.sheet.color}
            field="color"
            icon={<SwatchBook className="w-3.5 h-3.5" />}
            isEditing={isEditing}
            formData={formData}
            handleInputChange={handleInputChange}
            formatValue={formatValue}
          />
          {isEditing ? (
            <div className="relative" ref={finishDropdownRef}>
              <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Finish
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={finishSearchTerm || formData.finish || ""}
                  onChange={handleFinishSearchChange}
                  onFocus={() => setIsFinishDropdownOpen(true)}
                  placeholder={formatValue(item.sheet.finish)}
                  className="w-full text-sm text-slate-800 px-2 py-1 pr-8 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setIsFinishDropdownOpen(!isFinishDropdownOpen)
                  }
                  className="cursor-pointer absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${isFinishDropdownOpen ? "rotate-180" : ""
                      }`}
                  />
                </button>
              </div>

              {isFinishDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {loadingFinishes ? (
                    <div className="px-4 py-3 text-sm text-slate-500 text-center">
                      Loading finishes...
                    </div>
                  ) : filteredFinishes.length > 0 ? (
                    <>
                      {filteredFinishes.map((finish, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleFinishSelect(finish)}
                          className="cursor-pointer w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg"
                        >
                          {finish}
                        </button>
                      ))}
                      {finishSearchTerm && !filteredFinishes.some(f => f.toLowerCase() === finishSearchTerm.toLowerCase()) && (
                        <div className="border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => {
                              setNewFinishValue(finishSearchTerm);
                              setShowCreateFinishModal(true);
                            }}
                            className="cursor-pointer w-full text-left px-4 py-3 text-sm text-primary font-medium hover:bg-primary/10 transition-colors flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Create "{finishSearchTerm}"
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="px-4 py-3">
                      <div className="text-sm text-slate-500 mb-2">
                        No matching finishes found
                      </div>
                      {finishSearchTerm && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewFinishValue(finishSearchTerm);
                            setShowCreateFinishModal(true);
                          }}
                          className="cursor-pointer w-full px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Create "{finishSearchTerm}"
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <InfoField
              label="Finish"
              value={item.sheet.finish}
              field="finish"
              icon={<Layers className="w-3.5 h-3.5" />}
              isEditing={isEditing}
              formData={formData}
              handleInputChange={handleInputChange}
              formatValue={formatValue}
            />
          )}
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5" />
              Face
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.face || ""}
                onChange={(e) => handleInputChange("face", e.target.value)}
                placeholder={formatValue(item.sheet.face)}
                disabled={formData.is_sunmica}
                className={`w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none ${formData.is_sunmica ? "bg-slate-100 cursor-not-allowed" : ""
                  }`}
              />
            ) : (
              <p className="text-sm text-slate-800">
                {formatValue(item.sheet.face)}
              </p>
            )}
          </div>
          <InfoField
            label="Dimensions"
            value={item.sheet.dimensions}
            field="dimensions"
            icon={<Hash className="w-3.5 h-3.5" />}
            isEditing={isEditing}
            formData={formData}
            handleInputChange={handleInputChange}
            formatValue={formatValue}
          />
          {/* Is Sunmica Checkbox */}
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5" />
              Is Sunmica
            </label>
            {isEditing ? (
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={formData.is_sunmica || false}
                  onChange={(e) => {
                    handleInputChange("is_sunmica", e.target.checked);
                    // If is_sunmica is checked, set face to "1" and disable it
                    if (e.target.checked) {
                      handleInputChange("face", "1");
                    } else if (
                      formData.face === "1" ||
                      item.sheet?.face === "1"
                    ) {
                      // If is_sunmica is unchecked and face was "1", clear it
                      handleInputChange("face", "");
                    }
                  }}
                  className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-2 focus:ring-primary cursor-pointer"
                />
                <span className="text-sm text-slate-800">
                  This is a sunmica item
                </span>
              </label>
            ) : (
              <p className="text-sm text-slate-800">
                {item.sheet.is_sunmica ? "Yes" : "No"}
              </p>
            )}
            {isEditing && formData.is_sunmica && (
              <p className="mt-1 text-xs text-slate-500">
                Face field is automatically set to "1" for sunmica items
              </p>
            )}
          </div>
        </>
      );
    }

    if (category === "handle") {
      return (
        <>
          <InfoField
            label="Brand"
            value={item.handle.brand}
            field="brand"
            icon={<Tag className="w-3.5 h-3.5" />}
            isEditing={isEditing}
            formData={formData}
            handleInputChange={handleInputChange}
            formatValue={formatValue}
          />
          <InfoField
            label="Color"
            value={item.handle.color}
            field="color"
            icon={<SwatchBook className="w-3.5 h-3.5" />}
            isEditing={isEditing}
            formData={formData}
            handleInputChange={handleInputChange}
            formatValue={formatValue}
          />
          <InfoField
            label="Type"
            value={item.handle.type}
            field="type"
            icon={<Layers className="w-3.5 h-3.5" />}
            isEditing={isEditing}
            formData={formData}
            handleInputChange={handleInputChange}
            formatValue={formatValue}
          />
          <InfoField
            label="Material"
            value={item.handle.material}
            field="material"
            icon={<Box className="w-3.5 h-3.5" />}
            isEditing={isEditing}
            formData={formData}
            handleInputChange={handleInputChange}
            formatValue={formatValue}
          />
          <InfoField
            label="Dimensions"
            value={item.handle.dimensions}
            field="dimensions"
            icon={<Hash className="w-3.5 h-3.5" />}
            isEditing={isEditing}
            formData={formData}
            handleInputChange={handleInputChange}
            formatValue={formatValue}
          />
        </>
      );
    }

    if (category === "hardware") {
      return (
        <>
          {/* Sub Category Field with Dropdown */}
          <div>
            <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              Sub Category
            </label>
            {isEditing ? (
              <div className="relative" ref={subCategoryDropdownRef}>
                <input
                  type="text"
                  value={subCategorySearchTerm}
                  onChange={handleSubCategorySearchChange}
                  onFocus={() => setIsSubCategoryDropdownOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setIsSubCategoryDropdownOpen(false);
                    }
                  }}
                  placeholder="Search or enter sub category..."
                  className="w-full text-sm text-slate-800 px-2 py-1 pr-8 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setIsSubCategoryDropdownOpen(!isSubCategoryDropdownOpen)
                  }
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${isSubCategoryDropdownOpen ? "rotate-180" : ""
                      }`}
                  />
                </button>

                  {isSubCategoryDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                      {loadingSubCategories ? (
                        <div className="px-3 py-2 text-xs text-slate-500 text-center">
                          Loading sub categories...
                        </div>
                      ) : filteredSubCategories.length > 0 ? (
                        <>
                          {filteredSubCategories.map((subCategory, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => handleSubCategorySelect(subCategory)}
                              className="w-full text-left px-3 py-2 text-xs text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg"
                            >
                              {subCategory}
                            </button>
                          ))}
                          {subCategorySearchTerm && !filteredSubCategories.some(sc => sc.toLowerCase() === subCategorySearchTerm.toLowerCase()) && (
                            <div className="border-t border-slate-200">
                              <button
                                type="button"
                                onClick={() => {
                                  setNewSubCategoryValue(subCategorySearchTerm);
                                  setShowCreateSubCategoryModal(true);
                                }}
                                className="cursor-pointer w-full text-left px-3 py-2 text-xs text-primary font-medium hover:bg-primary/10 transition-colors flex items-center gap-2"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Create "{subCategorySearchTerm}"
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="px-3 py-2">
                          <div className="text-xs text-slate-500 mb-2 text-center">
                            No matching sub categories found
                          </div>
                          {subCategorySearchTerm && (
                            <button
                              type="button"
                              onClick={() => {
                                setNewSubCategoryValue(subCategorySearchTerm);
                                setShowCreateSubCategoryModal(true);
                              }}
                              className="cursor-pointer w-full px-3 py-2 text-xs text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors flex items-center justify-center gap-2"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Create "{subCategorySearchTerm}"
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
              </div>
            ) : (
              <p className="text-sm text-slate-800">
                {formatValue(item.hardware.sub_category)}
              </p>
            )}
          </div>

          <InfoField
            label="Brand"
            value={item.hardware.brand}
            field="brand"
            icon={<Tag className="w-3.5 h-3.5" />}
            isEditing={isEditing}
            formData={formData}
            handleInputChange={handleInputChange}
            formatValue={formatValue}
          />
          <InfoField
            label="Name"
            value={item.hardware.name}
            field="name"
            icon={<FileText className="w-3.5 h-3.5" />}
            isEditing={isEditing}
            formData={formData}
            handleInputChange={handleInputChange}
            formatValue={formatValue}
          />
          <InfoField
            label="Type"
            value={item.hardware.type}
            field="type"
            icon={<Box className="w-3.5 h-3.5" />}
            isEditing={isEditing}
            formData={formData}
            handleInputChange={handleInputChange}
            formatValue={formatValue}
          />
          <InfoField
            label="Dimensions"
            value={item.hardware.dimensions}
            field="dimensions"
            icon={<Hash className="w-3.5 h-3.5" />}
            isEditing={isEditing}
            formData={formData}
            handleInputChange={handleInputChange}
            formatValue={formatValue}
          />
        </>
      );
    }

    if (category === "accessory") {
      return (
        <InfoField
          label="Item Name"
          value={item.accessory.name}
          field="name"
          icon={<FileText className="w-3.5 h-3.5" />}
          fullWidth
          isEditing={isEditing}
          formData={formData}
          handleInputChange={handleInputChange}
          formatValue={formatValue}
        />
      );
    }

    if (category === "edging_tape") {
      return (
        <>
          <InfoField
            label="Brand"
            value={item.edging_tape.brand}
            field="brand"
            icon={<Tag className="w-3.5 h-3.5" />}
            isEditing={isEditing}
            formData={formData}
            handleInputChange={handleInputChange}
            formatValue={formatValue}
          />
          <InfoField
            label="Color"
            value={item.edging_tape.color}
            field="color"
            icon={<SwatchBook className="w-3.5 h-3.5" />}
            isEditing={isEditing}
            formData={formData}
            handleInputChange={handleInputChange}
            formatValue={formatValue}
          />
          {isEditing ? (
            <div className="relative" ref={finishDropdownRef}>
              <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Finish
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={finishSearchTerm || formData.finish || ""}
                  onChange={handleFinishSearchChange}
                  onFocus={() => setIsFinishDropdownOpen(true)}
                  placeholder={formatValue(item.edging_tape.finish)}
                  className="w-full text-sm text-slate-800 px-2 py-1 pr-8 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setIsFinishDropdownOpen(!isFinishDropdownOpen)
                  }
                  className="cursor-pointer absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${isFinishDropdownOpen ? "rotate-180" : ""
                      }`}
                  />
                </button>
              </div>

              {isFinishDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {loadingFinishes ? (
                    <div className="px-4 py-3 text-sm text-slate-500 text-center">
                      Loading finishes...
                    </div>
                  ) : filteredFinishes.length > 0 ? (
                    <>
                      {filteredFinishes.map((finish, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleFinishSelect(finish)}
                          className="cursor-pointer w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg"
                        >
                          {finish}
                        </button>
                      ))}
                      {finishSearchTerm && !filteredFinishes.some(f => f.toLowerCase() === finishSearchTerm.toLowerCase()) && (
                        <div className="border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => {
                              setNewFinishValue(finishSearchTerm);
                              setShowCreateFinishModal(true);
                            }}
                            className="cursor-pointer w-full text-left px-4 py-3 text-sm text-primary font-medium hover:bg-primary/10 transition-colors flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Create "{finishSearchTerm}"
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="px-4 py-3">
                      <div className="text-sm text-slate-500 mb-2">
                        No matching finishes found
                      </div>
                      {finishSearchTerm && (
                        <button
                          type="button"
                          onClick={() => {
                            setNewFinishValue(finishSearchTerm);
                            setShowCreateFinishModal(true);
                          }}
                          className="cursor-pointer w-full px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Create "{finishSearchTerm}"
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <InfoField
              label="Finish"
              value={item.edging_tape.finish}
              field="finish"
              icon={<Layers className="w-3.5 h-3.5" />}
              isEditing={isEditing}
              formData={formData}
              handleInputChange={handleInputChange}
              formatValue={formatValue}
            />
          )}
          <InfoField
            label="Dimensions"
            value={item.edging_tape.dimensions}
            field="dimensions"
            icon={<Hash className="w-3.5 h-3.5" />}
            isEditing={isEditing}
            formData={formData}
            handleInputChange={handleInputChange}
            formatValue={formatValue}
          />
        </>
      );
    }

    return null;
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
                  <p className="text-slate-600">Loading item details...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-red-600 mb-4">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="cursor-pointer px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : !item ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Package className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">Item not found</p>
                </div>
              </div>
            ) : (
              <div className="p-3">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <TabsController href="/admin/inventory" title="Inventory">
                    <div className="cursor-pointer p-2 hover:bg-slate-200 rounded-lg transition-colors">
                      <ChevronLeft className="w-6 h-6 text-slate-600" />
                    </div>
                  </TabsController>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-600">
                      {getItemTitle()}
                    </h1>
                  </div>
                  <div className="flex gap-2">
                    {!isEditing ? (
                      <div className="relative dropdown-container">
                        <button
                          onClick={() => setShowDropdown(!showDropdown)}
                          className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <CiMenuKebab className="w-4 h-4 text-slate-600" />
                          <span className="text-slate-600">More Actions</span>
                        </button>

                        {showDropdown && (
                          <div className="absolute right-0 mt-2 w-50 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  handleEdit();
                                  setShowDropdown(false);
                                }}
                                className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                              >
                                <Edit className="w-4 h-4" />
                                Edit Item Details
                              </button>
                              <button
                                onClick={() => {
                                  setShowDeleteModal(true);
                                  setShowDropdown(false);
                                }}
                                className="cursor-pointer w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center gap-3"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete Item
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={handleSave}
                          disabled={isUpdating}
                          className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Edit className="w-4 h-4" />
                          {isUpdating ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={handleCancel}
                          className="cursor-pointer flex items-center gap-2 px-4 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md transition-all duration-200 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-4">
                  {/* Main Info and Details Section */}
                  <div className="grid grid-cols-10 gap-4">
                    {/* Main Information - 70% width */}
                    <div className="col-span-7">
                      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                        <div className="flex items-start gap-4">
                          <div className="relative w-16 h-16 overflow-hidden rounded-lg group">
                            {isEditing && !deleteImage && (
                              <button
                                onClick={handleDeleteImage}
                                className="cursor-pointer absolute top-1 right-1 z-10 p-1 bg-red-500 hover:bg-red-600 text-white rounded transition-all duration-200"
                                title="Delete Image"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                            {deleteImage && !imagePreview ? (
                              <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-lg border border-slate-200">
                                <div className="text-center">
                                  <Trash2 className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                                  <p className="text-xs text-slate-500">
                                    Image will be deleted
                                  </p>
                                </div>
                              </div>
                            ) : item.image?.url || imagePreview ? (
                              <button
                                onClick={() =>
                                  (item.image?.url || imagePreview) &&
                                  setSelectedFile(true)
                                }
                              >
                                <Image
                                  src={imagePreview || `/${item.image.url}`}
                                  alt={item.item_id}
                                  fill
                                  className="cursor-pointer object-cover rounded-lg border border-slate-200 transition-all duration-300 group-hover:scale-110"
                                />
                              </button>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-lg border border-slate-200">
                                <Package className="w-6 h-6 text-slate-400" />
                              </div>
                            )}
                            {isEditing && (
                              <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-1">
                                <label className="cursor-pointer px-2 py-1 bg-primary/90 hover:bg-primary text-white text-xs font-medium rounded transition-all duration-200">
                                  Change
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h2 className="text-lg font-bold text-slate-800">
                                {getItemTitle()}
                              </h2>
                              <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full capitalize">
                                {item.category
                                  .toLowerCase()
                                  .charAt(0)
                                  .toUpperCase() +
                                  item.category.toLowerCase().slice(1)}
                              </span>
                              {item.category.toLowerCase() === "sheet" &&
                                item.sheet?.is_sunmica && (
                                  <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 rounded-full">
                                    Sunmica
                                  </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 mb-3">
                              ID: {item.item_id}
                            </p>
                            <div className="space-y-3">
                              <div>
                                <label className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                                  Description
                                </label>
                                {isEditing ? (
                                  <textarea
                                    value={formData.description || ""}
                                    onChange={(e) =>
                                      handleInputChange(
                                        "description",
                                        e.target.value
                                      )
                                    }
                                    placeholder={formatValue(item.description)}
                                    rows={3}
                                    className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                                  />
                                ) : (
                                  <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded">
                                    {formatValue(item.description)}
                                  </p>
                                )}
                              </div>

                              {/* Pricing & Stock Information */}
                              <div className="grid grid-cols-3 gap-4 pt-3 border-t border-slate-200">
                                <div>
                                  <label className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                                    Quantity in Stock
                                  </label>
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      value={formData.quantity || ""}
                                      onChange={(e) =>
                                        handleInputChange(
                                          "quantity",
                                          e.target.value
                                        )
                                      }
                                      placeholder={formatValue(item.quantity)}
                                      className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                                    />
                                  ) : (
                                    <p className="text-sm font-bold text-slate-800">
                                      {formatValue(item.quantity)}
                                      {item.measurement_unit && (
                                        <span className="ml-1 text-slate-600 text-xs font-normal">
                                          {item.measurement_unit}
                                        </span>
                                      )}
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <label className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                                    Price per Unit (including GST)
                                  </label>
                                  {isEditing ? (
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-600 text-sm">
                                        $
                                      </span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={formData.price || ""}
                                        onChange={(e) =>
                                          handleInputChange(
                                            "price",
                                            e.target.value
                                          )
                                        }
                                        placeholder={formatValue(item.price)}
                                        className="w-full text-sm text-slate-800 pl-7 pr-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                                      />
                                    </div>
                                  ) : (
                                    <p className="text-sm font-bold text-emerald-600">
                                      ${formatValue(item.price)}
                                    </p>
                                  )}
                                </div>
                                {!isEditing && (
                                  <div>
                                    <label className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                                      Total Value
                                    </label>
                                    <p className="text-sm font-bold text-slate-800">
                                      $
                                      {(
                                        parseFloat(item.price || 0) *
                                        parseInt(item.quantity || 0)
                                      ).toFixed(2)}
                                    </p>
                                  </div>
                                )}
                              </div>

                              {/* Supplier and Measurement Unit */}
                              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                                {/* Supplier Field */}
                                <div>
                                  <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5" />
                                    Supplier
                                  </label>
                                  {isEditing ? (
                                    <div
                                      className="relative"
                                      ref={supplierDropdownRef}
                                    >
                                      <input
                                        type="text"
                                        value={supplierSearchTerm}
                                        onChange={handleSupplierSearchChange}
                                        onFocus={() =>
                                          setIsSupplierDropdownOpen(true)
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            e.preventDefault();
                                            setIsSupplierDropdownOpen(false);
                                          }
                                        }}
                                        placeholder="Search supplier..."
                                        className="w-full text-sm text-slate-800 px-2 py-1 pr-8 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setIsSupplierDropdownOpen(
                                            !isSupplierDropdownOpen
                                          )
                                        }
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                      >
                                        <ChevronDown
                                          className={`w-3.5 h-3.5 transition-transform duration-200 ${isSupplierDropdownOpen
                                            ? "rotate-180"
                                            : ""
                                            }`}
                                        />
                                      </button>

                                      {isSupplierDropdownOpen && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                                          {filteredSuppliers.length > 0 ? (
                                            filteredSuppliers.map((supplier) => (
                                              <button
                                                key={supplier.supplier_id}
                                                type="button"
                                                onClick={() =>
                                                  handleSupplierSelect(supplier)
                                                }
                                                className="cursor-pointer w-full text-left px-3 py-2 text-xs text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg last:rounded-b-lg"
                                              >
                                                <div className="font-medium">
                                                  {supplier.name}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                  {supplier.supplier_id}
                                                </div>
                                              </button>
                                            ))
                                          ) : (
                                            <div className="px-3 py-2 text-xs text-slate-500 text-center">
                                              No suppliers found
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div>
                                      {item.supplier ? (
                                        <p
                                          className="text-sm text-slate-800 hover:text-primary hover:underline cursor-pointer transition-colors"
                                          onClick={() =>
                                            router.push(
                                              `/admin/suppliers/${item.supplier.supplier_id}`
                                            )
                                          }
                                        >
                                          {item.supplier.name}
                                        </p>
                                      ) : (
                                        <p className="text-sm text-slate-800">
                                          -
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Measurement Unit Field */}
                                <div className="relative" ref={measuringUnitDropdownRef}>
                                  <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1.5">
                                    <Ruler className="w-3.5 h-3.5" />
                                    Measurement Unit
                                  </label>
                                  {isEditing ? (
                                    <>
                                      <div className="relative">
                                        <input
                                          type="text"
                                          value={measuringUnitSearchTerm || formData.measurement_unit || ""}
                                          onChange={handleMeasuringUnitSearchChange}
                                          onFocus={() => setIsMeasuringUnitDropdownOpen(true)}
                                          placeholder={formatValue(item.measurement_unit)}
                                          className="w-full text-sm text-slate-800 px-2 py-1 pr-8 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setIsMeasuringUnitDropdownOpen(!isMeasuringUnitDropdownOpen)
                                          }
                                          className="cursor-pointer absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                          <ChevronDown
                                            className={`w-4 h-4 transition-transform ${isMeasuringUnitDropdownOpen ? "rotate-180" : ""
                                              }`}
                                          />
                                        </button>
                                      </div>

                                      {isMeasuringUnitDropdownOpen && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                                          {loadingMeasuringUnits ? (
                                            <div className="px-4 py-3 text-sm text-slate-500 text-center">
                                              Loading measuring units...
                                            </div>
                                          ) : filteredMeasuringUnits.length > 0 ? (
                                            <>
                                              {filteredMeasuringUnits.map((unit, index) => (
                                                <button
                                                  key={index}
                                                  type="button"
                                                  onClick={() => handleMeasuringUnitSelect(unit)}
                                                  className="cursor-pointer w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg"
                                                >
                                                  {unit}
                                                </button>
                                              ))}
                                              {measuringUnitSearchTerm && !filteredMeasuringUnits.some(u => u.toLowerCase() === measuringUnitSearchTerm.toLowerCase()) && (
                                                <div className="border-t border-slate-200">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setNewMeasuringUnitValue(measuringUnitSearchTerm);
                                                      setShowCreateMeasuringUnitModal(true);
                                                    }}
                                                    className="cursor-pointer w-full text-left px-4 py-3 text-sm text-primary font-medium hover:bg-primary/10 transition-colors flex items-center gap-2"
                                                  >
                                                    <Plus className="w-4 h-4" />
                                                    Create "{measuringUnitSearchTerm}"
                                                  </button>
                                                </div>
                                              )}
                                            </>
                                          ) : (
                                            <div className="px-4 py-3">
                                              <div className="text-sm text-slate-500 mb-2">
                                                No matching measuring units found
                                              </div>
                                              {measuringUnitSearchTerm && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setNewMeasuringUnitValue(measuringUnitSearchTerm);
                                                    setShowCreateMeasuringUnitModal(true);
                                                  }}
                                                  className="cursor-pointer w-full px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors flex items-center justify-center gap-2"
                                                >
                                                  <Plus className="w-4 h-4" />
                                                  Create "{measuringUnitSearchTerm}"
                                                </button>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <p className="text-sm text-slate-800">
                                      {formatValue(item.measurement_unit)}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Supplier Reference and Product Link */}
                              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-200">
                                {/* Supplier Reference Field */}
                                <div>
                                  <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1.5">
                                    <Tag className="w-3.5 h-3.5" />
                                    Supplier Reference
                                  </label>
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={formData.supplier_reference || ""}
                                      onChange={(e) =>
                                        handleInputChange(
                                          "supplier_reference",
                                          e.target.value
                                        )
                                      }
                                      placeholder={formatValue(
                                        item.supplier_reference
                                      )}
                                      className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                                    />
                                  ) : (
                                    <p className="text-sm text-slate-800">
                                      {formatValue(item.supplier_reference)}
                                    </p>
                                  )}
                                </div>

                                {/* Supplier Product Link Field */}
                                <div>
                                  <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 flex items-center gap-1.5">
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Supplier Product Link
                                  </label>
                                  {isEditing ? (
                                    <input
                                      type="url"
                                      value={formData.supplier_product_link || ""}
                                      onChange={(e) =>
                                        handleInputChange(
                                          "supplier_product_link",
                                          e.target.value
                                        )
                                      }
                                      placeholder={formatValue(
                                        item.supplier_product_link
                                      )}
                                      className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                                    />
                                  ) : (
                                    <p className="text-sm text-slate-800">
                                      {item.supplier_product_link ? (
                                        <a
                                          href={item.supplier_product_link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary hover:underline"
                                        >
                                          {item.supplier_product_link.length > 40
                                            ? `${item.supplier_product_link.substring(
                                              0,
                                              40
                                            )}...`
                                            : item.supplier_product_link}
                                        </a>
                                      ) : (
                                        formatValue(item.supplier_product_link)
                                      )}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Stock Transactions Section */}
                      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mt-4">
                        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                          <Package className="w-4 h-4" />
                          Stock Transactions
                        </h3>
                        {sortedStockTransactions.length > 0 ? (
                          <>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-slate-200">
                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wide w-8"></th>
                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                      Date
                                    </th>
                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                      Type
                                    </th>
                                    <th className="text-right py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                      Quantity
                                    </th>
                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                      Purchase Order
                                    </th>
                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                      Project Name
                                    </th>
                                    <th className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                                      Lot ID
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {currentStockTransactions.map((transaction) => (
                                    <React.Fragment key={transaction.id}>
                                      <tr
                                        className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${transaction.notes ? "cursor-pointer" : ""
                                          }`}
                                        onClick={() => transaction.notes && toggleNotes(transaction.id)}
                                      >
                                        <td className="py-2 px-3 whitespace-nowrap">
                                          {transaction.notes && (
                                            <div className="flex items-center">
                                              {expandedNotes.has(transaction.id) ? (
                                                <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                                              ) : (
                                                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                                              )}
                                            </div>
                                          )}
                                        </td>
                                        <td className="py-2 px-3 text-slate-700">
                                          {new Date(
                                            transaction.createdAt
                                          ).toLocaleString("en-US", {
                                            year: "numeric",
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </td>
                                        <td className="py-2 px-3">
                                          <span
                                            className={`px-2 py-1 text-xs font-medium rounded-full ${transaction.type === "ADDED"
                                              ? "bg-emerald-100 text-emerald-800"
                                              : transaction.type === "USED"
                                                ? "bg-blue-100 text-blue-800"
                                                : "bg-red-100 text-red-800"
                                              }`}
                                          >
                                            {transaction.type}
                                          </span>
                                        </td>
                                        <td className="py-2 px-3 text-right font-medium text-slate-800">
                                          {transaction.type === "ADDED" ? "+" : "-"}
                                          {transaction.quantity}
                                          {item.measurement_unit && (
                                            <span className="ml-1 text-xs text-slate-500 font-normal">
                                              {item.measurement_unit}
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2 px-3 text-slate-600">
                                          {transaction.type === "ADDED" &&
                                            transaction.purchase_order?.order_no ? (
                                            <span className="text-xs font-medium text-primary">
                                              {transaction.purchase_order.order_no}
                                            </span>
                                          ) : (
                                            "-"
                                          )}
                                        </td>
                                        <td className="py-2 px-3 text-slate-600">
                                          {transaction.type === "USED" &&
                                            transaction.materials_to_order?.project
                                              ?.name ? (
                                            <span className="text-xs font-medium text-slate-800">
                                              {
                                                transaction.materials_to_order
                                                  .project.name
                                              }
                                            </span>
                                          ) : (
                                            "-"
                                          )}
                                        </td>
                                        <td className="py-2 px-3 text-slate-600">
                                          {transaction.type === "USED" &&
                                            transaction.materials_to_order?.lots &&
                                            transaction.materials_to_order.lots
                                              .length > 0 ? (
                                            <span className="text-xs font-medium text-slate-800">
                                              {transaction.materials_to_order.lots
                                                .map((lot) => lot.lot_id)
                                                .join(", ")}
                                            </span>
                                          ) : (
                                            "-"
                                          )}
                                        </td>
                                      </tr>
                                      {transaction.notes && expandedNotes.has(transaction.id) && (
                                        <tr className="bg-slate-50">
                                          <td colSpan="7" className="px-4 py-4">
                                            <div className="text-xs text-slate-700">
                                              <span className="font-medium text-slate-800 mb-2 block">
                                                Notes:
                                              </span>
                                              <div className="text-slate-600 whitespace-pre-wrap pl-4 border-l-2 border-slate-300">
                                                {transaction.notes}
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Pagination (same UI as Jobs list) */}
                            {stockTxTotalPages > 1 && (
                              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                                <div className="text-xs text-slate-500">
                                  Showing {stockTxStartIndex + 1} to{" "}
                                  {Math.min(
                                    stockTxEndIndex,
                                    sortedStockTransactions.length
                                  )}{" "}
                                  of {sortedStockTransactions.length} results
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() =>
                                      handleStockTxPageChange(
                                        stockTxCurrentPage - 1
                                      )
                                    }
                                    disabled={stockTxCurrentPage === 1}
                                    className="cursor-pointer px-2 py-1 text-xs font-medium text-slate-500 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Previous
                                  </button>
                                  <div className="flex items-center gap-1">
                                    {Array.from(
                                      { length: stockTxTotalPages },
                                      (_, i) => i + 1
                                    ).map((page) => (
                                      <button
                                        key={page}
                                        onClick={() =>
                                          handleStockTxPageChange(page)
                                        }
                                        className={`cursor-pointer px-2 py-1 text-xs font-medium rounded ${stockTxCurrentPage === page
                                          ? "bg-primary text-white"
                                          : "text-slate-500 bg-white border border-slate-300 hover:bg-slate-50"
                                          }`}
                                      >
                                        {page}
                                      </button>
                                    ))}
                                  </div>
                                  <button
                                    onClick={() =>
                                      handleStockTxPageChange(
                                        stockTxCurrentPage + 1
                                      )
                                    }
                                    disabled={
                                      stockTxCurrentPage === stockTxTotalPages
                                    }
                                    className="cursor-pointer px-2 py-1 text-xs font-medium text-slate-500 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Next
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-8 text-slate-500">
                            <Package className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                            <p className="text-sm">No stock transactions found</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Category-Specific Information - 30% width */}
                    <div className="col-span-3">
                      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                          <Package className="w-4 h-4" />
                          Details
                        </h3>
                        <div className="grid grid-cols-1 gap-4">
                          {renderCategorySpecificFields()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedFile === true && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs">
            <div
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => setSelectedFile(false)}
            />
            <div className="relative bg-white w-full max-w-5xl mx-4 rounded-xl shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-slate-800 truncate">
                    {getItemTitle()}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {imagePreview ? "New image" : item.image?.url || "-"}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedFile(false);
                  }}
                  className="cursor-pointer p-2 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="relative flex-1 overflow-auto p-6 bg-slate-50">
                <div className="flex items-center justify-center h-full">
                  {imagePreview ? (
                    <Image
                      loading="lazy"
                      src={imagePreview}
                      alt={item.item_id}
                      width={1000}
                      height={1000}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                    />
                  ) : item.image?.url ? (
                    <Image
                      loading="lazy"
                      src={`/${item.image.url}`}
                      alt={item.item_id}
                      width={1000}
                      height={1000}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500">
                      No image available
                    </div>
                  )}
                </div>

                {/* Floating Info and Download Button */}
                <div className="sticky bottom-4 left-4 right-4 flex items-center justify-between gap-4 z-50 pointer-events-auto">
                  <button
                    onClick={() => {
                      // Check if image URL exists
                      if (item.image?.url) {
                        // For existing files (URL string like /upload/item/item.jpeg)
                        const a = document.createElement("a");
                        a.href = `/${item.image.url}`;
                        a.download =
                          item.image.filename || item.item_id || "download";
                        a.target = "_blank";
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      }
                    }}
                    className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium pointer-events-auto"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <DeleteConfirmation
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteConfirm}
          deleteWithInput={true}
          heading="Item"
          message="This will permanently delete this item from inventory. This action cannot be undone."
          comparingName={item ? item.item_id : ""}
          isDeleting={isDeleting}
          entityType="item"
        />

        {/* Create Finish Modal */}
        {showCreateFinishModal && (
          <div className="fixed inset-0 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCreateFinishModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-800">
                  Create New Finish
                </h2>
                <button
                  onClick={() => {
                    setShowCreateFinishModal(false);
                    setNewFinishValue("");
                  }}
                  className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Finish Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newFinishValue}
                    onChange={(e) => setNewFinishValue(e.target.value)}
                    placeholder="Enter finish name"
                    className="w-full text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowCreateFinishModal(false);
                      setNewFinishValue("");
                    }}
                    className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateNewFinish}
                    disabled={isCreatingFinish || !newFinishValue?.trim()}
                    className="cursor-pointer px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCreatingFinish ? "Creating..." : "Create Finish"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Measuring Unit Modal */}
        {showCreateMeasuringUnitModal && (
          <div className="fixed inset-0 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCreateMeasuringUnitModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-800">
                  Create New Measuring Unit
                </h2>
                <button
                  onClick={() => {
                    setShowCreateMeasuringUnitModal(false);
                    setNewMeasuringUnitValue("");
                  }}
                  className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Measuring Unit Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newMeasuringUnitValue}
                    onChange={(e) => setNewMeasuringUnitValue(e.target.value)}
                    placeholder="Enter measuring unit name"
                    className="w-full text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowCreateMeasuringUnitModal(false);
                      setNewMeasuringUnitValue("");
                    }}
                    className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateNewMeasuringUnit}
                    disabled={isCreatingMeasuringUnit || !newMeasuringUnitValue?.trim()}
                    className="cursor-pointer px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCreatingMeasuringUnit ? "Creating..." : "Create Measuring Unit"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Hardware Sub Category Modal */}
        {showCreateSubCategoryModal && (
          <div className="fixed inset-0 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowCreateSubCategoryModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-800">
                  Create New Hardware Sub Category
                </h2>
                <button
                  onClick={() => {
                    setShowCreateSubCategoryModal(false);
                    setNewSubCategoryValue("");
                  }}
                  className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Sub Category Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newSubCategoryValue}
                    onChange={(e) => setNewSubCategoryValue(e.target.value)}
                    placeholder="Enter sub category name"
                    className="w-full text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    onClick={() => {
                      setShowCreateSubCategoryModal(false);
                      setNewSubCategoryValue("");
                    }}
                    className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateNewSubCategory}
                    disabled={isCreatingSubCategory || !newSubCategoryValue?.trim()}
                    className="cursor-pointer px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCreatingSubCategory ? "Creating..." : "Create Sub Category"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminRoute>
  );
}
