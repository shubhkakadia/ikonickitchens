import { useState, useEffect, useRef } from "react";
import {
  Download,
  Upload,
  Check,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  ClipboardList,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import useModalFocus from "@/hooks/useModalFocus";
import {
  BADGE,
  BADGE_TONES,
  formatQty,
} from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";

// DESIGN.md 9.1 button recipes. Only one primary button is visible per step.
const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const SPINNER =
  "w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin";

// DESIGN.md 9.5 table header.
const TH =
  "px-4 py-2 text-xs font-medium text-slate-500 uppercase tracking-wider";

const dash = (value) =>
  value === null || value === undefined || value === "" ? "—" : value;

const pluralItems = (count) => (count === 1 ? "item" : "items");

// Every supplier's reference, or the item's own reference when it has none.
// `empty` is what shows for a missing reference: "—" on screen, and "N/A" in
// the exported template (the file's contents are unchanged from before).
const getSupplierRefs = (item, empty = "—") =>
  item.itemSuppliers?.length > 0
    ? item.itemSuppliers
        .map(
          (is) =>
            `${is.supplier?.name || "Unknown"}: ${is.supplier_reference || empty}`,
        )
        .join(", ")
    : item.supplier_reference;

// Wizard steps, in order.
const STEPS = [
  { key: "download", label: "Download" },
  { key: "upload", label: "Upload" },
  { key: "preview", label: "Preview and save" },
];

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
  // Inline error for the file field (shown once Process file is attempted).
  const [fileError, setFileError] = useState("");

  const panelRef = useRef(null);
  const fileInputRef = useRef(null);
  useModalFocus(panelRef, true);

  const handleCloseStockTally = () => {
    setShowStockTallyModal(false);
    setStockTallyStep("download");
    setStockTallyFile(null);
    setStockTallyPreviewData([]);
    setStockTallyError(null);
    setFileError("");
  };

  // A wizard with a chosen file or parsed rows must not close on a stray backdrop click.
  const isDirty =
    !!stockTallyFile ||
    stockTallyPreviewData.length > 0 ||
    stockTallyStep !== "download";

  // Modals close on Escape (DESIGN.md 9.4), except while a request is running.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape" || isProcessingStockTally) return;
      handleCloseStockTally();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [isProcessingStockTally]);

  // Each step swaps the footer actions, so hand focus to the new primary action.
  useEffect(() => {
    panelRef.current?.querySelector("[data-autofocus]")?.focus();
  }, [stockTallyStep]);

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
      setStockTallyError(
        "There are no items in the current view to build a template from.",
      );
      return;
    }

    try {
      setIsProcessingStockTally(true);
      setStockTallyError(null);
      const XLSX = await import("xlsx");

      // Prepare data for stock tally template
      const templateData = filteredAndSortedData.map((item) => {
        return {
          "Item ID": item.item_id,
          "Supplier Reference": getSupplierRefs(item, "N/A") || "",
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

      toast.success(`Template downloaded: ${filename}`);

      // Move to upload step
      setStockTallyStep("upload");
    } catch (error) {
      console.error("Error downloading stock tally template:", error);
      toast.error("Couldn't download the template. Try again.");
    } finally {
      setIsProcessingStockTally(false);
    }
  };

  const handleStockTallyFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setStockTallyFile(file);
      setStockTallyError(null);
      setFileError("");
    }
  };

  const handleProcessStockTallyFile = async () => {
    if (!stockTallyFile) {
      setFileError("Select a file to upload.");
      fileInputRef.current?.focus();
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
                getSupplierRefs(originalItem) ||
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
              "No items have a new stock quantity to update. Fill in the 'New Stock Quantity' column for the items you want to update.",
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
            "Couldn't read the Excel file. Check that it's a valid .xlsx or .xls file and try again.",
          );
          setIsProcessingStockTally(false);
        }
      };

      reader.onerror = () => {
        setStockTallyError("Couldn't read the file. Try again.");
        setIsProcessingStockTally(false);
      };

      reader.readAsArrayBuffer(stockTallyFile);
    } catch (error) {
      console.error("Error processing stock tally file:", error);
      setStockTallyError("Couldn't process the file. Try again.");
      setIsProcessingStockTally(false);
    }
  };

  const handleSaveStockTally = async () => {
    // The Save button is disabled without rows, so this only guards the handler.
    if (stockTallyPreviewData.length === 0) return;

    try {
      setIsProcessingStockTally(true);

      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
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
        "/api/v1/stock_tally",
        { items: itemsToSend },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );

      if (response.data.status) {
        const updated = response.data.data.summary.updated_count;
        toast.success(
          `Stock tally saved. ${updated} ${pluralItems(updated)} updated.`,
        );
        const skipped = response.data.data.summary.error_count;
        if (skipped > 0) {
          toast.warning(
            `${skipped} item(s) were not updated because stock changed or the item was not found. Export a fresh sheet and count them again.`,
            { autoClose: 8000 },
          );
        }
        handleCloseStockTally();
      } else {
        toast.error(
          response.data.message ||
            "Couldn't update stock. Check the details and try again.",
        );
      }
    } catch (error) {
      console.error("Error saving stock tally:", error);
      toast.error(
        error.response?.data?.message ||
          "Couldn't save the stock tally. Check your connection and try again.",
      );
    } finally {
      setIsProcessingStockTally(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isProcessingStockTally) return;
    if (stockTallyStep === "download") handleDownloadStockTallyTemplate();
    else if (stockTallyStep === "upload") handleProcessStockTallyFile();
    else handleSaveStockTally();
  };

  const tabLabel =
    activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace("_", " ");

  const stepIndex = STEPS.findIndex((step) => step.key === stockTallyStep);

  const addedCount = stockTallyPreviewData.filter(
    (i) => i.type === "ADDED",
  ).length;
  const reducedCount = stockTallyPreviewData.filter(
    (i) => i.type === "WASTED",
  ).length;

  // Primary action for the current step (spinner replaces the icon, label stays).
  const primary = {
    download: { label: "Download template", Icon: Download },
    upload: { label: "Process file", Icon: Upload },
    preview: { label: "Save changes", Icon: Check },
  }[stockTallyStep];
  const PrimaryIcon = primary.Icon;
  const primaryDisabled =
    isProcessingStockTally ||
    (stockTallyStep === "preview" && stockTallyPreviewData.length === 0);

  const errorBlock = stockTallyError && stockTallyStep !== "preview" && (
    <div
      role="alert"
      className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-left"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className="w-5 h-5 text-red-600 shrink-0"
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-medium text-red-800">
            {stockTallyStep === "download"
              ? "Couldn't create the template"
              : "Couldn't process the file"}
          </p>
          <p className="text-sm text-red-800 whitespace-pre-wrap">
            {stockTallyError}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
      onClick={() => {
        if (!isDirty && !isProcessingStockTally) handleCloseStockTally();
      }}
    >
      <div
        ref={panelRef}
        className="bg-white rounded-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-tally-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <ClipboardList
                className="w-5 h-5 text-primary"
                aria-hidden="true"
              />
            </div>
            <div>
              <h2
                id="stock-tally-title"
                className="text-lg font-semibold text-slate-800"
              >
                Stock tally — {tabLabel}
              </h2>
              <p className="text-sm text-slate-500">
                {stockTallyStep === "download" &&
                  "Download a template to update stock quantities"}
                {stockTallyStep === "upload" && "Upload the filled template"}
                {stockTallyStep === "preview" && "Review changes before saving"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseStockTally}
            className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200"
            aria-label="Close"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form
          noValidate
          onSubmit={handleSubmit}
          className="flex flex-col min-h-0 flex-1"
        >
          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Step Indicator */}
            <ol
              aria-label="Progress"
              className="flex flex-wrap items-center justify-center gap-2 mb-6"
            >
              {STEPS.map((step, index) => {
                const isCurrent = index === stepIndex;
                const isDone = index < stepIndex;
                return (
                  <li
                    key={step.key}
                    aria-current={isCurrent ? "step" : undefined}
                    className="flex items-center gap-2"
                  >
                    {index > 0 && (
                      <span
                        className="w-12 h-0.5 bg-slate-200 mx-2"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium border ${
                        isCurrent
                          ? "bg-primary text-white border-primary"
                          : isDone
                            ? "bg-green-100 text-green-800 border-green-200"
                            : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {isDone ? (
                        <Check className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        isCurrent
                          ? "text-primary"
                          : isDone
                            ? "text-green-800"
                            : "text-slate-500"
                      }`}
                    >
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>

            {/* Download Step */}
            {stockTallyStep === "download" && (
              <div className="text-center py-8">
                <div className="max-w-md mx-auto">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Download
                      className="w-5 h-5 text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">
                    Download the stock tally template
                  </h3>
                  <p className="text-sm text-slate-600 mb-6">
                    Download the Excel template containing all{" "}
                    <span className="font-semibold text-slate-800">
                      {formatQty(filteredAndSortedData.length)}
                    </span>{" "}
                    {pluralItems(filteredAndSortedData.length)} in the current
                    view. Fill in the &quot;New Stock Quantity&quot; column for
                    items you want to update.
                  </p>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4 text-left">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">
                      Template columns
                    </h4>
                    <ul className="text-sm text-slate-600 space-y-1 list-disc pl-5">
                      <li>
                        <span className="font-medium text-slate-700">
                          Item ID
                        </span>{" "}
                        — unique identifier (do not modify)
                      </li>
                      <li>
                        <span className="font-medium text-slate-700">
                          Supplier Reference
                        </span>{" "}
                        — reference code
                      </li>
                      <li>
                        <span className="font-medium text-slate-700">
                          Details
                        </span>{" "}
                        — brand, colour, finish, type, material
                      </li>
                      <li>
                        <span className="font-medium text-slate-700">
                          Dimensions
                        </span>{" "}
                        — item dimensions
                      </li>
                      <li>
                        <span className="font-medium text-slate-700">
                          Current Stock Quantity
                        </span>{" "}
                        — current stock level
                      </li>
                      <li>
                        <span className="font-medium text-slate-700">
                          New Stock Quantity
                        </span>{" "}
                        — enter the new quantity here
                      </li>
                    </ul>
                  </div>
                  {errorBlock}
                </div>
              </div>
            )}

            {/* Upload Step */}
            {stockTallyStep === "upload" && (
              <div className="text-center py-8">
                <div className="max-w-md mx-auto">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Upload
                      className="w-5 h-5 text-primary"
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">
                    Upload the completed template
                  </h3>
                  <p className="text-sm text-slate-600 mb-6">
                    Upload the Excel file with your updated stock quantities.
                    Only items with &quot;New Stock Quantity&quot; filled will
                    be updated.
                  </p>

                  {/* File Upload Area (input is visually hidden but keyboard-reachable) */}
                  <div className="mb-4">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleStockTallyFileChange}
                      className="peer sr-only"
                      id="stock-tally-file-input"
                      aria-invalid={!!fileError}
                      aria-describedby={
                        fileError ? "stock-tally-file-error" : undefined
                      }
                    />
                    <label
                      htmlFor="stock-tally-file-input"
                      className={`cursor-pointer flex flex-col items-center text-center w-full border-2 border-dashed rounded-lg p-8 transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-primary ${
                        fileError
                          ? "border-red-500"
                          : stockTallyFile
                            ? "border-green-200 bg-green-50"
                            : "border-slate-300 hover:border-primary hover:bg-slate-50"
                      }`}
                    >
                      {stockTallyFile ? (
                        <>
                          <Check
                            className="w-8 h-8 text-green-600 mb-2"
                            aria-hidden="true"
                          />
                          <span className="text-sm font-medium text-green-800 max-w-full truncate">
                            {stockTallyFile.name}
                          </span>
                          <span className="text-xs text-green-800 mt-1">
                            Click to change file
                          </span>
                        </>
                      ) : (
                        <>
                          <Upload
                            className="w-8 h-8 text-slate-400 mb-2"
                            aria-hidden="true"
                          />
                          <span className="text-sm font-medium text-slate-700">
                            Click to choose a file
                          </span>
                          <span className="text-xs text-slate-500 mt-1">
                            Excel files only (.xlsx or .xls)
                          </span>
                        </>
                      )}
                    </label>
                    {fileError && (
                      <p
                        id="stock-tally-file-error"
                        className="text-xs text-red-600 mt-1 text-left"
                      >
                        {fileError}
                      </p>
                    )}
                  </div>

                  {errorBlock}
                </div>
              </div>
            )}

            {/* Preview Step */}
            {stockTallyStep === "preview" && (
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">
                    Review stock updates
                  </h3>
                  <p className="text-sm text-slate-600">
                    The following{" "}
                    <span className="font-semibold text-slate-800">
                      {formatQty(stockTallyPreviewData.length)}
                    </span>{" "}
                    {pluralItems(stockTallyPreviewData.length)} will be updated.
                    Review the changes before saving.
                  </p>
                </div>

                {/* Row issues from the uploaded file */}
                {stockTallyError && (
                  <div
                    role="status"
                    className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4"
                  >
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        className="w-5 h-5 text-amber-600 shrink-0"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-sm font-medium text-amber-800">
                          Some rows had issues
                        </p>
                        <p className="text-sm text-amber-800 whitespace-pre-wrap">
                          {stockTallyError}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview Table */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="max-h-80 overflow-auto">
                    <table className="w-full text-sm">
                      <caption className="sr-only">
                        Stock changes to be saved
                      </caption>
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          <th scope="col" className={`${TH} text-left`}>
                            Supplier ref
                          </th>
                          <th scope="col" className={`${TH} text-left`}>
                            Details
                          </th>
                          <th scope="col" className={`${TH} text-right`}>
                            Current
                          </th>
                          <th scope="col" className={`${TH} text-right`}>
                            New
                          </th>
                          <th scope="col" className={`${TH} text-right`}>
                            Change
                          </th>
                          <th scope="col" className={`${TH} text-left`}>
                            Type
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {stockTallyPreviewData.map((item, index) => (
                          <tr
                            key={`${item.item_id}-${index}`}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <td
                              className="px-4 py-3 text-sm font-mono text-slate-700 max-w-xs truncate"
                              title={item.supplier_reference || undefined}
                            >
                              {dash(item.supplier_reference)}
                            </td>
                            <td
                              className="px-4 py-3 text-sm text-slate-700 max-w-xs truncate"
                              title={item.details || undefined}
                            >
                              {dash(item.details)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-mono text-slate-700">
                              {formatQty(item.current_quantity)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-mono font-medium text-slate-800">
                              {formatQty(item.new_quantity)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right">
                              <span
                                className={`inline-flex items-center justify-end gap-1 text-sm font-mono font-medium ${
                                  item.difference > 0
                                    ? "text-green-800"
                                    : "text-red-800"
                                }`}
                              >
                                {item.difference > 0 ? (
                                  <ArrowUp
                                    className="w-3 h-3"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <ArrowDown
                                    className="w-3 h-3"
                                    aria-hidden="true"
                                  />
                                )}
                                {item.difference > 0 ? "+" : ""}
                                {formatQty(item.difference)}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span
                                className={`${BADGE} ${
                                  item.type === "ADDED"
                                    ? BADGE_TONES.success
                                    : BADGE_TONES.danger
                                }`}
                              >
                                {formatLabel(item.type)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary */}
                <div className="mt-4 flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2 text-green-800">
                    <ArrowUp className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {formatQty(addedCount)} {pluralItems(addedCount)} to be
                      added
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-red-800">
                    <ArrowDown className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {formatQty(reducedCount)} {pluralItems(reducedCount)} to
                      be reduced
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer: Cancel (secondary), then the one primary action */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
            {stockTallyStep !== "download" && (
              <button
                type="button"
                onClick={() => {
                  if (stockTallyStep === "upload") {
                    setStockTallyStep("download");
                  } else {
                    setStockTallyStep("upload");
                    setStockTallyPreviewData([]);
                  }
                  setStockTallyError(null);
                  setFileError("");
                }}
                disabled={isProcessingStockTally}
                className={`${BTN_SECONDARY} mr-auto`}
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={handleCloseStockTally}
              disabled={isProcessingStockTally}
              className={BTN_SECONDARY}
            >
              Cancel
            </button>
            <button
              key={stockTallyStep}
              type="submit"
              data-autofocus
              disabled={primaryDisabled}
              className={BTN_PRIMARY}
            >
              {isProcessingStockTally ? (
                <span className={SPINNER} aria-hidden="true" />
              ) : (
                <PrimaryIcon className="w-4 h-4" aria-hidden="true" />
              )}
              {primary.label}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
