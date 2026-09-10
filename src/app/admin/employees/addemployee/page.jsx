"use client";
import React, { useState, useRef, useEffect } from "react";
import AdminShell from "@/components/AdminShell";
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
  Plus,
} from "lucide-react";
import TabsController from "@/components/tabscontroller";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import { useUploadProgress } from "@/hooks/useUploadProgress";
import { validatePhone, formatPhoneToNational } from "@/components/validators";

export default function page() {
  const formDataInitialState = {
    employee_id: "",
    first_name: "",
    last_name: "",
    role: "",
    email: "",
    phone: "",
    phone_secondary: "",
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
    is_active: true,
    image: null,
  };

  const availabilityInitialState = {
    monday: { start: "", end: "" },
    tuesday: { start: "", end: "" },
    wednesday: { start: "", end: "" },
    thursday: { start: "", end: "" },
    friday: { start: "", end: "" },
    saturday: { start: "", end: "" },
    sunday: { start: "", end: "" },
  };

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
  const {
    showProgressToast,
    completeUpload,
    dismissProgressToast,
    getUploadProgressHandler,
  } = useUploadProgress();

  // Role dropdown state
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [roleSearchTerm, setRoleSearchTerm] = useState("");
  const roleDropdownRef = useRef(null);
  const [roleOptions, setRoleOptions] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [newRoleValue, setNewRoleValue] = useState("");
  const [isCreatingRole, setIsCreatingRole] = useState(false);

  // Image upload state
  const [imagePreview, setImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  // Fetch roles from config API
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setLoadingRoles(true);
        const sessionToken = getToken();
        if (!sessionToken) {
          console.error("No valid session found");
          return;
        }

        const config = {
          method: "post",
          maxBodyLength: Infinity,
          url: `/api/v1/config/read_all_by_category`,
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          data: { category: "role" },
        };

        const response = await axios.request(config);
        if (response.data.status && response.data.data) {
          // Extract the value field from each config item
          const roles = response.data.data.map((item) => item.value);
          setRoleOptions(roles);
        }
      } catch (error) {
        console.error("Error fetching roles:", error);
        // Fallback to empty array if API fails
        setRoleOptions([]);
      } finally {
        setLoadingRoles(false);
      }
    };

    fetchRoles();
  }, [getToken]);

  // Filter role options based on search term
  const filteredRoleOptions = roleOptions.filter((role) =>
    role.toLowerCase().includes(roleSearchTerm.toLowerCase()),
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

  // Handle create new role
  const handleCreateNewRole = async () => {
    if (!newRoleValue || !newRoleValue.trim()) {
      toast.error("Role value is required");
      return;
    }

    try {
      setIsCreatingRole(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const config = {
        method: "post",
        maxBodyLength: Infinity,
        url: `/api/v1/config/create`,
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        data: {
          category: "role",
          value: newRoleValue.trim(),
        },
      };

      const response = await axios.request(config);
      if (response.data.status) {
        toast.success("Role created successfully");
        // Refresh roles list
        const fetchRoles = async () => {
          try {
            const config = {
              method: "post",
              maxBodyLength: Infinity,
              url: `/api/v1/config/read_all_by_category`,
              headers: {
                Authorization: `Bearer ${sessionToken}`,
                "Content-Type": "application/json",
              },
              data: { category: "role" },
            };
            const response = await axios.request(config);
            if (response.data.status && response.data.data) {
              const roles = response.data.data.map((item) => item.value);
              setRoleOptions(roles);
            }
          } catch (error) {
            console.error("Error fetching roles:", error);
          }
        };
        await fetchRoles();
        // Set the new role as selected
        setFormData((prev) => ({
          ...prev,
          role: newRoleValue.trim(),
        }));
        setRoleSearchTerm(newRoleValue.trim());
        setShowCreateRoleModal(false);
        setNewRoleValue("");
        setIsRoleDropdownOpen(false);
      } else {
        toast.error(response.data.message || "Failed to create role");
      }
    } catch (error) {
      console.error("Error creating role:", error);
      const errorMessage =
        error.response?.data?.message || "Failed to create role";
      toast.error(errorMessage);
    } finally {
      setIsCreatingRole(false);
    }
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

  const formatPhone = (phone) => {
    return phone ? formatPhoneToNational(phone) : phone;
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate phone numbers
      if (formData.phone && !validatePhone(formData.phone)) {
        toast.error("Please enter a valid Australian phone number", {
          position: "top-right",
          autoClose: 3000,
        });
        setIsSubmitting(false);
        return;
      }

      if (
        formData.emergency_contact_phone &&
        !validatePhone(formData.emergency_contact_phone)
      ) {
        toast.error("Please enter a valid emergency contact phone number", {
          position: "top-right",
          autoClose: 3000,
        });
        setIsSubmitting(false);
        return;
      }

      if (
        formData.phone_secondary &&
        !validatePhone(formData.phone_secondary)
      ) {
        toast.error("Please enter a valid secondary phone number", {
          position: "top-right",
          autoClose: 3000,
        });
        setIsSubmitting(false);
        return;
      }

      // Check if primary and secondary phone are the same
      if (
        formData.phone &&
        formData.phone_secondary &&
        formatPhone(formData.phone) === formatPhone(formData.phone_secondary)
      ) {
        toast.error("Primary and secondary phone numbers cannot be the same", {
          position: "top-right",
          autoClose: 3000,
        });
        setIsSubmitting(false);
        return;
      }

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
      const hasImageFile = formData.image !== null;

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
        } else if (key === "is_active") {
          // Convert boolean to string for FormData
          formDataToSend.append(key, formData[key] ? "true" : "false");
        } else if (key === "phone") {
          // Use formatted phone number
          formDataToSend.append(key, formatPhone(formData[key]));
        } else if (key === "phone_secondary") {
          // Use formatted secondary phone number
          formDataToSend.append(key, formatPhone(formData[key]));
        } else if (key === "emergency_contact_phone") {
          // Use formatted emergency contact phone number
          formDataToSend.append(key, formatPhone(formData[key]));
        } else {
          formDataToSend.append(key, formData[key] || "");
        }
      });

      // Show progress toast only if there's an image file
      if (hasImageFile) {
        showProgressToast(1);
      }

      const response = await axios.post(
        "/api/v1/employee/create",
        formDataToSend,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "multipart/form-data",
          },
          ...(hasImageFile && {
            onUploadProgress: getUploadProgressHandler(1),
          }),
        },
      );
      if (response.data.status) {
        if (hasImageFile) {
          completeUpload(1);
        } else {
          toast.success("Employee added successfully!", {
            position: "top-right",
            autoClose: 3000,
          });
        }
      } else {
        if (hasImageFile) {
          dismissProgressToast();
        }
        toast.error(response.data.message, {
          position: "top-right",
          autoClose: 3000,
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
      const hasImageFile = formData.image !== null;
      if (hasImageFile) {
        dismissProgressToast();
      }
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
        },
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
    (field) => formData[field].trim() !== "",
  );

  return (
    <div>
      <AdminShell>
        <main className="h-full w-full overflow-y-auto">
          <div className="px-4 py-2">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
              <TabsController back={true}>
                <div className="cursor-pointer p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200">
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                </div>
              </TabsController>
              <h1 className="text-xl font-semibold text-slate-800">
                Add New Employee
              </h1>
            </div>

            {/* Form */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Employee Image Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-slate-800">
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
                          <div className="w-32 h-32 rounded-full overflow-hidden border border-primary">
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
                            className="cursor-pointer absolute top-1 right-1 bg-secondary hover:bg-secondary/90 text-white rounded-full p-1.5 transition-colors duration-200"
                            aria-label="Remove photo"
                          >
                            <X className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="cursor-pointer absolute -bottom-2 left-1/2 -translate-x-1/2 bg-primary hover:bg-primary/90 text-white rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-200"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <label
                          htmlFor="image-upload"
                          className="w-32 h-32 rounded-full border border-dashed border-slate-300 hover:border-primary bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center cursor-pointer transition-colors duration-200"
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
                    <h2 className="text-lg font-semibold text-slate-800">
                      Personal Information
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label
                        htmlFor="employee_id"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Employee ID <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="employee_id"
                        type="text"
                        name="employee_id"
                        value={formData.employee_id}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        placeholder="Eg. EMP001"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="first_name"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        First Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="first_name"
                        type="text"
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        placeholder="Eg. John"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="last_name"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Last Name <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="last_name"
                        type="text"
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        placeholder="Eg. Doe"
                        required
                      />
                    </div>

                    <div className="relative" ref={roleDropdownRef}>
                      <label
                        htmlFor="role"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Role <span className="text-red-600">*</span>
                      </label>
                      <div className="relative">
                        <input
                          id="role"
                          type="text"
                          value={roleSearchTerm || formData.role}
                          onChange={handleRoleSearchChange}
                          onFocus={() => setIsRoleDropdownOpen(true)}
                          className="w-full text-sm text-slate-800 px-4 py-3 pr-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                          placeholder="Search or type a role..."
                          required
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setIsRoleDropdownOpen(!isRoleDropdownOpen)
                          }
                          className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors duration-200"
                          aria-label="Toggle role list"
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isRoleDropdownOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </div>

                      {isRoleDropdownOpen && (
                        <div className="absolute z-40 w-full mt-1 bg-white border border-slate-300 rounded-lg max-h-60 overflow-auto">
                          {loadingRoles ? (
                            <div className="px-4 py-3 text-sm text-slate-500 text-center">
                              Loading roles...
                            </div>
                          ) : filteredRoleOptions.length > 0 ? (
                            <>
                              {filteredRoleOptions.map((role, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => handleRoleSelect(role)}
                                  className="cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors first:rounded-t-lg"
                                >
                                  {role}
                                </button>
                              ))}
                              {roleSearchTerm &&
                                !filteredRoleOptions.some(
                                  (r) =>
                                    r.toLowerCase() ===
                                    roleSearchTerm.toLowerCase(),
                                ) && (
                                  <div className="border-t border-slate-200">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setNewRoleValue(roleSearchTerm);
                                        setShowCreateRoleModal(true);
                                      }}
                                      className="cursor-pointer w-full text-left px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors flex items-center gap-2"
                                    >
                                      <Plus className="w-4 h-4" />
                                      Create "{roleSearchTerm}"
                                    </button>
                                  </div>
                                )}
                            </>
                          ) : (
                            <div className="px-4 py-3">
                              <div className="text-sm text-slate-500 mb-2">
                                No matching roles found
                              </div>
                              {roleSearchTerm && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewRoleValue(roleSearchTerm);
                                    setShowCreateRoleModal(true);
                                  }}
                                  className="cursor-pointer w-full px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors flex items-center justify-center gap-2"
                                >
                                  <Plus className="w-4 h-4" />
                                  Create "{roleSearchTerm}"
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4 text-slate-600" />
                          Email <span className="text-red-600">*</span>
                        </div>
                      </label>
                      <input
                        id="email"
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        placeholder="Eg. john.doe@company.com"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="phone"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        <div className="flex items-center gap-1">
                          <Phone className="w-4 h-4 text-slate-600" />
                          Phone <span className="text-red-600">*</span>
                        </div>
                      </label>
                      <input
                        id="phone"
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className={`w-full text-sm text-slate-800 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 ${
                          (formData.phone && !validatePhone(formData.phone)) ||
                          (formData.phone &&
                            formData.phone_secondary &&
                            formatPhone(formData.phone) ===
                              formatPhone(formData.phone_secondary))
                            ? "border-red-500 focus:ring-red-500"
                            : "border-slate-300 focus:ring-primary"
                        }`}
                        placeholder="Eg. 0400 123 456 or +61 400 123 456"
                        required
                      />
                      {formData.phone && !validatePhone(formData.phone) && (
                        <p className="text-xs text-red-600 mt-1">
                          Please enter a valid Australian phone number
                        </p>
                      )}
                      {formData.phone &&
                        formData.phone_secondary &&
                        validatePhone(formData.phone) &&
                        validatePhone(formData.phone_secondary) &&
                        formatPhone(formData.phone) ===
                          formatPhone(formData.phone_secondary) && (
                          <p className="text-xs text-red-600 mt-1">
                            Primary and secondary phone cannot be the same
                          </p>
                        )}
                    </div>

                    <div>
                      <label
                        htmlFor="phone_secondary"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        <div className="flex items-center gap-1">
                          <Phone className="w-4 h-4 text-slate-600" />
                          Secondary Phone
                        </div>
                      </label>
                      <input
                        id="phone_secondary"
                        type="tel"
                        name="phone_secondary"
                        value={formData.phone_secondary}
                        onChange={handleInputChange}
                        className={`w-full text-sm text-slate-800 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 ${
                          (formData.phone_secondary &&
                            !validatePhone(formData.phone_secondary)) ||
                          (formData.phone &&
                            formData.phone_secondary &&
                            formatPhone(formData.phone) ===
                              formatPhone(formData.phone_secondary))
                            ? "border-red-500 focus:ring-red-500"
                            : "border-slate-300 focus:ring-primary"
                        }`}
                        placeholder="Eg. 0400 123 456 or +61 400 123 456"
                      />
                      {formData.phone_secondary &&
                        !validatePhone(formData.phone_secondary) && (
                          <p className="text-xs text-red-600 mt-1">
                            Please enter a valid Australian phone number
                          </p>
                        )}
                      {formData.phone &&
                        formData.phone_secondary &&
                        validatePhone(formData.phone) &&
                        validatePhone(formData.phone_secondary) &&
                        formatPhone(formData.phone) ===
                          formatPhone(formData.phone_secondary) && (
                          <p className="text-xs text-red-600 mt-1">
                            Primary and secondary phone cannot be the same
                          </p>
                        )}
                    </div>

                    <div>
                      <label
                        htmlFor="dob"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-slate-600" />
                          Date of Birth
                        </div>
                      </label>
                      <input
                        id="dob"
                        type="date"
                        name="dob"
                        value={formData.dob}
                        onChange={handleInputChange}
                        max={new Date().toISOString().split("T")[0]}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="join_date"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-slate-600" />
                          Join Date
                        </div>
                      </label>
                      <input
                        id="join_date"
                        type="date"
                        name="join_date"
                        value={formData.join_date}
                        onChange={handleInputChange}
                        max={new Date().toISOString().split("T")[0]}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                      />
                    </div>

                    <div className="md:col-span-2 lg:col-span-3">
                      <label
                        htmlFor="address"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-slate-600" />
                          Address
                        </div>
                      </label>
                      <textarea
                        id="address"
                        name="address"
                        value={formData.address}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        placeholder="Eg. 123 Main Street, City, State, ZIP"
                      />
                    </div>
                  </div>
                </div>

                {/* Emergency Contact Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Phone className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-slate-800">
                      Emergency Contact
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label
                        htmlFor="emergency_contact_name"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Emergency Contact Name
                      </label>
                      <input
                        id="emergency_contact_name"
                        type="text"
                        name="emergency_contact_name"
                        value={formData.emergency_contact_name}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        placeholder="Eg. Jane Doe"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="emergency_contact_phone"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Emergency Contact Phone
                      </label>
                      <input
                        id="emergency_contact_phone"
                        type="tel"
                        name="emergency_contact_phone"
                        value={formData.emergency_contact_phone}
                        onChange={handleInputChange}
                        className={`w-full text-sm text-slate-800 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-200 ${
                          formData.emergency_contact_phone &&
                          !validatePhone(formData.emergency_contact_phone)
                            ? "border-red-500 focus:ring-red-500"
                            : "border-slate-300 focus:ring-primary"
                        }`}
                        placeholder="Eg. 0400 123 456 or +61 400 123 456"
                      />
                      {formData.emergency_contact_phone &&
                        !validatePhone(formData.emergency_contact_phone) && (
                          <p className="text-xs text-red-600 mt-1">
                            Please enter a valid Australian phone number
                          </p>
                        )}
                    </div>
                  </div>
                </div>

                {/* Banking Information Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-slate-800">
                      Banking Information
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div>
                      <label
                        htmlFor="bank_account_name"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Bank Account Holder Name
                      </label>
                      <input
                        id="bank_account_name"
                        type="text"
                        name="bank_account_name"
                        value={formData.bank_account_name}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        placeholder="Eg. John Doe"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="bank_account_number"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Bank Account Number
                      </label>
                      <input
                        id="bank_account_number"
                        type="text"
                        name="bank_account_number"
                        value={formData.bank_account_number}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        placeholder="Eg. 1234 5678"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="bank_account_bsb"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Bank Account BSB
                      </label>
                      <input
                        id="bank_account_bsb"
                        type="text"
                        name="bank_account_bsb"
                        value={formData.bank_account_bsb}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        placeholder="Eg. 123-456"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="supper_account_name"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Super Account Name
                      </label>
                      <input
                        id="supper_account_name"
                        type="text"
                        name="supper_account_name"
                        value={formData.supper_account_name}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        placeholder="Eg. John Doe Super"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="supper_account_number"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Super Account Member ID
                      </label>
                      <input
                        id="supper_account_number"
                        type="text"
                        name="supper_account_number"
                        value={formData.supper_account_number}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        placeholder="Eg. 1234567890"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="tfn_number"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        TFN Number
                      </label>
                      <input
                        id="tfn_number"
                        type="text"
                        name="tfn_number"
                        value={formData.tfn_number}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        placeholder="Eg. 123456789"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="abn_number"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        ABN Number
                      </label>
                      <input
                        id="abn_number"
                        type="text"
                        name="abn_number"
                        value={formData.abn_number}
                        onChange={handleInputChange}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        placeholder="Eg. 12345678901"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Information Section */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-4">
                    <GraduationCap className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-slate-800">
                      Additional Information
                    </h2>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label
                        htmlFor="education"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Education
                      </label>
                      <textarea
                        id="education"
                        name="education"
                        value={formData.education}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
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
                              className="flex items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg"
                            >
                              <div className="w-24">
                                <span className="text-sm font-medium text-slate-700 capitalize">
                                  {day}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <label
                                  htmlFor={`availability-${day}-start`}
                                  className="text-sm text-slate-600"
                                >
                                  Start:
                                </label>
                                <input
                                  id={`availability-${day}-start`}
                                  type="time"
                                  value={times.start}
                                  onChange={(e) =>
                                    handleAvailabilityChange(
                                      day,
                                      "start",
                                      e.target.value,
                                    )
                                  }
                                  className="px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label
                                  htmlFor={`availability-${day}-end`}
                                  className="text-sm text-slate-600"
                                >
                                  End:
                                </label>
                                <input
                                  id={`availability-${day}-end`}
                                  type="time"
                                  value={times.end}
                                  onChange={(e) =>
                                    handleAvailabilityChange(
                                      day,
                                      "end",
                                      e.target.value,
                                    )
                                  }
                                  className="px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="notes"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4 text-slate-600" />
                          Personal Notes
                        </div>
                      </label>
                      <textarea
                        id="notes"
                        name="notes"
                        value={formData.notes}
                        onChange={handleInputChange}
                        rows={4}
                        className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                        placeholder="Eg. Add any personal notes or additional information about this employee..."
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        These notes are for admin reference only and will not be
                        visible to the employee.
                      </p>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name="is_active"
                          checked={formData.is_active}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              is_active: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 text-primary focus:ring-primary border-slate-300 rounded"
                        />
                        <span className="text-sm font-medium text-slate-700">
                          Active Employee
                        </span>
                      </label>
                      <p className="text-xs text-slate-500 mt-1 ml-6">
                        Uncheck to mark this employee as inactive
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-6 border-t border-slate-200">
                  <button
                    type="submit"
                    disabled={!isFormValid || isSubmitting}
                    className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" aria-hidden="true" />
                    {isSubmitting ? "Adding Employee..." : "Add Employee"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </AdminShell>

      {/* Create Role Modal */}
      {showCreateRoleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
          onClick={() => setShowCreateRoleModal(false)}
        >
          <div
            className="bg-white rounded-xl border border-slate-200 w-full max-w-md max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">
                Create New Role
              </h2>
              <button
                onClick={() => {
                  setShowCreateRoleModal(false);
                  setNewRoleValue("");
                }}
                className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label
                  htmlFor="new-role-name"
                  className="block text-sm font-medium text-slate-700 mb-1.5"
                >
                  Role Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="new-role-name"
                  type="text"
                  value={newRoleValue}
                  onChange={(e) => setNewRoleValue(e.target.value)}
                  placeholder="Enter role name"
                  className="w-full text-sm text-slate-800 px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowCreateRoleModal(false);
                    setNewRoleValue("");
                  }}
                  className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNewRole}
                  disabled={isCreatingRole || !newRoleValue?.trim()}
                  className="cursor-pointer px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isCreatingRole ? "Creating..." : "Create Role"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
