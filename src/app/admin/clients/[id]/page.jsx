"use client";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import React, { useEffect, useState, useMemo, useRef } from "react";
import TabsController from "@/components/tabscontroller";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Edit,
  User,
  Mail,
  Phone,
  Link2,
  NotebookText,
  X,
  MapPin,
  Trash2,
  Plus,
  Check,
  AlertTriangle,
  Building,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  MoreVertical,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import ContactSection from "@/components/ContactSection";
import CustomDropdown from "@/components/CustomDropdown";
import PaginationFooter from "@/components/PaginationFooter";
import AdminShell from "@/components/AdminShell";
import { validatePhone, formatPhoneToNational } from "@/components/validators";
import { generateClientSlug, normalizeClientSlug } from "@/lib/clientSlug";
import {
  usePersistedTableFilter,
  useTableFilterActions,
} from "@/hooks/usePersistedTableFilter";
import useModalFocus from "@/hooks/useModalFocus";
import {
  BADGE,
  BADGE_TONES,
  COUNT_BADGE,
  STATUS_COLORS,
} from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";

const EMPTY = "—";

// Form-field rules (DESIGN.md 9.2): 14px, slate-300 border, primary focus ring.
// Error state swaps the border and ring to red and is paired with a message.
// Padding matches CustomDropdown (px-4 py-3) so fields line up in a row.
const FIELD =
  "w-full text-sm text-slate-800 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-colors duration-200";
const fieldTone = (hasError) =>
  hasError
    ? "border-red-500 focus:ring-red-500"
    : "border-slate-300 focus:ring-primary";

const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const MENU_ITEM =
  "cursor-pointer w-full text-left px-4 py-2.5 text-sm hover:bg-slate-100 transition-colors flex items-center gap-2";

const CLIENT_TYPE_OPTIONS = [
  { value: "private", label: "Private" },
  { value: "builder", label: "Builder" },
  { value: "other", label: "Other" },
];

const SORT_OPTIONS = [
  { field: "project_id", label: "Project ID" },
  { field: "name", label: "Name" },
  { field: "createdAt", label: "Created date" },
  { field: "number_of_lots", label: "Number of lots" },
];

const EMPTY_NEW_PROJECT = {
  name: "",
  project_id: "",
  startDate: "",
  sync_all_lots: false,
};

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-red-600 mt-1">
      {message}
    </p>
  );
}

function Spinner() {
  return (
    <span
      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
      aria-hidden="true"
    />
  );
}

// Records show the year (a created or due date without one is ambiguous), so
// this stays local rather than using the compact shared formatDate.
const formatDate = (value) => {
  if (!value) return EMPTY;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return EMPTY;
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatValue = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "null"
  ) {
    return EMPTY;
  }
  if (typeof value === "string" && value.trim() === "") {
    return EMPTY;
  }
  return value;
};

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return `${parts[0][0] || ""}${
    parts[parts.length - 1][0] || ""
  }`.toUpperCase();
};

const isInstallationDueSoon = (installationDate) => {
  if (!installationDate) return false;
  const today = new Date();
  const dueDate = new Date(installationDate);
  const diffTime = dueDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 7 && diffDays >= 0;
};

// The most recently created stage stands for the lot's progress.
const getLatestStage = (stages) => {
  if (!stages || stages.length === 0) return null;
  const sortedStages = [...stages].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA; // Most recent first
  });
  return sortedStages[0];
};

