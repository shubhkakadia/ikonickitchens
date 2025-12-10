"use client";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useState, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import CRMLayout from "@/components/tabs";
import TabsController from "@/components/tabscontroller";
import {
  ChevronLeft,
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
  AlertTriangle,
  Calendar,
  Building,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import ContactSection from "@/components/ContactSection";
import { CiMenuKebab } from "react-icons/ci";
import { AdminRoute } from "@/components/ProtectedRoute";

export default function page() {
  const { id } = useParams();
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
  const [itemsPerPage] = useState(5);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("project_id");
  const [sortOrder, setSortOrder] = useState("asc");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    project_id: "",
  });
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [activeTab, setActiveTab] = useState("ACTIVE");

  useEffect(() => {
    fetchClient(id);
  }, [id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest(".dropdown-container")) {
        setShowDropdown(false);
      }
      if (showSortDropdown && !event.target.closest(".dropdown-container")) {
        setShowSortDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown, showSortDropdown]);

  const fetchClient = async (id) => {
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

      const response = await axios.get(`/api/client/${id}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        setClient(response.data.data);
        setContacts(response.data.data.contacts || []);
      } else {
        setError(response.data.message || "Failed to fetch client data");
      }
    } catch (err) {
      console.error("API Error:", err);
      console.error("Error Response:", err.response?.data);
      setError(
        err.response?.data?.message ||
        "An error occurred while fetching client data"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    if (client) {
      setEditData({
        client_type: client.client_type || "",
        client_name: client.client_name || "",
        client_address: client.client_address || "",
        client_phone: client.client_phone || "",
        client_email: client.client_email || "",
        client_website: client.client_website || "",
        client_notes: client.client_notes || "",
      });
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    try {
      setIsUpdating(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      const response = await axios.patch(`/api/client/${id}`, editData, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.data.status) {
        setClient(response.data.data);
        toast.success("Client updated successfully!", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        setIsEditing(false);
      } else {
        toast.error(response.data.message || "Failed to update client", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
      }
    } catch (error) {
      console.error("Error updating client:", error);
      toast.error(
        error.response?.data?.message ||
        "Failed to update client. Please try again.",
        {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        }
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
  };

  const handleInputChange = (field, value) => {
    setEditData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const formatValue = (value) => {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      value === "null"
    ) {
      return "-";
    }
    if (typeof value === "string" && value.trim() === "") {
      return "-";
    }
    return value;
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
    return `${parts[0][0] || ""}${parts[parts.length - 1][0] || ""
      }`.toUpperCase();
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (error) {
      return "-";
    }
  };

  const isInstallationDueSoon = (installationDate) => {
    if (!installationDate) return false;
    const today = new Date();
    const dueDate = new Date(installationDate);
    const diffTime = dueDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0;
  };

  const getStageStatusSummary = (stages) => {
    if (!stages || stages.length === 0) {
      return { text: "No stages", color: "text-slate-500" };
    }

    // Sort stages by createdAt to get the last/most recent stage
    const sortedStages = [...stages].sort((a, b) => {
      const dateA = new Date(a.createdAt || 0);
      const dateB = new Date(b.createdAt || 0);
      return dateB - dateA; // Most recent first
    });

    const lastStage = sortedStages[0];

    // If last stage is DONE, show stage name and "Done"
    if (lastStage.status === "DONE") {
      return {
        text: `${lastStage.name} - Done`,
        color: "text-green-600",
      };
    }

    // If last stage is IN_PROGRESS, show stage name and "In Progress"
    if (lastStage.status === "IN_PROGRESS") {
      return {
        text: `${lastStage.name} - In Progress`,
        color: "text-blue-600",
      };
    }

    // For other statuses (NOT_STARTED, NA), show stage name and status
    const statusText = lastStage.status
      .split("_")
      .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
      .join(" ");

    return {
      text: `${lastStage.name} - ${statusText}`,
      color: "text-slate-500",
    };
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
  };

  const getSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4" />;
    if (sortOrder === "asc") return <ArrowUp className="h-4 w-4" />;
    if (sortOrder === "desc") return <ArrowDown className="h-4 w-4" />;
    return null;
  };

  const isAnyFilterActive = () => {
    return search !== "" || sortField !== "project_id" || sortOrder !== "asc";
  };

  const handleReset = () => {
    setSearch("");
    setSortField("project_id");
    setSortOrder("asc");
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
        toast.error("No valid session found. Please login again.");
        return;
      }
      const response = await axios.delete(`/api/client/${client.client_id}`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!response?.data?.status) {
        toast.error(response?.data?.message || "Failed to delete client");
        return;
      }
      toast.success("Client deleted successfully");
      setShowDeleteClientModal(false);
      // Navigate back to clients list
      router.push("/admin/clients");
    } catch (err) {
      console.error("Delete client failed", err);
      toast.error(err?.response?.data?.message || "An error occurred");
    } finally {
      setIsDeletingClient(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name || !newProject.project_id) {
      toast.error("Project name and Project ID are required", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });
      return;
    }

    try {
      setIsCreatingProject(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      const clientIdToSend =
        client?.client_id && client.client_id.trim() !== ""
          ? client.client_id.trim()
          : null;

      const data = {
        name: newProject.name,
        project_id: newProject.project_id,
        client_id: clientIdToSend,
      };

      const response = await axios.post("/api/project/create", data, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response?.data?.status !== true) {
        toast.error(response?.data?.message || "Failed to create project", {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
        });
        return;
      }

      toast.success("Project created successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
      });

      // Reset form and close modal
      setNewProject({
        name: "",
        project_id: "",
      });
      setShowAddProjectModal(false);

      // Refresh client data to show the new project
      await fetchClient(id);
    } catch (err) {
      console.error("Create project failed", err);
      toast.error(
        err?.response?.data?.message ||
        "An error occurred while creating the project",
        {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
        }
      );
    } finally {
      setIsCreatingProject(false);
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
                  <p className="text-slate-600">Loading client details...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-red-600 mb-4">{error}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="cursor-pointer px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : !client ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <User className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">Client not found</p>
                </div>
              </div>
            ) : (
              <div className="p-3">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <TabsController href="/admin/clients" title="Clients">
                    <div className="cursor-pointer p-2 hover:bg-slate-200 rounded-lg transition-colors">
                      <ChevronLeft className="w-6 h-6 text-slate-600" />
                    </div>
                  </TabsController>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-600">
                      {client.client_name}
                    </h1>
                  </div>
                  <div className="flex gap-2">
                    {!isEditing ? (
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
                                  handleEdit();
                                  setShowDropdown(false);
                                }}
                                className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                              >
                                <Edit className="w-4 h-4" />
                                Edit Client Details
                              </button>
                              <button
                                onClick={() => {
                                  setShowDeleteClientModal(true);
                                  setShowDropdown(false);
                                }}
                                className="cursor-pointer w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center gap-3"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete Client
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={handleSave}
                          disabled={isUpdating}
                          className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Edit className="w-4 h-4" />
                          {isUpdating ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={handleCancel}
                          className="cursor-pointer flex items-center gap-2 px-4 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md transition-all duration-200 text-sm font-medium"
                        >
                          Cancel
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
                      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 bg-gradient-to-br from-secondary to-primary rounded-full flex items-center justify-center text-white text-lg font-bold">
                            {getInitials(client.client_name)}
                          </div>
                          <div className="flex-1">
                            {isEditing ? (
                              <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editData.client_name || ""}
                                    onChange={(e) =>
                                      handleInputChange(
                                        "client_name",
                                        e.target.value
                                      )
                                    }
                                    placeholder={client.client_name}
                                    className="text-xl font-bold text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                                  />
                                  <select
                                    value={editData.client_type || ""}
                                    onChange={(e) =>
                                      handleInputChange(
                                        "client_type",
                                        e.target.value
                                      )
                                    }
                                    className="cursor-pointer px-2 py-1 text-xs font-medium border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                                  >
                                    <option value="">Select Type</option>
                                    <option value="private">Private</option>
                                    <option value="builder">Builder</option>
                                    <option value="other">Other</option>
                                  </select>
                                </div>
                                <p className="text-sm text-slate-500">
                                  Client ID: {client.client_id}
                                </p>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Mail className="w-4 h-4 text-slate-600" />
                                    <input
                                      type="email"
                                      value={editData.client_email || ""}
                                      onChange={(e) =>
                                        handleInputChange(
                                          "client_email",
                                          e.target.value
                                        )
                                      }
                                      placeholder={
                                        client.client_email || "Email"
                                      }
                                      className="text-sm text-slate-600 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none flex-1"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-slate-600" />
                                    <input
                                      type="tel"
                                      value={editData.client_phone || ""}
                                      onChange={(e) =>
                                        handleInputChange(
                                          "client_phone",
                                          e.target.value
                                        )
                                      }
                                      placeholder={
                                        client.client_phone || "Phone"
                                      }
                                      className="text-sm text-slate-600 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none flex-1"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Link2 className="w-4 h-4 text-slate-600" />
                                    <input
                                      type="url"
                                      value={editData.client_website || ""}
                                      onChange={(e) =>
                                        handleInputChange(
                                          "client_website",
                                          e.target.value
                                        )
                                      }
                                      placeholder={
                                        client.client_website || "Website"
                                      }
                                      className="text-sm text-slate-600 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none flex-1"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-slate-600" />
                                    <input
                                      type="text"
                                      value={editData.client_address || ""}
                                      onChange={(e) =>
                                        handleInputChange(
                                          "client_address",
                                          e.target.value
                                        )
                                      }
                                      placeholder={
                                        client.client_address || "Address"
                                      }
                                      className="text-sm text-slate-600 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none flex-1"
                                    />
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <NotebookText className="w-4 h-4 text-slate-600 mt-1" />
                                    <textarea
                                      value={editData.client_notes || ""}
                                      onChange={(e) =>
                                        handleInputChange(
                                          "client_notes",
                                          e.target.value
                                        )
                                      }
                                      placeholder={formatValue(
                                        client.client_notes
                                      )}
                                      rows={3}
                                      className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none flex-1"
                                    />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 mb-2">
                                  <h2 className="text-lg font-bold text-slate-800">
                                    {client.client_name}
                                  </h2>
                                  <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full capitalize">
                                    {client.client_type}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mb-3">
                                  ID: {client.client_id}
                                </p>
                                <div className="space-y-1">
                                  <div className="flex flex-wrap gap-3 text-sm">
                                    <a href={`mailto:${client.client_email}`}>
                                      <div className="flex items-center gap-1.5 text-slate-600 hover:text-slate-800">
                                        <Mail className="w-3.5 h-3.5" />
                                        {formatValue(client.client_email)}
                                      </div>
                                    </a>
                                    <div className="flex items-center gap-1.5 text-slate-600">
                                      <Phone className="w-3.5 h-3.5" />
                                      {formatValue(client.client_phone)}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-600">
                                      <Link2 className="w-3.5 h-3.5" />
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
                                        <span>-</span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-600 text-sm">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {formatValue(client.client_address)}
                                  </div>
                                  <div className="flex items-start gap-1.5 text-slate-600">
                                    <NotebookText className="w-3.5 h-3.5 mt-0.5" />
                                    <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded">
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
                  <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between p-4 border-b border-slate-100">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        Jobs
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">
                          {filteredAndSortedProjects.length} of{" "}
                          {client?.projects?.length || 0} total
                        </span>
                        <button
                          onClick={() => setShowAddProjectModal(true)}
                          className="cursor-pointer flex items-center gap-2 px-3 py-1.5 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium"
                        >
                          <Plus className="w-4 h-4" />
                          Add Project
                        </button>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="border-b border-slate-200">
                      <nav className="flex space-x-8 px-4">
                        <button
                          onClick={() => {
                            setActiveTab("ACTIVE");
                            setCurrentPage(1);
                          }}
                          className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "ACTIVE"
                            ? "border-primary text-primary"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            Active
                            {projectCounts.active > 0 && (
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                {projectCounts.active}
                              </span>
                            )}
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            setActiveTab("COMPLETED");
                            setCurrentPage(1);
                          }}
                          className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm ${activeTab === "COMPLETED"
                            ? "border-primary text-primary"
                            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                            }`}
                        >
                          <div className="flex items-center gap-2">
                            Completed
                            {projectCounts.completed > 0 && (
                              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                {projectCounts.completed}
                              </span>
                            )}
                          </div>
                        </button>
                      </nav>
                    </div>

                    {/* Search and Sort Controls */}
                    <div className="p-4 border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 w-[350px] relative">
                          <Search className="h-4 w-4 absolute left-2.5 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Search projects..."
                            className="w-full text-slate-800 p-2 pl-8 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          {isAnyFilterActive() && (
                            <button
                              onClick={handleReset}
                              className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-600 border border-slate-300 px-3 py-1.5 rounded text-xs font-medium"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Reset
                            </button>
                          )}

                          <div className="relative dropdown-container">
                            <button
                              onClick={() =>
                                setShowSortDropdown(!showSortDropdown)
                              }
                              className="flex items-center gap-1.5 cursor-pointer hover:bg-slate-100 transition-all duration-200 text-slate-600 border border-slate-300 px-3 py-1.5 rounded text-xs font-medium"
                            >
                              <ArrowUpDown className="h-3.5 w-3.5" />
                              <span>Sort</span>
                            </button>
                            {showSortDropdown && (
                              <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
                                <div className="py-1">
                                  <button
                                    onClick={() => handleSort("project_id")}
                                    className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Project ID {getSortIcon("project_id")}
                                  </button>
                                  <button
                                    onClick={() => handleSort("name")}
                                    className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Name {getSortIcon("name")}
                                  </button>
                                  <button
                                    onClick={() => handleSort("createdAt")}
                                    className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Created Date {getSortIcon("createdAt")}
                                  </button>
                                  <button
                                    onClick={() => handleSort("number_of_lots")}
                                    className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center justify-between"
                                  >
                                    Number of Lots{" "}
                                    {getSortIcon("number_of_lots")}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {!client?.projects ||
                      client.projects.length === 0 ||
                      filteredAndSortedProjects.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        <Building className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        <p>
                          {activeTab === "ACTIVE"
                            ? "No active jobs found for this client"
                            : "No completed jobs found for this client"}
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Project ID
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Name
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Created Date
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Number of Lots
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                              {currentProjects.map((project) => {
                                const isExpanded = expandedProjects.has(
                                  project.project_id
                                );
                                const allLots = project.lots || [];
                                // Filter lots based on active tab
                                const filteredLots = allLots.filter(
                                  (lot) => lot.status === activeTab
                                );
                                // For display in table row, show count of filtered lots
                                const lots = filteredLots;
                                return (
                                  <React.Fragment key={project.id}>
                                    <tr className="hover:bg-slate-50 transition-colors">
                                      <td className="px-4 py-2 whitespace-nowrap">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleProjectExpansion(
                                              project.project_id
                                            );
                                          }}
                                          className="flex items-center gap-2 text-xs font-medium text-slate-900 hover:text-primary transition-colors"
                                        >
                                          {isExpanded ? (
                                            <ChevronRight className="w-4 h-4 rotate-90" />
                                          ) : (
                                            <ChevronRight className="w-4 h-4" />
                                          )}
                                          {project.project_id}
                                        </button>
                                      </td>
                                      <td
                                        className="px-4 py-2 whitespace-nowrap text-xs text-slate-600 cursor-pointer"
                                        onClick={() =>
                                          router.push(
                                            `/admin/projects/${project.project_id}`
                                          )
                                        }
                                      >
                                        <div className="flex items-center gap-1.5">
                                          {project.name}
                                        </div>
                                      </td>
                                      <td
                                        className="px-4 py-2 whitespace-nowrap text-xs text-slate-600 cursor-pointer"
                                        onClick={() =>
                                          router.push(
                                            `/admin/projects/${project.project_id}`
                                          )
                                        }
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                          {formatDate(project.createdAt)}
                                        </div>
                                      </td>
                                      <td
                                        className="px-4 py-2 whitespace-nowrap text-xs text-slate-600 cursor-pointer"
                                        onClick={() =>
                                          router.push(
                                            `/admin/projects/${project.project_id}`
                                          )
                                        }
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <Building className="w-3.5 h-3.5 text-slate-400" />
                                          {lots.length}
                                        </div>
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr>
                                        <td
                                          colSpan={4}
                                          className="px-4 py-4 bg-slate-50"
                                        >
                                          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                            <div className="px-4 py-2 bg-slate-100 border-b border-slate-200">
                                              <h4 className="text-xs font-semibold text-slate-700">
                                                Lots ({lots.length})
                                              </h4>
                                            </div>
                                            {lots.length === 0 ? (
                                              <div className="px-4 py-6 text-center text-xs text-slate-500">
                                                No lots found for this project
                                              </div>
                                            ) : (
                                              <div className="overflow-x-auto">
                                                <table className="w-full">
                                                  <thead className="bg-slate-50">
                                                    <tr>
                                                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                        Lot ID
                                                      </th>
                                                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                        Name
                                                      </th>
                                                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                        Start Date
                                                      </th>
                                                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                        Installation Due
                                                      </th>
                                                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                                        Stage Status
                                                      </th>
                                                    </tr>
                                                  </thead>
                                                  <tbody className="bg-white divide-y divide-slate-100">
                                                    {lots.map((lot) => {
                                                      const stageStatus =
                                                        getStageStatusSummary(
                                                          lot.stages
                                                        );
                                                      return (
                                                        <tr
                                                          key={lot.id}
                                                          onClick={() =>
                                                            router.push(
                                                              `/admin/projects/${project.project_id}`
                                                            )
                                                          }
                                                          className="cursor-pointer hover:bg-slate-50 transition-colors"
                                                        >
                                                          <td className="px-3 py-2 whitespace-nowrap text-xs font-medium text-slate-900">
                                                            {lot.lot_id}
                                                          </td>
                                                          <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-600">
                                                            {lot.name}
                                                          </td>
                                                          <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-600">
                                                            <div className="flex items-center gap-1.5">
                                                              <Calendar className="w-3 h-3 text-slate-400" />
                                                              {formatDate(
                                                                lot.startDate
                                                              )}
                                                            </div>
                                                          </td>
                                                          <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-600">
                                                            <div className="flex items-center gap-1.5">
                                                              {isInstallationDueSoon(
                                                                lot.installationDueDate
                                                              ) ? (
                                                                <>
                                                                  <AlertTriangle className="w-3 h-3 text-yellow-500" />
                                                                  <span className="text-yellow-600 font-medium">
                                                                    {formatDate(
                                                                      lot.installationDueDate
                                                                    )}
                                                                  </span>
                                                                </>
                                                              ) : (
                                                                <>
                                                                  <Calendar className="w-3 h-3 text-slate-400" />
                                                                  {formatDate(
                                                                    lot.installationDueDate
                                                                  )}
                                                                </>
                                                              )}
                                                            </div>
                                                          </td>
                                                          <td className="px-3 py-2 whitespace-nowrap">
                                                            <span
                                                              className={`text-xs font-medium ${stageStatus.color}`}
                                                            >
                                                              {stageStatus.text}
                                                            </span>
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
                          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
                            <div className="text-xs text-slate-500">
                              Showing {startIndex + 1} to{" "}
                              {Math.min(
                                endIndex,
                                filteredAndSortedProjects.length
                              )}{" "}
                              of {filteredAndSortedProjects.length} results
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() =>
                                  handlePageChange(currentPage - 1)
                                }
                                disabled={currentPage === 1}
                                className="px-2 py-1 text-xs font-medium text-slate-500 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Previous
                              </button>
                              <div className="flex items-center gap-1">
                                {Array.from(
                                  { length: totalPages },
                                  (_, i) => i + 1
                                ).map((page) => (
                                  <button
                                    key={page}
                                    onClick={() => handlePageChange(page)}
                                    className={`px-2 py-1 text-xs font-medium rounded ${currentPage === page
                                      ? "bg-primary text-white"
                                      : "text-slate-500 bg-white border border-slate-300 hover:bg-slate-50"
                                      }`}
                                  >
                                    {page}
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() =>
                                  handlePageChange(currentPage + 1)
                                }
                                disabled={currentPage === totalPages}
                                className="px-2 py-1 text-xs font-medium text-slate-500 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Delete Client Confirmation Modal */}
        <DeleteConfirmation
          isOpen={showDeleteClientModal}
          onClose={() => setShowDeleteClientModal(false)}
          onConfirm={handleDeleteClientConfirm}
          deleteWithInput={true}
          heading="Client"
          message="This will remove the client and all associated contacts. This action cannot be undone."
          comparingName={client?.client_name || ""}
          isDeleting={isDeletingClient}
        />

        {/* Add Project Modal */}
        {showAddProjectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs">
            <div
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => setShowAddProjectModal(false)}
            />
            <div className="relative bg-white w-full max-w-lg mx-4 rounded-xl shadow-xl border border-slate-200">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-slate-700">
                      Add New Project
                    </div>
                    <div className="text-xs text-slate-500">
                      Client: {client?.client_name || ""}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddProjectModal(false)}
                  className="cursor-pointer p-2 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) =>
                      setNewProject({
                        ...newProject,
                        name: e.target.value,
                      })
                    }
                    placeholder="Eg. 5 Dundee Ave, Holden Hill SA 5088"
                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Project ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newProject.project_id}
                    onChange={(e) =>
                      setNewProject({
                        ...newProject,
                        project_id: e.target.value,
                      })
                    }
                    placeholder="Eg. IK001"
                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowAddProjectModal(false);
                    setNewProject({
                      name: "",
                      project_id: "",
                    });
                  }}
                  disabled={isCreatingProject}
                  className="cursor-pointer px-4 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={isCreatingProject}
                  className="cursor-pointer px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingProject ? "Creating..." : "Create Project"}
                </button>
              </div>
            </div>
          </div>
        )}

        <ToastContainer />
      </div>
    </AdminRoute>
  );
}
