import "server-only"

import { prisma } from "@/lib/db"
import { apiError, apiSuccess } from "@/lib/api/response"

export async function signout(request) {
  try {
    const authHeader = request.headers.get("Authorization")

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return apiError("No valid session token provided", 401)
    }

    const sessionToken = authHeader.substring(7)
    const deletedSession = await prisma.sessions.deleteMany({
      where: { token: sessionToken },
    })

    if (deletedSession.count === 0) {
      return apiError("Session not found or already expired", 404)
    }

    return apiSuccess(undefined, "Logout successful")
  } catch (error) {
    console.error("Signout error:", error)
    return apiError("Internal server error")
  }
}
