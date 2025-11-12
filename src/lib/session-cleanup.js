import { cleanupExpiredSessions } from "./session";

/**
 * Clean up expired sessions
 * This function should be called periodically (e.g., every hour)
 * You can set up a cron job or use a service like Vercel Cron
 */
export async function performSessionCleanup() {
  try {
    const cleanedCount = await cleanupExpiredSessions();
    return cleanedCount;
  } catch (error) {
    console.error("Session cleanup failed:", error);
    throw error;
  }
}

/**
 * API route for manual session cleanup (for testing or manual triggers)
 * POST /api/admin/cleanup-sessions
 */
export async function cleanupSessionsAPI(request) {
  try {
    const cleanedCount = await performSessionCleanup();
    
    return {
      status: true,
      message: `Successfully cleaned up ${cleanedCount} expired sessions`,
      data: { cleanedCount },
    };
  } catch (error) {
    console.error("Session cleanup API error:", error);
    return {
      status: false,
      message: "Session cleanup failed",
      error: error.message,
    };
  }
}
