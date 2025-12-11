import React, { useState } from "react";
import Image from "next/image";
import { Document, Page, pdfjs } from "react-pdf";
import { ZoomOut, ZoomIn, Download, X, File } from "lucide-react";
import { toast } from "react-toastify";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function ViewMedia({
  selectedFile,
  setSelectedFile,
  setViewFileModal,
  setPageNumber,
}) {
  const [numPages, setNumPages] = useState(null);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [currentPageInView, setCurrentPageInView] = useState(1);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-800 truncate">
              {selectedFile.name}
            </h3>
            <p className="text-sm text-slate-500">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <button
            onClick={() => {
              setViewFileModal(false);
              setSelectedFile(null);
              setPageNumber(1);
              setNumPages(null);
              setPdfScale(1.0);
              setCurrentPageInView(1);
            }}
            className="cursor-pointer ml-4 p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="relative flex-1 overflow-auto p-4 bg-slate-50">
          {selectedFile.type?.includes("image") ? (
            <div className="flex items-center justify-center h-full">
              <Image
                loading="lazy"
                width={1000}
                height={1000}
                src={
                  selectedFile.isExisting
                    ? selectedFile.url
                    : URL.createObjectURL(selectedFile)
                }
                alt={selectedFile.name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              />
            </div>
          ) : selectedFile.type?.includes("pdf") ||
            selectedFile.name?.endsWith(".pdf") ? (
            <div className="relative flex flex-col items-center justify-start h-full w-full overflow-auto">
              <div className="w-full flex flex-col items-center gap-4 pb-8">
                <Document
                  file={
                    selectedFile.isExisting ? selectedFile.url : selectedFile
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
                  selectedFile.isExisting
                    ? selectedFile.url
                    : URL.createObjectURL(selectedFile)
                }
              >
                Your browser does not support the video tag.
              </video>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <File className="w-16 h-16 mb-4 text-slate-400" />
              <p className="text-lg font-medium mb-2">Preview not available</p>
              <p className="text-sm mb-4">
                This file type cannot be previewed in the browser
              </p>
            </div>
          )}

          {/* Floating Info and Download Button */}
          <div className="sticky bottom-4 left-4 right-4 flex items-center justify-between gap-4 z-50 pointer-events-auto">
            <div className="text-sm text-slate-700 font-medium bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border border-slate-200 pointer-events-auto">
              {selectedFile.type?.includes("image")
                ? "Image"
                : selectedFile.type?.includes("pdf")
                  ? "PDF"
                  : selectedFile.type?.includes("video")
                    ? "Video"
                    : "Unknown file type"}
            </div>

            {/* PDF Controls */}
            {(selectedFile.type?.includes("pdf") ||
              selectedFile.name?.endsWith(".pdf")) && (
                <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border border-slate-200 pointer-events-auto">
                  <button
                    onClick={() =>
                      setPdfScale((prev) => Math.max(prev - 0.25, 0.5))
                    }
                    disabled={pdfScale <= 0.5}
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
                } else {
                  // For new files, use blob download
                  const fileURL = URL.createObjectURL(selectedFile);
                  const a = document.createElement("a");
                  a.href = fileURL;
                  a.download = selectedFile.name;
                  a.click();
                }
              }}
              className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium shadow-lg pointer-events-auto"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
