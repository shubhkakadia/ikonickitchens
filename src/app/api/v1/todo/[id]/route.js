import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
import {
  TITLE_MAX_LENGTH,
  TODO_INCLUDE,
  canManageTodo,
  parseDueDate,
  presentTodo,
} from "@/lib/todoData";

const fail = (message, status = 400) =>
  NextResponse.json({ status: false, message }, { status });

// Loads a live task the caller is allowed to touch: the creator, anyone tagged
// on it, or a master-admin. Anyone else gets the same 404 as a missing task so
// task ids can't be probed.
async function loadTodo(id, auth) {
  const todo = await prisma.todo.findFirst({
    where: { id, is_deleted: false },
    include: { tagged_users: { select: { id: true } } },
  });
  if (!todo) return null;
  const isParticipant =
    todo.created_by_id === auth.user.id ||
    todo.tagged_users.some((u) => u.id === auth.user.id);
  return isParticipant || auth.userType === "master-admin" ? todo : null;
}

// Participants can tick/untick and edit notes. Title, due date and tags are
// the creator's (or a master-admin's) to change.
export async function PATCH(request, { params }) {
  try {
    const { error, auth } = await authorizeRequest(request, {
      modules: ["dashboard"],
    });
    if (error) return error;

    const { id } = await params;
    const todo = await loadTodo(id, auth);
    if (!todo) return fail("Task not found", 404);

    const body = await request.json();
    const data = {};
    let toggled = false;

    if (body.is_completed !== undefined) {
      if (typeof body.is_completed !== "boolean") return fail("is_completed must be true or false");
      if (body.is_completed !== todo.is_completed) {
        toggled = true;
        data.is_completed = body.is_completed;
        data.completed_at = body.is_completed ? new Date() : null;
        data.completed_by_id = body.is_completed ? auth.user.id : null;
      }
    }

    if (body.notes !== undefined) {
      if (body.notes !== null && typeof body.notes !== "string") return fail("Notes must be text");
      data.notes = body.notes?.trim() ? body.notes.trim() : null;
    }

    const editsDetails =
      body.title !== undefined ||
      body.due_date !== undefined ||
      body.tagged_user_ids !== undefined;

    if (editsDetails) {
      if (!canManageTodo(auth, todo)) {
        return fail("Only the person who created this task can edit it", 403);
      }

      if (body.title !== undefined) {
        const title = typeof body.title === "string" ? body.title.trim() : "";
        if (!title) return fail("Title is required");
        if (title.length > TITLE_MAX_LENGTH) {
          return fail(`Title must be ${TITLE_MAX_LENGTH} characters or fewer`);
        }
        data.title = title;
      }

      if (body.due_date !== undefined) {
        const dueDate = parseDueDate(body.due_date);
        if (dueDate === undefined) return fail("Due date is not valid");
        data.due_date = dueDate;
      }

      if (body.tagged_user_ids !== undefined) {
        if (!Array.isArray(body.tagged_user_ids)) return fail("tagged_user_ids must be a list");
        // The creator is never tagged on their own task.
        const ids = [
          ...new Set(body.tagged_user_ids.filter((u) => typeof u === "string")),
        ].filter((u) => u !== todo.created_by_id);
        if (ids.length > 0) {
          const found = await prisma.users.count({
            where: { id: { in: ids }, is_active: true },
          });
          if (found !== ids.length) return fail("One or more tagged users were not found");
        }
        data.tagged_users = { set: ids.map((u) => ({ id: u })) };
      }
    }

    if (Object.keys(data).length === 0) {
      return fail("Nothing to update");
    }

    const updated = await prisma.todo.update({
      where: { id },
      data,
      include: TODO_INCLUDE,
    });

    const logged = await withLogging(
      request,
      "todo",
      id,
      toggled ? "STATUS_CHANGE" : "UPDATE",
      toggled
        ? `Task ${updated.is_completed ? "completed" : "reopened"}: ${updated.title}`
        : `Task updated: ${updated.title}`,
    );

    return NextResponse.json({
      status: true,
      message: "Task updated successfully",
      ...(logged ? {} : { warning: "Note: Update succeeded but logging failed" }),
      data: presentTodo(updated),
    });
  } catch (error) {
    console.error("Error in PATCH /api/v1/todo/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}

// Soft delete — the row stays for the audit trail.
export async function DELETE(request, { params }) {
  try {
    const { error, auth } = await authorizeRequest(request, {
      modules: ["dashboard"],
    });
    if (error) return error;

    const { id } = await params;
    const todo = await loadTodo(id, auth);
    if (!todo) return fail("Task not found", 404);

    if (!canManageTodo(auth, todo)) {
      return fail("Only the person who created this task can delete it", 403);
    }

    await prisma.todo.update({ where: { id }, data: { is_deleted: true } });

    const logged = await withLogging(
      request,
      "todo",
      id,
      "DELETE",
      `Task deleted: ${todo.title}`,
    );

    return NextResponse.json({
      status: true,
      message: "Task deleted successfully",
      ...(logged ? {} : { warning: "Note: Deletion succeeded but logging failed" }),
    });
  } catch (error) {
    console.error("Error in DELETE /api/v1/todo/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
