"use client";

import Link from "next/link";
import { ListTodo, Loader2, Plus } from "lucide-react";
import SectionCard, { EmptyState } from "./SectionCard";
import TodoFormModal from "./TodoFormModal";
import TodoDetailModal from "./TodoDetailModal";
import TodoRow from "./TodoRow";
import useTodos from "../lib/useTodos";
import { COUNT_BADGE } from "../lib/format";

const TABS = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
];

export default function TodoPanel() {
  const todos = useTodos();
  const {
    tab,
    items,
    counts,
    hasMore,
    loading,
    loadingMore,
    error,
    detail,
    formTodo,
  } = todos;

  return (
    <>
      <SectionCard
        title="My tasks"
        subtitle="Yours and tasks you're tagged on"
        icon={ListTodo}
        bodyClassName="p-0"
        action={
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/admin/todo"
              className="px-3 py-1.5 text-sm font-medium text-primary hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              View all
            </Link>
            <button
              type="button"
              onClick={() => todos.openForm(null)}
              className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              Add task
            </button>
          </div>
        }
      >
        <nav
          className="flex space-x-6 px-4 border-b border-slate-200"
          role="tablist"
        >
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => todos.changeTab(key)}
              className={`cursor-pointer py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <span className="flex items-center gap-2">
                {label}
                <span className={COUNT_BADGE}>{counts[key]}</span>
              </span>
            </button>
          ))}
        </nav>

        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-slate-500">
            <Loader2
              className="w-5 h-5 animate-spin"
              aria-label="Loading tasks"
            />
          </div>
        ) : error && items.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-600">
            {error}{" "}
            <button
              type="button"
              onClick={todos.reload}
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
                  currentUserId={todos.currentUserId}
                  onToggle={todos.toggleTodo}
                  onOpen={todos.openDetail}
                />
              ))}
            </ul>
            {tab === "completed" && hasMore && (
              <div className="px-4 py-2 border-t border-slate-200 text-center">
                <button
                  type="button"
                  onClick={todos.loadMore}
                  disabled={loadingMore}
                  className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-primary hover:bg-slate-100 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore && (
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      aria-hidden="true"
                    />
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
          canManage={todos.canManage(detail)}
          onClose={todos.closeDetail}
          onToggle={todos.toggleTodo}
          onSaveNotes={todos.saveNotes}
          onEdit={todos.openForm}
          onDelete={todos.deleteTodo}
        />
      )}

      {formTodo !== undefined && (
        <TodoFormModal
          todo={formTodo}
          currentUserId={todos.currentUserId}
          getToken={todos.readToken}
          onClose={todos.closeForm}
          onSaved={todos.handleSaved}
        />
      )}
    </>
  );
}
