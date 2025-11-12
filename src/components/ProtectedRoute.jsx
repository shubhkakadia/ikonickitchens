"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";

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
      )
  }

  // Show children if authorized
  return isAuthorized ? children : null;
}

// Convenience components for specific user types
export function AdminRoute({ children, redirectTo = "/admin/login", fallback }) {
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

export function MasterAdminRoute({ children, redirectTo = "/admin/login", fallback }) {
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
