"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Check,
  ListTodo,
  Loader2,
  Maximize2,
  Plus,
  StickyNote,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "@/contexts/AuthContext";
import SectionCard, { EmptyState } from "./SectionCard";
import TodoFormModal from "./TodoFormModal";
import TodoDetailModal from "./TodoDetailModal";
import { dueBadge, dueKey, formatDateTime, initialOf } from "../lib/todo";
import { BADGE, COUNT_BADGE } from "../lib/format";

const TABS = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
];

function TagAvatars({ users }) {
  if (users.length === 0) return null;
  return (
    <div className="flex -space-x-1.5">
      {users.slice(0, 3).map((u) => (
        <span
          key={u.id}
          title={u.name}
          className="w-6 h-6 rounded-full border-2 border-white bg-linear-to-br from-secondary to-primary text-white text-xs font-medium flex items-center justify-center"
        >
          {initialOf(u.name)}
        </span>
      ))}
      {users.length > 3 && (
        <span className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 text-slate-700 text-xs font-medium flex items-center justify-center">
          +{users.length - 3}
        </span>
      )}
    </div>
  );
}

function TodoRow({ todo, currentUserId, onToggle, onOpen }) {
  const badge = dueBadge(dueKey(todo.due_date), todo.is_completed);
  const fromOther = todo.created_by && todo.created_by.id !== currentUserId;

  return (
    <li className="px-4 py-2.5 flex items-start gap-3 hover:bg-slate-50 transition-colors duration-200">
      <button
        type="button"
        role="checkbox"
        aria-checked={todo.is_completed}
        onClick={() => onToggle(todo)}
        aria-label={
          todo.is_completed
            ? `Mark "${todo.title}" as active`
            : `Mark "${todo.title}" as complete`
        }
        className={`group cursor-pointer mt-0.5 w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
          todo.is_completed
            ? "bg-primary border-primary text-white"
            : "border-slate-300 text-transparent hover:border-primary hover:text-primary/50"
        }`}
      >
        <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onOpen(todo)}
        className="cursor-pointer min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
      >
        <p
          className={`text-sm font-medium truncate ${todo.is_completed ? "text-slate-500 line-through" : "text-slate-800"}`}
        >
          {todo.title}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
          {badge && (
            <span
              className={`${BADGE} ${badge.className}`}
            >
              {badge.label}
            </span>
          )}
          <TagAvatars users={todo.tagged_users} />
          {fromOther && (
            <span className="text-xs text-slate-500 truncate">
              From {todo.created_by.name}
            </span>
          )}
          {todo.notes && (
            <StickyNote
              className="w-4 h-4 text-slate-400"
              aria-label="Has notes"
            />
          )}
        </div>
        {todo.is_completed && todo.completed_at && (
          <p className="text-xs text-slate-500 mt-1 truncate">
            Completed {formatDateTime(todo.completed_at)}
            {todo.completed_by ? ` by ${todo.completed_by.name}` : ""}
          </p>
        )}
      </button>
      <button
        type="button"
        onClick={() => onOpen(todo)}
        aria-label={`Expand "${todo.title}"`}
        title="Expand"
        className="cursor-pointer shrink-0 p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200"
      >
        <Maximize2 className="w-4 h-4" aria-hidden="true" />
      </button>
    </li>
  );
}

