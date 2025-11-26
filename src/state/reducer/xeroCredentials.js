import { createSlice } from "@reduxjs/toolkit";

const xeroSlice = createSlice({
  name: "xero",
  initialState: {
    access_token: null,
    expires_at: null, // timestamp
  },
  reducers: {
    setXeroToken(state, action) {
      state.access_token = action.payload.access_token;
      state.expires_at = action.payload.expires_at;
    },
  },
});

export const { setXeroToken } = xeroSlice.actions;
export default xeroSlice.reducer;
