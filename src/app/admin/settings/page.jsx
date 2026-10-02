"use client";
import React, { useState, useEffect, useRef } from "react";
import AdminShell from "@/components/AdminShell";
import {
  AlertTriangle,
  Eye,
  EyeOff,
  User,
  Lock,
  X,
  Moon,
  Sun,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Bell,
  ChevronDown,
  ChevronUp,
  Check,
  Minus,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Image from "next/image";
import Link from "next/link";
import useModalFocus from "@/hooks/useModalFocus";
import { BADGE, BADGE_TONES } from "@/app/admin/dashboard/lib/format";
import { formatLabel } from "@/app/admin/employees/punches/lib/punchStyles";

const EMPTY = "—";

// Surfaces, fields and buttons follow DESIGN.md 9.1-9.3. This page carries the
// admin's only dark-mode toggle, so every colour has a dark: pair (DESIGN.md 12).
const CARD =
  "bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700";
const INSET =
  "bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg";
const LABEL =
  "block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5";
const FIELD =
  "w-full text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-colors duration-200 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed";
const fieldTone = (hasError) =>
  hasError
    ? "border-red-500 focus:ring-red-500"
    : "border-slate-300 dark:border-slate-600 focus:ring-primary dark:focus:ring-slate-400";
const BTN_PRIMARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 dark:ring-1 dark:ring-slate-500 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
const TAB_BASE =
  "cursor-pointer py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200";
const TAB_ACTIVE =
  "border-primary text-primary dark:border-slate-100 dark:text-slate-100";
const TAB_IDLE =
  "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600";

// Roles are categories, not statuses, so they take the neutral and extended
// hues (DESIGN.md 5.5) rather than a status colour.
const ROLE_TONES = {
  "master-admin": BADGE_TONES.violet,
  admin: BADGE_TONES.indigo,
};
const roleTone = (role) => ROLE_TONES[role] || BADGE_TONES.neutral;
const roleLabel = (role) => formatLabel(String(role || "").replace(/-/g, "_"));

// Notification preferences. The field names are the API payload keys.
const MATERIALS_TO_ORDER_ITEMS = [
  {
    field: "material_to_order",
    label: "Materials to order: generated",
    description: "Receive notifications when materials to order are generated",
  },
  {
    field: "material_to_order_ordered",
    label: "Materials to order: ordered",
    description:
      "Receive notifications when materials from a supplier are fully ordered",
  },
];

const STAGE_ITEMS = [
  {
    field: "stage_quote_approve",
    label: "Quote approve",
    description: "Receive notifications when quotes are approved",
  },
  {
    field: "stage_material_appliances_selection",
    label: "Material and appliances selection",
    description:
      "Receive notifications for material and appliances selection updates",
  },
  {
    field: "stage_drafting",
    label: "Drafting",
    description: "Receive notifications for drafting stage updates",
  },
  {
    field: "stage_drafting_revision",
    label: "Drafting revision",
    description: "Receive notifications for drafting revision updates",
  },
  {
    field: "stage_final_design_approval",
    label: "Final design approval",
    description: "Receive notifications when final design is approved",
  },
  {
    field: "stage_site_measurements",
    label: "Site measurements",
    description: "Receive notifications for site measurements updates",
  },
  {
    field: "stage_final_approval_for_production",
    label: "Final approval for production",
    description:
      "Receive notifications when final approval for production is given",
  },
  {
    field: "stage_machining_out",
    label: "Machining out",
    description: "Receive notifications for machining out stage updates",
  },
  {
    field: "stage_material_order",
    label: "Material order",
    description: "Receive notifications when materials are ordered",
  },
  {
    field: "stage_cnc",
    label: "CNC",
    description: "Receive notifications for CNC stage updates",
  },
  {
    field: "stage_assembly",
    label: "Assembly",
    description: "Receive notifications for assembly stage updates",
  },
  {
    field: "stage_delivery",
    label: "Delivery",
    description: "Receive notifications for delivery stage updates",
  },
  {
    field: "stage_installation",
    label: "Installation",
    description: "Receive notifications for installation stage updates",
  },
  {
    field: "stage_invoice_sent",
    label: "Invoice sent",
    description: "Receive notifications when invoices are sent",
  },
  {
    field: "stage_maintenance",
    label: "Maintenance",
    description: "Receive notifications for maintenance stage updates",
  },
  {
    field: "stage_job_completion",
    label: "Job completion",
    description: "Receive notifications when jobs are completed",
  },
];

const STANDALONE_ITEMS = [
  {
    field: "meeting",
    label: "Meeting notifications",
    description: "Receive notifications about meeting schedules and updates",
  },
  {
    field: "stock_transactions",
    label: "Stock transactions",
    description: "Receive notifications about stock transactions",
  },
  {
    field: "supplier_statements",
    label: "Supplier statements",
    description: "Receive notifications about supplier statements",
  },
];

// Permission flags on the module_access record, grouped by area for the
// "Your access" card. The field names are the API keys; labels are display text.
const ACCESS_GROUPS = [
  {
    id: "clients",
    title: "Clients",
    permissions: [
      { field: "all_clients", label: "View all clients" },
      { field: "add_clients", label: "Add clients" },
      { field: "client_details", label: "Client details" },
    ],
  },
  {
    id: "employees",
    title: "Employees",
    permissions: [
      { field: "all_employees", label: "View all employees" },
      { field: "add_employees", label: "Add employees" },
      { field: "employee_details", label: "Employee details" },
    ],
  },
  {
    id: "projects",
    title: "Projects",
    permissions: [
      { field: "all_projects", label: "View all projects" },
      { field: "add_projects", label: "Add projects" },
      { field: "project_details", label: "Project details" },
      { field: "lotatglance", label: "Lot at a glance" },
      { field: "site_measurements", label: "Site measurements" },
      { field: "site_photos", label: "Site photos" },
    ],
  },
  {
    id: "suppliers",
    title: "Suppliers and procurement",
    permissions: [
      { field: "all_suppliers", label: "View all suppliers" },
      { field: "add_suppliers", label: "Add suppliers" },
      { field: "supplier_details", label: "Supplier details" },
      { field: "materialstoorder", label: "Materials to order" },
      { field: "purchaseorder", label: "Purchase orders" },
      { field: "statements", label: "Statements" },
    ],
  },
  {
    id: "inventory",
    title: "Inventory",
    permissions: [
      { field: "all_items", label: "View all items" },
      { field: "add_items", label: "Add items" },
      { field: "item_details", label: "Item details" },
      { field: "usedmaterial", label: "Used material" },
    ],
  },
  {
    id: "calendar",
    title: "Calendar and scheduling",
    permissions: [{ field: "calendar", label: "Calendar" }],
  },
  {
    id: "clock-punches",
    title: "Clock punches",
    permissions: [
      { field: "all_clock_punches", label: "View all clock punches" },
      { field: "add_clock_punch", label: "Add clock punches" },
      { field: "clock_punch_details", label: "Clock punch details" },
    ],
  },
  {
    id: "admin",
    title: "Admin",
    permissions: [
      { field: "dashboard", label: "Dashboard" },
      { field: "logs", label: "Activity logs" },
      { field: "config", label: "Configuration" },
      { field: "delete_media", label: "Delete media" },
    ],
  },
];

const ACCESS_FIELDS = ACCESS_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.field),
);

