"use client";

/**
 * Authentication Context Provider
 *
 * This is the main React context for authentication in the application.
 * It provides authentication state and methods through the useAuth() hook.
 *
 * For low-level token/cookie utilities, see ./auth.js
 *
 * Usage:
 *   const { isAuthenticated, login, logout, userData } = useAuth();
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  loginUser,
  logoutUser,
  restoreSession,
} from "@/state/action/loggedInUser";
import { getAuthToken } from "./auth";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const dispatch = useDispatch();
  const { userData, loading, error, isAuthenticated } = useSelector(
    (state) => state.loggedInUser,
  );
  const [isClient, setIsClient] = useState(false);

  // Ensure we're on the client side before running any effects
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize authentication on app start (only on client)
  useEffect(() => {
    if (isClient) {
      dispatch(restoreSession());
    }
  }, [dispatch, isClient]);

  const login = async (formdata) => {
    return await dispatch(loginUser(formdata));
  };

  const logout = async () => {
    const authToken = getAuthToken();
    return await dispatch(logoutUser(authToken));
  };

  // Helper functions to check user types
  const isAdmin = () => {
    return (
      userData?.user?.user_type === "admin" ||
      userData?.user?.user_type === "master-admin"
    );
  };

  const isMasterAdmin = () => {
    return userData?.user?.user_type === "master-admin";
  };

  const getUserType = () => {
    return userData?.user?.user_type || null;
  };

  const getUserData = () => {
    return userData;
  };

  // Get token from Redux state (since httpOnly cookies can't be accessed via JS)
  const getToken = () => {
    // First try to get from Redux state
    if (userData?.token) {
      return userData.token;
    }
    // Fallback to cookie (will be null due to httpOnly)
    return getAuthToken();
  };

  const value = {
    userData,
    loading,
    error,
    isAuthenticated,
    login,
    logout,
    isAdmin,
    isMasterAdmin,
    getUserType,
    getUserData,
    getToken,
    isLoggedIn: () => isAuthenticated,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
