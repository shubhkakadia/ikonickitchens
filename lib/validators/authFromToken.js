import { prisma } from "@/lib/db";

export async function getUserFromToken(req) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    const sessionToken = authHeader.substring(7);

    const session = await prisma.sessions.findUnique({
      where: {
        token: sessionToken,
      },
    });

    if (!session) {
      return null;
    }

    return session;
  } catch (error) {
    console.error("Error validating session token:", error);
    return null;
  }
}

export async function isAdmin(req) {
  const session = await getUserFromToken(req);
  return (
    session &&
    (session.user_type.toLowerCase() === "admin" ||
      session.user_type.toLowerCase() === "master-admin" ||
      session.user_type.toLowerCase() === "manager")
  );
}

// Helper function to convert empty strings to null for DateTime fields
export const processDateTimeField = (value) => {
  if (value === "" || value === undefined) return new Date("2000-01-01");
  // If it's already a valid date string, return it
  if (value instanceof Date || !isNaN(Date.parse(value)))
    return new Date(value);
  return new Date("2000-01-01");
};

// Helper function to check if session is expired
// true if expired, false if not expired
export async function isSessionExpired(req) {
  const session = await getUserFromToken(req);
  return session ? new Date() > new Date(session.expires_at) : false;
}

//   CREATE
// UPDATE
// DELETE
// STATUS_CHANGE
// ASSIGN
// UPLOAD
// OTHER
// Logs Middleware
// export async function logMiddleware(req, res, next) {
//   const session = await getUserFromToken(req);
//   if (session) {
//     return await prisma.logs.create({
//       data: {
//         user_id: session.user_id,
//         entity_type: req.body.entity_type,
//         entity_id: req.body.entity_id,
//         action: req.body.action,
//         description: req.body.description || null,
//       },
//     });
//   }
// }
