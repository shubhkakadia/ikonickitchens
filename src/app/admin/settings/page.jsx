"use client";
import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
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
  UserCircle,
  Settings as SettingsIcon,
  Bell,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Image from "next/image";
import chroma from "chroma-js";

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
  
  // Notification config state
  const [notificationConfig, setNotificationConfig] = useState({
    material_to_order: false,
    material_to_order_ordered: false,
    stage_quote_approve: false,
    stage_material_appliances_selection: false,
    stage_drafting: false,
    stage_drafting_revision: false,
    stage_final_design_approval: false,
    stage_site_measurements: false,
    stage_final_approval_for_production: false,
    stage_machining_out: false,
    stage_material_order: false,
    stage_cnc: false,
    stage_assembly: false,
    stage_delivery: false,
    stage_installation: false,
    stage_invoice_sent: false,
    stage_maintenance: false,
    stage_job_completion: false,
    stock_transactions: false,
    supplier_statements: false,
  });
  const [isUpdatingNotifications, setIsUpdatingNotifications] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [expandedStages, setExpandedStages] = useState(false);
  const [expandedMaterialsToOrder, setExpandedMaterialsToOrder] = useState(false);

  // Primary color - using the btn-primary color
  const primaryColor = "#B92F34";

  // Calculate complementary color and variants using chroma-js
  const complementaryColors = useMemo(() => {
    try {
      const primary = chroma(primaryColor);
      // Get complementary color by rotating hue 180 degrees
      const hsl = primary.hsl();
      const newHue = (hsl[0] + 180) % 360;
      const complement = chroma.hsl(newHue, hsl[1], hsl[2]);
      const compHex = complement.hex();
      const compColor = chroma(compHex);

      return {
        base: compHex,
        lighter: compColor.brighten(0.2).hex(),
        darker: compColor.darken(0.2).hex(),
        withAlpha20: compColor.alpha(0.2).css(),
        withAlpha10: compColor.alpha(0.1).css(),
        textColor: compColor.luminance() > 0.5 ? "#000000" : "#ffffff",
      };
    } catch (error) {
      console.error("Error calculating complementary color:", error);
      // Fallback to a calculated complement if chroma fails
      return {
        base: "#06b6d4",
        lighter: "#22d3ee",
        darker: "#0891b2",
        withAlpha20: "rgba(6, 182, 212, 0.2)",
        withAlpha10: "rgba(6, 182, 212, 0.1)",
        textColor: "#ffffff",
      };
    }
  }, []);

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
        setError("No valid session found. Please login again.");
        setLoading(false);
        return;
      }

      const userId = userData.user.id;
      const response = await axios.get(`/api/user/${userId}`, {
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
        setError(response.data.message || "Failed to fetch user details");
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
      setError(
        error.response?.data?.message ||
        "Failed to load user details. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchNotificationConfig = async () => {
    try {
      setNotificationLoading(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        return;
      }

      const userId = userData?.user?.id;
      if (!userId) return;

      const response = await axios.get(`/api/notification_config/${userId}`, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (response.data.status) {
        setNotificationConfig({
          material_to_order: response.data.data.material_to_order || false,
          material_to_order_ordered: response.data.data.material_to_order_ordered || false,
          stage_quote_approve: response.data.data.stage_quote_approve || false,
          stage_material_appliances_selection: response.data.data.stage_material_appliances_selection || false,
          stage_drafting: response.data.data.stage_drafting || false,
          stage_drafting_revision: response.data.data.stage_drafting_revision || false,
          stage_final_design_approval: response.data.data.stage_final_design_approval || false,
          stage_site_measurements: response.data.data.stage_site_measurements || false,
          stage_final_approval_for_production: response.data.data.stage_final_approval_for_production || false,
          stage_machining_out: response.data.data.stage_machining_out || false,
          stage_material_order: response.data.data.stage_material_order || false,
          stage_cnc: response.data.data.stage_cnc || false,
          stage_assembly: response.data.data.stage_assembly || false,
          stage_delivery: response.data.data.stage_delivery || false,
          stage_installation: response.data.data.stage_installation || false,
          stage_invoice_sent: response.data.data.stage_invoice_sent || false,
          stage_maintenance: response.data.data.stage_maintenance || false,
          stage_job_completion: response.data.data.stage_job_completion || false,
          stock_transactions: response.data.data.stock_transactions || false,
          supplier_statements: response.data.data.supplier_statements || false,
        });
      }
    } catch (error) {
      console.error("Error fetching notification config:", error);
    } finally {
      setNotificationLoading(false);
    }
  };

  const handleNotificationToggle = async (field) => {
    try {
      setIsUpdatingNotifications(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const userId = userData?.user?.id;
      if (!userId) {
        toast.error("Unable to determine user ID");
        return;
      }

      const updatedConfig = {
        ...notificationConfig,
        [field]: !notificationConfig[field],
      };

      const response = await axios.patch(
        `/api/notification_config/${userId}`,
        updatedConfig,
        {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.status) {
        setNotificationConfig(updatedConfig);
        toast.success("Notification preferences updated successfully!", {
          position: "top-right",
          autoClose: 2000,
          hideProgressBar: false,
        });
      } else {
        toast.error(response.data.message || "Failed to update notification preferences");
      }
    } catch (error) {
      console.error("Error updating notification config:", error);
      toast.error(
        error.response?.data?.message ||
        "Failed to update notification preferences. Please try again.",
        {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
        }
      );
    } finally {
      setIsUpdatingNotifications(false);
    }
  };

  const handlePasswordInputChange = (field, value) => {
    setPasswordData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleResetPassword = () => {
    setShowPasswordModal(true);
    setPasswordData({
      oldPassword: "",
      newPassword: "",
    });
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordData({
      oldPassword: "",
      newPassword: "",
    });
    setShowOldPassword(false);
    setShowNewPassword(false);
  };

  const handleSavePassword = async () => {
    try {
      // Validate inputs
      if (!passwordData.oldPassword || passwordData.oldPassword.trim() === "") {
        toast.error("Please enter your current password");
        return;
      }

      if (!passwordData.newPassword || passwordData.newPassword.trim() === "") {
        toast.error("Please enter a new password");
        return;
      }

      if (passwordData.newPassword.length < 6) {
        toast.error("New password must be at least 6 characters long");
        return;
      }

      if (passwordData.oldPassword === passwordData.newPassword) {
        toast.error("New password must be different from current password");
        return;
      }

      setIsUpdating(true);
      const sessionToken = getToken();

      if (!sessionToken) {
        toast.error("No valid session found. Please login again.");
        return;
      }

      const userId = userData?.user?.id;

      if (!userId) {
        toast.error("Unable to determine user ID for update");
        return;
      }

      const updateData = {
        id: user.id,
        old_password: passwordData.oldPassword,
        password: passwordData.newPassword,
      };

      const response = await axios.patch(`/api/user/${userId}`, updateData, {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
      });

      if (response.data.status) {
        toast.success("Password updated successfully!", {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
        });
        handleClosePasswordModal();
        await fetchUserDetails();
      } else {
        toast.error(response.data.message || "Failed to update password");
      }
    } catch (error) {
      console.error("Error updating password:", error);
      toast.error(
        error.response?.data?.message ||
        "Failed to update password. Please check your current password and try again.",
        {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
        }
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-AU", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "N/A";
    }
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
        const lastDayOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
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

  return (
    <AdminRoute>
      <div className="flex h-screen bg-background text-foreground">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <CRMLayout />
          <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                    Loading settings...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-sm text-red-600 dark:text-red-400 mb-4 font-medium">
                    {error}
                  </p>
                  <button
                    onClick={() => fetchUserDetails()}
                    className={`cursor-pointer px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${!darkMode ? "btn-primary" : ""
                      }`}
                    style={darkMode ? {
                      backgroundColor: complementaryColors.base,
                      color: complementaryColors.textColor
                    } : {}}
                    onMouseEnter={(e) => {
                      if (darkMode) {
                        e.currentTarget.style.backgroundColor = complementaryColors.lighter;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (darkMode) {
                        e.currentTarget.style.backgroundColor = complementaryColors.base;
                      }
                    }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : user ? (
              <div className="p-6 max-w-6xl mx-auto space-y-6">
                {/* Header Section */}
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                      Settings
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Manage your account settings and preferences
                    </p>
                  </div>
                  <button
                    onClick={toggleDarkMode}
                    className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                    title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                  >
                    {darkMode ? (
                      <Sun className="h-5 w-5 text-yellow-500" />
                    ) : (
                      <Moon className="h-5 w-5 text-slate-600" />
                    )}
                  </button>
                </div>

                {/* Tabs Navigation */}
                <div className="border-b border-slate-200 dark:border-slate-700">
                  <div className="flex gap-1">
                    <button
                      onClick={() => setActiveTab("personal")}
                      className={`cursor-pointer py-3 px-4 text-sm font-medium transition-colors border-b-2 ${
                        activeTab === "personal"
                          ? "border-primary text-primary"
                          : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Personal Info
                      </div>
                    </button>
                    {isAdmin() && (
                      <button
                        onClick={() => setActiveTab("notifications")}
                        className={`cursor-pointer py-3 px-4 text-sm font-medium transition-colors border-b-2 ${
                          activeTab === "notifications"
                            ? "border-primary text-primary"
                            : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4" />
                          Notification Config
                        </div>
                      </button>
                    )}
                  </div>
                </div>

                {/* Tab Content */}
                {activeTab === "personal" && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Employee Profile Card */}
                  {employee && (
                    <div className="lg:col-span-1">
                      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div
                          className={`bg-linear-to-br p-6 ${!darkMode ? "from-primary to-primary/80" : ""
                            }`}
                          style={darkMode ? {
                            background: `linear-gradient(to bottom right, ${complementaryColors.base}, ${complementaryColors.lighter})`
                          } : {}}
                        >
                          <div className="flex flex-col items-center">
                            {employee.image?.url ? (
                              <div className="relative w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-lg mb-4">
                                <Image
                                  src={`/${employee.image.url}`}
                                  alt={`${employee.first_name} ${employee.last_name || ""}`}
                                  fill
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center mb-4 border-4 border-white shadow-lg">
                                <UserCircle className="h-14 w-14 text-white" />
                              </div>
                            )}
                            <h2 className="text-2xl font-bold text-white text-center">
                              {employee.first_name} {employee.last_name || ""}
                            </h2>
                            {employee.role && (
                              <p className="text-white/90 text-base mt-2 font-medium">
                                {employee.role}
                              </p>
                            )}
                            {employee.employee_id && (
                              <p className="text-white/80 text-xs mt-1">
                                ID: {employee.employee_id}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="p-6 space-y-4">
                          {/* Date of Birth */}
                          {employee.dob && (
                            <div className="flex items-center gap-3 text-sm">
                              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                                  Date of Birth
                                </p>
                                <p className="text-slate-700 dark:text-slate-300 font-medium">
                                  {formatDate(employee.dob)}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Start Date with Days Count */}
                          {employee.join_date && (
                            <div className="flex items-center gap-3 text-sm">
                              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                                  Start Date
                                </p>
                                <div className="flex items-center gap-2">
                                  <p className="text-slate-700 dark:text-slate-300 font-medium">
                                    {formatDate(employee.join_date)}
                                  </p>
                                  {calculateDaysSinceStart(employee.join_date) && (
                                    <span
                                      className={`px-2 py-0.5 text-xs font-semibold rounded-full ${!darkMode ? "bg-primary/10 text-primary" : ""
                                        }`}
                                      style={darkMode ? {
                                        backgroundColor: complementaryColors.withAlpha20,
                                        color: complementaryColors.base
                                      } : {}}
                                    >
                                      {calculateDaysSinceStart(employee.join_date)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Email */}
                          {employee.email && (
                            <div className="flex items-center gap-3 text-sm">
                              <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                                  Email
                                </p>
                                <p className="text-slate-700 dark:text-slate-300 font-medium truncate">
                                  {employee.email}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Mobile Number */}
                          {employee.phone && (
                            <div className="flex items-center gap-3 text-sm">
                              <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                                  Mobile Number
                                </p>
                                <p className="text-slate-700 dark:text-slate-300 font-medium">
                                  {employee.phone}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Address */}
                          {employee.address && (
                            <div className="flex items-start gap-3 text-sm">
                              <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                                  Address
                                </p>
                                <p className="text-slate-700 dark:text-slate-300">
                                  {employee.address}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Account Settings Card */}
                  <div className={employee ? "lg:col-span-2" : "lg:col-span-3"}>
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${!darkMode ? "bg-primary/10" : ""
                              }`}
                            style={darkMode ? {
                              backgroundColor: complementaryColors.withAlpha20
                            } : {}}
                          >
                            <SettingsIcon
                              className={`h-5 w-5 ${!darkMode ? "text-primary" : ""
                                }`}
                              style={darkMode ? { color: complementaryColors.base } : {}}
                            />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                              Account Settings
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              Manage your account information
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 space-y-6">
                        {/* Username */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Username
                          </label>
                          <input
                            type="text"
                            value={user.username || ""}
                            disabled
                            className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 cursor-not-allowed"
                          />
                        </div>

                        {/* User Type */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            User Type
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="text"
                              value={user.user_type || ""}
                              disabled
                              className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 cursor-not-allowed capitalize"
                            />
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                            User type can only be changed by master-admin
                          </p>
                        </div>

                        {/* Active Status */}
                        <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                          <input
                            type="checkbox"
                            id="is_active"
                            checked={user.is_active ?? true}
                            disabled
                            className="w-4 h-4 text-primary bg-gray-100 dark:bg-slate-700 border-gray-300 dark:border-slate-600 rounded cursor-not-allowed"
                          />
                          <label
                            htmlFor="is_active"
                            className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-not-allowed flex-1"
                          >
                            Account Active
                          </label>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            (Can only be changed by master-admin)
                          </p>
                        </div>

                        {/* Password */}
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Password
                          </label>
                          <div className="flex items-center gap-3">
                            <input
                              type="password"
                              value="••••••••"
                              disabled
                              className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 cursor-not-allowed"
                            />
                            <button
                              onClick={handleResetPassword}
                              className={`cursor-pointer px-4 py-2.5 text-sm font-medium rounded-lg flex items-center gap-2 whitespace-nowrap transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl ${!darkMode ? "btn-primary" : ""
                                }`}
                              style={darkMode ? {
                                backgroundColor: complementaryColors.base,
                                color: complementaryColors.textColor
                              } : {}}
                              onMouseEnter={(e) => {
                                if (darkMode) {
                                  e.currentTarget.style.backgroundColor = complementaryColors.lighter;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (darkMode) {
                                  e.currentTarget.style.backgroundColor = complementaryColors.base;
                                }
                              }}
                            >
                              <Lock className="h-4 w-4" />
                              Change Password
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                )}

                {activeTab === "notifications" && (
                  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded-lg ${!darkMode ? "bg-primary/10" : ""}`}
                          style={darkMode ? {
                            backgroundColor: complementaryColors.withAlpha20
                          } : {}}
                        >
                          <Bell
                            className={`h-5 w-5 ${!darkMode ? "text-primary" : ""}`}
                            style={darkMode ? { color: complementaryColors.base } : {}}
                          />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                            Notification Preferences
                          </h2>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Choose which notifications you want to receive
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="p-6">
                      {notificationLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Loading notification preferences...
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Materials to Order Accordion */}
                          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <button
                              onClick={() => setExpandedMaterialsToOrder(!expandedMaterialsToOrder)}
                              className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                  Materials to Order
                                </h3>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  ({[notificationConfig.material_to_order, notificationConfig.material_to_order_ordered].filter(Boolean).length} enabled)
                                </span>
                              </div>
                              {expandedMaterialsToOrder ? (
                                <ChevronUp className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                              )}
                            </button>
                            {expandedMaterialsToOrder && (
                              <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                                <div className="p-4 space-y-3">
                                  {/* Materials to Order - Generated */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Materials to Order - Generated
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications when materials to order are generated
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.material_to_order}
                                        onChange={() => handleNotificationToggle("material_to_order")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>

                                  {/* Materials to Order - Ordered */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Materials to Order - Ordered
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications when materials from a supplier are fully ordered
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.material_to_order_ordered}
                                        onChange={() => handleNotificationToggle("material_to_order_ordered")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Stage Updates Accordion */}
                          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <button
                              onClick={() => setExpandedStages(!expandedStages)}
                              className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                  Stage Updates
                                </h3>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  ({Object.keys(notificationConfig).filter(key => key.startsWith('stage_') && notificationConfig[key]).length} enabled)
                                </span>
                              </div>
                              {expandedStages ? (
                                <ChevronUp className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                              )}
                            </button>
                            {expandedStages && (
                              <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                                <div className="p-4 space-y-3">
                                  {/* Quote Approve */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Quote Approve
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications when quotes are approved
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.stage_quote_approve}
                                        onChange={() => handleNotificationToggle("stage_quote_approve")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>

                                  {/* Material & Appliances Selection */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Material & Appliances Selection
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications for material and appliances selection updates
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.stage_material_appliances_selection}
                                        onChange={() => handleNotificationToggle("stage_material_appliances_selection")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>

                                  {/* Drafting */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Drafting
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications for drafting stage updates
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.stage_drafting}
                                        onChange={() => handleNotificationToggle("stage_drafting")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>

                                  {/* Drafting Revision */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Drafting Revision
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications for drafting revision updates
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.stage_drafting_revision}
                                        onChange={() => handleNotificationToggle("stage_drafting_revision")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>

                                  {/* Final Design Approval */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Final Design Approval
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications when final design is approved
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.stage_final_design_approval}
                                        onChange={() => handleNotificationToggle("stage_final_design_approval")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>

                                  {/* Site Measurements */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Site Measurements
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications for site measurements updates
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.stage_site_measurements}
                                        onChange={() => handleNotificationToggle("stage_site_measurements")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>

                                  {/* Final Approval for Production */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Final Approval for Production
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications when final approval for production is given
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.stage_final_approval_for_production}
                                        onChange={() => handleNotificationToggle("stage_final_approval_for_production")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>

                                  {/* Machining Out */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Machining Out
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications for machining out stage updates
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.stage_machining_out}
                                        onChange={() => handleNotificationToggle("stage_machining_out")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>

                                  {/* Material Order */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Material Order
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications when materials are ordered
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.stage_material_order}
                                        onChange={() => handleNotificationToggle("stage_material_order")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>

                                  {/* CNC */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        CNC
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications for CNC stage updates
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.stage_cnc}
                                        onChange={() => handleNotificationToggle("stage_cnc")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>

                                  {/* Assembly */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Assembly
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications for assembly stage updates
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.stage_assembly}
                                        onChange={() => handleNotificationToggle("stage_assembly")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>

                                  {/* Delivery */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Delivery
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications for delivery stage updates
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.stage_delivery}
                                        onChange={() => handleNotificationToggle("stage_delivery")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>

                                  {/* Installation */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Installation
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications for installation stage updates
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.stage_installation}
                                        onChange={() => handleNotificationToggle("stage_installation")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>

                                  {/* Invoice Sent */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Invoice Sent
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications when invoices are sent
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.stage_invoice_sent}
                                        onChange={() => handleNotificationToggle("stage_invoice_sent")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>

                                  {/* Maintenance */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Maintenance
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications for maintenance stage updates
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.stage_maintenance}
                                        onChange={() => handleNotificationToggle("stage_maintenance")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>

                                  {/* Job Completion */}
                                  <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-slate-800 dark:text-slate-200">
                                        Job Completion
                                      </h4>
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Receive notifications when jobs are completed
                                      </p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={notificationConfig.stage_job_completion}
                                        onChange={() => handleNotificationToggle("stage_job_completion")}
                                        disabled={isUpdatingNotifications}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                                    </label>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Stock Transactions */}
                          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex-1">
                              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                Stock Transactions
                              </h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Receive notifications about stock transactions
                              </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={notificationConfig.stock_transactions}
                                onChange={() => handleNotificationToggle("stock_transactions")}
                                disabled={isUpdatingNotifications}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                            </label>
                          </div>

                          {/* Supplier Statements */}
                          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                            <div className="flex-1">
                              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                Supplier Statements
                              </h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Receive notifications about supplier statements
                              </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={notificationConfig.supplier_statements}
                                onChange={() => handleNotificationToggle("supplier_statements")}
                                disabled={isUpdatingNotifications}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 dark:peer-focus:ring-primary/30 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Password Reset Modal */}
            {showPasswordModal && (
              <div className="fixed inset-0 backdrop-blur-xs bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full mx-4 border border-slate-200 dark:border-slate-700">
                  {/* Modal Header */}
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${!darkMode ? "bg-primary/10" : ""
                          }`}
                        style={darkMode ? {
                          backgroundColor: complementaryColors.withAlpha20
                        } : {}}
                      >
                        <Lock
                          className={`h-5 w-5 ${!darkMode ? "text-primary" : ""
                            }`}
                          style={darkMode ? { color: complementaryColors.base } : {}}
                        />
                      </div>
                      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        Change Password
                      </h2>
                    </div>
                    <button
                      onClick={handleClosePasswordModal}
                      className="cursor-pointer text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      disabled={isUpdating}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 space-y-4">
                    {/* Old Password */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showOldPassword ? "text" : "password"}
                          value={passwordData.oldPassword}
                          onChange={(e) =>
                            handlePasswordInputChange(
                              "oldPassword",
                              e.target.value
                            )
                          }
                          placeholder="Enter your current password"
                          disabled={isUpdating}
                          className="w-full px-4 py-2.5 pr-10 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:cursor-not-allowed bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                          className="absolute right-3 top-3 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          disabled={isUpdating}
                        >
                          {showOldPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={passwordData.newPassword}
                          onChange={(e) =>
                            handlePasswordInputChange(
                              "newPassword",
                              e.target.value
                            )
                          }
                          placeholder="Enter your new password"
                          disabled={isUpdating}
                          className="w-full px-4 py-2.5 pr-10 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:cursor-not-allowed bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-3 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          disabled={isUpdating}
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                        Password must be at least 6 characters long
                      </p>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3">
                    <button
                      onClick={handleClosePasswordModal}
                      disabled={isUpdating}
                      className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSavePassword}
                      disabled={isUpdating}
                      className={`cursor-pointer px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ${!darkMode ? "btn-primary" : ""
                        }`}
                      style={darkMode ? {
                        backgroundColor: complementaryColors.base,
                        color: complementaryColors.textColor
                      } : {}}
                      onMouseEnter={(e) => {
                        if (darkMode && !e.currentTarget.disabled) {
                          e.currentTarget.style.backgroundColor = complementaryColors.lighter;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (darkMode) {
                          e.currentTarget.style.backgroundColor = complementaryColors.base;
                        }
                      }}
                    >
                      {isUpdating ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminRoute>
  );
}