export default function TodoPanel() {
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
  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
  });

  const fetchList = useCallback(
    async (status, skip = 0) => {
      const res = await axios.get(`/api/v1/todo/all?status=${status}&skip=${skip}`, {
        headers: { Authorization: `Bearer ${readToken()}` },
      });
      if (!res.data.status) throw new Error(res.data.message);
      return res.data.data;
    },
    [readToken],
  );

  // Refreshes counts and every list the user has already looked at.
  const reload = useCallback(async () => {
    try {
      const wantCompleted = completedLoaded.current || tabRef.current === "completed";
      const [active, completed] = await Promise.all([
        fetchList("active"),
        wantCompleted ? fetchList("completed") : null,
      ]);
      setLists((prev) => ({
        active: active.todos,
        completed: completed ? completed.todos : prev.completed,
      }));
      setCounts(completed ? completed.counts : active.counts);
      if (completed) {
        completedLoaded.current = true;
        setHasMore(completed.hasMore);
      }
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

  const handleTabChange = (key) => {
    setTab(key);
    if (key === "completed" && !completedLoaded.current) {
      setLoading(true);
      // tabRef is updated by effect after render; reload() reads it, so pass
      // the intent explicitly by marking the list as wanted first.
      completedLoaded.current = true;
      reload();
    }
  };

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const page = await fetchList("completed", lists.completed.length);
      setLists((prev) => ({ ...prev, completed: [...prev.completed, ...page.todos] }));
      setHasMore(page.hasMore);
      setCounts(page.counts);
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't load more tasks");
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

  const handleToggle = async (todo) => {
    const next = !todo.is_completed;
    const from = todo.is_completed ? "completed" : "active";
    const to = next ? "completed" : "active";

    // Optimistic: it leaves this tab straight away and the counts follow.
    setLists((prev) => ({ ...prev, [from]: prev[from].filter((t) => t.id !== todo.id) }));
    setCounts((prev) => ({ ...prev, [from]: prev[from] - 1, [to]: prev[to] + 1 }));

    try {
      const res = await patchTodo(todo.id, { is_completed: next });
      if (!res.data.status) throw new Error(res.data.message);
      setDetail((d) => (d && d.id === todo.id ? res.data.data : d));
      toast.success(next ? "Task completed" : "Task moved back to active");
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to update the task");
    } finally {
      await reload();
    }
  };

  const handleSaveNotes = async (todo, notes) => {
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

  const handleDelete = async (todo) => {
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

  const items = lists[tab];

  return (
    <>
      <SectionCard
        title="My tasks"
        subtitle="Yours and tasks you're tagged on"
        icon={ListTodo}
        bodyClassName="p-0"
        action={
          <button
            type="button"
            onClick={() => setFormTodo(null)}
            className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 shrink-0"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Add task
          </button>
        }
      >
        <nav className="flex space-x-6 px-4 border-b border-slate-200" role="tablist">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => handleTabChange(key)}
              className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <span className="flex items-center gap-2">
                {label}
                <span className={COUNT_BADGE}>
                  {counts[key]}
                </span>
              </span>
            </button>
          ))}
        </nav>

        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" aria-label="Loading tasks" />
          </div>
        ) : error && items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-600">
            {error}{" "}
            <button
              type="button"
              onClick={reload}
              className="cursor-pointer font-medium text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            message={
              tab === "active"
                ? "No active tasks. Add one to get started."
                : "Completed tasks will show up here."
            }
          />
        ) : (
          <>
            <ul className="max-h-96 overflow-y-auto divide-y divide-slate-200">
              {items.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  currentUserId={currentUserId}
                  onToggle={handleToggle}
                  onOpen={setDetail}
                />
              ))}
            </ul>
            {tab === "completed" && hasMore && (
              <div className="px-4 py-2 border-t border-slate-200 text-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-primary hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore && (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  )}
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </SectionCard>

      {detail && (
        <TodoDetailModal
          key={detail.id}
          todo={detail}
          canManage={canManage(detail)}
          onClose={() => setDetail(null)}
          onToggle={handleToggle}
          onSaveNotes={handleSaveNotes}
          onEdit={(todo) => setFormTodo(todo)}
          onDelete={handleDelete}
        />
      )}

      {formTodo !== undefined && (
        <TodoFormModal
          todo={formTodo}
          currentUserId={currentUserId}
          getToken={readToken}
          onClose={() => setFormTodo(undefined)}
          onSaved={handleSaved}
        />
      )}
    </>
  );
}
