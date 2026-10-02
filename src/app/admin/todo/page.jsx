"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  Funnel,
  ListTodo,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Sheet,
  StickyNote,
} from "lucide-react";
import AdminShell from "@/components/AdminShell";
import PaginationFooter from "@/components/PaginationFooter";
import SearchBar from "@/components/SearchBar";
import { useExcelExport } from "@/hooks/useExcelExport";
import {
  usePersistedTableFilter,
  useTableFilterActions,
} from "@/hooks/usePersistedTableFilter";
import { TagAvatars } from "@/app/admin/dashboard/components/TodoRow";
import TodoDetailModal from "@/app/admin/dashboard/components/TodoDetailModal";
import TodoFormModal from "@/app/admin/dashboard/components/TodoFormModal";
import useTodos from "@/app/admin/dashboard/lib/useTodos";
import {
  dueBadge,
  dueKey,
  formatDateTime,
  formatDueDate,
} from "@/app/admin/dashboard/lib/todo";
import {
  BADGE,
  BUTTON_COUNT_BADGE,
  COUNT_BADGE,
} from "@/app/admin/dashboard/lib/format";

const TABLE_KEY = "todo";
const NO_PEOPLE = [];

// Fields the list can be sorted by. Used by both the "Sort by" menu and the
// column headers so the two never drift apart. "Completed" only exists on the
// Completed tab.
const SORT_OPTIONS = [
  { field: "title", label: "Task" },
  { field: "due_date", label: "Due date" },
  { field: "createdAt", label: "Created" },
  { field: "completed_at", label: "Completed" },
];

// Each tab opens in the order the API already returns: open tasks by due date
// (undated last), history by most recently completed.
const DEFAULT_SORT = {
  active: { field: "due_date", order: "asc" },
  completed: { field: "completed_at", order: "desc" },
};

// Dates sort newest-first on first click, like the logs page.
const DESC_FIRST = ["createdAt", "completed_at"];

const TABS = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
];

// Column names for the Excel export. Changing these changes the exported file.
const AVAILABLE_COLUMNS = [
  "Task",
  "Status",
  "Notes",
  "Due date",
  "Tagged people",
  "Created by",
  "Created at",
  "Completed at",
  "Completed by",
];

const exportDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-AU") : "";

const formatCreated = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

// Button, field, menu and table recipes from DESIGN.md 9.1 / 9.2 / 9.5 / 9.8.
const MENU_ITEM =
  "cursor-pointer w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-between";
const MENU_CHECK_ROW =
  "cursor-pointer flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 transition-colors";
const CHECKBOX =
  "h-4 w-4 shrink-0 accent-primary border-slate-300 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const BTN_SECONDARY =
  "cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed";
const TH =
  "px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider";

const matchesSearch = (todo, query) =>
  [
    todo.title,
    todo.notes,
    todo.created_by?.name,
    ...todo.tagged_users.map((u) => u.name),
  ].some((value) => value && value.toLowerCase().includes(query));

// Empty values always sort last, whichever way the list is ordered.
const compareTodos = (field, order) => (a, b) => {
  const dir = order === "asc" ? 1 : -1;
  if (field === "title") {
    return (
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) * dir
    );
  }
  const read = (todo) =>
    field === "due_date" ? dueKey(todo.due_date) : todo[field] || "";
  const av = read(a);
  const bv = read(b);
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return av < bv ? -dir : av > bv ? dir : 0;
};

// Sortable column header. The label is a real button so the sort is reachable
// by keyboard (DESIGN.md 13.7); the active column carries the only indicator.
function SortHeader({ field, label, sortField, sortOrder, onSort, icon }) {
  const isActive = sortField === field;
  return (
    <th
      scope="col"
      aria-sort={
        isActive
          ? sortOrder === "asc"
            ? "ascending"
            : "descending"
          : undefined
      }
      className={TH}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="cursor-pointer flex items-center gap-2 uppercase tracking-wider hover:text-slate-700 transition-colors duration-200 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {label}
        {icon}
      </button>
    </th>
  );
}

