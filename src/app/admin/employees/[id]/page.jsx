"use client";
import TabsController from "@/components/tabscontroller";
import WorkingHours from "../components/WorkingHours";
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
  Plus,
  MoreVertical,
  Check,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  validateEmail,
  validatePhone,
  validateName,
  validateTFN,
  validateEmergencyName,
  formatPhoneToNational,
} from "@/components/validators";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import CustomDropdown from "@/components/CustomDropdown";
import ViewMedia from "@/app/admin/projects/components/ViewMedia";
import Image from "next/image";
import AdminShell from "@/components/AdminShell";
import { useRouter } from "next/navigation";
import { useUploadProgress } from "@/hooks/useUploadProgress";
import useModalFocus from "@/hooks/useModalFocus";
import {
  BADGE,
  BADGE_TONES,
  titleCase,
} from "@/app/admin/dashboard/lib/format";

const EMPTY = "—";

// Form-field rules (DESIGN.md 9.2): 14px, slate-300 border, primary focus ring.
// Error state swaps the border and ring to red and is paired with a message.
const FIELD =
  "w-full text-sm text-slate-800 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-colors duration-200";
// Time inputs sit side by side, so they size to their content.
const TIME_FIELD = FIELD.replace("w-full ", "");
// Modal forms use the roomier form-field padding (DESIGN.md 3.1).
const MODAL_FIELD = FIELD.replace("px-3 py-2", "px-4 py-3");
const fieldTone = (hasError) =>
  hasError
    ? "border-red-500 focus:ring-red-500"
    : "border-slate-300 focus:ring-primary";

// Validation runs on submit; focus then goes to the first invalid field in
// page order (DESIGN.md 15.3).
const FIELD_ORDER = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "phone_secondary",
  "tfn_number",
  "emergency_contact_name",
  "emergency_contact_phone",
];

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-red-600 mt-1">
      {message}
    </p>
  );
}

function Spinner({ tone = "light" }) {
  return (
    <span
      className={`w-4 h-4 border-2 rounded-full animate-spin ${
        tone === "light"
          ? "border-white/30 border-t-white"
          : "border-slate-200 border-t-primary"
      }`}
      aria-hidden="true"
    />
  );
}