const NOTIFICATION_FIELDS = [
  "meeting",
  ...MATERIALS_TO_ORDER_ITEMS.map((item) => item.field),
  ...STAGE_ITEMS.map((item) => item.field),
  "stock_transactions",
  "supplier_statements",
];

const DEFAULT_NOTIFICATION_CONFIG = Object.fromEntries(
  NOTIFICATION_FIELDS.map((field) => [field, false]),
);

// Long dates carry the year: a date of birth without one is ambiguous, so this
// stays local rather than using the compact shared formatDate.
const formatDate = (dateString) => {
  if (!dateString) return EMPTY;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return EMPTY;
  return date.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const calculateDaysSinceStart = (startDate) => {
  if (!startDate) return null;
  try {
    const start = new Date(startDate);
    const today = new Date();
    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    let years = today.getFullYear() - start.getFullYear();
    let months = today.getMonth() - start.getMonth();
    let days = today.getDate() - start.getDate();

    // Adjust for negative days
    if (days < 0) {
      months--;
      const lastDayOfPrevMonth = new Date(
        today.getFullYear(),
        today.getMonth(),
        0,
      );
      days += lastDayOfPrevMonth.getDate();
    }

    // Adjust for negative months
    if (months < 0) {
      years--;
      months += 12;
    }

    // Build the formatted string
    const parts = [];
    if (years > 0) {
      parts.push(`${years} ${years === 1 ? "year" : "years"}`);
    }
    if (months > 0) {
      parts.push(`${months} ${months === 1 ? "month" : "months"}`);
    }
    if (days > 0 || parts.length === 0) {
      parts.push(`${days} ${days === 1 ? "day" : "days"}`);
    }

    return parts.join(", ");
  } catch {
    return null;
  }
};

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-red-600 mt-1">
      {message}
    </p>
  );
}

