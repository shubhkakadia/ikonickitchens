import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/auth-middleware";
import { cleanupSessionsAPI } from "@/lib/session-cleanup";

// This route is protected and only accessible to admin users
export const POST = withAdminAuth(async (request, sessionData) => {
  try {
    const result = await cleanupSessionsAPI(request);

    return NextResponse.json(result, {
      status: result.status ? 200 : 500,
    });
  } catch (error) {
    console.error("Session cleanup route error:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
        error: error.message,
      },
      { status: 500 }
    );
  }
});
