"use client";
import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  FileUp,
  FileText,
  File,
  Trash,
  Check,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "react-toastify";
import axios from "axios";
import TextEditor from "@/components/TextEditor/TextEditor";
import ViewMedia from "./ViewMedia";

// File item component with self-contained notes state (prevents parent re-renders from causing focus loss)
const FileItemWithNotes = ({
  file,
  isSmall,
  handleViewExistingFile,
  openDeleteFileConfirmation,
  isDeletingFile,
  getToken,
  activeTab,
  activeSitePhotoSubtab,
}) => {
  const [notes, setNotes] = useState(file.notes || "");
  const [saveStatus, setSaveStatus] = useState("idle"); // "idle" | "saving" | "saved"
  const debounceTimer = useRef(null);

  // Checkbox states for maintenance checklist
  const [preparedByOffice, setPreparedByOffice] = useState(
    file.maintenance_checklist?.prepared_by_office || false,
  );
  const [preparedByProduction, setPreparedByProduction] = useState(
    file.maintenance_checklist?.prepared_by_production || false,
  );
  const [deliveredToSite, setDeliveredToSite] = useState(
    file.maintenance_checklist?.delivered_to_site || false,
  );
  const [installed, setInstalled] = useState(
    file.maintenance_checklist?.installed || false,
  );
  const checklistDebounceTimer = useRef(null);

  // Refs to track current checkbox values for debounced save
  const preparedByOfficeRef = useRef(preparedByOffice);
  const preparedByProductionRef = useRef(preparedByProduction);
  const deliveredToSiteRef = useRef(deliveredToSite);
  const installedRef = useRef(installed);

  // Update refs when state changes
  useEffect(() => {
    preparedByOfficeRef.current = preparedByOffice;
    preparedByProductionRef.current = preparedByProduction;
    deliveredToSiteRef.current = deliveredToSite;
    installedRef.current = installed;
  }, [preparedByOffice, preparedByProduction, deliveredToSite, installed]);

  // Sync checkbox states when file prop changes
  useEffect(() => {
    if (file.maintenance_checklist) {
      setPreparedByOffice(
        file.maintenance_checklist.prepared_by_office || false,
      );
      setPreparedByProduction(
        file.maintenance_checklist.prepared_by_production || false,
      );
      setDeliveredToSite(file.maintenance_checklist.delivered_to_site || false);
      setInstalled(file.maintenance_checklist.installed || false);
    } else {
      setPreparedByOffice(false);
      setPreparedByProduction(false);
      setDeliveredToSite(false);
      setInstalled(false);
    }
  }, [file.maintenance_checklist]);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
      if (checklistDebounceTimer.current) {
        clearTimeout(checklistDebounceTimer.current);
      }
    };
  }, []);

  // Save file notes to API
  const saveFileNotes = async (notesValue) => {
    if (!file.id) return;

    try {
      setSaveStatus("saving");

      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        setSaveStatus("idle");
        return;
      }

      const response = await axios.patch(
        `/api/lot_file/${file.id}`,
        { notes: notesValue },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status) {
        setSaveStatus("saved");
        setTimeout(() => {
          setSaveStatus("idle");
        }, 2000);
      } else {
        toast.error(response.data.message || "Failed to save file notes");
        setSaveStatus("idle");
      }
    } catch (error) {
      console.error("Error saving file notes:", error);
      toast.error("Failed to save file notes. Please try again.");
      setSaveStatus("idle");
    }
  };

  // Debounced handler for notes changes
  const handleNotesChange = (value) => {
    setNotes(value);

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer (1 second debounce)
    debounceTimer.current = setTimeout(() => {
      saveFileNotes(value);
    }, 1000);
  };

  // Save maintenance checklist to API
  const saveMaintenanceChecklist = async (checklistData) => {
    if (!file.id) return;

    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const response = await axios.post(
        `/api/maintenance_checklist/upsert`,
        {
          lot_file_id: file.id,
          prepared_by_office: checklistData.preparedByOffice,
          prepared_by_production: checklistData.preparedByProduction,
          delivered_to_site: checklistData.deliveredToSite,
          installed: checklistData.installed,
        },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status && response.data.data) {
        // Update local state from API response
        const updatedChecklist = response.data.data;
        setPreparedByOffice(updatedChecklist.prepared_by_office || false);
        setPreparedByProduction(
          updatedChecklist.prepared_by_production || false,
        );
        setDeliveredToSite(updatedChecklist.delivered_to_site || false);
        setInstalled(updatedChecklist.installed || false);

        // Update refs
        preparedByOfficeRef.current =
          updatedChecklist.prepared_by_office || false;
        preparedByProductionRef.current =
          updatedChecklist.prepared_by_production || false;
        deliveredToSiteRef.current =
          updatedChecklist.delivered_to_site || false;
        installedRef.current = updatedChecklist.installed || false;
      } else {
        toast.error(response.data.message || "Failed to save checklist");
      }
    } catch (error) {
      console.error("Error saving maintenance checklist:", error);
      toast.error("Failed to save checklist. Please try again.");
    }
  };

  // Debounced handler for checklist changes with cascading logic
  const handleChecklistChange = (field, value) => {
    let newPreparedByOffice = preparedByOffice;
    let newPreparedByProduction = preparedByProduction;
    let newDeliveredToSite = deliveredToSite;
    let newInstalled = installed;

    // Cascading logic: stages must be completed in order
    if (value) {
      // When checking a stage, automatically check all previous stages
      if (field === "preparedByOffice") {
        newPreparedByOffice = true;
      } else if (field === "preparedByProduction") {
        newPreparedByOffice = true;
        newPreparedByProduction = true;
      } else if (field === "deliveredToSite") {
        newPreparedByOffice = true;
        newPreparedByProduction = true;
        newDeliveredToSite = true;
      } else if (field === "installed") {
        newPreparedByOffice = true;
        newPreparedByProduction = true;
        newDeliveredToSite = true;
        newInstalled = true;
      }
    } else {
      // When unchecking a stage, automatically uncheck all subsequent stages
      if (field === "preparedByOffice") {
        newPreparedByOffice = false;
        newPreparedByProduction = false;
        newDeliveredToSite = false;
        newInstalled = false;
      } else if (field === "preparedByProduction") {
        newPreparedByProduction = false;
        newDeliveredToSite = false;
        newInstalled = false;
      } else if (field === "deliveredToSite") {
        newDeliveredToSite = false;
        newInstalled = false;
      } else if (field === "installed") {
        newInstalled = false;
      }
    }

    // Update all states immediately
    setPreparedByOffice(newPreparedByOffice);
    setPreparedByProduction(newPreparedByProduction);
    setDeliveredToSite(newDeliveredToSite);
    setInstalled(newInstalled);

    // Update refs
    preparedByOfficeRef.current = newPreparedByOffice;
    preparedByProductionRef.current = newPreparedByProduction;
    deliveredToSiteRef.current = newDeliveredToSite;
    installedRef.current = newInstalled;

    // Clear existing timer
    if (checklistDebounceTimer.current) {
      clearTimeout(checklistDebounceTimer.current);
    }

    // Set new timer (1 second debounce) - single API call for all changes
    checklistDebounceTimer.current = setTimeout(() => {
      saveMaintenanceChecklist({
        preparedByOffice: preparedByOfficeRef.current,
        preparedByProduction: preparedByProductionRef.current,
        deliveredToSite: deliveredToSiteRef.current,
        installed: installedRef.current,
      });
      checklistDebounceTimer.current = null;
    }, 1000);
  };

  return (
    <div className="gap-4 flex items-start">
      <div
        className="relative group cursor-pointer"
        style={{ width: "350px" }}
        onClick={() => handleViewExistingFile(file)}
      >
        <div className="w-full h-[120px] rounded-lg flex items-center justify-center mb-2 overflow-hidden bg-slate-50 hover:bg-slate-100 transition-colors">
          {file.mime_type.includes("image") ? (
            <Image
              height={120}
              width={300}
              src={`/${file.url}`}
              alt={file.filename}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : file.mime_type.includes("video") ? (
            <video
              src={`/${file.url}`}
              className="w-full h-full object-cover rounded-lg"
              muted
              playsInline
            />
          ) : (
            <div
              className={`w-full h-[120px] flex items-center justify-center rounded-lg ${
                file.mime_type.includes("pdf") ? "bg-red-50" : "bg-green-50"
              }`}
            >
              {file.mime_type.includes("pdf") ? (
                <FileText
                  className={`${isSmall ? "w-6 h-6" : "w-8 h-8"} text-red-600`}
                />
              ) : (
                <File
                  className={`${isSmall ? "w-6 h-6" : "w-8 h-8"} text-green-600`}
                />
              )}
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="space-y-1 w-full">
          <p
            className="text-xs font-medium text-slate-700 truncate w-full"
            title={file.filename}
          >
            {file.filename}
          </p>
          <p className="text-xs text-slate-500">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>

        {/* Delete Button */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openDeleteFileConfirmation(file);
            }}
            disabled={isDeletingFile === file.id}
            className="p-1.5 cursor-pointer bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
            title="Delete file"
          >
            {isDeletingFile === file.id ? (
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
            ) : (
              <Trash className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Notes Section - Reduced Width */}
      <div className="relative flex-1">
        <textarea
          rows="6"
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="w-full border border-slate-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
          placeholder="Add notes for this file..."
        />
        {/* Save status indicator */}
        {saveStatus === "saving" && (
          <span className="absolute bottom-2 right-2 text-xs text-slate-500 font-medium flex items-center gap-1">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-slate-500"></div>
            Saving...
          </span>
        )}
        {saveStatus === "saved" && (
          <span className="absolute bottom-2 right-2 text-xs text-green-600 font-medium flex items-center gap-1">
            <Check className="w-3 h-3" />
            Saved!
          </span>
        )}
      </div>

      {/* Maintenance Checklist Checkboxes - In Same Row - Only for Maintenance Photos Tab */}
      {activeTab === "site_photos" &&
        activeSitePhotoSubtab === "maintenance" && (
          <div
            className="flex flex-col justify-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={preparedByOffice}
                onChange={(e) =>
                  handleChecklistChange("preparedByOffice", e.target.checked)
                }
                className="w-4 h-4 text-secondary border-slate-300 rounded focus:ring-2 focus:ring-secondary cursor-pointer"
              />
              <span className="text-sm text-slate-700">Prepared by Office</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={preparedByProduction}
                onChange={(e) =>
                  handleChecklistChange(
                    "preparedByProduction",
                    e.target.checked,
                  )
                }
                className="w-4 h-4 text-secondary border-slate-300 rounded focus:ring-2 focus:ring-secondary cursor-pointer"
              />
              <span className="text-sm text-slate-700">
                Prepared by Production
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={deliveredToSite}
                onChange={(e) =>
                  handleChecklistChange("deliveredToSite", e.target.checked)
                }
                className="w-4 h-4 text-secondary border-slate-300 rounded focus:ring-2 focus:ring-secondary cursor-pointer"
              />
              <span className="text-sm text-slate-700">Delivered to Site</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={installed}
                onChange={(e) =>
                  handleChecklistChange("installed", e.target.checked)
                }
                className="w-4 h-4 text-secondary border-slate-300 rounded focus:ring-2 focus:ring-secondary cursor-pointer"
              />
              <span className="text-sm text-slate-700">Installed</span>
            </label>
          </div>
        )}
    </div>
  );
};

export default function FileUploadSection({
  existingFiles = [],
  handleFileSelect,
  isSavingUpload = false,
  openDeleteFileConfirmation,
  isDeletingFile = null,
  getToken,
  activeTab,
  activeSitePhotoSubtab,
  filterPreparedByOffice = false,
  filterPreparedByProduction = false,
  filterDeliveredToSite = false,
  filterInstalled = false,
  selectedLotData,
  getTabEnum,
  handleNotesSave,
}) {
  // ViewMedia modal state
  const [viewFileModal, setViewFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  // Carousel state for Finished Site Photos
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Sort files by type: images, videos, PDFs, others
  const sortFilesByType = (files) => {
    const images = [];
    const videos = [];
    const pdfs = [];
    const others = [];

    files.forEach((file) => {
      const mimeType = file.mime_type || file.type || "";
      const filename = file.filename || file.name || "";

      if (
        mimeType.includes("image") ||
        filename.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i)
      ) {
        images.push(file);
      } else if (
        mimeType.includes("video") ||
        filename.match(/\.(mp4|webm|ogg|mov|avi)$/i)
      ) {
        videos.push(file);
      } else if (mimeType.includes("pdf") || filename.endsWith(".pdf")) {
        pdfs.push(file);
      } else {
        others.push(file);
      }
    });

    return [...images, ...videos, ...pdfs, ...others];
  };

  // Handle viewing existing file
  const handleViewExistingFile = (file) => {
    const fileUrl = `/${file.url}`;
    const filteredFiles = getFilteredFiles();
    const sortedFiles = sortFilesByType(filteredFiles);
    const currentIndex = sortedFiles.findIndex(
      (f) => f.id === file.id || f.filename === file.filename,
    );

    setSelectedFile({
      name: file.filename,
      type: file.mime_type,
      size: file.size,
      url: fileUrl,
      isExisting: true,
      id: file.id,
      allFiles: sortedFiles,
      currentIndex: currentIndex >= 0 ? currentIndex : 0,
    });
    setViewFileModal(true);
  };
  // Filter files by checklist status if in maintenance photos tab
  const getFilteredFiles = () => {
    let files = existingFiles;

    if (
      activeTab === "site_photos" &&
      activeSitePhotoSubtab === "maintenance"
    ) {
      files = files.filter((file) => {
        const checklist = file.maintenance_checklist;

        // If no filters are selected, show all files
        if (
          !filterPreparedByOffice &&
          !filterPreparedByProduction &&
          !filterDeliveredToSite &&
          !filterInstalled
        ) {
          return true;
        }

        // Check if file matches any selected filter
        let matches = false;

        if (filterPreparedByOffice && checklist?.prepared_by_office) {
          matches = true;
        }
        if (filterPreparedByProduction && checklist?.prepared_by_production) {
          matches = true;
        }
        if (filterDeliveredToSite && checklist?.delivered_to_site) {
          matches = true;
        }
        if (filterInstalled && checklist?.installed) {
          matches = true;
        }

        return matches;
      });
    }

    return files;
  };

  const filteredFiles = getFilteredFiles();

  // Categorize files by type
  const categorizeFiles = () => {
    const images = [];
    const videos = [];
    const pdfs = [];
    const others = [];

    filteredFiles.forEach((file) => {
      if (file.mime_type.includes("image")) {
        images.push(file);
      } else if (file.mime_type.includes("video")) {
        videos.push(file);
      } else if (file.mime_type.includes("pdf")) {
        pdfs.push(file);
      } else {
        others.push(file);
      }
    });

    return { images, videos, pdfs, others };
  };

  const { images, videos, pdfs, others } = categorizeFiles();

  // Render a file category
  const renderFileCategory = (title, files, isSmall, sectionKey) => {
    if (files.length === 0) return null;

    return (
      <div key={sectionKey} className="mb-4">
        {/* Category Header */}
        <div className="w-full flex items-center justify-between text-sm font-semibold text-slate-700 mb-3">
          <span>
            {title} ({files.length})
          </span>
        </div>

        {/* Files Grid */}
        <div className="gap-3 grid grid-cols-2 items-start">
          {files.map((file, index) => {
            // Add border-bottom to all items except those in the last row
            // In a 2-column grid, last row contains the last 1-2 items
            const isInLastRow = index >= Math.max(0, files.length - 2);
            // Add border-right to items in the first column (even indices: 0, 2, 4, etc.)
            const isFirstColumn = index % 2 === 0;

            return (
              <div
                key={file.id}
                className={`p-4 ${!isInLastRow ? "border-b border-slate-200" : ""} ${isFirstColumn ? "border-r border-slate-200" : ""}`}
              >
                <FileItemWithNotes
                  file={file}
                  isSmall={isSmall}
                  handleViewExistingFile={handleViewExistingFile}
                  openDeleteFileConfirmation={openDeleteFileConfirmation}
                  isDeletingFile={isDeletingFile}
                  getToken={getToken}
                  activeTab={activeTab}
                  activeSitePhotoSubtab={activeSitePhotoSubtab}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render carousel for Finished Site Photos
  const renderFinishedSitePhotosCarousel = () => {
    // Only show images in the carousel
    const imageFiles = filteredFiles.filter((file) =>
      file.mime_type.includes("image"),
    );

    if (imageFiles.length === 0) {
      return (
        <div className="bg-slate-50 rounded-lg p-8 border border-slate-200 text-center">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">No photos uploaded yet</p>
        </div>
      );
    }

    const currentImage = imageFiles[currentImageIndex];

    const goToPrevious = () => {
      setCurrentImageIndex((prevIndex) =>
        prevIndex === 0 ? imageFiles.length - 1 : prevIndex - 1,
      );
    };

    const goToNext = () => {
      setCurrentImageIndex((prevIndex) =>
        prevIndex === imageFiles.length - 1 ? 0 : prevIndex + 1,
      );
    };

    const goToImage = (index) => {
      setCurrentImageIndex(index);
    };

    return (
      <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
        {/* Main Carousel Display */}
        <div className="relative w-full mb-6">
          <div className="relative w-full h-[600px] bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
            {/* Previous Button */}
            {imageFiles.length > 1 && (
              <button
                onClick={goToPrevious}
                className="cursor-pointer absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white text-slate-700 rounded-full p-2 shadow-lg transition-all hover:scale-110"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Current Image */}
            <div
              className="relative w-full h-full cursor-pointer"
              onClick={() => handleViewExistingFile(currentImage)}
            >
              <Image
                src={`/${currentImage.url}`}
                alt={currentImage.filename}
                fill
                className="object-contain"
                priority={currentImageIndex === 0}
              />
            </div>

            {/* Next Button */}
            {imageFiles.length > 1 && (
              <button
                onClick={goToNext}
                className="cursor-pointer absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white text-slate-700 rounded-full p-2 shadow-lg transition-all hover:scale-110"
                aria-label="Next image"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Image Counter */}
            {imageFiles.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium">
                {currentImageIndex + 1} / {imageFiles.length}
              </div>
            )}
          </div>

          {/* Image Info */}
          <div className="mt-4 text-center">
            <p className="text-sm font-medium text-slate-700 mb-1">
              {currentImage.filename}
            </p>
            <p className="text-xs text-slate-500">
              {(currentImage.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        </div>

        {/* Thumbnail Navigation */}
        {imageFiles.length > 1 && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">
              All Photos ({imageFiles.length})
            </h4>
            <div className="flex overflow-x-auto pb-2">
              {imageFiles.map((file, index) => (
                <div
                  key={file.id}
                  className={`m-2 relative shrink-0 w-24 h-24 rounded-lg overflow-hidden cursor-pointer border-2 transition-all group ${
                    index === currentImageIndex
                      ? "border-secondary shadow-lg scale-105"
                      : "border-slate-300 hover:border-slate-400"
                  }`}
                  onClick={() => goToImage(index)}
                >
                  <Image
                    src={`/${file.url}`}
                    alt={file.filename}
                    fill
                    className="object-cover"
                  />
                  {/* Delete Button - Appears on Hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteFileConfirmation(file);
                    }}
                    disabled={isDeletingFile === file.id}
                    className="cursor-pointer absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-all z-10 p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm disabled:opacity-50"
                    title="Delete photo"
                  >
                    {isDeletingFile === file.id ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                    ) : (
                      <Trash className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Get tab notes for TextEditor
  const getTabNotes = () => {
    if (!selectedLotData?.tabs || !getTabEnum) return "";
    const tabEnum = getTabEnum(activeTab);
    const tab = selectedLotData.tabs.find(
      (tab) => tab.tab.toLowerCase() === tabEnum.toLowerCase(),
    );
    return tab?.notes || "";
  };

  // Reset carousel index when files change or tab changes
  useEffect(() => {
    if (activeTab === "finished_site_photos") {
      setCurrentImageIndex(0);
    }
  }, [filteredFiles, activeTab]);

  return (
    <div>
      {/* Display Existing Files First */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">
          Uploaded Files
        </h3>

        {activeTab === "finished_site_photos" ? (
          // Render carousel for Finished Site Photos
          renderFinishedSitePhotosCarousel()
        ) : filteredFiles.length > 0 ? (
          // Render grid for other tabs
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            {renderFileCategory("Images", images, false, "images")}
            {renderFileCategory("Videos", videos, false, "videos")}
            {renderFileCategory("PDFs", pdfs, true, "pdfs")}
            {renderFileCategory("Other Files", others, true, "others")}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-lg p-8 border border-slate-200 text-center">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">No files uploaded yet</p>
          </div>
        )}
      </div>

      {/* Upload New Files Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-700">
          Upload New Files
        </h3>

        {/* File Upload Area */}
        <div className="relative">
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Select Files {isSavingUpload && "(Uploading...)"}
          </label>
          <div
            className={`border-2 border-dashed border-slate-300 hover:border-secondary rounded-lg transition-all duration-200 bg-slate-50 hover:bg-slate-100 ${
              isSavingUpload ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <input
              type="file"
              multiple
              accept=".pdf,.dwg,.jpg,.jpeg,.png,.mp4,.mov"
              onChange={handleFileSelect}
              disabled={isSavingUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
            />
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              {isSavingUpload ? (
                <>
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-3"></div>
                  <p className="text-sm font-medium text-slate-700 mb-1">
                    Uploading files...
                  </p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center mb-3">
                    <FileUp className="w-6 h-6 text-secondary" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-slate-500">
                    PDF, DWG, JPG, PNG, MP4, or MOV
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Notes Section */}
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-3">Notes</h3>
        </div>
        <TextEditor
          initialContent={getTabNotes()}
          onSave={(content) => {
            if (handleNotesSave) {
              handleNotesSave(content);
            }
          }}
        />
      </div>

      {/* ViewMedia Modal */}
      {viewFileModal && selectedFile && (
        <ViewMedia
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          setViewFileModal={setViewFileModal}
          setPageNumber={setPageNumber}
          allFiles={selectedFile.allFiles || []}
          currentIndex={selectedFile.currentIndex || 0}
        />
      )}
    </div>
  );
}
