import { prisma } from "@/lib/db";
import { getUserFromToken } from "@/lib/validators/authFromToken";

export async function withLogging(
  req,
  entityType,
  entityId,
  action,
  description,
) {
  try {
    const session = await getUserFromToken(req);
    if (session && action) {
      await prisma.logs.create({
        data: {
          user_id: session.user_id || "unknown",
          entity_type: entityType,
          entity_id: entityId,
          action,
          description,
        },
      });
      return true;
    }
  } catch (error) {
    console.error("Error logging:", error);
    return false;
  }
}
