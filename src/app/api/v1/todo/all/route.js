import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/validators/authFromToken";
import { TODO_INCLUDE, participantWhere, presentTodo } from "@/lib/todoData";

const COMPLETED_PAGE_SIZE = 20;

// Tasks the caller created or is tagged on.
//   ?status=active                 -> open tasks, soonest due first
//   ?status=completed&skip=N       -> history, newest completion first (paged)
// Both responses carry the tab counts.
export async function GET(request) {
  try {
    const { error, auth } = await authorizeRequest(request, {
      modules: ["dashboard"],
    });
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") === "completed" ? "completed" : "active";
    const base = participantWhere(auth.user.id);

    const [activeCount, completedCount] = await Promise.all([
      prisma.todo.count({ where: { ...base, is_completed: false } }),
      prisma.todo.count({ where: { ...base, is_completed: true } }),
    ]);

    let todos;
    let hasMore = false;

    if (status === "active") {
      todos = await prisma.todo.findMany({
        where: { ...base, is_completed: false },
        include: TODO_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
      // MySQL has no NULLS LAST: undated tasks go after dated ones, each group
      // keeping newest-first order from the query (sort is stable).
      todos.sort((a, b) => {
        if (a.due_date && b.due_date) return a.due_date - b.due_date;
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      });
    } else {
      const skip = Math.max(0, parseInt(searchParams.get("skip"), 10) || 0);
      const page = await prisma.todo.findMany({
        where: { ...base, is_completed: true },
        include: TODO_INCLUDE,
        orderBy: { completed_at: "desc" },
        skip,
        take: COMPLETED_PAGE_SIZE + 1,
      });
      hasMore = page.length > COMPLETED_PAGE_SIZE;
      todos = page.slice(0, COMPLETED_PAGE_SIZE);
    }

    return NextResponse.json({
      status: true,
      message: "Tasks fetched successfully",
      data: {
        todos: todos.map(presentTodo),
        counts: { active: activeCount, completed: completedCount },
        hasMore,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/v1/todo/all:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
