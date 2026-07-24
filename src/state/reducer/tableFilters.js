import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  byUser: {},
};

const tableFiltersSlice = createSlice({
  name: "tableFilters",
  initialState,
  reducers: {
    setTableFilter: (state, action) => {
      const { userId, tableKey, field, value } = action.payload;
      if (!userId || !tableKey || !field) return;

      state.byUser[userId] ??= {};
      state.byUser[userId][tableKey] ??= {};
      state.byUser[userId][tableKey][field] = value;
    },
    setTableFilters: (state, action) => {
      const { userId, tableKey, filters } = action.payload;
      if (!userId || !tableKey || !filters) return;

      state.byUser[userId] ??= {};
      state.byUser[userId][tableKey] = {
        ...(state.byUser[userId][tableKey] || {}),
        ...filters,
      };
    },
    clearTableFilter: (state, action) => {
      const { userId, tableKey, field } = action.payload;
      const table = state.byUser[userId]?.[tableKey];
      if (!userId || !tableKey || !field || !table) return;

      delete table[field];
      if (Object.keys(table).length === 0) {
        delete state.byUser[userId][tableKey];
      }
      if (Object.keys(state.byUser[userId]).length === 0) {
        delete state.byUser[userId];
      }
    },
    clearTableFilters: (state, action) => {
      const { userId, tableKey } = action.payload;
      if (!userId || !tableKey || !state.byUser[userId]) return;

      delete state.byUser[userId][tableKey];
      if (Object.keys(state.byUser[userId]).length === 0) {
        delete state.byUser[userId];
      }
    },
  },
});

export const {
  setTableFilter,
  setTableFilters,
  clearTableFilter,
  clearTableFilters,
} = tableFiltersSlice.actions;

export const selectTableFilters = (state, userId, tableKey) =>
  state.tableFilters.byUser[userId]?.[tableKey] || {};

export default tableFiltersSlice.reducer;
