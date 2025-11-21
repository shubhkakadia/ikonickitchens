"use client";
import React, { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  ChevronDown,
  ChevronUp,
  Package,
  Layers,
  Image as ImageIcon,
  Check,
  X,
} from "lucide-react";
import Image from "next/image";

export default function page() {
  const { getToken } = useAuth();
  const [mtos, setMtos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedMto, setExpandedMto] = useState(null);
  const [quantityInputs, setQuantityInputs] = useState({});
  const [saving, setSaving] = useState(false);

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
          hideProgressBar: false,
        });
        return;
      }

      const response = await axios.get("/api/materials_to_order/all", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        setMtos(response.data.data);
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
    } finally {
      setLoading(false);
    }
  };

  const toggleAccordion = (mtoId) => {
    setExpandedMto(expandedMto === mtoId ? null : mtoId);
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
          initialInputs[item.id] = item.quantity_used || 0;
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
        [mtoItemId]: mtoItem.quantity_used || 0,
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

      const inputValue = quantityInputs[mtoItem.id] || 0;
      const currentUsed = mtoItem.quantity_used || 0;
      const totalQuantity = mtoItem.quantity;

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

  return (
    <AdminRoute>
      <div className="flex h-screen bg-tertiary">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CRMLayout />
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 flex-shrink-0">
              <h1 className="text-xl font-bold text-slate-700">
                Used Material
              </h1>
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
                ) : mtos.length === 0 ? (
                  <div className="flex justify-center items-center h-full">
                    <div className="text-center">
                      <div className="h-12 w-12 text-slate-400 mx-auto mb-4">
                        📦
                      </div>
                      <p className="text-sm text-slate-500 font-medium">
                        No Jobs found
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto px-4 py-3">
                    <div className="space-y-2">
                      {mtos.map((mto) => {
                        const isExpanded = expandedMto === mto.id;
                        const groupedItems = groupItemsByCategory(
                          mto.items || []
                        );
                        const lotIds =
                          mto.lots && mto.lots.length > 0
                            ? mto.lots.map((lot) => lot.lot_id).join(", ")
                            : "N/A";

                        return (
                          <div
                            key={mto.id}
                            className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
                          >
                            {/* Accordion Header */}
                            <button
                              onClick={() => toggleAccordion(mto.id)}
                              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1 text-left">
                                <div className="flex-shrink-0">
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-slate-500" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-slate-500" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-semibold text-slate-700">
                                    {mto.project?.name || "Unknown Project"}
                                  </div>
                                  <div className="text-sm text-slate-500 mt-0.5">
                                    Lot ID: {lotIds}
                                  </div>
                                </div>
                              </div>
                            </button>

                            {/* Accordion Content */}
                            {isExpanded && (
                              <div className="border-t border-slate-200 px-4 py-3 bg-slate-50">
                                {Object.keys(groupedItems).length === 0 ? (
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
                                              {formatCategoryName(category)}
                                            </h3>
                                            <span className="text-sm text-slate-500 ml-auto font-medium">
                                              {items.length} item(s)
                                            </span>
                                          </div>
                                          <div className="space-y-3">
                                            {items.map((mtoItem) => {
                                              const itemDetails =
                                                getItemDetails(mtoItem.item);
                                              const hasChanges =
                                                quantityInputs[mtoItem.id] !==
                                                  undefined &&
                                                quantityInputs[mtoItem.id] !==
                                                  (mtoItem.quantity_used || 0);
                                              return (
                                                <div
                                                  key={mtoItem.id}
                                                  className="bg-slate-50 rounded-lg p-3 border border-slate-200 hover:bg-slate-100 transition-colors"
                                                >
                                                  {/* Single Row: Item Details + Quantity Columns */}
                                                  <div className="flex gap-4 items-center">
                                                    {/* Item Image */}
                                                    <div className="flex-shrink-0">
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
                                                            onError={(e) => {
                                                              e.target.style.display =
                                                                "none";
                                                              const fallback =
                                                                e.target.parentElement?.querySelector(
                                                                  ".image-fallback"
                                                                );
                                                              if (fallback) {
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
                                                              {itemDetails.type}
                                                            </span>
                                                          </div>
                                                        )}
                                                        {itemDetails?.sub_category && (
                                                          <div>
                                                            <span className="text-slate-500 font-bold">
                                                              Sub Category:
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
                                                              {itemDetails.face}
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
                                                                mtoItem.item
                                                                  .supplier.name
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
                                                        {mtoItem.quantity}
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
                                                    <div className="text-center min-w-[80px]">
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
                                                          max={mtoItem.quantity}
                                                          value={
                                                            quantityInputs[
                                                              mtoItem.id
                                                            ] !== undefined
                                                              ? quantityInputs[
                                                                  mtoItem.id
                                                                ]
                                                              : mtoItem.quantity_used ||
                                                                0
                                                          }
                                                          onChange={(e) => {
                                                            const value =
                                                              parseInt(
                                                                e.target.value
                                                              ) || 0;
                                                            handleQuantityInputChange(
                                                              mtoItem.id,
                                                              value
                                                            );
                                                          }}
                                                          className="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none text-center font-medium"
                                                          disabled={saving}
                                                        />
                                                        {mtoItem.item
                                                          ?.measurement_unit && (
                                                          <div className="text-xs text-slate-500 mt-1">
                                                            {
                                                              mtoItem.item
                                                                .measurement_unit
                                                            }
                                                          </div>
                                                        )}
                                                        {quantityInputs[
                                                          mtoItem.id
                                                        ] !== undefined &&
                                                          quantityInputs[
                                                            mtoItem.id
                                                          ] >
                                                            mtoItem.quantity && (
                                                            <div className="text-xs text-red-600 font-medium">
                                                              Max:{" "}
                                                              {mtoItem.quantity}
                                                            </div>
                                                          )}
                                                      </div>
                                                    </div>

                                                    {/* Actions Column */}
                                                    <div className="text-center min-w-[80px]">
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
                                                            disabled={saving}
                                                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
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
                                                            disabled={
                                                              saving ||
                                                              (quantityInputs[
                                                                mtoItem.id
                                                              ] !== undefined &&
                                                                quantityInputs[
                                                                  mtoItem.id
                                                                ] >
                                                                  mtoItem.quantity)
                                                            }
                                                            className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </AdminRoute>
  );
}
