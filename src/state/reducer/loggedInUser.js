import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  userData: null,
  loading: false,
  error: null,
  isAuthenticated: false,
};

const loggedInUser = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUserSuccess: (state, action) => {
      state.userData = action.payload;
      state.isAuthenticated = true;
      state.loading = false;
      state.error = null;
    },
    setUserLoading: (state, action) => {
      state.loading = action.payload;
    },
    setUserError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    clearUserData: (state) => {
      state.userData = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;
    },
  },
});

export const { setUserSuccess, setUserLoading, setUserError, clearUserData } =
  loggedInUser.actions;

export default loggedInUser.reducer;
