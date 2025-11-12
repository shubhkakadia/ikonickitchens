import { getCookie, setCookie, deleteCookie } from "cookies-next";

/**
 * Authentication utility functions for token/cookie management.
 * 
 * NOTE: This is a utility file, not a React context.
 * For React context and hooks, use AuthContext.jsx and the useAuth() hook.
 * 
 * This file provides low-level cookie/token management functions that are used
 * by both the AuthContext and Redux actions for authentication state management.
 */

// Cookie configuration for 1-month expiry
const COOKIE_OPTIONS = {
  maxAge: 30 * 24 * 60 * 60, // 1 month in seconds
  path: "/",
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  httpOnly: false, // Allow client-side access for logout functionality
};

/**
 * Set authentication token in cookie
 * @param {string} token - The authentication token to store
 */
export const setAuthToken = (token) => {
  setCookie("auth_token", token, COOKIE_OPTIONS);
};

/**
 * Get authentication token from cookie
 * @returns {string|null} The authentication token or null if not found
 */
export const getAuthToken = () => {
  // Check if we're on the client side to avoid SSR issues
  if (typeof window === "undefined") {
    return null;
  }
  return getCookie("auth_token") || null;
};

/**
 * Clear authentication token from cookie
 */
export const clearAuthToken = () => {
  deleteCookie("auth_token");
};

/**
 * Check if user has a valid session (token exists)
 * @returns {boolean} True if a valid token exists, false otherwise
 */
export const hasValidSession = () => {
  // Check if we're on the client side to avoid SSR issues
  if (typeof window === "undefined") {
    return false;
  }
  return !!getAuthToken();
};
