import React, { useState } from "react";
import { Trash2, X, AlertTriangle } from "lucide-react";
import { deletionWarning } from "./constants";

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
}) {
  const [confirmationInput, setConfirmationInput] = useState("");

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

  return (
    <div className="fixed inset-0 backdrop-blur-xs bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-red-800 flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Delete {heading}
          </h2>
          <button
            onClick={handleClose}
            className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">
                  {deleteWithInput
                    ? "This action will permanently delete the item"
                    : "This action will delete the item"}
                </h3>
                <div className="text-sm text-red-700 mt-1">{message}</div>
                {associatedData.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-red-200">
                    <p className="text-sm font-medium text-red-800 mb-2">
                      The following data associated with this {heading.toLowerCase()} will also be deleted:
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
              <p className="text-sm text-slate-700 mb-3">
                Please type the {heading.toLowerCase()} name below to confirm
                deletion:
              </p>
              <p className="text-sm font-medium text-slate-900 mb-2">
                <span className="bg-slate-100 px-2 py-1 rounded">
                  {comparingName}
                </span>
              </p>
              <input
                type="text"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder={`Type ${heading.toLowerCase()} name here`}
                className="w-full text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-red-500 focus:border-transparent focus:outline-none"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={handleClose}
              className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isDeleting || (deleteWithInput && !isInputMatch())}
              className="cursor-pointer px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? "Deleting..." : `Delete ${heading}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
