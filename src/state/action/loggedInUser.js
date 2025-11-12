import axios from "axios";
import {
  setUserSuccess,
  setUserLoading,
  setUserError,
  clearUserData,
} from "../reducer/loggedInUser";
import {
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  hasValidSession,
} from "../../contexts/auth";
import { getBaseUrl } from "@/lib/baseUrl";

// Action to handle user login
export const loginUser = (formdata) => async (dispatch) => {
  dispatch(setUserLoading(true));
  dispatch(setUserError(null));

  try {
    const response = await signinAPI(formdata);

    if (response.data.status) {
      const userData = response.data.data;

      // Store only token in cookies with 7-day expiry
      setAuthToken(userData.token);

      // Verify token was stored
      const storedToken = getAuthToken();

      // Store the complete user data in Redux
      dispatch(setUserSuccess(userData));

      return { success: true, data: response.data };
    } else {
      dispatch(setUserError(response.data.message || "Login failed"));
      return { success: false, error: response.data.message };
    }
  } catch (error) {
    const errorMessage =
      error.response?.data?.message || error.message || "Login failed";
    dispatch(setUserError(errorMessage));
    return { success: false, error: errorMessage };
  } finally {
    dispatch(setUserLoading(false));
  }
};

// Action to handle user logout
export const logoutUser = (token = null) =>
  async (dispatch) => {
    dispatch(setUserLoading(true));

    // Use provided token or get from cookies
    const authToken = token || getAuthToken();

    try {
      if (authToken) {
        
        const response = await axios.post(
          `/api/signout`,
          {}, // empty body (since fetch POST has no body)
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        const data = await response.data;

        if (data.status) {
          console.log("Signout successful:", data.message);
        } else {
          console.error("Signout failed:", data.message);
        }
      } else {
        console.warn("No auth token found for logout - clearing local state only");
      }
    } catch (error) {
      console.error("Signout API error:", error);
    } finally {
      // Clear both cookie and Redux state regardless of API success
      clearAuthToken();
      dispatch(clearUserData());
      dispatch(setUserLoading(false));
    }
  };

// Action to restore user session from cookies (on app start)
export const restoreSession = () => async (dispatch) => {
  // Check if token cookie exists
  if (hasValidSession()) {
    // Token exists, but we need to get user data from Redux or make API call
    // For now, we'll rely on the fact that if user is on protected routes,
    // they must have logged in and userData should be in Redux
    console.log("Valid session found, user can proceed");
    return true;
  } else {
    // No token cookie, user needs to login
    console.log("No valid session, user needs to login");
    return false;
  }
};

// Action to set user data directly (for cases like token refresh)
export const setUser = (userData) => (dispatch) => {
  dispatch(setUserSuccess(userData));
};

// Action to clear user data
export const clearUser = () => (dispatch) => {
  clearAuthToken();
  dispatch(clearUserData());
};

// Signin API function
const signinAPI = async (formdata) => {
  try {
    let data = JSON.stringify({
      username: formdata.username,
      password: formdata.password,
    });

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `${getBaseUrl()}/api/signin`,
      headers: {
        "Content-Type": "application/json",
      },
      data: data,
    };

    return await axios.request(config);
  } catch (error) {
    console.error("Login API error:", error);
    throw error;
  }
};
