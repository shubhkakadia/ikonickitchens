"use client";
import React from "react";
import { Check } from "lucide-react";

/**
 * Custom Progress Bar Component for Toast Notifications
 * Used to display file upload progress in react-toastify v11
 *
 * @param {number} progress - Upload progress percentage (0-100)
 * @param {boolean} isPaused - Whether the upload is paused (from toast's pauseOnHover/pauseOnFocusLoss)
 * @param {number} fileCount - Number of files being uploaded
 * @param {function} closeToast - Function to close the toast (provided by react-toastify)
 */
const UploadProgressBar = ({ progress, isPaused, fileCount, closeToast }) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-700">
          Uploading {fileCount} file{fileCount > 1 ? "s" : ""}...{" "}
          {Math.round(progress)}%
        </span>
        {isPaused && <span className="text-xs text-slate-500">Paused</span>}
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{
            width: `${progress}%`,
            transition: isPaused ? "none" : "width 0.3s ease-out",
          }}
        />
      </div>
      {progress >= 100 && (
        <div className="mt-2 flex items-center gap-2 text-sm text-green-600 font-medium">
          <Check className="w-4 h-4" />
          Upload complete!
        </div>
      )}
    </div>
  );
};

export default UploadProgressBar;
