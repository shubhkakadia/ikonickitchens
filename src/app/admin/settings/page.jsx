"use client";
import React, { useState, useEffect } from "react";
import Sidebar from "@/components/sidebar";
import CRMLayout from "@/components/tabs";
import { AdminRoute } from "@/components/ProtectedRoute";
import { AlertTriangle, Eye, EyeOff, User, Lock, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function SettingsPage() {
  const { userData, getToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
  });

  useEffect(() => {
    if (userData?.user?.id) {
      fetchUserDetails();
    }
  }, [userData]);

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

      // First verify old password by calling a verification endpoint or including it in the update
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
        // Refresh user details
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

  // Parse module_access for display
  let parsedModuleAccess = {};
  if (user?.module_access) {
    try {
      parsedModuleAccess = JSON.parse(user.module_access);
    } catch (e) {
      console.error("Error parsing module access:", e);
    }
  }

  const modules = [
    "dashboard",
    "employees",
    "clients",
    "projects",
    "suppliers",
    "inventory",
    "finance",
  ];

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
                  <p className="text-sm text-slate-600 font-medium">
                    Loading settings details...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                  <p className="text-sm text-red-600 mb-4 font-medium">
                    {error}
                  </p>
                  <button
                    onClick={() => fetchUserDetails()}
                    className="cursor-pointer btn-primary px-4 py-2 text-sm font-medium rounded-lg"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : user ? (
              <div className="p-6 max-w-4xl mx-auto">
                <div className="bg-white rounded-lg shadow-sm border border-slate-200">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold text-slate-800">
                          User Settings
                        </h1>
                        <p className="text-sm text-slate-500">
                          View your account details and manage your password
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 space-y-6">
                    {/* Username */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        value={user.username || ""}
                        disabled
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                      />
                    </div>

                    {/* User Type */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        User Type
                      </label>
                      <input
                        type="text"
                        value={user.user_type || ""}
                        disabled
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed capitalize"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        User type can only be changed by master-admin
                      </p>
                    </div>

                    {/* Active Status */}
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={user.is_active ?? true}
                        disabled
                        className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded cursor-not-allowed"
                      />
                      <label
                        htmlFor="is_active"
                        className="text-sm font-medium text-slate-500 cursor-not-allowed"
                      >
                        Account Active
                      </label>
                      <p className="text-xs text-slate-500">
                        (Can only be changed by master-admin)
                      </p>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Password
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="password"
                          value="••••••••"
                          disabled
                          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                        />
                        <button
                          onClick={handleResetPassword}
                          className="cursor-pointer btn-primary px-4 py-2 text-sm font-medium rounded-lg flex items-center gap-2"
                        >
                          <Lock className="h-4 w-4" />
                          Reset Password
                        </button>
                      </div>
                    </div>

                    {/* Module Access */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">
                        Module Access
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {modules.map((module) => (
                          <div key={module} className="flex items-center">
                            <input
                              type="checkbox"
                              id={`module_${module}`}
                              checked={parsedModuleAccess[module] === "true"}
                              disabled
                              className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded cursor-not-allowed"
                            />
                            <label
                              htmlFor={`module_${module}`}
                              className="ml-2 text-sm capitalize text-slate-500 cursor-not-allowed"
                            >
                              {module}
                            </label>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        Module access can only be changed by master-admin
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Password Reset Modal */}
            {showPasswordModal && (
              <div className="fixed inset-0 backdrop-blur-xs bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                  {/* Modal Header */}
                  <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Lock className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-xl font-bold text-slate-800">
                        Reset Password
                      </h2>
                    </div>
                    <button
                      onClick={handleClosePasswordModal}
                      className="cursor-pointer text-slate-500 hover:text-slate-700"
                      disabled={isUpdating}
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 space-y-4">
                    {/* Old Password */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
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
                          className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-slate-50 disabled:cursor-not-allowed"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                          className="absolute right-3 top-3 text-slate-500 hover:text-slate-700"
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
                      <label className="block text-sm font-medium text-slate-700 mb-2">
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
                          className="w-full px-4 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary disabled:bg-slate-50 disabled:cursor-not-allowed"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-3 text-slate-500 hover:text-slate-700"
                          disabled={isUpdating}
                        >
                          {showNewPassword ? (
                            <EyeOff className="h-5 w-5" />
                          ) : (
                            <Eye className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Password must be at least 6 characters long
                      </p>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
                    <button
                      onClick={handleClosePasswordModal}
                      disabled={isUpdating}
                      className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSavePassword}
                      disabled={isUpdating}
                      className="cursor-pointer btn-primary px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isUpdating ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <ToastContainer />
    </AdminRoute>
  );
}
