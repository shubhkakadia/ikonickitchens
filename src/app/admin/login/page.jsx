"use client";
import Navbar from "@/components/Navbar";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  XCircle,
  Phone,
  Mail as MailIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import versions from "@/config/versions.json";
import Footer from "@/components/footer";

export default function page() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [focusedFields, setFocusedFields] = useState({});
  const [errorType, setErrorType] = useState(null); // 'not_found', 'inactive', 'invalid_password', 'rate_limit'
  const [retryAfter, setRetryAfter] = useState(null); // Store retry seconds
  const { login, isAuthenticated, getUserType, loading } = useAuth();

  useEffect(() => {
    if (isAuthenticated && !loading) {
      const userType = getUserType();
      if (userType === "admin" || userType === "master-admin") {
        router.push("/admin/dashboard");
      }
    }
  }, [isAuthenticated, getUserType, loading, router]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
    // Clear error type and general errors when user starts typing
    if (errorType) {
      setErrorType(null);
      setErrors({});
    }
  };

  const handleFocus = (fieldName) => {
    setFocusedFields((prev) => ({
      ...prev,
      [fieldName]: true,
    }));
  };

  const handleBlur = (fieldName) => {
    setFocusedFields((prev) => ({
      ...prev,
      [fieldName]: false,
    }));
  };
  const isFieldActive = (fieldName) => {
    return focusedFields[fieldName] || formData[fieldName];
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username) {
      newErrors.username = "username is required";
    }
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setErrorType(null);
    setErrors({});

    try {
      // Use the new Redux-based login function
      const result = await login(formData);

      if (result.success) {
        // Redirect based on user_type from the stored user data
        const userType = result.data?.data?.user?.user_type;
        if (userType === "admin" || userType === "master-admin") {
          router.push("/admin/dashboard");
        } else {
          router.push("/");
        }
      } else {
        // Handle different error types based on the message
        const errorMessage = result.error || "Login failed. Please try again.";

        // Check for rate limiting with retryAfter
        if (result.retryAfter) {
          setErrorType("rate_limit");
          setRetryAfter(result.retryAfter);
        } else if (
          errorMessage === "User not found" ||
          errorMessage === "Invalid password"
        ) {
          setErrorType("invalid_credentials");
        } else if (errorMessage === "User account is not active") {
          setErrorType("inactive");
        } else if (
          errorMessage.includes("Too many") ||
          errorMessage.includes("rate limit")
        ) {
          // Fallback check for rate limiting messages
          setErrorType("rate_limit");
          // Try to extract seconds from error message if retryAfter not in result
          const match = errorMessage.match(/(\d+)\s*second/i);
          if (match) {
            setRetryAfter(parseInt(match[1]));
          }
        } else {
          setErrorType("general");
          setErrors({
            general: errorMessage,
          });
        }
      }
    } catch (error) {
      console.error("Login error:", error);
      setErrorType("network");
      setErrors({
        general: "Network error. Please check your connection and try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#B92F34] mx-auto mb-4"></div>
          <p className="text-white text-lg font-medium">
            Loading Admin Portal...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex flex-col">
      <Navbar bar={true} />
      <div className="flex justify-center items-center h-screen px-4">
        <div className="max-w-md w-full space-y-8">
          {/* Admin Header */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-slate-600 mb-2">
              Admin Portal
            </h2>
            <p className="text-slate-600 text-sm">
              Secure access to Ikoniq Kitchen & Cabinet administration
            </p>
          </div>

          {/* Login Form */}
          <div className="bg-slate-50 backdrop-blur-lg rounded-2xl border border-slate-200 p-8 shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* username Field */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={formData.username}
                  onChange={handleInputChange}
                  onFocus={() => handleFocus("username")}
                  onBlur={() => handleBlur("username")}
                  className={`bg-slate-200 backdrop-blur-sm block w-full pl-12 pr-4 py-4 border border-slate-400 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition duration-200 text-slate-600 ${
                    errors.username
                      ? "border-red-400 focus:ring-red-500 focus:border-red-500"
                      : ""
                  }`}
                />
                <label
                  htmlFor="username"
                  className={`absolute left-12 transition-all duration-200 pointer-events-none z-10 ${
                    isFieldActive("username")
                      ? "top-0 text-xs text-slate-600 bg-slate-50 px-1 -mt-2 rounded"
                      : "top-4 text-sm text-slate-600"
                  }`}
                >
                  Enter Admin Username
                </label>
                {errors.username && (
                  <p className="mt-2 text-sm text-red-400">{errors.username}</p>
                )}
              </div>

              {/* Password Field */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  onFocus={() => handleFocus("password")}
                  onBlur={() => handleBlur("password")}
                  className={`bg-slate-200 backdrop-blur-sm block w-full pl-12 pr-12 py-4 border border-slate-400 rounded-xl focus:ring-2 focus:ring-slate-500 focus:border-slate-500 outline-none transition duration-200 text-slate-600 ${
                    errors.password
                      ? "border-red-400 focus:ring-red-500 focus:border-red-500"
                      : ""
                  }`}
                />
                <label
                  htmlFor="password"
                  className={`absolute left-12 transition-all duration-200 pointer-events-none z-10 ${
                    isFieldActive("password")
                      ? "top-0 text-xs text-slate-600 bg-slate-50 px-1 -mt-2 rounded"
                      : "top-4 text-sm text-slate-600"
                  }`}
                >
                  Enter Password
                </label>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                  <button
                    type="button"
                    className="flex items-center justify-center w-6 h-6 cursor-pointer hover:bg-slate-200 rounded-full p-1 transition duration-200"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                    ) : (
                      <Eye className="h-5 w-5 text-slate-400 hover:text-slate-600" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-2 text-sm text-red-400">{errors.password}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-4 px-6 border border-transparent text-base font-semibold rounded-xl text-white bg-linear-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 shadow-lg hover:shadow-xl cursor-pointer"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Authenticating...
                  </div>
                ) : (
                  <div className="flex items-center">
                    Access Admin Portal
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                  </div>
                )}
              </button>
            </form>

            {/* Professional Error Messages */}
            {errorType && (
              <div className="mt-6">
                {errorType === "rate_limit" && (
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start">
                      <div className="shrink-0">
                        <AlertCircle className="h-6 w-6 text-orange-500" />
                      </div>
                      <div className="ml-3 flex-1">
                        <h3 className="text-sm font-semibold text-orange-800 mb-2">
                          Too Many Login Attempts
                        </h3>
                        <p className="text-sm text-orange-700 mb-3">
                          Your account has been temporarily locked due to
                          multiple failed login attempts.
                        </p>
                        {retryAfter && (
                          <div className="bg-orange-100 rounded-lg p-4">
                            <p className="text-sm font-medium text-orange-800 mb-1">
                              Please wait before trying again:
                            </p>
                            <div className="flex items-center mt-2">
                              <div className="bg-orange-200 rounded-lg px-4 py-2">
                                <span className="text-2xl font-bold text-orange-900">
                                  {retryAfter}
                                </span>
                                <span className="text-sm text-orange-700 ml-2">
                                  {retryAfter === 1 ? "second" : "seconds"}
                                </span>
                              </div>
                            </div>
                            <p className="text-xs text-orange-600 mt-3">
                              This security measure protects your account from
                              unauthorized access attempts.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {errorType === "invalid_credentials" && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start">
                      <div className="shrink-0">
                        <XCircle className="h-6 w-6 text-red-500" />
                      </div>
                      <div className="ml-3 flex-1">
                        <h3 className="text-sm font-semibold text-red-800 mb-2">
                          Authentication Failed
                        </h3>
                        <p className="text-sm text-red-700 mb-3">
                          Username or password is incorrect. Please check your
                          credentials and try again.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {errorType === "inactive" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start">
                      <div className="shrink-0">
                        <AlertCircle className="h-6 w-6 text-amber-500" />
                      </div>
                      <div className="ml-3 flex-1">
                        <h3 className="text-sm font-semibold text-amber-800 mb-2">
                          Account Inactive
                        </h3>
                        <p className="text-sm text-amber-700 mb-3">
                          Your admin account is currently inactive. Please
                          contact support to reactivate your account.
                        </p>
                        <div className="bg-amber-100 rounded-lg p-4">
                          <p className="text-sm font-medium text-amber-800 mb-2">
                            Contact Support:
                          </p>
                          <div className="space-y-1 text-sm text-amber-700">
                            <div className="flex items-center">
                              <Phone className="h-4 w-4 mr-2" />
                              <span>(08) 7112 8462</span>
                            </div>
                            <div className="flex items-center">
                              <MailIcon className="h-4 w-4 mr-2" />
                              <span>info@ikonickitchens.com</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {errorType === "network" && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start">
                      <div className="shrink-0">
                        <AlertCircle className="h-6 w-6 text-gray-500" />
                      </div>
                      <div className="ml-3 flex-1">
                        <h3 className="text-sm font-semibold text-gray-800 mb-2">
                          Connection Error
                        </h3>
                        <p className="text-sm text-gray-700 mb-3">
                          {errors.general}
                        </p>
                        <div className="text-xs text-gray-600">
                          <p>• Check your internet connection</p>
                          <p>• Try refreshing the page</p>
                          <p>• Contact support if the issue persists</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {errorType === "general" && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-start">
                      <div className="shrink-0">
                        <XCircle className="h-6 w-6 text-red-500" />
                      </div>
                      <div className="ml-3 flex-1">
                        <h3 className="text-sm font-semibold text-red-800 mb-2">
                          Login Error
                        </h3>
                        <p className="text-sm text-red-700">{errors.general}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Back to Home */}
          <div className="text-center">
            <Link
              href="/"
              className="text-slate-400 hover:text-slate-600 text-sm font-medium transition duration-200 cursor-pointer flex items-center justify-center"
            >
              <ArrowRight className="h-4 w-4 mr-2 rotate-180" />
              Back to Website
            </Link>
          </div>

          {/* Version Indicator */}
          <p className="text-xs text-slate-400 text-center mt-4">
            v{versions.version}
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
