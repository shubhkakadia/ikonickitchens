"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";
import axios from "axios";
import { ShieldX, Lock, ArrowLeft, Mail, LogOut, RefreshCw } from 'lucide-react';

export default function ProtectedRoute({
  children,
  requiredUserType,
  fallback,
  redirectTo = "/login",
}) {
  const router = useRouter();
  const { isAuthenticated, getUserType, loading } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);


  useEffect(() => {
    const checkAuth = () => {
      // If still loading user data, wait 
      if (loading) {
        return;
      }

      // Check if user is authenticated
      if (!isAuthenticated) {
        router.push(redirectTo);
        return;
      }

      // If no specific user type required, just check authentication
      if (!requiredUserType) {
        setIsAuthorized(true);
        setIsLoading(false);
        return;
      }

      // Check if user has the required user type
      const userType = getUserType();
      const hasAccess = checkUserTypeAccess(userType, requiredUserType);

      if (!hasAccess) {
        router.push(redirectTo);
        return;
      }

      setIsAuthorized(true);
      setIsLoading(false);
    };

    checkAuth();
  }, [
    isAuthenticated,
    getUserType,
    loading,
    requiredUserType,
    router,
    redirectTo,
  ]);

  // Helper function to check user type access
  const checkUserTypeAccess = (userType, required) => {
    if (!userType || !required) return false;

    // If required is an array, check if user type is in the array
    if (Array.isArray(required)) {
      return required.includes(userType);
    }

    // Direct match
    return userType === required;
  };

  // Show loading state
  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Show children if authorized
  return isAuthorized ? children : null;
}

function AccessDenied({ pathname }) {
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6">
            <ShieldX className="w-10 h-10 text-red-600" />
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Access Denied
          </h1>

          {/* Description */}
          <p className="text-gray-600 mb-2">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            If you believe this is an error, please contact your administrator.
          </p>

          {/* Current Page Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-8">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <Lock className="w-4 h-4" />
              <span className="font-mono text-xs">{pathname}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 flex flex-col">
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => window.location.reload()}
                className="cursor-pointer w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Access
              </button>
              <button
                onClick={() => window.location.href = '/admin/dashboard'}
                className="cursor-pointer w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors duration-200"
              >
                Return to Dashboard
              </button>
            </div>

            <button
              onClick={() => logout().then(() => router.push('/admin/login'))}
              className="cursor-pointer text-red-600 hover:text-red-700 font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>

          </div>

          {/* Contact Support */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-3">Need access?</p>

            <a href="mailto:info@ikonickitchens.com.au"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
            >
              <Mail className="w-4 h-4" />
              Contact Administrator
            </a>
          </div>
        </div>

        {/* Footer Info */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Error Code: 403 - Forbidden
        </p>
      </div>
    </div>
  );
}

// Loading Component
function LoadingAccess() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mb-4"></div>
        <p className="text-gray-600 font-medium">Checking permissions...</p>
      </div>
    </div>
  );
}

// Convenience components for specific user types
export function AdminRoute({
  children,
  redirectTo = "/admin/login",
  fallback,
}) {
  const { getUserData, getToken } = useAuth();
  const [moduleAccess, setModuleAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const siteMap = {
    "/admin/dashboard": "dashboard",
    "/admin/clients": "all_clients",
    "/admin/clients/addclient": "add_clients",
    "/admin/clients/[id]": "client_details",
    "/admin/employees": "all_employees",
    "/admin/employees/addemployee": "add_employees",
    "/admin/employees/[id]": "employee_details",
    "/admin/projects": "all_projects",
    "/admin/projects/addproject": "add_projects",
    "/admin/projects/[id]": "project_details",
    "/admin/projects/lotatglance": "lotatglance",
    "/admin/suppliers": "all_suppliers",
    "/admin/suppliers/addsupplier": "add_suppliers",
    "/admin/suppliers/[id]": "supplier_details",
    "/admin/suppliers/materialstoorder": "materialstoorder",
    "/admin/suppliers/purchaseorder": "purchaseorder",
    "/admin/suppliers/statements": "statements",
    "/admin/inventory/usedmaterial": "usedmaterial",
    "/admin/logs": "logs",
    "/admin/deletefiles": "deletedmedia",
    "/admin/inventory": "all_items",
    "/admin/inventory/additem": "add_items",
    "/admin/inventory/[id]": "item_details",
  };

  useEffect(() => {
    const fetchModuleAccess = async () => {
      const user = getUserData();
      const userId = user.user.id;
      try {
        const response = await axios.get(`/api/module_access/${userId}`, {
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
        });
        if (response.data.status) {
          setModuleAccess(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching module access:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchModuleAccess();
  }, []);

  const pathname = window.location.pathname;
  const key = siteMap[pathname];
  const access = moduleAccess?.[key];

  if (pathname === '/admin' && getUserData() !== null) {
    router.push('/admin/dashboard');
  }
  else if (pathname === '/admin' && getUserData() === null) {
    router.push('/admin/login');
  }

  useEffect(() => {
    // set timeout for 10 seconds
    if (loading) {
    setTimeout(() => {
        setLoading(false);
      }, 10000);
    }
  }, [loading]);

  // Show loading state
  if (loading) {
    return <LoadingAccess />;
  }

  // Show access denied UI
  if (!access) {
    return <AccessDenied pathname={pathname} />;
  }

  // User has access - render protected content
  return (
    <ProtectedRoute
      requiredUserType={["admin", "master-admin"]}
      redirectTo={redirectTo}
      fallback={fallback}
    >
      {children}
    </ProtectedRoute>
  );
}

export function MasterAdminRoute({
  children,
  redirectTo = "/admin/login",
  fallback,
}) {
  return (
    <ProtectedRoute
      requiredUserType="master-admin"
      redirectTo={redirectTo}
      fallback={fallback}
    >
      {children}
    </ProtectedRoute>
  );
}
