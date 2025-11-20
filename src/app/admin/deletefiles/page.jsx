"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import JSZip from "jszip";
import {
  Download,
  Trash2,
  FileText,
  File,
  Image as ImageIcon,
  Video,
  Loader2,
  AlertCircle,
  Search,
  Funnel,
  ChevronDown,
  RotateCcw,
  CheckSquare,
  Square,
  X,
} from "lucide-react";

// Setup PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function DeleteFilesPage() {
  const { getToken } = useAuth();
  const [deletedMedia, setDeletedMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewFileModal, setViewFileModal] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedMediaTypes, setSelectedMediaTypes] = useState([
    "Image",
    "Video",
    "PDF",
    "File",
  ]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Fetch deleted media
  useEffect(() => {
    fetchDeletedMedia();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) {
        setShowFilterDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fetchDeletedMedia = async () => {
    try {
      setLoading(true);
      setError(null);
      const sessionToken = getToken();

      if (!sessionToken) {
        setError("No valid session found. Please login again.");
        return;
      }

      const response = await axios.get("/api/deletedmedia/all", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        setDeletedMedia(response.data.data || []);
      } else {
        setError(response.data.message || "Failed to fetch deleted media");
      }
    } catch (error) {
      console.error("Error fetching deleted media:", error);
      setError(
        error.response?.data?.message ||
          "Failed to fetch deleted media. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Normalize file data for ViewMedia component
  const normalizeFileForView = (file) => {
    // Handle different file types from different tables
    const fileUrl = file.url?.startsWith("/") ? file.url : `/${file.url}`;

    return {
      name: file.filename || "Unknown",
      type: file.mime_type || file.file_type || "application/octet-stream",
      size: file.size || 0,
      url: fileUrl,
      isExisting: true,
    };
  };

  // Handle view file
  const handleViewFile = (file) => {
    const normalizedFile = normalizeFileForView(file);
    setSelectedFile(normalizedFile);
    setViewFileModal(true);
  };

  // Handle download file
  const handleDownloadFile = (file) => {
    const fileUrl = file.url?.startsWith("/") ? file.url : `/${file.url}`;
    window.open(fileUrl, "_blank");
  };

  // Handle delete confirmation
  const handleDeleteClick = (file) => {
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  // Handle permanent delete
  const handlePermanentDelete = async () => {
    if (!fileToDelete) return;

    try {
      setIsDeleting(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const filename = fileToDelete.filename;
      const response = await axios.delete(
        `/api/deletedmedia/${encodeURIComponent(filename)}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (response.data.status) {
        toast.success("Media permanently deleted successfully");
        setShowDeleteModal(false);
        setFileToDelete(null);
        // Refresh the list
        fetchDeletedMedia();
      } else {
        toast.error(response.data.message || "Failed to delete media");
      }
    } catch (error) {
      console.error("Error deleting media:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to delete media. Please try again."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle file selection toggle
  const handleFileSelect = (file) => {
    setSelectedFiles((prev) => {
      const isSelected = prev.some((f) => f.id === file.id);
      if (isSelected) {
        return prev.filter((f) => f.id !== file.id);
      } else {
        return [...prev, file];
      }
    });
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedFiles.length === filteredMedia.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles([...filteredMedia]);
    }
  };

  // Handle bulk download with JSZip
  const handleBulkDownload = async () => {
    if (selectedFiles.length === 0) return;

    try {
      toast.info(`Creating zip file with ${selectedFiles.length} file(s)...`, {
        autoClose: 2000,
      });

      const zip = new JSZip();
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      // Fetch all files and add them to the zip
      const fetchPromises = selectedFiles.map(async (file) => {
        try {
          const fileUrl = file.url?.startsWith("/") ? file.url : `/${file.url}`;

          // Fetch the file as a blob
          const response = await fetch(fileUrl, {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
            },
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch ${file.filename}`);
          }

          const blob = await response.blob();

          // Add file to zip with its original filename
          zip.file(file.filename || `file_${file.id}`, blob);

          return { success: true, filename: file.filename };
        } catch (error) {
          console.error(`Error fetching ${file.filename}:`, error);
          return {
            success: false,
            filename: file.filename,
            error: error.message,
          };
        }
      });

      const results = await Promise.allSettled(fetchPromises);
      const successful = results.filter(
        (r) => r.status === "fulfilled" && r.value.success
      ).length;
      const failed = results.length - successful;

      if (successful === 0) {
        toast.error("Failed to download files. Please try again.");
        return;
      }

      // Generate zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Create download link
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `deleted-media-${
        new Date().toISOString().split("T")[0]
      }.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      if (failed > 0) {
        toast.warning(
          `Downloaded ${successful} file(s), ${failed} file(s) failed.`
        );
      } else {
        toast.success(`Successfully downloaded ${successful} file(s) as zip.`);
      }
    } catch (error) {
      console.error("Error creating zip file:", error);
      toast.error("Failed to create zip file. Please try again.");
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedFiles.length === 0) return;

    try {
      setIsBulkDeleting(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      // Delete files one by one
      const deletePromises = selectedFiles.map((file) =>
        axios.delete(`/api/deletedmedia/${encodeURIComponent(file.filename)}`, {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        })
      );

      const results = await Promise.allSettled(deletePromises);
      const successful = results.filter(
        (r) => r.status === "fulfilled" && r.value.data.status
      ).length;
      const failed = results.length - successful;

      if (successful > 0) {
        toast.success(
          `Successfully deleted ${successful} file(s)${
            failed > 0 ? `, ${failed} failed` : ""
          }`
        );
      } else {
        toast.error("Failed to delete files. Please try again.");
      }

      // Clear selection and refresh
      setSelectedFiles([]);
      setSelectionMode(false);
      fetchDeletedMedia();
    } catch (error) {
      console.error("Error bulk deleting files:", error);
      toast.error("Failed to delete files. Please try again.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Toggle selection mode
  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedFiles([]);
    }
  };

  // Get file preview component
  const getFilePreview = (file) => {
    const mimeType = file.mime_type || file.file_type || "";
    const fileUrl = file.url?.startsWith("/") ? file.url : `/${file.url}`;

    if (mimeType.includes("image")) {
      return (
        <div className="relative w-full h-full">
          <Image
            src={fileUrl}
            alt={file.filename || "Image"}
            fill
            className="object-cover rounded-lg"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      );
    } else if (mimeType.includes("video")) {
      return (
        <div className="relative w-full h-full flex items-center justify-center bg-slate-900 rounded-lg">
          <video
            src={fileUrl}
            className="w-full h-full object-cover rounded-lg"
            muted
            playsInline
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Video className="w-8 h-8 text-white opacity-80" />
          </div>
        </div>
      );
    } else if (mimeType.includes("pdf")) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-red-50 rounded-lg">
          <FileText className="w-8 h-8 text-red-600" />
        </div>
      );
    } else {
      return (
        <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-lg">
          <File className="w-8 h-8 text-slate-600" />
        </div>
      );
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return "0 B";
    const mb = bytes / 1024 / 1024;
    if (mb >= 1) {
      return `${mb.toFixed(2)} MB`;
    }
    const kb = bytes / 1024;
    return `${kb.toFixed(2)} KB`;
  };

  // Get file type label
  const getFileTypeLabel = (file) => {
    const mimeType = file.mime_type || file.file_type || "";
    if (mimeType.includes("image")) return "Image";
    if (mimeType.includes("video")) return "Video";
    if (mimeType.includes("pdf")) return "PDF";
    return "File";
  };

  // Get source information
  const getSourceInfo = (file) => {
    if (file.tab?.lot) {
      return `Lot: ${file.tab.lot.name || file.tab.lot.lot_id}`;
    }
    if (file.supplier_id) {
      return "Supplier File";
    }
    return "Media";
  };

  // Filter and search media
  const filteredMedia = useMemo(() => {
    return deletedMedia.filter((file) => {
      // Search filter (by filename)
      if (search) {
        const searchLower = search.toLowerCase();
        const filename = (file.filename || "").toLowerCase();
        if (!filename.includes(searchLower)) {
          return false;
        }
      }

      // Media type filter
      const fileType = getFileTypeLabel(file);
      if (
        selectedMediaTypes.length > 0 &&
        !selectedMediaTypes.includes(fileType)
      ) {
        return false;
      }

      return true;
    });
  }, [deletedMedia, search, selectedMediaTypes]);

  // Media types available
  const mediaTypes = ["Image", "Video", "PDF", "File"];

  // Handle media type toggle
  const handleMediaTypeToggle = (type) => {
    if (type === "Select All") {
      if (selectedMediaTypes.length === mediaTypes.length) {
        setSelectedMediaTypes([]);
      } else {
        setSelectedMediaTypes([...mediaTypes]);
      }
    } else {
      setSelectedMediaTypes((prev) =>
        prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
      );
    }
  };

  // Handle reset filters
  const handleReset = () => {
    setSearch("");
    setSelectedMediaTypes([...mediaTypes]);
  };

  // Check if any filters are active
  const isAnyFilterActive = () => {
    return search !== "" || selectedMediaTypes.length !== mediaTypes.length;
  };

  // Calculate stats
  const stats = useMemo(() => {
    const totalFiles = filteredMedia.length;
    const totalSpace = filteredMedia.reduce(
      (sum, file) => sum + (file.size || 0),
      0
    );
    return {
      totalFiles,
      totalSpace,
    };
  }, [filteredMedia]);

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AdminRoute>
      <div className="flex h-screen bg-tertiary">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CRMLayout />
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-2 flex-shrink-0">
              <div className="flex justify-between items-center">
                <h1 className="text-xl font-bold text-slate-700">
                  Deleted Media
                </h1>
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
                {/* Fixed Header Section */}
                <div className="p-4 flex-shrink-0 border-b border-slate-200">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    {/* Search bar */}
                    <div className="flex items-center gap-2 flex-1 max-w-2xl relative">
                      <Search className="h-4 w-4 absolute left-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by filename..."
                        className="w-full text-slate-800 p-2 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm font-normal"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    {/* Stats */}
                    <div className="flex items-center gap-4 px-4">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Total Files</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {stats.totalFiles}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Total Space</p>
                        <p className="text-sm font-semibold text-slate-900">
                          {formatFileSize(stats.totalSpace)}
                        </p>
                      </div>
                    </div>
                    {/* Filter and Reset buttons */}
                    <div className="flex items-center gap-2">
                      {isAnyFilterActive() && (
                        <button
                          onClick={handleReset}
                          className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span>Reset</span>
                        </button>
                      )}

                      <button
                        onClick={toggleSelectionMode}
                        className={`flex items-center gap-2 cursor-pointer transition-all duration-200 border px-3 py-2 rounded-lg text-sm font-medium ${
                          selectionMode
                            ? "bg-primary text-white border-primary hover:bg-primary/90"
                            : "text-slate-700 border-slate-300 hover:bg-slate-100"
                        }`}
                      >
                        {selectionMode ? (
                          <>
                            <X className="h-4 w-4" />
                            <span>Cancel Selection</span>
                          </>
                        ) : (
                          <>
                            <CheckSquare className="h-4 w-4" />
                            <span>Select Files</span>
                          </>
                        )}
                      </button>

                      <div className="relative dropdown-container">
                        <button
                          onClick={() =>
                            setShowFilterDropdown(!showFilterDropdown)
                          }
                          className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-700 border border-slate-300 px-3 py-2 rounded-lg text-sm font-medium"
                        >
                          <Funnel className="h-4 w-4" />
                          <span>Filter by Type</span>
                          {mediaTypes.length - selectedMediaTypes.length >
                            0 && (
                            <span className="bg-primary text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                              {mediaTypes.length - selectedMediaTypes.length}
                            </span>
                          )}
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        {showFilterDropdown && (
                          <div className="absolute top-full right-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                            <div className="py-1">
                              <button
                                onClick={() =>
                                  handleMediaTypeToggle("Select All")
                                }
                                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                              >
                                <span>Select All</span>
                                <input
                                  type="checkbox"
                                  checked={
                                    selectedMediaTypes.length ===
                                    mediaTypes.length
                                  }
                                  onChange={() => {}}
                                  className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                                />
                              </button>
                              {mediaTypes.map((type) => (
                                <button
                                  key={type}
                                  onClick={() => handleMediaTypeToggle(type)}
                                  className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                >
                                  <span>{type}</span>
                                  <input
                                    type="checkbox"
                                    checked={selectedMediaTypes.includes(type)}
                                    onChange={() => {}}
                                    className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-slate-600 text-sm">
                      View and manage deleted media files. You can download or
                      permanently delete them.
                    </p>
                    {/* Bulk Actions */}
                    {selectionMode && selectedFiles.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">
                          {selectedFiles.length} selected
                        </span>
                        <button
                          onClick={handleBulkDownload}
                          className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors text-sm font-medium"
                        >
                          <Download className="w-4 h-4" />
                          Download ({selectedFiles.length})
                        </button>
                        <button
                          onClick={() => {
                            setFileToDelete({
                              bulk: true,
                              files: selectedFiles,
                            });
                            setShowDeleteModal(true);
                          }}
                          disabled={isBulkDeleting}
                          className="flex items-center gap-2 cursor-pointer px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-4 h-4" />
                          {isBulkDeleting
                            ? "Deleting..."
                            : `Delete (${selectedFiles.length})`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scrollable Content Section */}
                <div className="flex-1 overflow-auto p-4">
                  {loading ? (
                    <div className="flex items-center justify-center min-h-[400px]">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
                        <p className="text-slate-600">
                          Loading deleted media...
                        </p>
                      </div>
                    </div>
                  ) : error ? (
                    <div className="flex items-center justify-center min-h-[400px]">
                      <div className="text-center max-w-md">
                        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                        <p className="text-red-600 mb-4">{error}</p>
                        <button
                          onClick={fetchDeletedMedia}
                          className="cursor-pointer px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium"
                        >
                          Try Again
                        </button>
                      </div>
                    </div>
                  ) : filteredMedia.length === 0 ? (
                    <div className="flex items-center justify-center min-h-[400px]">
                      <div className="text-center">
                        <File className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-600 text-lg">
                          {search ||
                          selectedMediaTypes.length !== mediaTypes.length
                            ? "No media found matching your filters"
                            : "No deleted media found"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                      {/* Select All Checkbox (when in selection mode) */}
                      {selectionMode && filteredMedia.length > 0 && (
                        <div className="col-span-full mb-2">
                          <button
                            onClick={handleSelectAll}
                            className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900"
                          >
                            {selectedFiles.length === filteredMedia.length ? (
                              <CheckSquare className="w-4 h-4 text-primary" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400" />
                            )}
                            <span>
                              {selectedFiles.length === filteredMedia.length
                                ? "Deselect All"
                                : "Select All"}
                            </span>
                          </button>
                        </div>
                      )}
                      {filteredMedia.map((file) => {
                        const isSelected = selectedFiles.some(
                          (f) => f.id === file.id
                        );
                        return (
                          <div
                            key={file.id}
                            className={`bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden border ${
                              isSelected
                                ? "border-primary ring-2 ring-primary"
                                : "border-slate-200"
                            }`}
                          >
                            {/* Selection Checkbox */}
                            {selectionMode && (
                              <div className="absolute top-2 left-2 z-10">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleFileSelect(file);
                                  }}
                                  className={`p-1.5 rounded-md transition-colors ${
                                    isSelected
                                      ? "bg-primary text-white"
                                      : "bg-white/90 text-slate-600 hover:bg-slate-100"
                                  }`}
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-4 h-4" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                              </div>
                            )}
                            {/* File Preview */}
                            <div
                              onClick={() => {
                                if (!selectionMode) {
                                  handleViewFile(file);
                                } else {
                                  handleFileSelect(file);
                                }
                              }}
                              className={`relative w-full aspect-square ${
                                selectionMode
                                  ? "cursor-pointer"
                                  : "cursor-pointer"
                              } bg-slate-100 overflow-hidden group`}
                            >
                              {getFilePreview(file)}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <ImageIcon className="w-6 h-6 text-white" />
                                </div>
                              </div>
                            </div>

                            {/* File Details */}
                            <div className="p-2.5">
                              <div className="mb-2">
                                <p
                                  className="text-xs font-semibold text-slate-900 truncate mb-0.5"
                                  title={file.filename || "Unknown"}
                                >
                                  {file.filename || "Unknown"}
                                </p>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                  <span>{getFileTypeLabel(file)}</span>
                                  <span>•</span>
                                  <span>{formatFileSize(file.size)}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                  {getSourceInfo(file)}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  Deleted: {formatDate(file.updatedAt)}
                                </p>
                              </div>

                              {/* Action Buttons */}
                              {!selectionMode && (
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadFile(file);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors text-[10px] font-medium"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span className="hidden sm:inline">
                                      Download
                                    </span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteClick(file);
                                    }}
                                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors text-[10px] font-medium"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span className="hidden sm:inline">
                                      Delete
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View Media Modal */}
      {viewFileModal && selectedFile && (
        <ViewMedia
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          setViewFileModal={setViewFileModal}
          setPageNumber={setPageNumber}
        />
      )}

      {/* Delete Confirmation Modal */}
      {fileToDelete && (
        <DeleteConfirmation
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setFileToDelete(null);
          }}
          onConfirm={async () => {
            if (fileToDelete.bulk) {
              // Handle bulk delete
              await handleBulkDelete();
              setShowDeleteModal(false);
              setFileToDelete(null);
            } else {
              // Handle single delete
              await handlePermanentDelete();
            }
          }}
          deleteWithInput={!fileToDelete.bulk}
          heading={fileToDelete.bulk ? "Multiple Media Files" : "Media"}
          message={
            fileToDelete.bulk
              ? `This will permanently delete ${fileToDelete.files.length} media file(s) from the server. This action cannot be undone.`
              : "This will permanently delete the media file from the server. This action cannot be undone."
          }
          comparingName={fileToDelete.bulk ? "" : fileToDelete.filename || ""}
          isDeleting={isDeleting || isBulkDeleting}
        />
      )}

      {/* Toast Container */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </AdminRoute>
  );
}
