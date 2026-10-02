import React, { useRef, useState } from "react";
import { Trash2, X, AlertTriangle } from "lucide-react";
import { deletionWarning } from "./constants";
import useModalFocus from "@/hooks/useModalFocus";

export default function DeleteConfirmation({
  isOpen,
  onClose,
  onConfirm,
  deleteWithInput = false,
  heading = "Item",
  message = "This action cannot be undone.",
  comparingName = "",
  isDeleting = false,
  cancelButtonText = "Cancel",
  entityType = null, // e.g., "employees", "client", "project", etc.
  title = null, // defaults to "Delete {heading}"
  confirmButtonText = null, // defaults to "Delete {heading}"
  confirmingText = "Deleting...",
  warningHeading = null, // overrides the bold line in the warning box
}) {
  const [confirmationInput, setConfirmationInput] = useState("");
  const panelRef = useRef(null);

  // Focus lands on Cancel (or the confirm-by-typing field), never on the
  // destructive button (DESIGN.md 15.5), and returns to the trigger on close.
  useModalFocus(panelRef, isOpen);

  // Convert snake_case to readable format
  const formatEntityName = (name) => {
    return name
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Get associated data that will be deleted
  const getAssociatedData = () => {
    if (!entityType || !deletionWarning[entityType]) {
      return [];
    }
    return deletionWarning[entityType];
  };

  const associatedData = getAssociatedData();

  // Normalize string for comparison - handles whitespace, null/undefined, and edge cases
  const normalizeString = (str) => {
    if (!str) return "";
    return String(str).trim().replace(/\s+/g, " "); // Replace all whitespace sequences with single space
  };

  // Check if input matches comparing name
  const isInputMatch = () => {
    if (!deleteWithInput) return true;
    const normalizedInput = normalizeString(confirmationInput);
    const normalizedCompare = normalizeString(comparingName);
    return normalizedInput === normalizedCompare;
  };

  const handleConfirm = () => {
    if (deleteWithInput && !isInputMatch()) {
      return; // Don't proceed if input doesn't match
    }
    onConfirm();
    setConfirmationInput(""); // Reset input after confirmation
  };

  const handleClose = () => {
    onClose();
    setConfirmationInput(""); // Reset input when closing
  };

  if (!isOpen) return null;

  // Destructive confirmations close only via an explicit button: no backdrop
  // click and no Escape (DESIGN.md 9.4).
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4">
      <div
        ref={panelRef}
        className="bg-white rounded-xl border border-slate-200 w-full max-w-md max-h-[90vh] flex flex-col"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirmation-title"
        aria-describedby="delete-confirmation-message"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2
            id="delete-confirmation-title"
            className="text-lg font-semibold text-slate-800 flex items-center gap-2"
          >
            <Trash2 className="w-5 h-5 text-red-600" aria-hidden="true" />
            {title || `Delete ${heading}`}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Close"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="w-5 h-5 text-red-600 mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">
                  {warningHeading ||
                    (deleteWithInput
                      ? "This action will permanently delete the item"
                      : "This action will delete the item")}
                </h3>
                <div
                  id="delete-confirmation-message"
                  className="text-sm text-red-700 mt-1"
                >
                  {message}
                </div>
                {associatedData.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-red-200">
                    <p className="text-sm font-medium text-red-800 mb-2">
                      The following data associated with this{" "}
                      {heading.toLowerCase()} will also be deleted:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-red-700">
                      {associatedData.map((item, index) => (
                        <li key={index}>{formatEntityName(item)}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {deleteWithInput && (
            <div>
              <label
                htmlFor="delete-confirmation-input"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Type the {heading.toLowerCase()} name to confirm
              </label>
              <p className="text-sm font-medium text-slate-900 mb-2">
                <span className="bg-slate-100 px-2 py-1 rounded-sm">
                  {comparingName}
                </span>
              </p>
              <input
                id="delete-confirmation-input"
                type="text"
                data-autofocus
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder={comparingName}
                autoComplete="off"
                className="w-full text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={handleClose}
            data-autofocus={deleteWithInput ? undefined : true}
            className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {cancelButtonText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting || (deleteWithInput && !isInputMatch())}
            className="cursor-pointer px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2"
          >
            {isDeleting ? (
              <span
                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            )}
            {confirmButtonText || `Delete ${heading}`}
          </button>
          {isDeleting && (
            <span className="sr-only" role="status">
              {confirmingText}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
