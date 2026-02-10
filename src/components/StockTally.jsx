import React from "react";
import { useState } from "react";
import {
  Download,
  Upload,
  Check,
  Loader2,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  ClipboardList,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";

export default function StockTally({
  activeTab,
  setShowStockTallyModal,
  filteredAndSortedData,
}) {
  const { getToken } = useAuth();

  const [stockTallyStep, setStockTallyStep] = useState("download"); // "download", "upload", "preview"
  const [stockTallyFile, setStockTallyFile] = useState(null);
  const [stockTallyPreviewData, setStockTallyPreviewData] = useState([]);
  const [isProcessingStockTally, setIsProcessingStockTally] = useState(false);
  const [stockTallyError, setStockTallyError] = useState(null);

  const handleCloseStockTally = () => {
    setShowStockTallyModal(false);
    setStockTallyStep("download");
    setStockTallyFile(null);
    setStockTallyPreviewData([]);
    setStockTallyError(null);
  };

  // Get details string for an item based on category
  const getItemDetails = (item) => {
    if (!item) return "";
    const category = item.category?.toLowerCase();

    if ((category === "sheet" || activeTab === "sunmica") && item.sheet) {
      return [
        item.sheet.brand,
        item.sheet.color,
        item.sheet.finish,
        item.sheet.type,
        item.sheet.material,
      ]
        .filter(Boolean)
        .join(", ");
    } else if (category === "handle" && item.handle) {
      return [
        item.handle.brand,
        item.handle.color,
        item.handle.finish,
        item.handle.type,
        item.handle.material,
      ]
        .filter(Boolean)
        .join(", ");
    } else if (category === "hardware" && item.hardware) {
      return [
        item.hardware.brand,
        item.hardware.name,
        item.hardware.type,
        item.hardware.material,
      ]
        .filter(Boolean)
        .join(", ");
    } else if (category === "accessory" && item.accessory) {
      return [item.accessory.name, item.accessory.type, item.accessory.material]
        .filter(Boolean)
        .join(", ");
    } else if (category === "edging_tape" && item.edging_tape) {
      return [
        item.edging_tape.brand,
        item.edging_tape.color,
        item.edging_tape.finish,
        item.edging_tape.type,
        item.edging_tape.material,
      ]
        .filter(Boolean)
        .join(", ");
    }
    return "";
  };

  // Get dimensions for an item based on category
  const getItemDimensions = (item) => {
    if (!item) return "";
    const category = item.category?.toLowerCase();

    if ((category === "sheet" || activeTab === "sunmica") && item.sheet) {
      return item.sheet.dimensions || "";
    } else if (category === "handle" && item.handle) {
      return item.handle.dimensions || "";
    } else if (category === "hardware" && item.hardware) {
      return item.hardware.dimensions || "";
    } else if (category === "edging_tape" && item.edging_tape) {
      return item.edging_tape.dimensions || "";
    }
    return "";
  };

  const handleDownloadStockTallyTemplate = async () => {
    if (filteredAndSortedData.length === 0) {
      toast.warning("No items in the current category to create template.", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    try {
      setIsProcessingStockTally(true);
      const XLSX = await import("xlsx");

      // Prepare data for stock tally template
      const templateData = filteredAndSortedData.map((item) => {
        const supplierRefs =
          item.itemSuppliers?.length > 0
            ? item.itemSuppliers
                .map(
                  (is) =>
                    `${is.supplier?.name || "Unknown"}: ${
                      is.supplier_reference || "N/A"
                    }`,
                )
                .join(", ")
            : item.supplier_reference || "";

        return {
          "Item ID": item.item_id,
          "Supplier Reference": supplierRefs,
          Details: getItemDetails(item),
          Dimensions: getItemDimensions(item),
          "Current Stock Quantity": item.quantity || 0,
          "New Stock Quantity": "", // Empty for user to fill
        };
      });

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(templateData);

      // Set column widths
      ws["!cols"] = [
        { wch: 40 }, // Item ID
        { wch: 25 }, // Supplier Reference
        { wch: 50 }, // Details
        { wch: 20 }, // Dimensions
        { wch: 22 }, // Current Stock Quantity
        { wch: 22 }, // New Stock Quantity
      ];

      XLSX.utils.book_append_sheet(wb, ws, "Stock Tally");

      // Generate filename
      const currentDate = new Date().toISOString().split("T")[0];
      const filename = `stock_tally_${activeTab}_${currentDate}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      toast.success(`Stock tally template downloaded: ${filename}`, {
        position: "top-right",
        autoClose: 3000,
      });

      // Move to upload step
      setStockTallyStep("upload");
    } catch (error) {
      console.error("Error downloading stock tally template:", error);
      toast.error("Failed to download template. Please try again.", {
        position: "top-right",
        autoClose: 3000,
      });
    } finally {
      setIsProcessingStockTally(false);
    }
  };

  const handleStockTallyFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setStockTallyFile(file);
      setStockTallyError(null);
    }
  };

  const handleProcessStockTallyFile = async () => {
    if (!stockTallyFile) {
      toast.error("Please select a file to upload.", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    try {
      setIsProcessingStockTally(true);
      setStockTallyError(null);

      const XLSX = await import("xlsx");
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          // Filter and validate items that have new stock quantity filled
          const itemsToUpdate = [];
          const errors = [];

          jsonData.forEach((row, index) => {
            const itemId = row["Item ID"];
            const newStockQty = row["New Stock Quantity"];
            const currentStockQty = row["Current Stock Quantity"];

            // Skip if no item_id
            if (!itemId) {
              return;
            }

            // Skip if new stock quantity is empty, null, or undefined
            if (
              newStockQty === undefined ||
              newStockQty === null ||
              newStockQty === ""
            ) {
              return;
            }

            // Validate new stock quantity is a valid number
            const parsedNewQty = parseFloat(newStockQty);
            if (isNaN(parsedNewQty)) {
              errors.push(
                `Row ${index + 2}: Invalid new stock quantity "${newStockQty}"`,
              );
              return;
            }

            if (parsedNewQty < 0) {
              errors.push(
                `Row ${index + 2}: New stock quantity cannot be negative`,
              );
              return;
            }

            // Find the original item from our data to get all details
            const originalItem = filteredAndSortedData.find(
              (item) => item.item_id === itemId,
            );

            if (!originalItem) {
              errors.push(`Row ${index + 2}: Item not found with ID ${itemId}`);
              return;
            }

            const currentQty =
              parseInt(currentStockQty) || originalItem.quantity || 0;
            const newQty = Math.floor(parsedNewQty);

            // Skip if no change
            if (currentQty === newQty) {
              return;
            }

            itemsToUpdate.push({
              item_id: itemId,
              supplier_reference:
                row["Supplier Reference"] ||
                (originalItem.itemSuppliers?.length > 0
                  ? originalItem.itemSuppliers
                      .map(
                        (is) =>
                          `${is.supplier?.name || "Unknown"}: ${
                            is.supplier_reference || "N/A"
                          }`,
                      )
                      .join(", ")
                  : originalItem.supplier_reference) ||
                "",
              details: row["Details"] || getItemDetails(originalItem),
              dimensions: row["Dimensions"] || getItemDimensions(originalItem),
              current_quantity: currentQty,
              new_quantity: newQty,
              difference: newQty - currentQty,
              type: newQty > currentQty ? "ADDED" : "WASTED",
            });
          });

          if (errors.length > 0) {
            setStockTallyError(errors.join("\n"));
          }

          if (itemsToUpdate.length === 0) {
            setStockTallyError(
              "No items found with new stock quantities to update. Please fill in the 'New Stock Quantity' column for items you want to update.",
            );
            setIsProcessingStockTally(false);
            return;
          }

          setStockTallyPreviewData(itemsToUpdate);
          setStockTallyStep("preview");
          setIsProcessingStockTally(false);
        } catch (parseError) {
          console.error("Error parsing Excel file:", parseError);
          setStockTallyError(
            "Failed to parse the Excel file. Please make sure it's a valid Excel file.",
          );
          setIsProcessingStockTally(false);
        }
      };

      reader.onerror = () => {
        setStockTallyError("Failed to read the file. Please try again.");
        setIsProcessingStockTally(false);
      };

      reader.readAsArrayBuffer(stockTallyFile);
    } catch (error) {
      console.error("Error processing stock tally file:", error);
      setStockTallyError("An error occurred while processing the file.");
      setIsProcessingStockTally(false);
    }
  };

  const handleSaveStockTally = async () => {
    if (stockTallyPreviewData.length === 0) {
      toast.error("No items to update.", {
        position: "top-right",
        autoClose: 3000,
      });
      return;
    }

    try {
      setIsProcessingStockTally(true);

      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        setIsProcessingStockTally(false);
        return;
      }

      // Prepare items for API
      const itemsToSend = stockTallyPreviewData.map((item) => ({
        item_id: item.item_id,
        new_quantity: item.new_quantity,
        current_quantity: item.current_quantity,
      }));

      const response = await axios.post(
        "/api/stock_tally",
        { items: itemsToSend },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );

      if (response.data.status) {
        toast.success(
          `Stock tally completed! ${response.data.data.summary.updated_count} items updated.`,
          {
            position: "top-right",
            autoClose: 3000,
          },
        );
        handleCloseStockTally();
      } else {
        toast.error(response.data.message || "Failed to update stock.", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (error) {
      console.error("Error saving stock tally:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to save stock tally. Please try again.",
        {
          position: "top-right",
          autoClose: 3000,
        },
      );
    } finally {
      setIsProcessingStockTally(false);
    }
  };

  return (
    <div>
      {/* Stock Tally Modal */}
      <div className="fixed inset-0 backdrop-blur-xs bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] m-4 flex flex-col">
          {/* Modal Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center rounded-t-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <ClipboardList className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Stock Tally -{" "}
                  {activeTab.charAt(0).toUpperCase() +
                    activeTab.slice(1).replace("_", " ")}
                </h2>
                <p className="text-sm text-slate-500">
                  {stockTallyStep === "download" &&
                    "Download template to update stock quantities"}
                  {stockTallyStep === "upload" && "Upload the filled template"}
                  {stockTallyStep === "preview" &&
                    "Review changes before saving"}
                </p>
              </div>
            </div>
            <button
              onClick={handleCloseStockTally}
              className="cursor-pointer text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-100 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Step Indicator */}
            <div className="flex items-center justify-center mb-6">
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    stockTallyStep === "download"
                      ? "bg-secondary text-white"
                      : "bg-green-500 text-white"
                  }`}
                >
                  {stockTallyStep === "download" ? (
                    "1"
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    stockTallyStep === "download"
                      ? "text-secondary"
                      : "text-green-600"
                  }`}
                >
                  Download
                </span>
                <div className="w-12 h-0.5 bg-slate-200 mx-2" />
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    stockTallyStep === "upload"
                      ? "bg-secondary text-white"
                      : stockTallyStep === "preview"
                        ? "bg-green-500 text-white"
                        : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {stockTallyStep === "preview" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    "2"
                  )}
                </div>
                <span
                  className={`text-sm font-medium ${
                    stockTallyStep === "upload"
                      ? "text-secondary"
                      : stockTallyStep === "preview"
                        ? "text-green-600"
                        : "text-slate-400"
                  }`}
                >
                  Upload
                </span>
                <div className="w-12 h-0.5 bg-slate-200 mx-2" />
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                    stockTallyStep === "preview"
                      ? "bg-secondary text-white"
                      : "bg-slate-200 text-slate-500"
                  }`}
                >
                  3
                </div>
                <span
                  className={`text-sm font-medium ${
                    stockTallyStep === "preview"
                      ? "text-secondary"
                      : "text-slate-400"
                  }`}
                >
                  Preview & Save
                </span>
              </div>
            </div>

            {/* Download Step */}
            {stockTallyStep === "download" && (
              <div className="text-center py-8">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Download className="h-8 w-8 text-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">
                    Download Stock Tally Template
                  </h3>
                  <p className="text-slate-600 mb-6">
                    Download the Excel template containing all{" "}
                    <span className="font-medium text-secondary">
                      {filteredAndSortedData.length}
                    </span>{" "}
                    items in the current view. Fill in the "New Stock Quantity"
                    column for items you want to update.
                  </p>
                  <div className="bg-slate-50 rounded-lg p-4 mb-6 text-left">
                    <h4 className="font-medium text-slate-700 mb-2">
                      Template Columns:
                    </h4>
                    <ul className="text-sm text-slate-600 space-y-1">
                      <li>
                        • <strong>Item ID</strong> - Unique identifier (do not
                        modify)
                      </li>
                      <li>
                        • <strong>Supplier Reference</strong> - Reference code
                      </li>
                      <li>
                        • <strong>Details</strong> - Brand, color, finish, type,
                        material
                      </li>
                      <li>
                        • <strong>Dimensions</strong> - Item dimensions
                      </li>
                      <li>
                        • <strong>Current Stock Quantity</strong> - Current
                        stock level
                      </li>
                      <li>
                        • <strong>New Stock Quantity</strong> - Enter new
                        quantity here
                      </li>
                    </ul>
                  </div>
                  <button
                    onClick={handleDownloadStockTallyTemplate}
                    disabled={isProcessingStockTally}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                      isProcessingStockTally
                        ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                        : "bg-secondary text-white hover:bg-secondary/90 cursor-pointer"
                    }`}
                  >
                    {isProcessingStockTally ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="h-5 w-5" />
                        Download Template
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Upload Step */}
            {stockTallyStep === "upload" && (
              <div className="text-center py-8">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Upload className="h-8 w-8 text-secondary" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">
                    Upload Completed Template
                  </h3>
                  <p className="text-slate-600 mb-6">
                    Upload the Excel file with your updated stock quantities.
                    Only items with "New Stock Quantity" filled will be updated.
                  </p>

                  {/* File Upload Area */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 mb-4 transition-colors ${
                      stockTallyFile
                        ? "border-green-400 bg-green-50"
                        : "border-slate-300 hover:border-secondary"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleStockTallyFileChange}
                      className="hidden"
                      id="stock-tally-file-input"
                    />
                    <label
                      htmlFor="stock-tally-file-input"
                      className="cursor-pointer"
                    >
                      {stockTallyFile ? (
                        <div className="flex flex-col items-center">
                          <Check className="h-10 w-10 text-green-500 mb-2" />
                          <p className="font-medium text-green-700">
                            {stockTallyFile.name}
                          </p>
                          <p className="text-sm text-green-600 mt-1">
                            Click to change file
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center">
                          <Upload className="h-10 w-10 text-slate-400 mb-2" />
                          <p className="font-medium text-slate-700">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-sm text-slate-500 mt-1">
                            Excel files only (.xlsx, .xls)
                          </p>
                        </div>
                      )}
                    </label>
                  </div>

                  {/* Error Display */}
                  {stockTallyError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-left">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-red-700">Error</p>
                          <p className="text-sm text-red-600 whitespace-pre-wrap">
                            {stockTallyError}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => setStockTallyStep("download")}
                      className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleProcessStockTallyFile}
                      disabled={!stockTallyFile || isProcessingStockTally}
                      className={`inline-flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
                        !stockTallyFile || isProcessingStockTally
                          ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                          : "bg-secondary text-white hover:bg-secondary/90 cursor-pointer"
                      }`}
                    >
                      {isProcessingStockTally ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Process File
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Preview Step */}
            {stockTallyStep === "preview" && (
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">
                    Review Stock Updates
                  </h3>
                  <p className="text-slate-600">
                    The following{" "}
                    <span className="font-medium text-secondary">
                      {stockTallyPreviewData.length}
                    </span>{" "}
                    items will be updated. Review the changes before saving.
                  </p>
                </div>

                {/* Error Display */}
                {stockTallyError && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-700">
                          Some rows had issues
                        </p>
                        <p className="text-sm text-amber-600 whitespace-pre-wrap">
                          {stockTallyError}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">
                            Supplier Ref
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-600">
                            Details
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-600">
                            Current
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-600">
                            New
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-600">
                            Change
                          </th>
                          <th className="px-4 py-3 text-center font-semibold text-slate-600">
                            Type
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {stockTallyPreviewData.map((item, index) => (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-700 font-medium">
                              {item.supplier_reference || "-"}
                            </td>
                            <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                              {item.details || "-"}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-600">
                              {item.current_quantity}
                            </td>
                            <td className="px-4 py-3 text-center font-medium text-slate-800">
                              {item.new_quantity}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex items-center gap-1 font-medium ${
                                  item.difference > 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {item.difference > 0 ? (
                                  <ArrowUp className="h-3 w-3" />
                                ) : (
                                  <ArrowDown className="h-3 w-3" />
                                )}
                                {item.difference > 0 ? "+" : ""}
                                {item.difference}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                  item.type === "ADDED"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {item.type}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary */}
                <div className="mt-4 flex gap-4 text-sm">
                  <div className="flex items-center gap-2 text-green-600">
                    <ArrowUp className="h-4 w-4" />
                    <span>
                      {
                        stockTallyPreviewData.filter((i) => i.type === "ADDED")
                          .length
                      }{" "}
                      items to be added
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-red-600">
                    <ArrowDown className="h-4 w-4" />
                    <span>
                      {
                        stockTallyPreviewData.filter((i) => i.type === "WASTED")
                          .length
                      }{" "}
                      items to be reduced
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          {stockTallyStep === "preview" && (
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end items-center gap-3 rounded-b-lg">
              <button
                onClick={() => {
                  setStockTallyStep("upload");
                  setStockTallyPreviewData([]);
                }}
                disabled={isProcessingStockTally}
                className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-white transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCloseStockTally}
                disabled={isProcessingStockTally}
                className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-600 border border-slate-300 rounded-lg hover:bg-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStockTally}
                disabled={isProcessingStockTally}
                className={`inline-flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
                  isProcessingStockTally
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                    : "bg-primary text-white hover:bg-primary/90 cursor-pointer"
                }`}
              >
                {isProcessingStockTally ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
