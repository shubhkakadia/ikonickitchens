import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  isPinned: false,
  projectDropdownOpen: true,
  suppliersDropdownOpen: true,
  inventoryDropdownOpen: true,
};

const sidebarSlice = createSlice({
  name: "sidebar",
  initialState,
  reducers: {
    togglePinned: (state) => {
      state.isPinned = !state.isPinned;
    },
    setPinned: (state, action) => {
      state.isPinned = action.payload;
    },
    toggleProjectDropdown: (state) => {
      state.projectDropdownOpen = !state.projectDropdownOpen;
    },
    toggleSuppliersDropdown: (state) => {
      state.suppliersDropdownOpen = !state.suppliersDropdownOpen;
    },
    toggleInventoryDropdown: (state) => {
      state.inventoryDropdownOpen = !state.inventoryDropdownOpen;
    },
    setProjectDropdown: (state, action) => {
      state.projectDropdownOpen = action.payload;
    },
    setSuppliersDropdown: (state, action) => {
      state.suppliersDropdownOpen = action.payload;
    },
    setInventoryDropdown: (state, action) => {
      state.inventoryDropdownOpen = action.payload;
    },
  },
});

export const {
  togglePinned,
  setPinned,
  toggleProjectDropdown,
  toggleSuppliersDropdown,
  toggleInventoryDropdown,
  setProjectDropdown,
  setSuppliersDropdown,
  setInventoryDropdown,
} = sidebarSlice.actions;

export default sidebarSlice.reducer;