export default function TodoPage() {
  const todos = useTodos();
  const { tab, items, allTodos, counts, hasMore, loading, loadingMore, error } =
    todos;

  const [search, setSearch] = usePersistedTableFilter(TABLE_KEY, "search", "");
  // Empty = "use this tab's default order".
  const [sortField, setSortField] = usePersistedTableFilter(
    TABLE_KEY,
    "sortField",
    "",
  );
  const [sortOrder, setSortOrder] = usePersistedTableFilter(
    TABLE_KEY,
    "sortOrder",
    "",
  );
  const [taggedIds, setTaggedIds] = usePersistedTableFilter(
    TABLE_KEY,
    "taggedIds",
    NO_PEOPLE,
  );
  const { resetFilters } = useTableFilterActions(TABLE_KEY);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [autoLoadFailed, setAutoLoadFailed] = useState(false);

  const [showTaggedDropdown, setShowTaggedDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState([
    ...AVAILABLE_COLUMNS,
  ]);

  // The Completed tab arrives a page at a time. Search, the people filter,
  // sorting and paging all run on the client, so pull in the rest as soon as it
  // opens.
  const loadAllRef = useRef(todos.loadAllCompleted);
  useEffect(() => {
    loadAllRef.current = todos.loadAllCompleted;
  });
  useEffect(() => {
    if (tab !== "completed" || !hasMore || loading || loadingMore) return;
    if (autoLoadFailed) return;
    loadAllRef.current().then((ok) => {
      if (!ok) setAutoLoadFailed(true);
    });
  }, [tab, hasMore, loading, loadingMore, autoLoadFailed]);

  // Close dropdowns when clicking outside or pressing Escape
  useEffect(() => {
    const closeAll = () => {
      setShowTaggedDropdown(false);
      setShowSortDropdown(false);
      setShowColumnDropdown(false);
    };
    const handleClickOutside = (event) => {
      if (!event.target.closest(".dropdown-container")) closeAll();
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") closeAll();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Back to the first page whenever the displayed set changes.
  const taggedKey = taggedIds.join(",");
  useEffect(() => {
    setCurrentPage(1);
  }, [search, tab, taggedKey]);

  // Everyone tagged on any loaded task. A person who is selected but not on a
  // loaded task stays in the menu so the filter can still be undone.
  const taggedOptions = useMemo(() => {
    const byId = new Map();
    for (const todo of allTodos) {
      for (const user of todo.tagged_users) byId.set(user.id, user.name);
    }
    for (const id of taggedIds) {
      if (!byId.has(id)) byId.set(id, "Unknown user");
    }
    return [...byId]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allTodos, taggedIds]);

  const sortOptions = SORT_OPTIONS.filter(
    ({ field }) => field !== "completed_at" || tab === "completed",
  );
  const isCustomSort = sortOptions.some(({ field }) => field === sortField);
  const activeSortField = isCustomSort ? sortField : DEFAULT_SORT[tab].field;
  const activeSortOrder = isCustomSort
    ? sortOrder || "asc"
    : DEFAULT_SORT[tab].order;

  const filteredAndSortedTodos = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items
      .filter(
        (todo) =>
          (!query || matchesSearch(todo, query)) &&
          (taggedIds.length === 0 ||
            todo.tagged_users.some((u) => taggedIds.includes(u.id))),
      )
      .sort(compareTodos(activeSortField, activeSortOrder));
  }, [items, search, taggedIds, activeSortField, activeSortOrder]);

  // Pagination calculations. The page is clamped so deleting or completing the
  // last row of the last page never strands the list on an empty page.
  const totalItems = filteredAndSortedTodos.length;
  const lastPage =
    itemsPerPage === 0 ? 1 : Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const page = Math.min(currentPage, lastPage);
  const startIndex = itemsPerPage === 0 ? 0 : (page - 1) * itemsPerPage;
  const endIndex = itemsPerPage === 0 ? totalItems : startIndex + itemsPerPage;
  const paginatedTodos = filteredAndSortedTodos.slice(startIndex, endIndex);

  // Column mapping for Excel export
  const columnMap = useMemo(
    () => ({
      Task: (todo) => todo.title,
      Status: (todo) => (todo.is_completed ? "Completed" : "Active"),
      Notes: (todo) => todo.notes || "",
      "Due date": (todo) => formatDueDate(dueKey(todo.due_date)),
      "Tagged people": (todo) =>
        todo.tagged_users.map((u) => u.name).join(", "),
      "Created by": (todo) => todo.created_by?.name || "",
      "Created at": (todo) => exportDate(todo.createdAt),
      "Completed at": (todo) => exportDate(todo.completed_at),
      "Completed by": (todo) => todo.completed_by?.name || "",
    }),
    [],
  );
  const { exportToExcel, isExporting } = useExcelExport({
    columnMap,
    filenamePrefix:
      tab === "completed" ? "completed_tasks_export" : "tasks_export",
    sheetName: "Tasks",
    selectedColumns,
  });

  const handleSort = (field) => {
    if (activeSortField === field) {
      setSortField(field);
      setSortOrder(activeSortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder(DESC_FIRST.includes(field) ? "desc" : "asc");
    }
    setShowSortDropdown(false);
  };

  const handleTaggedToggle = (id) =>
    setTaggedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleColumnToggle = (column) => {
    if (column === "Select All") {
      setSelectedColumns((prev) =>
        prev.length === AVAILABLE_COLUMNS.length ? [] : [...AVAILABLE_COLUMNS],
      );
    } else {
      setSelectedColumns((prev) =>
        prev.includes(column)
          ? prev.filter((c) => c !== column)
          : [...prev, column],
      );
    }
  };

  const handleReset = () => {
    resetFilters();
    setCurrentPage(1);
  };

  // Filters that narrow the list (sort does not hide records), used to tell
  // "no tasks" apart from "no results for this filter" (DESIGN.md 15.4).
  const isNarrowingFilterActive = search !== "" || taggedIds.length > 0;
  const isAnyFilterActive =
    isNarrowingFilterActive || sortField !== "" || sortOrder !== "";

  // Only the active column shows a sort indicator (DESIGN.md 15.4).
  const getSortIcon = (field) => {
    if (activeSortField !== field) return null;
    return activeSortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4 text-primary" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-4 w-4 text-primary" aria-hidden="true" />
    );
  };

  const sortHeaderProps = {
    sortField: activeSortField,
    sortOrder: activeSortOrder,
    onSort: handleSort,
  };

  const exportDisabled =
    isExporting ||
    filteredAndSortedTodos.length === 0 ||
    selectedColumns.length === 0;
  const columnPickerDisabled =
    isExporting || filteredAndSortedTodos.length === 0;

  const isCompletedTab = tab === "completed";
  const tableColumns = isCompletedTab ? 7 : 6;
  const tabClass = (key) =>
    `cursor-pointer py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-t-sm ${
      tab === key
        ? "border-primary text-primary"
        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
    }`;

  return (
    <AdminShell>
      <main className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="px-4 py-2 shrink-0">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold text-slate-800">To-do list</h1>
            <div className="flex items-center gap-2">
              <SearchBar />
              <button
                type="button"
                onClick={() => todos.openForm(null)}
                className="cursor-pointer flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add task
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden px-4 pb-4">
          <div className="bg-white rounded-lg border border-slate-200 flex flex-col h-full overflow-hidden">
            {/* Fixed header section */}
            <div className="p-4 shrink-0 border-b border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Search */}
                <div className="flex items-center gap-2 flex-1 min-w-64 max-w-2xl relative">
                  <Search
                    className="h-4 w-4 absolute left-3 text-slate-400 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    aria-label="Search tasks"
                    placeholder="Search by task, notes, creator or tagged person"
                    className="w-full text-sm text-slate-800 py-2 pr-3 pl-10 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                {/* Reset, filter by, sort by, export to Excel */}
                <div className="flex flex-wrap items-center gap-2">
                  {isAnyFilterActive && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className={BTN_SECONDARY}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      <span>Reset</span>
                    </button>
                  )}

                  <div className="relative dropdown-container">
                    <button
                      type="button"
                      onClick={() => setShowTaggedDropdown(!showTaggedDropdown)}
                      aria-haspopup="true"
                      aria-expanded={showTaggedDropdown}
                      className={BTN_SECONDARY}
                    >
                      <Funnel className="h-4 w-4" aria-hidden="true" />
                      <span>Filter by tagged person</span>
                      {taggedIds.length > 0 && (
                        <span className={BUTTON_COUNT_BADGE}>
                          {taggedIds.length}
                        </span>
                      )}
                    </button>
                    {showTaggedDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg z-40 max-h-96 overflow-y-auto">
                        <div className="py-1">
                          {taggedOptions.length === 0 ? (
                            <p className="px-4 py-2.5 text-sm text-slate-500">
                              No one is tagged on a task yet
                            </p>
                          ) : (
                            taggedOptions.map((user) => (
                              <label key={user.id} className={MENU_CHECK_ROW}>
                                <span className="truncate">{user.name}</span>
                                <input
                                  type="checkbox"
                                  checked={taggedIds.includes(user.id)}
                                  onChange={() => handleTaggedToggle(user.id)}
                                  className={CHECKBOX}
                                />
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative dropdown-container">
                    <button
                      type="button"
                      onClick={() => setShowSortDropdown(!showSortDropdown)}
                      aria-haspopup="true"
                      aria-expanded={showSortDropdown}
                      className={BTN_SECONDARY}
                    >
                      <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                      <span>Sort by</span>
                    </button>
                    {showSortDropdown && (
                      <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-300 rounded-lg z-40">
                        <div className="py-1">
                          {sortOptions.map(({ field, label }) => (
                            <button
                              type="button"
                              key={field}
                              onClick={() => handleSort(field)}
                              className={MENU_ITEM}
                            >
                              {label} {getSortIcon(field)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="relative dropdown-container flex items-stretch">
                    <button
                      type="button"
                      onClick={() => exportToExcel(filteredAndSortedTodos)}
                      disabled={exportDisabled}
                      className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 border-r-0 hover:bg-slate-100 rounded-l-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sheet className="h-4 w-4" aria-hidden="true" />
                      <span>
                        {isExporting ? "Exporting…" : "Export to Excel"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                      disabled={columnPickerDisabled}
                      aria-label="Choose columns to export"
                      aria-haspopup="true"
                      aria-expanded={showColumnDropdown}
                      className="cursor-pointer flex items-center px-2 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-r-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {showColumnDropdown && (
                      <div className="absolute top-full right-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg z-40 max-h-96 overflow-y-auto">
                        <div className="py-1">
                          <label
                            className={`${MENU_CHECK_ROW} sticky top-0 bg-white border-b border-slate-200`}
                          >
                            <span className="font-medium">Select all</span>
                            <input
                              type="checkbox"
                              checked={
                                selectedColumns.length ===
                                AVAILABLE_COLUMNS.length
                              }
                              onChange={() => handleColumnToggle("Select All")}
                              className={CHECKBOX}
                            />
                          </label>
                          {AVAILABLE_COLUMNS.map((column) => (
                            <label key={column} className={MENU_CHECK_ROW}>
                              <span>{column}</span>
                              <input
                                type="checkbox"
                                checked={selectedColumns.includes(column)}
                                onChange={() => handleColumnToggle(column)}
                                className={CHECKBOX}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs section */}
            <div className="px-4 shrink-0 border-b border-slate-200">
              <div
                className="flex space-x-6"
                role="tablist"
                aria-label="Task status"
              >
                {TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => todos.changeTab(key)}
                    className={tabClass(key)}
                  >
                    <span className="flex items-center gap-2">
                      {label}
                      <span className={COUNT_BADGE}>{counts[key]}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Completed history is fetched in pages; say so while it loads */}
            {isCompletedTab && hasMore && (
              <div
                className="px-4 py-2 shrink-0 border-b border-slate-200 bg-slate-50 flex items-center gap-2 text-sm text-slate-600"
                role="status"
              >
                {loadingMore ? (
                  <>
                    <Loader2
                      className="w-4 h-4 animate-spin"
                      aria-hidden="true"
                    />
                    Loading all completed tasks…
                  </>
                ) : (
                  <>
                    Some completed tasks couldn&apos;t be loaded.
                    <button
                      type="button"
                      onClick={() => setAutoLoadFailed(false)}
                      className="cursor-pointer font-medium text-primary hover:underline"
                    >
                      Try again
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Scrollable table section */}
            <div className="flex-1 overflow-auto">
              <div className="min-w-full">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50 sticky top-0 z-10">
                    <tr>
                      <th scope="col" className={`${TH} w-10`}>
                        <span className="sr-only">Mark complete</span>
                      </th>
                      <SortHeader
                        field="title"
                        label="Task"
                        icon={getSortIcon("title")}
                        {...sortHeaderProps}
                      />
                      <SortHeader
                        field="due_date"
                        label="Due date"
                        icon={getSortIcon("due_date")}
                        {...sortHeaderProps}
                      />
                      <th scope="col" className={TH}>
                        Tagged
                      </th>
                      <th scope="col" className={TH}>
                        Created by
                      </th>
                      <SortHeader
                        field="createdAt"
                        label="Created"
                        icon={getSortIcon("createdAt")}
                        {...sortHeaderProps}
                      />
                      {isCompletedTab && (
                        <SortHeader
                          field="completed_at"
                          label="Completed"
                          icon={getSortIcon("completed_at")}
                          {...sortHeaderProps}
                        />
                      )}
                    </tr>
                  </thead>

                  <tbody className="bg-white divide-y divide-slate-200">
                    {loading && items.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={tableColumns}
                        >
                          <div
                            className="flex flex-col items-center gap-2"
                            role="status"
                          >
                            <span
                              className="w-6 h-6 border-2 border-slate-200 border-t-primary rounded-full animate-spin"
                              aria-hidden="true"
                            />
                            <p className="text-sm text-slate-600">
                              Loading tasks…
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : error && items.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={tableColumns}
                        >
                          <div
                            className="flex flex-col items-center gap-2"
                            role="alert"
                          >
                            <AlertTriangle
                              className="w-8 h-8 text-red-500"
                              aria-hidden="true"
                            />
                            <p className="text-sm text-red-600">{error}</p>
                            <button
                              type="button"
                              onClick={todos.reload}
                              className={`${BTN_SECONDARY} py-1.5`}
                            >
                              Try again
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : paginatedTodos.length === 0 ? (
                      <tr>
                        <td
                          className="px-4 py-12 text-center"
                          colSpan={tableColumns}
                        >
                          <div className="flex flex-col items-center gap-2">
                            <ListTodo
                              className="w-8 h-8 text-slate-300"
                              aria-hidden="true"
                            />
                            {items.length > 0 && isNarrowingFilterActive ? (
                              <>
                                <p className="text-sm text-slate-600">
                                  No tasks match your filters
                                </p>
                                <button
                                  type="button"
                                  onClick={handleReset}
                                  className={`${BTN_SECONDARY} py-1.5`}
                                >
                                  <RotateCcw
                                    className="h-4 w-4"
                                    aria-hidden="true"
                                  />
                                  Clear filters
                                </button>
                              </>
                            ) : (
                              <>
                                <p className="text-sm text-slate-600">
                                  {isCompletedTab
                                    ? "No completed tasks yet"
                                    : "No active tasks yet"}
                                </p>
                                {!isCompletedTab && (
                                  <button
                                    type="button"
                                    onClick={() => todos.openForm(null)}
                                    className={`${BTN_SECONDARY} py-1.5`}
                                  >
                                    <Plus
                                      className="h-4 w-4"
                                      aria-hidden="true"
                                    />
                                    Add task
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedTodos.map((todo) => {
                        const badge = dueBadge(
                          dueKey(todo.due_date),
                          todo.is_completed,
                        );
                        return (
                          <tr
                            key={todo.id}
                            className="hover:bg-slate-50 transition-colors duration-200 cursor-pointer"
                            onClick={() => todos.openDetail(todo)}
                          >
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                role="checkbox"
                                aria-checked={todo.is_completed}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  todos.toggleTodo(todo);
                                }}
                                aria-label={
                                  todo.is_completed
                                    ? `Mark "${todo.title}" as active`
                                    : `Mark "${todo.title}" as complete`
                                }
                                className={`group cursor-pointer w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 ${
                                  todo.is_completed
                                    ? "bg-primary border-primary text-white"
                                    : "border-slate-300 text-transparent hover:border-primary hover:text-primary/50"
                                }`}
                              >
                                <Check
                                  className="w-3 h-3"
                                  strokeWidth={3}
                                  aria-hidden="true"
                                />
                              </button>
                            </td>
                            <td className="px-4 py-3 text-sm font-medium">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    todos.openDetail(todo);
                                  }}
                                  title={todo.title}
                                  className={`block max-w-md truncate text-left rounded-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer ${
                                    todo.is_completed
                                      ? "text-slate-500 line-through"
                                      : "text-slate-700"
                                  }`}
                                >
                                  {todo.title}
                                </button>
                                {todo.notes && (
                                  <StickyNote
                                    className="w-4 h-4 shrink-0 text-slate-400"
                                    aria-label="Has notes"
                                  />
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {badge ? (
                                <span
                                  className={`${BADGE} ${badge.className} whitespace-nowrap`}
                                >
                                  {badge.label}
                                </span>
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {todo.tagged_users.length > 0 ? (
                                <TagAvatars users={todo.tagged_users} />
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">
                              <span
                                className="block max-w-48 truncate"
                                title={todo.created_by?.name || undefined}
                              >
                                {todo.created_by?.name || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                              {formatCreated(todo.createdAt)}
                            </td>
                            {isCompletedTab && (
                              <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                                {formatDateTime(todo.completed_at) || "—"}
                                {todo.completed_by && (
                                  <span className="block text-xs text-slate-500">
                                    by {todo.completed_by.name}
                                  </span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fixed pagination footer */}
            {!loading && !error && paginatedTodos.length > 0 && (
              <PaginationFooter
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                currentPage={page}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                showItemsPerPage={true}
              />
            )}
          </div>
        </div>
      </main>

      {todos.detail && (
        <TodoDetailModal
          key={todos.detail.id}
          todo={todos.detail}
          canManage={todos.canManage(todos.detail)}
          onClose={todos.closeDetail}
          onToggle={todos.toggleTodo}
          onSaveNotes={todos.saveNotes}
          onEdit={todos.openForm}
          onDelete={todos.deleteTodo}
        />
      )}

      {todos.formTodo !== undefined && (
        <TodoFormModal
          todo={todos.formTodo}
          currentUserId={todos.currentUserId}
          getToken={todos.readToken}
          onClose={todos.closeForm}
          onSaved={todos.handleSaved}
        />
      )}
    </AdminShell>
  );
}
