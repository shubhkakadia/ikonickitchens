"use client";
import React from "react";
import Sidebar from "@/components/sidebar.jsx";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  Loader2,
} from "lucide-react";
import DeleteConfirmation from "@/components/DeleteConfirmation";

export default function ConfigPage() {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState("role");
  const tabs = [
    { id: "role", label: "Role" },
    { id: "hardware", label: "Hardware" },
    { id: "measuring_unit", label: "Measuring Unit" },
    { id: "finish", label: "Finish" },
  ];
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [formData, setFormData] = useState({ value: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch data based on active tab
  const fetchData = async (category) => {
    if (!category) return;
    try {
      setLoading(true);
      setError(null);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `/api/config/read_all_by_category`,
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        data: { category },
      };

      const response = await axios.request(config);
      if (response.data.status) {
        setData(response.data.data);
      } else {
        setError(response.data.message);
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error fetching config data:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to fetch data";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data when active tab changes
  useEffect(() => {
    fetchData(activeTab);
  }, [activeTab]);

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!search) return data;
    const searchLower = search.toLowerCase();
    return data.filter(
      (item) =>
        item.value?.toLowerCase().includes(searchLower) ||
        item.category?.toLowerCase().includes(searchLower)
    );
  }, [data, search]);

  // Pagination logic
  const totalItems = filteredData.length;
  const totalPages =
    itemsPerPage === 0 ? 1 : Math.ceil(totalItems / itemsPerPage);
  const startIndex = itemsPerPage === 0 ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // Handle create
  const handleCreate = async () => {
    if (!formData.value || !formData.value.trim()) {
      toast.error("Value is required");
      return;
    }

    try {
      setIsSubmitting(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `/api/config/create`,
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        data: {
          category: activeTab,
          value: formData.value.trim(),
        },
      };

      const response = await axios.request(config);
      if (response.data.status) {
        toast.success("Config created successfully");
        setShowCreateModal(false);
        setFormData({ value: "" });
        fetchData(activeTab);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error creating config:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create config";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit
  const handleEdit = async () => {
    if (!formData.value || !formData.value.trim()) {
      toast.error("Value is required");
      return;
    }

    if (!selectedItem || !selectedItem.id) {
      toast.error("No item selected for editing");
      return;
    }

    try {
      setIsSubmitting(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        setIsSubmitting(false);
        return;
      }

      const config = {
        method: "patch",
        maxBodyLength: Infinity,
        url: `/api/config/${selectedItem.id}`,
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        data: {
          value: formData.value.trim(),
        },
      };

      const response = await axios.request(config);
      
      if (response.data.status) {
        toast.success("Config updated successfully");
        setShowEditModal(false);
        setSelectedItem(null);
        setFormData({ value: "" });
        fetchData(activeTab);
      } else {
        toast.error(response.data.message || "Failed to update config");
      }
    } catch (error) {
      console.error("Error updating config:", error);
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to update config";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!selectedItem) return;

    try {
      setIsDeleting(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const config = {
        method: "delete",
        maxBodyLength: Infinity,
        url: `/api/config/${selectedItem.id}`,
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      };

      const response = await axios.request(config);
      if (response.data.status) {
        toast.success("Config deleted successfully");
        setShowDeleteModal(false);
        setSelectedItem(null);
        fetchData(activeTab);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      console.error("Error deleting config:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to delete config";
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  // Open edit modal
  const openEditModal = (item) => {
    setSelectedItem(item);
    setFormData({ value: item.value || "" });
    setShowEditModal(true);
  };

  // Open delete modal
  const openDeleteModal = (item) => {
    setSelectedItem(item);
    setShowDeleteModal(true);
  };

  // Close modals
  const closeModals = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setSelectedItem(null);
    setFormData({ value: "" });
  };

  return (
    <AdminRoute>
      <div className="flex h-screen bg-tertiary">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CRMLayout />
          <div className="flex-1 overflow-y-auto">
            <div className="p-6">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 mb-2">
                  Configuration Management
                </h1>
                <p className="text-slate-600">
                  Manage role, hardware, measuring unit, and finish configurations
                </p>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-12rem)] overflow-hidden">
                {/* Tabs Section */}
                <div className="px-6 shrink-0 border-b border-slate-200">
                  <nav className="-mb-px flex space-x-8 overflow-x-auto">
                    {tabs.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
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

                {/* Search Section */}
                <div className="p-4 shrink-0 border-b border-slate-200">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 flex-1 max-w-lg relative">
                      <Search className="h-4 w-4 absolute left-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder={`Search ${activeTab} items by value`}
                        className="w-full text-slate-800 p-2 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 text-sm font-normal"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <button
                      onClick={() => {
                        setFormData({ value: "" });
                        setShowCreateModal(true);
                      }}
                      className="cursor-pointer hover:bg-primary transition-all duration-200 bg-primary/80 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium shadow-sm shrink-0"
                    >
                      <Plus className="h-4 w-4" />
                      Add {activeTab === "role" ? "Role" : activeTab === "hardware" ? "Hardware" : activeTab === "measuring_unit" ? "Measuring Unit" : "Finish"}
                    </button>
                  </div>
                </div>

                {/* Table Section */}
                <div className="flex-1 overflow-auto">
                  <div className="min-w-full">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Value
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Created At
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Updated At
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-slate-200">
                        {loading ? (
                          <tr>
                            <td
                              className="px-6 py-4 text-sm text-slate-500 text-center"
                              colSpan={4}
                            >
                              <div className="flex items-center justify-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Loading {activeTab} items...
                              </div>
                            </td>
                          </tr>
                        ) : error ? (
                          <tr>
                            <td
                              className="px-6 py-4 text-sm text-red-600 text-center"
                              colSpan={4}
                            >
                              {error}
                            </td>
                          </tr>
                        ) : paginatedData.length === 0 ? (
                          <tr>
                            <td
                              className="px-6 py-4 text-sm text-slate-500 text-center"
                              colSpan={4}
                            >
                              {search
                                ? `No ${activeTab} items found matching your search`
                                : `No ${activeTab} items found`}
                            </td>
                          </tr>
                        ) : (
                          paginatedData.map((item) => (
                            <tr
                              key={item.id}
                              className="hover:bg-slate-50 transition-colors duration-200"
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                {item.value || "N/A"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                {item.createdAt
                                  ? new Date(item.createdAt).toLocaleDateString()
                                  : "N/A"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                {item.updatedAt
                                  ? new Date(item.updatedAt).toLocaleDateString()
                                  : "N/A"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openEditModal(item);
                                    }}
                                    className="cursor-pointer p-2 text-slate-600 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDeleteModal(item);
                                    }}
                                    className="cursor-pointer p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pagination Footer */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 shrink-0 border-t border-slate-200 flex items-center justify-between">
                    <div className="text-sm text-slate-600">
                      Showing {startIndex + 1} to{" "}
                      {Math.min(endIndex, totalItems)} of {totalItems} results
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="cursor-pointer px-3 py-1 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                          (page) => (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`cursor-pointer px-3 py-1 text-sm font-medium rounded ${
                                currentPage === page
                                  ? "bg-primary text-white"
                                  : "text-slate-500 bg-white border border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              {page}
                            </button>
                          )
                        )}
                      </div>
                      <button
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="cursor-pointer px-3 py-1 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50" onClick={closeModals}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">
                Add {activeTab === "role" ? "Role" : activeTab === "hardware" ? "Hardware" : activeTab === "measuring_unit" ? "Measuring Unit" : "Finish"}
              </h2>
              <button
                onClick={closeModals}
                className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Value <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.value}
                  onChange={(e) =>
                    setFormData({ ...formData, value: e.target.value })
                  }
                  placeholder={`Enter ${activeTab} value`}
                  className="w-full text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={closeModals}
                  className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={isSubmitting || !formData.value?.trim()}
                  className="cursor-pointer px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedItem && (
        <div className="fixed inset-0 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-50" onClick={closeModals}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">
                Edit {activeTab === "role" ? "Role" : activeTab === "hardware" ? "Hardware" : activeTab === "measuring_unit" ? "Measuring Unit" : "Finish"}
              </h2>
              <button
                onClick={closeModals}
                className="cursor-pointer p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Value <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.value}
                  onChange={(e) =>
                    setFormData({ ...formData, value: e.target.value })
                  }
                  placeholder={`Enter ${activeTab} value`}
                  className="w-full text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={closeModals}
                  className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEdit}
                  disabled={isSubmitting || !formData.value?.trim()}
                  className="cursor-pointer px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmation
        isOpen={showDeleteModal}
        onClose={closeModals}
        onConfirm={handleDelete}
        heading={`${activeTab === "role" ? "Role" : activeTab === "hardware" ? "Hardware" : activeTab === "measuring_unit" ? "Measuring Unit" : "Finish"}`}
        message={`Are you sure you want to delete "${selectedItem?.value}"? This action cannot be undone.`}
        isDeleting={isDeleting}
      />
    </AdminRoute>
  );
}
