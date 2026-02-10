import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import { X, FileText, Eye, Trash2, Package, Search, Plus } from "lucide-react";
import Image from "next/image";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import AddItemModal from "@/app/admin/suppliers/purchaseorder/components/AddItemModal";

export default function CreateMaterialsToOrderModal({
  setShowModal,
  onSuccess,
}) {
  const { getToken, userData } = useAuth();

  // Data States
  const [allItems, setAllItems] = useState([]);
  const [itemSearch, setItemSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  // Form States
  const [mtoNotes, setMtoNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);

  // Category options
  const categoryOptions = [
    { label: "Sheet", value: "sheet" },
    { label: "Edging Tape", value: "edging_tape" },
    { label: "Handle", value: "handle" },
    { label: "Hardware", value: "hardware" },
    { label: "Accessory", value: "accessory" },
  ];

  // File Upload States
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  // UI States
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showItemSearchResults, setShowItemSearchResults] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const searchRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch items when category is selected
  useEffect(() => {
    if (selectedCategory) {
      fetchItemsByCategory(selectedCategory);
    } else {
      setAllItems([]);
    }
  }, [selectedCategory]);

  // Close search results on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowItemSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

    // Check various fields
    const matchesCategory = item.category?.toLowerCase().includes(searchLower);
    const matchesDesc = item.description?.toLowerCase().includes(searchLower);
    const matchesSupplierRef =
      item.itemSuppliers?.some((is) =>
        is.supplier_reference?.toLowerCase().includes(searchLower),
      ) || item.supplier_reference?.toLowerCase().includes(searchLower);

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

    return (
      matchesCategory || matchesDesc || matchesSupplierRef || matchesDetails
    );
  });

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
        quantity: 1, // Default order quantity
      },
    ]);
    setItemSearch("");
    setShowItemSearchResults(false);
  };

  const handleUpdateItem = (itemId, field, value) => {
    setSelectedItems((prev) =>
      prev.map((item) => {
        if (item.item_id === itemId) {
          return { ...item, [field]: value };
        }
        return item;
      }),
    );
  };

  const handleRemoveItem = (itemId) => {
    setSelectedItems((prev) => prev.filter((item) => item.item_id !== itemId));
  };

  const [isDragging, setIsDragging] = useState(false);

  const validateAndAddFile = (file) => {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF and image files are allowed");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setUploadedFiles((prev) => [...prev, file]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files || []);
    files.forEach((file) => validateAndAddFile(file));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => validateAndAddFile(file));
  };

  const handleRemoveFile = (index) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleViewFile = (file) => {
    setPreviewFile(file);
    setShowFilePreview(true);
  };

  const handleCreateMTO = async () => {
    if (selectedItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    // Validate quantities
    const invalidItems = selectedItems.some(
      (item) => !item.quantity || item.quantity <= 0,
    );
    if (invalidItems) {
      toast.error("All items must have a quantity greater than 0");
      return;
    }

    setLoading(true);
    try {
      const sessionToken = getToken();
      if (!sessionToken) throw new Error("No session token");

      // First create the MTO
      const requestData = {
        notes: mtoNotes || null,
        createdBy_id: userData?.user?.id || null,
        items: selectedItems.map((item) => ({
          item_id: item.item_id,
          quantity: parseInt(item.quantity),
          notes: "",
        })),
        lot_ids: [], // Can be empty for now
      };

      const response = await axios.post(
        "/api/materials_to_order/create",
        requestData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status) {
        const mtoId = response.data.data.id;

        // Upload files if any
        if (uploadedFiles.length > 0) {
          const formData = new FormData();
          uploadedFiles.forEach((file) => {
            formData.append("files", file);
          });

          await axios.post(
            `/api/uploads/materials-to-order/${mtoId}`,
            formData,
            {
              headers: {
                Authorization: `Bearer ${sessionToken}`,
                "Content-Type": "multipart/form-data",
              },
            },
          );
        }

        toast.success("Materials to Order Created Successfully");
        if (onSuccess) onSuccess();
        setShowModal(false);
      } else {
        toast.error(
          response.data.message || "Failed to create Materials to Order",
        );
      }
    } catch (err) {
      console.error(err);
      toast.error(
        err?.response?.data?.message || "Failed to create Materials to Order",
      );
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50">
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={() => setShowModal(false)}
      />

      <div className="relative bg-white w-full max-w-6xl mx-4 rounded-xl shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800">
            Create Materials to Order
          </h2>
          <button
            onClick={() => setShowModal(false)}
            className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
              <div className="relative flex-1" ref={searchRef}>
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
                    disabled={!selectedCategory}
                    className="w-full p-2.5 pl-10 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Search Results Dropdown */}
                {showItemSearchResults && itemSearch && selectedCategory && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                    {loadingItems ? (
                      <div className="p-4 text-center text-slate-500 text-sm">
                        Loading items...
                      </div>
                    ) : filteredItems.length === 0 ? (
                      <div className="p-4 text-center space-y-3">
                        <p className="text-slate-500 text-sm">No items found</p>
                        <button
                          onClick={() => setShowAddItemModal(true)}
                          className="cursor-pointer px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium flex items-center gap-2 mx-auto"
                        >
                          <Plus className="w-4 h-4" />
                          Add Item
                        </button>
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
                              {item.measurement_unit} • Dimensions:{" "}
                              {item.sheet?.dimensions ||
                                item.handle?.dimensions ||
                                item.hardware?.dimensions ||
                                item.edging_tape?.dimensions ||
                                "N/A"}{" "}
                              • Supplier Reference:{" "}
                              {item.itemSuppliers?.length > 0
                                ? item.itemSuppliers
                                    .map(
                                      (is) =>
                                        `${
                                          is.supplier?.name || "Unknown"
                                        }: ${is.supplier_reference || "N/A"}`,
                                    )
                                    .join(", ")
                                : item.supplier_reference || "N/A"}
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
                            {(() => {
                              const refs =
                                item.itemSuppliers?.length > 0
                                  ? item.itemSuppliers
                                      .map(
                                        (is) =>
                                          `${
                                            is.supplier?.name || "Unknown"
                                          }: ${is.supplier_reference || "N/A"}`,
                                      )
                                      .join(", ")
                                  : item.supplier_reference;
                              return (
                                refs && (
                                  <div>
                                    <span className="font-medium">
                                      Supplier Ref:
                                    </span>{" "}
                                    {refs}
                                  </div>
                                )
                              );
                            })()}
                            {item.sheet && (
                              <>
                                <div>
                                  <span className="font-medium">Color:</span>{" "}
                                  {item.sheet.color}
                                </div>
                                <div>
                                  <span className="font-medium">Finish:</span>{" "}
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
                                  <span className="font-medium">Color:</span>{" "}
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
                                  <span className="font-medium">Material:</span>{" "}
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
                                  <span className="font-medium">Brand:</span>{" "}
                                  {item.edging_tape.brand || "-"}
                                </div>
                                <div>
                                  <span className="font-medium">Color:</span>{" "}
                                  {item.edging_tape.color || "-"}
                                </div>
                                <div>
                                  <span className="font-medium">Finish:</span>{" "}
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
                                e.target.value,
                              )
                            }
                            className="w-20 p-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-primary outline-none"
                          />
                        </td>

                        {/* Actions Column */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleRemoveItem(item.item_id)}
                            className="cursor-pointer p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
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

          {/* File Upload & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* File Upload */}
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                Upload Files
              </label>
              {/* Always render the file input, but keep it hidden */}
              <input
                type="file"
                ref={fileInputRef}
                accept="application/pdf,image/jpeg,image/jpg,image/png"
                onChange={handleFileChange}
                multiple
                className="hidden"
              />
              {uploadedFiles.length === 0 ? (
                <div
                  className={`border-2 border-dashed rounded-lg py-8 transition-all ${
                    isDragging
                      ? "border-primary bg-blue-50"
                      : "border-slate-300 hover:border-primary hover:bg-slate-50"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="cursor-pointer flex flex-col items-center text-center w-full h-full">
                    <FileText
                      className={`w-8 h-8 mb-2 ${isDragging ? "text-primary" : "text-slate-400"}`}
                    />
                    <p
                      className={`text-sm font-medium ${isDragging ? "text-primary" : "text-slate-700"}`}
                    >
                      {isDragging
                        ? "Drop files here"
                        : "Click to upload or drag and drop"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="border border-slate-200 rounded-lg p-3 flex items-center justify-between bg-slate-50"
                    >
                      <div className="flex items-center gap-3 overflow-hidden flex-1">
                        {file.type.startsWith("image/") ? (
                          <img
                            src={URL.createObjectURL(file)}
                            alt="Preview"
                            className="w-10 h-10 rounded object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-white rounded border border-slate-200 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewFile(file)}
                          className="cursor-pointer p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-colors"
                        >
                          <Eye className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                          onClick={() => handleRemoveFile(index)}
                          className="cursor-pointer p-1.5 hover:bg-red-50 rounded border border-transparent hover:border-red-100 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="cursor-pointer w-full mt-2 p-2 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Add More Files
                  </button>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                Notes
              </label>
              <textarea
                rows={5}
                value={mtoNotes}
                onChange={(e) => setMtoNotes(e.target.value)}
                className="w-full p-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
                placeholder="Add any additional notes..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
          <button
            onClick={() => setShowModal(false)}
            disabled={loading}
            className="cursor-pointer px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white transition-colors text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreateMTO}
            disabled={loading}
            className="cursor-pointer px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="cursor-pointer animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Creating...
              </>
            ) : (
              "Create Materials to Order"
            )}
          </button>
        </div>
      </div>

      {/* File Preview Modal */}
      {showFilePreview && previewFile && (
        <ViewMedia
          selectedFile={previewFile}
          setSelectedFile={() => {}}
          setViewFileModal={setShowFilePreview}
          setPageNumber={setPageNumber}
        />
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <AddItemModal
          setShowModal={setShowAddItemModal}
          supplierId="" // Materials to Order doesn't require a supplier
          onItemAdded={() => {
            // Refresh items for the selected category after item is added
            if (selectedCategory) {
              fetchItemsByCategory(selectedCategory);
            }
          }}
        />
      )}
    </div>
  );
}
