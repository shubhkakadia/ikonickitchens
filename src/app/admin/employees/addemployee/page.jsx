"use client";
import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Save,
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  CreditCard,
  GraduationCap,
  Clock,
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
import useModalFocus from "@/hooks/useModalFocus";
import {
  validatePhone,
  validateEmail,
  formatPhoneToNational,
} from "@/components/validators";
import { titleCase } from "@/app/admin/dashboard/lib/format";

// DESIGN.md 9.2 form field recipe. `error` flips the border/ring to red.
const INPUT_BASE =
  "w-full text-sm text-slate-800 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent";
const inputClass = (hasError, extra = "") =>
  `${INPUT_BASE} ${extra} ${
    hasError
      ? "border-red-500 focus:ring-red-500"
      : "border-slate-300 focus:ring-primary"
  }`;

const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";

// Module-level so inputs keep focus between renders.
function TextField({
  id,
  label,
  icon: Icon,
  required,
  error,
  hint,
  multiline,
  className = "",
  ...rest
}) {
  const describedBy =
    [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") ||
    undefined;
  const Control = multiline ? "textarea" : "input";
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5"
      >
        {Icon && <Icon className="w-4 h-4" aria-hidden="true" />}
        <span>
          {label}
          {required && (
            <>
              {" "}
              <span className="text-red-600" aria-hidden="true">
                *
              </span>
            </>
          )}
        </span>
      </label>
      <Control
        id={id}
        name={id}
        required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={inputClass(!!error)}
        {...rest}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-600 mt-1">
          {error}
        </p>
      )}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-slate-500 mt-1">
          {hint}
        </p>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="w-5 h-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      </div>
      {children}
    </section>
  );
}

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

  const router = useRouter();
  const [formData, setFormData] = useState(formDataInitialState);
  const [availability, setAvailability] = useState(availabilityInitialState);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Validate on submit, then on change: errors only exist once a submit was attempted.
  const [submitted, setSubmitted] = useState(false);
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
  const [newRoleError, setNewRoleError] = useState("");
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const roleModalRef = useRef(null);
  useModalFocus(roleModalRef, showCreateRoleModal);

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

  const closeRoleModal = () => {
    setShowCreateRoleModal(false);
    setNewRoleValue("");
    setNewRoleError("");
  };

  // Modals close on Escape (DESIGN.md 9.4)
  useEffect(() => {
    if (!showCreateRoleModal) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !isCreatingRole) closeRoleModal();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showCreateRoleModal, isCreatingRole]);

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

  const openCreateRoleModal = () => {
    setNewRoleValue(roleSearchTerm);
    setNewRoleError("");
    setShowCreateRoleModal(true);
  };

  // Handle create new role
  const handleCreateNewRole = async () => {
    if (!newRoleValue || !newRoleValue.trim()) {
      setNewRoleError("Enter a role name.");
      document.getElementById("new-role-name")?.focus();
      return;
    }
    setNewRoleError("");

    try {
      setIsCreatingRole(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again.");
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
        toast.success("Role created.");
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
        toast.error(response.data.message || "Couldn't create the role.");
      }
    } catch (error) {
      console.error("Error creating role:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Couldn't create the role. Check your connection and try again.";
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

  const today = new Date().toISOString().split("T")[0];

  // Field order here is also the order focus moves to on a failed submit.
  const requiredFields = [
    ["employee_id", "Enter an employee ID."],
    ["first_name", "Enter a first name."],
    ["last_name", "Enter a last name."],
    ["role", "Select or enter a role."],
    ["email", "Enter an email address."],
    ["phone", "Enter a phone number."],
  ];

  const validate = () => {
    const errs = {};
    requiredFields.forEach(([field, message]) => {
      if (formData[field].trim() === "") errs[field] = message;
    });

    if (!errs.email && !validateEmail(formData.email)) {
      errs.email = "Enter a valid email address.";
    }

    const phonesMatch =
      formData.phone &&
      formData.phone_secondary &&
      validatePhone(formData.phone) &&
      validatePhone(formData.phone_secondary) &&
      formatPhone(formData.phone) === formatPhone(formData.phone_secondary);

    if (!errs.phone) {
      if (formData.phone && !validatePhone(formData.phone)) {
        errs.phone = "Enter a valid Australian phone number.";
      } else if (phonesMatch) {
        errs.phone = "Primary and secondary phone numbers can't be the same.";
      }
    }
    if (formData.phone_secondary && !validatePhone(formData.phone_secondary)) {
      errs.phone_secondary = "Enter a valid Australian phone number.";
    } else if (phonesMatch) {
      errs.phone_secondary =
        "Primary and secondary phone numbers can't be the same.";
    }

    if (formData.dob && formData.dob > today) {
      errs.dob = "Date of birth can't be in the future.";
    }
    if (formData.join_date && formData.join_date > today) {
      errs.join_date = "Join date can't be in the future.";
    }

    if (
      formData.emergency_contact_phone &&
      !validatePhone(formData.emergency_contact_phone)
    ) {
      errs.emergency_contact_phone = "Enter a valid Australian phone number.";
    }
    return errs;
  };

  const errors = submitted ? validate() : {};

  const fieldOrder = [
    "employee_id",
    "first_name",
    "last_name",
    "role",
    "email",
    "phone",
    "phone_secondary",
    "dob",
    "join_date",
    "emergency_contact_phone",
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);

    const currentErrors = validate();
    const firstInvalid = fieldOrder.find((key) => currentErrors[key]);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      // Get the session token when needed
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again.", {
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
          toast.success("Employee created.", {
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
      setSubmitted(false);

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
          "Couldn't create the employee. Check your connection and try again.",
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

  const isRoleModalDirty = newRoleValue !== roleSearchTerm;

  return (
    <div>
      <AdminShell>
        <main className="h-full w-full overflow-y-auto">
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
              <TabsController back={true}>
                <span className="cursor-pointer inline-flex p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200">
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                  <span className="sr-only">Back</span>
                </span>
              </TabsController>
              <h1 className="text-xl font-semibold text-slate-800">
                Add employee
              </h1>
            </div>

            {/* Form */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <form onSubmit={handleSubmit} noValidate className="space-y-6">
                {/* Employee Image Section */}
                <Section icon={User} title="Employee photo">
                  <div className="flex flex-col items-center">
                    <div className="relative group">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="sr-only peer"
                        id="image-upload"
                        tabIndex={imagePreview ? -1 : 0}
                      />

                      {imagePreview ? (
                        <div className="relative">
                          <div className="w-32 h-32 rounded-full overflow-hidden border border-primary">
                            <Image
                              loading="lazy"
                              src={imagePreview}
                              alt="Employee photo preview"
                              className="w-full h-full object-cover"
                              width={128}
                              height={128}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="cursor-pointer absolute top-1 right-1 bg-red-600 hover:bg-red-700 text-white rounded-lg p-1.5 transition-colors duration-200"
                            aria-label="Remove photo"
                          >
                            <X className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="cursor-pointer absolute -bottom-2 inset-x-0 mx-auto w-fit px-3 py-1.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                          >
                            Change photo
                          </button>
                        </div>
                      ) : (
                        <label
                          htmlFor="image-upload"
                          className="w-32 h-32 rounded-full border border-dashed border-slate-300 hover:border-primary bg-slate-50 hover:bg-slate-100 peer-focus-visible:ring-2 peer-focus-visible:ring-primary flex flex-col items-center justify-center cursor-pointer transition-colors duration-200"
                        >
                          <Upload
                            className="w-8 h-8 text-slate-400 group-hover:text-primary transition-colors mb-2"
                            aria-hidden="true"
                          />
                          <span className="text-xs text-slate-500 group-hover:text-primary font-medium">
                            Upload photo
                          </span>
                        </label>
                      )}
                    </div>
                  </div>
                </Section>

                {/* Personal Information Section */}
                <Section icon={User} title="Personal information">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <TextField
                      id="employee_id"
                      label="Employee ID"
                      required
                      type="text"
                      value={formData.employee_id}
                      onChange={handleInputChange}
                      placeholder="e.g. EMP001"
                      error={errors.employee_id}
                    />

                    <TextField
                      id="first_name"
                      label="First name"
                      required
                      type="text"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      placeholder="e.g. John"
                      error={errors.first_name}
                    />

                    <TextField
                      id="last_name"
                      label="Last name"
                      required
                      type="text"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      placeholder="e.g. Doe"
                      error={errors.last_name}
                    />

                    <div className="relative" ref={roleDropdownRef}>
                      <label
                        htmlFor="role"
                        className="block text-sm font-medium text-slate-700 mb-1.5"
                      >
                        Role{" "}
                        <span className="text-red-600" aria-hidden="true">
                          *
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          id="role"
                          type="text"
                          value={roleSearchTerm || formData.role}
                          onChange={handleRoleSearchChange}
                          onFocus={() => setIsRoleDropdownOpen(true)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape")
                              setIsRoleDropdownOpen(false);
                          }}
                          className={inputClass(!!errors.role, "pr-10")}
                          placeholder="e.g. Cabinet maker"
                          autoComplete="off"
                          required
                          aria-invalid={!!errors.role}
                          aria-describedby={
                            errors.role ? "role-error" : undefined
                          }
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setIsRoleDropdownOpen(!isRoleDropdownOpen)
                          }
                          className="cursor-pointer absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-slate-700 transition-colors duration-200"
                          aria-label="Toggle role list"
                          aria-expanded={isRoleDropdownOpen}
                        >
                          {isRoleDropdownOpen ? (
                            <ChevronUp className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <ChevronDown
                              className="w-4 h-4"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      </div>

                      {isRoleDropdownOpen && (
                        <div className="absolute z-40 w-full mt-1 bg-white border border-slate-300 rounded-lg max-h-60 overflow-auto">
                          {loadingRoles ? (
                            <div className="px-4 py-3 text-sm text-slate-500 text-center">
                              Loading roles…
                            </div>
                          ) : filteredRoleOptions.length > 0 ? (
                            <>
                              {filteredRoleOptions.map((role, index) => (
                                <button
                                  key={index}
                                  type="button"
                                  onClick={() => handleRoleSelect(role)}
                                  className="cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
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
                                      onClick={openCreateRoleModal}
                                      className="cursor-pointer w-full text-left px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors flex items-center gap-2"
                                    >
                                      <Plus
                                        className="w-4 h-4"
                                        aria-hidden="true"
                                      />
                                      Create &ldquo;{roleSearchTerm}&rdquo;
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
                                  onClick={openCreateRoleModal}
                                  className={`${BTN_SECONDARY} w-full justify-center`}
                                >
                                  <Plus
                                    className="w-4 h-4"
                                    aria-hidden="true"
                                  />
                                  Create &ldquo;{roleSearchTerm}&rdquo;
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                      {errors.role && (
                        <p
                          id="role-error"
                          className="text-xs text-red-600 mt-1"
                        >
                          {errors.role}
                        </p>
                      )}
                    </div>

                    <TextField
                      id="email"
                      label="Email"
                      icon={Mail}
                      required
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="e.g. john.doe@company.com"
                      error={errors.email}
                    />

                    <TextField
                      id="phone"
                      label="Phone"
                      icon={Phone}
                      required
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="e.g. 0400 123 456"
                      error={errors.phone}
                    />

                    <TextField
                      id="phone_secondary"
                      label="Secondary phone"
                      icon={Phone}
                      type="tel"
                      value={formData.phone_secondary}
                      onChange={handleInputChange}
                      placeholder="e.g. 0400 123 456"
                      error={errors.phone_secondary}
                    />

                    <TextField
                      id="dob"
                      label="Date of birth"
                      icon={Calendar}
                      type="date"
                      value={formData.dob}
                      onChange={handleInputChange}
                      max={today}
                      error={errors.dob}
                    />

                    <TextField
                      id="join_date"
                      label="Join date"
                      icon={Calendar}
                      type="date"
                      value={formData.join_date}
                      onChange={handleInputChange}
                      max={today}
                      error={errors.join_date}
                    />

                    <TextField
                      id="address"
                      label="Address"
                      icon={MapPin}
                      multiline
                      rows={3}
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="e.g. 123 Main Street, Adelaide SA 5000"
                      className="md:col-span-2 lg:col-span-3"
                    />
                  </div>
                </Section>

                {/* Emergency Contact Section */}
                <Section icon={Phone} title="Emergency contact">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <TextField
                      id="emergency_contact_name"
                      label="Emergency contact name"
                      type="text"
                      value={formData.emergency_contact_name}
                      onChange={handleInputChange}
                      placeholder="e.g. Jane Doe"
                    />

                    <TextField
                      id="emergency_contact_phone"
                      label="Emergency contact phone"
                      type="tel"
                      value={formData.emergency_contact_phone}
                      onChange={handleInputChange}
                      placeholder="e.g. 0400 123 456"
                      error={errors.emergency_contact_phone}
                    />
                  </div>
                </Section>

                {/* Banking Information Section */}
                <Section icon={CreditCard} title="Banking information">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <TextField
                      id="bank_account_name"
                      label="Bank account holder name"
                      type="text"
                      value={formData.bank_account_name}
                      onChange={handleInputChange}
                      placeholder="e.g. John Doe"
                    />

                    <TextField
                      id="bank_account_number"
                      label="Bank account number"
                      type="text"
                      value={formData.bank_account_number}
                      onChange={handleInputChange}
                      placeholder="e.g. 1234 5678"
                    />

                    <TextField
                      id="bank_account_bsb"
                      label="Bank account BSB"
                      type="text"
                      value={formData.bank_account_bsb}
                      onChange={handleInputChange}
                      placeholder="e.g. 123-456"
                    />

                    <TextField
                      id="supper_account_name"
                      label="Super account name"
                      type="text"
                      value={formData.supper_account_name}
                      onChange={handleInputChange}
                      placeholder="e.g. John Doe Super"
                    />

                    <TextField
                      id="supper_account_number"
                      label="Super account member ID"
                      type="text"
                      value={formData.supper_account_number}
                      onChange={handleInputChange}
                      placeholder="e.g. 1234567890"
                    />

                    <TextField
                      id="tfn_number"
                      label="TFN number"
                      type="text"
                      value={formData.tfn_number}
                      onChange={handleInputChange}
                      placeholder="e.g. 123456789"
                    />

                    <TextField
                      id="abn_number"
                      label="ABN number"
                      type="text"
                      value={formData.abn_number}
                      onChange={handleInputChange}
                      placeholder="e.g. 12345678901"
                    />
                  </div>
                </Section>

                {/* Additional Information Section */}
                <Section icon={GraduationCap} title="Additional information">
                  <div className="space-y-4">
                    <TextField
                      id="education"
                      label="Education"
                      multiline
                      rows={3}
                      value={formData.education}
                      onChange={handleInputChange}
                      placeholder="e.g. Certificate III in Cabinet Making"
                    />

                    <fieldset className="min-w-0">
                      <legend className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1.5 p-0">
                        <Clock className="w-4 h-4" aria-hidden="true" />
                        Weekly availability
                      </legend>
                      <div className="space-y-3">
                        {daysOfWeek.map((day) => {
                          const times = availability[day];
                          const dayLabel = titleCase(day);
                          return (
                            <div
                              key={day}
                              className="flex flex-wrap items-center gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg"
                            >
                              <div className="w-24">
                                <span className="text-sm font-medium text-slate-700">
                                  {dayLabel}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <label
                                  htmlFor={`availability-${day}-start`}
                                  className="text-sm text-slate-600"
                                >
                                  Start
                                  <span className="sr-only">
                                    {" "}
                                    time on {dayLabel}
                                  </span>
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
                                  className="px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label
                                  htmlFor={`availability-${day}-end`}
                                  className="text-sm text-slate-600"
                                >
                                  End
                                  <span className="sr-only">
                                    {" "}
                                    time on {dayLabel}
                                  </span>
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
                                  className="px-3 py-2 text-sm text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </fieldset>

                    <TextField
                      id="notes"
                      label="Personal notes"
                      icon={User}
                      multiline
                      rows={4}
                      value={formData.notes}
                      onChange={handleInputChange}
                      placeholder="e.g. Holds a forklift licence"
                      hint="These notes are for admin reference only and will not be visible to the employee."
                    />

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
                          aria-describedby="is_active-hint"
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                        <span className="text-sm font-medium text-slate-700">
                          Active employee
                        </span>
                      </label>
                      <p
                        id="is_active-hint"
                        className="text-xs text-slate-500 mt-1 ml-6"
                      >
                        Uncheck to mark this employee as inactive.
                      </p>
                    </div>
                  </div>
                </Section>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => router.back()}
                    disabled={isSubmitting}
                    className={BTN_SECONDARY}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className={BTN_PRIMARY}
                  >
                    {isSubmitting ? (
                      <span
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Save className="w-4 h-4" aria-hidden="true" />
                    )}
                    Create employee
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
          onClick={() => {
            if (!isRoleModalDirty && !isCreatingRole) closeRoleModal();
          }}
        >
          <div
            ref={roleModalRef}
            className="bg-white rounded-xl border border-slate-200 w-full max-w-md max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-role-title"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2
                id="create-role-title"
                className="text-lg font-semibold text-slate-800"
              >
                Create role
              </h2>
              <button
                type="button"
                onClick={closeRoleModal}
                className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateNewRole();
              }}
              className="flex flex-col min-h-0 flex-1"
            >
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label
                    htmlFor="new-role-name"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Role name{" "}
                    <span className="text-red-600" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <input
                    id="new-role-name"
                    type="text"
                    data-autofocus
                    value={newRoleValue}
                    onChange={(e) => {
                      setNewRoleValue(e.target.value);
                      if (newRoleError && e.target.value.trim())
                        setNewRoleError("");
                    }}
                    placeholder="e.g. Cabinet maker"
                    required
                    aria-invalid={!!newRoleError}
                    aria-describedby={
                      newRoleError ? "new-role-name-error" : undefined
                    }
                    className={inputClass(!!newRoleError)}
                  />
                  {newRoleError && (
                    <p
                      id="new-role-name-error"
                      className="text-xs text-red-600 mt-1"
                    >
                      {newRoleError}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeRoleModal}
                  disabled={isCreatingRole}
                  className={BTN_SECONDARY}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingRole}
                  className={BTN_PRIMARY}
                >
                  {isCreatingRole ? (
                    <span
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus className="w-4 h-4" aria-hidden="true" />
                  )}
                  Create role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
