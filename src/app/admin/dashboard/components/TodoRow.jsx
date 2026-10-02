"use client";

import { Check, Maximize2, StickyNote } from "lucide-react";
import { dueBadge, dueKey, formatDateTime, initialOf } from "../lib/todo";
import { BADGE } from "../lib/format";

export function TagAvatars({ users }) {
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

// One task: a complete checkbox, the title and meta (opens the popup), and an
// expand button. Used by the dashboard card and the full to-do page.
export default function TodoRow({ todo, currentUserId, onToggle, onOpen }) {
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
            <span className={`${BADGE} ${badge.className}`}>{badge.label}</span>
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
