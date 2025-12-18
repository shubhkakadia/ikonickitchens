import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import { X, FileText, Eye, Trash2, Package, Search, Plus, ChevronDown } from "lucide-react";
import Image from "next/image";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";

export default function CreatePurchaseOrderModal({ setShowModal, onSuccess }) {
  const { getToken, userData } = useAuth();

  // Data States
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierItems, setSupplierItems] = useState([]);
  const [itemSearch, setItemSearch] = useState("");

  // Form States
  const [poOrderNo, setPoOrderNo] = useState("");
  const [poTotal, setPoTotal] = useState("");
  const [poDeliveryCharge, setPoDeliveryCharge] = useState("");
  const [poInvoiceDate, setPoInvoiceDate] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);

  // File Upload States
  const [poInvoiceFile, setPoInvoiceFile] = useState(null);
  const [poInvoicePreview, setPoInvoicePreview] = useState(null);
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);

  // UI States
  const [loading, setLoading] = useState(false);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [showItemSearchResults, setShowItemSearchResults] = useState(false);
  const searchRef = useRef(null);

  // Supplier Search State
  const [supplierSearchTerm, setSupplierSearchTerm] = useState("");
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const supplierDropdownRef = useRef(null);

  // Fetch Suppliers on Mount
  useEffect(() => {
    fetchSuppliers();
  }, []);

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

  const fetchSuppliers = async () => {
    try {
      setLoadingSuppliers(true);
      const sessionToken = getToken();
      if (!sessionToken) return;

      const response = await axios.get("/api/supplier/all", {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.data.status) {
        setSuppliers(response.data.data || []);
      } else {
        toast.error("Failed to fetch suppliers");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error fetching suppliers");
    } finally {
      setLoadingSuppliers(false);
    }
  };

  const fetchSupplierItems = async (supplierId) => {
    try {
      setLoadingItems(true);
      const sessionToken = getToken();
      if (!sessionToken) return;

      const response = await axios.get(`/api/item/by-supplier/${supplierId}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });

      if (response.data.status) {
        setSupplierItems(response.data.data || []);
      } else {
        setSupplierItems([]);
        // Don't show error if no items, just empty list
      }
    } catch (err) {
      console.error(err);
      setSupplierItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  // Close supplier dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target)) {
        setIsSupplierDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(supplierSearchTerm.toLowerCase())
  );

  const handleSupplierSearchChange = (e) => {
    setSupplierSearchTerm(e.target.value);
    setIsSupplierDropdownOpen(true);
  };

  const handleSupplierSelect = (supplierId, supplierName) => {
    const supplier = suppliers.find(s => s.supplier_id === supplierId);
    setSelectedSupplier(supplier);
    setSupplierSearchTerm(supplierName);
    setIsSupplierDropdownOpen(false);
    fetchSupplierItems(supplierId);
    setSelectedItems([]); // Clear selected items when supplier changes
  };

  // Filter items based on search
  const filteredItems = supplierItems.filter(item => {
    if (!itemSearch) return false;
    const searchLower = itemSearch.toLowerCase();

    // Check various fields
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

  const handleAddItem = (item) => {
    // Check if already added
    if (selectedItems.some(i => i.item_id === item.item_id)) {
      toast.info("Item already added");
      return;
    }

    setSelectedItems(prev => [...prev, {
      ...item,
      item_id: item.item_id,
      order_quantity: 1, // Default quantity
      order_unit_price: item.price || 0, // Default price
    }]);
    setItemSearch("");
    setShowItemSearchResults(false);
  };

  const handleUpdateItem = (itemId, field, value) => {
    setSelectedItems(prev => prev.map(item => {
      if (item.item_id === itemId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleRemoveItem = (itemId) => {
    setSelectedItems(prev => prev.filter(item => item.item_id !== itemId));
  };

  const [isDragging, setIsDragging] = useState(false);

  const validateAndSetFile = (file) => {
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF and image files are allowed");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setPoInvoiceFile(file);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => setPoInvoicePreview(reader.result);
      reader.readAsDataURL(file);
    } else {
      setPoInvoicePreview(null);
    }
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

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleInvoiceFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndSetFile(file);
  };

  const handleCreatePO = async () => {
    if (!selectedSupplier) {
      toast.error("Please select a supplier");
      return;
    }
    if (!poOrderNo.trim()) {
      toast.error("Please enter an Order Number");
      return;
    }
    if (selectedItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    // Validate quantities
    const invalidItems = selectedItems.some(item => !item.order_quantity || item.order_quantity <= 0);
    if (invalidItems) {
      toast.error("All items must have a quantity greater than 0");
      return;
    }

    setLoading(true);
    try {
      const sessionToken = getToken();
      if (!sessionToken) throw new Error("No session token");

      const calculatedTotal = selectedItems.reduce(
        (sum, item) => sum + (parseFloat(item.order_quantity) || 0) * (parseFloat(item.order_unit_price) || 0),
        0
      );

      const finalTotal = poTotal ? parseFloat(poTotal) : calculatedTotal;

      const formData = new FormData();
      formData.append("supplier_id", selectedSupplier.supplier_id);
      formData.append("order_no", poOrderNo);
      formData.append("orderedBy_id", userData?.user?.id || "");
      formData.append("total_amount", finalTotal.toString());
      if (poDeliveryCharge && parseFloat(poDeliveryCharge) > 0) {
        formData.append("delivery_charge", poDeliveryCharge);
      }
      if (poInvoiceDate) {
        formData.append("invoice_date", poInvoiceDate);
      }
      formData.append("notes", poNotes);

      const itemsData = selectedItems.map(item => ({
        item_id: item.item_id,
        quantity: parseFloat(item.order_quantity),
        unit_price: parseFloat(item.order_unit_price),
        notes: ""
      }));

      // The API expects a string of JSON objects separated by comma? 
      // Checking PurchaseOrderForm.jsx: 
      // const itemsString = poItems.map(item => JSON.stringify({...})).join(",");
      // formData.append("items", itemsString);

      const itemsString = itemsData.map(item => JSON.stringify(item)).join(",");
      formData.append("items", itemsString);

      if (poInvoiceFile) {
        formData.append("invoice", poInvoiceFile);
      }

      const response = await axios.post("/api/purchase_order/create", formData, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.status) {
        toast.success("Purchase Order Created Successfully");
        if (onSuccess) onSuccess();
        setShowModal(false);
      } else {
        toast.error(response.data.message || "Failed to create Purchase Order");
      }

    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.message || "Failed to create Purchase Order");
    } finally {
      setLoading(false);
    }
  };

  const getItemDisplayName = (item) => {
    if (item.sheet) return `${item.sheet.brand} ${item.sheet.color} ${item.sheet.finish}`;
    if (item.handle) return `${item.handle.brand} ${item.handle.color} ${item.handle.type}`;
    if (item.hardware) return `${item.hardware.brand} ${item.hardware.name}`;
    if (item.accessory) return item.accessory.name;
    if (item.edging_tape) return `${item.edging_tape.brand} ${item.edging_tape.color}`;
    return item.description || "Item";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs">
      <div className="absolute inset-0 bg-slate-900/40" onClick={() => setShowModal(false)} />

      <div className="relative bg-white w-full max-w-6xl mx-4 rounded-xl shadow-xl border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="text-xl font-semibold text-slate-800">Create Purchase Order</h2>
          <button onClick={() => setShowModal(false)} className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Section: Supplier & Order Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Supplier */}
            <div className="relative" ref={supplierDropdownRef}>
              <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                Select Supplier <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={supplierSearchTerm}
                  onChange={handleSupplierSearchChange}
                  onFocus={() => setIsSupplierDropdownOpen(true)}
                  className="w-full text-sm text-slate-800 px-4 py-3 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                  placeholder="Search or select supplier..."
                  disabled={loadingSuppliers}
                />
                <button
                  type="button"
                  onClick={() => setIsSupplierDropdownOpen(!isSupplierDropdownOpen)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {loadingSuppliers ? (
                    <div className="animate-spin h-4 w-4 border-2 border-slate-400 border-t-transparent rounded-full"></div>
                  ) : (
                    <ChevronDown
                      className={`w-5 h-5 transition-transform duration-200 ${isSupplierDropdownOpen ? "rotate-180" : ""
                        }`}
                    />
                  )}
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

            {/* Order No */}
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                Order Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={poOrderNo}
                onChange={(e) => setPoOrderNo(e.target.value)}
                placeholder="e.g. PO-2025-001"
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>

            {/* Total Amount */}
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                Total Amount (Optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                <input
                  type="number"
                  value={poTotal}
                  onChange={(e) => setPoTotal(e.target.value)}
                  placeholder="Auto-calculated"
                  className="w-full px-4 py-3 pl-7 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>

          {/* Delivery Charge and Invoice Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                Delivery Charge (Optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={poDeliveryCharge}
                  onChange={(e) => setPoDeliveryCharge(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-3 pl-7 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                Invoice Date (Optional)
              </label>
              <input
                type="date"
                value={poInvoiceDate}
                onChange={(e) => setPoInvoiceDate(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
          </div>

          <hr className="border-slate-100" />
          {/* Item Selection & List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Items</h3>
            </div>
            {/* Search Bar */}
            <div className="relative mb-6" ref={searchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder={selectedSupplier ? "Search items by name, category, brand..." : "Select a supplier to search items"}
                  value={itemSearch}
                  onChange={(e) => {
                    setItemSearch(e.target.value);
                    setShowItemSearchResults(true);
                  }}
                  onFocus={() => setShowItemSearchResults(true)}
                  disabled={!selectedSupplier}
                  className="w-full p-2.5 pl-10 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>

              {/* Search Results Dropdown */}
              {showItemSearchResults && itemSearch && selectedSupplier && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                  {loadingItems ? (
                    <div className="p-4 text-center text-slate-500 text-sm">Loading items...</div>
                  ) : filteredItems.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-sm">No items found</div>
                  ) : (
                    filteredItems.map(item => (
                      <div
                        key={item.item_id}
                        onClick={() => handleAddItem(item)}
                        className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 flex items-center gap-3"
                      >
                        <div className="w-10 h-10 bg-slate-100 rounded border border-slate-200 shrink-0 flex items-center justify-center overflow-hidden">
                          {item.image?.url ? (
                            <Image src={`/${item.image.url}`} alt="Item" width={40} height={40} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{getItemDisplayName(item)}</p>
                          <p className="text-xs text-slate-500">{item.category} • Stock: {item.quantity} {item.measurement_unit}</p>
                        </div>
                        <Plus className="w-4 h-4 text-primary ml-auto" />
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Selected Items Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Image</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Details</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Stock</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Quantity</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Unit Price (including GST)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Total</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {selectedItems.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-4 py-8 text-center text-slate-500 text-sm">
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
                              <Image src={`/${item.image.url}`} alt="Item" width={40} height={40} className="w-full h-full object-cover" />
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
                                <div><span className="font-medium">Color:</span> {item.sheet.color}</div>
                                <div><span className="font-medium">Finish:</span> {item.sheet.finish}</div>
                                <div><span className="font-medium">Face:</span> {item.sheet.face || "-"}</div>
                                <div><span className="font-medium">Dimensions:</span> {item.sheet.dimensions}</div>
                              </>
                            )}
                            {item.handle && (
                              <>
                                <div><span className="font-medium">Color:</span> {item.handle.color}</div>
                                <div><span className="font-medium">Type:</span> {item.handle.type}</div>
                                <div><span className="font-medium">Dimensions:</span> {item.handle.dimensions}</div>
                                <div><span className="font-medium">Material:</span> {item.handle.material || "-"}</div>
                              </>
                            )}
                            {item.hardware && (
                              <>
                                <div><span className="font-medium">Name:</span> {item.hardware.name}</div>
                                <div><span className="font-medium">Type:</span> {item.hardware.type}</div>
                                <div><span className="font-medium">Dimensions:</span> {item.hardware.dimensions}</div>
                                <div><span className="font-medium">Sub Category:</span> {item.hardware.sub_category}</div>
                              </>
                            )}
                            {item.accessory && (
                              <>
                                <div><span className="font-medium">Name:</span> {item.accessory.name}</div>
                              </>
                            )}
                            {item.edging_tape && (
                              <>
                                <div><span className="font-medium">Brand:</span> {item.edging_tape.brand || "-"}</div>
                                <div><span className="font-medium">Color:</span> {item.edging_tape.color || "-"}</div>
                                <div><span className="font-medium">Finish:</span> {item.edging_tape.finish || "-"}</div>
                                <div><span className="font-medium">Dimensions:</span> {item.edging_tape.dimensions || "-"}</div>
                              </>
                            )}
                            {!item.sheet && !item.handle && !item.hardware && !item.accessory && !item.edging_tape && (
                              <div>{item.description || "-"}</div>
                            )}
                          </div>
                        </td>

                        {/* Stock Column */}
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {item.quantity} {item.measurement_unit}
                        </td>

                        {/* Quantity Column */}
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="1"
                            value={item.order_quantity}
                            onChange={(e) => handleUpdateItem(item.item_id, "order_quantity", e.target.value)}
                            className="w-20 p-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-primary outline-none"
                          />
                        </td>

                        {/* Unit Price Column */}
                        <td className="px-4 py-3">
                          <div className="flex items-center"> {/* Added flex container */}
                            <span className="text-sm text-slate-500 mr-1">$</span> {/* Dollar sign outside */}
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.order_unit_price}
                              onChange={(e) => handleUpdateItem(item.item_id, "order_unit_price", e.target.value)}
                              className="w-24 p-1.5 border border-slate-300 rounded text-sm focus:ring-1 focus:ring-primary outline-none" // Removed pl-5
                            />
                          </div>
                        </td>

                        {/* Total Column */}
                        <td className="px-4 py-3 text-sm font-medium text-slate-800">
                          ${((parseFloat(item.order_quantity) || 0) * (parseFloat(item.order_unit_price) || 0)).toFixed(2)}
                        </td>

                        {/* Actions Column */}
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleRemoveItem(item.item_id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {selectedItems.length > 0 && (
                  <tfoot className="bg-slate-50 font-medium">
                    <tr>
                      <td colSpan="6" className="px-4 py-3 text-right text-sm text-slate-600">Calculated Total:</td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        ${selectedItems.reduce((sum, item) => sum + (parseFloat(item.order_quantity) || 0) * (parseFloat(item.order_unit_price) || 0), 0).toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* File Upload & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Invoice Upload */}
            <div>
              <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1.5 font-medium">
                Invoice / Receipt
              </label>
              {!poInvoiceFile ? (
                <div
                  className={`border-2 border-dashed rounded-lg py-8 transition-all ${isDragging
                    ? "border-primary bg-blue-50"
                    : "border-slate-300 hover:border-primary hover:bg-slate-50"
                    }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    id="invoice-upload"
                    accept="application/pdf,image/jpeg,image/jpg,image/png"
                    onChange={handleInvoiceFileChange}
                    className="hidden"
                  />
                  <label htmlFor="invoice-upload" className="cursor-pointer flex flex-col items-center text-center w-full h-full">
                    <FileText className={`w-8 h-8 mb-2 ${isDragging ? "text-primary" : "text-slate-400"}`} />
                    <p className={`text-sm font-medium ${isDragging ? "text-primary" : "text-slate-700"}`}>
                      {isDragging ? "Drop file here" : "Click to upload or drag and drop"}
                    </p>
                  </label>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg p-3 flex items-center justify-between bg-slate-50">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {poInvoicePreview ? (
                      <Image src={poInvoicePreview} alt="Preview" width={40} height={40} className="w-10 h-10 rounded object-cover border border-slate-200" />
                    ) : (
                      <div className="w-10 h-10 bg-white rounded border border-slate-200 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{poInvoiceFile.name}</p>
                      <p className="text-xs text-slate-500">{(poInvoiceFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setShowInvoicePreview(true)}
                      className="cursor-pointer p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-colors">
                      <Eye className="w-4 h-4 text-slate-600" />
                    </button>
                    <button onClick={() => { setPoInvoiceFile(null); setPoInvoicePreview(null); }}
                      className="cursor-pointer p-1.5 hover:bg-red-50 rounded border border-transparent hover:border-red-100 transition-colors">
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
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
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
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
            onClick={handleCreatePO}
            disabled={loading}
            className="cursor-pointer px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="cursor-pointer animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Creating...
              </>
            ) : "Create Purchase Order"}
          </button>
        </div>
      </div>

      {/* Invoice Preview Modal */}
      {showInvoicePreview && poInvoiceFile && (
        <ViewMedia
          selectedFile={poInvoiceFile}
          setSelectedFile={() => { }}
          setViewFileModal={setShowInvoicePreview}
          setPageNumber={setPageNumber}
        />
      )}
    </div>
  );
}