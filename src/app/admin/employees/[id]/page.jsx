"use client";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import TabsController from "@/components/tabscontroller";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  User,
  Mail,
  Phone,
  MapPin,
  Clock,
  CreditCard,
  AlertTriangle,
  Edit,
  Shield,
  Eye,
  EyeOff,
  X,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { CiMenuKebab } from "react-icons/ci";
import { useAuth } from "@/contexts/AuthContext";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  validateEmail,
  validatePhone,
  validateName,
  validateTFN,
  validateEmergencyName,
  validateEmergencyPhone,
} from "@/components/validators";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import Image from "next/image";
import { AdminRoute } from "@/components/ProtectedRoute";
import { useRouter } from "next/navigation";

export default function EmployeeDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { getToken, isAdmin, isMasterAdmin } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showUserModal, setShowUserModal] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userEditData, setUserEditData] = useState({});
  const [moduleAccess, setModuleAccess] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [expandedModules, setExpandedModules] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteEmployeeModal, setShowDeleteEmployeeModal] = useState(false);
  const [isDeletingEmployee, setIsDeletingEmployee] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [viewFileModal, setViewFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const fileInputRef = useRef(null);

  // Module structure definition
  const moduleStructure = [
    {
      key: "dashboard",
      label: "Dashboard",
      isParent: false,
    },
    {
      key: "employees",
      label: "Employees",
      isParent: true,
      children: [
        { key: "all_employees", label: "All Employee" },
        { key: "add_employees", label: "Add Employee" },
        { key: "employee_details", label: "Employee Detail" },
      ],
    },
    {
      key: "clients",
      label: "Client",
      isParent: true,
      children: [
        { key: "all_clients", label: "All Client" },
        { key: "add_clients", label: "Add Client" },
        { key: "client_details", label: "Client Detail" },
      ],
    },
    {
      key: "projects",
      label: "Project",
      isParent: true,
      children: [
        { key: "all_projects", label: "All Project" },
        { key: "add_projects", label: "Add Project" },
        { key: "project_details", label: "Project Detail" },
        { key: "lotatglance", label: "Lot at Glance" },
      ],
    },
    {
      key: "suppliers",
      label: "Supplier",
      isParent: true,
      children: [
        { key: "all_suppliers", label: "All Supplier" },
        { key: "add_suppliers", label: "Add Supplier" },
        { key: "supplier_details", label: "Supplier Detail" },
        { key: "materialstoorder", label: "Materials to Order" },
        { key: "purchaseorder", label: "Purchase Order" },
        { key: "statements", label: "Statement" },
      ],
    },
    {
      key: "inventory",
      label: "Inventory",
      isParent: true,
      children: [
        { key: "all_items", label: "All Item" },
        { key: "add_items", label: "Add Item" },
        { key: "item_details", label: "Item Detail" },
        { key: "usedmaterial", label: "Used Material" },
      ],
    },
    {
      key: "delete_media",
      label: "Deleted Media",
      isParent: false,
    },
    {
      key: "logs",
      label: "Logs",
      isParent: false,
    },
  ];

  useEffect(() => {
    fetchEmployee();
  }, [id]);

  // Add this useEffect to clean up memory
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest(".dropdown-container")) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const fetchEmployee = async () => {
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

      const response = await axios.get(`/api/employee/${id}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        const employeeData = response.data.data;
        // Parse availability if it's a JSON string
        if (
          employeeData.availability &&
          typeof employeeData.availability === "string"
        ) {
          try {
            employeeData.availability = JSON.parse(employeeData.availability);
          } catch (e) {
            console.error("Error parsing availability:", e);
            employeeData.availability = {};
          }
        }
        setEmployee(employeeData);
        setUser(employeeData.user || null);
      } else {
        setError(response.data.message || "Failed to fetch employee data");
      }
    } catch (err) {
      console.error("API Error:", err);
      console.error("Error Response:", err.response?.data);
      setError(
        err.response?.data?.message ||
        "An error occurred while fetching employee data"
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString || dateString.trim() === "") {
      return "-";
    }
    return new Date(dateString).toLocaleDateString("en-AU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (timeString) => {
    if (!timeString || timeString.trim() === "") {
      return "-";
    }
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
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

  const updateEmployee = async (updatedData) => {
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

      // If there's an image file, use FormData; otherwise use JSON
      const formDataToSend = new FormData();

      // Append all form data
      Object.keys(updatedData).forEach((key) => {
        if (key === "availability") {
          // Convert availability to JSON string
          formDataToSend.append(key, JSON.stringify(updatedData[key]));
        } else {
          formDataToSend.append(key, updatedData[key] || "");
        }
      });

      // Append image file if it exists
      if (imageFile) {
        formDataToSend.append("image", imageFile);
      }

      // Append remove_image flag if image should be removed
      if (removeImage && !imageFile) {
        formDataToSend.append("remove_image", "true");
      }

      // Determine content type and data to send
      const isFormData = imageFile !== null || removeImage;
      let dataToSend = isFormData ? formDataToSend : updatedData;

      // If sending JSON, ensure availability is stringified
      if (!isFormData && updatedData.availability) {
        dataToSend = {
          ...updatedData,
          availability: JSON.stringify(updatedData.availability),
        };
      }

      const contentType = isFormData
        ? "multipart/form-data"
        : "application/json";

      const response = await axios.patch(`/api/employee/${id}`, dataToSend, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": contentType,
        },
      });

      if (response.data.status) {
        const employeeData = response.data.data;
        // Parse availability if it's a JSON string
        if (
          employeeData.availability &&
          typeof employeeData.availability === "string"
        ) {
          try {
            employeeData.availability = JSON.parse(employeeData.availability);
          } catch (e) {
            console.error("Error parsing availability:", e);
            employeeData.availability = {};
          }
        }
        setEmployee(employeeData);
        // Update user if present in response
        if (employeeData.user) {
          setUser(employeeData.user);
        }
        // Reset image state after successful update
        if (imageFile || removeImage) {
          setImageFile(null);
          setRemoveImage(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
        // Update image preview if image exists in response
        if (employeeData.image) {
          setImagePreview(`/${employeeData.image.url}`);
        } else if (removeImage) {
          setImagePreview(null);
        }
        toast.success("Employee updated successfully!", {
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
      }
    } catch (error) {
      console.error("Error updating employee:", error);
      toast.error(
        error.response?.data?.message ||
        "Failed to update employee. Please try again.",
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

  const handleEdit = () => {
    if (employee) {
      // Initialize availability with all days, using existing data or empty strings
      // Parse availability if it's a JSON string
      let availability = employee.availability || {};
      if (typeof availability === "string") {
        try {
          availability = JSON.parse(availability);
        } catch (e) {
          console.error("Error parsing availability in handleEdit:", e);
          availability = {};
        }
      }
      const formattedAvailability = {};

      // Always initialize all weekdays for editing
      [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ].forEach((day) => {
        formattedAvailability[day] = {
          start: availability[day]?.start || "",
          end: availability[day]?.end || "",
        };
      });

      setEditData({
        employee_id: employee.employee_id,
        first_name: employee.first_name,
        last_name: employee.last_name,
        role: employee.role,
        email: employee.email,
        phone: employee.phone,
        dob: employee.dob ? new Date(employee.dob).toISOString().split('T')[0] : "",
        join_date: employee.join_date ? new Date(employee.join_date).toISOString().split('T')[0] : "",
        address: employee.address || "",
        emergency_contact_name: employee.emergency_contact_name || "",
        emergency_contact_phone: employee.emergency_contact_phone || "",
        bank_account_name: employee.bank_account_name || "",
        bank_account_number: employee.bank_account_number || "",
        bank_account_bsb: employee.bank_account_bsb || "",
        supper_account_name: employee.supper_account_name || "",
        supper_account_number: employee.supper_account_number || "",
        tfn_number: employee.tfn_number || "",
        abn_number: employee.abn_number || "",
        education: employee.education || "",
        availability: formattedAvailability,
        notes: employee.notes || "",
      });
      // Reset image state
      setImagePreview(employee.image ? `/${employee.image.url}` : null);
      setImageFile(null);
      setRemoveImage(false);
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    const validationErrors = validateForm();

    if (validationErrors.length > 0) {
      // Show first validation error
      toast.error(validationErrors[0], {
        position: "top-right",
        autoClose: 4000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
      return;
    }

    updateEmployee(editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
    // Reset image state
    setImagePreview(employee?.image ? `/${employee.image.url}` : null);
    setImageFile(null);
    setRemoveImage(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setRemoveImage(false); // If user uploads a new image, don't remove
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setRemoveImage(true); // Mark image for removal
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleInputChange = (field, value) => {
    setEditData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleAvailabilityChange = (day, field, value) => {
    setEditData((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability?.[day],
          [field]: value,
        },
      },
    }));
  };

  // User management functions
  const handleViewUser = () => {
    if (user && Object.keys(user).length > 0) {
      setUserEditData({
        password: "",
        user_type: user.user_type || "",
        is_active: user.is_active || false,
      });

      setModuleAccess(user.module_access || {});
      // Initialize expanded modules - expand all parent modules by default
      const initialExpanded = {};
      moduleStructure.forEach((module) => {
        if (module.isParent) {
          initialExpanded[module.key] = true;
        }
      });
      setExpandedModules(initialExpanded);
      setShowPassword(false);
      setShowUserModal(true);
    }
  };

  const handleUserSave = async () => {
    try {
      setIsUpdating(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }
      const updateData = {
        id: user.id,
        user_type: userEditData.user_type,
        is_active: userEditData.is_active,
        module_access: moduleAccess,
        password: userEditData.password,
      };

      const response = await axios.patch(`/api/user/${user.id}`, updateData, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.data.status) {
        toast.success("User updated successfully");
        setUser(response.data.data);
        setIsEditingUser(false);
        setShowUserModal(false);
      } else {
        toast.error(response.data.message || "Failed to update user");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUserCancel = () => {
    setIsEditingUser(false);
    setUserEditData({
      password: "",
      user_type: user.user_type || "",
      is_active: user.is_active || false,
    });
  };

  const handleUserInputChange = (field, value) => {
    setUserEditData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleModuleAccessChange = (moduleKey, checked) => {
    setModuleAccess((prev) => ({
      ...prev,
      [moduleKey]: checked,
    }));
  };

  const toggleModuleExpansion = (module) => {
    setExpandedModules((prev) => ({
      ...prev,
      [module]: !prev[module],
    }));
  };

  // Create user functions
  const handleCreateUser = () => {
    if (employee) {
      setUserEditData({
        username: employee.email || "",
        password: "",
        user_type: "",
        is_active: false,
        employee_id: employee.employee_id || "",
      });

      // Initialize module access as empty
      setModuleAccess({});
      // Initialize expanded modules - expand all parent modules by default
      const initialExpanded = {};
      moduleStructure.forEach((module) => {
        if (module.isParent) {
          initialExpanded[module.key] = true;
        }
      });
      setExpandedModules(initialExpanded);
      setShowPassword(false);
      setIsCreatingUser(true);
      setShowUserModal(true);
    }
  };

  const handleCreateUserSave = async () => {
    try {
      setIsUpdating(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      // Validate required fields
      if (
        !userEditData.username ||
        !userEditData.password ||
        !userEditData.user_type
      ) {
        toast.error("Please fill in all required fields");
        return;
      }

      const createData = {
        username: userEditData.username,
        password: userEditData.password,
        user_type: userEditData.user_type,
        is_active: userEditData.is_active,
        employee_id: userEditData.employee_id,
        module_access: moduleAccess,
      };

      console.log(createData);

      const response = await axios.post(`/api/signup`, createData, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.data.status) {
        toast.success("User created successfully");
        const newUser = response.data.data.user;
        setUser(newUser);

        // Parse module access from the created user
        let parsedModuleAccess = {};
        if (response.data.data.module_access) {
          try {
            parsedModuleAccess = JSON.parse(response.data.data.module_access);
          } catch (e) {
            console.error("Error parsing module access:", e);
          }
        }

        // Transition to edit mode with the newly created user
        setUserEditData({
          password: "",
          user_type: newUser.user_type || "",
          is_active: newUser.is_active || false,
        });
        setModuleAccess(parsedModuleAccess);
        // Initialize expanded modules - expand all parent modules by default
        const initialExpanded = {};
        moduleStructure.forEach((module) => {
          if (module.isParent) {
            initialExpanded[module.key] = true;
          }
        });
        setExpandedModules(initialExpanded);
        setIsCreatingUser(false);
        setIsEditingUser(true);
        setShowPassword(false);
        // Keep modal open in edit mode

        // Refresh employee data in the background to update dropdown state
        fetchEmployee();
      } else {
        toast.error(response.data.message || "Failed to create user");
      }
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error("Failed to create user");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateUserCancel = () => {
    setIsCreatingUser(false);
    setUserEditData({});
    setModuleAccess({});
    setShowPassword(false);
    setShowUserModal(false);
  };

  const handleDeleteConfirm = async () => {
    try {
      setIsUpdating(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const response = await axios.delete(`/api/user/${id}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        toast.success(
          "User account removed successfully. Employee data is preserved."
        );
        // Refresh employee data to update user status
        await fetchEmployee();
        setShowUserModal(false);
        setShowDeleteModal(false);
      } else {
        toast.error(response.data.message || "Failed to remove user account");
      }
    } catch (error) {
      console.error("Error removing user account:", error);
      toast.error("Failed to remove user account");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteEmployeeConfirm = async () => {
    try {
      setIsDeletingEmployee(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const response = await axios.delete(
        `/api/employee/${employee.employee_id}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      if (response.data.status) {
        toast.success("Employee deleted successfully");
        setShowDeleteEmployeeModal(false);
        // Navigate back to employees list
        router.push("/admin/employees");
      } else {
        toast.error(response.data.message || "Failed to delete employee");
      }
    } catch (error) {
      console.error("Error deleting employee:", error);
      toast.error("Failed to delete employee. Please try again.");
    } finally {
      setIsDeletingEmployee(false);
    }
  };

  const validateForm = () => {
    const errors = [];

    // Email validation
    if (editData.email && !validateEmail(editData.email)) {
      errors.push("Please enter a valid email address");
    }

    // Phone validation
    if (editData.phone && !validatePhone(editData.phone)) {
      errors.push(
        "Phone number should contain only numbers and be at least 8 digits"
      );
    }

    // Name validation
    if (editData.first_name && !validateName(editData.first_name)) {
      errors.push("First name should contain only letters and spaces");
    }

    if (editData.last_name && !validateName(editData.last_name)) {
      errors.push("Last name should contain only letters and spaces");
    }

    // TFN validation
    if (editData.tfn_number && !validateTFN(editData.tfn_number)) {
      errors.push("TFN should contain only numbers and be at least 8 digits");
    }

    // Emergency contact validation
    if (
      editData.emergency_contact_name &&
      !validateEmergencyName(editData.emergency_contact_name)
    ) {
      errors.push(
        "Emergency contact name should contain only letters and spaces"
      );
    }

    if (
      editData.emergency_contact_phone &&
      !validateEmergencyPhone(editData.emergency_contact_phone)
    ) {
      errors.push(
        "Emergency contact phone should contain only numbers and be at least 8 digits"
      );
    }

    return errors;
  };

  const handleViewEmployeeImage = () => {
    if (employee?.image) {
      const fileUrl = `/${employee.image.url}`;
      setSelectedFile({
        name:
          employee.image.filename ||
          `${employee.first_name}_${employee.last_name}_image`,
        type: employee.image.mime_type || "image/jpeg",
        size: employee.image.size || 0,
        url: fileUrl,
        isExisting: true,
      });
      setViewFileModal(true);
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
                  <p className="text-slate-600">Loading employee details...</p>
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
            ) : !employee ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <User className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-600">Employee not found</p>
                </div>
              </div>
            ) : (
              <div className="p-3">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <TabsController href="/admin/employees" title="Employees">
                    <div className="cursor-pointer p-2 hover:bg-slate-200 rounded-lg transition-colors">
                      <ChevronLeft className="w-6 h-6 text-slate-600" />
                    </div>
                  </TabsController>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-600">
                      {employee.first_name} {employee.last_name}
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
                                Edit Employee Details
                              </button>
                              {isAdmin() && (
                                <>
                                  {user && Object.keys(user).length > 0 ? (
                                    <button
                                      onClick={() => {
                                        handleViewUser();
                                        setShowDropdown(false);
                                      }}
                                      className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                                    >
                                      <Eye className="w-4 h-4" />
                                      View User Details
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        handleCreateUser();
                                        setShowDropdown(false);
                                      }}
                                      className="cursor-pointer w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3"
                                    >
                                      <User className="w-4 h-4" />
                                      Create User
                                    </button>
                                  )}
                                </>
                              )}
                              <button
                                onClick={() => {
                                  setShowDeleteEmployeeModal(true);
                                  setShowDropdown(false);
                                }}
                                className="cursor-pointer w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50 flex items-center gap-3"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete Employee
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

                <div className="grid grid-cols-3 gap-4">
                  {/* Left Column - Main Info */}
                  <div className="col-span-2 space-y-4">
                    {/* Profile Card */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                      <div className="flex items-start gap-4">
                        {isEditing ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="relative group">
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="hidden"
                                id="image-upload-edit"
                              />

                              {imagePreview ? (
                                <div className="relative">
                                  <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-primary shadow-lg">
                                    <Image
                                      loading="lazy"
                                      src={imagePreview}
                                      alt="Preview"
                                      className="w-full h-full object-cover"
                                      width={64}
                                      height={64}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleRemoveImage}
                                    className="absolute top-1 right-1 bg-secondary text-white rounded-full p-1.5 shadow-lg hover:bg-secondary transition-all duration-200 transform hover:scale-110 cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 bg-primary text-white rounded-full px-3 py-1 text-xs shadow-lg hover:scale-110 transition-all duration-200 cursor-pointer"
                                  >
                                    Change
                                  </button>
                                </div>
                              ) : (
                                <label
                                  htmlFor="image-upload-edit"
                                  className="w-16 h-16 rounded-full border-4 border-dashed border-slate-300 hover:border-primary bg-slate-50 hover:bg-blue-50 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group-hover:shadow-lg"
                                >
                                  <Upload className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors mb-1" />
                                  <span className="text-xs text-slate-500 group-hover:text-primary font-medium">
                                    Upload
                                  </span>
                                </label>
                              )}
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <p className="text-xs text-slate-500 text-center">
                                {imagePreview
                                  ? "Click X to remove"
                                  : "Click to upload photo"}
                              </p>
                              {employee?.image && !imagePreview && (
                                <button
                                  type="button"
                                  onClick={handleRemoveImage}
                                  className="text-xs text-red-600 hover:text-red-700 underline cursor-pointer"
                                >
                                  Remove current photo
                                </button>
                              )}
                            </div>
                          </div>
                        ) : employee.image ? (
                          <div
                            onClick={handleViewEmployeeImage}
                            className="cursor-pointer group relative"
                          >
                            <Image
                              loading="lazy"
                              src={`/${employee.image.url}`}
                              alt={employee.first_name + " " + employee.last_name}
                              className="w-16 h-16 rounded-full object-cover transition-transform duration-200 group-hover:scale-105 group-hover:shadow-lg"
                              width={64}
                              height={64}
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-full transition-colors duration-200 flex items-center justify-center">
                              <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                            </div>
                          </div>
                        ) : (
                          <div className="w-16 h-16 bg-gradient-to-br from-secondary to-primary rounded-full flex items-center justify-center text-white text-lg font-bold">
                            {employee?.first_name?.[0] || ""}
                            {employee?.last_name?.[0] || ""}
                          </div>
                        )}
                        <div className="flex-1">
                          {isEditing ? (
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editData.first_name || ""}
                                  onChange={(e) =>
                                    handleInputChange(
                                      "first_name",
                                      e.target.value
                                    )
                                  }
                                  placeholder={employee.first_name}
                                  className="text-xl font-bold text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                                />
                                <input
                                  type="text"
                                  value={editData.last_name || ""}
                                  onChange={(e) =>
                                    handleInputChange("last_name", e.target.value)
                                  }
                                  placeholder={employee.last_name}
                                  className="text-xl font-bold text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                                />
                                <select
                                  value={editData.role || ""}
                                  onChange={(e) =>
                                    handleInputChange("role", e.target.value)
                                  }
                                  className="cursor-pointer px-2 py-1 text-xs font-medium border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                                >
                                  <option value="">Select Type</option>
                                  <option value="Administrator">
                                    Administrator
                                  </option>
                                  <option value="Site Manager">
                                    Site Manager
                                  </option>
                                  <option value="Supervisor">Supervisor</option>
                                  <option value="Employee">Employee</option>
                                  <option value="Contractor">Contractor</option>
                                  <option value="CNC Operator">
                                    CNC Operator
                                  </option>
                                </select>
                              </div>
                              <p className="text-sm text-slate-500">
                                Employee ID: {employee.employee_id}
                              </p>

                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Mail className="w-4 h-4 text-slate-600" />
                                  <input
                                    type="email"
                                    value={editData.email || ""}
                                    onChange={(e) =>
                                      handleInputChange("email", e.target.value)
                                    }
                                    placeholder={employee.email || "Email"}
                                    className="text-sm text-slate-600 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none flex-1"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Phone className="w-4 h-4 text-slate-600" />
                                  <input
                                    type="tel"
                                    value={editData.phone || ""}
                                    onChange={(e) =>
                                      handleInputChange("phone", e.target.value)
                                    }
                                    placeholder={employee.phone || "Phone"}
                                    className="text-sm text-slate-600 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none flex-1"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-slate-600" />
                                  <input
                                    type="text"
                                    value={editData.address || ""}
                                    onChange={(e) =>
                                      handleInputChange("address", e.target.value)
                                    }
                                    placeholder={employee.address || "Address"}
                                    className="text-sm text-slate-600 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none flex-1"
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 mb-2">
                                <h2 className="text-lg font-bold text-slate-800">
                                  {employee.first_name} {employee.last_name}
                                </h2>
                                {user && Object.keys(user).length > 0 && (
                                  <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-800 rounded-full capitalize">
                                    {user.user_type}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mb-3">
                                ID: {employee.employee_id}
                              </p>
                              <div className="space-y-1">
                                <div className="flex flex-wrap gap-3 text-sm">
                                  <a href={`mailto:${employee.email}`}>
                                    <div className="flex items-center gap-1.5 text-slate-600 hover:text-slate-800">
                                      <Mail className="w-3.5 h-3.5" />
                                      {formatValue(employee.email)}
                                    </div>
                                  </a>
                                  <div className="flex items-center gap-1.5 text-slate-600">
                                    <Phone className="w-3.5 h-3.5" />
                                    {formatValue(employee.phone)}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-slate-600 text-sm">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {formatValue(employee.address)}
                                  </div>
                                </div>
                                {employee.role && (
                                  <div className="text-xs text-slate-500">
                                    Role: {employee.role}
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Personal Information */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                      <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                        <User className="w-4 h-4" />
                        Personal Information
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 block">
                            Date of Birth
                          </label>
                          {isEditing ? (
                            <input
                              type="date"
                              value={editData.dob || ""}
                              onChange={(e) =>
                                handleInputChange("dob", e.target.value)
                              }
                              placeholder={formatDate(employee.dob)}
                              className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                            />
                          ) : (
                            <p className="text-sm text-slate-700">
                              {formatDate(employee.dob)}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 block">
                            Join Date
                          </label>
                          {isEditing ? (
                            <input
                              type="date"
                              value={editData.join_date || ""}
                              onChange={(e) =>
                                handleInputChange("join_date", e.target.value)
                              }
                              placeholder={formatDate(employee.join_date)}
                              max={new Date().toISOString().split("T")[0]}
                              className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                            />
                          ) : (
                            <p className="text-sm text-slate-700">
                              {formatDate(employee.join_date)}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 block">
                            TFN Number
                          </label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.tfn_number || ""}
                              onChange={(e) =>
                                handleInputChange("tfn_number", e.target.value)
                              }
                              placeholder={formatValue(employee.tfn_number)}
                              className="w-full text-sm text-slate-800 font-mono px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                            />
                          ) : (
                            <p className="text-sm text-slate-700 font-mono">
                              {formatValue(employee.tfn_number)}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 block">
                            ABN Number
                          </label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.abn_number || ""}
                              onChange={(e) =>
                                handleInputChange("abn_number", e.target.value)
                              }
                              placeholder={formatValue(employee.abn_number)}
                              className="w-full text-sm text-slate-800 font-mono px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                            />
                          ) : (
                            <p className="text-sm text-slate-700 font-mono">
                              {formatValue(employee.abn_number)}
                            </p>
                          )}
                        </div>
                        <div className="col-span-2">
                          <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 block">
                            Education
                          </label>
                          {isEditing ? (
                            <textarea
                              value={editData.education || ""}
                              onChange={(e) =>
                                handleInputChange("education", e.target.value)
                              }
                              placeholder={formatValue(employee.education)}
                              rows={3}
                              className="w-full text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                            />
                          ) : (
                            <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded">
                              {formatValue(employee.education)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Emergency Contact */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                      <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        Emergency Contact
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 block">
                            Contact Name
                          </label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.emergency_contact_name || ""}
                              onChange={(e) =>
                                handleInputChange(
                                  "emergency_contact_name",
                                  e.target.value
                                )
                              }
                              placeholder={formatValue(
                                employee.emergency_contact_name
                              )}
                              className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                            />
                          ) : (
                            <p className="text-sm text-slate-700">
                              {formatValue(employee.emergency_contact_name)}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 block">
                            Contact Phone
                          </label>
                          {isEditing ? (
                            <input
                              type="tel"
                              value={editData.emergency_contact_phone || ""}
                              onChange={(e) =>
                                handleInputChange(
                                  "emergency_contact_phone",
                                  e.target.value
                                )
                              }
                              placeholder={formatValue(
                                employee.emergency_contact_phone
                              )}
                              className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                            />
                          ) : (
                            <p className="text-sm text-slate-700">
                              {formatValue(employee.emergency_contact_phone)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Availability Schedule */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                      <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        Work Schedule
                      </h3>
                      <div className="space-y-2">
                        {isEditing ? (
                          // Show editable time inputs for all days when editing
                          [
                            "monday",
                            "tuesday",
                            "wednesday",
                            "thursday",
                            "friday",
                            "saturday",
                            "sunday",
                          ].map((day) => (
                            <div
                              key={day}
                              className="flex items-center justify-between py-1.5 px-3 bg-slate-50 rounded-lg"
                            >
                              <span className="text-xs font-medium text-slate-700 capitalize">
                                {day}
                              </span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  value={
                                    editData.availability?.[day]?.start || ""
                                  }
                                  onChange={(e) =>
                                    handleAvailabilityChange(
                                      day,
                                      "start",
                                      e.target.value
                                    )
                                  }
                                  className="text-xs text-slate-600 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                                />
                                <span className="text-xs text-slate-400">-</span>
                                <input
                                  type="time"
                                  value={editData.availability?.[day]?.end || ""}
                                  onChange={(e) =>
                                    handleAvailabilityChange(
                                      day,
                                      "end",
                                      e.target.value
                                    )
                                  }
                                  className="text-xs text-slate-600 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                                />
                              </div>
                            </div>
                          ))
                        ) : // Show existing availability or empty state when not editing
                          employee.availability ? (
                            Object.entries(
                              (() => {
                                if (typeof employee.availability === "string") {
                                  try {
                                    return JSON.parse(employee.availability);
                                  } catch (e) {
                                    console.error("Error parsing availability:", e);
                                    return {};
                                  }
                                }
                                return employee.availability;
                              })()
                            ).map(([day, schedule]) => (
                              <div
                                key={day}
                                className="flex items-center justify-between py-1.5 px-3 bg-slate-50 rounded-lg"
                              >
                                <span className="text-xs font-medium text-slate-700 capitalize">
                                  {day}
                                </span>
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                  <span>{formatTime(schedule.start)}</span>
                                  <span>
                                    {formatTime(schedule.start) !== "-" &&
                                      formatTime(schedule.end) !== "-"
                                      ? "-"
                                      : ""}
                                  </span>
                                  <span>{formatTime(schedule.end)}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-6 text-slate-500">
                              <Clock className="w-6 h-6 mx-auto mb-2 text-slate-400" />
                              <p className="text-sm">No work schedule set</p>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>

                  {/* Right Column - Financial Info */}
                  <div className="space-y-4">
                    {/* Banking Information */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                      <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4" />
                        Banking Details
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 block">
                            Bank Account Holder Name
                          </label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.bank_account_name || ""}
                              onChange={(e) =>
                                handleInputChange(
                                  "bank_account_name",
                                  e.target.value
                                )
                              }
                              placeholder={formatValue(
                                employee.bank_account_name
                              )}
                              className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                            />
                          ) : (
                            <p className="text-sm text-slate-700">
                              {formatValue(employee.bank_account_name)}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 block">
                            Bank Account Number
                          </label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.bank_account_number || ""}
                              onChange={(e) =>
                                handleInputChange(
                                  "bank_account_number",
                                  e.target.value
                                )
                              }
                              placeholder={formatValue(
                                employee.bank_account_number
                              )}
                              className="w-full text-sm text-slate-800 font-mono px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                            />
                          ) : (
                            <p className="text-sm text-slate-700 font-mono">
                              {formatValue(employee.bank_account_number)}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 block">
                            Bank Account BSB
                          </label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.bank_account_bsb || ""}
                              onChange={(e) =>
                                handleInputChange(
                                  "bank_account_bsb",
                                  e.target.value
                                )
                              }
                              placeholder={formatValue(employee.bank_account_bsb)}
                              className="w-full text-sm text-slate-800 font-mono px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                            />
                          ) : (
                            <p className="text-sm text-slate-700 font-mono">
                              {formatValue(employee.bank_account_bsb)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Superannuation */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                      <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-1.5">
                        <Shield className="w-4 h-4" />
                        Superannuation
                      </h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 block">
                            Fund Name
                          </label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.supper_account_name || ""}
                              onChange={(e) =>
                                handleInputChange(
                                  "supper_account_name",
                                  e.target.value
                                )
                              }
                              placeholder={formatValue(
                                employee.supper_account_name
                              )}
                              className="w-full text-sm text-slate-800 px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                            />
                          ) : (
                            <p className="text-sm text-slate-700">
                              {formatValue(employee.supper_account_name)}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-wide text-slate-500 mb-1 block">
                            Member ID
                          </label>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editData.supper_account_number || ""}
                              onChange={(e) =>
                                handleInputChange(
                                  "supper_account_number",
                                  e.target.value
                                )
                              }
                              placeholder={formatValue(
                                employee.supper_account_number
                              )}
                              className="w-full text-sm text-slate-800 font-mono px-2 py-1 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                            />
                          ) : (
                            <p className="text-sm text-slate-700 font-mono">
                              {formatValue(employee.supper_account_number)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
                      <h3 className="text-sm font-bold text-slate-800 mb-3">
                        Notes
                      </h3>
                      {isEditing ? (
                        <textarea
                          value={editData.notes || ""}
                          onChange={(e) =>
                            handleInputChange("notes", e.target.value)
                          }
                          placeholder={formatValue(employee.notes)}
                          rows={3}
                          className="w-full text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                        />
                      ) : (
                        <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded">
                          {formatValue(employee.notes)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* User Details Modal */}
        {showUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs">
            <div
              className="absolute inset-0 bg-slate-900/40"
              onClick={() => {
                setShowUserModal(false);
                setShowPassword(false);
              }}
            />
            <div className="relative bg-white w-full max-w-lg mx-4 rounded-xl shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-700">
                  {isCreatingUser ? "Create User Account" : "User Details"}
                </h2>
                <button
                  onClick={() => {
                    setShowUserModal(false);
                    setShowPassword(false);
                  }}
                  className="cursor-pointer p-2 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5 text-slate-600" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* User Information */}
                {!isCreatingUser && user && Object.keys(user).length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                        Username
                      </div>
                      <div className="text-slate-700">{user.username}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                        User ID
                      </div>
                      <div className="text-slate-700 font-mono text-sm">
                        {user.id}
                      </div>
                    </div>
                  </div>
                )}

                {/* Editable Fields */}
                <div className="space-y-4">
                  {/* Employee ID - First */}
                  {isCreatingUser && (
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                        Employee ID
                      </div>
                      <input
                        type="text"
                        value={userEditData.employee_id || ""}
                        disabled
                        className="w-full text-sm text-slate-500 px-3 py-2 border border-slate-300 rounded bg-slate-100"
                      />
                    </div>
                  )}

                  {/* Username and User Type - Side by side */}
                  <div className="grid grid-cols-2 gap-3">
                    {isCreatingUser && (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                          Username <span className="text-red-500">*</span>
                        </div>
                        <input
                          type="email"
                          value={userEditData.username || ""}
                          onChange={(e) =>
                            handleUserInputChange("username", e.target.value)
                          }
                          placeholder="Enter username (email)"
                          className="w-full text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                        User Type <span className="text-red-500">*</span>
                      </div>
                      {isEditingUser || isCreatingUser ? (
                        <select
                          value={userEditData.user_type || ""}
                          onChange={(e) =>
                            handleUserInputChange("user_type", e.target.value)
                          }
                          className="cursor-pointer w-full text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 focus:outline-none"
                        >
                          <option value="">Select User Type</option>
                          {isMasterAdmin() && (
                            <option value="master-admin">Master Admin</option>
                          )}
                          <option value="admin">Admin</option>
                          <option value="manager">Manager</option>
                          <option value="employee">Employee</option>
                        </select>
                      ) : (
                        <div className="text-slate-700">{user.user_type}</div>
                      )}
                    </div>
                  </div>

                  {/* Password - Full width */}
                  <div className="flex items-start gap-3">
                    <div className="w-full">
                      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                        Password <span className="text-red-500">*</span>
                      </div>
                      {isEditingUser || isCreatingUser ? (
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={userEditData.password || ""}
                            onChange={(e) =>
                              handleUserInputChange("password", e.target.value)
                            }
                            placeholder={
                              isCreatingUser
                                ? "Enter password"
                                : "Enter new password"
                            }
                            className="w-full text-sm text-slate-800 px-3 py-2 pr-10 border border-slate-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="cursor-pointer absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="text-slate-700">••••••••</div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-full">
                      <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                        Active Status
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="is_active"
                          checked={
                            isEditingUser || isCreatingUser
                              ? userEditData.is_active
                              : user
                                ? user.is_active
                                : false
                          }
                          onChange={(e) =>
                            handleUserInputChange("is_active", e.target.checked)
                          }
                          disabled={!(isEditingUser || isCreatingUser)}
                          className="cursor-pointer w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2"
                        />
                        <label
                          htmlFor="is_active"
                          className="ml-2 text-sm font-medium text-slate-600"
                        >
                          Active
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Module Access - Only visible to master-admin */}
                {isMasterAdmin() && (
                  <div className="flex items-start gap-3">
                    <div className="w-full">
                      <div className="text-xs uppercase tracking-wide text-slate-500 mb-3">
                        Module Access
                      </div>
                      <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                        {moduleStructure.map((module) => (
                          <div key={module.key}>
                            {module.isParent ? (
                              <>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center flex-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleModuleExpansion(module.key)
                                      }
                                      disabled={!(isEditingUser || isCreatingUser)}
                                      className="cursor-pointer p-1 hover:bg-slate-200 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      {expandedModules[module.key] ? (
                                        <ChevronDown className="w-4 h-4 text-slate-600" />
                                      ) : (
                                        <ChevronRight className="w-4 h-4 text-slate-600" />
                                      )}
                                    </button>
                                    <label
                                      htmlFor={module.key}
                                      className="ml-2 text-sm font-semibold text-slate-700 cursor-pointer flex-1"
                                    >
                                      {module.label}
                                    </label>
                                  </div>
                                  <input
                                    type="checkbox"
                                    id={module.key}
                                    checked={
                                      module.children?.every(
                                        (child) => moduleAccess[child.key] === true
                                      ) || false
                                    }
                                    ref={(el) => {
                                      if (el && module.children) {
                                        const checkedCount = module.children.filter(
                                          (child) =>
                                            moduleAccess[child.key] === true
                                        ).length;
                                        el.indeterminate =
                                          checkedCount > 0 &&
                                          checkedCount < module.children.length;
                                      }
                                    }}
                                    onChange={(e) => {
                                      // Toggle all children when parent is clicked
                                      module.children?.forEach((child) => {
                                        handleModuleAccessChange(
                                          child.key,
                                          e.target.checked
                                        );
                                      });
                                    }}
                                    disabled={!(isEditingUser || isCreatingUser)}
                                    className="cursor-pointer w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2"
                                  />
                                </div>
                                {expandedModules[module.key] && (
                                  <div className="ml-6 mt-2 space-y-2">
                                    {module.children?.map((child) => (
                                      <div
                                        key={child.key}
                                        className="flex items-center justify-between"
                                      >
                                        <label
                                          htmlFor={child.key}
                                          className="text-sm text-slate-600 cursor-pointer flex-1"
                                        >
                                          {child.label}
                                        </label>
                                        <input
                                          type="checkbox"
                                          id={child.key}
                                          checked={moduleAccess[child.key] === true}
                                          onChange={(e) =>
                                            handleModuleAccessChange(
                                              child.key,
                                              e.target.checked
                                            )
                                          }
                                          disabled={
                                            !(isEditingUser || isCreatingUser)
                                          }
                                          className="cursor-pointer w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="flex items-center justify-between">
                                <label
                                  htmlFor={module.key}
                                  className="text-sm font-semibold text-slate-700 cursor-pointer flex-1"
                                >
                                  {module.label}
                                </label>
                                <input
                                  type="checkbox"
                                  id={module.key}
                                  checked={moduleAccess[module.key] === true}
                                  onChange={(e) =>
                                    handleModuleAccessChange(
                                      module.key,
                                      e.target.checked
                                    )
                                  }
                                  disabled={!(isEditingUser || isCreatingUser)}
                                  className="cursor-pointer w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2"
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
                {!isCreatingUser && !isEditingUser && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="cursor-pointer px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove User Access
                  </button>
                )}
                {isCreatingUser ? (
                  <>
                    <button
                      onClick={handleCreateUserCancel}
                      className="cursor-pointer px-4 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md transition-all duration-200 text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateUserSave}
                      disabled={isUpdating}
                      className="cursor-pointer px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {isUpdating ? "Creating..." : "Create User"}
                    </button>
                  </>
                ) : !isEditingUser ? (
                  <>
                    <button
                      onClick={() => setIsEditingUser(true)}
                      className="cursor-pointer px-4 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md transition-all duration-200 text-sm font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setShowUserModal(false);
                        setShowPassword(false);
                      }}
                      className="cursor-pointer px-4 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md transition-all duration-200 text-sm font-medium"
                    >
                      Close
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={handleUserCancel}
                      disabled={isUpdating}
                      className="cursor-pointer px-4 py-2 border-2 border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUserSave}
                      disabled={isUpdating}
                      className="cursor-pointer px-4 py-2 bg-primary/80 hover:bg-primary text-white rounded-md transition-all duration-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUpdating ? "Saving..." : "Save"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Delete User Access Confirmation Modal */}
        <DeleteConfirmation
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDeleteConfirm}
          deleteWithInput={true}
          heading="User Access"
          message="This will remove the user account and revoke system access. Employee data will be preserved but they will no longer be able to login."
          comparingName={
            employee ? `${employee.first_name} ${employee.last_name}` : ""
          }
          isDeleting={isUpdating}
        />

        {/* Delete Employee Confirmation Modal */}
        <DeleteConfirmation
          isOpen={showDeleteEmployeeModal}
          onClose={() => setShowDeleteEmployeeModal(false)}
          onConfirm={handleDeleteEmployeeConfirm}
          deleteWithInput={true}
          heading="Employee"
          message="This will permanently delete the employee and all associated data. This action cannot be undone."
          comparingName={
            employee ? `${employee.first_name} ${employee.last_name}` : ""
          }
          isDeleting={isDeletingEmployee}
        />

        {/* View Media Modal */}
        {viewFileModal && selectedFile && (
          <ViewMedia
            selectedFile={selectedFile}
            setSelectedFile={setSelectedFile}
            setViewFileModal={setViewFileModal}
            setPageNumber={setPageNumber}
          />
        )}

        <ToastContainer />
      </div>
    </AdminRoute>
  );
}
