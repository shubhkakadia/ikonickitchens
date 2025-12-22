"use client";
import { useRef } from "react";
import { toast } from "react-toastify";
import UploadProgressBar from "@/components/UploadProgressBar";

/**
 * Custom hook for handling file uploads with progress tracking
 * 
 * @returns {Object} Object containing uploadProgressRef and uploadProgressToastId
 */
export const useUploadProgress = () => {
  const uploadProgressRef = useRef(0);
  const uploadProgressToastId = useRef(null);

  /**
   * Show progress toast for file upload
   * @param {number} fileCount - Number of files being uploaded
   */
  const showProgressToast = (fileCount) => {
    uploadProgressRef.current = 0;
    
    uploadProgressToastId.current = toast(
      ({ closeToast, isPaused }) => (
        <UploadProgressBar
          progress={uploadProgressRef.current}
          isPaused={isPaused}
          fileCount={fileCount}
          closeToast={closeToast}
        />
      ),
      {
        position: "top-right",
        autoClose: 5000,
        customProgressBar: true,
      }
    );
  };

  /**
   * Update progress in the toast
   * @param {number} progress - Progress percentage (0-100)
   * @param {number} fileCount - Number of files being uploaded
   */
  const updateProgress = (progress, fileCount) => {
    uploadProgressRef.current = progress;
    if (uploadProgressToastId.current) {
      toast.update(uploadProgressToastId.current, {
        render: ({ closeToast, isPaused }) => (
          <UploadProgressBar
            progress={uploadProgressRef.current}
            isPaused={isPaused}
            fileCount={fileCount}
            closeToast={closeToast}
          />
        ),
      });
    }
  };

  /**
   * Complete the upload and auto-dismiss after 5 seconds
   * @param {number} fileCount - Number of files that were uploaded
   */
  const completeUpload = (fileCount) => {
    uploadProgressRef.current = 100;
    if (uploadProgressToastId.current) {
      const toastId = uploadProgressToastId.current;
      
      toast.update(toastId, {
        render: ({ closeToast, isPaused }) => (
          <UploadProgressBar
            progress={100}
            isPaused={isPaused}
            fileCount={fileCount}
            closeToast={closeToast}
          />
        ),
        autoClose: 5000,
        pauseOnHover: false,
        pauseOnFocusLoss: false,
      });
      
      // Backup: Also manually dismiss after 5 seconds to ensure it closes
      setTimeout(() => {
        if (uploadProgressToastId.current === toastId) {
          toast.dismiss(uploadProgressToastId.current);
          uploadProgressToastId.current = null;
        }
      }, 5000);
    }
  };

  /**
   * Dismiss the progress toast (e.g., on error)
   */
  const dismissProgressToast = () => {
    if (uploadProgressToastId.current) {
      toast.dismiss(uploadProgressToastId.current);
      uploadProgressToastId.current = null;
    }
  };

  /**
   * Get axios onUploadProgress handler
   * @param {number} fileCount - Number of files being uploaded
   * @returns {function} onUploadProgress handler for axios
   */
  const getUploadProgressHandler = (fileCount) => {
    return (progressEvent) => {
      if (progressEvent.total) {
        const progress = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        updateProgress(progress, fileCount);
      }
    };
  };

  return {
    uploadProgressRef,
    uploadProgressToastId,
    showProgressToast,
    updateProgress,
    completeUpload,
    dismissProgressToast,
    getUploadProgressHandler,
  };
};

