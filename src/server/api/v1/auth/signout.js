import "server-only";

import { prisma } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/api/response";

export async function signout(request) {
  try {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return apiError("No valid session token provided", 401);
    }

    const sessionToken = authHeader.substring(7);
    const session = await prisma.sessions.findUnique({
      where: { token: sessionToken },
    });

    if (!session) {
      return apiError("Session not found or already expired", 404);
    }

    await prisma.$transaction([
      prisma.push_tokens.updateMany({
        where: { session_id: session.id },
        data: {
          enabled: false,
          session_id: null,
        },
      }),
      prisma.sessions.delete({
        where: { id: session.id },
      }),
    ]);

    return apiSuccess(undefined, "Logout successful");
  } catch (error) {
    console.error("Signout error:", error);
    return apiError("Internal server error");
  }
}
