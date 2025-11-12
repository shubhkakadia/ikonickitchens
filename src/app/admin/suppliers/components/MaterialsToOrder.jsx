import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus,
  Package,
  ChevronDown,
  Calendar,
  FileText,
  CheckCircle,
} from "lucide-react";
import PurchaseOrderForm from "./PurchaseOrderForm";

export default function MaterialsToOrder({
  supplier,
  supplierId,
  onCountChange,
}) {
  const { getToken } = useAuth();
  const [materialsToOrder, setMaterialsToOrder] = useState([]);
  const [loadingMTO, setLoadingMTO] = useState(false);
  const [mtoActiveTab, setMtoActiveTab] = useState("active");
  const [showCreatePurchaseOrderModal, setShowCreatePurchaseOrderModal] =
    useState(false);

  const fetchMaterialsToOrder = async () => {
    try {
      setLoadingMTO(true);
      const sessionToken = getToken();
      if (!sessionToken) return;
      const response = await axios.get(
        `/api/materials_to_order/by-supplier/${supplierId}`,
        {
          headers: { Authorization: `Bearer ${sessionToken}` },
        }
      );
      if (response.data.status) {
        const data = response.data.data || [];
        setMaterialsToOrder(data);
        if (onCountChange) onCountChange(data.length || 0);
      }
    } catch (err) {
      console.error("Error fetching materials to order:", err);
      toast.error(
        err.response?.data?.message || "Failed to fetch materials to order",
        {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        }
      );
    } finally {
      setLoadingMTO(false);
    }
  };

  useEffect(() => {
    if (!supplierId) return;
    fetchMaterialsToOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  return (
    <div>
      <div className="border-b border-slate-200 mb-4 flex items-center justify-between">
        <nav className="flex space-x-8">
          <button
            onClick={() => setMtoActiveTab("active")}
            className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
              mtoActiveTab === "active"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-2">
              Active
              {materialsToOrder.filter(
                (mto) =>
                  mto.status === "DRAFT" || mto.status === "PARTIALLY_ORDERED"
              ).length > 0 && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {
                    materialsToOrder.filter(
                      (mto) =>
                        mto.status === "DRAFT" ||
                        mto.status === "PARTIALLY_ORDERED"
                    ).length
                  }
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setMtoActiveTab("completed")}
            className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${
              mtoActiveTab === "completed"
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center gap-2">
              Completed
              {materialsToOrder.filter(
                (mto) =>
                  mto.status === "FULLY_ORDERED" || mto.status === "CLOSED"
              ).length > 0 && (
                <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {
                    materialsToOrder.filter(
                      (mto) =>
                        mto.status === "FULLY_ORDERED" ||
                        mto.status === "CLOSED"
                    ).length
                  }
                </span>
              )}
            </div>
          </button>
        </nav>
        <button
          onClick={() => setShowCreatePurchaseOrderModal(true)}
          className="cursor-pointer px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Purchase Order
        </button>
      </div>
      {loadingMTO ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary"></div>
        </div>
      ) : materialsToOrder.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <Package className="w-8 h-8 mx-auto mb-2 text-slate-400" />
          <p className="text-sm">
            No materials to order found for this supplier
          </p>
        </div>
      ) : (
        <>
          {/* Materials to Order Content */}
          <div className="space-y-2">
            {materialsToOrder
              .filter((mto) => {
                if (mtoActiveTab === "active") {
                  // Active when still orderable
                  return (
                    mto.status === "DRAFT" || mto.status === "PARTIALLY_ORDERED"
                  );
                } else {
                  // Completed when fully ordered or closed
                  return (
                    mto.status === "FULLY_ORDERED" || mto.status === "CLOSED"
                  );
                }
              })
              .map((mto) => (
                <div
                  key={mto.id}
                  className="border border-slate-200 rounded-lg"
                >
                  <button
                    onClick={() => {
                      const element = document.getElementById(`mto-${mto.id}`);
                      if (element) {
                        element.classList.toggle("hidden");
                      }
                    }}
                    className="w-full p-4 text-left hover:bg-slate-50 transition-colors flex items-center justify-between"
                  >
                    <div className="flex-1 flex items-center gap-3">
                      <h4 className="text-sm font-bold text-slate-800 w-96 truncate shrink-0">
                        {mto.project?.name || "Project"}
                      </h4>
                      {mto.lots && mto.lots.length > 0 && (
                        <div className="flex flex-col items-start gap-2">
                          {mto.lots.map((lot) => (
                            <span
                              key={lot.lot_id}
                              className="text-xs px-2 py-1 bg-purple-100 text-purple-800 rounded"
                            >
                              {lot.name} ({lot.lot_id})
                            </span>
                          ))}
                        </div>
                      )}
                      <span
                        className={`ml-auto px-2 py-1 text-xs font-medium rounded w-36 text-center shrink-0 ${
                          mto.status === "DRAFT"
                            ? "bg-yellow-100 text-yellow-800"
                            : mto.status === "ORDERED"
                            ? "bg-blue-100 text-blue-800"
                            : mto.status === "RECEIVED"
                            ? "bg-green-100 text-green-800"
                            : mto.status === "PARTIALLY_ORDERED"
                            ? "bg-purple-100 text-purple-800"
                            : mto.status === "CLOSED"
                            ? "bg-slate-200 text-slate-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {mto.status}
                      </span>
                    </div>
                    <div className="ml-4">
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    </div>
                  </button>
                  <div
                    id={`mto-${mto.id}`}
                    className="hidden px-4 pb-4 border-t border-slate-100"
                  >
                    <div className="mt-4">
                      {/* MTO Details */}
                      <div className="mb-4 p-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-4 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                              <span className="font-medium">Ordered:</span>{" "}
                              {mto.createdAt
                                ? new Date(mto.createdAt).toLocaleString()
                                : "No date"}
                            </span>
                          </div>
                          {mto.notes && (
                            <div className="flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5" />
                              <span>
                                <span className="font-medium">Notes:</span>{" "}
                                {mto.notes}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Items List */}
                      {mto.items && mto.items.length > 0 && (
                        <div>
                          <h5 className="text-xs font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                            Items ({mto.items.length})
                          </h5>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Image
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Category
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Details
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Quantity
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    Status
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-slate-200">
                                {mto.items.map((item) => (
                                  <tr
                                    key={item.id}
                                    className="hover:bg-slate-50 transition-colors"
                                  >
                                    {/* Image Column */}
                                    <td className="px-4 py-2 whitespace-nowrap">
                                      <div className="flex items-center">
                                        {item.item.image ? (
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
                                            item.item.image ? "hidden" : "flex"
                                          }`}
                                        >
                                          <Package className="w-6 h-6 text-slate-400" />
                                        </div>
                                      </div>
                                    </td>

                                    {/* Category Column */}
                                    <td className="px-4 py-2 whitespace-nowrap">
                                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                        {item.item.category}
                                      </span>
                                    </td>

                                    {/* Details Column */}
                                    <td className="px-4 py-2">
                                      <div className="text-xs text-slate-600 space-y-1">
                                        {item.item.sheet && (
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
                                        {item.item.handle && (
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
                                        {item.item.hardware && (
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
                                        {item.item.accessory && (
                                          <>
                                            <div>
                                              <span className="font-medium">
                                                Name:
                                              </span>{" "}
                                              {item.item.accessory.name}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    </td>

                                    {/* Quantity Column */}
                                    <td className="px-4 py-2 whitespace-nowrap">
                                      <div className="text-xs text-slate-600">
                                        <div className="flex items-center gap-1.5 mb-1">
                                          <Package className="w-3.5 h-3.5 text-slate-400" />
                                          <span>
                                            <span className="font-medium">
                                              Qty:
                                            </span>{" "}
                                            {item.quantity}{" "}
                                            {item.item.measurement_unit}
                                          </span>
                                        </div>
                                        {item.quantity_ordered > 0 && (
                                          <div className="flex items-center gap-1.5 text-blue-600 text-xs">
                                            <CheckCircle className="w-3 h-3" />
                                            <span>
                                              Ordered: {item.quantity_ordered}
                                            </span>
                                          </div>
                                        )}
                                        {item.quantity_received > 0 && (
                                          <div className="flex items-center gap-1.5 text-green-600 text-xs">
                                            <CheckCircle className="w-3 h-3" />
                                            <span>
                                              Received: {item.quantity_received}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </td>

                                    {/* Status Column */}
                                    <td className="px-4 py-2 whitespace-nowrap">
                                      {item.quantity_ordered > 0 && (
                                        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                          Ordered
                                        </span>
                                      )}
                                      {item.quantity_received > 0 && (
                                        <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded">
                                          Received
                                        </span>
                                      )}
                                      {item.quantity_ordered === 0 &&
                                        item.quantity_received === 0 && (
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
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
      {showCreatePurchaseOrderModal && (
        <PurchaseOrderForm
          materialsToOrder={materialsToOrder}
          supplier={supplier}
          setShowCreatePurchaseOrderModal={setShowCreatePurchaseOrderModal}
          fetchMaterialsToOrder={fetchMaterialsToOrder}
        />
      )}
    </div>
  );
}
