import { configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";
import loggedInUser from "../reducer/loggedInUser";
import { combineReducers } from "redux";
import tabs from "../reducer/tabs";
import xero from "../reducer/xeroCredentials";
import sidebar from "../reducer/sidebar";
import inventoryTabs from "../reducer/inventoryTabs";
import projectTabs from "../reducer/projectTabs";

const rootReducer = combineReducers({
  loggedInUser: loggedInUser,
  tabs: tabs,
  xero: xero,
  sidebar: sidebar,
  inventoryTabs: inventoryTabs,
  projectTabs: projectTabs,
});

const persistConfig = {
  key: "root",
  storage,
  // Prevent rehydration issues by not persisting during SSR
  skipHydration: typeof window === "undefined",
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export const persistor = persistStore(store);
