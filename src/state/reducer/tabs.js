import { createSlice } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

const initialState = {
  tabs: [
    {
      id: "/admin/dashboard",
      title: "Dashboard",
      href: "/admin/dashboard",
    },
  ],
  activeTab: {
    id: "/admin/dashboard",
    title: "Dashboard",
    href: "/admin/dashboard",
  },
};

const tabsSlice = createSlice({
  name: "tabs",
  initialState,
  reducers: {
    addTab: (state, action) => {
      const { id, title, href } = action.payload;
      state.tabs.push({ id, title, href });
    },
    replaceTab: (state, action) => {
      const { id, title, href } = action.payload;

      // Find the current active tab
      const currentActiveTab = state.tabs.find(
        (tab) => tab.id === state.activeTab.id,
      );

      // If there's an active tab, replace it with the new one
      if (currentActiveTab) {
        const activeTabIndex = state.tabs.findIndex(
          (tab) => tab.id === state.activeTab.id,
        );
        state.tabs[activeTabIndex] = { id, title, href };
        state.activeTab = { id, title, href };
      } else {
        // If no active tab, just add the new tab
        state.tabs.push({ id, title, href });
        state.activeTab = { id, title, href };
      }
    },
    closeTab: (state, action) => {
      const id = action.payload;
      state.tabs = state.tabs.filter((t) => t.id !== id);
      if (state.activeTab.id === id && state.tabs.length > 0) {
        state.activeTab = state.tabs[state.tabs.length - 1];
      }
      if (state.tabs.length === 0) {
        state.tabs = [
          {
            id: uuidv4(),
            title: "Dashboard",
            href: "/admin/dashboard",
          },
        ];
        state.activeTab = state.tabs[0];
      }
    },
    setActiveTab: (state, action) => {
      state.activeTab = action.payload;
    },
  },
});

export const { addTab, closeTab, setActiveTab, replaceTab } = tabsSlice.actions;
export default tabsSlice.reducer;
