import React, { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { Document, Page, pdfjs } from "react-pdf";
import {
  ZoomOut,
  ZoomIn,
  Download,
  X,
  File as FileIcon,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { toast } from "react-toastify";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function ViewMedia({
  selectedFile,
  setSelectedFile,
  setViewFileModal,
  setPageNumber,
  allFiles = [],
  currentIndex = 0,
}) {
  const [numPages, setNumPages] = useState(null);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [currentPageInView, setCurrentPageInView] = useState(1);
  const [imageScale, setImageScale] = useState(1.0);
  const [imageRotation, setImageRotation] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(currentIndex);
  const allFilesRef = useRef(allFiles);
  const currentFileIndexRef = useRef(currentIndex);

  // Keep refs in sync
  useEffect(() => {
    allFilesRef.current = allFiles;
  }, [allFiles]);

  useEffect(() => {
    currentFileIndexRef.current = currentFileIndex;
  }, [currentFileIndex]);

  // Initialize currentFileIndex from props when component mounts or currentIndex changes externally
  useEffect(() => {
    if (currentIndex >= 0 && currentIndex < allFiles.length) {
      setCurrentFileIndex(currentIndex);
      currentFileIndexRef.current = currentIndex;
    }
  }, [currentIndex, allFiles.length]); // Only update when prop changes, not during internal navigation

  // Convert file object from allFiles to selectedFile format
  const convertFileToSelectedFile = useCallback((file) => {
    if (!file) return null;

    // Handle different file URL formats
    let fileUrl = null;
    if (file.url) {
      // If URL already starts with /, use as is, otherwise prepend /
      fileUrl = file.url.startsWith("/") ? file.url : `/${file.url}`;
    }

    // Determine file type - check multiple possible fields
    const fileType =
      file.mime_type ||
      file.type ||
      (file.filename?.endsWith(".pdf")
        ? "application/pdf"
        : file.filename?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
          ? "image"
          : file.filename?.match(/\.(mp4|webm|ogg|mov)$/i)
            ? "video"
            : "");

    return {
      name: file.filename || file.name || "Unknown file",
      type: fileType,
      size: file.size || 0,
      url: fileUrl,
      isExisting: true,
      id: file.id,
      allFiles: allFilesRef.current,
      currentIndex: currentFileIndexRef.current,
    };
  }, []);

  // Navigate to previous file
  const handlePrevious = useCallback(() => {
    const files = allFilesRef.current;
    const currentIdx = currentFileIndexRef.current;

    if (files.length > 0 && currentIdx > 0) {
      const newIndex = currentIdx - 1;
      setCurrentFileIndex(newIndex);
      currentFileIndexRef.current = newIndex;

      const prevFile = convertFileToSelectedFile(files[newIndex]);
      if (prevFile) {
        setSelectedFile(prevFile);
        setImageScale(1.0); // Reset zoom when changing files
        setImageRotation(0); // Reset rotation when changing files
        setPdfScale(1.0);
        setCurrentPageInView(1);
        setNumPages(null);
      }
    }
  }, [convertFileToSelectedFile, setSelectedFile]);

  // Navigate to next file
  const handleNext = useCallback(() => {
    const files = allFilesRef.current;
    const currentIdx = currentFileIndexRef.current;

    if (files.length > 0 && currentIdx < files.length - 1) {
      const newIndex = currentIdx + 1;
      setCurrentFileIndex(newIndex);
      currentFileIndexRef.current = newIndex;

      const nextFile = convertFileToSelectedFile(files[newIndex]);
      if (nextFile) {
        setSelectedFile(nextFile);
        setImageScale(1.0); // Reset zoom when changing files
        setImageRotation(0); // Reset rotation when changing files
        setPdfScale(1.0);
        setCurrentPageInView(1);
        setNumPages(null);
      }
    }
  }, [convertFileToSelectedFile, setSelectedFile]);

  // Handle close
  const handleClose = useCallback(() => {
    setViewFileModal(false);
    setSelectedFile(null);
    setPageNumber(1);
    setNumPages(null);
    setPdfScale(1.0);
    setImageScale(1.0);
    setImageRotation(0);
    setCurrentPageInView(1);
  }, [setViewFileModal, setSelectedFile, setPageNumber]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrevious, handleNext, handleClose]);

  const canNavigatePrevious = allFiles.length > 0 && currentFileIndex > 0;
  const canNavigateNext =
    allFiles.length > 0 && currentFileIndex < allFiles.length - 1;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-800 truncate">
              {selectedFile.name}
            </h3>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-sm text-slate-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
              {allFiles.length > 0 && (
                <p className="text-sm text-slate-500">
                  {currentFileIndex + 1} of {allFiles.length}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="cursor-pointer ml-4 p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Navigation Buttons - Fixed relative to modal container */}
        {allFiles.length > 1 && (
          <>
            <button
              onClick={handlePrevious}
              disabled={!canNavigatePrevious}
              className="absolute left-6 top-1/2 -translate-y-1/2 z-50 p-3 bg-white/90 backdrop-blur-xs rounded-full shadow-lg border border-slate-200 hover:bg-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Previous (←)"
            >
              <ChevronLeft className="w-6 h-6 text-slate-700" />
            </button>
            <button
              onClick={handleNext}
              disabled={!canNavigateNext}
              className="absolute right-6 top-1/2 -translate-y-1/2 z-50 p-3 bg-white/90 backdrop-blur-xs rounded-full shadow-lg border border-slate-200 hover:bg-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              title="Next (→)"
            >
              <ChevronRight className="w-6 h-6 text-slate-700" />
            </button>
          </>
        )}

        {/* Modal Content */}
        <div className="relative flex-1 overflow-auto p-2 bg-slate-50">
          {selectedFile.type?.includes("image") ? (
            <div className="flex items-center justify-center min-h-full">
              <div
                className="transition-transform duration-200"
                style={{
                  transform: `scale(${imageScale}) rotate(${imageRotation}deg)`,
                  transformOrigin: "center center",
                }}
              >
                {/* rotate image */}
                <Image
                  loading="lazy"
                  width={1000}
                  height={1000}
                  objectFit="contain"
                  src={
                    selectedFile.url ||
                    (selectedFile instanceof File ||
                    selectedFile instanceof Blob
                      ? URL.createObjectURL(selectedFile)
                      : null)
                  }
                  alt={selectedFile.name}
                  className=" rounded-lg shadow-lg w-full h-full object-contain"
                />
              </div>
            </div>
          ) : selectedFile.type?.includes("pdf") ||
            selectedFile.name?.endsWith(".pdf") ? (
            <div className="relative flex flex-col items-center justify-start h-full w-full overflow-auto">
              <div className="w-full flex flex-col items-center gap-4 pb-8">
                <Document
                  file={
                    selectedFile.url ||
                    (selectedFile instanceof File ||
                    selectedFile instanceof Blob
                      ? selectedFile
                      : null)
                  }
                  onLoadSuccess={({ numPages }) => {
                    setNumPages(numPages);
                    setCurrentPageInView(1);
                  }}
                  onLoadError={(error) => {
                    console.error("Error loading PDF:", error);
                    toast.error("Failed to load PDF");
                  }}
                  className="flex flex-col items-center gap-4"
                >
                  {Array.from(new Array(numPages), (el, index) => (
                    <div
                      key={`page_${index + 1}`}
                      className="shadow-lg bg-white"
                      onMouseEnter={() => setCurrentPageInView(index + 1)}
                    >
                      <Page
                        pageNumber={index + 1}
                        scale={pdfScale}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        className="max-w-full"
                      />
                    </div>
                  ))}
                </Document>
              </div>
            </div>
          ) : selectedFile.type?.includes("video") ? (
            <div className="flex items-center justify-center h-full">
              <video
                controls
                className="max-w-full max-h-full rounded-lg shadow-lg"
                src={
                  selectedFile.url ||
                  (selectedFile instanceof File || selectedFile instanceof Blob
                    ? URL.createObjectURL(selectedFile)
                    : null)
                }
              >
                Your browser does not support the video tag.
              </video>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <FileIcon className="w-16 h-16 mb-4 text-slate-400" />
              <p className="text-lg font-medium mb-2">Preview not available</p>
              <p className="text-sm mb-4">
                This file type cannot be previewed in the browser
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-2 border-t border-slate-200 sticky bottom-4 left-4 right-4">
          <div className="text-sm text-slate-700 font-medium bg-white/90 backdrop-blur-xs rounded-lg px-4 py-2 shadow-lg border border-slate-200 pointer-events-auto">
            {selectedFile.type?.includes("image")
              ? "Image"
              : selectedFile.type?.includes("pdf")
                ? "PDF"
                : selectedFile.type?.includes("video")
                  ? "Video"
                  : "Unknown file type"}
          </div>

          {/* Image Zoom Controls */}
          {selectedFile.type?.includes("image") && (
            <div className="flex items-center gap-2 bg-white/90 backdrop-blur-xs rounded-lg px-4 py-2 shadow-lg border border-slate-200 pointer-events-auto">
              <button
                onClick={() =>
                  setImageScale((prev) => Math.max(prev - 0.25, 0.25))
                }
                disabled={imageScale <= 0.25}
                className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-slate-700 min-w-[50px] text-center">
                {Math.round(imageScale * 100)}%
              </span>
              <button
                onClick={() =>
                  setImageScale((prev) => Math.min(prev + 0.25, 3.0))
                }
                disabled={imageScale >= 3.0}
                className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <div className="h-6 w-px bg-slate-300 mx-1"></div>
              <button
                onClick={() => setImageRotation((prev) => (prev - 90) % 360)}
                className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title="Rotate Left"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setImageRotation((prev) => (prev + 90) % 360)}
                className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title="Rotate Right"
              >
                <RotateCw className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* PDF Controls */}
          {(selectedFile.type?.includes("pdf") ||
            selectedFile.name?.endsWith(".pdf")) && (
            <div className="flex items-center gap-2 bg-white/90 backdrop-blur-xs rounded-lg px-4 py-2 shadow-lg border border-slate-200 pointer-events-auto">
              <button
                onClick={() =>
                  setPdfScale((prev) => Math.max(prev - 0.25, 0.25))
                }
                disabled={pdfScale <= 0.25}
                className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-slate-700 min-w-[50px] text-center">
                {Math.round(pdfScale * 100)}%
              </span>
              <button
                onClick={() =>
                  setPdfScale((prev) => Math.min(prev + 0.25, 3.0))
                }
                disabled={pdfScale >= 3.0}
                className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              {numPages && (
                <>
                  <div className="h-6 w-px bg-slate-300 mx-1"></div>
                  <span className="text-sm font-medium text-slate-700">
                    Page {currentPageInView} of {numPages}
                  </span>
                </>
              )}
            </div>
          )}

          <button
            onClick={() => {
              if (selectedFile.isExisting) {
                // For existing files, open in new tab or download
                window.open(selectedFile.url, "_blank");
              } else if (selectedFile.url) {
                // For new files with object URL, use the provided URL
                const a = document.createElement("a");
                a.href = selectedFile.url;
                a.download = selectedFile.name;
                a.click();
              } else if (
                selectedFile instanceof File ||
                selectedFile instanceof Blob
              ) {
                // For new files that are actual File/Blob objects, create object URL
                const fileURL = URL.createObjectURL(selectedFile);
                const a = document.createElement("a");
                a.href = fileURL;
                a.download = selectedFile.name;
                a.click();
                URL.revokeObjectURL(fileURL);
              }
            }}
            className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium shadow-lg"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
