"use client";
import React, { useState, useEffect, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
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
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Image from "next/image";
import chroma from "chroma-js";

export default function SettingsPage() {
  const { userData, getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [employee, setEmployee] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
  });

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
    }
  }, [userData]);

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

                {/* Warning Banner */}
                {/* <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      Contact Administrator to Change Your Details
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      If you need to update any of your personal information, account settings, or employee details, please contact your system administrator.
                    </p>
                  </div>
                </div> */}

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
              </div>
            ) : null}

            {/* Password Reset Modal */}
            {showPasswordModal && (
              <div className="fixed inset-0 backdrop-blur-sm bg-black/50 flex items-center justify-center z-50">
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
        theme={darkMode ? "dark" : "light"}
      />
    </AdminRoute>
  );
}
