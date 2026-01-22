import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  activeTab: "sheet",
  availableTabs: [
    "sheet",
    "sunmica",
    "edging_tape",
    "handle",
    "hardware",
    "accessory",
  ],
};

const inventoryTabsSlice = createSlice({
  name: "inventoryTabs",
  initialState,
  reducers: {
    setActiveTab: (state, action) => {
      if (state.availableTabs.includes(action.payload)) {
        state.activeTab = action.payload;
      }
    },
    resetToDefault: (state) => {
      state.activeTab = "sheet";
    },
  },
});

export const { setActiveTab, resetToDefault } = inventoryTabsSlice.actions;
export default inventoryTabsSlice.reducer;
