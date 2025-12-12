"use client";
import React, { useState, useRef, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import { AdminRoute } from "@/components/ProtectedRoute";
import CRMLayout from "@/components/tabs";
import {
  ChevronLeft,
  Save,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  CreditCard,
  GraduationCap,
  Clock,
  ChevronDown,
  Upload,
  X,
} from "lucide-react";
import TabsController from "@/components/tabscontroller";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import { roleOptions } from "@/components/constants";

export default function page() {
  const formDataInitialState = {
    employee_id: "",
    first_name: "",
    last_name: "",
    role: "",
    email: "",
    phone: "",
    dob: "",
    join_date: "",
    address: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_account_bsb: "",
    supper_account_name: "",
    supper_account_number: "",
    tfn_number: "",
    abn_number: "",
    education: "",
    availability: "",
    notes: "",
    image: null,
  }

  const availabilityInitialState = {
    monday: { start: "", end: "" },
    tuesday: { start: "", end: "" },
    wednesday: { start: "", end: "" },
    thursday: { start: "", end: "" },
    friday: { start: "", end: "" },
    saturday: { start: "", end: "" },
    sunday: { start: "", end: "" },
  }

  const daysOfWeek = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  const [formData, setFormData] = useState(formDataInitialState);
  const [availability, setAvailability] = useState(availabilityInitialState);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { getToken } = useAuth();

  // Role dropdown state
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [roleSearchTerm, setRoleSearchTerm] = useState("");
  const roleDropdownRef = useRef(null);

  // Image upload state
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Filter role options based on search term
  const filteredRoleOptions = roleOptions.filter((role) =>
    role.toLowerCase().includes(roleSearchTerm.toLowerCase())
  );

  // Add this inside the component
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        roleDropdownRef.current &&
        !roleDropdownRef.current.contains(event.target)
      ) {
        setIsRoleDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleRoleSelect = (role) => {
    setFormData((prev) => ({
      ...prev,
      role: role,
    }));
    setRoleSearchTerm(role);
    setIsRoleDropdownOpen(false);
  };

  const handleRoleSearchChange = (e) => {
    const value = e.target.value;
    setRoleSearchTerm(value);
    setIsRoleDropdownOpen(true);
    setFormData((prev) => ({
      ...prev,
      role: value,
    }));
  };
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAvailabilityChange = (day, field, value) => {
    setAvailability((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({
        ...prev,
        image: file,
      }));
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({
      ...prev,
      image: null,
    }));
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Get the session token when needed
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      const formDataToSend = new FormData();

      // Append all form data
      Object.keys(formData).forEach((key) => {
        if (key === "availability") {
          // Convert availability to JSON string
          formDataToSend.append(key, JSON.stringify(availability));
        } else if (key === "image") {
          // Append image file if it exists
          if (formData[key]) {
            formDataToSend.append(key, formData[key]);
          }
        } else {
          formDataToSend.append(key, formData[key] || "");
        }
      });

      const response = await axios.post(
        "/api/employee/create",
        formDataToSend,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );
      if (response.data.status) {
        toast.success("Employee added successfully!", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      } else {
        toast.error(response.data.message, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        return;
      }

      // Reset form
      setFormData(formDataInitialState);
      setAvailability(availabilityInitialState);
      setRoleSearchTerm("");
      setIsRoleDropdownOpen(false);
      setImagePreview(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error adding employee:", error);
      toast.error(
        error.response?.data?.message ||
        "Failed to add employee. Please try again.",
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
      setIsSubmitting(false);
    }
  };

  const requiredFields = [
    "employee_id",
    "first_name",
    "last_name",
    "role",
    "email",
    "phone",
  ];

  const isFormValid = requiredFields.every(
    (field) => formData[field].trim() !== ""
  );

  return (
    <div>
      <AdminRoute>
        <div className="flex h-screen bg-tertiary">
          <Sidebar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <CRMLayout />
            <div className="h-full w-full overflow-y-auto">
              <div className="px-4 py-2">
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                  <TabsController href="/admin/employees" title="Employees">
                    <div className="cursor-pointer p-1 hover:bg-slate-200 rounded-lg transition-colors">
                      <ChevronLeft className="w-8 h-8 text-slate-600" />
                    </div>
                  </TabsController>
                  <h1 className="text-2xl font-bold text-slate-600">
                    Add New Employee
                  </h1>
                </div>

                {/* Form */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Employee Image Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 mb-4">
                        <User className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold text-slate-800">
                          Employee Photo
                        </h2>
                      </div>

                      <div className="flex flex-col items-center">
                        <div className="relative group">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                            id="image-upload"
                          />

                          {imagePreview ? (
                            <div className="relative">
                              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary shadow-lg">
                                <Image
                                  loading="lazy"
                                  src={imagePreview}
                                  alt="Preview"
                                  className="w-full h-full object-cover"
                                  width={128}
                                  height={128}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={handleRemoveImage}
                                className="absolute top-1 right-1 bg-secondary text-white rounded-full p-2 shadow-lg hover:bg-secondary transition-all duration-200 transform hover:scale-110 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-primary text-white rounded-full px-4 py-1 text-xs shadow-lg hover:scale-110 transition-all duration-200 cursor-pointer"
                              >
                                Change
                              </button>
                            </div>
                          ) : (
                            <label
                              htmlFor="image-upload"
                              className="w-32 h-32 rounded-full border-4 border-dashed border-slate-300 hover:border-primary bg-slate-50 hover:bg-blue-50 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group-hover:shadow-lg"
                            >
                              <Upload className="w-8 h-8 text-slate-400 group-hover:text-primary transition-colors mb-2" />
                              <span className="text-xs text-slate-500 group-hover:text-primary font-medium">
                                Upload Photo
                              </span>
                            </label>
                          )}
                        </div>

                        <p className="mt-4 text-sm text-slate-600">
                          Employee Photo{" "}
                          <span className="text-slate-400">(Optional)</span>
                        </p>
                      </div>
                    </div>

                    {/* Personal Information Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 mb-4">
                        <User className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold text-slate-800">
                          Personal Information
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Employee ID <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            name="employee_id"
                            value={formData.employee_id}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            placeholder="Eg. EMP001"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            First Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            name="first_name"
                            value={formData.first_name}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            placeholder="Eg. John"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Last Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            name="last_name"
                            value={formData.last_name}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            placeholder="Eg. Doe"
                            required
                          />
                        </div>

                        <div className="relative" ref={roleDropdownRef}>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Role <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              value={roleSearchTerm || formData.role}
                              onChange={handleRoleSearchChange}
                              onFocus={() => setIsRoleDropdownOpen(true)}
                              className="w-full text-sm text-slate-800 px-4 py-3 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                              placeholder="Search or type a role..."
                              required
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setIsRoleDropdownOpen(!isRoleDropdownOpen)
                              }
                              className="cursor-pointer absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              <ChevronDown
                                className={`w-5 h-5 transition-transform ${isRoleDropdownOpen ? "rotate-180" : ""
                                  }`}
                              />
                            </button>
                          </div>

                          {isRoleDropdownOpen && (
                            <div className="absolute z-10 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                              {filteredRoleOptions.length > 0 ? (
                                filteredRoleOptions.map((role, index) => (
                                  <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleRoleSelect(role)}
                                    className="cursor-pointer w-full text-left px-4 py-3 text-sm text-slate-800 hover:bg-slate-100 transition-colors first:rounded-t-lg last:rounded-b-lg"
                                  >
                                    {role}
                                  </button>
                                ))
                              ) : (
                                <div className="px-4 py-3 text-sm text-slate-500">
                                  No matching roles found - Typed role will be
                                  saved
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            <div className="flex items-center gap-1">
                              <Mail className="w-4 h-4 text-slate-600" />
                              Email <span className="text-red-500">*</span>
                            </div>
                          </label>
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            placeholder="Eg. john.doe@company.com"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            <div className="flex items-center gap-1">
                              <Phone className="w-4 h-4 text-slate-600" />
                              Phone <span className="text-red-500">*</span>
                            </div>
                          </label>
                          <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            placeholder="Eg. 0400000000"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4 text-slate-600" />
                              Date of Birth
                            </div>
                          </label>
                          <input
                            type="date"
                            name="dob"
                            value={formData.dob}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4 text-slate-600" />
                              Join Date
                            </div>
                          </label>
                          <input
                            type="date"
                            name="join_date"
                            value={formData.join_date}
                            onChange={handleInputChange}
                            max={new Date().toISOString().split("T")[0]}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                          />
                        </div>

                        <div className="md:col-span-2 lg:col-span-3">
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-4 h-4 text-slate-600" />
                              Address
                            </div>
                          </label>
                          <textarea
                            name="address"
                            value={formData.address}
                            onChange={handleInputChange}
                            rows={3}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            placeholder="Eg. 123 Main Street, City, State, ZIP"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Emergency Contact Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 mb-4">
                        <Phone className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold text-slate-800">
                          Emergency Contact
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Emergency Contact Name
                          </label>
                          <input
                            type="text"
                            name="emergency_contact_name"
                            value={formData.emergency_contact_name}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            placeholder="Eg. Jane Doe"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Emergency Contact Phone
                          </label>
                          <input
                            type="tel"
                            name="emergency_contact_phone"
                            value={formData.emergency_contact_phone}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            placeholder="Eg. 0400000000"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Banking Information Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 mb-4">
                        <CreditCard className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold text-slate-800">
                          Banking Information
                        </h2>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Bank Account Holder Name
                          </label>
                          <input
                            type="text"
                            name="bank_account_name"
                            value={formData.bank_account_name}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            placeholder="Eg. John Doe"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Bank Account Number
                          </label>
                          <input
                            type="text"
                            name="bank_account_number"
                            value={formData.bank_account_number}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            placeholder="Eg. 1234 5678"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Bank Account BSB
                          </label>
                          <input
                            type="text"
                            name="bank_account_bsb"
                            value={formData.bank_account_bsb}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            placeholder="Eg. 123-456"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Super Account Name
                          </label>
                          <input
                            type="text"
                            name="supper_account_name"
                            value={formData.supper_account_name}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            placeholder="Eg. John Doe Super"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Super Account Member ID
                          </label>
                          <input
                            type="text"
                            name="supper_account_number"
                            value={formData.supper_account_number}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            placeholder="Eg. 1234567890"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            TFN Number
                          </label>
                          <input
                            type="text"
                            name="tfn_number"
                            value={formData.tfn_number}
                            onChange={handleInputChange}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            placeholder="Eg. 123456789"
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
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            placeholder="Eg. 12345678901"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Additional Information Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 mb-4">
                        <GraduationCap className="w-5 h-5 text-primary" />
                        <h2 className="text-xl font-bold text-slate-800">
                          Additional Information
                        </h2>
                      </div>

                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Education
                          </label>
                          <textarea
                            name="education"
                            value={formData.education}
                            onChange={handleInputChange}
                            rows={3}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            placeholder="Eg. Bachelor of Engineering, University of Technology"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-4">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-slate-600" />
                              Weekly Availability
                            </div>
                          </label>
                          <div className="space-y-4">
                            {daysOfWeek.map((day) => {
                              const times = availability[day];
                              return (
                                <div
                                  key={day}
                                  className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg"
                                >
                                  <div className="w-24">
                                    <span className="text-sm font-medium text-slate-700 capitalize">
                                      {day}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <label className="text-sm text-slate-600">
                                      Start:
                                    </label>
                                    <input
                                      type="time"
                                      value={times.start}
                                      onChange={(e) =>
                                        handleAvailabilityChange(
                                          day,
                                          "start",
                                          e.target.value
                                        )
                                      }
                                      className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <label className="text-sm text-slate-600">
                                      End:
                                    </label>
                                    <input
                                      type="time"
                                      value={times.end}
                                      onChange={(e) =>
                                        handleAvailabilityChange(
                                          day,
                                          "end",
                                          e.target.value
                                        )
                                      }
                                      className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4 text-slate-600" />
                              Personal Notes
                            </div>
                          </label>
                          <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleInputChange}
                            rows={4}
                            className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                            placeholder="Eg. Add any personal notes or additional information about this employee..."
                          />
                          <p className="text-xs text-slate-500 mt-1">
                            These notes are for admin reference only and will
                            not be visible to the employee.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end pt-6 border-t border-slate-200">
                      <button
                        type="submit"
                        disabled={!isFormValid || isSubmitting}
                        className={`cursor-pointer flex items-center gap-2 px-8 py-3 rounded-lg font-medium text-sm transition-all duration-200 ${isFormValid && !isSubmitting
                          ? "bg-primary/80 hover:bg-primary text-white"
                          : "bg-slate-300 text-slate-500 cursor-not-allowed"
                          }`}
                      >
                        <Save className="w-5 h-5" />
                        {isSubmitting ? "Adding Employee..." : "Add Employee"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
        <ToastContainer />
      </AdminRoute>
    </div>
  );
}
