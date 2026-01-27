"use client";
import CRMLayout from "@/components/tabs";
import TabsController from "@/components/tabscontroller";
import {
  ChevronLeft,
  ChevronDown,
  Upload,
  X,
  Package,
  Plus,
} from "lucide-react";
import Sidebar from "@/components/sidebar";
import { AdminRoute } from "@/components/ProtectedRoute";
import React, { useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import Image from "next/image";
import { useUploadProgress } from "@/hooks/useUploadProgress";

export default function page() {
  const { getToken } = useAuth();
  const {
    showProgressToast,
    completeUpload,
    dismissProgressToast,
    getUploadProgressHandler,
  } = useUploadProgress();
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSubCategoryDropdownOpen, setIsSubCategoryDropdownOpen] =
    useState(false);
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [isMeasuringUnitDropdownOpen, setIsMeasuringUnitDropdownOpen] =
    useState(false);
  const [isFinishDropdownOpen, setIsFinishDropdownOpen] = useState(false);
  const [isFaceDropdownOpen, setIsFaceDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("Sheet");
  const [subCategorySearchTerm, setSubCategorySearchTerm] = useState("");
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
  const [measuringUnitSearchTerm, setMeasuringUnitSearchTerm] = useState("");
  const [finishSearchTerm, setFinishSearchTerm] = useState("");
  const [faceSearchTerm, setFaceSearchTerm] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [measuringUnitOptions, setMeasuringUnitOptions] = useState([]);
  const [loadingMeasuringUnits, setLoadingMeasuringUnits] = useState(false);
  const [showCreateMeasuringUnitModal, setShowCreateMeasuringUnitModal] =
    useState(false);
  const [newMeasuringUnitValue, setNewMeasuringUnitValue] = useState("");
  const [isCreatingMeasuringUnit, setIsCreatingMeasuringUnit] = useState(false);
  const [finishOptions, setFinishOptions] = useState([]);
  const [loadingFinishes, setLoadingFinishes] = useState(false);
  const [showCreateFinishModal, setShowCreateFinishModal] = useState(false);
  const [newFinishValue, setNewFinishValue] = useState("");
  const [isCreatingFinish, setIsCreatingFinish] = useState(false);
  const dropdownRef = useRef(null);
  const subCategoryDropdownRef = useRef(null);
  const supplierDropdownRef = useRef(null);
  const measuringUnitDropdownRef = useRef(null);
  const finishDropdownRef = useRef(null);
  const faceDropdownRef = useRef(null);
  const fileInputRef = useRef(null);
  const faceAutoSetRef = useRef(false);
  const [selectedCategory, setSelectedCategory] = useState("Sheet");
  const [imagePreview, setImagePreview] = useState(null);
  const categories = [
    "Sheet",
    "Handle",
    "Hardware",
    "Accessory",
    "Edging Tape",
  ];
  const [formData, setFormData] = useState({
    image: "",
    category: selectedCategory.toLowerCase(),
    description: "",
    quantity: "0",
    price: "0",
    brand: "",
    color: "",
    finish: "",
    face: "",
    dimensions: "",
    type: "",
    material: "",
    sub_category: "",
    name: "",
    supplier_id: "",
    measurement_unit: "",
    supplier_reference: "",
    supplier_product_link: "",
    is_sunmica: false,
  });
  const filteredCategories = categories.filter((category) =>
    category.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Face options
  const faceOptions = ["single side", "double side"];
  const filteredFaces = faceOptions.filter((face) =>
    face.toLowerCase().includes(faceSearchTerm.toLowerCase()),
  );

  const [hardwareSubCategories, setHardwareSubCategories] = useState([]);
  const [loadingSubCategories, setLoadingSubCategories] = useState(false);
  const [showCreateSubCategoryModal, setShowCreateSubCategoryModal] =
    useState(false);
  const [newSubCategoryValue, setNewSubCategoryValue] = useState("");
  const [isCreatingSubCategory, setIsCreatingSubCategory] = useState(false);

  const filteredSubCategories = hardwareSubCategories.filter((subCategory) =>
    subCategory.toLowerCase().includes(subCategorySearchTerm.toLowerCase()),
  );

  // Fetch suppliers on component mount
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const sessionToken = getToken();
        if (!sessionToken) return;

        const response = await axios.get("/api/supplier/all", {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });

        if (response.data.status && response.data.data) {
          setSuppliers(response.data.data);
          setFilteredSuppliers(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching suppliers:", error);
      }
    };

    fetchSuppliers();
  }, []);

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

  // Filter suppliers based on search term
  useEffect(() => {
    if (supplierSearchTerm === "") {
      setFilteredSuppliers(suppliers);
    } else {
      const filtered = suppliers.filter((supplier) =>
        supplier.name.toLowerCase().includes(supplierSearchTerm.toLowerCase()),
      );
      setFilteredSuppliers(filtered);
    }
  }, [supplierSearchTerm, suppliers]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const dropdowns = [
        { ref: dropdownRef, setIsOpen: setIsDropdownOpen },
        {
          ref: subCategoryDropdownRef,
          setIsOpen: setIsSubCategoryDropdownOpen,
        },
        { ref: supplierDropdownRef, setIsOpen: setIsSupplierDropdownOpen },
        {
          ref: measuringUnitDropdownRef,
          setIsOpen: setIsMeasuringUnitDropdownOpen,
        },
        { ref: finishDropdownRef, setIsOpen: setIsFinishDropdownOpen },
        { ref: faceDropdownRef, setIsOpen: setIsFaceDropdownOpen },
      ];

      dropdowns.forEach(({ ref, setIsOpen }) => {
        if (ref.current && !ref.current.contains(event.target)) {
          setIsOpen(false);
        }
      });
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Initialize sub-category search term if form data already has a sub_category
  useEffect(() => {
    if (formData.sub_category) {
      setSubCategorySearchTerm(formData.sub_category);
    }
  }, [formData.sub_category]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleCategorySelect = (category) => {
    // Convert category to lowercase and replace spaces with underscores for API
    const categoryForAPI = category.toLowerCase().replace(/\s+/g, "_");
    setFormData({
      ...formData,
      category: categoryForAPI,
    });
    setSelectedCategory(category);
    setSearchTerm(category);
    setIsDropdownOpen(false);

    // Initialize sub-category search term when switching to Hardware
    if (category === "Hardware" && formData.sub_category) {
      setSubCategorySearchTerm(formData.sub_category);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setIsDropdownOpen(true);
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
              const subCategories = response.data.data.map(
                (item) => item.value,
              );
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

  const handleSupplierSelect = (supplierId, supplierName) => {
    setFormData({
      ...formData,
      supplier_id: supplierId,
    });
    setSupplierSearchTerm(supplierName);
    setIsSupplierDropdownOpen(false);
  };

  const handleSupplierSearchChange = (e) => {
    setSupplierSearchTerm(e.target.value);
    setIsSupplierDropdownOpen(true);
  };

  // Measuring unit handlers
  const filteredMeasuringUnits = measuringUnitOptions.filter((unit) =>
    unit.toLowerCase().includes(measuringUnitSearchTerm.toLowerCase()),
  );

  const handleMeasuringUnitSelect = (unit) => {
    setFormData({
      ...formData,
      measurement_unit: unit,
    });
    setMeasuringUnitSearchTerm(unit);
    setIsMeasuringUnitDropdownOpen(false);
  };

  const handleMeasuringUnitSearchChange = (e) => {
    const value = e.target.value;
    setMeasuringUnitSearchTerm(value);
    setIsMeasuringUnitDropdownOpen(true);
    setFormData({
      ...formData,
      measurement_unit: value,
    });
  };

  // Finish handlers
  const filteredFinishes = finishOptions.filter((finish) =>
    finish.toLowerCase().includes(finishSearchTerm.toLowerCase()),
  );

  const handleFinishSelect = (finish) => {
    setFormData({
      ...formData,
      finish: finish,
    });
    setFinishSearchTerm(finish);
    setIsFinishDropdownOpen(false);
  };

  const handleFinishSearchChange = (e) => {
    const value = e.target.value;
    setFinishSearchTerm(value);
    setIsFinishDropdownOpen(true);
    setFormData({
      ...formData,
      finish: value,
    });
  };

  // Face handlers
  const handleFaceSelect = (face) => {
    setFormData({
      ...formData,
      face: face,
    });
    setFaceSearchTerm(face);
    setIsFaceDropdownOpen(false);
  };

  const handleFaceSearchChange = (e) => {
    const value = e.target.value;
    setFaceSearchTerm(value);
    setIsFaceDropdownOpen(true);
    setFormData({
      ...formData,
      face: value,
    });
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
        setFormData({
          ...formData,
          finish: newFinishValue.trim(),
        });
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
        setFormData({
          ...formData,
          measurement_unit: newMeasuringUnitValue.trim(),
        });
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

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const inputValue = type === "checkbox" ? checked : value;

    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: inputValue,
      };

      // If is_sunmica is checked, set face to "single side" and mark it as auto-set
      if (name === "is_sunmica" && checked) {
        // Only auto-set if face wasn't already "single side" (preserve user's manual entry)
        if (prev.face !== "single side") {
          updated.face = "single side";
          setFaceSearchTerm("single side");
          faceAutoSetRef.current = true;
        } else {
          // Face was already "single side", so it might be user-entered, don't mark as auto-set
          faceAutoSetRef.current = false;
        }
      }
      // If is_sunmica is unchecked, only clear face if it was auto-set by the checkbox
      if (name === "is_sunmica" && !checked) {
        if (faceAutoSetRef.current && prev.face === "single side") {
          updated.face = "";
          setFaceSearchTerm("");
        }
        faceAutoSetRef.current = false;
      }

      // If user manually changes the face field, mark it as not auto-set
      if (name === "face") {
        faceAutoSetRef.current = false;
        setFaceSearchTerm(value);
      }

      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    setErrors({});
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }
      const data = new FormData();
      const hasImageFile = formData.image instanceof File;
      Object.entries(formData).forEach(([key, value]) => {
        // Skip image field here - handle it separately
        if (key === "image") {
          // Only append image if it's a File object
          if (value instanceof File) {
            data.append(key, value);
          }
          return;
        }
        // Convert boolean to string for FormData
        if (typeof value === "boolean") {
          data.append(key, value.toString());
        } else if (value !== null && value !== undefined) {
          data.append(key, value);
        }
      });

      // Show progress toast only if there's an image file
      if (hasImageFile) {
        showProgressToast(1);
      }

      const response = await axios.post("/api/item/create", data, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "multipart/form-data",
        },
        ...(hasImageFile && {
          onUploadProgress: getUploadProgressHandler(1),
        }),
      });
      if (response.data.status) {
        if (hasImageFile) {
          completeUpload(1);
        } else {
          toast.success("Item created successfully", {
            position: "top-right",
            autoClose: 3000,
          });
        }
      } else {
        if (hasImageFile) {
          dismissProgressToast();
        }
        toast.error(response.data.message, {
          position: "top-right",
          autoClose: 3000,
        });
        return;
      }
      setFormData({
        image: "",
        category: "",
        description: "",
        quantity: "0",
        price: "0",
        brand: "",
        color: "",
        finish: "",
        face: "",
        dimensions: "",
        type: "",
        material: "",
        sub_category: "",
        name: "",
        supplier_id: "",
        measurement_unit: "",
        supplier_reference: "",
        supplier_product_link: "",
        is_sunmica: false,
      });
      setImagePreview(null);
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setIsSubmitting(false);
      setErrors({});
      setIsDropdownOpen(false);
      setIsSubCategoryDropdownOpen(false);
      setIsSupplierDropdownOpen(false);
      setIsMeasuringUnitDropdownOpen(false);
      setIsFinishDropdownOpen(false);
      setIsFaceDropdownOpen(false);
      setSearchTerm("Sheet");
      setSubCategorySearchTerm("");
      setSupplierSearchTerm("");
      setMeasuringUnitSearchTerm("");
      setFinishSearchTerm("");
      setFaceSearchTerm("");
      setSelectedCategory("Sheet");
      faceAutoSetRef.current = false;
    } catch (error) {
      console.error(error);
      const hasImageFile = formData.image instanceof File;
      if (hasImageFile) {
        dismissProgressToast();
      }
      toast.error(
        error.response?.data?.message ||
          "Failed to create item. Please try again.",
        {
          position: "top-right",
          autoClose: 3000,
        },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        image: file,
      }));
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({
      ...prev,
      image: null,
    }));
    setImagePreview(null);
  };

  const validateForm = () => {
    const errors = {};
    // Image is now optional, so no validation needed
    setErrors(errors);
    return Object.keys(errors).length === 0;
  };

  return (
    <div>
      <AdminRoute>
        <div className="flex h-screen bg-tertiary">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <CRMLayout />
            <div className="h-full w-full overflow-y-auto">
              <div className="px-4 py-2">
                <div className="flex items-center gap-2 mb-4">
                  <TabsController back={true} title="Inventory">
                    <div className="cursor-pointer p-1 hover:bg-slate-200 rounded-lg transition-colors">
                      <ChevronLeft className="w-8 h-8 text-slate-600" />
                    </div>
                  </TabsController>
                  <h1 className="text-2xl font-bold text-slate-600">
                    Add New Item
                  </h1>
                </div>

                {/* form */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Item Image Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Package className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold text-slate-800">
                          Item Image
                        </h2>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className="relative group">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                            id="image-upload"
                          />

                          {imagePreview ? (
                            <div className="relative">
                              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary shadow-lg">
                                <Image
                                  loading="lazy"
                                  src={imagePreview}
                                  alt="Preview"
                                  className="w-full h-full object-cover"
                                  width={128}
                                  height={128}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleRemoveImage}
                                className="absolute top-1 right-1 bg-secondary text-white rounded-full p-2 shadow-lg hover:bg-secondary transition-all duration-200 transform hover:scale-110 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-primary text-white rounded-full px-4 py-1 text-xs shadow-lg hover:scale-110 transition-all duration-200 cursor-pointer"
                              >
                                Change
                              </button>
                            </div>
                          ) : (
                            <label
                              htmlFor="image-upload"
                              className="w-32 h-32 rounded-full border-4 border-dashed border-slate-300 hover:border-primary bg-slate-50 hover:bg-blue-50 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group-hover:shadow-lg"
                            >
                              <Upload className="w-8 h-8 text-slate-400 group-hover:text-primary transition-colors mb-2" />
                              <span className="text-xs text-slate-500 group-hover:text-primary font-medium">
                                Upload Image
                              </span>
                            </label>
                          )}
                        </div>

                        <p className="mt-4 text-sm text-slate-600">
                          Item Image{" "}
                          <span className="text-slate-400">(Optional)</span>
                        </p>
                        {errors.image && (
                          <p className="mt-2 text-sm text-red-600">
                            {errors.image}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Basic Information Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Package className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold text-slate-800">
                          Basic Information
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="relative" ref={dropdownRef}>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Category
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={searchTerm}
                              onChange={handleSearchChange}
                              onFocus={() => setIsDropdownOpen(true)}
                              className="w-full text-sm text-slate-800 px-4 py-3 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                              placeholder="Search or select category..."
                            />
                            <button
                              type="button"
                              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              <ChevronDown
                                className={`w-5 h-5 transition-transform duration-200 ${
                                  isDropdownOpen ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                          </div>

                          {isDropdownOpen && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                              {filteredCategories.length > 0 ? (
                                filteredCategories.map((category, index) => (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={() =>
                                      handleCategorySelect(category)
                                    }
                                    className="w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg last:rounded-b-lg"
                                  >
                                    {category}
                                  </button>
                                ))
                              ) : (
                                <div className="px-4 py-3 text-sm text-slate-500 text-center">
                                  No matching categories found
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Quantity{" "}
                            <span className="text-slate-400">(Optional)</span>
                          </label>
                          <input
                            type="number"
                            name="quantity"
                            value={formData.quantity}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                            placeholder="Eg. 100.5"
                            step="0.01"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Price per Unit (including GST){" "}
                            <span className="text-slate-400">(Optional)</span>
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500">
                              $
                            </span>
                            <input
                              type="number"
                              name="price"
                              value={formData.price}
                              onChange={handleInputChange}
                              className="w-full text-sm text-slate-800 pl-8 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                              placeholder="0.00"
                              step="0.01"
                            />
                          </div>
                        </div>

                        <div className="relative" ref={supplierDropdownRef}>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Supplier{" "}
                            <span className="text-slate-400">(Optional)</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={supplierSearchTerm}
                              onChange={handleSupplierSearchChange}
                              onFocus={() => setIsSupplierDropdownOpen(true)}
                              className="w-full text-sm text-slate-800 px-4 py-3 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                              placeholder="Search or select supplier..."
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setIsSupplierDropdownOpen(
                                  !isSupplierDropdownOpen,
                                )
                              }
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              <ChevronDown
                                className={`w-5 h-5 transition-transform duration-200 ${
                                  isSupplierDropdownOpen ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                          </div>

                          {isSupplierDropdownOpen && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                              {filteredSuppliers.length > 0 ? (
                                filteredSuppliers.map((supplier) => (
                                  <button
                                    key={supplier.supplier_id}
                                    type="button"
                                    onClick={() =>
                                      handleSupplierSelect(
                                        supplier.supplier_id,
                                        supplier.name,
                                      )
                                    }
                                    className="cursor-pointer w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg last:rounded-b-lg"
                                  >
                                    <div>
                                      <div className="font-medium">
                                        {supplier.name}
                                      </div>
                                      <div className="text-xs text-slate-500">
                                        id: {supplier.supplier_id}
                                      </div>
                                    </div>
                                  </button>
                                ))
                              ) : (
                                <div className="px-4 py-3 text-sm text-slate-500 text-center">
                                  No matching suppliers found
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div
                          className="relative"
                          ref={measuringUnitDropdownRef}
                        >
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Measurement Unit{" "}
                            <span className="text-slate-400">(Optional)</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={
                                measuringUnitSearchTerm ||
                                formData.measurement_unit
                              }
                              onChange={handleMeasuringUnitSearchChange}
                              onFocus={() =>
                                setIsMeasuringUnitDropdownOpen(true)
                              }
                              className="w-full text-sm text-slate-800 px-4 py-3 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                              placeholder="Search or type a measuring unit..."
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setIsMeasuringUnitDropdownOpen(
                                  !isMeasuringUnitDropdownOpen,
                                )
                              }
                              className="cursor-pointer absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              <ChevronDown
                                className={`w-5 h-5 transition-transform ${
                                  isMeasuringUnitDropdownOpen
                                    ? "rotate-180"
                                    : ""
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
                                      onClick={() =>
                                        handleMeasuringUnitSelect(unit)
                                      }
                                      className="cursor-pointer w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg"
                                    >
                                      {unit}
                                    </button>
                                  ))}
                                  {measuringUnitSearchTerm &&
                                    !filteredMeasuringUnits.some(
                                      (u) =>
                                        u.toLowerCase() ===
                                        measuringUnitSearchTerm.toLowerCase(),
                                    ) && (
                                      <div className="border-t border-slate-200">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setNewMeasuringUnitValue(
                                              measuringUnitSearchTerm,
                                            );
                                            setShowCreateMeasuringUnitModal(
                                              true,
                                            );
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
                                        setNewMeasuringUnitValue(
                                          measuringUnitSearchTerm,
                                        );
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
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Supplier Reference{" "}
                            <span className="text-slate-400">(Optional)</span>
                          </label>
                          <input
                            type="text"
                            name="supplier_reference"
                            value={formData.supplier_reference}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                            placeholder="Eg. SUP-12345"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Supplier Product Link{" "}
                            <span className="text-slate-400">(Optional)</span>
                          </label>
                          <input
                            type="url"
                            name="supplier_product_link"
                            value={formData.supplier_product_link}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                            placeholder="Eg. https://supplier.com/product/123"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Description{" "}
                          <span className="text-slate-400">(Optional)</span>
                        </label>
                        <textarea
                          type="textarea"
                          name="description"
                          value={formData.description}
                          onChange={handleInputChange}
                          className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                          placeholder="Eg. This is a description of the item"
                        />
                        {errors.description && (
                          <p className="mt-1 text-sm text-red-600">
                            {errors.description}
                          </p>
                        )}
                      </div>
                    </div>
                    {/* Category Details Section */}
                    {selectedCategory && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Package className="w-5 h-5 text-primary" />
                          <h2 className="text-xl font-bold text-slate-800">
                            {selectedCategory} Details
                          </h2>
                        </div>

                        {selectedCategory.toLowerCase() === "sheet" && (
                          <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {[
                                "brand",
                                "color",
                                "finish",
                                "face",
                                "dimensions",
                              ].map((field) => (
                                <div key={field}>
                                  {field === "finish" ? (
                                    <div
                                      className="relative"
                                      ref={finishDropdownRef}
                                    >
                                      <label className="block text-sm font-medium text-slate-700 mb-2 capitalize">
                                        {field}
                                      </label>
                                      <div className="relative">
                                        <input
                                          type="text"
                                          value={
                                            finishSearchTerm || formData.finish
                                          }
                                          onChange={handleFinishSearchChange}
                                          onFocus={() =>
                                            setIsFinishDropdownOpen(true)
                                          }
                                          className="w-full text-sm text-slate-800 px-4 py-3 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                                          placeholder="Search or type a finish..."
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setIsFinishDropdownOpen(
                                              !isFinishDropdownOpen,
                                            )
                                          }
                                          className="cursor-pointer absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                          <ChevronDown
                                            className={`w-5 h-5 transition-transform ${
                                              isFinishDropdownOpen
                                                ? "rotate-180"
                                                : ""
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
                                              {filteredFinishes.map(
                                                (finish, index) => (
                                                  <button
                                                    key={index}
                                                    type="button"
                                                    onClick={() =>
                                                      handleFinishSelect(finish)
                                                    }
                                                    className="cursor-pointer w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg"
                                                  >
                                                    {finish}
                                                  </button>
                                                ),
                                              )}
                                              {finishSearchTerm &&
                                                !filteredFinishes.some(
                                                  (f) =>
                                                    f.toLowerCase() ===
                                                    finishSearchTerm.toLowerCase(),
                                                ) && (
                                                  <div className="border-t border-slate-200">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setNewFinishValue(
                                                          finishSearchTerm,
                                                        );
                                                        setShowCreateFinishModal(
                                                          true,
                                                        );
                                                      }}
                                                      className="cursor-pointer w-full text-left px-4 py-3 text-sm text-primary font-medium hover:bg-primary/10 transition-colors flex items-center gap-2"
                                                    >
                                                      <Plus className="w-4 h-4" />
                                                      Create "{finishSearchTerm}
                                                      "
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
                                                    setNewFinishValue(
                                                      finishSearchTerm,
                                                    );
                                                    setShowCreateFinishModal(
                                                      true,
                                                    );
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
                                  ) : field === "face" ? (
                                    <div
                                      className="relative"
                                      ref={faceDropdownRef}
                                    >
                                      <label className="block text-sm font-medium text-slate-700 mb-2 capitalize">
                                        {field}
                                      </label>
                                      <div className="relative">
                                        <input
                                          type="text"
                                          value={
                                            faceSearchTerm ||
                                            formData.face ||
                                            ""
                                          }
                                          onChange={handleFaceSearchChange}
                                          onFocus={() =>
                                            setIsFaceDropdownOpen(true)
                                          }
                                          disabled={formData.is_sunmica}
                                          className={`w-full text-sm text-slate-800 px-4 py-3 pr-10 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none ${
                                            formData.is_sunmica
                                              ? "bg-slate-100 cursor-not-allowed border-slate-300"
                                              : "border-slate-300"
                                          }`}
                                          placeholder="Select face..."
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setIsFaceDropdownOpen(
                                              !isFaceDropdownOpen,
                                            )
                                          }
                                          disabled={formData.is_sunmica}
                                          className="cursor-pointer absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                                        >
                                          <ChevronDown
                                            className={`w-5 h-5 transition-transform ${
                                              isFaceDropdownOpen
                                                ? "rotate-180"
                                                : ""
                                            }`}
                                          />
                                        </button>
                                      </div>

                                      {isFaceDropdownOpen &&
                                        !formData.is_sunmica && (
                                          <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                                            {filteredFaces.length > 0 ? (
                                              filteredFaces.map(
                                                (face, index) => (
                                                  <button
                                                    key={index}
                                                    type="button"
                                                    onClick={() =>
                                                      handleFaceSelect(face)
                                                    }
                                                    className="cursor-pointer w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg last:rounded-b-lg"
                                                  >
                                                    {face}
                                                  </button>
                                                ),
                                              )
                                            ) : (
                                              <div className="px-4 py-3 text-sm text-slate-500 text-center">
                                                No matching options found
                                              </div>
                                            )}
                                          </div>
                                        )}
                                    </div>
                                  ) : (
                                    <div>
                                      <label className="block text-sm font-medium text-slate-700 mb-2 capitalize">
                                        {field}
                                      </label>
                                      <input
                                        type="text"
                                        name={field}
                                        value={formData[field]}
                                        onChange={handleInputChange}
                                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                                        placeholder={`Enter ${field}`}
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  name="is_sunmica"
                                  checked={formData.is_sunmica}
                                  onChange={handleInputChange}
                                  className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-2 focus:ring-primary cursor-pointer"
                                />
                                <span className="text-sm font-medium text-slate-700">
                                  Is Sunmica
                                </span>
                              </label>
                              {formData.is_sunmica && (
                                <p className="mt-1 text-xs text-slate-500">
                                  Face field is automatically set to "single
                                  side" for sunmica items
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {selectedCategory.toLowerCase() === "handle" && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                              "brand",
                              "color",
                              "type",
                              "material",
                              "dimensions",
                            ].map((field) => (
                              <div key={field}>
                                <label className="block text-sm font-medium text-slate-700 mb-2 capitalize">
                                  {field}
                                </label>
                                <input
                                  type="text"
                                  name={field}
                                  value={formData[field]}
                                  onChange={handleInputChange}
                                  className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                                  placeholder={`Enter ${field}`}
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {selectedCategory.toLowerCase() === "hardware" && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div
                              className="relative"
                              ref={subCategoryDropdownRef}
                            >
                              <label className="block text-sm font-medium text-slate-700 mb-2 capitalize">
                                Sub Category
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  value={subCategorySearchTerm}
                                  onChange={handleSubCategorySearchChange}
                                  onFocus={() =>
                                    setIsSubCategoryDropdownOpen(true)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      setIsSubCategoryDropdownOpen(false);
                                      // The form data is already updated in handleSubCategorySearchChange
                                    }
                                  }}
                                  className="w-full text-sm text-slate-800 px-4 py-3 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                                  placeholder="Search or select sub category..."
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setIsSubCategoryDropdownOpen(
                                      !isSubCategoryDropdownOpen,
                                    )
                                  }
                                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                  <ChevronDown
                                    className={`w-5 h-5 transition-transform duration-200 ${
                                      isSubCategoryDropdownOpen
                                        ? "rotate-180"
                                        : ""
                                    }`}
                                  />
                                </button>
                              </div>

                              {isSubCategoryDropdownOpen && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                                  {loadingSubCategories ? (
                                    <div className="px-4 py-3 text-sm text-slate-500 text-center">
                                      Loading sub categories...
                                    </div>
                                  ) : filteredSubCategories.length > 0 ? (
                                    <>
                                      {filteredSubCategories.map(
                                        (subCategory, index) => (
                                          <button
                                            key={index}
                                            type="button"
                                            onClick={() =>
                                              handleSubCategorySelect(
                                                subCategory,
                                              )
                                            }
                                            className="w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg"
                                          >
                                            {subCategory}
                                          </button>
                                        ),
                                      )}
                                      {subCategorySearchTerm &&
                                        !filteredSubCategories.some(
                                          (sc) =>
                                            sc.toLowerCase() ===
                                            subCategorySearchTerm.toLowerCase(),
                                        ) && (
                                          <div className="border-t border-slate-200">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setNewSubCategoryValue(
                                                  subCategorySearchTerm,
                                                );
                                                setShowCreateSubCategoryModal(
                                                  true,
                                                );
                                              }}
                                              className="cursor-pointer w-full text-left px-4 py-3 text-sm text-primary font-medium hover:bg-primary/10 transition-colors flex items-center gap-2"
                                            >
                                              <Plus className="w-4 h-4" />
                                              Create "{subCategorySearchTerm}"
                                            </button>
                                          </div>
                                        )}
                                    </>
                                  ) : (
                                    <div className="px-4 py-3">
                                      <div className="text-sm text-slate-500 mb-2 text-center">
                                        No matching sub categories found
                                      </div>
                                      {subCategorySearchTerm && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setNewSubCategoryValue(
                                              subCategorySearchTerm,
                                            );
                                            setShowCreateSubCategoryModal(true);
                                          }}
                                          className="cursor-pointer w-full px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors flex items-center justify-center gap-2"
                                        >
                                          <Plus className="w-4 h-4" />
                                          Create "{subCategorySearchTerm}"
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            {["brand", "name", "type", "dimensions"].map(
                              (field) => (
                                <div key={field}>
                                  <label className="block text-sm font-medium text-slate-700 mb-2 capitalize">
                                    {field.replace("_", " ")}
                                  </label>
                                  <input
                                    type="text"
                                    name={field}
                                    value={formData[field]}
                                    onChange={handleInputChange}
                                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                                    placeholder={`Enter ${field.replace(
                                      "_",
                                      " ",
                                    )}`}
                                  />
                                </div>
                              ),
                            )}
                          </div>
                        )}

                        {selectedCategory.toLowerCase() === "accessory" && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                              <label className="block text-sm font-medium text-slate-700 mb-2">
                                Item Name
                              </label>
                              <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                                placeholder="Eg. Marker Pen"
                              />
                            </div>
                          </div>
                        )}

                        {selectedCategory.toLowerCase() === "edging tape" && (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {["brand", "color", "finish", "dimensions"].map(
                              (field) => (
                                <div key={field}>
                                  {field === "finish" ? (
                                    <div
                                      className="relative"
                                      ref={finishDropdownRef}
                                    >
                                      <label className="block text-sm font-medium text-slate-700 mb-2 capitalize">
                                        {field}
                                      </label>
                                      <div className="relative">
                                        <input
                                          type="text"
                                          value={
                                            finishSearchTerm || formData.finish
                                          }
                                          onChange={handleFinishSearchChange}
                                          onFocus={() =>
                                            setIsFinishDropdownOpen(true)
                                          }
                                          className="w-full text-sm text-slate-800 px-4 py-3 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                                          placeholder="Search or type a finish..."
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setIsFinishDropdownOpen(
                                              !isFinishDropdownOpen,
                                            )
                                          }
                                          className="cursor-pointer absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                          <ChevronDown
                                            className={`w-5 h-5 transition-transform ${
                                              isFinishDropdownOpen
                                                ? "rotate-180"
                                                : ""
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
                                              {filteredFinishes.map(
                                                (finish, index) => (
                                                  <button
                                                    key={index}
                                                    type="button"
                                                    onClick={() =>
                                                      handleFinishSelect(finish)
                                                    }
                                                    className="cursor-pointer w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg"
                                                  >
                                                    {finish}
                                                  </button>
                                                ),
                                              )}
                                              {finishSearchTerm &&
                                                !filteredFinishes.some(
                                                  (f) =>
                                                    f.toLowerCase() ===
                                                    finishSearchTerm.toLowerCase(),
                                                ) && (
                                                  <div className="border-t border-slate-200">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setNewFinishValue(
                                                          finishSearchTerm,
                                                        );
                                                        setShowCreateFinishModal(
                                                          true,
                                                        );
                                                      }}
                                                      className="cursor-pointer w-full text-left px-4 py-3 text-sm text-primary font-medium hover:bg-primary/10 transition-colors flex items-center gap-2"
                                                    >
                                                      <Plus className="w-4 h-4" />
                                                      Create "{finishSearchTerm}
                                                      "
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
                                                    setNewFinishValue(
                                                      finishSearchTerm,
                                                    );
                                                    setShowCreateFinishModal(
                                                      true,
                                                    );
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
                                    <div>
                                      <label className="block text-sm font-medium text-slate-700 mb-2 capitalize">
                                        {field}
                                      </label>
                                      <input
                                        type="text"
                                        name={field}
                                        value={formData[field]}
                                        onChange={handleInputChange}
                                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                                        placeholder={`Enter ${field}`}
                                      />
                                    </div>
                                  )}
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Submit Button */}
                    <div className="flex justify-end pt-6 border-t border-slate-200">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`cursor-pointer px-8 py-3 rounded-lg font-medium transition-all duration-200 text-sm ${
                          isSubmitting
                            ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                            : "bg-primary/80 hover:bg-primary text-white"
                        }`}
                      >
                        {isSubmitting ? "Adding Item..." : "Add Item"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AdminRoute>

      {/* Create Hardware Sub Category Modal */}
      {showCreateSubCategoryModal && (
        <div
          className="fixed inset-0 backdrop-blur-xs bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowCreateSubCategoryModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
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
                  disabled={
                    isCreatingSubCategory || !newSubCategoryValue?.trim()
                  }
                  className="cursor-pointer px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isCreatingSubCategory
                    ? "Creating..."
                    : "Create Sub Category"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Finish Modal */}
      {showCreateFinishModal && (
        <div
          className="fixed inset-0 backdrop-blur-xs bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowCreateFinishModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
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
        <div
          className="fixed inset-0 backdrop-blur-xs bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowCreateMeasuringUnitModal(false)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
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
                  disabled={
                    isCreatingMeasuringUnit || !newMeasuringUnitValue?.trim()
                  }
                  className="cursor-pointer px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isCreatingMeasuringUnit
                    ? "Creating..."
                    : "Create Measuring Unit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
