import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

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
      session.user_type.toLowerCase() === "manager" ||
      session.user_type.toLowerCase() === "employee")
  );
}

// Helper function to convert empty strings to null for DateTime fields
export const processDateTimeField = (value) => {
  // Return null for null, empty string, or undefined
  if (value === null || value === "" || value === undefined) return null;
  // If it's already a valid date string, return it
  if (value instanceof Date || !isNaN(Date.parse(value)))
    return new Date(value);
  return null;
};

// Helper function to check if session is expired
// true if expired, false if not expired
export async function isSessionExpired(req) {
  const session = await getUserFromToken(req);
  return session ? new Date() > new Date(session.expires_at) : false;
}

export async function validateAdminAuth(request) {
  const admin = await isAdmin(request);
  if (!admin) {
    return NextResponse.json(
      { status: false, message: "Unauthorized" },
      { status: 401 }
    );
  }
  if (await isSessionExpired(request)) {
    return NextResponse.json(
      { status: false, message: "Session expired" },
      { status: 401 }
    );
  }
  return null;
}


