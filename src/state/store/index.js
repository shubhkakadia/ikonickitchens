import { configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";
import loggedInUser from "../reducer/loggedInUser";
import { combineReducers } from "redux";
import tabs from "../reducer/tabs";

const rootReducer = combineReducers({
  loggedInUser: loggedInUser,
  tabs: tabs,
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