export default function EmployeeDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const { getToken, isAdmin, isMasterAdmin } = useAuth();
  const {
    showProgressToast,
    completeUpload,
    dismissProgressToast,
    getUploadProgressHandler,
  } = useUploadProgress();
  const [employee, setEmployee] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  // Full values fetched via the master-admin reveal endpoint, cached by field
  // name so hiding and re-revealing never calls the API again.
  const [revealedValues, setRevealedValues] = useState({});
  // Which cached fields are currently shown unmasked
  const [visibleFields, setVisibleFields] = useState({});
  const [revealingFields, setRevealingFields] = useState({});
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
  const [activeTab, setActiveTab] = useState("overview");
  const [viewFileModal, setViewFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const fileInputRef = useRef(null);
  const [roleOptions, setRoleOptions] = useState([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [roleSearchTerm, setRoleSearchTerm] = useState("");
  const roleDropdownRef = useRef(null);
  const [showCreateRoleModal, setShowCreateRoleModal] = useState(false);
  const [newRoleValue, setNewRoleValue] = useState("");
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [roleError, setRoleError] = useState("");
  // Inline validation messages, keyed by field name (DESIGN.md 11, 15.3).
  const [fieldErrors, setFieldErrors] = useState({});
  const [userErrors, setUserErrors] = useState({});
  const userModalRef = useRef(null);
  const roleModalRef = useRef(null);

  useModalFocus(userModalRef, showUserModal);
  useModalFocus(roleModalRef, showCreateRoleModal);

  // Read-only labels are quiet metadata; form labels follow DESIGN.md 9.2.
  const labelClass = isEditing
    ? "block text-sm font-medium text-slate-700 mb-1.5"
    : "block text-xs font-medium text-slate-500 mb-1";

  // The user modal is read-only until Edit or Create is chosen.
  const userFormMode = isEditingUser || isCreatingUser;
  const userLabelClass = userFormMode
    ? "block text-sm font-medium text-slate-700 mb-1.5"
    : "block text-xs font-medium text-slate-500 mb-1";

  // The role modal opens pre-filled with what was typed in the role field, so
  // it only counts as dirty once the value differs from that.
  const roleModalDirty = newRoleValue.trim() !== roleSearchTerm.trim();

  // Module structure definition
  const moduleStructure = [
    {
      key: "dashboard",
      label: "Dashboard",
      isParent: false,
    },
    {
      key: "calendar",
      label: "Calendar",
      isParent: false,
    },
    {
      key: "clock_punches",
      label: "Clock punches",
      isParent: true,
      children: [
        { key: "all_clock_punches", label: "All clock punches" },
        { key: "clock_punch_details", label: "Clock punch details" },
        { key: "add_clock_punch", label: "Add clock punch" },
      ],
    },
    {
      key: "employees",
      label: "Employees",
      isParent: true,
      children: [
        { key: "all_employees", label: "All employees" },
        { key: "add_employees", label: "Add employee" },
        { key: "employee_details", label: "Employee details" },
      ],
    },
    {
      key: "clients",
      label: "Clients",
      isParent: true,
      children: [
        { key: "all_clients", label: "All clients" },
        { key: "add_clients", label: "Add client" },
        { key: "client_details", label: "Client details" },
      ],
    },
    {
      key: "projects",
      label: "Projects",
      isParent: true,
      children: [
        { key: "all_projects", label: "All projects" },
        { key: "add_projects", label: "Add project" },
        { key: "project_details", label: "Project details" },
        { key: "lotatglance", label: "Lot at a glance" },
        { key: "site_measurements", label: "Site measurements" },
      ],
    },
    {
      key: "suppliers",
      label: "Suppliers",
      isParent: true,
      children: [
        { key: "all_suppliers", label: "All suppliers" },
        { key: "add_suppliers", label: "Add supplier" },
        { key: "supplier_details", label: "Supplier details" },
        { key: "materialstoorder", label: "Materials to order" },
        { key: "purchaseorder", label: "Purchase orders" },
        { key: "statements", label: "Statements" },
      ],
    },
    {
      key: "inventory",
      label: "Inventory",
      isParent: true,
      children: [
        { key: "all_items", label: "All items" },
        { key: "add_items", label: "Add item" },
        { key: "item_details", label: "Item details" },
        { key: "usedmaterial", label: "Used material" },
      ],
    },
    {
      key: "delete_media",
      label: "Deleted media",
      isParent: false,
    },
    {
      key: "logs",
      label: "Logs",
      isParent: false,
    },
    {
      key: "site_photos",
      label: "Site photos",
      isParent: false,
    },
    {
      key: "config",
      label: "Config",
      isParent: false,
    },
  ];

  useEffect(() => {
    fetchEmployee();
  }, [id]);

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

  // Add this useEffect to clean up memory
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
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
  }, [showDropdown]);

  // Menus close on Escape; the user and role modals do too (DESIGN.md 9.4).
  // The delete confirmations are destructive and need an explicit button.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      if (showDeleteModal || showDeleteEmployeeModal || viewFileModal) return;
      if (showCreateRoleModal) {
        closeRoleModal();
      } else if (showUserModal) {
        closeUserModal();
      } else if (showDropdown) {
        setShowDropdown(false);
      } else if (isRoleDropdownOpen) {
        setIsRoleDropdownOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });

  const fetchEmployee = async () => {
    try {
      setLoading(true);
      setRevealedValues({});
      setVisibleFields({});
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
        return;
      }

      const response = await axios.get(`/api/v1/employee/${id}`, {
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
        setError(
          response.data.message ||
            "Couldn't load this employee. Check your connection and try again.",
        );
      }
    } catch (err) {
      console.error("API Error:", err);
      console.error("Error Response:", err.response?.data);
      setError(
        err.response?.data?.message ||
          "Couldn't load this employee. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Records show the full date including the year (a date of birth without
  // one is useless), so this stays local rather than using the compact shared
  // formatDate from dashboard/lib/format.
  const formatDate = (dateString) => {
    if (!dateString || dateString.trim() === "") {
      return EMPTY;
    }
    return new Date(dateString).toLocaleDateString("en-AU", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Availability times are "HH:mm" strings, not timestamps, so the shared
  // formatTime does not apply.
  const formatTime = (timeString) => {
    if (!timeString || timeString.trim() === "") {
      return EMPTY;
    }
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString("en-AU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const toggleReveal = async (field) => {
    if (visibleFields[field]) {
      setVisibleFields((prev) => ({ ...prev, [field]: false }));
      return;
    }
    // Already fetched on this page load: show the cached value, no API call
    if (revealedValues[field] !== undefined) {
      setVisibleFields((prev) => ({ ...prev, [field]: true }));
      return;
    }
    if (revealingFields[field]) return;
    setRevealingFields((prev) => ({ ...prev, [field]: true }));
    try {
      const response = await axios.get(
        `/api/v1/employee/${id}/reveal?field=${field}`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      if (response.data.status) {
        setRevealedValues((prev) => ({
          ...prev,
          [field]: response.data.data.value ?? EMPTY,
        }));
        setVisibleFields((prev) => ({ ...prev, [field]: true }));
      }
    } catch (error) {
      console.error("Error revealing field:", error);
      toast.error(
        error.response?.data?.message ||
          "Couldn't reveal this value. Try again.",
      );
    } finally {
      setRevealingFields((prev) => ({ ...prev, [field]: false }));
    }
  };

  const renderMaskedNumber = (field) => (
    <div className="flex items-center gap-2">
      <p className="text-sm text-slate-700 font-mono">
        {visibleFields[field]
          ? revealedValues[field]
          : formatValue(employee[field])}
      </p>
      {isMasterAdmin() && employee[field] && (
        <button
          type="button"
          onClick={() => toggleReveal(field)}
          title={visibleFields[field] ? "Hide" : "Reveal"}
          aria-label={visibleFields[field] ? "Hide value" : "Reveal value"}
          className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200"
        >
          {visibleFields[field] ? (
            <EyeOff className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Eye className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );

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

  // Resolves true when the save went through, so the form stays open with the
  // user's values when it did not (DESIGN.md 15.3).
  const updateEmployee = async (updatedData) => {
    try {
      setIsUpdating(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
        return false;
      }

      // Format phone numbers to national format before sending
      const formattedData = { ...updatedData };
      if (formattedData.phone) {
        formattedData.phone = formatPhoneToNational(formattedData.phone);
      }
      if (formattedData.phone_secondary) {
        formattedData.phone_secondary = formatPhoneToNational(
          formattedData.phone_secondary,
        );
      }
      if (formattedData.emergency_contact_phone) {
        formattedData.emergency_contact_phone = formatPhoneToNational(
          formattedData.emergency_contact_phone,
        );
      }

      // If there's an image file, use FormData; otherwise use JSON
      const formDataToSend = new FormData();

      // Append all form data
      Object.keys(formattedData).forEach((key) => {
        if (key === "availability") {
          // Convert availability to JSON string
          formDataToSend.append(key, JSON.stringify(formattedData[key]));
        } else if (key === "is_active") {
          // Convert boolean to string for FormData
          formDataToSend.append(key, formattedData[key] ? "true" : "false");
        } else {
          formDataToSend.append(key, formattedData[key] || "");
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
      let dataToSend = isFormData ? formDataToSend : formattedData;

      // If sending JSON, ensure availability is stringified
      if (!isFormData && formattedData.availability) {
        dataToSend = {
          ...formattedData,
          availability: JSON.stringify(formattedData.availability),
        };
      }

      const contentType = isFormData
        ? "multipart/form-data"
        : "application/json";

      // Show progress toast only if there's an image file
      if (imageFile) {
        showProgressToast(1);
      }

      const response = await axios.patch(`/api/v1/employee/${id}`, dataToSend, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": contentType,
        },
        ...(imageFile && {
          onUploadProgress: getUploadProgressHandler(1),
        }),
      });

      if (response.data.status) {
        if (imageFile) {
          completeUpload(1);
        } else {
          toast.success("Employee updated.");
        }
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
        return true;
      }
      if (imageFile) {
        dismissProgressToast();
      }
      toast.error(
        response.data.message ||
          "Couldn't save the employee. Check the details and try again.",
      );
      return false;
    } catch (error) {
      console.error("Error updating employee:", error);
      if (imageFile) {
        dismissProgressToast();
      }
      toast.error(
        error.response?.data?.message ||
          "Couldn't save the employee. Check your connection and try again.",
      );
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEdit = () => {
    // The editable fields all live in Overview, so bring that tab forward.
    setActiveTab("overview");

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
      WEEKDAYS.forEach((day) => {
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
        phone_secondary: employee.phone_secondary || "",
        dob: employee.dob
          ? new Date(employee.dob).toISOString().split("T")[0]
          : "",
        join_date: employee.join_date
          ? new Date(employee.join_date).toISOString().split("T")[0]
          : "",
        address: employee.address || "",
        emergency_contact_name: employee.emergency_contact_name || "",
        emergency_contact_phone: employee.emergency_contact_phone || "",
        bank_account_name: employee.bank_account_name || "",
        // Masked by the API; leave blank to keep the stored value
        bank_account_number: "",
        bank_account_bsb: employee.bank_account_bsb || "",
        supper_account_name: employee.supper_account_name || "",
        supper_account_number: "",
        tfn_number: "",
        abn_number: employee.abn_number || "",
        education: employee.education || "",
        availability: formattedAvailability,
        notes: employee.notes || "",
        is_active: employee.is_active !== undefined ? employee.is_active : true,
      });
      // Reset image state
      setImagePreview(employee.image ? `/${employee.image.url}` : null);
      setImageFile(null);
      setRemoveImage(false);
      // Initialize role search term
      setRoleSearchTerm(employee.role || "");
      setFieldErrors({});
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (isUpdating) return;
    const validationErrors = validateForm();
    setFieldErrors(validationErrors);

    const firstInvalid = FIELD_ORDER.find((field) => validationErrors[field]);
    if (firstInvalid) {
      // Focus the first invalid field once the error state has rendered.
      setTimeout(() => {
        document.getElementById(`emp-${firstInvalid}`)?.focus();
      }, 0);
      return;
    }

    const saved = await updateEmployee(editData);
    if (saved) setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
    setFieldErrors({});
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
    // Validate on submit, then clear each message as the field is edited.
    if (
      fieldErrors[field] ||
      (field === "phone" && fieldErrors.phone_secondary)
    ) {
      setFieldErrors((prev) => {
        const next = { ...prev, [field]: null };
        if (field === "phone") next.phone_secondary = null;
        return next;
      });
    }
  };

  // Role dropdown handlers
  const handleRoleSelect = (role) => {
    handleInputChange("role", role);
    setRoleSearchTerm(role);
    setIsRoleDropdownOpen(false);
  };

  const handleRoleSearchChange = (e) => {
    const value = e.target.value;
    setRoleSearchTerm(value);
    setIsRoleDropdownOpen(true);
    handleInputChange("role", value);
  };

  // Handle create new role
  const closeRoleModal = () => {
    setShowCreateRoleModal(false);
    setNewRoleValue("");
    setRoleError("");
  };

  const handleCreateNewRole = async () => {
    if (isCreatingRole) return;
    if (!newRoleValue || !newRoleValue.trim()) {
      setRoleError("Enter a role name.");
      document.getElementById("new-role-name")?.focus();
      return;
    }

    try {
      setIsCreatingRole(true);
      const sessionToken = getToken();
      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
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
        handleInputChange("role", newRoleValue.trim());
        setRoleSearchTerm(newRoleValue.trim());
        closeRoleModal();
        setIsRoleDropdownOpen(false);
      } else {
        toast.error(
          response.data.message ||
            "Couldn't create the role. Check the name and try again.",
        );
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

  // Filter role options based on search term
  const filteredRoleOptions = roleOptions.filter((role) =>
    role.toLowerCase().includes(roleSearchTerm.toLowerCase()),
  );

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
      setUserErrors({});
      setShowUserModal(true);
    }
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setShowPassword(false);
    setIsEditingUser(false);
    setIsCreatingUser(false);
    setUserErrors({});
  };

  const handleUserSave = async () => {
    if (isUpdating) return;
    try {
      setIsUpdating(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
        return;
      }
      const updateData = {
        id: user.id,
        user_type: userEditData.user_type,
        is_active: userEditData.is_active,
        module_access: moduleAccess,
        password: userEditData.password,
      };

      const response = await axios.patch(
        `/api/v1/user/${user.id}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status) {
        toast.success("User updated.");
        setUser(response.data.data);
        setIsEditingUser(false);
        setShowUserModal(false);
      } else {
        toast.error(
          response.data.message ||
            "Couldn't update the user. Check the details and try again.",
        );
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error(
        "Couldn't update the user. Check your connection and try again.",
      );
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
    if (userErrors[field]) {
      setUserErrors((prev) => ({ ...prev, [field]: null }));
    }
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
      setUserErrors({});
      setIsCreatingUser(true);
      setShowUserModal(true);
    }
  };

  const handleCreateUserSave = async () => {
    if (isUpdating) return;

    // Validate required fields inline, then focus the first invalid one.
    const errors = {};
    if (!userEditData.username) errors.username = "Enter a username (email).";
    if (!userEditData.user_type) errors.user_type = "Select a user type.";
    if (!userEditData.password) errors.password = "Enter a password.";
    setUserErrors(errors);
    const firstInvalid = ["username", "user_type", "password"].find(
      (field) => errors[field],
    );
    if (firstInvalid) {
      setTimeout(() => {
        document
          .querySelector(
            `input#user-${firstInvalid}, #user-${firstInvalid}-field input`,
          )
          ?.focus();
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

      const createData = {
        username: userEditData.username,
        password: userEditData.password,
        user_type: userEditData.user_type,
        is_active: userEditData.is_active,
        employee_id: userEditData.employee_id,
        module_access: moduleAccess,
      };

      const response = await axios.post(`/api/v1/signup`, createData, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.data.status) {
        toast.success("User created.");
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
        toast.error(
          response.data.message ||
            "Couldn't create the user. Check the details and try again.",
        );
      }
    } catch (error) {
      console.error("Error creating user:", error);
      toast.error(
        "Couldn't create the user. Check your connection and try again.",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateUserCancel = () => {
    setIsCreatingUser(false);
    setUserEditData({});
    setModuleAccess({});
    setShowPassword(false);
    setUserErrors({});
    setShowUserModal(false);
  };

  const handleDeleteConfirm = async () => {
    try {
      setIsUpdating(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
        return;
      }

      const response = await axios.delete(`/api/v1/user/${id}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        toast.success("User access removed. The employee record is kept.");
        // Refresh employee data to update user status
        await fetchEmployee();
        setShowUserModal(false);
        setShowDeleteModal(false);
      } else {
        toast.error(
          response.data.message || "Couldn't remove user access. Try again.",
        );
      }
    } catch (error) {
      console.error("Error removing user account:", error);
      toast.error(
        "Couldn't remove user access. Check your connection and try again.",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteEmployeeConfirm = async () => {
    try {
      setIsDeletingEmployee(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
        return;
      }

      const response = await axios.delete(
        `/api/v1/employee/${employee.employee_id}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );

      if (response.data.status) {
        toast.success("Employee deleted.");
        setShowDeleteEmployeeModal(false);
        // Navigate back to employees list
        router.push("/admin/employees");
      } else {
        toast.error(
          response.data.message || "Couldn't delete the employee. Try again.",
        );
      }
    } catch (error) {
      console.error("Error deleting employee:", error);
      toast.error(
        "Couldn't delete the employee. Check your connection and try again.",
      );
    } finally {
      setIsDeletingEmployee(false);
    }
  };

  // Returns { field: message } so each message can sit under its own field.
  const validateForm = () => {
    const errors = {};

    if (editData.email && !validateEmail(editData.email)) {
      errors.email = "Enter a valid email address.";
    }

    if (editData.phone && !validatePhone(editData.phone)) {
      errors.phone = "Enter a valid Australian phone number.";
    }

    if (editData.phone_secondary && !validatePhone(editData.phone_secondary)) {
      errors.phone_secondary = "Enter a valid Australian phone number.";
    }

    // Primary and secondary phone must differ (compared in stored format).
    if (
      editData.phone &&
      editData.phone_secondary &&
      !errors.phone &&
      !errors.phone_secondary &&
      formatPhoneToNational(editData.phone) ===
        formatPhoneToNational(editData.phone_secondary)
    ) {
      errors.phone_secondary =
        "Secondary phone can't be the same as the primary phone.";
    }

    if (editData.first_name && !validateName(editData.first_name)) {
      errors.first_name = "Use letters and spaces only.";
    }

    if (editData.last_name && !validateName(editData.last_name)) {
      errors.last_name = "Use letters and spaces only.";
    }

    if (editData.tfn_number && !validateTFN(editData.tfn_number)) {
      errors.tfn_number = "Use numbers only, at least 8 digits.";
    }

    if (
      editData.emergency_contact_name &&
      !validateEmergencyName(editData.emergency_contact_name)
    ) {
      errors.emergency_contact_name = "Use letters and spaces only.";
    }

    if (
      editData.emergency_contact_phone &&
      !validatePhone(editData.emergency_contact_phone)
    ) {
      errors.emergency_contact_phone = "Enter a valid Australian phone number.";
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
                Loading employee details...
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
                className="cursor-pointer px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200"
              >
                Try again
              </button>
            </div>
          </div>
        ) : !employee ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <User
                className="w-8 h-8 text-slate-300 mx-auto mb-4"
                aria-hidden="true"
              />
              <p className="text-sm text-slate-600">
                This employee could not be found. They may have been deleted.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-3">
            {/* Header: back, record name, status badge, record actions */}
            <div className="flex items-center gap-3 mb-4">
              <TabsController back={true}>
                <span className="cursor-pointer flex p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200">
                  <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                  <span className="sr-only">Back</span>
                </span>
              </TabsController>
              <div className="flex-1 flex flex-wrap items-center gap-3 min-w-0">
                <h1 className="text-xl font-semibold text-slate-800 truncate">
                  {employee.first_name} {employee.last_name}
                </h1>
                <span
                  className={`${BADGE} ${
                    employee.is_active !== false
                      ? BADGE_TONES.success
                      : BADGE_TONES.neutral
                  }`}
                >
                  {employee.is_active !== false
                    ? "Current employee"
                    : "Former employee"}
                </span>
              </div>
              <div className="flex gap-2">
                {!isEditing ? (
                  <div className="relative dropdown-container">
                    <button
                      type="button"
                      onClick={() => setShowDropdown(!showDropdown)}
                      aria-haspopup="menu"
                      aria-expanded={showDropdown}
                      className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200"
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
                            className="cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2"
                          >
                            <Edit className="w-4 h-4" aria-hidden="true" />
                            Edit employee details
                          </button>
                          {isAdmin() && (
                            <>
                              {user && Object.keys(user).length > 0 ? (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    handleViewUser();
                                    setShowDropdown(false);
                                  }}
                                  className="cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2"
                                >
                                  <Eye className="w-4 h-4" aria-hidden="true" />
                                  View user details
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    handleCreateUser();
                                    setShowDropdown(false);
                                  }}
                                  className="cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-2"
                                >
                                  <User
                                    className="w-4 h-4"
                                    aria-hidden="true"
                                  />
                                  Create user
                                </button>
                              )}
                            </>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setShowDeleteEmployeeModal(true);
                              setShowDropdown(false);
                            }}
                            className="cursor-pointer w-full text-left px-4 py-2.5 text-sm text-red-700 hover:bg-red-50 transition-colors flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                            Delete employee
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
                      className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isUpdating}
                      className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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

            {/* Main Tab Navigation */}
            <div className="bg-white rounded-lg border border-slate-200 mb-4">
              <nav
                className="flex space-x-8 px-4"
                role="tablist"
                aria-label="Employee sections"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "overview"}
                  onClick={() => setActiveTab("overview")}
                  className={`cursor-pointer py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === "overview"
                      ? "border-primary text-primary"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" aria-hidden="true" />
                    Overview
                  </div>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "working-hours"}
                  onClick={() => setActiveTab("working-hours")}
                  className={`cursor-pointer py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === "working-hours"
                      ? "border-primary text-primary"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" aria-hidden="true" />
                    Working hours
                  </div>
                </button>
              </nav>
            </div>

            {activeTab === "overview" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left Column - Main Info */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Profile Card */}
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
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
                              tabIndex={-1}
                            />

                            {imagePreview ? (
                              <div className="relative mb-2">
                                <div className="w-16 h-16 rounded-full overflow-hidden border border-primary">
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
                                  className="cursor-pointer absolute top-0 right-0 bg-red-600 hover:bg-red-700 text-white rounded-full p-1.5 transition-colors duration-200"
                                  aria-label="Remove photo"
                                >
                                  <X className="w-3 h-3" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => fileInputRef.current?.click()}
                                  className="cursor-pointer absolute -bottom-2 inset-x-0 mx-auto w-fit bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors duration-200"
                                >
                                  Change
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                aria-label="Upload photo"
                                className="cursor-pointer w-16 h-16 rounded-full border border-dashed border-slate-300 hover:border-primary bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center transition-colors duration-200"
                              >
                                <Upload
                                  className="w-4 h-4 text-slate-500 mb-1"
                                  aria-hidden="true"
                                />
                                <span className="text-xs text-slate-500 font-medium">
                                  Upload
                                </span>
                              </button>
                            )}
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <p className="text-xs text-slate-500 text-center">
                              {imagePreview
                                ? "Change or remove the photo"
                                : "Upload a photo"}
                            </p>
                            {employee?.image && !imagePreview && (
                              <button
                                type="button"
                                onClick={handleRemoveImage}
                                className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline cursor-pointer transition-colors duration-200"
                              >
                                Remove current photo
                              </button>
                            )}
                          </div>
                        </div>
                      ) : employee.image ? (
                        <button
                          type="button"
                          onClick={handleViewEmployeeImage}
                          aria-label={`View photo of ${employee.first_name} ${employee.last_name}`}
                          className="cursor-pointer group relative shrink-0 rounded-full"
                        >
                          <Image
                            loading="lazy"
                            src={`/${employee.image.url}`}
                            alt=""
                            className="w-16 h-16 rounded-full object-cover"
                            width={64}
                            height={64}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-full transition-colors duration-200 flex items-center justify-center">
                            <Eye
                              className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                              aria-hidden="true"
                            />
                          </div>
                        </button>
                      ) : (
                        <div
                          className="w-16 h-16 shrink-0 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center text-slate-700 text-lg font-semibold"
                          aria-hidden="true"
                        >
                          {employee?.first_name?.[0] || ""}
                          {employee?.last_name?.[0] || ""}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div>
                                <label
                                  htmlFor="emp-first_name"
                                  className={labelClass}
                                >
                                  First name
                                </label>
                                <input
                                  id="emp-first_name"
                                  type="text"
                                  value={editData.first_name || ""}
                                  onChange={(e) =>
                                    handleInputChange(
                                      "first_name",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="e.g. Sam"
                                  aria-invalid={!!fieldErrors.first_name}
                                  aria-describedby={
                                    fieldErrors.first_name
                                      ? "emp-first_name-error"
                                      : undefined
                                  }
                                  className={`${FIELD} ${fieldTone(
                                    fieldErrors.first_name,
                                  )}`}
                                />
                                <FieldError
                                  id="emp-first_name-error"
                                  message={fieldErrors.first_name}
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="emp-last_name"
                                  className={labelClass}
                                >
                                  Last name
                                </label>
                                <input
                                  id="emp-last_name"
                                  type="text"
                                  value={editData.last_name || ""}
                                  onChange={(e) =>
                                    handleInputChange(
                                      "last_name",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="e.g. Taylor"
                                  aria-invalid={!!fieldErrors.last_name}
                                  aria-describedby={
                                    fieldErrors.last_name
                                      ? "emp-last_name-error"
                                      : undefined
                                  }
                                  className={`${FIELD} ${fieldTone(
                                    fieldErrors.last_name,
                                  )}`}
                                />
                                <FieldError
                                  id="emp-last_name-error"
                                  message={fieldErrors.last_name}
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="emp-role"
                                  className={labelClass}
                                >
                                  Role
                                </label>
                                <div className="relative" ref={roleDropdownRef}>
                                  <div className="relative">
                                    <input
                                      id="emp-role"
                                      type="text"
                                      value={
                                        roleSearchTerm || editData.role || ""
                                      }
                                      onChange={handleRoleSearchChange}
                                      onFocus={() =>
                                        setIsRoleDropdownOpen(true)
                                      }
                                      className="w-full px-3 py-2 pr-10 text-sm text-slate-800 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors duration-200"
                                      placeholder="Search or type a role"
                                      role="combobox"
                                      aria-expanded={isRoleDropdownOpen}
                                      aria-autocomplete="list"
                                      aria-controls="emp-role-list"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setIsRoleDropdownOpen(
                                          !isRoleDropdownOpen,
                                        )
                                      }
                                      className="cursor-pointer absolute inset-y-0 right-1 flex items-center p-1.5 text-slate-500 hover:text-slate-700 transition-colors duration-200"
                                      aria-label="Toggle role list"
                                    >
                                      <ChevronDown
                                        className={`w-4 h-4 transition-transform duration-200 ${
                                          isRoleDropdownOpen ? "rotate-180" : ""
                                        }`}
                                        aria-hidden="true"
                                      />
                                    </button>
                                  </div>

                                  {isRoleDropdownOpen && (
                                    <div
                                      id="emp-role-list"
                                      className="absolute z-40 w-full mt-1 bg-white border border-slate-300 rounded-lg max-h-60 overflow-auto"
                                    >
                                      {loadingRoles ? (
                                        <div className="px-4 py-3 text-sm text-slate-500 text-center">
                                          Loading roles...
                                        </div>
                                      ) : filteredRoleOptions.length > 0 ? (
                                        <>
                                          {filteredRoleOptions.map(
                                            (role, index) => (
                                              <button
                                                key={index}
                                                type="button"
                                                onClick={() =>
                                                  handleRoleSelect(role)
                                                }
                                                className="cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors first:rounded-t-lg"
                                              >
                                                {role}
                                              </button>
                                            ),
                                          )}
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
                                                    setNewRoleValue(
                                                      roleSearchTerm,
                                                    );
                                                    setRoleError("");
                                                    setShowCreateRoleModal(
                                                      true,
                                                    );
                                                  }}
                                                  className="cursor-pointer w-full text-left px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors flex items-center gap-2"
                                                >
                                                  <Plus
                                                    className="w-4 h-4"
                                                    aria-hidden="true"
                                                  />
                                                  Create &quot;{roleSearchTerm}
                                                  &quot;
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
                                                setRoleError("");
                                                setShowCreateRoleModal(true);
                                              }}
                                              className="cursor-pointer w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                                            >
                                              <Plus
                                                className="w-4 h-4"
                                                aria-hidden="true"
                                              />
                                              Create &quot;{roleSearchTerm}
                                              &quot;
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <p className="text-xs text-slate-500">
                              Employee ID:{" "}
                              <span className="font-mono">
                                {employee.employee_id}
                              </span>
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div>
                                <label
                                  htmlFor="emp-email"
                                  className={labelClass}
                                >
                                  Email
                                </label>
                                <input
                                  id="emp-email"
                                  type="email"
                                  value={editData.email || ""}
                                  onChange={(e) =>
                                    handleInputChange("email", e.target.value)
                                  }
                                  placeholder="name@example.com"
                                  aria-invalid={!!fieldErrors.email}
                                  aria-describedby={
                                    fieldErrors.email
                                      ? "emp-email-error"
                                      : undefined
                                  }
                                  className={`${FIELD} ${fieldTone(
                                    fieldErrors.email,
                                  )}`}
                                />
                                <FieldError
                                  id="emp-email-error"
                                  message={fieldErrors.email}
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="emp-address"
                                  className={labelClass}
                                >
                                  Address
                                </label>
                                <input
                                  id="emp-address"
                                  type="text"
                                  value={editData.address || ""}
                                  onChange={(e) =>
                                    handleInputChange("address", e.target.value)
                                  }
                                  placeholder="e.g. 12 Example St, Adelaide SA"
                                  className={`${FIELD} ${fieldTone(false)}`}
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="emp-phone"
                                  className={labelClass}
                                >
                                  Phone
                                </label>
                                <input
                                  id="emp-phone"
                                  type="tel"
                                  value={editData.phone || ""}
                                  onChange={(e) =>
                                    handleInputChange("phone", e.target.value)
                                  }
                                  placeholder="e.g. 0400 123 456"
                                  aria-invalid={!!fieldErrors.phone}
                                  aria-describedby={
                                    fieldErrors.phone
                                      ? "emp-phone-error"
                                      : undefined
                                  }
                                  className={`${FIELD} ${fieldTone(
                                    fieldErrors.phone,
                                  )}`}
                                />
                                <FieldError
                                  id="emp-phone-error"
                                  message={fieldErrors.phone}
                                />
                              </div>
                              <div>
                                <label
                                  htmlFor="emp-phone_secondary"
                                  className={labelClass}
                                >
                                  Secondary phone
                                </label>
                                <input
                                  id="emp-phone_secondary"
                                  type="tel"
                                  value={editData.phone_secondary || ""}
                                  onChange={(e) =>
                                    handleInputChange(
                                      "phone_secondary",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="e.g. +61 400 123 456"
                                  aria-invalid={!!fieldErrors.phone_secondary}
                                  aria-describedby={
                                    fieldErrors.phone_secondary
                                      ? "emp-phone_secondary-error"
                                      : undefined
                                  }
                                  className={`${FIELD} ${fieldTone(
                                    fieldErrors.phone_secondary,
                                  )}`}
                                />
                                <FieldError
                                  id="emp-phone_secondary-error"
                                  message={fieldErrors.phone_secondary}
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h2 className="text-lg font-semibold text-slate-800">
                                {employee.first_name} {employee.last_name}
                              </h2>
                              {user && Object.keys(user).length > 0 && (
                                <span
                                  className={`${BADGE} ${BADGE_TONES.indigo}`}
                                >
                                  {titleCase(user.user_type)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mb-3">
                              ID:{" "}
                              <span className="font-mono">
                                {employee.employee_id}
                              </span>
                            </p>
                            <div className="space-y-1">
                              <div className="flex flex-wrap gap-3 text-sm">
                                {employee.email ? (
                                  <a
                                    href={`mailto:${employee.email}`}
                                    className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors duration-200"
                                  >
                                    <Mail
                                      className="w-4 h-4"
                                      aria-hidden="true"
                                    />
                                    {employee.email}
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
                                  {formatValue(employee.phone)}
                                </div>
                                {employee.phone_secondary && (
                                  <div className="flex items-center gap-2 text-slate-600">
                                    <Phone
                                      className="w-4 h-4"
                                      aria-hidden="true"
                                    />
                                    {formatValue(employee.phone_secondary)}
                                    <span className="text-xs text-slate-500">
                                      (Secondary)
                                    </span>
                                  </div>
                                )}
                                <div className="flex items-center gap-2 text-slate-600 text-sm">
                                  <MapPin
                                    className="w-4 h-4"
                                    aria-hidden="true"
                                  />
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
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <User className="w-5 h-5" aria-hidden="true" />
                      Personal information
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="dob" className={labelClass}>
                          Date of birth
                        </label>
                        {isEditing ? (
                          <input
                            id="dob"
                            type="date"
                            value={editData.dob || ""}
                            onChange={(e) =>
                              handleInputChange("dob", e.target.value)
                            }
                            className={`${FIELD} ${fieldTone(false)}`}
                          />
                        ) : (
                          <p className="text-sm text-slate-700">
                            {formatDate(employee.dob)}
                          </p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="join_date" className={labelClass}>
                          Join date
                        </label>
                        {isEditing ? (
                          <input
                            id="join_date"
                            type="date"
                            value={editData.join_date || ""}
                            onChange={(e) =>
                              handleInputChange("join_date", e.target.value)
                            }
                            max={new Date().toISOString().split("T")[0]}
                            className={`${FIELD} ${fieldTone(false)}`}
                          />
                        ) : (
                          <p className="text-sm text-slate-700">
                            {formatDate(employee.join_date)}
                          </p>
                        )}
                      </div>
                      <div>
                        <label htmlFor="emp-tfn_number" className={labelClass}>
                          TFN
                        </label>
                        {isEditing ? (
                          <>
                            <input
                              id="emp-tfn_number"
                              type="text"
                              inputMode="numeric"
                              value={editData.tfn_number || ""}
                              onChange={(e) =>
                                handleInputChange("tfn_number", e.target.value)
                              }
                              placeholder={formatValue(employee.tfn_number)}
                              aria-invalid={!!fieldErrors.tfn_number}
                              aria-describedby={
                                fieldErrors.tfn_number
                                  ? "emp-tfn_number-error"
                                  : "emp-tfn_number-hint"
                              }
                              className={`${FIELD} font-mono ${fieldTone(
                                fieldErrors.tfn_number,
                              )}`}
                            />
                            {fieldErrors.tfn_number ? (
                              <FieldError
                                id="emp-tfn_number-error"
                                message={fieldErrors.tfn_number}
                              />
                            ) : (
                              <p
                                id="emp-tfn_number-hint"
                                className="text-xs text-slate-500 mt-1"
                              >
                                Leave blank to keep the current number.
                              </p>
                            )}
                          </>
                        ) : (
                          renderMaskedNumber("tfn_number")
                        )}
                      </div>
                      <div>
                        <label htmlFor="abn_number" className={labelClass}>
                          ABN
                        </label>
                        {isEditing ? (
                          <input
                            id="abn_number"
                            type="text"
                            value={editData.abn_number || ""}
                            onChange={(e) =>
                              handleInputChange("abn_number", e.target.value)
                            }
                            className={`${FIELD} font-mono ${fieldTone(false)}`}
                          />
                        ) : (
                          <p className="text-sm text-slate-700 font-mono">
                            {formatValue(employee.abn_number)}
                          </p>
                        )}
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="education" className={labelClass}>
                          Education
                        </label>
                        {isEditing ? (
                          <textarea
                            id="education"
                            value={editData.education || ""}
                            onChange={(e) =>
                              handleInputChange("education", e.target.value)
                            }
                            rows={3}
                            className={`${FIELD} ${fieldTone(false)}`}
                          />
                        ) : (
                          <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 p-3 rounded-lg">
                            {formatValue(employee.education)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Emergency Contact */}
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                      Emergency contact
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="emp-emergency_contact_name"
                          className={labelClass}
                        >
                          Contact name
                        </label>
                        {isEditing ? (
                          <>
                            <input
                              id="emp-emergency_contact_name"
                              type="text"
                              value={editData.emergency_contact_name || ""}
                              onChange={(e) =>
                                handleInputChange(
                                  "emergency_contact_name",
                                  e.target.value,
                                )
                              }
                              aria-invalid={
                                !!fieldErrors.emergency_contact_name
                              }
                              aria-describedby={
                                fieldErrors.emergency_contact_name
                                  ? "emp-emergency_contact_name-error"
                                  : undefined
                              }
                              className={`${FIELD} ${fieldTone(
                                fieldErrors.emergency_contact_name,
                              )}`}
                            />
                            <FieldError
                              id="emp-emergency_contact_name-error"
                              message={fieldErrors.emergency_contact_name}
                            />
                          </>
                        ) : (
                          <p className="text-sm text-slate-700">
                            {formatValue(employee.emergency_contact_name)}
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="emp-emergency_contact_phone"
                          className={labelClass}
                        >
                          Contact phone
                        </label>
                        {isEditing ? (
                          <>
                            <input
                              id="emp-emergency_contact_phone"
                              type="tel"
                              value={editData.emergency_contact_phone || ""}
                              onChange={(e) =>
                                handleInputChange(
                                  "emergency_contact_phone",
                                  e.target.value,
                                )
                              }
                              placeholder="e.g. 0400 123 456"
                              aria-invalid={
                                !!fieldErrors.emergency_contact_phone
                              }
                              aria-describedby={
                                fieldErrors.emergency_contact_phone
                                  ? "emp-emergency_contact_phone-error"
                                  : undefined
                              }
                              className={`${FIELD} ${fieldTone(
                                fieldErrors.emergency_contact_phone,
                              )}`}
                            />
                            <FieldError
                              id="emp-emergency_contact_phone-error"
                              message={fieldErrors.emergency_contact_phone}
                            />
                          </>
                        ) : (
                          <p className="text-sm text-slate-700">
                            {formatValue(employee.emergency_contact_phone)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Availability Schedule */}
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <Clock className="w-5 h-5" aria-hidden="true" />
                      Work schedule
                    </h2>
                    <div className="space-y-2">
                      {isEditing
                        ? // Show editable time inputs for all days when editing
                          WEEKDAYS.map((day) => (
                            <div
                              key={day}
                              className="flex items-center justify-between py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg"
                            >
                              <span className="text-sm font-medium text-slate-700 capitalize">
                                {day}
                              </span>
                              <div className="flex items-center gap-2">
                                <input
                                  type="time"
                                  aria-label={`${titleCase(day)} start time`}
                                  value={
                                    editData.availability?.[day]?.start || ""
                                  }
                                  onChange={(e) =>
                                    handleAvailabilityChange(
                                      day,
                                      "start",
                                      e.target.value,
                                    )
                                  }
                                  className={`${TIME_FIELD} ${fieldTone(false)}`}
                                />
                                <span
                                  className="text-xs text-slate-500"
                                  aria-hidden="true"
                                >
                                  to
                                </span>
                                <input
                                  type="time"
                                  aria-label={`${titleCase(day)} end time`}
                                  value={
                                    editData.availability?.[day]?.end || ""
                                  }
                                  onChange={(e) =>
                                    handleAvailabilityChange(
                                      day,
                                      "end",
                                      e.target.value,
                                    )
                                  }
                                  className={`${TIME_FIELD} ${fieldTone(false)}`}
                                />
                              </div>
                            </div>
                          ))
                        : // Show existing availability or empty state when not editing
                          (() => {
                            let availability = employee.availability || {};
                            if (typeof availability === "string") {
                              try {
                                availability = JSON.parse(availability);
                              } catch (e) {
                                console.error("Error parsing availability:", e);
                                availability = {};
                              }
                            }
                            const entries = Object.entries(availability);
                            if (entries.length === 0) {
                              return (
                                <div className="text-center py-6">
                                  <Clock
                                    className="w-8 h-8 mx-auto mb-2 text-slate-300"
                                    aria-hidden="true"
                                  />
                                  <p className="text-sm text-slate-600">
                                    No work schedule set
                                  </p>
                                </div>
                              );
                            }
                            return entries.map(([day, schedule]) => {
                              const start = formatTime(schedule?.start);
                              const end = formatTime(schedule?.end);
                              return (
                                <div
                                  key={day}
                                  className="flex items-center justify-between py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-lg"
                                >
                                  <span className="text-sm font-medium text-slate-700 capitalize">
                                    {day}
                                  </span>
                                  <span className="text-sm text-slate-600">
                                    {start === EMPTY && end === EMPTY
                                      ? EMPTY
                                      : `${start} – ${end}`}
                                  </span>
                                </div>
                              );
                            });
                          })()}
                    </div>
                  </div>
                </div>

                {/* Right Column - Financial Info */}
                <div className="space-y-4">
                  {/* Banking Information */}
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <CreditCard className="w-5 h-5" aria-hidden="true" />
                      Banking details
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="bank_account_name"
                          className={labelClass}
                        >
                          Account holder name
                        </label>
                        {isEditing ? (
                          <input
                            id="bank_account_name"
                            type="text"
                            value={editData.bank_account_name || ""}
                            onChange={(e) =>
                              handleInputChange(
                                "bank_account_name",
                                e.target.value,
                              )
                            }
                            className={`${FIELD} ${fieldTone(false)}`}
                          />
                        ) : (
                          <p className="text-sm text-slate-700">
                            {formatValue(employee.bank_account_name)}
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="bank_account_number"
                          className={labelClass}
                        >
                          Account number
                        </label>
                        {isEditing ? (
                          <>
                            <input
                              id="bank_account_number"
                              type="text"
                              inputMode="numeric"
                              value={editData.bank_account_number || ""}
                              onChange={(e) =>
                                handleInputChange(
                                  "bank_account_number",
                                  e.target.value,
                                )
                              }
                              placeholder={formatValue(
                                employee.bank_account_number,
                              )}
                              aria-describedby="bank_account_number-hint"
                              className={`${FIELD} font-mono ${fieldTone(false)}`}
                            />
                            <p
                              id="bank_account_number-hint"
                              className="text-xs text-slate-500 mt-1"
                            >
                              Leave blank to keep the current number.
                            </p>
                          </>
                        ) : (
                          renderMaskedNumber("bank_account_number")
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="bank_account_bsb"
                          className={labelClass}
                        >
                          BSB
                        </label>
                        {isEditing ? (
                          <input
                            id="bank_account_bsb"
                            type="text"
                            inputMode="numeric"
                            value={editData.bank_account_bsb || ""}
                            onChange={(e) =>
                              handleInputChange(
                                "bank_account_bsb",
                                e.target.value,
                              )
                            }
                            className={`${FIELD} font-mono ${fieldTone(false)}`}
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
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5" aria-hidden="true" />
                      Superannuation
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="supper_account_name"
                          className={labelClass}
                        >
                          Fund name
                        </label>
                        {isEditing ? (
                          <input
                            id="supper_account_name"
                            type="text"
                            value={editData.supper_account_name || ""}
                            onChange={(e) =>
                              handleInputChange(
                                "supper_account_name",
                                e.target.value,
                              )
                            }
                            className={`${FIELD} ${fieldTone(false)}`}
                          />
                        ) : (
                          <p className="text-sm text-slate-700">
                            {formatValue(employee.supper_account_name)}
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="supper_account_number"
                          className={labelClass}
                        >
                          Member ID
                        </label>
                        {isEditing ? (
                          <>
                            <input
                              id="supper_account_number"
                              type="text"
                              value={editData.supper_account_number || ""}
                              onChange={(e) =>
                                handleInputChange(
                                  "supper_account_number",
                                  e.target.value,
                                )
                              }
                              placeholder={formatValue(
                                employee.supper_account_number,
                              )}
                              aria-describedby="supper_account_number-hint"
                              className={`${FIELD} font-mono ${fieldTone(false)}`}
                            />
                            <p
                              id="supper_account_number-hint"
                              className="text-xs text-slate-500 mt-1"
                            >
                              Leave blank to keep the current ID.
                            </p>
                          </>
                        ) : (
                          renderMaskedNumber("supper_account_number")
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="bg-white rounded-lg border border-slate-200 p-4">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">
                      Notes
                    </h2>
                    {isEditing ? (
                      <textarea
                        aria-label="Notes"
                        value={editData.notes || ""}
                        onChange={(e) =>
                          handleInputChange("notes", e.target.value)
                        }
                        rows={3}
                        className={`${FIELD} ${fieldTone(false)}`}
                      />
                    ) : (
                      <div className="text-sm text-slate-700 bg-slate-50 border border-slate-200 p-3 rounded-lg">
                        {formatValue(employee.notes)}
                      </div>
                    )}
                  </div>

                  {/* Active status: shown in the header badge when reading,
                      editable here while editing */}
                  {isEditing && (
                    <div className="bg-white rounded-lg border border-slate-200 p-4">
                      <h2 className="text-lg font-semibold text-slate-800 mb-4">
                        Status
                      </h2>
                      <label
                        htmlFor="emp-is_active"
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          id="emp-is_active"
                          type="checkbox"
                          checked={
                            editData.is_active !== undefined
                              ? editData.is_active
                              : true
                          }
                          onChange={(e) =>
                            handleInputChange("is_active", e.target.checked)
                          }
                          className="cursor-pointer w-4 h-4 text-primary focus:ring-primary border-slate-300 rounded"
                        />
                        <span className="text-sm font-medium text-slate-700">
                          Current employee
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "working-hours" && (
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <WorkingHours employeeId={employee.employee_id} />
              </div>
            )}
          </div>
        )}
      </main>

      {/* User Details Modal */}
      {showUserModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
          onClick={() => {
            // A form with typed-in work does not close on a stray backdrop
            // click (DESIGN.md 15.1); Escape and the buttons still do.
            if (!userFormMode) closeUserModal();
          }}
        >
          <div
            ref={userModalRef}
            role="dialog"
            aria-modal="true"
            aria-label={isCreatingUser ? "Create user account" : "User details"}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white w-full max-w-lg rounded-xl border border-slate-200 max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">
                {isCreatingUser ? "Create user account" : "User details"}
              </h2>
              <button
                type="button"
                onClick={closeUserModal}
                className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* User Information */}
              {!isCreatingUser && user && Object.keys(user).length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-1">
                      Username
                    </div>
                    <div className="text-sm text-slate-700 break-all">
                      {formatValue(user.username)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-1">
                      User ID
                    </div>
                    <div className="text-sm text-slate-700 font-mono break-all">
                      {formatValue(user.id)}
                    </div>
                  </div>
                </div>
              )}

              {/* Editable Fields */}
              <div className="space-y-4">
                {/* Employee ID - First */}
                {isCreatingUser && (
                  <div>
                    <label
                      htmlFor="user-employee_id"
                      className={userLabelClass}
                    >
                      Employee ID
                    </label>
                    <input
                      id="user-employee_id"
                      type="text"
                      value={userEditData.employee_id || ""}
                      disabled
                      className="w-full text-sm font-mono text-slate-600 px-4 py-3 border border-slate-300 rounded-lg bg-slate-50 cursor-not-allowed"
                    />
                  </div>
                )}

                {/* Username and User Type - Side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {isCreatingUser && (
                    <div>
                      <label htmlFor="user-username" className={userLabelClass}>
                        Username <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="user-username"
                        type="email"
                        data-autofocus
                        value={userEditData.username || ""}
                        onChange={(e) =>
                          handleUserInputChange("username", e.target.value)
                        }
                        placeholder="name@example.com"
                        aria-invalid={!!userErrors.username}
                        aria-describedby={
                          userErrors.username
                            ? "user-username-error"
                            : undefined
                        }
                        className={`${MODAL_FIELD} ${fieldTone(
                          userErrors.username,
                        )}`}
                      />
                      <FieldError
                        id="user-username-error"
                        message={userErrors.username}
                      />
                    </div>
                  )}

                  <div>
                    <div id="user-user_type-label" className={userLabelClass}>
                      User type{" "}
                      {isCreatingUser && (
                        <span className="text-red-600">*</span>
                      )}
                    </div>
                    {userFormMode ? (
                      <div id="user-user_type-field">
                        <CustomDropdown
                          options={[
                            ...(isMasterAdmin()
                              ? [
                                  {
                                    value: "master-admin",
                                    label: "Master admin",
                                  },
                                ]
                              : []),
                            { value: "admin", label: "Admin" },
                            { value: "manager", label: "Manager" },
                            { value: "employee", label: "Employee" },
                          ]}
                          value={userEditData.user_type || ""}
                          onChange={(value) =>
                            handleUserInputChange("user_type", value)
                          }
                          placeholder="Select a user type"
                        />
                        <FieldError
                          id="user-user_type-error"
                          message={userErrors.user_type}
                        />
                      </div>
                    ) : (
                      <div className="text-sm text-slate-700">
                        {user?.user_type ? titleCase(user.user_type) : EMPTY}
                      </div>
                    )}
                  </div>
                </div>

                {/* Password - Full width */}
                <div>
                  <label htmlFor="user-password" className={userLabelClass}>
                    Password{" "}
                    {isCreatingUser && <span className="text-red-600">*</span>}
                  </label>
                  {userFormMode ? (
                    <>
                      <div className="relative">
                        <input
                          id="user-password"
                          type={showPassword ? "text" : "password"}
                          value={userEditData.password || ""}
                          onChange={(e) =>
                            handleUserInputChange("password", e.target.value)
                          }
                          autoComplete="new-password"
                          aria-invalid={!!userErrors.password}
                          aria-describedby={
                            userErrors.password
                              ? "user-password-error"
                              : isCreatingUser
                                ? undefined
                                : "user-password-hint"
                          }
                          className={`${MODAL_FIELD} pr-12 ${fieldTone(
                            userErrors.password,
                          )}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="cursor-pointer absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 hover:text-slate-700 transition-colors duration-200"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" aria-hidden="true" />
                          ) : (
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                      <FieldError
                        id="user-password-error"
                        message={userErrors.password}
                      />
                      {!isCreatingUser && !userErrors.password && (
                        <p
                          id="user-password-hint"
                          className="text-xs text-slate-500 mt-1"
                        >
                          Leave blank to keep the current password.
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="text-sm text-slate-700">••••••••</div>
                  )}
                </div>

                <div>
                  <div className={userLabelClass}>Status</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={
                        userFormMode
                          ? !!userEditData.is_active
                          : user
                            ? !!user.is_active
                            : false
                      }
                      onChange={(e) =>
                        handleUserInputChange("is_active", e.target.checked)
                      }
                      disabled={!userFormMode}
                      className="cursor-pointer w-4 h-4 text-primary bg-slate-100 border-slate-300 rounded focus:ring-primary focus:ring-2 disabled:cursor-not-allowed"
                    />
                    <label
                      htmlFor="is_active"
                      className="text-sm font-medium text-slate-700"
                    >
                      Active
                    </label>
                  </div>
                </div>
              </div>

              {/* Module Access - Only visible to master-admin */}
              {isMasterAdmin() && (
                <div>
                  <div className={`${userLabelClass} mb-3`}>Module access</div>
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
                                  disabled={!userFormMode}
                                  className="cursor-pointer p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                  aria-label={`${
                                    expandedModules[module.key]
                                      ? "Collapse"
                                      : "Expand"
                                  } ${module.label}`}
                                  aria-expanded={!!expandedModules[module.key]}
                                >
                                  {expandedModules[module.key] ? (
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
                                    (child) => moduleAccess[child.key] === true,
                                  ) || false
                                }
                                ref={(el) => {
                                  if (el && module.children) {
                                    const checkedCount = module.children.filter(
                                      (child) =>
                                        moduleAccess[child.key] === true,
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
                                      e.target.checked,
                                    );
                                  });
                                }}
                                disabled={!userFormMode}
                                className="cursor-pointer w-4 h-4 text-primary bg-slate-100 border-slate-300 rounded focus:ring-primary focus:ring-2 disabled:cursor-not-allowed"
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
                                          e.target.checked,
                                        )
                                      }
                                      disabled={!userFormMode}
                                      className="cursor-pointer w-4 h-4 text-primary bg-slate-100 border-slate-300 rounded focus:ring-primary focus:ring-2 disabled:cursor-not-allowed"
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
                                  e.target.checked,
                                )
                              }
                              disabled={!userFormMode}
                              className="cursor-pointer w-4 h-4 text-primary bg-slate-100 border-slate-300 rounded focus:ring-primary focus:ring-2 disabled:cursor-not-allowed"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons: destructive on the left, Cancel / primary on the
                right with the primary action last */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200">
              <div>
                {!userFormMode && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    Remove user access
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {isCreatingUser ? (
                  <>
                    <button
                      type="button"
                      onClick={handleCreateUserCancel}
                      disabled={isUpdating}
                      className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateUserSave}
                      disabled={isUpdating}
                      className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUpdating ? (
                        <Spinner />
                      ) : (
                        <Save className="w-4 h-4" aria-hidden="true" />
                      )}
                      Create user
                    </button>
                  </>
                ) : !isEditingUser ? (
                  <>
                    <button
                      type="button"
                      onClick={closeUserModal}
                      className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingUser(true)}
                      className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200"
                    >
                      <Edit className="w-4 h-4" aria-hidden="true" />
                      Edit user
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleUserCancel}
                      disabled={isUpdating}
                      className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleUserSave}
                      disabled={isUpdating}
                      className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
          </div>
        </div>
      )}

      {/* Delete User Access Confirmation Modal */}
      <DeleteConfirmation
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        deleteWithInput={true}
        heading="User access"
        title={
          employee
            ? `Remove user access for ${employee.first_name} ${employee.last_name}?`
            : "Remove user access?"
        }
        warningHeading="This removes the user account and revokes system access"
        message={
          employee
            ? `${employee.first_name} ${employee.last_name} will no longer be able to sign in. The employee record is kept.`
            : "The employee will no longer be able to sign in. The employee record is kept."
        }
        confirmButtonText="Remove user access"
        confirmingText="Removing..."
        comparingName={
          employee ? `${employee.first_name} ${employee.last_name}` : ""
        }
        isDeleting={isUpdating}
        entityType="users"
      />

      {/* Delete Employee Confirmation Modal */}
      <DeleteConfirmation
        isOpen={showDeleteEmployeeModal}
        onClose={() => setShowDeleteEmployeeModal(false)}
        onConfirm={handleDeleteEmployeeConfirm}
        deleteWithInput={true}
        heading="Employee"
        title={
          employee
            ? `Delete ${employee.first_name} ${employee.last_name}?`
            : "Delete employee?"
        }
        warningHeading="This removes the employee record"
        message={
          employee
            ? `${employee.first_name} ${employee.last_name} (${employee.employee_id}) will be deleted from the employee list.`
            : "The employee will be deleted from the employee list."
        }
        confirmButtonText="Delete employee"
        comparingName={
          employee ? `${employee.first_name} ${employee.last_name}` : ""
        }
        isDeleting={isDeletingEmployee}
        entityType="employees"
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

      {/* Create Role Modal */}
      {showCreateRoleModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
          onClick={() => {
            // Keep typed-in work on a stray backdrop click (DESIGN.md 15.1).
            if (!roleModalDirty && !isCreatingRole) closeRoleModal();
          }}
        >
          <div
            ref={roleModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Create role"
            className="bg-white rounded-xl border border-slate-200 w-full max-w-md max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">
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
              className="flex flex-col min-h-0"
            >
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label
                    htmlFor="new-role-name"
                    className="block text-sm font-medium text-slate-700 mb-1.5"
                  >
                    Role name <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="new-role-name"
                    type="text"
                    data-autofocus
                    value={newRoleValue}
                    onChange={(e) => {
                      setNewRoleValue(e.target.value);
                      if (roleError) setRoleError("");
                    }}
                    placeholder="e.g. Cabinet maker"
                    aria-invalid={!!roleError}
                    aria-describedby={
                      roleError ? "new-role-name-error" : undefined
                    }
                    className={`${MODAL_FIELD} ${fieldTone(roleError)}`}
                  />
                  <FieldError id="new-role-name-error" message={roleError} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeRoleModal}
                  disabled={isCreatingRole}
                  className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingRole}
                  className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingRole ? (
                    <Spinner />
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
    </AdminShell>
  );
}
