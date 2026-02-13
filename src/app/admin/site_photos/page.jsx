"use client";
import React, { useState, useEffect, useRef } from "react";
import { AdminRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-toastify";
import heic2any from "heic2any";
import { useUploadProgress } from "@/hooks/useUploadProgress";
import imageCompression from "browser-image-compression";
import {
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Video,
  FileText,
  X,
  Loader2,
  Camera,
  Save,
  ChevronLeft,
  ChevronRight,
  Send,
  Trash2,
  LogOut,
  Search,
  Phone,
  MessageSquare,
  HelpCircle,
  Settings,
  Download,
  StickyNote,
} from "lucide-react";

const TAB_KINDS = {
  DELIVERY: "delivery_photos",
  INSTALLATION: "installation_photos",
  MAINTENANCE: "maintenance_photos",
  SITE_PHOTOS: "site_photos",
  MEASUREMENT_PHOTOS: "measurement_photos",
};

const TAB_LABELS = {
  [TAB_KINDS.DELIVERY]: "Delivery",
  [TAB_KINDS.INSTALLATION]: "Installation",
  [TAB_KINDS.MAINTENANCE]: "Maintenance",
  [TAB_KINDS.SITE_PHOTOS]: "Site",
  [TAB_KINDS.MEASUREMENT_PHOTOS]: "Measurement",
};

// Map tab kind to actual tab name for API calls
const TAB_KIND_TO_API_TAB = {
  [TAB_KINDS.SITE_PHOTOS]: "site_measurements",
  [TAB_KINDS.MEASUREMENT_PHOTOS]: "site_measurements",
};

// Map tab kind to site_group for site measurements
const TAB_KIND_TO_SITE_GROUP = {
  [TAB_KINDS.SITE_PHOTOS]: "SITE_PHOTOS",
  [TAB_KINDS.MEASUREMENT_PHOTOS]: "MEASUREMENT_PHOTOS",
};

export default function SitePhotosPage() {
  const { getToken, logout, getUserData, getUserType } = useAuth();
  const router = useRouter();
  const {
    showProgressToast,
    completeUpload,
    dismissProgressToast,
    getUploadProgressHandler,
  } = useUploadProgress();
  const [lots, setLots] = useState([]);
  const [allLots, setAllLots] = useState([]); // Store all lots for filtering
  const [loading, setLoading] = useState(true);
  const [selectedLot, setSelectedLot] = useState(null); // Currently selected lot for detail view
  const [loadingLot, setLoadingLot] = useState(null); // Track which lot is loading data
  const [selectedPhotoType, setSelectedPhotoType] = useState(
    TAB_KINDS.DELIVERY,
  ); // Global photo type selector
  const [uploading, setUploading] = useState({});
  const [uploadProgressState, setUploadProgressState] = useState({});
  const [savingFileNotes, setSavingFileNotes] = useState({});
  const [fileNotes, setFileNotes] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingFileNotes, setEditingFileNotes] = useState({});
  const [deletingFile, setDeletingFile] = useState(null);
  const [pendingUploads, setPendingUploads] = useState(null); // { lot, tabKind, files: [{ file, notes, preview }], currentIndex }
  const [activeLotTab, setActiveLotTab] = useState({}); // Track active tab for each lot { [lotId]: 'cabinetry' | 'upload' }
  const [searchTerm, setSearchTerm] = useState("");
  const [employeeRole, setEmployeeRole] = useState(null);
  const [showSupportDropdown, setShowSupportDropdown] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [showPhotoTypeDropdown, setShowPhotoTypeDropdown] = useState(false);
  const [showNotesPopup, setShowNotesPopup] = useState(false);
  const [notificationConfig, setNotificationConfig] = useState({
    assign_installer: false,
  });
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  const [loadingImages, setLoadingImages] = useState({}); // Track loading state for each image
  const fileInputRefs = useRef({});
  const supportDropdownRef = useRef(null);
  const settingsDropdownRef = useRef(null);
  const photoTypeDropdownRef = useRef(null);

  useEffect(() => {
    fetchEmployeeRole();
    fetchActiveLots();
    fetchNotificationConfig();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        supportDropdownRef.current &&
        !supportDropdownRef.current.contains(event.target)
      ) {
        setShowSupportDropdown(false);
      }
      if (
        settingsDropdownRef.current &&
        !settingsDropdownRef.current.contains(event.target)
      ) {
        setShowSettingsDropdown(false);
      }
      if (
        photoTypeDropdownRef.current &&
        !photoTypeDropdownRef.current.contains(event.target)
      ) {
        setShowPhotoTypeDropdown(false);
      }
    };

    if (showSupportDropdown || showSettingsDropdown || showPhotoTypeDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSupportDropdown, showSettingsDropdown, showPhotoTypeDropdown]);

  const fetchEmployeeRole = async () => {
    try {
      const userData = getUserData();
      if (!userData?.user?.employee_id) {
        return; // Not an employee, no need to fetch role
      }

      const sessionToken = getToken();
      if (!sessionToken) {
        return;
      }

      const response = await axios.get(
        `/api/employee/${userData.user.employee_id}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );

      if (response.data.status && response.data.data) {
        setEmployeeRole(response.data.data.role);
      }
    } catch (error) {
      console.error("Error fetching employee role:", error);
      // Don't show error toast, just continue without role restriction
    }
  };

  // Filter lots based on search term (client name, project name, or project ID)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setLots(allLots);
    } else {
      const searchLower = searchTerm.toLowerCase();
      const filtered = allLots.filter((lot) => {
        const projectName = lot.project?.project_name?.toLowerCase() || "";
        const projectNameAlt = lot.project?.name?.toLowerCase() || "";
        const clientName =
          lot.project?.client?.client_name?.toLowerCase() || "";
        const projectId = lot.project?.project_id?.toLowerCase() || "";
        return (
          projectName.includes(searchLower) ||
          projectNameAlt.includes(searchLower) ||
          clientName.includes(searchLower) ||
          projectId.includes(searchLower)
        );
      });
      // Sort filtered results by lot_id using natural sort
      const sortedFiltered = filtered.sort((a, b) => {
        const lotIdA = (a.lot_id || a.id || "").toString();
        const lotIdB = (b.lot_id || b.id || "").toString();
        return lotIdA.localeCompare(lotIdB, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });
      setLots(sortedFiltered);
    }
  }, [searchTerm, allLots]);

  // Refetch lots when employee role is determined to be "installer" (for filtering)
  useEffect(() => {
    const userData = getUserData();
    const userType = getUserType();
    // Only refetch if user is an employee with installer role
    // Admin and masterAdmin users don't need to refetch based on role
    if (
      employeeRole?.toLowerCase() === "installer" &&
      userType === "employee" &&
      userData?.user?.employee_id
    ) {
      fetchActiveLots();
    }
  }, [employeeRole]);

  // Update selected photo type when employee role is loaded
  useEffect(() => {
    if (employeeRole !== null) {
      const allowedTabs = getAllowedTabs();
      const defaultTab = allowedTabs[0] || TAB_KINDS.DELIVERY;
      // Always update to ensure we have a valid selection
      // If current selection is not in allowed tabs, switch to default
      if (!allowedTabs.includes(selectedPhotoType)) {
        setSelectedPhotoType(defaultTab);
      }
    }
  }, [employeeRole]);

  // Safeguard: If selectedPhotoType is ever invalid for current user, reset it
  useEffect(() => {
    if (employeeRole !== null) {
      const allowedTabs = getAllowedTabs();
      if (selectedPhotoType && !allowedTabs.includes(selectedPhotoType)) {
        const defaultTab = allowedTabs[0] || TAB_KINDS.DELIVERY;
        setSelectedPhotoType(defaultTab);
      }
    }
  }, [selectedPhotoType, employeeRole]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/admin/login");
    } catch (error) {
      console.error("Error logging out:", error);
      toast.error("Failed to logout. Please try again.");
    }
  };

  const handleCallSupport = () => {
    window.location.href = "tel:+61452669964";
    setShowSupportDropdown(false);
  };

  const handleWhatsAppSupport = () => {
    // Format phone number for WhatsApp (remove spaces, parentheses, and add country code)
    const phoneNumber = "61452669964"; // Australian number format
    const message = encodeURIComponent(
      "Hello, I need support with the site photos application.",
    );
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank");
    setShowSupportDropdown(false);
  };

  const fetchNotificationConfig = async () => {
    try {
      setNotificationLoading(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        return;
      }

      const userId = getUserData()?.user?.id;
      if (!userId) return;

      const response = await axios.get(`/api/notification_config/${userId}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        setNotificationConfig({
          assign_installer: response.data.data.assign_installer || false,
        });
      }
    } catch (error) {
      console.error("Error fetching notification config:", error);
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleNotificationToggle = async () => {
    try {
      setIsUpdatingNotifications(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const userId = getUserData()?.user?.id;
      if (!userId) {
        toast.error("Unable to determine user ID");
        return;
      }

      const updatedConfig = {
        ...notificationConfig,
        assign_installer: !notificationConfig.assign_installer,
      };

      const response = await axios.patch(
        `/api/notification_config/${userId}`,
        updatedConfig,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status) {
        setNotificationConfig(updatedConfig);
        toast.success("Notification preference updated successfully!");
      } else {
        toast.error(
          response.data.message || "Failed to update notification preference",
        );
      }
    } catch (error) {
      console.error("Error updating notification config:", error);
      toast.error(
        error.response?.data?.message ||
          "Failed to update notification preference. Please try again.",
      );
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

  // Get allowed tabs based on employee role
  const getAllowedTabs = () => {
    if (employeeRole?.toLowerCase() === "installer") {
      return [TAB_KINDS.INSTALLATION, TAB_KINDS.MAINTENANCE];
    }
    // For all other roles, show all tabs
    return Object.values(TAB_KINDS);
  };

  const fetchActiveLots = async () => {
    try {
      setLoading(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const userData = getUserData();
      const userType = getUserType();

      // For admin or master-admin, we pass their user ID
      // For employees, we pass their employee_id
      let userId;
      if (userType === "master-admin" || userType === "admin") {
        userId = userData?.user?.id;
      } else if (userType === "employee" && userData?.user?.employee_id) {
        userId = userData.user.employee_id;
      }

      if (!userId) {
        toast.error("Unable to determine user ID. Please login again.");
        return;
      }

      const response = await axios.get(`/api/lot/installer/${userId}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        const lotsData = response.data.data;

        // Sort lots by lot_id using natural sort (handles alphanumeric strings like "ik001-lot 3")
        const sortedLots = lotsData.sort((a, b) => {
          const lotIdA = (a.lot_id || a.id || "").toString();
          const lotIdB = (b.lot_id || b.id || "").toString();
          return lotIdA.localeCompare(lotIdB, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        });

        setAllLots(sortedLots);
        setLots(sortedLots);

        // Initialize file notes state from existing files
        const fileNotesState = {};
        lotsData.forEach((lot) => {
          lot.tabs?.forEach((tab) => {
            tab.files?.forEach((file) => {
              fileNotesState[file.id] = file.notes || "";
            });
          });
        });
        setFileNotes(fileNotesState);

        // Don't set default photo type here to avoid race condition with employee role loading
        // The useEffect watching employeeRole will handle setting the default photo type
      } else {
        toast.error(response.data.message || "Failed to fetch lots");
      }
    } catch (error) {
      console.error("Error fetching active lots:", error);
      toast.error("Failed to fetch active lots. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchLotDetails = async (lotId) => {
    try {
      setLoadingLot(lotId);
      const sessionToken = getToken();
      if (!sessionToken) return;

      const response = await axios.get(`/api/lot/${lotId}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        const lotData = response.data.data;
        setLots((prevLots) =>
          prevLots.map((lot) => (lot.id === lotId ? lotData : lot)),
        );

        // Update file notes state
        const fileNotesState = { ...fileNotes };
        lotData.tabs?.forEach((tab) => {
          tab.files?.forEach((file) => {
            fileNotesState[file.id] = file.notes || "";
          });
        });
        setFileNotes(fileNotesState);
      }
    } catch (error) {
      console.error("Error fetching lot details:", error);
    } finally {
      setLoadingLot(null);
    }
  };

  const selectLot = (lot) => {
    // Open the selected lot in detail view
    setSelectedLot(lot);
    // Set default tab to cabinetry if not already set
    if (!activeLotTab[lot.id]) {
      setActiveLotTab((prev) => ({ ...prev, [lot.id]: "cabinetry" }));
    }
    // Fetch detailed lot data in the background (don't await)
    fetchLotDetails(lot.id);
  };

  const goBackToList = () => {
    setSelectedLot(null);
  };

  const getCabinetryDrawings = (lot) => {
    const cabinetryTab = lot.tabs?.find(
      (tab) => tab.tab === "CABINETRY_DRAWINGS",
    );
    return cabinetryTab?.files?.filter((file) => !file.is_deleted) || [];
  };

  const getTabForLot = (lot, tabKind) => {
    // Check if this tab kind needs to be mapped to a different API tab name
    const apiTabKind = TAB_KIND_TO_API_TAB[tabKind] || tabKind;
    return lot.tabs?.find((tab) => tab.tab === apiTabKind.toUpperCase());
  };

  const getFilesForTab = (lot, tabKind) => {
    const tab = getTabForLot(lot, tabKind);
    const files = tab?.files || [];

    // If this is a site measurement type, filter by the site_group
    const siteGroup = TAB_KIND_TO_SITE_GROUP[tabKind];
    if (siteGroup) {
      return files.filter((file) => file.site_group === siteGroup);
    }

    return files;
  };

  const isHeicFile = (file) => {
    const heicTypes = [
      "image/heic",
      "image/heif",
      "image/heic-sequence",
      "image/heif-sequence",
    ];
    const heicExtensions = [".heic", ".heif", ".hif"];
    const fileName = file.name.toLowerCase();
    return (
      heicTypes.includes(file.type.toLowerCase()) ||
      heicExtensions.some((ext) => fileName.endsWith(ext))
    );
  };

  const convertHeicToJpeg = async (file) => {
    try {
      const convertedBlob = await heic2any({
        blob: file,
        toType: "image/jpeg",
        quality: 0.92,
      });
      // heic2any returns an array, get the first item
      const blob = Array.isArray(convertedBlob)
        ? convertedBlob[0]
        : convertedBlob;
      // Create a new File object with JPEG extension
      const fileName = file.name.replace(/\.(heic|heif|hif)$/i, ".jpg");
      return new File([blob], fileName, {
        type: "image/jpeg",
        lastModified: file.lastModified,
      });
    } catch (error) {
      console.error("Error converting HEIC to JPEG:", error);
      throw new Error("Failed to convert HEIC image to JPEG");
    }
  };

  const createPreview = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target.result);
      };
      reader.onerror = () => {
        resolve(null);
      };
      if (file.type.startsWith("image/")) {
        reader.readAsDataURL(file);
      } else {
        // For video or PDF, we don't generate a data URL preview here
        // The UI will handle displaying an appropriate icon/player
        resolve(null);
      }
    });
  };

  const processImage = async (file) => {
    try {
      // Options for browser-image-compression
      const options = {
        maxSizeMB: 10, // Adjust as needed, keeps high quality
        maxWidthOrHeight: 2560, // Reasonable max dimension for photos
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.9, // High quality
      };

      // browser-image-compression handles EXIF orientation automatically
      const compressedFile = await imageCompression(file, options);

      // Create a new File object to preserve original properties if needed
      return new File([compressedFile], file.name, {
        type: compressedFile.type,
        lastModified: Date.now(),
      });
    } catch (error) {
      console.error("Error processing image:", error);
      // Fallback to original file if processing fails
      return file;
    }
  };

  const handleFileSelect = async (lot, tabKind, event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    try {
      // Show processing toast if many files
      if (files.length > 0) {
        toast.info(
          `Processing ${files.length} file(s)... This may take a moment.`,
          { autoClose: 2000 },
        );
      }

      const processedFiles = [];

      for (const file of files) {
        let processedFile = file;

        // processing logic:
        // 1. If PDF, skip processing (keep as is)
        // 2. If HEIC, convert to JPEG (heic2any)
        // 3. If Image (JPEG/PNG/etc), run through browser-image-compression to fix orientation
        // 4. Otherwise (Video), keep as is

        if (
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf")
        ) {
          // Skip processing for PDFs
        } else if (isHeicFile(file)) {
          processedFile = await convertHeicToJpeg(file);
          // After conversion, we can optionally run it through compression too
          // to ensure consistent sizing/quality, but heic2any usually does a good job.
          // Let's run it through to be safe about orientation if heic2any didn't handle it perfectly
          // (though heic2any usually does).
          processedFile = await processImage(processedFile);
        } else if (file.type.startsWith("image/")) {
          processedFile = await processImage(file);
        }

        processedFiles.push(processedFile);
      }

      // Create previews for all files
      const filesWithPreviews = await Promise.all(
        processedFiles.map(async (file) => {
          const preview = await createPreview(file);
          return {
            file,
            notes: "",
            preview,
            id: `${Date.now()}-${Math.random()}`,
          };
        }),
      );

      // Show preview modal
      setPendingUploads({
        lot,
        tabKind,
        files: filesWithPreviews,
        currentIndex: 0,
      });
    } catch (error) {
      console.error("Error processing files:", error);
      toast.error(
        error.message || "Failed to process files. Please try again.",
      );
    }

    // Reset input
    const inputKey = `${lot.id}_${tabKind}`;
    if (fileInputRefs.current[inputKey]) {
      fileInputRefs.current[inputKey].value = "";
    }
  };

  const uploadFiles = async (lot, tabKind, files, notesMap = {}) => {
    const uploadKey = `${lot.id}_${tabKind}`;
    try {
      setUploading((prev) => ({ ...prev, [uploadKey]: true }));
      setUploadProgressState((prev) => ({ ...prev, [uploadKey]: 0 }));

      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      if (!lot.project?.project_id || !lot.lot_id) {
        toast.error("Project or lot information missing");
        return;
      }

      const formData = new FormData();
      files.forEach((file) => {
        formData.append("file", file);
      });

      // Add site_group for site measurements
      const siteGroup = TAB_KIND_TO_SITE_GROUP[tabKind];
      if (siteGroup) {
        formData.append("site_group", siteGroup);
      }

      // Use the API tab kind (maps site_photos/measurement_photos to site_measurements)
      const apiTabKind = TAB_KIND_TO_API_TAB[tabKind] || tabKind;
      const apiUrl = `/api/uploads/lots/${lot.project.project_id.toUpperCase()}/${lot.lot_id}/${apiTabKind}`;

      // Show progress toast
      showProgressToast(files.length);

      const response = await axios.post(apiUrl, formData, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
        onUploadProgress: (progressEvent) => {
          getUploadProgressHandler(files.length)(progressEvent);
          if (progressEvent.total) {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            setUploadProgressState((prev) => ({
              ...prev,
              [uploadKey]: percent,
            }));
          }
        },
      });

      if (response.data.status) {
        // Save notes for uploaded files
        const uploadedFiles = response.data.files || [];
        if (uploadedFiles.length > 0) {
          // Match notes by file index (files are uploaded in order)
          await Promise.all(
            uploadedFiles.map(async (uploadedFile, index) => {
              const fileId = uploadedFile.fileId;
              // Get notes from the file at the same index
              const fileKeys = Object.keys(notesMap);
              const notes =
                fileKeys.length > index ? notesMap[fileKeys[index]] || "" : "";

              if (notes && notes.trim()) {
                try {
                  await axios.patch(
                    `/api/lot_file/${fileId}`,
                    { notes },
                    {
                      headers: {
                        Authorization: `Bearer ${sessionToken}`,
                        "Content-Type": "application/json",
                      },
                    },
                  );
                } catch (error) {
                  console.error("Error saving notes for file:", error);
                }
              }
            }),
          );
        }

        // Complete upload and auto-dismiss after 5 seconds
        completeUpload(files.length);
        await fetchLotDetails(lot.id);
      } else {
        dismissProgressToast();
        toast.error(
          response.data.message || "Failed to upload files. Please try again.",
        );
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      dismissProgressToast();
      toast.error("Failed to upload files. Please try again.");
    } finally {
      setUploading((prev) => ({ ...prev, [uploadKey]: false }));
    }
  };

  const handleSubmitCurrent = async () => {
    if (!pendingUploads) return;

    const { lot, tabKind, files, currentIndex } = pendingUploads;
    const currentFile = files[currentIndex];

    if (!currentFile) return;

    // Create notes map - use array index as key since we upload single file
    const notesMap = {
      0: currentFile.notes || "",
    };

    // Upload single file
    await uploadFiles(lot, tabKind, [currentFile.file], notesMap);

    // Remove uploaded file from pending list
    const remainingFiles = files.filter((_, index) => index !== currentIndex);
    if (remainingFiles.length === 0) {
      setPendingUploads(null);
    } else {
      const newIndex =
        currentIndex >= remainingFiles.length
          ? remainingFiles.length - 1
          : currentIndex;
      setPendingUploads({
        ...pendingUploads,
        files: remainingFiles,
        currentIndex: newIndex,
      });
    }
  };

  const handleSubmitAll = async () => {
    if (!pendingUploads) return;

    const { lot, tabKind, files } = pendingUploads;

    // Create notes map - use array index as key to match upload order
    const notesMap = {};
    files.forEach((fileItem, index) => {
      notesMap[index] = fileItem.notes || "";
    });

    // Upload all files
    const filesToUpload = files.map((fileItem) => fileItem.file);
    await uploadFiles(lot, tabKind, filesToUpload, notesMap);

    // Close preview
    setPendingUploads(null);
  };

  const updatePendingFileNotes = (fileId, notes) => {
    if (!pendingUploads) return;
    setPendingUploads({
      ...pendingUploads,
      files: pendingUploads.files.map((fileItem) =>
        fileItem.id === fileId ? { ...fileItem, notes } : fileItem,
      ),
    });
  };

  const navigatePreview = (direction) => {
    if (!pendingUploads) return;
    const { files, currentIndex } = pendingUploads;
    let newIndex;
    if (direction === "next") {
      newIndex = (currentIndex + 1) % files.length;
    } else {
      newIndex = (currentIndex - 1 + files.length) % files.length;
    }
    setPendingUploads({
      ...pendingUploads,
      currentIndex: newIndex,
    });
  };

  const handleFileNotesChange = (fileId, value) => {
    setEditingFileNotes((prev) => ({ ...prev, [fileId]: value }));
  };

  const saveFileNotes = async (fileId, lotId) => {
    try {
      setSavingFileNotes((prev) => ({ ...prev, [fileId]: true }));

      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const notesToSave = editingFileNotes[fileId] ?? fileNotes[fileId] ?? "";

      const response = await axios.patch(
        `/api/lot_file/${fileId}`,
        { notes: notesToSave },
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status) {
        toast.success("Notes saved successfully");
        // Update local state
        setFileNotes((prev) => ({ ...prev, [fileId]: notesToSave }));
        setEditingFileNotes((prev) => {
          const updated = { ...prev };
          delete updated[fileId];
          return updated;
        });
        await fetchLotDetails(lotId);
      } else {
        toast.error(response.data.message || "Failed to save notes");
      }
    } catch (error) {
      console.error("Error saving file notes:", error);
      toast.error("Failed to save notes. Please try again.");
    } finally {
      setSavingFileNotes((prev) => ({ ...prev, [fileId]: false }));
    }
  };

  const openFileModal = (file, lot) => {
    // Find which tab this file belongs to
    const tab = lot.tabs?.find((t) => t.files?.some((f) => f.id === file.id));
    setSelectedFile({
      ...file,
      lotId: lot.id,
      lot: lot,
      tab: tab,
    });
    // Initialize editing notes with current file notes (or empty string)
    if (editingFileNotes[file.id] === undefined) {
      setEditingFileNotes((prev) => ({
        ...prev,
        [file.id]: fileNotes[file.id] || "",
      }));
    }
  };

  const closeFileModal = () => {
    setSelectedFile(null);
  };

  const handleDeleteFile = async () => {
    if (!selectedFile || !selectedFile.lot) return;

    if (
      !confirm(
        "Are you sure you want to delete this file? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      setDeletingFile(selectedFile.id);

      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const lot = selectedFile.lot;
      const tab = selectedFile.tab;

      if (!lot.project?.project_id || !lot.lot_id || !tab) {
        toast.error("Missing file information");
        return;
      }

      // Convert tab enum to slug format (e.g., DELIVERY_PHOTOS -> delivery_photos)
      const tabSlug = tab.tab.toLowerCase();

      const deleteUrl = `/api/uploads/lots/${lot.project.project_id.toUpperCase()}/${lot.lot_id}/${tabSlug}/${selectedFile.filename}`;

      const response = await axios.delete(deleteUrl, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        toast.success("File deleted successfully");
        closeFileModal();
        await fetchLotDetails(lot.id);
      } else {
        toast.error(response.data.message || "Failed to delete file");
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file. Please try again.");
    } finally {
      setDeletingFile(null);
    }
  };

  const handleDownloadFile = async (file) => {
    try {
      const fileUrl = getFileUrl(file);
      if (!fileUrl) {
        toast.error("File URL not available");
        return;
      }

      // For iOS Safari compatibility, open the download URL in a new window
      // The server should send proper Content-Disposition headers
      const downloadUrl = `${fileUrl}?download=true`;

      // Try programmatic download first
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = file.filename || "download";
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast.error("Failed to download file. Please try again.");
    }
  };

  const getFileUrl = (file) => {
    if (!file.url) return null;
    // Remove 'mediauploads/' prefix if present, as the API route expects segments after mediauploads
    const pathWithoutPrefix = file.url.startsWith("mediauploads/")
      ? file.url.substring("mediauploads/".length)
      : file.url;
    return `/api/uploads/lots/${pathWithoutPrefix}`;
  };

  const getFileIcon = (fileKind) => {
    switch (fileKind) {
      case "PHOTO":
        return <ImageIcon className="w-5 h-5" />;
      case "VIDEO":
        return <Video className="w-5 h-5" />;
      case "PDF":
        return <FileText className="w-5 h-5" />;
      default:
        return <FileText className="w-5 h-5" />;
    }
  };

  if (loading) {
    return (
      <AdminRoute>
        <div className="min-h-screen bg-tertiary flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminRoute>
    );
  }

  return (
    <AdminRoute>
      <div className="min-h-screen bg-tertiary pb-20">
        {!selectedLot ? (
          /* LIST VIEW */
          <>
            {/* Mobile Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
              <div className="px-4 py-3 space-y-3">
                {/* Welcome Message */}
                {getUserData()?.user?.username && (
                  <div className="pb-2 border-b border-gray-100">
                    <p className="text-sm text-gray-700">
                      Welcome,{" "}
                      <span className="font-semibold text-primary">
                        {getUserData().user.username}
                      </span>
                      !
                    </p>
                  </div>
                )}
                {/* Header Row */}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h1 className="text-xl font-bold text-gray-900">
                      Site Photos
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">
                      {lots.length} assigned lot{lots.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Contact Support Button */}
                    <div className="relative" ref={supportDropdownRef}>
                      <button
                        onClick={() =>
                          setShowSupportDropdown(!showSupportDropdown)
                        }
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative"
                        title="Contact Support"
                      >
                        <HelpCircle className="w-5 h-5 text-gray-700" />
                      </button>
                      {showSupportDropdown && (
                        <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
                          <button
                            onClick={handleCallSupport}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                          >
                            <Phone className="w-5 h-5 text-gray-700" />
                            <span className="text-sm text-gray-700">
                              Call Support
                            </span>
                          </button>
                          <button
                            onClick={handleWhatsAppSupport}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left border-t border-gray-200"
                          >
                            <MessageSquare className="w-5 h-5 text-gray-700" />
                            <span className="text-sm text-gray-700">
                              WhatsApp
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Settings Button */}
                    <div className="relative" ref={settingsDropdownRef}>
                      <button
                        onClick={() =>
                          setShowSettingsDropdown(!showSettingsDropdown)
                        }
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative"
                        title="Settings"
                      >
                        <Settings className="w-5 h-5 text-gray-700" />
                      </button>
                      {showSettingsDropdown && (
                        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
                          <div className="px-4 py-3 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                Notifications
                              </p>
                              <p className="text-xs text-gray-500">
                                Installer updates
                              </p>
                            </div>
                            {notificationLoading ? (
                              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                            ) : (
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={notificationConfig.assign_installer}
                                  onChange={handleNotificationToggle}
                                  disabled={isUpdatingNotifications}
                                  className="sr-only peer"
                                />
                                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                              </label>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Logout"
                    >
                      <LogOut className="w-5 h-5 text-gray-700" />
                    </button>
                  </div>
                </div>

                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by client, project, or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Lots List */}
            <div className="px-4 py-4 space-y-3">
              {lots.length === 0 ? (
                <div className="text-center py-12">
                  <ImageIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600">No active lots found</p>
                </div>
              ) : (
                lots.map((lot) => {
                  return (
                    <button
                      key={lot.id}
                      onClick={() => selectLot(lot)}
                      className="w-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md hover:border-primary/30 transition-all"
                    >
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div className="flex-1 text-left">
                          {lot.project?.client?.client_name &&
                            getUserType() !== "employee" && (
                              <p className="text-xs font-medium text-primary mb-1">
                                {lot.project.client.client_name}
                              </p>
                            )}
                          <h3 className="font-semibold text-gray-900">
                            {lot.project?.project_name ||
                              lot.project?.name ||
                              "No project"}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            Lot ID: {lot.lot_id || lot.id}
                          </p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* DETAIL VIEW */
          <>
            {/* Detail Screen Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
              <div className="px-4 py-3">
                {/* Back Button and Title */}
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={goBackToList}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Back to list"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-700" />
                  </button>
                  <div className="flex-1">
                    <h1 className="text-lg font-bold text-gray-900">
                      {selectedLot.project?.project_name ||
                        selectedLot.project?.name ||
                        "No project"}
                    </h1>
                  </div>
                  <button
                    onClick={() => setShowNotesPopup(true)}
                    className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                    title="View Notes"
                  >
                    <StickyNote className="w-5 h-5 text-primary" />
                  </button>
                </div>

                {/* Project and Client Details */}
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Project ID</p>
                      <p className="font-medium text-gray-900">
                        {selectedLot.project?.project_id || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Lot ID</p>
                      <p className="font-medium text-gray-900">
                        {selectedLot.lot_id || selectedLot.id}
                      </p>
                    </div>
                    {selectedLot.project?.client?.client_name &&
                      getUserType() !== "employee" && (
                        <div className="col-span-2">
                          <p className="text-xs text-gray-600 mb-1">Client</p>
                          <p className="font-medium text-primary">
                            {selectedLot.project.client.client_name}
                          </p>
                        </div>
                      )}
                  </div>
                </div>

                {/* Photo Type Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Photo Type
                  </label>
                  <div className="relative" ref={photoTypeDropdownRef}>
                    <button
                      onClick={() =>
                        setShowPhotoTypeDropdown(!showPhotoTypeDropdown)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm bg-white flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-gray-900">
                        {TAB_LABELS[selectedPhotoType]}
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-gray-500 transition-transform ${showPhotoTypeDropdown ? "rotate-180" : ""}`}
                      />
                    </button>
                    {showPhotoTypeDropdown && (
                      <div className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
                        {getAllowedTabs().map((tabKind, index) => (
                          <button
                            key={`${tabKind}-${index}`}
                            onClick={() => {
                              setSelectedPhotoType(tabKind);
                              setShowPhotoTypeDropdown(false);
                            }}
                            className={`w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left ${
                              selectedPhotoType === tabKind
                                ? "bg-primary/5"
                                : ""
                            }`}
                          >
                            <span
                              className={`text-sm ${selectedPhotoType === tabKind ? "text-primary font-medium" : "text-gray-700"}`}
                            >
                              {TAB_LABELS[tabKind]}
                            </span>
                            {selectedPhotoType === tabKind && (
                              <div className="w-2 h-2 rounded-full bg-primary"></div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Detail Content */}
            <div className="pb-4">
              {loadingLot === selectedLot.id ? (
                <div className="p-8 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                  <p className="text-sm text-gray-600">Loading photos...</p>
                </div>
              ) : (
                <>
                  {/* Tab Switcher */}
                  <div className="flex border-b border-gray-200 bg-white">
                    <button
                      onClick={() =>
                        setActiveLotTab((prev) => ({
                          ...prev,
                          [selectedLot.id]: "cabinetry",
                        }))
                      }
                      className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                        activeLotTab[selectedLot.id] === "cabinetry" ||
                        !activeLotTab[selectedLot.id]
                          ? "text-primary border-b-2 border-primary bg-primary/5"
                          : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                      }`}
                    >
                      Cabinetry Drawings
                    </button>
                    <button
                      onClick={() =>
                        setActiveLotTab((prev) => ({
                          ...prev,
                          [selectedLot.id]: "upload",
                        }))
                      }
                      className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                        activeLotTab[selectedLot.id] === "upload"
                          ? "text-primary border-b-2 border-primary bg-primary/5"
                          : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
                      }`}
                    >
                      Upload
                    </button>
                  </div>

                  {/* Cabinetry Drawings Tab Content */}
                  {(activeLotTab[selectedLot.id] === "cabinetry" ||
                    !activeLotTab[selectedLot.id]) && (
                    <div className="p-4">
                      {(() => {
                        const cabinetryDrawings =
                          getCabinetryDrawings(selectedLot);
                        if (cabinetryDrawings.length === 0) {
                          return (
                            <div className="text-center py-12 text-gray-500">
                              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              <p className="text-sm font-medium">
                                No cabinetry drawings available
                              </p>
                              <p className="text-xs mt-1">
                                Contact admin to get the drawings. If you are
                                the admin, upload the drawings using admin
                                portal.
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-3">
                            {cabinetryDrawings.map((file) => {
                              const fileUrl = getFileUrl(file);
                              return (
                                <div
                                  key={file.id}
                                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                                >
                                  {/* File Icon */}
                                  <div className="shrink-0 w-10 h-10 bg-white rounded-lg border border-gray-300 flex items-center justify-center">
                                    {getFileIcon(file.file_kind)}
                                  </div>

                                  {/* File Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                      {file.filename}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {file.file_kind} •{" "}
                                      {file.size
                                        ? `${(file.size / 1024).toFixed(1)} KB`
                                        : "Unknown size"}
                                    </p>
                                  </div>

                                  {/* Action Buttons */}
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() =>
                                        window.open(fileUrl, "_blank")
                                      }
                                      className="px-3 py-1.5 text-xs font-medium text-primary border border-primary rounded-lg hover:bg-primary hover:text-white transition-colors"
                                    >
                                      View
                                    </button>
                                    <button
                                      onClick={() => handleDownloadFile(file)}
                                      className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                      Download
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Upload Tab Content */}
                  {activeLotTab[selectedLot.id] === "upload" && (
                    <div className="p-4">
                      {/* Upload Section */}
                      <div className="mb-4">
                        <label
                          className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                            uploading[`${selectedLot.id}_${selectedPhotoType}`]
                              ? "border-gray-300 bg-gray-50 cursor-not-allowed pointer-events-none"
                              : "border-primary hover:border-primary/70 hover:bg-primary/5"
                          }`}
                        >
                          <input
                            ref={(el) => {
                              const key = `${selectedLot.id}_${selectedPhotoType}`;
                              fileInputRefs.current[key] = el;
                            }}
                            type="file"
                            accept={
                              selectedPhotoType === TAB_KINDS.SITE_PHOTOS ||
                              selectedPhotoType === TAB_KINDS.MEASUREMENT_PHOTOS
                                ? "image/*,video/*,image/heic,image/heif,.heic,.heif,.pdf,application/pdf"
                                : "image/*,video/*,image/heic,image/heif,.heic,.heif"
                            }
                            multiple
                            onChange={(e) =>
                              handleFileSelect(
                                selectedLot,
                                selectedPhotoType,
                                e,
                              )
                            }
                            className="hidden"
                            disabled={
                              uploading[
                                `${selectedLot.id}_${selectedPhotoType}`
                              ]
                            }
                          />
                          {uploading[
                            `${selectedLot.id}_${selectedPhotoType}`
                          ] ? (
                            <div className="flex flex-col items-center justify-center w-full px-4">
                              <div className="flex items-center gap-2 mb-1">
                                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                <span className="text-sm text-gray-500">
                                  Uploading...{" "}
                                  {uploadProgressState[
                                    `${selectedLot.id}_${selectedPhotoType}`
                                  ] || 0}
                                  %
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary transition-all duration-300 ease-out"
                                  style={{
                                    width: `${uploadProgressState[`${selectedLot.id}_${selectedPhotoType}`] || 0}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <>
                              <Camera className="w-5 h-5 text-primary" />
                              <span className="text-sm font-medium text-primary">
                                Take/Select Photos
                              </span>
                            </>
                          )}
                        </label>
                      </div>

                      {/* Files Grid */}
                      {(() => {
                        const files = getFilesForTab(
                          selectedLot,
                          selectedPhotoType,
                        );
                        if (files.length === 0) {
                          return (
                            <div className="text-center py-8 text-gray-500">
                              <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No files uploaded yet</p>
                            </div>
                          );
                        }

                        return (
                          <div className="grid grid-cols-3 gap-2 mb-4">
                            {files.map((file) => {
                              const fileUrl = getFileUrl(file);
                              const hasNotes =
                                fileNotes[file.id] &&
                                fileNotes[file.id].trim() !== "";
                              return (
                                <div
                                  key={file.id}
                                  onClick={() =>
                                    openFileModal(file, selectedLot)
                                  }
                                  className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group cursor-pointer"
                                >
                                  {file.file_kind === "PHOTO" && fileUrl ? (
                                    <div className="relative w-full h-full">
                                      {loadingImages[file.id] !== false && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                        </div>
                                      )}
                                      <img
                                        src={fileUrl}
                                        alt={file.filename}
                                        className="w-full h-full object-cover"
                                        onLoad={() =>
                                          setLoadingImages((prev) => ({
                                            ...prev,
                                            [file.id]: false,
                                          }))
                                        }
                                        onError={() =>
                                          setLoadingImages((prev) => ({
                                            ...prev,
                                            [file.id]: false,
                                          }))
                                        }
                                      />
                                    </div>
                                  ) : file.file_kind === "VIDEO" && fileUrl ? (
                                    <video
                                      src={fileUrl}
                                      className="w-full h-full object-cover"
                                      muted
                                      playsInline
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                                      {getFileIcon(file.file_kind)}
                                    </div>
                                  )}
                                  {file.file_kind === "VIDEO" && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                      <Video className="w-8 h-8 text-white" />
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                                  {hasNotes && (
                                    <div className="absolute top-1 right-1 bg-primary/90 text-white rounded-full p-1">
                                      <FileText className="w-3 h-3" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* File Modal */}
        {selectedFile && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={closeFileModal}
          >
            <div
              className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 truncate flex-1 mr-2">
                  {selectedFile.filename}
                </h3>
                <div className="flex items-center gap-2">
                  <a
                    href={getFileUrl(selectedFile)}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-700"
                    title="Download file"
                  >
                    <Download className="w-5 h-5" />
                  </a>
                  <button
                    onClick={handleDeleteFile}
                    disabled={deletingFile === selectedFile.id}
                    className="p-1.5 hover:bg-red-50 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete file"
                  >
                    {deletingFile === selectedFile.id ? (
                      <Loader2 className="w-5 h-5 text-red-600 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5 text-red-600" />
                    )}
                  </button>
                  <button
                    onClick={closeFileModal}
                    className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* File Preview */}
              <div className="p-4">
                {selectedFile.file_kind === "PHOTO" &&
                getFileUrl(selectedFile) ? (
                  <div className="relative w-full mb-4">
                    {loadingImages[`modal-${selectedFile.id}`] !== false && (
                      <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg min-h-[300px]">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      </div>
                    )}
                    <img
                      src={getFileUrl(selectedFile)}
                      alt={selectedFile.filename}
                      className="w-full rounded-lg"
                      onLoad={() =>
                        setLoadingImages((prev) => ({
                          ...prev,
                          [`modal-${selectedFile.id}`]: false,
                        }))
                      }
                      onError={() =>
                        setLoadingImages((prev) => ({
                          ...prev,
                          [`modal-${selectedFile.id}`]: false,
                        }))
                      }
                    />
                  </div>
                ) : selectedFile.file_kind === "VIDEO" &&
                  getFileUrl(selectedFile) ? (
                  <video
                    src={getFileUrl(selectedFile)}
                    controls
                    playsInline
                    className="w-full rounded-lg mb-4"
                  >
                    Your browser does not support the video tag.
                  </video>
                ) : (
                  <div className="w-full aspect-video bg-gray-200 rounded-lg mb-4 flex items-center justify-center">
                    {getFileIcon(selectedFile.file_kind)}
                  </div>
                )}

                {/* Notes Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={
                      editingFileNotes[selectedFile.id] !== undefined
                        ? editingFileNotes[selectedFile.id]
                        : fileNotes[selectedFile.id] || ""
                    }
                    onChange={(e) =>
                      handleFileNotesChange(selectedFile.id, e.target.value)
                    }
                    placeholder="Add notes for this file..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-sm"
                  />
                  <button
                    onClick={() =>
                      saveFileNotes(selectedFile.id, selectedFile.lotId)
                    }
                    disabled={savingFileNotes[selectedFile.id]}
                    className="mt-2 w-full px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {savingFileNotes[selectedFile.id] ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Notes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Preview Upload Modal */}
        {pendingUploads && pendingUploads.files.length > 0 && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setPendingUploads(null);
              }
            }}
          >
            <div
              className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    Add Notes & Upload
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {pendingUploads.files.length} file(s) -{" "}
                    {pendingUploads.currentIndex + 1} of{" "}
                    {pendingUploads.files.length}
                  </p>
                </div>
                <button
                  onClick={() => setPendingUploads(null)}
                  className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Carousel Content */}
              <div className="relative">
                {pendingUploads.files.length > 1 && (
                  <>
                    <button
                      onClick={() => navigatePreview("prev")}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-700" />
                    </button>
                    <button
                      onClick={() => navigatePreview("next")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-20 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-700" />
                    </button>
                  </>
                )}

                <div className="p-4">
                  {pendingUploads.files.map((fileItem, index) => {
                    if (index !== pendingUploads.currentIndex) return null;

                    return (
                      <div key={fileItem.id} className="space-y-4">
                        {/* Image Preview */}
                        <div className="relative w-full aspect-square bg-gray-100 rounded-lg overflow-hidden">
                          {fileItem.preview ? (
                            <>
                              {loadingImages[`preview-${fileItem.id}`] !==
                                false && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                              )}
                              <img
                                src={fileItem.preview}
                                alt={fileItem.file.name}
                                className="w-full h-full object-contain"
                                onLoad={() =>
                                  setLoadingImages((prev) => ({
                                    ...prev,
                                    [`preview-${fileItem.id}`]: false,
                                  }))
                                }
                                onError={() =>
                                  setLoadingImages((prev) => ({
                                    ...prev,
                                    [`preview-${fileItem.id}`]: false,
                                  }))
                                }
                              />
                            </>
                          ) : fileItem.file.type === "application/pdf" ||
                            fileItem.file.name
                              .toLowerCase()
                              .endsWith(".pdf") ? (
                            <div className="w-full h-full flex items-center justify-center">
                              <FileText className="w-16 h-16 text-gray-400" />
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageIcon className="w-16 h-16 text-gray-400" />
                            </div>
                          )}
                        </div>

                        {/* File Name */}
                        <div className="text-sm text-gray-600 truncate">
                          {fileItem.file.name}
                        </div>

                        {/* Notes Input */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notes
                          </label>
                          <textarea
                            value={fileItem.notes}
                            onChange={(e) =>
                              updatePendingFileNotes(
                                fileItem.id,
                                e.target.value,
                              )
                            }
                            placeholder="Add notes for this photo..."
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-sm"
                            autoFocus
                          />
                        </div>

                        {/* Progress Bar in Modal */}
                        {uploading[
                          `${pendingUploads.lot.id}_${pendingUploads.tabKind}`
                        ] && (
                          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden mb-3">
                            <div
                              className="h-full bg-primary transition-all duration-300 ease-out"
                              style={{
                                width: `${uploadProgressState[`${pendingUploads.lot.id}_${pendingUploads.tabKind}`] || 0}%`,
                              }}
                            />
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div
                          className={`flex gap-2 pt-2 ${pendingUploads.files.length > 1 ? "" : ""}`}
                        >
                          {pendingUploads.files.length > 1 && (
                            <button
                              onClick={handleSubmitCurrent}
                              disabled={
                                uploading[
                                  `${pendingUploads.lot.id}_${pendingUploads.tabKind}`
                                ]
                              }
                              className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              {uploading[
                                `${pendingUploads.lot.id}_${pendingUploads.tabKind}`
                              ] ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>
                                    Uploading...{" "}
                                    {uploadProgressState[
                                      `${pendingUploads.lot.id}_${pendingUploads.tabKind}`
                                    ] || 0}
                                    %
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Send className="w-4 h-4" />
                                  <span>Submit</span>
                                </>
                              )}
                            </button>
                          )}
                          <button
                            onClick={handleSubmitAll}
                            disabled={
                              uploading[
                                `${pendingUploads.lot.id}_${pendingUploads.tabKind}`
                              ]
                            }
                            className={`${pendingUploads.files.length > 1 ? "flex-1" : "w-full"} px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                          >
                            {uploading[
                              `${pendingUploads.lot.id}_${pendingUploads.tabKind}`
                            ] ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>
                                  Uploading...{" "}
                                  {uploadProgressState[
                                    `${pendingUploads.lot.id}_${pendingUploads.tabKind}`
                                  ] || 0}
                                  %
                                </span>
                              </>
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
                                <span>
                                  {pendingUploads.files.length > 1
                                    ? "Submit All"
                                    : "Submit"}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes Popup Modal */}
        {showNotesPopup && selectedLot && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Installer Notes
                </h2>
                <button
                  onClick={() => setShowNotesPopup(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5 text-gray-700" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {selectedLot.installer_notes ? (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                      {selectedLot.installer_notes}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium">
                      No installer notes available
                    </p>
                    <p className="text-xs mt-1">
                      Notes will appear here when added by the admin
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminRoute>
  );
}
