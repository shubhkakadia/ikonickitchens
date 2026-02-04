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
  const [showControls, setShowControls] = useState(true); // For auto-hide controls
  const allFilesRef = useRef(allFiles);
  const currentFileIndexRef = useRef(currentIndex);
  const hideControlsTimeoutRef = useRef(null); // Timer for auto-hiding controls

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
  }, [currentIndex, allFiles.length]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

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
        setImageScale(1.0);
        setImageRotation(0);
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
        setImageScale(1.0);
        setImageRotation(0);
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

  // Auto-hide controls after 2 seconds of mouse inactivity
  useEffect(() => {
    const handleMouseMove = () => {
      // Show controls when mouse moves
      setShowControls(true);

      // Clear existing timeout
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }

      // Set new timeout to hide controls after 2 seconds
      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 5000);
    };

    // Add mouse move listener
    window.addEventListener("mousemove", handleMouseMove);

    // Start initial timer
    hideControlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 5000);

    // Cleanup
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
      }
    };
  }, []);

  const canNavigatePrevious = allFiles.length > 0 && currentFileIndex > 0;
  const canNavigateNext =
    allFiles.length > 0 && currentFileIndex < allFiles.length - 1;

  // Reset handler for images
  const handleReset = () => {
    setImageScale(1.0);
    setImageRotation(0);
  };

  // Reset handler for PDFs
  const handlePdfReset = () => {
    setPdfScale(1.0);
  };

  // Download handler
  const handleDownload = () => {
    if (selectedFile.isExisting) {
      window.open(selectedFile.url, "_blank");
    } else if (selectedFile.url) {
      const a = document.createElement("a");
      a.href = selectedFile.url;
      a.download = selectedFile.name;
      a.click();
    } else if (selectedFile instanceof File || selectedFile instanceof Blob) {
      const fileURL = URL.createObjectURL(selectedFile);
      const a = document.createElement("a");
      a.href = fileURL;
      a.download = selectedFile.name;
      a.click();
      URL.revokeObjectURL(fileURL);
    }
  };

  // Determine image source URL
  const imageSrc =
    selectedFile.url ||
    (selectedFile instanceof File || selectedFile instanceof Blob
      ? URL.createObjectURL(selectedFile)
      : null);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      {/* Modal Container */}
      <div
        className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-6xl h-[98vh] flex flex-col relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Media Viewer Area */}
        <div className="relative flex-1 overflow-hidden bg-slate-900">
          {/* Media Content */}
          <div
            className="absolute inset-0 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedFile.type?.includes("image") ? (
              <div className="transition-transform duration-300 ease-out">
                <Image
                  width={1920}
                  height={1080}
                  src={imageSrc}
                  alt={selectedFile.name}
                  style={{
                    transform: `scale(${imageScale}) rotate(${imageRotation}deg)`,
                  }}
                  className="max-w-screen max-h-screen object-contain p-6"
                  draggable={false}
                  priority
                />
              </div>
            ) : selectedFile.type?.includes("pdf") ||
              selectedFile.name?.endsWith(".pdf") ? (
              <div className="relative w-full h-full overflow-auto flex flex-col items-center justify-start py-8">
                <div className="w-full flex flex-col items-center gap-4">
                  <Document
                    file={imageSrc}
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
                        className="shadow-2xl bg-white"
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
              <video controls className="max-w-full max-h-full" src={imageSrc}>
                Your browser does not support the video tag.
              </video>
            ) : (
              <div className="flex flex-col items-center justify-center text-white">
                <FileIcon className="w-16 h-16 mb-4 text-white/60" />
                <p className="text-lg font-medium mb-2">
                  Preview not available
                </p>
                <p className="text-sm text-white/60">
                  This file type cannot be previewed in the browser
                </p>
              </div>
            )}
          </div>

          {/* Navigation Buttons for Multiple Files */}
          {allFiles.length > 1 && (
            <>
              <button
                onClick={handlePrevious}
                disabled={!canNavigatePrevious}
                className={`absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-black/40 backdrop-blur-md rounded-full hover:bg-black/60 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border border-white/10 shadow-lg ${
                  showControls ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                title="Previous (←)"
              >
                <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </button>
              <button
                onClick={handleNext}
                disabled={!canNavigateNext}
                className={`absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 bg-black/40 backdrop-blur-md rounded-full hover:bg-black/60 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer border border-white/10 shadow-lg ${
                  showControls ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                title="Next (→)"
              >
                <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </button>
            </>
          )}

          {/* Floating Top Navigation Bar */}
          <div
            className={`absolute top-0 left-0 right-0 z-20 pointer-events-none transition-opacity duration-300 ${
              showControls ? "opacity-100" : "opacity-0"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 sm:p-4 sm:px-6">
              <div className="flex items-center justify-between max-w-7xl mx-auto pointer-events-auto gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <div className="text-white font-medium truncate max-w-[200px] sm:max-w-md text-sm sm:text-base bg-black/40 rounded-lg px-2 sm:px-4 backdrop-blur-md shadow-lg border border-white/10 min-h-11 flex items-center">
                    {selectedFile.name}
                  </div>
                  {allFiles.length > 0 && (
                    <div className="text-white font-medium truncate max-w-[200px] sm:max-w-md text-sm sm:text-base bg-black/40 rounded-lg px-2 sm:px-4 backdrop-blur-md shadow-lg border border-white/10 min-h-11 flex items-center">
                      {currentFileIndex + 1} / {allFiles.length}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleClose}
                  className="cursor-pointer text-white/90 hover:text-white hover:bg-black/60 rounded-lg p-2 sm:p-2.5 transition-all backdrop-blur-md bg-black/40 shadow-lg border border-white/10 shrink-0 min-w-11 min-h-11 flex items-center justify-center"
                  aria-label="Close preview"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>
          </div>

          {/* Floating Bottom Control Bar */}
          <div
            className={`absolute bottom-0 left-0 right-0 z-20 pointer-events-none transition-opacity duration-300 ${
              showControls ? "opacity-100" : "opacity-0"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 sm:p-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-center gap-2 max-w-7xl mx-auto pointer-events-auto">
                {/* Image Controls */}
                {selectedFile.type?.includes("image") && (
                  <>
                    {/* Reset Button - Always visible but disabled when not needed */}
                    <button
                      onClick={handleReset}
                      disabled={imageScale === 1 && imageRotation === 0}
                      className="cursor-pointer text-white/90 hover:text-white hover:bg-black/60 backdrop-blur-md rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-all border border-white/10 shadow-lg min-h-11 bg-black/40 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Reset
                    </button>

                    {/* Zoom Controls */}
                    <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 shadow-lg">
                      <button
                        onClick={() =>
                          setImageScale((prev) => Math.max(prev - 0.25, 0.5))
                        }
                        disabled={imageScale <= 0.5}
                        className="cursor-pointer text-white/90 hover:text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg p-2 sm:p-2.5 transition-all min-w-11 min-h-11 flex items-center justify-center"
                        aria-label="Zoom out"
                      >
                        <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>

                      <span className="text-white/90 text-xs sm:text-sm font-medium px-2 sm:px-3 min-w-12 sm:min-w-16 text-center">
                        {Math.round(imageScale * 100)}%
                      </span>

                      <button
                        onClick={() =>
                          setImageScale((prev) => Math.min(prev + 0.25, 3))
                        }
                        disabled={imageScale >= 3}
                        className="cursor-pointer text-white/90 hover:text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg p-2 sm:p-2.5 transition-all min-w-11 min-h-11 flex items-center justify-center"
                        aria-label="Zoom in"
                      >
                        <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>

                    {/* Rotate Button */}
                    <button
                      onClick={() =>
                        setImageRotation((prev) => (prev + 90) % 360)
                      }
                      className="cursor-pointer text-white/90 hover:text-white hover:bg-black/60 backdrop-blur-md rounded-lg p-2 sm:p-2.5 transition-all border border-white/10 shadow-lg min-w-11 min-h-11 flex items-center justify-center bg-black/40"
                      aria-label="Rotate image"
                    >
                      <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
                    </button>
                  </>
                )}

                {/* PDF Controls */}
                {(selectedFile.type?.includes("pdf") ||
                  selectedFile.name?.endsWith(".pdf")) && (
                  <>
                    {/* PDF Zoom Controls */}
                    <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-lg border border-white/10 shadow-lg">
                      <button
                        onClick={() =>
                          setPdfScale((prev) => Math.max(prev - 0.25, 0.5))
                        }
                        disabled={pdfScale <= 0.5}
                        className="cursor-pointer text-white/90 hover:text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg p-2 sm:p-2.5 transition-all min-w-11 min-h-11 flex items-center justify-center"
                        aria-label="Zoom out"
                      >
                        <ZoomOut className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>

                      <span className="text-white/90 text-xs sm:text-sm font-medium px-2 sm:px-3 min-w-12 sm:min-w-16 text-center">
                        {Math.round(pdfScale * 100)}%
                      </span>

                      <button
                        onClick={() =>
                          setPdfScale((prev) => Math.min(prev + 0.25, 3))
                        }
                        disabled={pdfScale >= 3}
                        className="cursor-pointer text-white/90 hover:text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg p-2 sm:p-2.5 transition-all min-w-11 min-h-11 flex items-center justify-center"
                        aria-label="Zoom in"
                      >
                        <ZoomIn className="w-4 h-4 sm:w-5 sm:h-5" />
                      </button>
                    </div>

                    {/* PDF Page Info */}
                    {numPages && (
                      <div className="text-white/90 text-xs sm:text-sm font-medium bg-black/40 backdrop-blur-md rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 border border-white/10 shadow-lg min-h-11 flex items-center">
                        Page {currentPageInView} of {numPages}
                      </div>
                    )}

                    {/* PDF Reset Button - Always visible but disabled when not needed */}
                    <button
                      onClick={handlePdfReset}
                      disabled={pdfScale === 1}
                      className="cursor-pointer text-white/90 hover:text-white hover:bg-black/60 backdrop-blur-md rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-all border border-white/10 shadow-lg min-h-11 bg-black/40 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      Reset
                    </button>
                  </>
                )}

                {/* Download Button */}
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 cursor-pointer text-white/90 hover:text-white hover:bg-black/60 backdrop-blur-md rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-all border border-white/10 shadow-lg min-h-11 bg-black/40"
                  aria-label="Download file"
                >
                  <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Download</span>
                  <span className="sm:hidden">Save</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