function Spinner() {
  return (
    <span
      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
      aria-hidden="true"
    />
  );
}

// Toggle switch (DESIGN.md 9.7). A real checkbox is the peer, so keyboard,
// focus and checked state come from the browser; the track is decoration.
function Toggle({ id, checked, onChange, disabled, labelledBy, describedBy }) {
  return (
    <label
      htmlFor={id}
      className="relative inline-flex items-center shrink-0 cursor-pointer has-disabled:cursor-not-allowed"
    >
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:bg-primary dark:peer-checked:bg-primary peer-focus-visible:ring-4 peer-focus-visible:ring-primary/20 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border after:border-slate-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
    </label>
  );
}

function NotificationRow({
  field,
  label,
  description,
  checked,
  onToggle,
  disabled,
  nested,
}) {
  const labelId = `notification-${field}-label`;
  const descriptionId = `notification-${field}-description`;
  return (
    <div
      className={`flex items-center justify-between gap-4 ${INSET} ${
        nested ? "p-3" : "p-4"
      }`}
    >
      <div className="flex-1 min-w-0">
        <p
          id={labelId}
          className="text-sm font-medium text-slate-800 dark:text-slate-100"
        >
          {label}
        </p>
        <p
          id={descriptionId}
          className="text-xs text-slate-500 dark:text-slate-400 mt-0.5"
        >
          {description}
        </p>
      </div>
      <Toggle
        id={`notification-${field}`}
        checked={checked}
        onChange={() => onToggle(field)}
        disabled={disabled}
        labelledBy={labelId}
        describedBy={descriptionId}
      />
    </div>
  );
}