export default function ClientDetailPage() {
  const { id } = useParams();
  const tableKey = `client-projects:${id}`;
  const router = useRouter();
  const { getToken } = useAuth();
  const [client, setClient] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editData, setEditData] = useState({});
  const [showDeleteClientModal, setShowDeleteClientModal] = useState(false);
  const [isDeletingClient, setIsDeletingClient] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [search, setSearch] = usePersistedTableFilter(tableKey, "search", "");
  const [sortField, setSortField] = usePersistedTableFilter(
    tableKey,
    "sortField",
    "project_id",
  );
  const [sortOrder, setSortOrder] = usePersistedTableFilter(
    tableKey,
    "sortOrder",
    "asc",
  );
  const { resetFilters } = useTableFilterActions(tableKey);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProject, setNewProject] = useState(EMPTY_NEW_PROJECT);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [activeTab, setActiveTab] = useState("ACTIVE");
  const [numberOfLots, setNumberOfLots] = useState("");
  const [lots, setLots] = useState([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugAvailability, setSlugAvailability] = useState(null);
  // Inline validation messages (DESIGN.md 11, 15.3).
  const [fieldErrors, setFieldErrors] = useState({});
  const [projectErrors, setProjectErrors] = useState({});
  const [lotErrors, setLotErrors] = useState({});
  const moreMenuRef = useRef(null);
  const sortMenuRef = useRef(null);
  const addProjectModalRef = useRef(null);

  useModalFocus(addProjectModalRef, showAddProjectModal);

  useEffect(() => {
    fetchClient(id);
  }, [id]);

  useEffect(() => {
    if (!showAddProjectModal || !client?.client_id) return;
    const loadNextProjectId = async () => {
      try {
        const response = await axios.get(
          `/api/v1/project/next-id?client_id=${encodeURIComponent(client.client_id)}`,
          { headers: { Authorization: `Bearer ${getToken()}` } },
        );
        if (response.data.status)
          setNewProject((previous) => ({
            ...previous,
            project_id: response.data.data.project_id,
          }));
      } catch (error) {
        toast.error(
          error.response?.data?.message ||
            "Couldn't generate a project ID. Close this dialog and try again.",
        );
      }
    };
    loadNextProjectId();
  }, [showAddProjectModal, client?.client_id, getToken]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showDropdown &&
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target)
      ) {
        setShowDropdown(false);
      }
      if (
        showSortDropdown &&
        sortMenuRef.current &&
        !sortMenuRef.current.contains(event.target)
      ) {
        setShowSortDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown, showSortDropdown]);

  // Menus and the add-project modal close on Escape (DESIGN.md 9.4). The
  // delete confirmation is destructive and needs an explicit button.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (showDeleteClientModal) return;
      if (showAddProjectModal) {
        if (!isCreatingProject) closeAddProjectModal();
      } else if (showDropdown) {
        setShowDropdown(false);
      } else if (showSortDropdown) {
        setShowSortDropdown(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const fetchClient = async (id) => {
    try {
      setLoading(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
        return;
      }

      const response = await axios.get(`/api/v1/client/${id}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        setClient(response.data.data);
        setContacts(response.data.data.contacts || []);
      } else {
        setError(
          response.data.message ||
            "Couldn't load this client. Check your connection and try again.",
        );
      }
    } catch (err) {
      console.error("API Error:", err);
      console.error("Error Response:", err.response?.data);
      setError(
        err.response?.data?.message ||
          "Couldn't load this client. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const slug = editData.client_slug;
    if (!isEditing || !slug || slug.length !== 4) {
      setSlugAvailability(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const token = getToken();
        const response = await axios.get(
          `/api/v1/client/slug-availability?slug=${encodeURIComponent(slug)}&excludeId=${encodeURIComponent(id)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setSlugAvailability(response.data.available);
      } catch {
        setSlugAvailability(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [editData.client_slug, id, isEditing, getToken]);

  const handleEdit = () => {
    if (client) {
      setEditData({
        client_type: client.client_type || "",
        client_name: client.client_name || "",
        client_slug:
          client.client_slug || generateClientSlug(client.client_name),
        client_address: client.client_address || "",
        client_phone: client.client_phone || "",
        client_email: client.client_email || "",
        client_website: client.client_website || "",
        client_notes: client.client_notes || "",
      });
      setFieldErrors({});
      setIsEditing(true);
      setSlugTouched(false);
    }
  };

  const handleSave = async () => {
    if (isUpdating) return;

    // Validate on submit, then focus the first invalid field (DESIGN.md 15.3).
    const slug = editData.client_slug || "";
    if (!/^[A-Z]{4}$/.test(slug) || slugAvailability === false) {
      setFieldErrors({
        client_slug:
          slugAvailability === false && /^[A-Z]{4}$/.test(slug)
            ? "This client slug is already taken."
            : "Enter exactly 4 letters.",
      });
      setTimeout(() => {
        document.getElementById("client-slug")?.focus();
      }, 0);
      return;
    }

    try {
      setIsUpdating(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
        return;
      }

      const formatPhone = (phone) => {
        return phone ? formatPhoneToNational(phone) : phone;
      };

      const dataToSend = {
        ...editData,
        client_phone: formatPhone(editData.client_phone),
      };

      const response = await axios.patch(`/api/v1/client/${id}`, dataToSend, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.data.status) {
        setClient(response.data.data);
        toast.success("Client updated.");
        setIsEditing(false);
        setFieldErrors({});
      } else {
        toast.error(
          response.data.message ||
            "Couldn't save the client. Check the details and try again.",
        );
      }
    } catch (error) {
      console.error("Error updating client:", error);
      toast.error(
        error.response?.data?.message ||
          "Couldn't save the client. Check your connection and try again.",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
    setFieldErrors({});
  };

  const handleInputChange = (field, value) => {
    setEditData((prev) => ({
      ...prev,
      [field]: field === "client_slug" ? normalizeClientSlug(value) : value,
      ...(field === "client_name" && !slugTouched
        ? { client_slug: generateClientSlug(value) }
        : {}),
    }));
    if (field === "client_slug") setSlugTouched(true);
    // Validate on submit, then clear each message as the field is edited.
    if (
      fieldErrors[field] ||
      (field === "client_name" && fieldErrors.client_slug && !slugTouched)
    ) {
      setFieldErrors((prev) => ({
        ...prev,
        [field]: null,
        ...(field === "client_name" && !slugTouched
          ? { client_slug: null }
          : {}),
      }));
    }
  };

  // Calculate counts for active and completed projects
  const projectCounts = useMemo(() => {
    if (!client?.projects) {
      return { active: 0, completed: 0 };
    }

    let activeCount = 0;
    let completedCount = 0;

    client.projects.forEach((project) => {
      const lots = project.lots || [];

      // Projects with no lots are considered active
      if (lots.length === 0) {
        activeCount++;
      } else {
        // Check if project has active lots
        const hasActiveLot = lots.some((lot) => lot.status === "ACTIVE");
        // Check if project has completed lots
        const hasCompletedLot = lots.some((lot) => lot.status === "COMPLETED");

        if (hasActiveLot) activeCount++;
        if (hasCompletedLot) completedCount++;
      }
    });

    return { active: activeCount, completed: completedCount };
  }, [client?.projects]);

  // Filter and sort projects
  const filteredAndSortedProjects = useMemo(() => {
    if (!client?.projects) return [];

    let filtered = client.projects.filter((project) => {
      // Tab filter - project must have at least one lot with matching status
      // If project has no lots, show it in ACTIVE tab
      const lots = project.lots || [];
      if (lots.length === 0) {
        // Show projects with no lots in ACTIVE tab only
        if (activeTab !== "ACTIVE") return false;
      } else {
        // For projects with lots, check if any lot matches the active tab status
        const hasMatchingLot = lots.some((lot) => lot.status === activeTab);
        if (!hasMatchingLot) return false;
      }

      // Search filter
      if (search) {
        const searchLower = search.toLowerCase();
        const matchesSearch =
          (project.project_id &&
            project.project_id.toLowerCase().includes(searchLower)) ||
          (project.name && project.name.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }
      return true;
    });

    // Sort projects
    filtered.sort((a, b) => {
      let aValue = a[sortField] || "";
      let bValue = b[sortField] || "";

      // Handle number of lots sorting
      if (sortField === "number_of_lots") {
        aValue = a.lots ? a.lots.length : 0;
        bValue = b.lots ? b.lots.length : 0;
      }
      // Handle date sorting
      else if (sortField === "createdAt" || sortField === "updatedAt") {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else {
        aValue = aValue.toString().toLowerCase();
        bValue = bValue.toString().toLowerCase();
      }

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [client?.projects, search, sortField, sortOrder, activeTab]);

  // Pagination logic
  const totalPages = Math.ceil(filteredAndSortedProjects.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProjects = filteredAndSortedProjects.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field) => {
    if (sortField !== field)
      return <ArrowUpDown className="w-4 h-4" aria-hidden="true" />;
    if (sortOrder === "asc")
      return <ArrowUp className="w-4 h-4" aria-hidden="true" />;
    if (sortOrder === "desc")
      return <ArrowDown className="w-4 h-4" aria-hidden="true" />;
    return null;
  };

  const isAnyFilterActive = () => {
    return search !== "" || sortField !== "project_id" || sortOrder !== "asc";
  };

  const handleReset = () => {
    resetFilters();
    setCurrentPage(1);
  };

  const toggleProjectExpansion = (projectId) => {
    setExpandedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const handleDeleteClientConfirm = async () => {
    try {
      setIsDeletingClient(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
        return;
      }
      const response = await axios.delete(
        `/api/v1/client/${client.client_id}`,
        {
          headers: { Authorization: `Bearer ${sessionToken}` },
        },
      );
      if (!response?.data?.status) {
        toast.error(
          response?.data?.message || "Couldn't delete the client. Try again.",
        );
        return;
      }
      toast.success("Client deleted.");
      setShowDeleteClientModal(false);
      // Navigate back to clients list
      router.push("/admin/clients");
    } catch (err) {
      console.error("Delete client failed", err);
      toast.error(
        err?.response?.data?.message ||
          "Couldn't delete the client. Check your connection and try again.",
      );
    } finally {
      setIsDeletingClient(false);
    }
  };

  const handleNumberOfLotsChange = (e) => {
    const value = e.target.value;
    const numLots = parseInt(value) || 0;

    setNumberOfLots(value);

    // Create or update lots array
    if (numLots > 0 && numLots <= 100) {
      const newLots = Array.from({ length: numLots }, (_, index) => {
        // Preserve existing lot data if available, otherwise create new with default lotId
        return (
          lots[index] || {
            lotId: `lot ${index + 1}`,
            clientName: "",
            installationDueDate: "",
            notes: "",
          }
        );
      });
      setLots(newLots);
    } else if (numLots === 0 || value === "") {
      setLots([]);
    }
  };

  const handleLotChange = (index, field, value) => {
    const updatedLots = [...lots];
    updatedLots[index] = {
      ...updatedLots[index],
      [field]: value,
    };
    setLots(updatedLots);
    if (lotErrors[index]?.[field]) {
      setLotErrors((prev) => ({
        ...prev,
        [index]: { ...prev[index], [field]: null },
      }));
    }
  };

  const handleNewProjectChange = (field, value) => {
    setNewProject((prev) => ({ ...prev, [field]: value }));
    if (projectErrors[field]) {
      setProjectErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const closeAddProjectModal = () => {
    setShowAddProjectModal(false);
    setNewProject(EMPTY_NEW_PROJECT);
    setNumberOfLots("");
    setLots([]);
    setProjectErrors({});
    setLotErrors({});
  };

  // The generated project ID is not user input, so it does not count as dirty.
  const addProjectDirty = Boolean(
    newProject.name ||
    newProject.startDate ||
    newProject.sync_all_lots ||
    numberOfLots ||
    lots.length > 0,
  );

  const handleCreateProject = async () => {
    if (isCreatingProject || !client?.client_id) return;

    // Validate on submit, then focus the first invalid field (DESIGN.md 15.3).
    const nextProjectErrors = {};
    if (!newProject.name.trim()) {
      nextProjectErrors.name = "Enter a project name.";
    }
    const nextLotErrors = {};
    let firstInvalidId = nextProjectErrors.name ? "project-name" : null;
    lots.forEach((lot, index) => {
      const errors = {};
      if (!lot.lotId || !lot.lotId.trim()) errors.lotId = "Enter a lot ID.";
      if (!lot.clientName || !lot.clientName.trim())
        errors.clientName = "Enter a client name.";
      if (Object.keys(errors).length > 0) {
        nextLotErrors[index] = errors;
        if (!firstInvalidId) {
          firstInvalidId = errors.lotId
            ? `lot-${index}-lotId`
            : `lot-${index}-clientName`;
        }
      }
    });
    setProjectErrors(nextProjectErrors);
    setLotErrors(nextLotErrors);
    if (firstInvalidId) {
      setTimeout(() => {
        document.getElementById(firstInvalidId)?.focus();
      }, 0);
      return;
    }

    try {
      setIsCreatingProject(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
        return;
      }

      const clientIdToSend =
        client?.client_id && client.client_id.trim() !== ""
          ? client.client_id.trim()
          : null;

      // Prepare lots data - map to API format
      // Construct full lot_id as "projectid-lotid"
      const lotsToSend =
        lots && lots.length > 0
          ? lots.map((lot) => {
              const fullLotId = newProject.project_id
                ? `${newProject.project_id}-${lot.lotId}`
                : lot.lotId;
              return {
                lotId: fullLotId,
                clientName: lot.clientName,
                installationDueDate: lot.installationDueDate || null,
                notes: lot.notes || null,
              };
            })
          : [];

      const data = {
        name: newProject.name,
        project_id: newProject.project_id,
        client_id: clientIdToSend,
        startDate: newProject.startDate || null,
        lots: lotsToSend,
        sync_all_lots: newProject.sync_all_lots,
      };

      const response = await axios.post("/api/v1/project/create", data, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response?.data?.status !== true) {
        toast.error(
          response?.data?.message ||
            "Couldn't create the project. Check the details and try again.",
        );
        return;
      }

      toast.success("Project created.");

      // Reset form and close modal
      closeAddProjectModal();

      // Refresh client data to show the new project
      await fetchClient(id);
    } catch (err) {
      console.error("Create project failed", err);
      toast.error(
        err?.response?.data?.message ||
          "Couldn't create the project. Check your connection and try again.",
      );
    } finally {
      setIsCreatingProject(false);
    }
  };

  const phoneError =
    editData.client_phone && !validatePhone(editData.client_phone)
      ? "Enter a valid Australian phone number."
      : null;
  const slugError =
    fieldErrors.client_slug ||
    (slugAvailability === false ? "This client slug is already taken." : null);
  const hasNoProjects = !client?.projects || client.projects.length === 0;

  const tabClass = (tab) =>
    `cursor-pointer py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
      activeTab === tab
        ? "border-primary text-primary"
        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
    }`;

  return (
    <AdminShell>
      <main className="h-full overflow-y-auto">
        {loading ? (
          <div
            className="flex items-center justify-center h-full"
            role="status"
          >
            <div className="text-center">
              <div
                className="animate-spin rounded-full w-8 h-8 border-2 border-primary border-t-transparent mx-auto mb-4"
                aria-hidden="true"
              />
              <p className="text-sm text-slate-600">
                Loading client details...
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertTriangle
                className="w-8 h-8 text-red-500 mx-auto mb-4"
                aria-hidden="true"
              />
              <p className="text-sm text-red-600 mb-4" role="alert">
                {error}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className={`${BTN_PRIMARY} mx-auto`}
              >
                Try again
              </button>
            </div>
          </div>
        ) : !client ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <User
                className="w-8 h-8 text-slate-300 mx-auto mb-4"
                aria-hidden="true"
              />
              <p className="text-sm text-slate-600">
                This client could not be found. They may have been deleted.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3">
            {/* Header: back, record name, record actions */}
            <div className="flex items-center gap-3 mb-4">
              <TabsController back={true}>
                <span className="cursor-pointer flex p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200">
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                  <span className="sr-only">Back</span>
                </span>
              </TabsController>
              <div className="flex-1 flex flex-wrap items-center gap-3 min-w-0">
                <h1 className="text-xl font-semibold text-slate-800 truncate">
                  {client.client_name}
                </h1>
              </div>
              <div className="flex gap-2">
                {!isEditing ? (
                  <div className="relative" ref={moreMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowDropdown(!showDropdown)}
                      aria-haspopup="menu"
                      aria-expanded={showDropdown}
                      className={BTN_SECONDARY}
                    >
                      <MoreVertical className="w-4 h-4" aria-hidden="true" />
                      <span>More actions</span>
                    </button>

                    {showDropdown && (
                      <div
                        role="menu"
                        className="absolute right-0 mt-1 w-56 bg-white border border-slate-300 rounded-lg z-40"
                      >
                        <div className="py-1">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              handleEdit();
                              setShowDropdown(false);
                            }}
                            className={`${MENU_ITEM} text-slate-700`}
                          >
                            <Edit className="w-4 h-4" aria-hidden="true" />
                            Edit client details
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setShowDeleteClientModal(true);
                              setShowDropdown(false);
                            }}
                            className={`${MENU_ITEM} text-red-700 hover:bg-red-50`}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                            Delete client
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={isUpdating}
                      className={BTN_SECONDARY}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      form="client-edit-form"
                      disabled={isUpdating}
                      className={BTN_PRIMARY}
                    >
                      {isUpdating ? (
                        <Spinner />
                      ) : (
                        <Check className="w-4 h-4" aria-hidden="true" />
                      )}
                      Save changes
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {/* Basic Information and Contacts Section */}
              <div className="grid grid-cols-10 gap-4">
                {/* Basic Information - 70% width */}
                <div className="col-span-7">
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start gap-4">
                      <div
                        className="w-16 h-16 shrink-0 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-slate-700 text-lg font-semibold"
                        aria-hidden="true"
                      >
                        {getInitials(client.client_name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <form
                            id="client-edit-form"
                            noValidate
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleSave();
                            }}
                            className="space-y-4"
                          >
                            <p className="text-xs text-slate-500">
                              Client ID:{" "}
                              <span className="font-mono">
                                {client.client_id}
                              </span>
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label
                                  htmlFor="client-name"
                                  className="block text-sm font-medium text-slate-700 mb-1.5"
                                >
                                  Client name
                                </label>
                                <input
                                  id="client-name"
                                  type="text"
                                  value={editData.client_name || ""}
                                  onChange={(e) =>
                                    handleInputChange(
                                      "client_name",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="e.g. Smith Constructions"
                                  className={`${FIELD} ${fieldTone(false)}`}
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="client-slug"
                                  className="block text-sm font-medium text-slate-700 mb-1.5"
                                >
                                  Client slug{" "}
                                  <span className="text-red-600">*</span>
                                </label>
                                <input
                                  id="client-slug"
                                  type="text"
                                  value={editData.client_slug || ""}
                                  maxLength={4}
                                  onChange={(e) =>
                                    handleInputChange(
                                      "client_slug",
                                      e.target.value,
                                    )
                                  }
                                  aria-invalid={!!slugError}
                                  aria-describedby={
                                    slugError
                                      ? "client-slug-error"
                                      : "client-slug-hint"
                                  }
                                  className={`${FIELD} font-mono tracking-widest ${fieldTone(
                                    slugError,
                                  )}`}
                                />
                                {slugError ? (
                                  <FieldError
                                    id="client-slug-error"
                                    message={slugError}
                                  />
                                ) : (
                                  <p
                                    id="client-slug-hint"
                                    className="text-xs text-slate-500 mt-1"
                                  >
                                    4 letters. Used to generate automated
                                    project IDs.
                                  </p>
                                )}
                              </div>
                              <div>
                                <label
                                  htmlFor="client-type"
                                  className="block text-sm font-medium text-slate-700 mb-1.5"
                                >
                                  Client type
                                </label>
                                <CustomDropdown
                                  id="client-type"
                                  options={CLIENT_TYPE_OPTIONS}
                                  value={editData.client_type || ""}
                                  onChange={(value) =>
                                    handleInputChange("client_type", value)
                                  }
                                  placeholder="Select a type"
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="client-email"
                                  className="block text-sm font-medium text-slate-700 mb-1.5"
                                >
                                  Email
                                </label>
                                <input
                                  id="client-email"
                                  type="email"
                                  value={editData.client_email || ""}
                                  onChange={(e) =>
                                    handleInputChange(
                                      "client_email",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="e.g. accounts@example.com"
                                  className={`${FIELD} ${fieldTone(false)}`}
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="client-phone"
                                  className="block text-sm font-medium text-slate-700 mb-1.5"
                                >
                                  Phone
                                </label>
                                <input
                                  id="client-phone"
                                  type="tel"
                                  value={editData.client_phone || ""}
                                  onChange={(e) =>
                                    handleInputChange(
                                      "client_phone",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="e.g. 0400 123 456 or +61 400 123 456"
                                  aria-invalid={!!phoneError}
                                  aria-describedby={
                                    phoneError
                                      ? "client-phone-error"
                                      : undefined
                                  }
                                  className={`${FIELD} ${fieldTone(phoneError)}`}
                                />
                                <FieldError
                                  id="client-phone-error"
                                  message={phoneError}
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="client-website"
                                  className="block text-sm font-medium text-slate-700 mb-1.5"
                                >
                                  Website
                                </label>
                                <input
                                  id="client-website"
                                  type="url"
                                  value={editData.client_website || ""}
                                  onChange={(e) =>
                                    handleInputChange(
                                      "client_website",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="e.g. https://example.com"
                                  className={`${FIELD} ${fieldTone(false)}`}
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label
                                  htmlFor="client-address"
                                  className="block text-sm font-medium text-slate-700 mb-1.5"
                                >
                                  Address
                                </label>
                                <input
                                  id="client-address"
                                  type="text"
                                  value={editData.client_address || ""}
                                  onChange={(e) =>
                                    handleInputChange(
                                      "client_address",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="e.g. 5 Dundee Ave, Holden Hill SA 5088"
                                  className={`${FIELD} ${fieldTone(false)}`}
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label
                                  htmlFor="client-notes"
                                  className="block text-sm font-medium text-slate-700 mb-1.5"
                                >
                                  Notes
                                </label>
                                <textarea
                                  id="client-notes"
                                  value={editData.client_notes || ""}
                                  onChange={(e) =>
                                    handleInputChange(
                                      "client_notes",
                                      e.target.value,
                                    )
                                  }
                                  rows={3}
                                  className={`${FIELD} ${fieldTone(false)}`}
                                />
                              </div>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h2 className="text-lg font-semibold text-slate-800">
                                {client.client_name}
                              </h2>
                              {client.client_type && (
                                <span
                                  className={`${BADGE} ${BADGE_TONES.neutral}`}
                                >
                                  {formatLabel(client.client_type)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mb-3">
                              ID:{" "}
                              <span className="font-mono">
                                {client.client_id}
                              </span>
                            </p>
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-3 text-sm">
                                {client.client_email ? (
                                  <a
                                    href={`mailto:${client.client_email}`}
                                    className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors duration-200"
                                  >
                                    <Mail
                                      className="w-4 h-4"
                                      aria-hidden="true"
                                    />
                                    {client.client_email}
                                  </a>
                                ) : (
                                  <div className="flex items-center gap-2 text-slate-600">
                                    <Mail
                                      className="w-4 h-4"
                                      aria-hidden="true"
                                    />
                                    {EMPTY}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-slate-600">
                                  <Phone
                                    className="w-4 h-4"
                                    aria-hidden="true"
                                  />
                                  {formatValue(client.client_phone)}
                                </div>
                                <div className="flex items-center gap-2 text-slate-600">
                                  <Link2
                                    className="w-4 h-4"
                                    aria-hidden="true"
                                  />
                                  {client.client_website ? (
                                    <a
                                      className="text-primary hover:underline"
                                      href={client.client_website}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {client.client_website}
                                    </a>
                                  ) : (
                                    <span>{EMPTY}</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 text-slate-600 text-sm">
                                <MapPin
                                  className="w-4 h-4"
                                  aria-hidden="true"
                                />
                                {formatValue(client.client_address)}
                              </div>
                              <div className="flex items-start gap-2 text-slate-600">
                                <NotebookText
                                  className="w-4 h-4 mt-3 shrink-0"
                                  aria-hidden="true"
                                />
                                <div className="flex-1 text-sm text-slate-700 bg-slate-50 border border-slate-200 p-3 rounded-lg">
                                  {formatValue(client.client_notes)}
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contacts - 30% width */}
                <ContactSection
                  contacts={contacts}
                  onContactsUpdate={setContacts}
                  parentId={client?.client_id || ""}
                  parentType="client"
                  parentName={client?.client_name || ""}
                />
              </div>

              {/* Projects Table - Full Width */}
              <div className="bg-white rounded-lg border border-slate-200">
                <div className="flex items-center justify-between p-4 border-b border-slate-200">
                  <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Building className="w-5 h-5" aria-hidden="true" />
                    Jobs
                  </h2>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {filteredAndSortedProjects.length} of{" "}
                      {client?.projects?.length || 0} total
                    </span>
                    {/* Save changes is the primary action while editing */}
                    <button
                      type="button"
                      onClick={() => setShowAddProjectModal(true)}
                      className={isEditing ? BTN_SECONDARY : BTN_PRIMARY}
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      Add project
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-slate-200">
                  <nav
                    className="flex space-x-8 px-4"
                    role="tablist"
                    aria-label="Job status"
                  >
                    <button
                      type="button"
                      role="tab"
                      id="jobs-tab-active"
                      aria-selected={activeTab === "ACTIVE"}
                      aria-controls="jobs-panel"
                      onClick={() => {
                        setActiveTab("ACTIVE");
                        setCurrentPage(1);
                      }}
                      className={tabClass("ACTIVE")}
                    >
                      <div className="flex items-center gap-2">
                        Active
                        {projectCounts.active > 0 && (
                          <span className={COUNT_BADGE}>
                            {projectCounts.active}
                          </span>
                        )}
                      </div>
                    </button>
                    <button
                      type="button"
                      role="tab"
                      id="jobs-tab-completed"
                      aria-selected={activeTab === "COMPLETED"}
                      aria-controls="jobs-panel"
                      onClick={() => {
                        setActiveTab("COMPLETED");
                        setCurrentPage(1);
                      }}
                      className={tabClass("COMPLETED")}
                    >
                      <div className="flex items-center gap-2">
                        Completed
                        {projectCounts.completed > 0 && (
                          <span className={COUNT_BADGE}>
                            {projectCounts.completed}
                          </span>
                        )}
                      </div>
                    </button>
                  </nav>
                </div>

                <div
                  id="jobs-panel"
                  role="tabpanel"
                  aria-labelledby={
                    activeTab === "ACTIVE"
                      ? "jobs-tab-active"
                      : "jobs-tab-completed"
                  }
                >
                  {/* Search and Sort Controls */}
                  <div className="p-4 border-b border-slate-200">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 w-full max-w-sm relative">
                        <Search
                          className="w-4 h-4 absolute left-3 text-slate-500"
                          aria-hidden="true"
                        />
                        <input
                          type="text"
                          placeholder="Search projects..."
                          aria-label="Search projects"
                          className="w-full text-sm text-slate-800 pl-9 pr-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          value={search}
                          onChange={(e) => {
                            setSearch(e.target.value);
                            setCurrentPage(1);
                          }}
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        {isAnyFilterActive() && (
                          <button
                            type="button"
                            onClick={handleReset}
                            className="cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                          >
                            <RotateCcw className="w-4 h-4" aria-hidden="true" />
                            Reset
                          </button>
                        )}

                        <div className="relative" ref={sortMenuRef}>
                          <button
                            type="button"
                            onClick={() =>
                              setShowSortDropdown(!showSortDropdown)
                            }
                            aria-haspopup="menu"
                            aria-expanded={showSortDropdown}
                            className="cursor-pointer flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                          >
                            <ArrowUpDown
                              className="w-4 h-4"
                              aria-hidden="true"
                            />
                            <span>Sort</span>
                          </button>
                          {showSortDropdown && (
                            <div
                              role="menu"
                              aria-label="Sort projects"
                              className="absolute top-full right-0 mt-1 w-56 bg-white border border-slate-300 rounded-lg z-40"
                            >
                              <div className="py-1">
                                {SORT_OPTIONS.map(({ field, label }) => (
                                  <button
                                    key={field}
                                    type="button"
                                    role="menuitem"
                                    onClick={() => handleSort(field)}
                                    className={`${MENU_ITEM} text-slate-700 justify-between`}
                                  >
                                    <span>
                                      {label}
                                      {sortField === field && (
                                        <span className="sr-only">
                                          , sorted{" "}
                                          {sortOrder === "asc"
                                            ? "ascending"
                                            : "descending"}
                                        </span>
                                      )}
                                    </span>
                                    {getSortIcon(field)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {hasNoProjects || filteredAndSortedProjects.length === 0 ? (
                    <div className="flex flex-col items-center text-center py-12">
                      <Building
                        className="w-8 h-8 text-slate-300 mb-2"
                        aria-hidden="true"
                      />
                      <p className="text-sm text-slate-600">
                        {hasNoProjects
                          ? "No jobs yet for this client. Add a project to get started."
                          : search
                            ? "No jobs match your search."
                            : activeTab === "ACTIVE"
                              ? "No active jobs for this client."
                              : "No completed jobs for this client."}
                      </p>
                      {!hasNoProjects && isAnyFilterActive() && (
                        <button
                          type="button"
                          onClick={handleReset}
                          className={`${BTN_SECONDARY} mt-4`}
                        >
                          <RotateCcw className="w-4 h-4" aria-hidden="true" />
                          Clear filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50">
                            <tr>
                              <th
                                scope="col"
                                className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                              >
                                Project ID
                              </th>
                              <th
                                scope="col"
                                className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                              >
                                Name
                              </th>
                              <th
                                scope="col"
                                className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                              >
                                Created
                              </th>
                              <th
                                scope="col"
                                className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider"
                              >
                                Lots
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {currentProjects.map((project) => {
                              const isExpanded = expandedProjects.has(
                                project.project_id,
                              );
                              const allLots = project.lots || [];
                              // Filter lots based on active tab
                              const projectLots = allLots.filter(
                                (lot) => lot.status === activeTab,
                              );
                              const projectHref = `/admin/projects/${project.project_id}`;
                              return (
                                <React.Fragment key={project.id}>
                                  <tr className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleProjectExpansion(
                                            project.project_id,
                                          );
                                        }}
                                        aria-expanded={isExpanded}
                                        aria-controls={`lots-${project.id}`}
                                        className="cursor-pointer flex items-center gap-2 text-sm font-medium text-slate-800 transition-colors duration-200"
                                      >
                                        {isExpanded ? (
                                          <ChevronDown
                                            className="w-4 h-4"
                                            aria-hidden="true"
                                          />
                                        ) : (
                                          <ChevronRight
                                            className="w-4 h-4"
                                            aria-hidden="true"
                                          />
                                        )}
                                        <span className="font-mono">
                                          {project.project_id}
                                        </span>
                                        <span className="sr-only">
                                          , show lots
                                        </span>
                                      </button>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-700">
                                      <Link
                                        href={projectHref}
                                        title={project.name}
                                        className="block truncate max-w-md transition-colors duration-200"
                                      >
                                        {formatValue(project.name)}
                                      </Link>
                                    </td>
                                    <td
                                      className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 cursor-pointer"
                                      onClick={() => router.push(projectHref)}
                                    >
                                      {formatDate(project.createdAt)}
                                    </td>
                                    <td
                                      className="px-4 py-3 whitespace-nowrap text-sm text-slate-700 text-right font-mono cursor-pointer"
                                      onClick={() => router.push(projectHref)}
                                    >
                                      {projectLots.length}
                                    </td>
                                  </tr>
                                  {isExpanded && (
                                    <tr id={`lots-${project.id}`}>
                                      <td
                                        colSpan={4}
                                        className="px-4 py-4 bg-slate-50"
                                      >
                                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
                                            <h3 className="text-sm font-semibold text-slate-700">
                                              Lots ({projectLots.length})
                                            </h3>
                                          </div>
                                          {projectLots.length === 0 ? (
                                            <div className="flex flex-col items-center text-center py-12">
                                              <Building
                                                className="w-8 h-8 text-slate-300 mb-2"
                                                aria-hidden="true"
                                              />
                                              <p className="text-sm text-slate-600">
                                                No lots for this project.
                                              </p>
                                            </div>
                                          ) : (
                                            <div className="overflow-x-auto">
                                              <table className="w-full">
                                                <thead className="bg-slate-50">
                                                  <tr>
                                                    <th
                                                      scope="col"
                                                      className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                                                    >
                                                      Lot ID
                                                    </th>
                                                    <th
                                                      scope="col"
                                                      className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                                                    >
                                                      Name
                                                    </th>
                                                    <th
                                                      scope="col"
                                                      className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                                                    >
                                                      Start date
                                                    </th>
                                                    <th
                                                      scope="col"
                                                      className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                                                    >
                                                      Installation due
                                                    </th>
                                                    <th
                                                      scope="col"
                                                      className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"
                                                    >
                                                      Latest stage
                                                    </th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                  {projectLots.map((lot) => {
                                                    const latestStage =
                                                      getLatestStage(
                                                        lot.stages,
                                                      );
                                                    return (
                                                      <tr
                                                        key={lot.id}
                                                        onClick={() =>
                                                          router.push(
                                                            projectHref,
                                                          )
                                                        }
                                                        className="cursor-pointer hover:bg-slate-50 transition-colors"
                                                      >
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-800">
                                                          <Link
                                                            href={projectHref}
                                                            onClick={(e) =>
                                                              e.stopPropagation()
                                                            }
                                                            className="font-mono transition-colors duration-200"
                                                          >
                                                            {lot.lot_id}
                                                          </Link>
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                                                          {formatValue(
                                                            lot.name,
                                                          )}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                                                          {formatDate(
                                                            lot.startDate,
                                                          )}
                                                        </td>
                                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                                                          {isInstallationDueSoon(
                                                            lot.installationDueDate,
                                                          ) ? (
                                                            <span
                                                              className={`${BADGE} ${BADGE_TONES.warning}`}
                                                            >
                                                              <AlertTriangle
                                                                className="w-3 h-3"
                                                                aria-hidden="true"
                                                              />
                                                              {formatDate(
                                                                lot.installationDueDate,
                                                              )}
                                                              <span className="sr-only">
                                                                , due within 7
                                                                days
                                                              </span>
                                                            </span>
                                                          ) : (
                                                            formatDate(
                                                              lot.installationDueDate,
                                                            )
                                                          )}
                                                        </td>
                                                        <td className="px-4 py-3 text-sm text-slate-700">
                                                          {latestStage ? (
                                                            <div className="flex items-center gap-2">
                                                              <span
                                                                className="truncate max-w-48"
                                                                title={
                                                                  latestStage.name
                                                                }
                                                              >
                                                                {
                                                                  latestStage.name
                                                                }
                                                              </span>
                                                              <span
                                                                className={`${BADGE} ${
                                                                  STATUS_COLORS[
                                                                    latestStage
                                                                      .status
                                                                  ] ||
                                                                  BADGE_TONES.neutral
                                                                }`}
                                                              >
                                                                {formatLabel(
                                                                  latestStage.status,
                                                                )}
                                                              </span>
                                                            </div>
                                                          ) : (
                                                            <span
                                                              className={`${BADGE} ${BADGE_TONES.muted}`}
                                                            >
                                                              No stages
                                                            </span>
                                                          )}
                                                        </td>
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <PaginationFooter
                          totalItems={filteredAndSortedProjects.length}
                          itemsPerPage={itemsPerPage}
                          currentPage={currentPage}
                          onPageChange={handlePageChange}
                          showItemsPerPage={false}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Delete Client Confirmation Modal */}
      <DeleteConfirmation
        isOpen={showDeleteClientModal}
        onClose={() => setShowDeleteClientModal(false)}
        onConfirm={handleDeleteClientConfirm}
        deleteWithInput={true}
        heading="Client"
        title={client ? `Delete ${client.client_name}?` : "Delete client?"}
        warningHeading="This removes the client record"
        message={
          client
            ? `${client.client_name} (${client.client_id}) and all of its contacts will be deleted.`
            : "The client and all of its contacts will be deleted."
        }
        confirmButtonText="Delete client"
        comparingName={client?.client_name || ""}
        isDeleting={isDeletingClient}
        entityType="client"
      />

      {/* Add Project Modal */}
      {showAddProjectModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
          onClick={() => {
            // Keep typed-in work on a stray backdrop click (DESIGN.md 15.1).
            if (!addProjectDirty && !isCreatingProject) closeAddProjectModal();
          }}
        >
          <div
            ref={addProjectModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-project-title"
            className="bg-white w-full max-w-2xl rounded-xl border border-slate-200 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div>
                <h2
                  id="add-project-title"
                  className="text-lg font-semibold text-slate-800"
                >
                  Add project
                </h2>
                <p className="text-xs text-slate-500">
                  Client: {client?.client_name || EMPTY}
                </p>
              </div>
              <button
                type="button"
                onClick={closeAddProjectModal}
                disabled={isCreatingProject}
                className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateProject();
              }}
              className="flex flex-col min-h-0"
            >
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Project Information Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-slate-700">
                    Project information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="project-name"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Project name <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="project-name"
                        type="text"
                        data-autofocus
                        value={newProject.name}
                        onChange={(e) =>
                          handleNewProjectChange("name", e.target.value)
                        }
                        placeholder="e.g. 5 Dundee Ave, Holden Hill SA 5088"
                        aria-invalid={!!projectErrors.name}
                        aria-describedby={
                          projectErrors.name ? "project-name-error" : undefined
                        }
                        className={`${FIELD} ${fieldTone(projectErrors.name)}`}
                      />
                      <FieldError
                        id="project-name-error"
                        message={projectErrors.name}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="project-id"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Project ID
                      </label>
                      <input
                        id="project-id"
                        type="text"
                        value={newProject.project_id}
                        disabled
                        placeholder="Generating..."
                        className="w-full text-sm font-mono text-slate-600 px-4 py-3 border border-slate-300 bg-slate-50 rounded-lg cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="project-start-date"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Start date
                      </label>
                      <input
                        id="project-start-date"
                        type="date"
                        value={newProject.startDate}
                        onChange={(e) =>
                          handleNewProjectChange("startDate", e.target.value)
                        }
                        className={`${FIELD} ${fieldTone(false)}`}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="project-number-of-lots"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Number of lots
                      </label>
                      <input
                        id="project-number-of-lots"
                        type="number"
                        min="0"
                        max="100"
                        value={numberOfLots}
                        onChange={handleNumberOfLotsChange}
                        aria-describedby="project-number-of-lots-hint"
                        className={`${FIELD} ${fieldTone(false)}`}
                        placeholder="e.g. 3"
                      />
                      <p
                        id="project-number-of-lots-hint"
                        className="text-xs text-slate-500 mt-1"
                      >
                        Up to 100 lots.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newProject.sync_all_lots}
                      onChange={(e) =>
                        handleNewProjectChange(
                          "sync_all_lots",
                          e.target.checked,
                        )
                      }
                      className="mt-0.5 h-4 w-4 cursor-pointer rounded-sm border-slate-300 accent-primary"
                    />
                    <span>
                      <span className="block text-sm font-medium text-slate-700">
                        Sync stages across all lots
                      </span>
                      <span className="block text-xs text-slate-500">
                        A stage change on one lot is automatically applied to
                        (or created on) every other lot in this project.
                      </span>
                    </span>
                  </label>
                </div>

                {/* Lots Section */}
                {lots.length > 0 && (
                  <div className="space-y-4 border-t border-slate-200 pt-6">
                    <h3 className="text-sm font-semibold text-slate-700">
                      Lot information
                    </h3>
                    <div className="space-y-4">
                      {lots.map((lot, index) => (
                        <div
                          key={index}
                          className="bg-slate-50 rounded-lg p-4 border border-slate-200"
                        >
                          <h4 className="text-sm font-semibold text-slate-700 mb-3">
                            Lot {index + 1}
                          </h4>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label
                                  htmlFor={`lot-${index}-lotId`}
                                  className="block text-sm font-medium text-slate-700 mb-1.5"
                                >
                                  Lot ID <span className="text-red-600">*</span>
                                </label>
                                <input
                                  id={`lot-${index}-lotId`}
                                  type="text"
                                  value={lot.lotId}
                                  onChange={(e) =>
                                    handleLotChange(
                                      index,
                                      "lotId",
                                      e.target.value,
                                    )
                                  }
                                  aria-invalid={!!lotErrors[index]?.lotId}
                                  aria-describedby={`lot-${index}-lotId-${
                                    lotErrors[index]?.lotId ? "error" : "hint"
                                  }`}
                                  className={`${FIELD} ${fieldTone(
                                    lotErrors[index]?.lotId,
                                  )}`}
                                  placeholder="e.g. Lot 1"
                                />
                                {lotErrors[index]?.lotId ? (
                                  <FieldError
                                    id={`lot-${index}-lotId-error`}
                                    message={lotErrors[index].lotId}
                                  />
                                ) : (
                                  <p
                                    id={`lot-${index}-lotId-hint`}
                                    className="text-xs text-slate-500 mt-1"
                                  >
                                    Lot ID will be:{" "}
                                    <span className="font-mono">
                                      {newProject.project_id
                                        ? `${newProject.project_id}-${lot.lotId || "XXX"}`
                                        : "PROJECT_ID-XXX"}
                                    </span>
                                  </p>
                                )}
                              </div>
                              <div>
                                <label
                                  htmlFor={`lot-${index}-clientName`}
                                  className="block text-sm font-medium text-slate-700 mb-1.5"
                                >
                                  Client name{" "}
                                  <span className="text-red-600">*</span>
                                </label>
                                <input
                                  id={`lot-${index}-clientName`}
                                  type="text"
                                  value={lot.clientName}
                                  onChange={(e) =>
                                    handleLotChange(
                                      index,
                                      "clientName",
                                      e.target.value,
                                    )
                                  }
                                  aria-invalid={!!lotErrors[index]?.clientName}
                                  aria-describedby={
                                    lotErrors[index]?.clientName
                                      ? `lot-${index}-clientName-error`
                                      : undefined
                                  }
                                  className={`${FIELD} ${fieldTone(
                                    lotErrors[index]?.clientName,
                                  )}`}
                                  placeholder="e.g. Sam Taylor"
                                />
                                <FieldError
                                  id={`lot-${index}-clientName-error`}
                                  message={lotErrors[index]?.clientName}
                                />
                              </div>
                            </div>
                            <div>
                              <label
                                htmlFor={`lot-${index}-installationDueDate`}
                                className="block text-sm font-medium text-slate-700 mb-1.5"
                              >
                                Installation due date
                              </label>
                              <input
                                id={`lot-${index}-installationDueDate`}
                                type="date"
                                value={lot.installationDueDate}
                                onChange={(e) =>
                                  handleLotChange(
                                    index,
                                    "installationDueDate",
                                    e.target.value,
                                  )
                                }
                                className={`${FIELD} ${fieldTone(false)}`}
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`lot-${index}-notes`}
                                className="block text-sm font-medium text-slate-700 mb-1.5"
                              >
                                Notes
                              </label>
                              <textarea
                                id={`lot-${index}-notes`}
                                value={lot.notes}
                                onChange={(e) =>
                                  handleLotChange(
                                    index,
                                    "notes",
                                    e.target.value,
                                  )
                                }
                                rows={2}
                                className={`${FIELD} ${fieldTone(false)} resize-none`}
                                placeholder="e.g. Access via the side gate"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={closeAddProjectModal}
                  disabled={isCreatingProject}
                  className={BTN_SECONDARY}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingProject}
                  className={BTN_PRIMARY}
                >
                  {isCreatingProject ? (
                    <Spinner />
                  ) : (
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  )}
                  Create project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
