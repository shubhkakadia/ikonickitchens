"use client";
import { AdminRoute } from "@/components/ProtectedRoute";
import CRMLayout from "@/components/tabs";
import TabsController from "@/components/tabscontroller";
import { ChevronLeft, User, ChevronDown, Edit, Trash2 } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function page() {
  const [formData, setFormData] = useState({
    client_id: "",
    client_name: "",
    client_address: "",
    client_phone: "",
    client_email: "",
    client_website: "",
    client_notes: "",
    client_type: "",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const client_types = ["Builder", "Private", "Other"];
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const { getToken } = useAuth();

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };
  
  // Filter client types based on search term
  const filteredClientTypes = client_types.filter((type) =>
    type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleClientTypeSelect = (type) => {
    setFormData({
      ...formData,
      client_type: type,
    });
    setSearchTerm(type);
    setIsDropdownOpen(false);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setIsDropdownOpen(true);
    // If user types something that matches exactly, update form data
    if (client_types.includes(e.target.value)) {
      setFormData({
        ...formData,
        client_type: e.target.value,
      });
    }
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
      const data = JSON.stringify({
        client_id: formData.client_id,
        client_type: formData.client_type.toLowerCase(),
        client_name: formData.client_name,
        client_address: formData.client_address,
        client_phone: formData.client_phone,
        client_email: formData.client_email,
        client_website: formData.client_website,
        client_notes: formData.client_notes,
      });

      const config = {
        method: "post",
        maxBodyLength: Infinity,
        url: "/api/client/create",
        headers: {
          "Content-Type": "application/json",
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
          apiMessage || "An error occurred while creating the client";
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
        client_id: "",
        client_name: "",
        client_address: "",
        client_phone: "",
        client_email: "",
        client_website: "",
        client_notes: "",
        client_type: "",
      });
      setSearchTerm("");

      // Show success toast
      toast.success("Client created successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error) {
      console.error("Error creating client:", error);

      // Handle different types of errors
      let errorMessage = "An unexpected error occurred. Please try again.";

      if (error.response) {
        // Server responded with error status
        errorMessage =
          error.response.data?.message ||
          "An error occurred while creating the client";
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
    if (!formData.client_id) {
      newErrors.client_id = "Client ID is required";
    }
    if (!formData.client_name) {
      newErrors.client_name = "Client Name is required";
    }
    if (!formData.client_type) {
      newErrors.client_type = "Client Type is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return (
    <div>
      <div className="flex h-screen bg-tertiary">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CRMLayout />
          <div className="h-full w-full overflow-y-auto">
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 mb-4">
                <TabsController href="/admin/clients" title="Clients">
                  <div className="cursor-pointer p-1 hover:bg-slate-200 rounded-lg transition-colors">
                    <ChevronLeft className="w-8 h-8 text-slate-600" />
                  </div>
                </TabsController>
                <h1 className="text-2xl font-bold text-slate-600">
                  Add New Client
                </h1>
              </div>

              {/* form */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* personal information section */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <User className="w-5 h-5 text-primary" />
                      <h2 className="text-xl font-bold text-slate-800">
                        Client Information
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Client ID <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="client_id"
                          value={formData.client_id}
                          onChange={handleInputChange}
                          className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                          placeholder="Eg. CL001"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Client Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="client_name"
                          value={formData.client_name}
                          onChange={handleInputChange}
                          className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                          placeholder="Eg. Bettio Construction"
                          required
                        />
                      </div>
                      <div className="relative" ref={dropdownRef}>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Client Type <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={searchTerm}
                            onChange={handleSearchChange}
                            onFocus={() => setIsDropdownOpen(true)}
                            className="w-full text-sm text-slate-800 px-4 py-3 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                            placeholder="Search or select client type..."
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="cursor-pointer absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <ChevronDown
                              className={`w-5 h-5 transition-transform ${
                                isDropdownOpen ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        </div>

                        {isDropdownOpen && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                            {filteredClientTypes.length > 0 ? (
                              filteredClientTypes.map((type, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => handleClientTypeSelect(type)}
                                  className="cursor-pointer w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg last:rounded-b-lg"
                                >
                                  {type}
                                </button>
                              ))
                            ) : (
                              <div className="px-4 py-3 text-sm text-slate-500">
                                No matching client types found
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Client Address <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="client_address"
                        value={formData.client_address}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                        placeholder="Eg. 6 Penna Ave, Glynde, SA 5070"
                        required
                        rows={3}
                      />
                    </div>
                  </div>

                  {/* Contact Information Section */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold text-slate-800">
                        Contact Information
                      </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Mobile Phone <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          name="client_phone"
                          value={formData.client_phone}
                          onChange={handleInputChange}
                          className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                          placeholder="Eg. +61 400 000 000"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          name="client_email"
                          value={formData.client_email}
                          onChange={handleInputChange}
                          className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                          placeholder="Eg. contact@example.com"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Website
                        </label>
                        <input
                          type="url"
                          name="client_website"
                          value={formData.client_website}
                          onChange={handleInputChange}
                          className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                          placeholder="Eg. https://www.example.com"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes Section */}
                  <div className="space-y-6">
                    <h2 className="text-xl font-bold text-slate-800">
                      Additional Notes
                    </h2>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Notes
                      </label>
                      <textarea
                        name="client_notes"
                        value={formData.client_notes}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                        placeholder="Any additional notes about the client..."
                        rows={4}
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end pt-6">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`cursor-pointer px-8 py-3 rounded-lg font-medium transition-all duration-200 text-sm ${
                        isLoading
                          ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                          : "bg-primary/80 hover:bg-primary text-white"
                      }`}
                    >
                      {isLoading ? "Creating Client..." : "Create Client"}
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
    </div>
  );
}
