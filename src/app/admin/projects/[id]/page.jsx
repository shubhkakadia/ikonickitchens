"use client";
import React, { useEffect, useRef } from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
import { useParams } from "next/navigation";
import TabsController from "@/components/tabscontroller";
import {
  ChevronLeft,
  Edit,
  Trash2,
  User,
  AlertTriangle,
  Plus,
  X,
  Check,
  Trash,
  PanelsTopLeft,
  FileUp,
  FileText,
  File,
  ChevronDown,
  SquareArrowOutUpRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast, ToastContainer } from "react-toastify";
import axios from "axios";
import { useState } from "react";
import { CiMenuKebab } from "react-icons/ci";
import { useRouter } from "next/navigation";
import { useDispatch } from "react-redux";
import { addTab, replaceTab } from "@/state/reducer/tabs";
import { v4 as uuidv4 } from "uuid";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import { tabs } from "@/components/constants";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import StageTable from "../components/StageTable";
import TextEditor from "@/components/TextEditor/TextEditor";
import MaterialSelection from "../components/MaterialSelection";
import Image from "next/image";
import SiteMeasurementsSection from "../components/SiteMeasurement";
import ViewMedia from "../components/ViewMedia";
import MaterialsToOrder from "../components/MaterialsToOrder";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function page() {
  const { id } = useParams();
  const { getToken } = useAuth();
  const router = useRouter();
  const dispatch = useDispatch();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editData, setEditData] = useState({});
  const [isProjectEditing, setIsProjectEditing] = useState(false);
  const [projectEditData, setProjectEditData] = useState({});
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [showDeleteLotModal, setShowDeleteLotModal] = useState(false);
  const [isDeletingLot, setIsDeletingLot] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [selectedLot, setSelectedLot] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedLotData, setSelectedLotData] = useState(null);

  // Client assignment states
  const [clients, setClients] = useState([]);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [isAssigningClient, setIsAssigningClient] = useState(false);

  // Lot creation states
  const [showAddLotForm, setShowAddLotForm] = useState(false);
  const [newLot, setNewLot] = useState({
    lotId: "",
    name: "",
    startDate: "",
    installationDueDate: "",
    notes: "",
  });
  const [isCreatingLot, setIsCreatingLot] = useState(false);

  // files upload states
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [viewFileModal, setViewFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.0);
  const [currentPageInView, setCurrentPageInView] = useState(1);
  const [isDeletingFile, setIsDeletingFile] = useState(null);
  const [uploadNotes, setUploadNotes] = useState("");
  const [isSavingUpload, setIsSavingUpload] = useState(false);

  const [showDeleteFileModal, setShowDeleteFileModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);

  // Notes auto-save debouncing states
  const [notesSavedIndicators, setNotesSavedIndicators] = useState(false);
  const notesDebounceTimer = useRef(null);

  // Status dropdown state
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const statusDropdownRef = useRef(null);

  const fetchProject = async () => {
    try {
      setLoading(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      const response = await axios.get(`/api/project/${id}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        setProject(response.data.data);
        setSelectedLot(
          response.data.data?.lots && response.data.data.lots.length > 0
            ? response.data.data.lots[0]
            : {}
        );
      } else {
        setError(response.data.message || "Failed to fetch project data");
      }
    } catch (err) {
      console.error("API Error:", err);
      setError(
        err.response?.data?.message ||
          "An error occurred while fetching project data"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchLotData = async (forceRefresh = false) => {
    // Only prevent fetching if we already have the data for this lot and it's not a force refresh
    if (
      selectedLotData &&
      selectedLotData.lot_id === selectedLot?.lot_id &&
      !forceRefresh
    ) {
      return;
    }

    try {
      setLoading(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      const response = await axios.get(`/api/lot/${selectedLot.lot_id}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        setSelectedLotData(response.data.data ? response.data.data : {});
      } else {
        setError(response.data.message || "Failed to fetch lot data");
      }
    } catch (err) {
      console.error("API Error:", err);
      setError(
        err.response?.data?.message ||
          "An error occurred while fetching lot data"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const response = await axios.get("/api/client/allnames", {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        setClients(response.data.data || []);
      } else {
        toast.error(response.data.message || "Failed to fetch clients");
      }
    } catch (err) {
      console.error("API Error:", err);
      toast.error("Failed to fetch clients. Please try again.");
    }
  };

  const handleAssignClient = async (clientId) => {
    if (!project?.project_id) {
      toast.error("No project selected");
      return;
    }

    try {
      setIsAssigningClient(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const response = await axios.patch(
        `/api/project/${project.project_id}`,
        {
          name: project.name,
          client_id: clientId,
        },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status) {
        toast.success("Client assigned successfully");
        setShowClientDropdown(false);
        setClientSearchTerm("");
        // Refresh the project data to get updated client information
        fetchProject();
      } else {
        toast.error(response.data.message || "Failed to assign client");
      }
    } catch (error) {
      console.error("Error assigning client:", error);
      toast.error("Failed to assign client. Please try again.");
    } finally {
      setIsAssigningClient(false);
    }
  };

  const handleRemoveClient = async () => {
    if (!project?.project_id) {
      toast.error("No project selected");
      return;
    }

    if (!project.client) {
      toast.error("No client assigned to remove");
      return;
    }

    try {
      setIsAssigningClient(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const response = await axios.patch(
        `/api/project/${project.project_id}`,
        {
          name: project.name,
          client_id: null, // Remove client assignment
        },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status) {
        toast.success("Client removed successfully");
        // Refresh the project data to get updated client information
        fetchProject();
      } else {
        toast.error(response.data.message || "Failed to remove client");
      }
    } catch (error) {
      console.error("Error removing client:", error);
      toast.error("Failed to remove client. Please try again.");
    } finally {
      setIsAssigningClient(false);
    }
  };

  const handleCreateLot = async () => {
    if (!newLot.name.trim()) {
      toast.error("Please enter a lot name");
      return;
    }

    if (!newLot.lotId.trim()) {
      toast.error("Please enter a lot ID");
      return;
    }

    try {
      setIsCreatingLot(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const lotData = {
        lot_id: `${id.toUpperCase()}-${newLot.lotId.trim()}`,
        name: newLot.name.trim(),
        project_id: id.toUpperCase(),
        startDate: newLot.startDate || "",
        installationDueDate: newLot.installationDueDate || "",
        notes: newLot.notes || "",
      };

      const response = await axios.post(
        "/api/lot/create",
        JSON.stringify(lotData),
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status) {
        toast.success("Lot created successfully");
        setShowAddLotForm(false);
        setNewLot({
          lotId: "",
          name: "",
          startDate: "",
          installationDueDate: "",
          notes: "",
        });
        // Reload the page to refresh project data
        window.location.reload();
      } else {
        toast.error(response.data.message || "Failed to create lot");
      }
    } catch (error) {
      console.error("Error creating lot:", error);
      toast.error("Failed to create lot. Please try again.");
    } finally {
      setIsCreatingLot(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchProject();
    }
  }, [id]); // Removed getToken from dependencies to prevent infinite re-renders

  useEffect(() => {
    if (selectedLot && selectedLot.lot_id) {
      fetchLotData();
    }
  }, [selectedLot?.lot_id]); // Only depend on lot_id to prevent unnecessary calls

  useEffect(() => {
    fetchClients();
  }, []); // Fetch clients on component mount

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (notesDebounceTimer.current) {
        clearTimeout(notesDebounceTimer.current);
      }
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close "More Actions" dropdown when clicking outside
      if (showDropdown && !event.target.closest(".dropdown-container")) {
        setShowDropdown(false);
      }

      // Close client dropdown when clicking outside
      if (showClientDropdown && !event.target.closest(".client-dropdown")) {
        setShowClientDropdown(false);
        setClientSearchTerm("");
      }

      // Close status dropdown when clicking outside
      if (
        showStatusDropdown &&
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(event.target)
      ) {
        setShowStatusDropdown(false);
      }
    };

    if (showDropdown || showClientDropdown || showStatusDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showDropdown, showClientDropdown, showStatusDropdown]);

  const handleDeleteLotConfirm = async () => {
    try {
      setIsDeletingLot(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }
      const response = await axios.delete(`/api/lot/${selectedLot.lot_id}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });
      if (response.data.status) {
        toast.success("Lot deleted successfully");
        setShowDeleteLotModal(false);
        window.location.reload();
      } else {
        toast.error(response.data.message || "Failed to delete lot");
      }
    } catch (error) {
      console.error("Error deleting lot:", error);
      toast.error("Failed to delete lot. Please try again.");
    } finally {
      setIsDeletingLot(false);
    }
  };

  const handleDeleteProjectConfirm = async () => {
    try {
      setIsDeletingProject(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const response = await axios.delete(`/api/project/${id}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        toast.success("Project deleted successfully");
        setShowDeleteProjectModal(false);
        // Navigate back to projects list
        window.location.href = "/admin/projects";
      } else {
        toast.error(response.data.message || "Failed to delete project");
      }
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project. Please try again.");
    } finally {
      setIsDeletingProject(false);
    }
  };

  const handleEdit = () => {
    if (selectedLotData) {
      setEditData({
        name: selectedLotData.name || "",
        startDate: selectedLotData.startDate || "",
        installationDueDate: selectedLotData.installationDueDate || "",
        notes: selectedLotData.notes || "",
      });
    }
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIsProjectEditing(false);
  };

  const handleProjectSave = async () => {
    try {
      setIsUpdating(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }
      const response = await axios.patch(
        `/api/project/${id}`,
        projectEditData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (response.data.status) {
        toast.success("Project updated successfully");
        setIsProjectEditing(false);
        setProjectEditData({});
        window.location.reload();
      } else {
        toast.error(response.data.message || "Failed to update project");
      }
    } catch (error) {
      console.error("Error updating project:", error);
      toast.error("Failed to update project. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsUpdating(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      if (selectedLotData?.lot_id) {
        // Update lot information
        const response = await axios.patch(
          `/api/lot/${selectedLotData.lot_id}`,
          editData,
          {
            headers: {
              Authorization: `Bearer ${sessionToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.data.status) {
          toast.success("Lot updated successfully");
          // Refresh the lot data to get updated information
          fetchLotData(true);
        } else {
          toast.error(response.data.message || "Failed to update lot");
          return;
        }
      }

      setIsEditing(false);
      setEditData({});
    } catch (error) {
      console.error("Error updating lot:", error);
      toast.error("Failed to update lot. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle status update
  const handleStatusUpdate = async (newStatus) => {
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const response = await axios.patch(
        `/api/lot/${selectedLotData.lot_id}`,
        { status: newStatus },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status) {
        toast.success("Lot status updated successfully");
        setSelectedLotData((prev) => ({
          ...prev,
          status: newStatus,
        }));
        setShowStatusDropdown(false);
        fetchLotData(true);
      } else {
        toast.error(response.data.message || "Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status. Please try again.");
    }
  };

  // Function to validate date inputs
  const validateDateInput = (startDate, endDate, fieldChanged) => {
    if (!startDate || !endDate) return true;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (fieldChanged === "startDate" && start > end) {
      toast.error("Start date cannot be set after end date", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
      return false;
    }

    if (fieldChanged === "endDate" && end < start) {
      toast.error("End date cannot be set before start date", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
      return false;
    }

    return true;
  };

  const filteredClients = clients.filter(
    (client) =>
      client.client_name
        .toLowerCase()
        .includes(clientSearchTerm.toLowerCase()) ||
      client.client_id.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      client.client_type.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  // Tab to enum mapping
  const getTabEnum = (tabId) => {
    const tabEnumMap = {
      architecture_drawings: "ARCHITECTURE_DRAWINGS",
      appliances_specifications: "APPLIANCES_SPECIFICATIONS",
      cabinetry_drawings: "CABINETRY_DRAWINGS",
      changes_to_do: "CHANGES_TO_DO",
      site_measurements: "SITE_MEASUREMENTS",
      material_selection: "MATERIAL_SELECTION",
    };
    return tabEnumMap[tabId] || "";
  };

  // Get category slug for upload URL
  const getCategorySlug = (category) => {
    const categoryMap = {
      ARCHITECTURE_DRAWINGS: "architecture_drawings",
      APPLIANCES_SPECIFICATIONS: "appliances_specifications",
      CABINETRY_DRAWINGS: "cabinetry_drawings",
      CHANGES_TO_DO: "changes_to_do",
      SITE_MEASUREMENTS: "site_measurements",
    };
    return categoryMap[category] || category.toLowerCase();
  };

  // Get files for current tab from lot data
  const getCurrentTabFiles = () => {
    if (!selectedLotData?.tabs || !activeTab) {
      return [];
    }

    const tabEnum = getTabEnum(activeTab);
    const currentTab = selectedLotData.tabs.find(
      (tab) => tab.tab.toLowerCase() === tabEnum.toLowerCase()
    );

    return currentTab?.files || [];
  };

  // Upload files function
  const handleUploadFiles = async (filesToUpload = null) => {
    const files = filesToUpload || uploadedFiles;

    try {
      setIsSavingUpload(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      if (!selectedLotData?.lot_id || !id) {
        toast.error("Project or lot information missing");
        return;
      }

      if (!files || files.length === 0) {
        toast.error("No files selected");
        return;
      }

      const tabEnum = getTabEnum(activeTab);
      const categorySlug = getCategorySlug(tabEnum);

      const formData = new FormData();

      files.forEach((file) => {
        formData.append("file", file);
      });

      if (uploadNotes) {
        formData.append("notes", uploadNotes);
      }

      const apiUrl = `/api/uploads/lots/${id.toUpperCase()}/${
        selectedLotData.lot_id
      }/${categorySlug}`;

      const response = await axios.post(apiUrl, formData, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.status) {
        toast.success(`Files uploaded successfully`);
        setUploadedFiles([]);
        setUploadNotes("");
        // Refresh lot data to get updated files
        fetchLotData(true);
      } else {
        toast.error(response.data.message || `Failed to upload files`);
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      toast.error("Failed to upload files. Please try again.");
    } finally {
      setIsSavingUpload(false);
    }
  };

  // View existing file from server
  const handleViewExistingFile = (file) => {
    const fileUrl = `/${file.url}`;
    setSelectedFile({
      name: file.filename,
      type: file.mime_type,
      size: file.size,
      url: fileUrl,
      isExisting: true,
    });
    setViewFileModal(true);
  };

  // Handle file selection - upload immediately
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Upload files immediately
    await handleUploadFiles(files);

    // Reset the input so the same file can be selected again if needed
    e.target.value = "";
  };

  // Function to open delete confirmation
  const openDeleteFileConfirmation = (file) => {
    setFileToDelete(file);
    setShowDeleteFileModal(true);
  };

  // Updated delete handler
  const handleDeleteFile = async () => {
    if (!fileToDelete) return;

    try {
      setIsDeletingFile(fileToDelete.id);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      // Calculate tabEnum from activeTab
      const tabEnum = getTabEnum(activeTab);

      const response = await axios.delete(
        `/api/uploads/lots/${id.toUpperCase()}/${
          selectedLotData.lot_id
        }/${getCategorySlug(tabEnum)}/${fileToDelete.filename}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (response.data.status) {
        toast.success("File deleted successfully");
        setShowDeleteFileModal(false);
        setFileToDelete(null);
        // Refresh lot data to get updated files
        fetchLotData(true);
      } else {
        toast.error(response.data.message || "Failed to delete file");
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file. Please try again.");
    } finally {
      setIsDeletingFile(null);
    }
  };

  // Existing Files Display Component with Categorization
  const ExistingFilesSection = () => {
    const existingFiles = getCurrentTabFiles();

    // State for collapsed/expanded sections
    const [expandedSections, setExpandedSections] = React.useState({
      images: false,
      videos: false,
      pdfs: false,
      others: false,
    });

    const toggleSection = (section) => {
      setExpandedSections((prev) => ({
        ...prev,
        [section]: !prev[section],
      }));
    };

    // Categorize files by type
    const categorizeFiles = () => {
      const images = [];
      const videos = [];
      const pdfs = [];
      const others = [];

      existingFiles.forEach((file) => {
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

    // File Category Section Component
    const FileCategorySection = ({
      title,
      files,
      isSmall = false,
      sectionKey,
    }) => {
      if (files.length === 0) return null;

      const isExpanded = expandedSections[sectionKey];

      return (
        <div className="mb-4">
          {/* Category Header with Toggle */}
          <button
            onClick={() => toggleSection(sectionKey)}
            className="w-full flex items-center justify-between text-sm font-semibold text-slate-700 mb-3 hover:text-slate-900 transition-colors"
          >
            <span>
              {title} ({files.length})
            </span>
            <div
              className={`transform transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
            >
              <ChevronDown className="w-4 h-4" />
            </div>
          </button>

          {/* Collapsible Content */}
          {isExpanded && (
            <div className="flex flex-wrap gap-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  onClick={() => handleViewExistingFile(file)}
                  title="Click to view file"
                  className={`cursor-pointer relative bg-white border border-slate-200 rounded-lg p-3 hover:shadow-md transition-all group ${
                    isSmall ? "w-32" : "w-40"
                  }`}
                >
                  {/* File Preview */}
                  <div
                    className={`w-full ${
                      isSmall ? "aspect-[4/3]" : "aspect-square"
                    } rounded-lg flex items-center justify-center mb-2 overflow-hidden bg-slate-50`}
                  >
                    {file.mime_type.includes("image") ? (
                      <Image
                        height={100}
                        width={100}
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
                        className={`w-full h-full flex items-center justify-center rounded-lg ${
                          file.mime_type.includes("pdf")
                            ? "bg-red-50"
                            : "bg-green-50"
                        }`}
                      >
                        {file.mime_type.includes("pdf") ? (
                          <FileText
                            className={`${
                              isSmall ? "w-6 h-6" : "w-8 h-8"
                            } text-red-600`}
                          />
                        ) : (
                          <File
                            className={`${
                              isSmall ? "w-6 h-6" : "w-8 h-8"
                            } text-green-600`}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="space-y-1">
                    <p
                      className="text-xs font-medium text-slate-700 truncate"
                      title={file.filename}
                    >
                      {file.filename}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>

                  {/* Delete Button */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
              ))}
            </div>
          )}
        </div>
      );
    };

    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-700 mb-4">
          Uploaded Files
        </h3>

        {existingFiles.length > 0 ? (
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            {/* Images Section */}
            <FileCategorySection
              title="Images"
              files={images}
              isSmall={false}
              sectionKey="images"
            />

            {/* Videos Section */}
            <FileCategorySection
              title="Videos"
              files={videos}
              isSmall={false}
              sectionKey="videos"
            />

            {/* PDFs Section - Smaller cards */}
            <FileCategorySection
              title="PDFs"
              files={pdfs}
              isSmall={true}
              sectionKey="pdfs"
            />

            {/* Other Files Section - Smaller cards */}
            <FileCategorySection
              title="Other Files"
              files={others}
              isSmall={true}
              sectionKey="others"
            />
          </div>
        ) : (
          <div className="bg-slate-50 rounded-lg p-8 border border-slate-200 text-center">
            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <p className="text-slate-600">No files uploaded yet</p>
          </div>
        )}
      </div>
    );
  };

  // Upload Section Component
  const UploadSection = () => (
    <div>
      {/* Display Existing Files First */}
      <ExistingFilesSection />

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
          {/* <textarea
            value={selectedLotData?.tabs.find((tab) => tab.tab.toLowerCase() === activeTab.toLowerCase())?.notes || ""}
            onChange={(e) => setUploadNotes(e.target.value)}
            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent transition-all duration-200 resize-none bg-white hover:border-slate-400"
            placeholder="Add notes about the files..."
            rows="4"
          /> */}
        </div>
        <TextEditor
          initialContent={
            selectedLotData?.tabs.find(
              (tab) => tab.tab.toLowerCase() === activeTab.toLowerCase()
            )?.notes || ""
          }
          onSave={(content) => {
            handleNotesSave(content);
          }}
        />
      </div>
    </div>
  );

  // Debounced auto-save function for lot notes
  const saveLotNotes = async (notes) => {
    if (!selectedLotData?.lot_id) return;

    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const response = await axios.patch(
        `/api/lot/${selectedLotData.lot_id}`,
        {
          name: selectedLotData.name,
          startDate:
            selectedLotData.startDate && selectedLotData.startDate.trim() !== ""
              ? selectedLotData.startDate
              : null,
          installationDueDate:
            selectedLotData.installationDueDate &&
            selectedLotData.installationDueDate.trim() !== ""
              ? selectedLotData.installationDueDate
              : null,
          notes: notes,
        },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status) {
        // Show saved indicator
        setNotesSavedIndicators(true);
        setTimeout(() => {
          setNotesSavedIndicators(false);
        }, 2000);
      } else {
        toast.error(response.data.message || "Failed to save notes");
      }
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("Failed to save notes. Please try again.");
    }
  };

  // Debounced handler for lot notes changes
  const handleLotNotesChange = (value) => {
    // Update local state immediately
    setSelectedLotData((prevData) => ({
      ...prevData,
      notes: value,
    }));

    // Clear existing timer
    if (notesDebounceTimer.current) {
      clearTimeout(notesDebounceTimer.current);
    }

    // Set new timer (1 second debounce, same as StageTable.jsx)
    notesDebounceTimer.current = setTimeout(() => {
      saveLotNotes(value);
      notesDebounceTimer.current = null;
    }, 1000);
  };

  const handleNotesSave = async (content) => {
    try {
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }
      let response;
      // if lot_tab exists, update it, otherwise create it
      const lotTab = selectedLotData.tabs.find(
        (tab) => tab.tab.toLowerCase() === activeTab.toLowerCase()
      );
      if (lotTab) {
        response = await axios.patch(
          `/api/lot_tab_notes/${lotTab.id}`,
          { notes: content },
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
      } else {
        response = await axios.post(
          `/api/lot_tab_notes/create`,
          {
            lot_id: selectedLotData.lot_id,
            tab: activeTab.toUpperCase(),
            notes: content,
          },
          { headers: { Authorization: `Bearer ${sessionToken}` } }
        );
      }
      if (response.data.status) {
        // Preserve scroll position before state update
        const scrollY = window.scrollY;
        const scrollX = window.scrollX;

        // Update local state instead of refetching to prevent page reload
        // Only update if we need to (new tab created) or if ID changed
        const existingTab = selectedLotData.tabs.find(
          (tab) => tab.tab.toLowerCase() === activeTab.toLowerCase()
        );
        const isNewTab = !existingTab;
        const needsIdUpdate =
          existingTab &&
          response.data.data?.id &&
          existingTab.id !== response.data.data.id;

        if (isNewTab || needsIdUpdate) {
          setSelectedLotData((prevData) => {
            if (!prevData || !prevData.tabs) return prevData;

            const updatedTabs = [...prevData.tabs];
            const existingTabIndex = updatedTabs.findIndex(
              (tab) => tab.tab.toLowerCase() === activeTab.toLowerCase()
            );

            if (existingTabIndex >= 0) {
              // Update existing tab (only if ID changed)
              if (needsIdUpdate) {
                updatedTabs[existingTabIndex] = {
                  ...updatedTabs[existingTabIndex],
                  notes: content,
                  id: response.data.data.id,
                };
              } else {
                return prevData; // No change needed
              }
            } else {
              // Add new tab
              updatedTabs.push({
                id: response.data.data?.id,
                lot_id: selectedLotData.lot_id,
                tab: activeTab.toUpperCase(),
                notes: content,
              });
            }

            return {
              ...prevData,
              tabs: updatedTabs,
            };
          });

          // Restore scroll position after state update
          // Use both requestAnimationFrame and setTimeout to ensure it works after React re-renders
          requestAnimationFrame(() => {
            setTimeout(() => {
              window.scrollTo(scrollX, scrollY);
            }, 0);
          });
        }
      } else {
        toast.error(response.data.message || "Failed to save notes");
      }
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("Failed to save notes");
    }
  };

  return (
    <AdminRoute>
      <div className="flex h-screen bg-tertiary">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CRMLayout />
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-secondary mx-auto mb-4"></div>
                  <p className="text-slate-600">Loading project details...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-red-600 mb-4">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="btn-primary"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : !project ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <PanelsTopLeft className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">Project not found</p>
                </div>
              </div>
            ) : (
              <div className="p-4">
                <div className="flex items-center gap-4 mb-4">
                  <TabsController href="/admin/projects" title="Projects">
                    <div className="cursor-pointer p-2 hover:bg-slate-200 rounded-lg transition-colors">
                      <ChevronLeft className="w-6 h-6 text-slate-600" />
                    </div>
                  </TabsController>
                  <div className="flex-1 flex items-center gap-2">
                    {isProjectEditing ? (
                      <input
                        type="text"
                        value={projectEditData.name || project.name}
                        onChange={(e) =>
                          setProjectEditData({
                            ...projectEditData,
                            name: e.target.value,
                          })
                        }
                        className="text-2xl font-bold text-slate-600 border border-slate-300 rounded-lg p-2"
                        placeholder="Enter project name"
                      />
                    ) : (
                      <h1 className="text-2xl font-bold text-slate-600">
                        {project.name}
                      </h1>
                    )}
                    {!isEditing && project.lots && project.lots.length > 0 && (
                      <select
                        className="text-sm text-slate-600 cursor-pointer border border-slate-300 rounded-lg p-2"
                        value={selectedLot?.id || ""}
                        onChange={(e) => {
                          setSelectedLot(
                            project.lots?.find(
                              (lot) => lot.id === e.target.value
                            )
                          );
                        }}
                      >
                        {project.lots?.map((lot) => (
                          <option key={lot.id} value={lot.id}>
                            {lot.lot_id}
                          </option>
                        ))}
                      </select>
                    )}
                    {isEditing && project.lots && project.lots.length > 0 && (
                      <span className="text-sm bg-slate-200 rounded-lg p-2 text-slate-600">
                        {selectedLot?.lot_id || "Not specified"}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!isEditing && !isProjectEditing ? (
                      <div className="relative dropdown-container">
                        <button
                          onClick={() => setShowDropdown(!showDropdown)}
                          className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <CiMenuKebab className="w-4 h-4 text-slate-600" />
                          <span className="text-slate-600">More Actions</span>
                        </button>

                        {showDropdown && (
                          <div className="absolute right-0 mt-2 w-50 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  setIsProjectEditing(true);
                                  setShowDropdown(false);
                                }}
                                className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-3"
                              >
                                <Edit className="w-4 h-4" />
                                Edit Project Name
                              </button>
                              <button
                                onClick={() => {
                                  handleEdit();
                                  setShowDropdown(false);
                                }}
                                className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-3"
                              >
                                <Edit className="w-4 h-4" />
                                Edit Project Details
                              </button>

                              <button
                                onClick={() => {
                                  setShowAddLotForm(true);
                                  setShowDropdown(false);
                                }}
                                className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-3"
                              >
                                <Plus className="w-4 h-4" />
                                Add Lot
                              </button>

                              <button
                                onClick={() => {
                                  setShowDeleteLotModal(true);
                                  setShowDropdown(false);
                                }}
                                className="cursor-pointer w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center gap-3"
                              >
                                <Trash className="w-4 h-4" />
                                Delete Lot:{" "}
                                {selectedLot?.lot_id || "Not specified"}
                              </button>

                              <button
                                onClick={() => {
                                  setShowDeleteProjectModal(true);
                                  setShowDropdown(false);
                                }}
                                className="cursor-pointer w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center gap-3"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete Project
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={
                            isProjectEditing ? handleProjectSave : handleSave
                          }
                          disabled={isUpdating}
                          className="cursor-pointer btn-primary flex items-center gap-2"
                        >
                          <Edit className="w-4 h-4" />
                          {isUpdating ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={handleCancel}
                          className="cursor-pointer btn-secondary flex items-center gap-2"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Project Tabs Navigation */}
                {project.lots && project.lots.length > 0 && (
                  <div className="mb-6">
                    <div className="border-b border-slate-200">
                      <nav className="-mb-px flex space-x-8 overflow-x-auto">
                        {tabs.map((tab) => (
                          <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`cursor-pointer py-2 border-b-2 font-medium text-sm transition-colors ${
                              activeTab === tab.id
                                ? "border-secondary text-secondary"
                                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </nav>
                    </div>
                  </div>
                )}

                {/* Tab Content */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                  {(activeTab === "overview" ||
                    !project.lots ||
                    project.lots.length === 0) && (
                    <div>
                      <h2 className="text-xl font-semibold text-slate-700 mb-4">
                        Project Overview
                      </h2>

                      {project.lots && project.lots.length > 0 ? (
                        selectedLot && selectedLotData ? (
                          <>
                            {/* Top Section - 3 Grid Items */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                              {/* Lot Information */}
                              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                                <h3 className="text-lg font-bold text-slate-800 mb-3">
                                  Lot Information
                                </h3>
                                <div className="space-y-2">
                                  <div>
                                    <label className="text-xs font-medium text-slate-600">
                                      Name
                                    </label>
                                    <div className="flex items-center gap-2 mt-1">
                                      {isEditing ? (
                                        <input
                                          type="text"
                                          value={
                                            editData.name ||
                                            selectedLotData.name ||
                                            ""
                                          }
                                          onChange={(e) =>
                                            setEditData({
                                              ...editData,
                                              name: e.target.value,
                                            })
                                          }
                                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                                          placeholder="Enter lot name"
                                        />
                                      ) : (
                                        <p className="flex-1 text-sm text-slate-900">
                                          {selectedLotData.name ||
                                            "Not specified"}
                                        </p>
                                      )}
                                      {!isEditing && (
                                        <div
                                          className="relative"
                                          ref={statusDropdownRef}
                                        >
                                          <button
                                            onClick={() =>
                                              setShowStatusDropdown(
                                                !showStatusDropdown
                                              )
                                            }
                                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                                              selectedLotData.status ===
                                              "COMPLETED"
                                                ? "bg-green-100 text-green-800 border-green-200 hover:bg-green-200"
                                                : "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200"
                                            }`}
                                          >
                                            <span>
                                              {selectedLotData.status ===
                                              "COMPLETED"
                                                ? "Completed"
                                                : "Active"}
                                            </span>
                                            <ChevronDown
                                              className={`w-3 h-3 transition-transform ${
                                                showStatusDropdown
                                                  ? "rotate-180"
                                                  : ""
                                              }`}
                                            />
                                          </button>
                                          {showStatusDropdown && (
                                            <div className="absolute right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[120px]">
                                              <button
                                                onClick={() =>
                                                  handleStatusUpdate("ACTIVE")
                                                }
                                                className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors ${
                                                  selectedLotData.status ===
                                                  "ACTIVE"
                                                    ? "bg-blue-50 text-blue-800"
                                                    : "text-slate-700"
                                                }`}
                                              >
                                                Active
                                              </button>
                                              <button
                                                onClick={() =>
                                                  handleStatusUpdate(
                                                    "COMPLETED"
                                                  )
                                                }
                                                className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-slate-50 transition-colors ${
                                                  selectedLotData.status ===
                                                  "COMPLETED"
                                                    ? "bg-green-50 text-green-800"
                                                    : "text-slate-700"
                                                }`}
                                              >
                                                Completed
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      {isEditing && (
                                        <span
                                          className={`px-2.5 py-1.5 rounded-full text-xs font-medium border ${
                                            selectedLotData.status ===
                                            "COMPLETED"
                                              ? "bg-green-100 text-green-800 border-green-200"
                                              : "bg-blue-100 text-blue-800 border-blue-200"
                                          }`}
                                        >
                                          {selectedLotData.status ===
                                          "COMPLETED"
                                            ? "Completed"
                                            : "Active"}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-xs font-medium text-slate-600">
                                        Start Date
                                      </label>
                                      {isEditing ? (
                                        <input
                                          type="date"
                                          value={
                                            editData.startDate ||
                                            selectedLotData.startDate ||
                                            ""
                                          }
                                          onChange={(e) =>
                                            setEditData({
                                              ...editData,
                                              startDate: e.target.value,
                                            })
                                          }
                                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent mt-1"
                                        />
                                      ) : (
                                        <p className="text-sm text-slate-900 mt-1">
                                          {selectedLotData.startDate
                                            ? new Date(
                                                selectedLotData.startDate
                                              ).toLocaleDateString("en-AU", {
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                              })
                                            : "Not set"}
                                        </p>
                                      )}
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium text-slate-600">
                                        Installation Due Date
                                      </label>
                                      {isEditing ? (
                                        <input
                                          type="date"
                                          value={
                                            editData.installationDueDate ||
                                            selectedLotData.installationDueDate ||
                                            ""
                                          }
                                          onChange={(e) =>
                                            setEditData({
                                              ...editData,
                                              installationDueDate:
                                                e.target.value,
                                            })
                                          }
                                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent mt-1"
                                        />
                                      ) : (
                                        <p className="text-sm text-slate-900 mt-1">
                                          {selectedLotData.installationDueDate
                                            ? new Date(
                                                selectedLotData.installationDueDate
                                              ).toLocaleDateString("en-AU", {
                                                year: "numeric",
                                                month: "long",
                                                day: "numeric",
                                              })
                                            : "Not set"}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Client Information */}
                              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                                <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                                  <User className="w-4 h-4" />
                                  Client Information
                                </h3>

                                {project.client ? (
                                  <div className="space-y-2">
                                    <div>
                                      <label className="text-xs font-medium text-slate-600">
                                        Name
                                      </label>
                                      <div className="flex items-center gap-2 mt-1">
                                        <div className="flex-1">
                                          <button
                                            onClick={() => {
                                              const clientHref = `/admin/clients/${project.client.client_id}`;
                                              router.push(clientHref);
                                              dispatch(
                                                replaceTab({
                                                  id: uuidv4(),
                                                  title:
                                                    project.client.client_name,
                                                  href: clientHref,
                                                })
                                              );
                                            }}
                                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                                          >
                                            {project.client.client_name}
                                          </button>
                                          <p className="text-xs text-slate-500 mt-0.5">
                                            ID: {project.client.client_id}
                                          </p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const clientHref = `/admin/clients/${project.client.client_id}`;
                                              dispatch(
                                                addTab({
                                                  id: uuidv4(),
                                                  title:
                                                    project.client.client_name,
                                                  href: clientHref,
                                                })
                                              );
                                            }}
                                            className="p-1.5 rounded hover:bg-slate-100 transition-colors duration-200 cursor-pointer"
                                            title="Open client in new tab"
                                          >
                                            <SquareArrowOutUpRight className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                                          </button>
                                          {!isEditing && (
                                            <>
                                              <button
                                                onClick={() => {
                                                  fetchClients();
                                                  setShowClientDropdown(true);
                                                  setClientSearchTerm("");
                                                }}
                                                className="p-1.5 rounded hover:bg-blue-100 transition-colors duration-200 cursor-pointer"
                                                title="Change Client"
                                              >
                                                <Edit className="w-4 h-4 text-blue-600" />
                                              </button>
                                              <button
                                                onClick={handleRemoveClient}
                                                disabled={isAssigningClient}
                                                className="p-1.5 rounded hover:bg-red-100 transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                                title="Remove Client"
                                              >
                                                <X className="w-4 h-4 text-red-600" />
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium text-slate-600">
                                        Email
                                      </label>
                                      <p className="text-sm text-slate-900 mt-1">
                                        {project.client.client_email ||
                                          "No email"}
                                      </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-xs font-medium text-slate-600">
                                          Phone
                                        </label>
                                        <p className="text-sm text-slate-900 mt-1">
                                          {project.client.client_phone ||
                                            "No phone"}
                                        </p>
                                      </div>
                                      <div>
                                        <label className="text-xs font-medium text-slate-600">
                                          Type
                                        </label>
                                        <p className="text-sm text-slate-900 mt-1 capitalize">
                                          {project.client.client_type}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center py-6 text-slate-500">
                                    <User className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                                    <p className="text-sm mb-3">
                                      No client assigned
                                    </p>
                                    <button
                                      onClick={() => {
                                        fetchClients();
                                        setShowClientDropdown(true);
                                        setClientSearchTerm("");
                                      }}
                                      className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium"
                                    >
                                      <Plus className="w-4 h-4" />
                                      Assign Client
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Notes Section */}
                              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                                <h3 className="text-lg font-bold text-slate-800 mb-3">
                                  Notes
                                </h3>

                                <textarea
                                  value={selectedLotData.notes || ""}
                                  onChange={(e) =>
                                    handleLotNotesChange(e.target.value)
                                  }
                                  className="w-full px-2 py-1 border border-transparent rounded hover:border-slate-300 focus:border-secondary focus:outline-none bg-transparent resize-none"
                                  rows="5"
                                  placeholder="Add notes"
                                />
                                {notesSavedIndicators && (
                                  <span className="text-xs text-green-600 font-medium block mt-1">
                                    Saved!
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Stages Section - Full Width */}
                            <StageTable
                              selectedLotData={selectedLotData}
                              getToken={getToken}
                              fetchLotData={fetchLotData}
                              validateDateInput={validateDateInput}
                              updateLotData={setSelectedLotData}
                            />
                          </>
                        ) : (
                          <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary mx-auto mb-4"></div>
                            <p className="text-slate-600">
                              Loading lot details...
                            </p>
                          </div>
                        )
                      ) : (
                        <div className="text-center py-12">
                          <div className="mb-6">
                            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Plus className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">
                              No Lots Added
                            </h3>
                            <p className="text-slate-600 mb-6">
                              This project doesn't have any lots yet. Add a lot
                              to get started with project management.
                            </p>
                          </div>
                          <button
                            onClick={() => setShowAddLotForm(true)}
                            className="cursor-pointer flex items-center gap-2 px-6 py-3 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-base font-medium mx-auto"
                          >
                            <Plus className="w-5 h-5" />
                            Add First Lot
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {project.lots &&
                    project.lots.length > 0 &&
                    activeTab === "architecture_drawings" && (
                      <div>
                        <h2 className="text-xl font-semibold text-slate-700 mb-4">
                          Architecture Drawings
                        </h2>
                        <UploadSection />
                      </div>
                    )}

                  {project.lots &&
                    project.lots.length > 0 &&
                    activeTab === "appliances_specifications" && (
                      <div>
                        <h2 className="text-xl font-semibold text-slate-700 mb-4">
                          Appliances and Specifications
                        </h2>
                        <UploadSection />
                      </div>
                    )}

                  {project.lots &&
                    project.lots.length > 0 &&
                    activeTab === "material_selection" && (
                      <div>
                        <h2 className="text-xl font-semibold text-slate-700 mb-4">
                          Material Selection
                        </h2>
                        <MaterialSelection
                          lot_id={selectedLot?.lot_id}
                          project_id={id}
                        />
                      </div>
                    )}

                  {project.lots &&
                    project.lots.length > 0 &&
                    activeTab === "cabinetry_drawings" && (
                      <div>
                        <h2 className="text-xl font-semibold text-slate-700 mb-4">
                          Cabinetry Drawings
                        </h2>
                        <UploadSection />
                      </div>
                    )}

                  {project.lots &&
                    project.lots.length > 0 &&
                    activeTab === "changes_to_do" && (
                      <div>
                        <h2 className="text-xl font-semibold text-slate-700 mb-4">
                          Changes to Do
                        </h2>
                        <UploadSection />
                      </div>
                    )}

                  {project.lots &&
                    project.lots.length > 0 &&
                    activeTab === "site_measurements" && (
                      <div>
                        <h2 className="text-xl font-semibold text-slate-700 mb-4">
                          Site Measurements
                        </h2>
                        <SiteMeasurementsSection
                          selectedLotData={selectedLotData}
                          fetchLotData={fetchLotData}
                          handleNotesSave={handleNotesSave}
                          handleViewExistingFile={handleViewExistingFile}
                          openDeleteFileConfirmation={
                            openDeleteFileConfirmation
                          }
                          isDeletingFile={isDeletingFile}
                          activeTab={activeTab}
                          getCurrentTabFiles={getCurrentTabFiles}
                        />
                      </div>
                    )}
                  {project.lots &&
                    project.lots.length > 0 &&
                    activeTab === "materials_to_order" && (
                      <div>
                        <MaterialsToOrder
                          project={project}
                          selectedLot={selectedLot}
                        />
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Client Assignment Dropdown */}
        {showClientDropdown && (
          <div className="fixed inset-0 backdrop-blur-xs bg-opacity-50 flex items-center justify-center z-50">
            <div className="client-dropdown bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  Assign Client
                </h3>
                <button
                  onClick={() => {
                    setShowClientDropdown(false);
                    setClientSearchTerm("");
                  }}
                  className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search clients by name, ID, or type..."
                  value={clientSearchTerm}
                  onChange={(e) => setClientSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                  autoFocus
                />
              </div>

              <div className="max-h-64 overflow-y-auto">
                {filteredClients.length > 0 ? (
                  <div className="space-y-2">
                    {filteredClients.map((client) => (
                      <button
                        key={client.client_id}
                        onClick={() => handleAssignClient(client.client_id)}
                        disabled={isAssigningClient}
                        className="cursor-pointer w-full text-left p-3 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-slate-900">
                              {client.client_name}
                            </div>
                            <div className="text-sm text-slate-600">
                              ID: {client.client_id}
                            </div>
                            <div className="text-xs text-slate-500 capitalize">
                              Type: {client.client_type}
                            </div>
                          </div>
                          {isAssigningClient && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-secondary"></div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    <User className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm">No clients found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Add Lot Form Modal */}
        {showAddLotForm && (
          <div className="fixed inset-0 backdrop-blur-xs bg-opacity-50 flex items-center justify-center z-50">
            <div className="client-dropdown bg-white rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800">
                  Add New Lot
                </h3>
                <button
                  onClick={() => {
                    setShowAddLotForm(false);
                    setNewLot({
                      lotId: "",
                      name: "",
                      startDate: "",
                      installationDueDate: "",
                      notes: "",
                    });
                  }}
                  className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Lot ID *
                  </label>
                  <input
                    type="text"
                    value={newLot.lotId}
                    onChange={(e) =>
                      setNewLot({ ...newLot, lotId: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="e.g., 001"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Lot ID will be: {id.toUpperCase()}-{newLot.lotId || "XXX"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={newLot.name}
                    onChange={(e) =>
                      setNewLot({ ...newLot, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="e.g., John Doe"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={newLot.startDate}
                      onChange={(e) =>
                        setNewLot({ ...newLot, startDate: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-1">
                      Installation Due Date
                    </label>
                    <input
                      type="date"
                      value={newLot.installationDueDate}
                      onChange={(e) =>
                        setNewLot({
                          ...newLot,
                          installationDueDate: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={newLot.notes}
                    onChange={(e) =>
                      setNewLot({ ...newLot, notes: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent"
                    placeholder="e.g., finish as soon as possible"
                    rows="3"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleCreateLot}
                  disabled={
                    isCreatingLot || !newLot.name.trim() || !newLot.lotId.trim()
                  }
                  className="cursor-pointer flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingLot ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Create Lot
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowAddLotForm(false);
                    setNewLot({
                      lotId: "",
                      name: "",
                      startDate: "",
                      installationDueDate: "",
                      notes: "",
                    });
                  }}
                  className="cursor-pointer btn-secondary flex items-center gap-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* File View Modal */}
        {viewFileModal && selectedFile && (
          <ViewMedia
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            setViewFileModal={setViewFileModal}
            setPageNumber={setPageNumber}
          />
        )}

        <DeleteConfirmation
          isOpen={showDeleteLotModal}
          onClose={() => setShowDeleteLotModal(false)}
          onConfirm={handleDeleteLotConfirm}
          deleteWithInput={true}
          heading="Lot"
          message="This will permanently delete the lot and all associated data. This action cannot be undone."
          comparingName={selectedLot ? `${selectedLot.lot_id}` : ""}
          isDeleting={isDeletingLot}
        />

        <DeleteConfirmation
          isOpen={showDeleteProjectModal}
          onClose={() => setShowDeleteProjectModal(false)}
          onConfirm={handleDeleteProjectConfirm}
          deleteWithInput={true}
          heading="Project"
          message="This will permanently delete the project and all associated data. This action cannot be undone."
          comparingName={project ? `${project.name}` : ""}
          isDeleting={isDeletingProject}
        />

        {/* Delete File Confirmation Modal */}
        <DeleteConfirmation
          isOpen={showDeleteFileModal}
          onClose={() => {
            setShowDeleteFileModal(false);
            setFileToDelete(null);
          }}
          onConfirm={handleDeleteFile}
          deleteWithInput={true}
          heading="File"
          message="This will permanently delete this file. This action cannot be undone."
          comparingName={fileToDelete ? fileToDelete.filename : ""}
          isDeleting={isDeletingFile === fileToDelete?.id}
        />

        <ToastContainer />
      </div>
    </AdminRoute>
  );
}
