import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  activeTab: "active",
  availableTabs: ["active", "completed", "cancelled"],
};

const projectTabsSlice = createSlice({
  name: "projectTabs",
  initialState,
  reducers: {
    setActiveTab: (state, action) => {
      if (state.availableTabs.includes(action.payload)) {
        state.activeTab = action.payload;
      }
    },
    resetToDefault: (state) => {
      state.activeTab = "active";
    },
  },
});

export const { setActiveTab, resetToDefault } = projectTabsSlice.actions;
export default projectTabsSlice.reducer;
