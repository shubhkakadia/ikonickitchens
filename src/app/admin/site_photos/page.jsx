"use client";
import React, { useState, useEffect, useRef } from "react";
import { AdminRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import axios from "axios";
import { toast } from "react-toastify";
import heic2any from "heic2any";
import { useUploadProgress } from "@/hooks/useUploadProgress";
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
} from "lucide-react";

const TAB_KINDS = {
  DELIVERY: "delivery_photos",
  INSTALLATION: "installation_photos",
  MAINTENANCE: "maintenance_photos",
};

const TAB_LABELS = {
  [TAB_KINDS.DELIVERY]: "Delivery Photos",
  [TAB_KINDS.INSTALLATION]: "Installation Photos",
  [TAB_KINDS.MAINTENANCE]: "Maintenance Photos",
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
  const [expandedLots, setExpandedLots] = useState(new Set());
  const [activeTabs, setActiveTabs] = useState({});
  const [uploading, setUploading] = useState({});
  const [savingFileNotes, setSavingFileNotes] = useState({});
  const [fileNotes, setFileNotes] = useState({});
  const [selectedFile, setSelectedFile] = useState(null);
  const [editingFileNotes, setEditingFileNotes] = useState({});
  const [deletingFile, setDeletingFile] = useState(null);
  const [pendingUploads, setPendingUploads] = useState(null); // { lot, tabKind, files: [{ file, notes, preview }], currentIndex }
  const [searchTerm, setSearchTerm] = useState("");
  const [employeeRole, setEmployeeRole] = useState(null);
  const [showSupportDropdown, setShowSupportDropdown] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [notificationConfig, setNotificationConfig] = useState({
    assign_installer: false,
  });
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  const fileInputRefs = useRef({});
  const supportDropdownRef = useRef(null);
  const settingsDropdownRef = useRef(null);

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
    };

    if (showSupportDropdown || showSettingsDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSupportDropdown, showSettingsDropdown]);

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

  // Filter lots based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setLots(allLots);
    } else {
      const filtered = allLots.filter((lot) =>
        lot.project?.name?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      setLots(filtered);
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

  // Update active tabs when employee role is loaded
  useEffect(() => {
    if (employeeRole !== null && allLots.length > 0) {
      const allowedTabs = getAllowedTabs();
      const defaultTab = allowedTabs[0] || TAB_KINDS.DELIVERY;
      const tabsState = {};
      allLots.forEach((lot) => {
        // Only update if current tab is not in allowed tabs
        const currentTab = activeTabs[lot.id];
        if (!currentTab || !allowedTabs.includes(currentTab)) {
          tabsState[lot.id] = defaultTab;
        } else {
          tabsState[lot.id] = currentTab;
        }
      });
      setActiveTabs((prev) => ({ ...prev, ...tabsState }));
    }
  }, [employeeRole, allLots]);

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

        setAllLots(lotsData);
        setLots(lotsData);

        // Initialize file notes state from existing files
        const fileNotesState = {};
        lots.forEach((lot) => {
          lot.tabs?.forEach((tab) => {
            tab.files?.forEach((file) => {
              fileNotesState[file.id] = file.notes || "";
            });
          });
        });
        setFileNotes(fileNotesState);

        // Set default active tab for each lot (use first allowed tab)
        const allowedTabs = getAllowedTabs();
        const defaultTab = allowedTabs[0] || TAB_KINDS.DELIVERY;
        const tabsState = {};
        lots.forEach((lot) => {
          tabsState[lot.id] = defaultTab;
        });
        setActiveTabs(tabsState);
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
    }
  };

  const toggleLot = async (lotId) => {
    const newExpanded = new Set(expandedLots);
    if (newExpanded.has(lotId)) {
      newExpanded.delete(lotId);
    } else {
      newExpanded.add(lotId);
      // Fetch detailed lot data when expanding
      await fetchLotDetails(lotId);
    }
    setExpandedLots(newExpanded);
  };

  const setActiveTab = (lotId, tabKind) => {
    setActiveTabs((prev) => ({ ...prev, [lotId]: tabKind }));
  };

  const getTabForLot = (lot, tabKind) => {
    return lot.tabs?.find((tab) => tab.tab === tabKind.toUpperCase());
  };

  const getFilesForTab = (lot, tabKind) => {
    const tab = getTabForLot(lot, tabKind);
    return tab?.files || [];
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
        resolve(null);
      }
    });
  };

  const handleFileSelect = async (lot, tabKind, event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    try {
      // Check for HEIC files
      const heicFiles = files.filter((file) => isHeicFile(file));
      if (heicFiles.length > 0) {
        toast.info(`Converting ${heicFiles.length} HEIC file(s) to JPEG...`);
      }

      // Convert HEIC files to JPEG
      const processedFiles = await Promise.all(
        files.map(async (file) => {
          if (isHeicFile(file)) {
            return await convertHeicToJpeg(file);
          }
          return file;
        }),
      );

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

      const apiUrl = `/api/uploads/lots/${lot.project.project_id.toUpperCase()}/${lot.lot_id}/${tabKind}`;

      // Show progress toast
      showProgressToast(files.length);

      const response = await axios.post(apiUrl, formData, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
        onUploadProgress: getUploadProgressHandler(files.length),
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
          <Loader2 className="w-8 h-8 animate-spin text-secondary" />
        </div>
      </AdminRoute>
    );
  }

  return (
    <AdminRoute>
      <div className="min-h-screen bg-tertiary pb-20">
        {/* Mobile Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 py-3 space-y-3">
            {/* Welcome Message */}
            {getUserData()?.user?.username && (
              <div className="pb-2 border-b border-gray-100">
                <p className="text-sm text-gray-700">
                  Welcome,{" "}
                  <span className="font-semibold text-secondary">
                    {getUserData().user.username}
                  </span>
                  !
                </p>
              </div>
            )}
            {/* Header Row */}
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h1 className="text-xl font-bold text-gray-900">Site Photos</h1>
                <p className="text-sm text-gray-600 mt-1">
                  {lots.length} assigned lot{lots.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Contact Support Button */}
                <div className="relative" ref={supportDropdownRef}>
                  <button
                    onClick={() => setShowSupportDropdown(!showSupportDropdown)}
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
                        <span className="text-sm text-gray-700">WhatsApp</span>
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
                            <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-secondary/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-secondary"></div>
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
                placeholder="Search by project name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent text-sm"
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
              const isExpanded = expandedLots.has(lot.id);
              const allowedTabs = getAllowedTabs();
              const defaultTab = allowedTabs[0] || TAB_KINDS.DELIVERY;
              const activeTab = activeTabs[lot.id] || defaultTab;

              return (
                <div
                  key={lot.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                >
                  {/* Lot Header */}
                  <button
                    onClick={() => toggleLot(lot.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-gray-900">
                        {lot.project?.name || "No project"}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        Lot ID: {lot.lot_id || lot.id}
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    )}
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-200">
                      {/* Tabs */}
                      <div className="flex border-b border-gray-200 bg-gray-50">
                        {getAllowedTabs().map((tabKind) => (
                          <button
                            key={tabKind}
                            onClick={() => setActiveTab(lot.id, tabKind)}
                            className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
                              activeTab === tabKind
                                ? "bg-white text-secondary border-b-2 border-secondary"
                                : "text-gray-600 hover:text-gray-900"
                            }`}
                          >
                            {TAB_LABELS[tabKind].split(" ")[0]}
                          </button>
                        ))}
                      </div>

                      {/* Tab Content */}
                      <div className="p-4">
                        {/* Upload Section */}
                        <div className="mb-4">
                          <label
                            className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                              uploading[`${lot.id}_${activeTab}`]
                                ? "border-gray-300 bg-gray-50 cursor-not-allowed pointer-events-none"
                                : "border-secondary hover:border-secondary/70 hover:bg-secondary/5"
                            }`}
                          >
                            <input
                              ref={(el) => {
                                const key = `${lot.id}_${activeTab}`;
                                fileInputRefs.current[key] = el;
                              }}
                              type="file"
                              accept="image/*,video/*,image/heic,image/heif,.heic,.heif"
                              capture="environment"
                              multiple
                              onChange={(e) =>
                                handleFileSelect(lot, activeTab, e)
                              }
                              className="hidden"
                              disabled={uploading[`${lot.id}_${activeTab}`]}
                            />
                            {uploading[`${lot.id}_${activeTab}`] ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                                <span className="text-sm text-gray-500">
                                  Uploading...
                                </span>
                              </>
                            ) : (
                              <>
                                <Camera className="w-5 h-5 text-secondary" />
                                <span className="text-sm font-medium text-secondary">
                                  Take/Select Photos
                                </span>
                              </>
                            )}
                          </label>
                        </div>

                        {/* Files Grid */}
                        {(() => {
                          const files = getFilesForTab(lot, activeTab);
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
                                    onClick={() => openFileModal(file, lot)}
                                    className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group cursor-pointer"
                                  >
                                    {file.file_kind === "PHOTO" && fileUrl ? (
                                      <img
                                        src={fileUrl}
                                        alt={file.filename}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : file.file_kind === "VIDEO" &&
                                      fileUrl ? (
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
                                      <div className="absolute top-1 right-1 bg-secondary/90 text-white rounded-full p-1">
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
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

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
                  <img
                    src={getFileUrl(selectedFile)}
                    alt={selectedFile.filename}
                    className="w-full rounded-lg mb-4"
                  />
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent resize-none text-sm"
                  />
                  <button
                    onClick={() =>
                      saveFileNotes(selectedFile.id, selectedFile.lotId)
                    }
                    disabled={savingFileNotes[selectedFile.id]}
                    className="mt-2 w-full px-4 py-2 bg-secondary text-white rounded-lg font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                            <img
                              src={fileItem.preview}
                              alt={fileItem.file.name}
                              className="w-full h-full object-contain"
                            />
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary focus:border-transparent resize-none text-sm"
                            autoFocus
                          />
                        </div>

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
                                  <span>Uploading...</span>
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
                            className={`${pendingUploads.files.length > 1 ? "flex-1" : "w-full"} px-4 py-2 bg-secondary text-white rounded-lg font-medium hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                          >
                            {uploading[
                              `${pendingUploads.lot.id}_${pendingUploads.tabKind}`
                            ] ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Uploading...</span>
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
      </div>
    </AdminRoute>
  );
}
