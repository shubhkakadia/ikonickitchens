"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";

const POLL_INTERVAL_MS = 30000;

// State and actions for the updates feed, shared by the sidebar bell and the
// /admin/updates page.
//   list        -> also load the list (the bell loads it only while open)
//   unreadOnly  -> list only unread updates
//   type        -> list a single update type
// The unread count is polled every 30s while the tab is visible, and checked
// again as soon as the tab becomes visible. When the count changes and the
// list is on screen, the list is reloaded too.
export default function useUpdates({
  list = false,
  unreadOnly = false,
  type = null,
  pageSize = 10,
  poll = true,
} = {}) {
  const { getToken, userData } = useAuth();
  // Employee accounts never see the feed (the API would answer 403)
  const enabled =
    Boolean(userData?.user) &&
    userData.user.user_type?.toLowerCase() !== "employee";

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  });
  const readToken = useCallback(() => getTokenRef.current(), []);
  const headers = useCallback(
    () => ({ Authorization: `Bearer ${readToken()}` }),
    [readToken],
  );

  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const unreadCountRef = useRef(0);
  useEffect(() => {
    unreadCountRef.current = unreadCount;
  }, [unreadCount]);

  const fetchPage = useCallback(
    async (skip) => {
      const params = new URLSearchParams({
        limit: String(pageSize),
        skip: String(skip),
      });
      if (unreadOnly) params.set("unread", "1");
      if (type) params.set("type", type);
      const res = await axios.get(`/api/v1/updates?${params}`, {
        headers: headers(),
      });
      if (!res.data.status) throw new Error(res.data.message);
      return res.data.data;
    },
    [headers, pageSize, unreadOnly, type],
  );

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const data = await fetchPage(0);
      setItems(data.updates);
      setHasMore(data.hasMore);
      setUnreadCount(data.unread_count);
      setError(null);
    } catch (err) {
      console.error("Failed to load updates:", err);
      setError(err.response?.data?.message || "Couldn't load updates.");
    } finally {
      setLoading(false);
    }
  }, [enabled, fetchPage]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const data = await fetchPage(items.length);
      setItems((prev) => [...prev, ...data.updates]);
      setHasMore(data.hasMore);
      setUnreadCount(data.unread_count);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't load more updates.");
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, items.length]);

  // Load the list when it is wanted or its filters change
  useEffect(() => {
    if (list) refresh();
  }, [list, refresh]);

  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });
  const listRef = useRef(list);
  useEffect(() => {
    listRef.current = list;
  });

  // Poll the unread count, never while the tab is hidden
  useEffect(() => {
    if (!enabled || !poll) return undefined;
    let cancelled = false;

    const check = async () => {
      if (document.hidden) return;
      try {
        const res = await axios.get("/api/v1/updates/unread-count", {
          headers: { Authorization: `Bearer ${getTokenRef.current()}` },
        });
        if (cancelled || !res.data.status) return;
        const next = res.data.data.unread_count;
        const changed = next !== unreadCountRef.current;
        setUnreadCount(next);
        if (changed && listRef.current) refreshRef.current();
      } catch {
        // A failed poll is silent; the next one retries
      }
    };

    check();
    const timer = setInterval(check, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [enabled, poll]);

  // Read receipt for one update. Optimistic, rolled back by a reload on error.
  const markRead = useCallback(
    async (id) => {
      const target = items.find((item) => item.id === id);
      if (target && !target.is_read) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, is_read: true, read_at: new Date().toISOString() }
              : item,
          ),
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      }
      try {
        await axios.patch(`/api/v1/updates/${id}/read`, null, {
          headers: headers(),
        });
      } catch (err) {
        console.error("Failed to mark update as read:", err);
        refresh();
      }
    },
    [items, headers, refresh],
  );

  const markAllRead = useCallback(async () => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        is_read: true,
        read_at: item.read_at || new Date().toISOString(),
      })),
    );
    setUnreadCount(0);
    try {
      await axios.post(
        "/api/v1/updates/read-all",
        { type },
        { headers: headers() },
      );
    } catch (err) {
      console.error("Failed to mark all updates as read:", err);
    } finally {
      refresh();
    }
  }, [headers, refresh, type]);

  return {
    enabled,
    readToken,
    unreadCount,
    items,
    hasMore,
    loading,
    loadingMore,
    error,
    refresh,
    loadMore,
    markRead,
    markAllRead,
  };
}