function NotificationGroup({
  id,
  title,
  items,
  config,
  expanded,
  onExpand,
  onToggle,
  disabled,
}) {
  const enabledCount = items.filter((item) => config[item.field]).length;
  const Chevron = expanded ? ChevronUp : ChevronDown;
  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <h3>
        <button
          type="button"
          id={`${id}-trigger`}
          aria-expanded={expanded}
          aria-controls={`${id}-panel`}
          onClick={onExpand}
          className="cursor-pointer w-full flex items-center justify-between gap-3 p-4 text-left bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors duration-200"
        >
          <span className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {title}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {enabledCount} enabled
            </span>
          </span>
          <Chevron
            className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0"
            aria-hidden="true"
          />
        </button>
      </h3>
      {expanded && (
        <div
          id={`${id}-panel`}
          role="region"
          aria-labelledby={`${id}-trigger`}
          className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 grid grid-cols-1 2xl:grid-cols-2 gap-3"
        >
          {items.map((item) => (
            <NotificationRow
              key={item.field}
              {...item}
              checked={config[item.field]}
              onToggle={onToggle}
              disabled={disabled}
              nested
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileRow({
  icon: Icon,
  label,
  children,
  top = false,
  className = "",
}) {
  return (
    <div
      className={`flex gap-3 ${top ? "items-start" : "items-center"} ${className}`}
    >
      <Icon
        className={`w-4 h-4 text-slate-400 shrink-0 ${top ? "mt-0.5" : ""}`}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <dt className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
          {label}
        </dt>
        <dd className="text-sm text-slate-700 dark:text-slate-200">
          {children}
        </dd>
      </div>
    </div>
  );
}

// One account detail in the Account card's multi-column grid.
function AccountField({ label, children, hint }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
        {label}
      </dt>
      <dd className="text-sm text-slate-700 dark:text-slate-200">
        {children}
        {hint && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            {hint}
          </p>
        )}
      </dd>
    </div>
  );
}

// Compact stat tile for the "Account at a glance" row (DESIGN.md 2.2, 2.5).
function StatTile({ label, children }) {
  return (
    <div className={`${CARD} p-4`}>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-2 min-h-8 flex items-center text-2xl font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        {children}
      </dd>
    </div>
  );
}

// A permission is shown by icon and text, never by colour alone.
function PermissionChip({ label, granted }) {
  return (
    <li
      className={`${BADGE} ${
        granted ? BADGE_TONES.success : BADGE_TONES.muted
      }`}
    >
      {granted ? (
        <Check className="w-3 h-3 shrink-0" aria-hidden="true" />
      ) : (
        <Minus className="w-3 h-3 shrink-0" aria-hidden="true" />
      )}
      {label}
      <span className="sr-only">{granted ? ": granted" : ": not granted"}</span>
    </li>
  );
}

function AccessGroup({ group, access }) {
  const granted = group.permissions.filter(
    (permission) => access[permission.field] === true,
  ).length;
  const headingId = `access-group-${group.id}`;
  return (
    <section className={`${INSET} p-4`} aria-labelledby={headingId}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3
          id={headingId}
          className="text-sm font-semibold text-slate-800 dark:text-slate-100"
        >
          {group.title}
        </h3>
        <span className={`${BADGE} ${BADGE_TONES.neutral} tabular-nums`}>
          {granted} of {group.permissions.length}
        </span>
      </div>
      <ul className="flex flex-wrap gap-2">
        {group.permissions.map((permission) => (
          <PermissionChip
            key={permission.field}
            label={permission.label}
            granted={access[permission.field] === true}
          />
        ))}
      </ul>
    </section>
  );
}

export default function SettingsPage() {
  const { userData, getToken, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState({});
  const passwordModalRef = useRef(null);

  // Notification config state
  const [notificationConfig, setNotificationConfig] = useState(
    DEFAULT_NOTIFICATION_CONFIG,
  );
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState(null);
  const [expandedStages, setExpandedStages] = useState(false);
  const [expandedMaterialsToOrder, setExpandedMaterialsToOrder] =
    useState(false);

  // Focus moves into the password dialog, stays there, and returns to the
  // trigger on close (DESIGN.md 13.6).
  useModalFocus(passwordModalRef, showPasswordModal);

  // Initialize dark mode from localStorage
  useEffect(() => {
    const isDark = localStorage.getItem("darkMode") === "true";
    setDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  useEffect(() => {
    if (userData?.user?.id) {
      fetchUserDetails();
      // Only fetch notification config if user is admin or master-admin
      if (isAdmin()) {
        fetchNotificationConfig();
      }
    }
  }, [userData]);

  // Redirect to personal tab if user tries to access notifications tab without permission
  useEffect(() => {
    if (activeTab === "notifications" && !isAdmin()) {
      setActiveTab("personal");
    }
  }, [activeTab, isAdmin]);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    localStorage.setItem("darkMode", newDarkMode.toString());
    if (newDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const fetchUserDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const sessionToken = getToken();

      if (!sessionToken) {
        setError("Your session has expired. Sign in again to continue.");
        setLoading(false);
        return;
      }

      const userId = userData.user.id;
      const response = await axios.get(`/api/v1/user/${userId}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        const userData = response.data.data;
        setUser(userData);
        if (userData.employee) {
          setEmployee(userData.employee);
        }
      } else {
        setError(
          response.data.message || "Couldn't load your settings. Try again.",
        );
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
      setError(
        error.response?.data?.message ||
          "Couldn't load your settings. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchNotificationConfig = async () => {
    try {
      setNotificationLoading(true);
      setNotificationError(null);
      const sessionToken = getToken();

      if (!sessionToken) {
        return;
      }

      const userId = userData?.user?.id;
      if (!userId) return;

      const response = await axios.get(
        `/api/v1/notification_config/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        },
      );

      if (response.data.status) {
        setNotificationConfig(
          Object.fromEntries(
            NOTIFICATION_FIELDS.map((field) => [
              field,
              response.data.data[field] || false,
            ]),
          ),
        );
      } else {
        setNotificationError(
          response.data.message ||
            "Couldn't load notification preferences. Try again.",
        );
      }
    } catch (error) {
      console.error("Error fetching notification config:", error);
      setNotificationError(
        error.response?.data?.message ||
          "Couldn't load notification preferences. Check your connection and try again.",
      );
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleNotificationToggle = async (field) => {
    try {
      setIsUpdatingNotifications(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
        return;
      }

      const userId = userData?.user?.id;
      if (!userId) {
        toast.error("Couldn't work out which user to update. Reload the page.");
        return;
      }

      const updatedConfig = {
        ...notificationConfig,
        [field]: !notificationConfig[field],
      };

      const response = await axios.patch(
        `/api/v1/notification_config/${userId}`,
        updatedConfig,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.status) {
        setNotificationConfig(updatedConfig);
        toast.success("Notification preferences updated.", {
          position: "top-right",
          autoClose: 2000,
          hideProgressBar: false,
        });
      } else {
        toast.error(
          response.data.message ||
            "Couldn't update notification preferences. Try again.",
        );
      }
    } catch (error) {
      console.error("Error updating notification config:", error);
      toast.error(
        error.response?.data?.message ||
          "Couldn't update notification preferences. Check your connection and try again.",
        {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
        },
      );
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

  // Typing clears that field's error (validate on submit, then on change).
  // The new password is checked against the current one, so editing either
  // field clears the new-password error.
  const handlePasswordInputChange = (field, value) => {
    setPasswordData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setPasswordErrors((prev) => ({
      ...prev,
      [field]: undefined,
      newPassword: undefined,
    }));
  };

  const handleResetPassword = () => {
    setShowPasswordModal(true);
    setPasswordData({
      oldPassword: "",
      newPassword: "",
    });
    setPasswordErrors({});
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordData({
      oldPassword: "",
      newPassword: "",
    });
    setPasswordErrors({});
    setShowOldPassword(false);
    setShowNewPassword(false);
  };

  // Escape closes the dialog unless a save is in flight (DESIGN.md 9.4).
  useEffect(() => {
    if (!showPasswordModal) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape" && !isUpdating) handleClosePasswordModal();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showPasswordModal, isUpdating]);

  const passwordDirty = Boolean(
    passwordData.oldPassword || passwordData.newPassword,
  );

  const handleSavePassword = async () => {
    if (isUpdating) return;
    try {
      // Validate inputs inline, then focus the first invalid field
      const errors = {};
      if (!passwordData.oldPassword || passwordData.oldPassword.trim() === "") {
        errors.oldPassword = "Enter your current password.";
      }

      if (!passwordData.newPassword || passwordData.newPassword.trim() === "") {
        errors.newPassword = "Enter a new password.";
      } else if (passwordData.newPassword.length < 8) {
        errors.newPassword = "New password must be at least 8 characters.";
      } else if (passwordData.oldPassword === passwordData.newPassword) {
        errors.newPassword =
          "New password must be different from your current password.";
      }

      setPasswordErrors(errors);
      const firstInvalid = ["oldPassword", "newPassword"].find(
        (field) => errors[field],
      );
      if (firstInvalid) {
        setTimeout(() => {
          document.getElementById(`password-${firstInvalid}`)?.focus();
        }, 0);
        return;
      }

      setIsUpdating(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("Your session has expired. Sign in again to continue.");
        return;
      }

      const userId = userData?.user?.id;

      if (!userId) {
        toast.error("Couldn't work out which user to update. Reload the page.");
        return;
      }

      const updateData = {
        id: user.id,
        old_password: passwordData.oldPassword,
        password: passwordData.newPassword,
      };

      const response = await axios.patch(`/api/v1/user/${userId}`, updateData, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.data.status) {
        toast.success("Password updated.", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        handleClosePasswordModal();
        await fetchUserDetails();
      } else {
        toast.error(
          response.data.message || "Couldn't update the password. Try again.",
        );
      }
    } catch (error) {
      console.error("Error updating password:", error);
      toast.error(
        error.response?.data?.message ||
          "Couldn't update the password. Check your current password and try again.",
        {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
        },
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const tenure = employee ? calculateDaysSinceStart(employee.join_date) : null;
  const employeeName = employee
    ? `${employee.first_name || ""} ${employee.last_name || ""}`.trim()
    : "";
  const showNotificationsTab = isAdmin();
  const isMasterAdmin = user?.user_type === "master-admin";
  const moduleAccess = user?.module_access || null;
  const grantedModuleCount = moduleAccess
    ? ACCESS_FIELDS.filter((field) => moduleAccess[field] === true).length
    : 0;
  const isActive = user?.is_active ?? true;

  return (
    <AdminShell>
      <main className="h-full overflow-y-auto dark:bg-slate-900 text-foreground">
        {loading ? (
          <div
            className="flex items-center justify-center h-full"
            role="status"
          >
            <div className="text-center">
              <div
                className="animate-spin rounded-full w-8 h-8 border-2 border-primary dark:border-slate-300 border-t-transparent mx-auto mb-4"
                aria-hidden="true"
              />
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Loading settings...
              </p>
            </div>
          </div>
        ) : error || !user ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertTriangle
                className="w-8 h-8 text-red-500 mx-auto mb-4"
                aria-hidden="true"
              />
              <p
                className="text-sm text-red-600 dark:text-red-400 mb-4"
                role="alert"
              >
                {error || "Couldn't load your settings."}
              </p>
              <button
                type="button"
                onClick={() => fetchUserDetails()}
                className={`${BTN_PRIMARY} mx-auto`}
              >
                Try again
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                  Settings
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Manage your account settings and preferences
                </p>
              </div>
              <button
                type="button"
                onClick={toggleDarkMode}
                className="cursor-pointer p-2 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors duration-200"
                aria-label={
                  darkMode ? "Switch to light mode" : "Switch to dark mode"
                }
                title={
                  darkMode ? "Switch to light mode" : "Switch to dark mode"
                }
              >
                {darkMode ? (
                  <Sun className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <Moon className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
            </div>

            {/* Tabs */}
            <div className={CARD}>
              <nav
                className="flex space-x-8 px-4"
                role="tablist"
                aria-label="Settings sections"
              >
                <button
                  type="button"
                  role="tab"
                  id="settings-tab-personal"
                  aria-selected={activeTab === "personal"}
                  aria-controls="settings-panel-personal"
                  onClick={() => setActiveTab("personal")}
                  className={`${TAB_BASE} ${
                    activeTab === "personal" ? TAB_ACTIVE : TAB_IDLE
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" aria-hidden="true" />
                    Personal info
                  </div>
                </button>
                {showNotificationsTab && (
                  <button
                    type="button"
                    role="tab"
                    id="settings-tab-notifications"
                    aria-selected={activeTab === "notifications"}
                    aria-controls="settings-panel-notifications"
                    onClick={() => setActiveTab("notifications")}
                    className={`${TAB_BASE} ${
                      activeTab === "notifications" ? TAB_ACTIVE : TAB_IDLE
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4" aria-hidden="true" />
                      Notifications
                    </div>
                  </button>
                )}
              </nav>
            </div>

            {/* Personal info */}
            {activeTab === "personal" && (
              <div
                role="tabpanel"
                id="settings-panel-personal"
                aria-labelledby="settings-tab-personal"
                className="space-y-4"
              >
                {/* Account at a glance */}
                <section aria-label="Account at a glance">
                  <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatTile label="Role">
                      {user.user_type ? (
                        <span
                          className={`${BADGE} ${roleTone(user.user_type)}`}
                        >
                          {roleLabel(user.user_type)}
                        </span>
                      ) : (
                        EMPTY
                      )}
                    </StatTile>
                    <StatTile label="Status">
                      <span
                        className={`${BADGE} ${
                          isActive ? BADGE_TONES.success : BADGE_TONES.neutral
                        }`}
                      >
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </StatTile>
                    <StatTile label="Member since">
                      {formatDate(user.createdAt)}
                    </StatTile>
                    <StatTile label="Modules you can access">
                      {isMasterAdmin ? (
                        "All"
                      ) : moduleAccess ? (
                        <span>
                          {grantedModuleCount}
                          <span className="ml-1.5 text-sm font-normal text-slate-500 dark:text-slate-400">
                            of {ACCESS_FIELDS.length}
                          </span>
                        </span>
                      ) : (
                        EMPTY
                      )}
                    </StatTile>
                  </dl>
                </section>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
                  {employee && (
                    <section
                      className={`${CARD} xl:col-span-1`}
                      aria-label="Employee profile"
                    >
                      <div className="flex items-center gap-4 p-4 border-b border-slate-200 dark:border-slate-700">
                        {employee.image?.url ? (
                          <div className="relative w-16 h-16 shrink-0 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                            <Image
                              src={`/${employee.image.url}`}
                              alt=""
                              fill
                              sizes="64px"
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className="w-16 h-16 shrink-0 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full flex items-center justify-center text-slate-700 dark:text-slate-200 text-lg font-semibold"
                            aria-hidden="true"
                          >
                            {employee.first_name?.[0] || ""}
                            {employee.last_name?.[0] || ""}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {employeeName || EMPTY}
                          </h2>
                          {employee.role && (
                            <p className="text-sm text-slate-600 dark:text-slate-300 truncate">
                              {employee.role}
                            </p>
                          )}
                          {employee.employee_id && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                              {employee.employee_id}
                            </p>
                          )}
                        </div>
                      </div>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4 p-4">
                        <ProfileRow icon={Calendar} label="Date of birth">
                          {formatDate(employee.dob)}
                        </ProfileRow>
                        <ProfileRow icon={Calendar} label="Start date">
                          <span className="flex flex-wrap items-center gap-2">
                            {formatDate(employee.join_date)}
                            {tenure && (
                              <span
                                className={`${BADGE} ${BADGE_TONES.neutral}`}
                              >
                                {tenure}
                              </span>
                            )}
                          </span>
                        </ProfileRow>
                        <ProfileRow icon={Mail} label="Email">
                          <span
                            className="block truncate"
                            title={employee.email || undefined}
                          >
                            {employee.email || EMPTY}
                          </span>
                        </ProfileRow>
                        <ProfileRow icon={Phone} label="Mobile number">
                          {employee.phone || EMPTY}
                        </ProfileRow>
                        <ProfileRow
                          icon={MapPin}
                          label="Address"
                          top
                          className="sm:col-span-2 xl:col-span-1"
                        >
                          {employee.address || EMPTY}
                        </ProfileRow>
                      </dl>
                    </section>
                  )}

                  <section
                    className={`${CARD} ${
                      employee ? "xl:col-span-2" : "xl:col-span-3"
                    }`}
                    aria-labelledby="account-heading"
                  >
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                      <h2
                        id="account-heading"
                        className="text-lg font-semibold text-slate-800 dark:text-slate-100"
                      >
                        Account settings
                      </h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Your sign-in details
                      </p>
                    </div>

                    <dl
                      className={`grid grid-cols-1 sm:grid-cols-2 ${
                        employee ? "" : "2xl:grid-cols-3"
                      } gap-x-8 gap-y-6 p-6`}
                    >
                      <AccountField label="Username">
                        <span className="break-all">
                          {user.username || EMPTY}
                        </span>
                      </AccountField>

                      <AccountField
                        label="User type"
                        hint="Only a master admin can change your user type."
                      >
                        {user.user_type ? (
                          <span
                            className={`${BADGE} ${roleTone(user.user_type)}`}
                          >
                            {roleLabel(user.user_type)}
                          </span>
                        ) : (
                          EMPTY
                        )}
                      </AccountField>

                      <AccountField
                        label="Account status"
                        hint="Only a master admin can change your account status."
                      >
                        <span
                          className={`${BADGE} ${
                            isActive ? BADGE_TONES.success : BADGE_TONES.neutral
                          }`}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </AccountField>

                      <AccountField label="Member since">
                        {formatDate(user.createdAt)}
                      </AccountField>

                      <AccountField label="Last updated">
                        {formatDate(user.updatedAt)}
                      </AccountField>

                      <AccountField label="Linked employee">
                        {employee ? (
                          employee.employee_id ? (
                            <Link
                              href={`/admin/employees/${employee.employee_id}`}
                              className="rounded-sm font-medium text-primary dark:text-slate-100 hover:underline focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-slate-400"
                            >
                              {employeeName || EMPTY}
                              <span className="ml-2 font-mono text-xs font-normal text-slate-500 dark:text-slate-400">
                                {employee.employee_id}
                              </span>
                            </Link>
                          ) : (
                            employeeName || EMPTY
                          )
                        ) : (
                          `${EMPTY} Not linked to an employee profile`
                        )}
                      </AccountField>

                      <div className="min-w-0 sm:col-span-2 2xl:col-span-3">
                        <dt className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                          Password
                        </dt>
                        <dd className="flex items-center justify-between gap-3 text-sm text-slate-700 dark:text-slate-200">
                          <span>
                            <span aria-hidden="true">••••••••</span>
                            <span className="sr-only">Password is hidden</span>
                          </span>
                          <button
                            type="button"
                            onClick={handleResetPassword}
                            className={`${BTN_SECONDARY} whitespace-nowrap`}
                          >
                            <Lock className="w-4 h-4" aria-hidden="true" />
                            Change password
                          </button>
                        </dd>
                      </div>
                    </dl>
                  </section>
                </div>

                {/* Your access */}
                <section className={CARD} aria-labelledby="access-heading">
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <h2
                      id="access-heading"
                      className="text-lg font-semibold text-slate-800 dark:text-slate-100"
                    >
                      Your access
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      The areas of the admin you can use. A master admin can
                      change these.
                    </p>
                  </div>
                  <div className="p-6">
                    {isMasterAdmin ? (
                      <p className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                        <ShieldCheck
                          className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400"
                          aria-hidden="true"
                        />
                        Master admin: full access to every module
                      </p>
                    ) : moduleAccess ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {ACCESS_GROUPS.map((group) => (
                          <AccessGroup
                            key={group.id}
                            group={group}
                            access={moduleAccess}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {EMPTY} No module access has been set up for your
                        account. Ask a master admin to review it.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            )}

            {/* Notifications */}
            {activeTab === "notifications" && showNotificationsTab && (
              <section
                role="tabpanel"
                id="settings-panel-notifications"
                aria-labelledby="settings-tab-notifications"
                className={CARD}
              >
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                  <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    Notification preferences
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Choose which notifications you want to receive
                  </p>
                </div>

                <div className="p-6">
                  {notificationLoading ? (
                    <div
                      className="flex items-center justify-center py-12"
                      role="status"
                    >
                      <div className="text-center">
                        <div
                          className="animate-spin rounded-full w-8 h-8 border-2 border-primary dark:border-slate-300 border-t-transparent mx-auto mb-4"
                          aria-hidden="true"
                        />
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          Loading notification preferences...
                        </p>
                      </div>
                    </div>
                  ) : notificationError ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <AlertTriangle
                          className="w-8 h-8 text-red-500 mx-auto mb-4"
                          aria-hidden="true"
                        />
                        <p
                          className="text-sm text-red-600 dark:text-red-400 mb-4"
                          role="alert"
                        >
                          {notificationError}
                        </p>
                        <button
                          type="button"
                          onClick={() => fetchNotificationConfig()}
                          className={`${BTN_SECONDARY} mx-auto`}
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                      <div className="space-y-4">
                        <NotificationGroup
                          id="notification-group-materials"
                          title="Materials to order"
                          items={MATERIALS_TO_ORDER_ITEMS}
                          config={notificationConfig}
                          expanded={expandedMaterialsToOrder}
                          onExpand={() =>
                            setExpandedMaterialsToOrder(
                              !expandedMaterialsToOrder,
                            )
                          }
                          onToggle={handleNotificationToggle}
                          disabled={isUpdatingNotifications}
                        />
                        <NotificationGroup
                          id="notification-group-stages"
                          title="Stage updates"
                          items={STAGE_ITEMS}
                          config={notificationConfig}
                          expanded={expandedStages}
                          onExpand={() => setExpandedStages(!expandedStages)}
                          onToggle={handleNotificationToggle}
                          disabled={isUpdatingNotifications}
                        />
                      </div>
                      <div className="space-y-4">
                        {STANDALONE_ITEMS.map((item) => (
                          <NotificationRow
                            key={item.field}
                            {...item}
                            checked={notificationConfig[item.field]}
                            onToggle={handleNotificationToggle}
                            disabled={isUpdatingNotifications}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Change password dialog */}
        {showPasswordModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
            onClick={() => {
              // A form with typed-in work does not close on a stray backdrop
              // click (DESIGN.md 15.1); Escape and the buttons still do.
              if (!passwordDirty && !isUpdating) handleClosePasswordModal();
            }}
          >
            <form
              ref={passwordModalRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="change-password-title"
              noValidate
              onClick={(e) => e.stopPropagation()}
              onSubmit={(e) => {
                e.preventDefault();
                handleSavePassword();
              }}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-md max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <h2
                  id="change-password-title"
                  className="text-lg font-semibold text-slate-800 dark:text-slate-100"
                >
                  Change password
                </h2>
                <button
                  type="button"
                  onClick={handleClosePasswordModal}
                  disabled={isUpdating}
                  className="cursor-pointer p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <label htmlFor="password-oldPassword" className={LABEL}>
                    Current password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="password-oldPassword"
                      data-autofocus
                      type={showOldPassword ? "text" : "password"}
                      value={passwordData.oldPassword}
                      onChange={(e) =>
                        handlePasswordInputChange("oldPassword", e.target.value)
                      }
                      autoComplete="current-password"
                      disabled={isUpdating}
                      aria-invalid={!!passwordErrors.oldPassword}
                      aria-describedby={
                        passwordErrors.oldPassword
                          ? "password-oldPassword-error"
                          : undefined
                      }
                      className={`${FIELD} pr-12 ${fieldTone(
                        passwordErrors.oldPassword,
                      )}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      disabled={isUpdating}
                      className="cursor-pointer absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-200"
                      aria-label={
                        showOldPassword
                          ? "Hide current password"
                          : "Show current password"
                      }
                    >
                      {showOldPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <FieldError
                    id="password-oldPassword-error"
                    message={passwordErrors.oldPassword}
                  />
                </div>

                <div>
                  <label htmlFor="password-newPassword" className={LABEL}>
                    New password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="password-newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        handlePasswordInputChange("newPassword", e.target.value)
                      }
                      autoComplete="new-password"
                      disabled={isUpdating}
                      aria-invalid={!!passwordErrors.newPassword}
                      aria-describedby={
                        passwordErrors.newPassword
                          ? "password-newPassword-error"
                          : "password-newPassword-hint"
                      }
                      className={`${FIELD} pr-12 ${fieldTone(
                        passwordErrors.newPassword,
                      )}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      disabled={isUpdating}
                      className="cursor-pointer absolute inset-y-0 right-0 px-3 flex items-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-200"
                      aria-label={
                        showNewPassword
                          ? "Hide new password"
                          : "Show new password"
                      }
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <Eye className="w-4 h-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <FieldError
                    id="password-newPassword-error"
                    message={passwordErrors.newPassword}
                  />
                  {!passwordErrors.newPassword && (
                    <p
                      id="password-newPassword-hint"
                      className="text-xs text-slate-500 dark:text-slate-400 mt-1"
                    >
                      Use at least 8 characters.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handleClosePasswordModal}
                  disabled={isUpdating}
                  className={BTN_SECONDARY}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className={BTN_PRIMARY}
                >
                  {isUpdating && <Spinner />}
                  Update password
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </AdminShell>
  );
}
