"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import axios from "axios";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "react-toastify";
import { dueKey } from "../lib/todo";

const TITLE_MAX_LENGTH = 191;
const MENU_MAX_HEIGHT = 192; // matches the old max-h-48

const inputClass =
  "w-full text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors duration-200";
const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";

// Create a task, or edit one when `todo` is passed (creator only).
export default function TodoFormModal({
  todo = null,
  currentUserId,
  getToken,
  onClose,
  onSaved,
}) {
  const isEdit = Boolean(todo);
  const [title, setTitle] = useState(todo?.title ?? "");
  const [notes, setNotes] = useState(todo?.notes ?? "");
  const [dueDate, setDueDate] = useState(dueKey(todo?.due_date));
  const [taggedIds, setTaggedIds] = useState(
    () => todo?.tagged_users?.map((u) => u.id) ?? [],
  );
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [titleError, setTitleError] = useState("");
  const [saving, setSaving] = useState(false);
  const pickerRef = useRef(null);
  const searchRef = useRef(null);
  const [menuStyle, setMenuStyle] = useState(null);

  // Hold the latest props so the effects below can stay mount-only.
  const getTokenRef = useRef(getToken);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    getTokenRef.current = getToken;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get("/api/v1/todo/assignees", {
          headers: { Authorization: `Bearer ${getTokenRef.current()}` },
        });
        if (!cancelled && res.data.status) setUsers(res.data.data);
      } catch (err) {
        console.error("Failed to load users for tagging:", err);
        if (!cancelled) toast.error("Couldn't load users to tag. Try again.");
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    const onPointerDown = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  // Anchor the menu to the input's on-screen position. It opens below, and
  // flips above only when there is no room underneath.
  useLayoutEffect(() => {
    if (!pickerOpen) return;
    const place = () => {
      const rect = searchRef.current?.getBoundingClientRect();
      if (!rect) return;
      const gap = 4;
      const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
      const spaceAbove = rect.top - gap - 8;
      const flip = spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow;
      const maxHeight = Math.min(MENU_MAX_HEIGHT, flip ? spaceAbove : spaceBelow);
      setMenuStyle({
        left: rect.left,
        width: rect.width,
        maxHeight,
        ...(flip
          ? { bottom: window.innerHeight - rect.top + gap }
          : { top: rect.bottom + gap }),
      });
    };
    place();
    window.addEventListener("resize", place);
    // Capture so scrolling the modal body (not just the window) repositions it.
    window.addEventListener("scroll", place, true);
    // Tagging someone adds a chip row, which grows the centred modal and moves
    // the input. Re-anchor whenever the form changes size.
    const observer = new ResizeObserver(place);
    const form = searchRef.current?.closest("form");
    if (form) observer.observe(form);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      observer.disconnect();
    };
  }, [pickerOpen, usersLoading]);

  const usersById = useMemo(
    () => Object.fromEntries(users.map((u) => [u.id, u])),
    [users],
  );

  // Users already tagged but missing from the list (e.g. deactivated) still
  // show as chips so editing doesn't silently drop them.
  const taggedUsers = taggedIds.map(
    (id) =>
      usersById[id] ??
      todo?.tagged_users?.find((u) => u.id === id) ?? { id, name: "Unknown user" },
  );

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.id !== currentUserId &&
        (!q ||
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q)),
    );
  }, [users, search, currentUserId]);

  const toggleTag = (id) =>
    setTaggedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError("Enter a title for the task.");
      return;
    }

    setSaving(true);
    try {
      const headers = { Authorization: `Bearer ${getToken()}` };
      const payload = {
        title: trimmed,
        notes: notes.trim(),
        due_date: dueDate || null,
        tagged_user_ids: taggedIds,
      };
      const res = isEdit
        ? await axios.patch(`/api/v1/todo/${todo.id}`, payload, { headers })
        : await axios.post("/api/v1/todo/create", payload, { headers });

      if (res.data.status) {
        toast.success(isEdit ? "Task updated" : "Task added");
        onSaved(res.data.data);
      } else {
        toast.error(res.data.message || "Failed to save the task");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save the task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit task" : "New task"}
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl border border-slate-200 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-800">
            {isEdit ? "Edit task" : "New task"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors duration-200"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label htmlFor="todo-title" className={labelClass}>
              Title <span className="text-red-600">*</span>
            </label>
            <input
              id="todo-title"
              type="text"
              autoFocus
              maxLength={TITLE_MAX_LENGTH}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError("");
              }}
              placeholder="What needs to be done?"
              aria-invalid={Boolean(titleError)}
              className={`${inputClass} ${titleError ? "border-red-500 focus:ring-red-500" : ""}`}
            />
            {titleError && (
              <p className="text-xs text-red-600 mt-1">{titleError}</p>
            )}
          </div>

          <div>
            <label htmlFor="todo-notes" className={labelClass}>
              Notes
            </label>
            <textarea
              id="todo-notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any details or context"
              className={`${inputClass} resize-y`}
            />
          </div>

          <div>
            <label htmlFor="todo-due" className={labelClass}>
              Due date <span className="text-xs font-normal text-slate-500">(optional)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="todo-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setDueDate("")}
                  className="cursor-pointer shrink-0 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div
            ref={pickerRef}
            onBlur={(e) => {
              // Focus moving to something inside the picker (e.g. a checkbox)
              // keeps the menu open; anywhere else closes it.
              if (!e.currentTarget.contains(e.relatedTarget)) {
                setPickerOpen(false);
              }
            }}
          >
            <label htmlFor="todo-tag-search" className={labelClass}>
              Tag people{" "}
              <span className="text-xs font-normal text-slate-500">
                (the task shows on their dashboard too)
              </span>
            </label>

            {taggedUsers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {taggedUsers.map((user) => (
                  <span
                    key={user.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                  >
                    {user.name}
                    <button
                      type="button"
                      onClick={() => toggleTag(user.id)}
                      aria-label={`Remove ${user.name}`}
                      className="cursor-pointer hover:text-secondary"
                    >
                      <X className="w-3 h-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="relative">
              <Search
                className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="todo-tag-search"
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPickerOpen(true);
                }}
                onFocus={() => setPickerOpen(true)}
                placeholder={usersLoading ? "Loading users…" : "Search users"}
                disabled={usersLoading}
                autoComplete="off"
                className={`${inputClass} pl-9 disabled:opacity-50`}
              />
              {pickerOpen && !usersLoading && (
                // Fixed, not absolute: the scrolling body and the form's
                // overflow-hidden would otherwise crop a menu that opens below.
                <div
                  className="fixed z-50 bg-white border border-slate-300 rounded-lg overflow-auto"
                  style={menuStyle}
                  // Keep focus on the search input while clicking the menu, so
                  // the blur handler only fires when the user really leaves.
                  onMouseDown={(e) => e.preventDefault()}
                >
                  {candidates.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-500">
                      No matching users.
                    </p>
                  ) : (
                    candidates.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={taggedIds.includes(user.id)}
                          onChange={() => toggleTag(user.id)}
                          className="accent-primary"
                        />
                        <span className="truncate">{user.name}</span>
                        {user.name !== user.username && (
                          <span className="text-xs text-slate-500 truncate">
                            {user.username}
                          </span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving && (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            )}
            {isEdit ? "Save changes" : "Add task"}
          </button>
        </div>
      </form>
    </div>
  );
}
