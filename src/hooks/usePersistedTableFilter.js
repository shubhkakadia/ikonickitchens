"use client";

import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  clearTableFilter,
  clearTableFilters,
  setTableFilter,
  setTableFilters,
} from "@/state/reducer/tableFilters";

export function usePersistedTableFilter(tableKey, field, defaultValue) {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.loggedInUser.userData?.user?.id);
  const storedValue = useSelector(
    (state) => state.tableFilters.byUser[userId]?.[tableKey]?.[field],
  );
  const value =
    Array.isArray(storedValue) &&
    Array.isArray(defaultValue) &&
    defaultValue.length > 0
      ? storedValue.filter((item) => defaultValue.includes(item))
      : storedValue === undefined
        ? defaultValue
        : storedValue;

  const setValue = useCallback(
    (nextValue) => {
      if (!userId) return;
      const resolvedValue =
        typeof nextValue === "function" ? nextValue(value) : nextValue;
      if (JSON.stringify(resolvedValue) === JSON.stringify(defaultValue)) {
        dispatch(clearTableFilter({ userId, tableKey, field }));
        return;
      }
      dispatch(
        setTableFilter({
          userId,
          tableKey,
          field,
          value: resolvedValue,
        }),
      );
    },
    [defaultValue, dispatch, field, tableKey, userId, value],
  );

  return [value, setValue, storedValue !== undefined];
}

export function useTableFilterActions(tableKey) {
  const dispatch = useDispatch();
  const userId = useSelector((state) => state.loggedInUser.userData?.user?.id);

  const updateFilters = useCallback(
    (filters) => {
      if (userId) {
        dispatch(setTableFilters({ userId, tableKey, filters }));
      }
    },
    [dispatch, tableKey, userId],
  );

  const resetFilters = useCallback(() => {
    if (userId) {
      dispatch(clearTableFilters({ userId, tableKey }));
    }
  }, [dispatch, tableKey, userId]);

  return { updateFilters, resetFilters };
}
