// Shared shape for the dashboard to-do routes: one Prisma include and one
// presenter so every endpoint returns tasks identically.

const USER_SELECT = {
  id: true,
  username: true,
  employee: { select: { first_name: true, last_name: true } },
};

export const TODO_INCLUDE = {
  created_by: { select: USER_SELECT },
  completed_by: { select: USER_SELECT },
  tagged_users: { select: USER_SELECT, orderBy: { username: "asc" } },
};

export const TITLE_MAX_LENGTH = 191;

export function presentUser(user) {
  if (!user) return null;
  const fullName = user.employee
    ? `${user.employee.first_name || ""} ${user.employee.last_name || ""}`.trim()
    : "";
  return { id: user.id, username: user.username, name: fullName || user.username };
}

export function presentTodo(todo) {
  return {
    id: todo.id,
    title: todo.title,
    notes: todo.notes,
    // Date-only; stored as UTC midnight, so the client reads the YYYY-MM-DD part.
    due_date: todo.due_date ? todo.due_date.toISOString() : null,
    is_completed: todo.is_completed,
    completed_at: todo.completed_at ? todo.completed_at.toISOString() : null,
    completed_by: presentUser(todo.completed_by),
    created_by: presentUser(todo.created_by),
    tagged_users: (todo.tagged_users || []).map(presentUser),
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
  };
}

// A task belongs to its creator and to everyone tagged on it.
export function participantWhere(userId) {
  return {
    is_deleted: false,
    OR: [{ created_by_id: userId }, { tagged_users: { some: { id: userId } } }],
  };
}

export function canManageTodo(auth, todo) {
  return auth.userType === "master-admin" || todo.created_by_id === auth.user.id;
}

// Accepts "YYYY-MM-DD" or an ISO string; returns a Date at UTC midnight, null
// when empty, or undefined when the value is not a valid date.
export function parseDueDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const day = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return undefined;
  const date = new Date(`${day}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
