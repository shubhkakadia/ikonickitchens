import { prisma } from "./db";

/**
 * Validates a session token and returns session data if valid
 * @param {string} sessionToken - The session token to validate
 * @returns {Object|null} - Session data if valid, null if invalid
 */
export async function validateSession(sessionToken) {
  try {
    if (!sessionToken) {
      return null;
    }

    // Find the session in database
    const session = await prisma.sessions.findFirst({
      where: {
        token: sessionToken,
        expires_at: {
          gt: new Date(), // Session must not be expired
        },
      },
    });

    if (!session) {
      return null;
    }

    const user = await prisma.users.findUnique({
      where: {
        id: session.user_id,
      },
      select: {
        id: true,
        username: true,
        user_type: true,
        is_active: true,
        employee_id: true,
      },
    });

    // Check if user still exists and is active
    if (!user || !user.is_active) {
      // Delete the session if user no longer exists or is inactive
      await prisma.sessions.delete({
        where: { id: session.id },
      });
      return null;
    }

    return {
      sessionId: session.id,
      userId: session.user_id,
      // Use the live user type so role changes take effect immediately
      userType: user.user_type.toLowerCase(),
      expiresAt: session.expires_at,
      user,
    };
  } catch (error) {
    console.error("Session validation error:", error);
    return null;
  }
}

/**
 * Middleware function to authenticate requests using session tokens
 * @param {Request} request - The incoming request
 * @returns {Object} - Authentication result
 */
export async function authenticateRequest(request) {
  try {
    // Get the session token from Authorization header
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return {
        success: false,
        error: "No valid session token provided",
        statusCode: 401,
      };
    }

    const sessionToken = authHeader.substring(7); // Remove "Bearer " prefix
    const sessionData = await validateSession(sessionToken);

    if (!sessionData) {
      return {
        success: false,
        error: "Invalid or expired session",
        statusCode: 401,
      };
    }

    return {
      success: true,
      sessionData,
    };
  } catch (error) {
    console.error("Authentication error:", error);
    return {
      success: false,
      error: "Authentication failed",
      statusCode: 500,
    };
  }
}

/**
 * Clean up expired sessions (can be called periodically)
 */
export async function cleanupExpiredSessions() {
  try {
    const result = await prisma.sessions.deleteMany({
      where: {
        expires_at: {
          lt: new Date(), // Delete sessions that have expired
        },
      },
    });

    return result.count;
  } catch (error) {
    console.error("Session cleanup error:", error);
    return 0;
  }
}
