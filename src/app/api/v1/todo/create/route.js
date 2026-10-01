import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/validators/authFromToken";
import { withLogging } from "@/lib/withLogging";
import {
  TITLE_MAX_LENGTH,
  TODO_INCLUDE,
  parseDueDate,
  presentTodo,
} from "@/lib/todoData";

const fail = (message, status = 400) =>
  NextResponse.json({ status: false, message }, { status });

export async function POST(request) {
  try {
    const { error, auth } = await authorizeRequest(request, {
      modules: ["dashboard"],
    });
    if (error) return error;

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return fail("Title is required");
    if (title.length > TITLE_MAX_LENGTH) {
      return fail(`Title must be ${TITLE_MAX_LENGTH} characters or fewer`);
    }

    const dueDate = parseDueDate(body.due_date);
    if (dueDate === undefined) return fail("Due date is not valid");

    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    // Tagging yourself is redundant (you already own the task), so drop it.
    const requestedIds = Array.isArray(body.tagged_user_ids)
      ? [...new Set(body.tagged_user_ids.filter((id) => typeof id === "string"))]
      : [];
    const taggedIds = requestedIds.filter((id) => id !== auth.user.id);

    if (taggedIds.length > 0) {
      const found = await prisma.users.count({
        where: { id: { in: taggedIds }, is_active: true },
      });
      if (found !== taggedIds.length) return fail("One or more tagged users were not found");
    }

    const todo = await prisma.todo.create({
      data: {
        title,
        notes: notes || null,
        due_date: dueDate,
        created_by_id: auth.user.id,
        tagged_users: { connect: taggedIds.map((id) => ({ id })) },
      },
      include: TODO_INCLUDE,
    });

    const logged = await withLogging(
      request,
      "todo",
      todo.id,
      "CREATE",
      `Task created: ${todo.title}`,
    );

    return NextResponse.json({
      status: true,
      message: "Task created successfully",
      ...(logged ? {} : { warning: "Note: Creation succeeded but logging failed" }),
      data: presentTodo(todo),
    });
  } catch (error) {
    console.error("Error in POST /api/v1/todo/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
