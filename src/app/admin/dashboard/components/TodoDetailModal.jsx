"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Circle,
  Loader2,
  Minimize2,
  Pencil,
  Trash2,
} from "lucide-react";
import DeleteConfirmation from "@/components/DeleteConfirmation";
import { dueBadge, dueKey, formatDateTime, initialOf } from "../lib/todo";
import { BADGE, STATUS_COLORS } from "../lib/format";

function Person({ user }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-slate-800">
      <span
        aria-hidden="true"
        className="w-6 h-6 rounded-full bg-linear-to-br from-secondary to-primary text-white text-xs font-medium flex items-center justify-center shrink-0"
      >
        {initialOf(user.name)}
      </span>
      {user.name}
    </span>
  );
}

// The expanded view of a task: everything readable at full size, plus notes
// editing, complete/reopen, and (for the creator) edit and delete.
export default function TodoDetailModal({
  todo,
  canManage,
  onClose,
  onToggle,
  onSaveNotes,
  onEdit,
  onDelete,
}) {
  const [notes, setNotes] = useState(todo.notes ?? "");
  const [togglePending, setTogglePending] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const notesDirty = notes.trim() !== (todo.notes ?? "").trim();
  const badge = dueBadge(dueKey(todo.due_date), todo.is_completed);

  // Escape closes the popup, unless the delete confirmation is on top of it.
  const onCloseRef = useRef(onClose);
  const blockEscape = useRef(false);
  useEffect(() => {
    onCloseRef.current = onClose;
    blockEscape.current = confirmingDelete;
  });
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !blockEscape.current) onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const handleToggle = async () => {
    setTogglePending(true);
    try {
      await onToggle(todo);
    } finally {
      setTogglePending(false);
    }
  };

  const handleSaveNotes = async () => {
    setNotesSaving(true);
    try {
      await onSaveNotes(todo, notes);
    } finally {
      setNotesSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(todo);
    } finally {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs bg-black/50 p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Task details"
      >
        <div
          className="bg-white rounded-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-200">
            <div className="min-w-0">
              <h2
                className={`text-lg font-semibold wrap-break-word ${todo.is_completed ? "text-slate-500 line-through" : "text-slate-800"}`}
              >
                {todo.title}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span
                  className={`${BADGE} ${
                    todo.is_completed
                      ? STATUS_COLORS.COMPLETED
                      : STATUS_COLORS.ACTIVE
                  }`}
                >
                  {todo.is_completed ? "Completed" : "Active"}
                </span>
                {badge && (
                  <span
                    className={`${BADGE} ${badge.className}`}
                  >
                    <CalendarDays className="w-3 h-3" aria-hidden="true" />
                    {badge.label}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Collapse task"
              title="Collapse"
              className="cursor-pointer shrink-0 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200"
            >
              <Minimize2 className="w-4 h-4" aria-hidden="true" />
              Collapse
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div>
              <label
                htmlFor="todo-detail-notes"
                className="block text-sm font-medium text-slate-700 mb-1.5"
              >
                Notes
              </label>
              <textarea
                id="todo-detail-notes"
                rows={6}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes, updates or context"
                className="w-full text-sm text-slate-800 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-colors duration-200 resize-y"
              />
              {notesDirty && (
                <div className="flex justify-end gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setNotes(todo.notes ?? "")}
                    disabled={notesSaving}
                    className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={notesSaving}
                    className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {notesSaving && (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    )}
                    Save notes
                  </button>
                </div>
              )}
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500 mb-1">Created by</dt>
                <dd>
                  {todo.created_by ? (
                    <Person user={todo.created_by} />
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                  <p className="text-xs text-slate-500 mt-1">
                    {formatDateTime(todo.createdAt)}
                  </p>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 mb-1">Tagged</dt>
                <dd>
                  {todo.tagged_users.length === 0 ? (
                    <span className="text-slate-600">No one tagged</span>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {todo.tagged_users.map((u) => (
                        <Person key={u.id} user={u} />
                      ))}
                    </div>
                  )}
                </dd>
              </div>
              {todo.is_completed && (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium text-slate-500 mb-1">Completed</dt>
                  <dd className="text-slate-800">
                    {formatDateTime(todo.completed_at)}
                    {todo.completed_by ? ` by ${todo.completed_by.name}` : ""}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-slate-200">
            <div className="flex items-center gap-2">
              {canManage && (
                <>
                  <button
                    type="button"
                    onClick={() => onEdit(todo)}
                    className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                    Delete
                  </button>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleToggle}
              disabled={togglePending}
              className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                todo.is_completed
                  ? "text-slate-700 bg-white border border-slate-300 hover:bg-slate-100"
                  : "text-white bg-primary hover:bg-primary/90"
              }`}
            >
              {togglePending ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : todo.is_completed ? (
                <Circle className="w-4 h-4" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
              )}
              {todo.is_completed ? "Mark as active" : "Mark as complete"}
            </button>
          </div>
        </div>
      </div>

      <DeleteConfirmation
        isOpen={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
        isDeleting={deleting}
        heading="Task"
        title="Delete task"
        message={`"${todo.title}" will be removed for you and everyone tagged on it.`}
        confirmButtonText="Delete task"
      />
    </>
  );
}
