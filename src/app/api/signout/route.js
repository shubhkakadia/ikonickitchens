import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request) {
  try {
    // Get the session token from Authorization header
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          status: false,
          message: "No valid session token provided",
        },
        { status: 401 }
      );
    }

    const sessionToken = authHeader.substring(7); // Remove "Bearer " prefix

    // Find and delete the session from database
    const deletedSession = await prisma.sessions.deleteMany({
      where: {
        token: sessionToken,
      },
    });

    if (deletedSession.count === 0) {
      return NextResponse.json(
        {
          status: false,
          message: "Session not found or already expired",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: "Logout successful",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Signout error:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
