"use client";
import { AdminRoute } from "@/components/ProtectedRoute";
import CRMLayout from "@/components/tabs";
import TabsController from "@/components/tabscontroller";
import { ChevronLeft, FolderOpen, ChevronDown, Layers } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function page() {
  const [formData, setFormData] = useState({
    name: "",
    project_id: "",
    client_id: "",
    startDate: "",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const clientDropdownRef = useRef(null);
  const { getToken } = useAuth();
  const [numberOfLots, setNumberOfLots] = useState("");
  const [lots, setLots] = useState([]);

  // Fetch clients on component mount
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const sessionToken = getToken();
        if (!sessionToken) return;

        const response = await axios.get("/api/client/allnames", {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });

        if (response.data.status && response.data.data) {
          setClients(response.data.data);
          setFilteredClients(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching clients:", error);
      }
    };

    fetchClients();
  }, []);

  // Filter clients based on search term
  useEffect(() => {
    if (clientSearchTerm === "") {
      setFilteredClients(clients);
    } else {
      const filtered = clients.filter(
        (client) =>
          client.client_name
            .toLowerCase()
            .includes(clientSearchTerm.toLowerCase()) ||
          client.client_id
            .toLowerCase()
            .includes(clientSearchTerm.toLowerCase())
      );
      setFilteredClients(filtered);
    }
  }, [clientSearchTerm, clients]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        clientDropdownRef.current &&
        !clientDropdownRef.current.contains(event.target)
      ) {
        setIsClientDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleClientSelect = (clientId, clientName) => {
    setFormData({
      ...formData,
      client_id: clientId,
    });
    setClientSearchTerm(clientName);
    setIsClientDropdownOpen(false);
  };

  const handleClientSearchChange = (e) => {
    const value = e.target.value;
    setClientSearchTerm(value);
    setIsClientDropdownOpen(true);

    // Clear client_id if search term is cleared manually
    if (value === "") {
      setFormData({
        ...formData,
        client_id: "",
      });
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
        return lots[index] || {
          lotId: `lot ${index + 1}`,
          clientName: "",
          installationDueDate: "",
          notes: "",
        };
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
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
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
        formData.client_id && formData.client_id.trim() !== ""
          ? formData.client_id.trim()
          : null;

      // Prepare lots data - map to API format
      // Construct full lot_id as "projectid-lotid"
      const lotsToSend =
        lots && lots.length > 0
          ? lots.map((lot) => {
              const fullLotId = formData.project_id
                ? `${formData.project_id}-${lot.lotId}`
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
        name: formData.name,
        project_id: formData.project_id,
        client_id: clientIdToSend,
        startDate: formData.startDate || null,
        lots: lotsToSend,
      };

      const config = {
        method: "post",
        maxBodyLength: Infinity,
        url: "/api/project/create",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
        data: data,
      };

      const response = await axios.request(config);

      // Treat non-success statuses (status !== true) as errors
      const apiStatus = response?.data?.status;
      const apiMessage = response?.data?.message;
      if (apiStatus !== true) {
        const message =
          apiMessage || "An error occurred while creating the project";
        toast.error(message, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
        setErrors({ submit: message });
        return;
      }

      // Reset form on success
      setFormData({
        name: "",
        project_id: "",
        client_id: "",
        startDate: "",
      });
      setClientSearchTerm("");
      setNumberOfLots("");
      setLots([]);

      // Show success toast
      toast.success("Project created successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error) {
      console.error("Error creating project:", error);

      // Handle different types of errors
      let errorMessage = "An unexpected error occurred. Please try again.";

      if (error.response) {
        // Server responded with error status
        errorMessage =
          error.response.data?.message ||
          "An error occurred while creating the project";
      } else if (error.request) {
        // Request was made but no response received
        errorMessage =
          "Network error. Please check your connection and try again.";
      }

      // Show error toast
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      // Also set error in state for form display
      setErrors({ submit: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name) {
      newErrors.name = "Project Name is required";
    }
    if (!formData.project_id) {
      newErrors.project_id = "Project ID is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return (
    <AdminRoute>
      <div className="flex h-screen bg-tertiary">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CRMLayout />
          <div className="h-full w-full overflow-y-auto">
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 mb-4">
                <TabsController href="/admin/projects" title="Projects">
                  <div className="cursor-pointer p-1 hover:bg-slate-200 rounded-lg transition-colors">
                    <ChevronLeft className="w-8 h-8 text-slate-600" />
                  </div>
                </TabsController>
                <h1 className="text-2xl font-bold text-slate-600">
                  Add New Project
                </h1>
              </div>

              {/* form */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Project Information Section */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <FolderOpen className="w-5 h-5 text-primary" />
                      <h2 className="text-xl font-bold text-slate-800">
                        Project Information
                      </h2>
                    </div>
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Project Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                            placeholder="Eg. 5 Dundee Ave, Holden Hill SA 5088"
                            required
                          />
                          {errors.name && (
                            <p className="mt-1 text-sm text-red-600">
                              {errors.name}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Project ID <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            name="project_id"
                            value={formData.project_id}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                            placeholder="Eg. IK001"
                            required
                          />
                          {errors.project_id && (
                            <p className="mt-1 text-sm text-red-600">
                              {errors.project_id}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <div className="relative flex-1" ref={clientDropdownRef}>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Client{" "}
                            <span className="text-slate-400">(Optional)</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={clientSearchTerm}
                              onChange={handleClientSearchChange}
                              onFocus={() => setIsClientDropdownOpen(true)}
                              className="w-full text-sm text-slate-800 px-4 py-3 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                              placeholder="Search or select client..."
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setIsClientDropdownOpen(!isClientDropdownOpen)
                              }
                              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              <ChevronDown
                                className={`w-5 h-5 transition-transform duration-200 ${isClientDropdownOpen ? "rotate-180" : ""
                                  }`}
                              />
                            </button>
                          </div>

                          {isClientDropdownOpen && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                              {filteredClients.length > 0 ? (
                                filteredClients.map((client) => (
                                  <button
                                    key={client.client_id}
                                    type="button"
                                    onClick={() =>
                                      handleClientSelect(
                                        client.client_id,
                                        client.client_name
                                      )
                                    }
                                    className="cursor-pointer w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg last:rounded-b-lg"
                                  >
                                    <div>
                                      <div className="font-medium">
                                        {client.client_name}
                                      </div>
                                      <div className="text-xs text-slate-500">
                                        id: {client.client_id}
                                      </div>
                                    </div>
                                  </button>
                                ))
                              ) : (
                                <div className="px-4 py-3 text-sm text-slate-500 text-center">
                                  No matching clients found
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Start Date
                          </label>
                          <input
                            type="date"
                            name="startDate"
                            value={formData.startDate}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Number of Lots
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={numberOfLots}
                            onChange={handleNumberOfLotsChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                            placeholder="Enter number of lots"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Lots Section */}
                  {lots.length > 0 && (
                    <div className="space-y-6 border-t pt-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Layers className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold text-slate-800">
                          Lot Information
                        </h2>
                      </div>
                      <div className="space-y-6">
                        {lots.map((lot, index) => (
                          <div
                            key={index}
                            className="bg-slate-50 rounded-lg p-6 border border-slate-200"
                          >
                            <h3 className="text-lg font-semibold text-slate-700 mb-4">
                              Lot {index + 1}
                            </h3>
                            <div className="space-y-4">
                              <div className="flex flex-wrap gap-4">
                                <div className="flex-1">
                                  <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Lot ID <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={lot.lotId}
                                    onChange={(e) =>
                                      handleLotChange(
                                        index,
                                        "lotId",
                                        e.target.value
                                      )
                                    }
                                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                                    placeholder="Eg. Lot 1"
                                    required
                                  />
                                  <p className="text-xs text-slate-500 mt-1">
                                    Lot ID will be:{" "}
                                    {formData.project_id
                                      ? `${formData.project_id}-${lot.lotId || "XXX"}`
                                      : "PROJECT_ID-XXX"}
                                  </p>
                                </div>
                                <div className="flex-1">
                                  <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Client Name{" "}
                                    <span className="text-red-500">*</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={lot.clientName}
                                    onChange={(e) =>
                                      handleLotChange(
                                        index,
                                        "clientName",
                                        e.target.value
                                      )
                                    }
                                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                                    placeholder="Enter client name"
                                    required
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Installation Due Date
                                  </label>
                                  <input
                                    type="date"
                                    value={lot.installationDueDate}
                                    onChange={(e) =>
                                      handleLotChange(
                                        index,
                                        "installationDueDate",
                                        e.target.value
                                      )
                                    }
                                    className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                  Notes
                                </label>
                                <textarea
                                  value={lot.notes}
                                  onChange={(e) =>
                                    handleLotChange(
                                      index,
                                      "notes",
                                      e.target.value
                                    )
                                  }
                                  rows={3}
                                  className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none resize-none"
                                  placeholder="Enter any additional notes..."
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="flex justify-end pt-6">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`cursor-pointer px-8 py-3 rounded-lg font-medium transition-all duration-200 text-sm ${isLoading
                        ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                        : "bg-primary/80 hover:bg-primary text-white"
                        }`}
                    >
                      {isLoading ? "Creating Project..." : "Create Project"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
    </AdminRoute>
  );
}
