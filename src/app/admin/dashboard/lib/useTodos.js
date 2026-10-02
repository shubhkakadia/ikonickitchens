"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";

// State and actions for the to-do list, shared by the dashboard card and the
// full /admin/todo page. The two views differ only in how they render it.
export default function useTodos() {
  const { getToken, userData } = useAuth();
  const currentUserId = userData?.user?.id;
  const isMasterAdmin =
    userData?.user?.user_type?.toLowerCase() === "master-admin";

  const getTokenRef = useRef(getToken);
  useEffect(() => {
    getTokenRef.current = getToken;
  });
  const readToken = useCallback(() => getTokenRef.current(), []);

  const [tab, setTab] = useState("active");
  const [lists, setLists] = useState({ active: [], completed: [] });
  const [counts, setCounts] = useState({ active: 0, completed: 0 });
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [formTodo, setFormTodo] = useState(undefined); // undefined = closed, null = new
  const [detail, setDetail] = useState(null);

  // The history tab is fetched on first open, then kept fresh by reload().
  const completedLoaded = useRef(false);

  const fetchList = useCallback(
    async (status, skip = 0) => {
      const res = await axios.get(
        `/api/v1/todo/all?status=${status}&skip=${skip}`,
        { headers: { Authorization: `Bearer ${readToken()}` } },
      );
      if (!res.data.status) throw new Error(res.data.message);
      return res.data.data;
    },
    [readToken],
  );

  // Refreshes counts and every list the user has already looked at.
  const reload = useCallback(async () => {
    try {
      const [active, completed] = await Promise.all([
        fetchList("active"),
        completedLoaded.current ? fetchList("completed") : null,
      ]);
      setLists((prev) => ({
        active: active.todos,
        completed: completed ? completed.todos : prev.completed,
      }));
      setCounts(completed ? completed.counts : active.counts);
      if (completed) setHasMore(completed.hasMore);
      setError(null);
    } catch (err) {
      console.error("Failed to load tasks:", err);
      setError(err.response?.data?.message || "Couldn't load your tasks.");
    } finally {
      setLoading(false);
    }
  }, [fetchList]);

  useEffect(() => {
    reload();
  }, [reload]);

  const changeTab = (key) => {
    setTab(key);
    if (key === "completed" && !completedLoaded.current) {
      setLoading(true);
      completedLoaded.current = true;
      reload();
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await fetchList("completed", lists.completed.length);
      setLists((prev) => ({
        ...prev,
        completed: [...prev.completed, ...page.todos],
      }));
      setHasMore(page.hasMore);
      setCounts(page.counts);
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't load more tasks");
    } finally {
      setLoadingMore(false);
    }
  };

  // Fetches every remaining completed page, for views that search, filter and
  // paginate on the client. Resolves false if a page failed to load.
  const loadAllCompleted = async () => {
    setLoadingMore(true);
    try {
      let skip = lists.completed.length;
      let more = true;
      while (more) {
        const page = await fetchList("completed", skip);
        setLists((prev) => ({
          ...prev,
          completed: [...prev.completed, ...page.todos],
        }));
        setCounts(page.counts);
        skip += page.todos.length;
        more = page.hasMore && page.todos.length > 0;
        setHasMore(more);
      }
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't load all tasks");
      return false;
    } finally {
      setLoadingMore(false);
    }
  };

  const replaceTodo = (updated) => {
    setLists((prev) => ({
      active: prev.active.map((t) => (t.id === updated.id ? updated : t)),
      completed: prev.completed.map((t) => (t.id === updated.id ? updated : t)),
    }));
    setDetail((d) => (d && d.id === updated.id ? updated : d));
  };

  const patchTodo = (id, body) =>
    axios.patch(`/api/v1/todo/${id}`, body, {
      headers: { Authorization: `Bearer ${readToken()}` },
    });

  const toggleTodo = async (todo) => {
    const next = !todo.is_completed;
    const from = todo.is_completed ? "completed" : "active";
    const to = next ? "completed" : "active";

    // Optimistic: it leaves this tab straight away and the counts follow.
    setLists((prev) => ({
      ...prev,
      [from]: prev[from].filter((t) => t.id !== todo.id),
    }));
    setCounts((prev) => ({
      ...prev,
      [from]: prev[from] - 1,
      [to]: prev[to] + 1,
    }));

    try {
      const res = await patchTodo(todo.id, { is_completed: next });
      if (!res.data.status) throw new Error(res.data.message);
      setDetail((d) => (d && d.id === todo.id ? res.data.data : d));
      toast.success(next ? "Task completed" : "Task moved back to active");
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          err.message ||
          "Failed to update the task",
      );
    } finally {
      await reload();
    }
  };

  const saveNotes = async (todo, notes) => {
    try {
      const res = await patchTodo(todo.id, { notes });
      if (res.data.status) {
        replaceTodo(res.data.data);
        toast.success("Notes saved");
      } else {
        toast.error(res.data.message || "Failed to save notes");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save notes");
    }
  };

  const deleteTodo = async (todo) => {
    try {
      const res = await axios.delete(`/api/v1/todo/${todo.id}`, {
        headers: { Authorization: `Bearer ${readToken()}` },
      });
      if (res.data.status) {
        toast.success("Task deleted");
        setDetail(null);
        await reload();
      } else {
        toast.error(res.data.message || "Failed to delete the task");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete the task");
    }
  };

  // Called by the form modal once a task is created or edited.
  const handleSaved = async (saved) => {
    const wasEdit = formTodo !== null;
    setFormTodo(undefined);
    if (wasEdit) {
      replaceTodo(saved);
    } else {
      setTab("active");
    }
    await reload();
  };

  const canManage = (todo) =>
    isMasterAdmin || (todo.created_by && todo.created_by.id === currentUserId);

  return {
    currentUserId,
    readToken,
    tab,
    changeTab,
    items: lists[tab],
    allTodos: [...lists.active, ...lists.completed],
    counts,
    hasMore,
    loading,
    loadingMore,
    error,
    reload,
    loadMore,
    loadAllCompleted,
    toggleTodo,
    saveNotes,
    deleteTodo,
    canManage,
    detail,
    openDetail: setDetail,
    closeDetail: () => setDetail(null),
    formTodo,
    openForm: setFormTodo, // pass null for a new task, a todo to edit it
    closeForm: () => setFormTodo(undefined),
    handleSaved,
  };
}
