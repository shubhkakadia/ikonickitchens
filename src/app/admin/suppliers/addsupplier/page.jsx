"use client";
import { AdminRoute } from "@/components/ProtectedRoute";
import CRMLayout from "@/components/tabs";
import TabsController from "@/components/tabscontroller";
import { ChevronLeft, Building2 } from "lucide-react";
import React, { useState } from "react";
import Sidebar from "@/components/sidebar";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function page() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    website: "",
    notes: "",
    abn_number: "",
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const { getToken } = useAuth();

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
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
      const data = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        notes: formData.notes,
        website: formData.website,
        abn_number: formData.abn_number,
      };

      const config = {
        method: "post",
        maxBodyLength: Infinity,
        url: "/api/supplier/create",
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
          apiMessage || "An error occurred while creating the supplier";
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
        email: "",
        phone: "",
        address: "",
        website: "",
        notes: "",
        abn_number: "",
      });

      // Show success toast
      toast.success("Supplier created successfully!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } catch (error) {
      console.error("Error creating supplier:", error);

      // Handle different types of errors
      let errorMessage = "An unexpected error occurred. Please try again.";

      if (error.response) {
        // Server responded with error status
        errorMessage =
          error.response.data?.message ||
          "An error occurred while creating the supplier";
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
      newErrors.name = "Supplier Name is required";
    }
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
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
                <TabsController href="/admin/suppliers" title="Suppliers">
                  <div className="cursor-pointer p-1 hover:bg-slate-200 rounded-lg transition-colors">
                    <ChevronLeft className="w-8 h-8 text-slate-600" />
                  </div>
                </TabsController>
                <h1 className="text-2xl font-bold text-slate-600">
                  Add New Supplier
                </h1>
              </div>

              {/* form */}
              <div className="bg-white rounded-lg shadow-lg p-6">
                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* supplier information section */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Building2 className="w-5 h-5 text-primary" />
                      <h2 className="text-xl font-bold text-slate-800">
                        Supplier Information
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Supplier Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          className={`w-full text-sm text-slate-800 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none ${errors.name ? "border-red-500" : "border-slate-300"
                            }`}
                          placeholder="Eg. Polytec Australia"
                          required
                        />
                        {errors.name && (
                          <p className="mt-1 text-sm text-red-500">
                            {errors.name}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Email Address
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className={`w-full text-sm text-slate-800 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none ${errors.email ? "border-red-500" : "border-slate-300"
                            }`}
                          placeholder="Eg. contact@polytec.com.au"
                        />
                        {errors.email && (
                          <p className="mt-1 text-sm text-red-500">
                            {errors.email}
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Address
                      </label>
                      <textarea
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                        placeholder="Eg. Adelaide, South Australia"
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
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                          placeholder="Eg. +61 8000 0000"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Website
                        </label>
                        <input
                          type="url"
                          name="website"
                          value={formData.website}
                          onChange={handleInputChange}
                          className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                          placeholder="Eg. https://www.polytec.com.au"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          ABN Number
                        </label>
                        <input
                          type="text"
                          name="abn_number"
                          value={formData.abn_number}
                          onChange={handleInputChange}
                          className="w-full text-sm text-slate-800 font-mono px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                          placeholder="Eg. 12345678901"
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
                        name="notes"
                        value={formData.notes}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                        placeholder="Any additional notes about the supplier..."
                        rows={4}
                      />
                    </div>
                  </div>

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
                      {isLoading ? "Creating Supplier..." : "Create Supplier"}
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
