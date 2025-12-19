"use client";
import React, { useState, useRef, useEffect } from "react";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import Image from "next/image";
import { X, ChevronDown, Upload, Package } from "lucide-react";

export default function AddItemModal({ setShowModal, supplierId, onItemAdded }) {
  const { getToken } = useAuth();
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSubCategoryDropdownOpen, setIsSubCategoryDropdownOpen] = useState(false);
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("Sheet");
  const [subCategorySearchTerm, setSubCategorySearchTerm] = useState("");
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
  const [suppliers, setSuppliers] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const dropdownRef = useRef(null);
  const subCategoryDropdownRef = useRef(null);
  const supplierDropdownRef = useRef(null);
  const fileInputRef = useRef(null);
  const faceAutoSetRef = useRef(false);
  const [selectedCategory, setSelectedCategory] = useState("Sheet");
  const [imagePreview, setImagePreview] = useState(null);
  const categories = ["Sheet", "Handle", "Hardware", "Accessory", "Edging Tape"];

  const [formData, setFormData] = useState({
    image: "",
    category: "sheet",
    description: "",
    quantity: "",
    price: "",
    brand: "",
    color: "",
    finish: "",
    face: "",
    dimensions: "",
    type: "",
    material: "",
    sub_category: "",
    name: "",
    supplier_id: supplierId || "",
    measurement_unit: "",
    supplier_reference: "",
    supplier_product_link: "",
    is_sunmica: false,
  });

  const filteredCategories = categories.filter((category) =>
    category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hardwareSubCategories = [
    "Legs with plates",
    "Hinges",
    "Hinge Plates",
    "Screws",
    "Hangin Rode",
    "Hanging Rode Support & Ends",
    "Cutlery Tray",
    "Bin",
    "Drawer set (Runners)",
    "Screw Caps (White & Color)",
    "Plastic Wraps",
    "Shelf Support",
    "LED",
  ];

  const filteredSubCategories = hardwareSubCategories.filter((subCategory) =>
    subCategory.toLowerCase().includes(subCategorySearchTerm.toLowerCase())
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

  // Filter suppliers based on search term
  useEffect(() => {
    if (supplierSearchTerm === "") {
      setFilteredSuppliers(suppliers);
    } else {
      const filtered = suppliers.filter((supplier) =>
        supplier.name.toLowerCase().includes(supplierSearchTerm.toLowerCase())
      );
      setFilteredSuppliers(filtered);
    }
  }, [supplierSearchTerm, suppliers]);

  // Update supplier_id when supplierId prop changes
  useEffect(() => {
    if (supplierId) {
      setFormData((prev) => ({
        ...prev,
        supplier_id: supplierId,
      }));
      // Find supplier name and set search term
      const supplier = suppliers.find(s => s.supplier_id === supplierId);
      if (supplier) {
        setSupplierSearchTerm(supplier.name);
      }
    }
  }, [supplierId, suppliers]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const dropdowns = [
        { ref: dropdownRef, setIsOpen: setIsDropdownOpen },
        { ref: subCategoryDropdownRef, setIsOpen: setIsSubCategoryDropdownOpen },
        { ref: supplierDropdownRef, setIsOpen: setIsSupplierDropdownOpen },
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
    const categoryForAPI = category.toLowerCase().replace(/\s+/g, "_");
    setFormData({
      ...formData,
      category: categoryForAPI,
    });
    setSelectedCategory(category);
    setSearchTerm(category);
    setIsDropdownOpen(false);

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
    setFormData({
      ...formData,
      sub_category: e.target.value,
    });
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

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    const inputValue = type === "checkbox" ? checked : value;

    setFormData((prev) => {
      const updated = {
        ...prev,
        [name]: inputValue,
      };

      if (name === "is_sunmica" && checked) {
        if (prev.face !== "1") {
          updated.face = "1";
          faceAutoSetRef.current = true;
        } else {
          faceAutoSetRef.current = false;
        }
      }
      if (name === "is_sunmica" && !checked) {
        if (faceAutoSetRef.current && prev.face === "1") {
          updated.face = "";
        }
        faceAutoSetRef.current = false;
      }

      if (name === "face") {
        faceAutoSetRef.current = false;
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
        toast.error("No valid session found. Please login again.");
        return;
      }
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (key === "image") {
          if (value instanceof File) {
            data.append(key, value);
          }
          return;
        }
        if (typeof value === "boolean") {
          data.append(key, value.toString());
        } else if (value !== null && value !== undefined && value !== "") {
          data.append(key, value);
        }
      });
      const response = await axios.post("/api/item/create", data, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "multipart/form-data",
        },
      });
      if (response.data.status) {
        toast.success("Item created successfully");
        resetForm();
        if (onItemAdded) {
          onItemAdded();
        }
        setShowModal(false);
      } else {
        toast.error(response.data.message || "Failed to create item");
      }
    } catch (error) {
      console.error(error);
      toast.error(error?.response?.data?.message || "Failed to create item");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      image: "",
      category: "sheet",
      description: "",
      quantity: "",
      price: "",
      brand: "",
      color: "",
      finish: "",
      face: "",
      dimensions: "",
      type: "",
      material: "",
      sub_category: "",
      name: "",
      supplier_id: supplierId || "",
      measurement_unit: "",
      supplier_reference: "",
      supplier_product_link: "",
      is_sunmica: false,
    });
    setImagePreview(null);
    setErrors({});
    setIsDropdownOpen(false);
    setIsSubCategoryDropdownOpen(false);
    setIsSupplierDropdownOpen(false);
    setSearchTerm("Sheet");
    setSubCategorySearchTerm("");
    setSupplierSearchTerm("");
    setSelectedCategory("Sheet");
    faceAutoSetRef.current = false;
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
    setErrors(errors);
    return Object.keys(errors).length === 0;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs">
      <div className="absolute inset-0 bg-slate-900/40" onClick={() => setShowModal(false)} />

      <div className="relative bg-white w-full max-w-4xl mx-4 rounded-xl shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800">Add New Item</h2>
          <button
            onClick={() => {
              resetForm();
              setShowModal(false);
            }}
            className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Item Image Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-slate-800">Item Image</h3>
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
                  Item Image <span className="text-slate-400">(Optional)</span>
                </p>
              </div>
            </div>

            {/* Basic Information Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-slate-800">Basic Information</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative" ref={dropdownRef}>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
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
                        className={`w-5 h-5 transition-transform duration-200 ${isDropdownOpen ? "rotate-180" : ""}`}
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
                            onClick={() => handleCategorySelect(category)}
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
                    Quantity <span className="text-slate-400">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                    placeholder="Eg. 100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Price per Unit (including GST) <span className="text-slate-400">(Optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500">$</span>
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

                {/* Supplier Dropdown - Only show when supplierId is not provided */}
                {!supplierId && (
                  <div className="relative" ref={supplierDropdownRef}>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Supplier <span className="text-slate-400">(Optional)</span>
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
                        onClick={() => setIsSupplierDropdownOpen(!isSupplierDropdownOpen)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <ChevronDown
                          className={`w-5 h-5 transition-transform duration-200 ${isSupplierDropdownOpen ? "rotate-180" : ""}`}
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
                                  supplier.name
                                )
                              }
                              className="cursor-pointer w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg last:rounded-b-lg"
                            >
                              <div>
                                <div className="font-medium">{supplier.name}</div>
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
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Measurement Unit <span className="text-slate-400">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    name="measurement_unit"
                    value={formData.measurement_unit}
                    onChange={handleInputChange}
                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                    placeholder="Eg. sheet, meter, pcs, set, kit, etc."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Supplier Reference <span className="text-slate-400">(Optional)</span>
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
                    Supplier Product Link <span className="text-slate-400">(Optional)</span>
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
                  Description <span className="text-slate-400">(Optional)</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                  placeholder="Eg. This is a description of the item"
                  rows={3}
                />
              </div>
            </div>

            {/* Category Details Section */}
            {selectedCategory && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold text-slate-800">{selectedCategory} Details</h3>
                </div>

                {selectedCategory.toLowerCase() === "sheet" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {["brand", "color", "finish", "face", "dimensions"].map((field) => (
                        <div key={field}>
                          <label className="block text-sm font-medium text-slate-700 mb-2 capitalize">
                            {field}
                          </label>
                          <input
                            type="text"
                            name={field}
                            value={formData[field]}
                            onChange={handleInputChange}
                            disabled={field === "face" && formData.is_sunmica}
                            className={`w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none ${
                              field === "face" && formData.is_sunmica ? "bg-slate-100 cursor-not-allowed" : ""
                            }`}
                            placeholder={`Enter ${field}`}
                          />
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
                        <span className="text-sm font-medium text-slate-700">Is Sunmica</span>
                      </label>
                      {formData.is_sunmica && (
                        <p className="mt-1 text-xs text-slate-500">
                          Face field is automatically set to "1" for sunmica items
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {selectedCategory.toLowerCase() === "handle" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {["brand", "color", "type", "material", "dimensions"].map((field) => (
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative" ref={subCategoryDropdownRef}>
                      <label className="block text-sm font-medium text-slate-700 mb-2 capitalize">
                        Sub Category
                      </label>
                      <div className="relative">
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
                          className="w-full text-sm text-slate-800 px-4 py-3 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                          placeholder="Search or select sub category..."
                        />
                        <button
                          type="button"
                          onClick={() => setIsSubCategoryDropdownOpen(!isSubCategoryDropdownOpen)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          <ChevronDown
                            className={`w-5 h-5 transition-transform duration-200 ${
                              isSubCategoryDropdownOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </div>

                      {isSubCategoryDropdownOpen && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                          {filteredSubCategories.length > 0 ? (
                            filteredSubCategories.map((subCategory, index) => (
                              <button
                                key={index}
                                type="button"
                                onClick={() => handleSubCategorySelect(subCategory)}
                                className="w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg last:rounded-b-lg"
                              >
                                {subCategory}
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-slate-500 text-center">
                              {subCategorySearchTerm
                                ? `No matching sub categories found. Press Enter to use "${subCategorySearchTerm}"`
                                : "Type to search or add a custom sub category"}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {["brand", "name", "type", "dimensions"].map((field) => (
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
                          placeholder={`Enter ${field.replace("_", " ")}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {selectedCategory.toLowerCase() === "accessory" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Item Name</label>
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {["brand", "color", "finish", "dimensions"].map((field) => (
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
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowModal(false);
                }}
                disabled={isSubmitting}
                className="cursor-pointer px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`cursor-pointer px-4 py-2 rounded-lg font-medium transition-all duration-200 text-sm ${
                  isSubmitting
                    ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                    : "bg-primary text-white hover:bg-primary/90"
                }`}
              >
                {isSubmitting ? "Adding Item..." : "Add Item"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
