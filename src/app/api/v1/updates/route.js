import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/validators/authFromToken";
import {
  UPDATE_ACTOR_INCLUDE,
  UPDATE_TYPES,
  feedWhere,
  presentUpdate,
} from "@/lib/updates";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

// The caller's own updates, newest first, limited to the modules they can
// currently access.
//   ?unread=1        -> only unread
//   ?type=STAGE_...  -> a single update type
//   ?limit=N&skip=N  -> paging
export async function GET(request) {
  try {
    const { error, auth } = await authorizeRequest(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "1";
    const typeParam = searchParams.get("type");
    const type = UPDATE_TYPES.includes(typeParam) ? typeParam : null;
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get("limit"), 10) || DEFAULT_PAGE_SIZE),
    );
    const skip = Math.max(0, parseInt(searchParams.get("skip"), 10) || 0);

    const [rows, unreadCount] = await Promise.all([
      prisma.update_recipient.findMany({
        where: feedWhere(auth, { unread: unreadOnly, type }),
        include: { update: { include: { actor: UPDATE_ACTOR_INCLUDE } } },
        orderBy: [{ update: { updatedAt: "desc" } }, { id: "desc" }],
        skip,
        take: limit + 1,
      }),
      prisma.update_recipient.count({
        where: feedWhere(auth, { unread: true }),
      }),
    ]);

    const hasMore = rows.length > limit;

    return NextResponse.json({
      status: true,
      message: "Updates fetched successfully",
      data: {
        updates: rows.slice(0, limit).map(presentUpdate),
        unread_count: unreadCount,
        hasMore,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/v1/updates:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 },
    );
  }
}
