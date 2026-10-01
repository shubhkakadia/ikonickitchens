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

// Helper function to convert empty strings to null for DateTime fields
export const processDateTimeField = (value) => {
  // Return null for null, empty string, or undefined
  if (value === null || value === "" || value === undefined) return null;
  // If it's already a valid date string, return it
  if (value instanceof Date || !isNaN(Date.parse(value)))
    return new Date(value);
  return null;
};

export const USER_TYPES = ["master-admin", "admin", "manager", "employee"];

// Office roles. "employee" accounts are limited to site photos and their own
// installer lots, so they must be opted in per route via `roles: ALL_ROLES`.
export const STAFF_ROLES = ["master-admin", "admin", "manager"];
export const ALL_ROLES = USER_TYPES;
export const MASTER_ADMIN_ONLY = ["master-admin"];

function authFailure(message, status) {
  return NextResponse.json({ status: false, message }, { status });
}

/**
 * Authenticates and authorizes a request with a single session lookup.
 *
 * - roles:   user types allowed to call the route (default: STAFF_ROLES)
 * - modules: module_access flag name(s); the caller needs at least one of
 *            them. master-admin bypasses module checks.
 * - allowCookie: also accept the auth_token cookie when there is no
 *            Authorization header. Only for read-only GETs such as file
 *            serving, where <img>/<video> tags can't send a Bearer header.
 *
 * Returns { error } with a ready-made response on failure, otherwise
 * { auth: { session, user, userType, moduleAccess } }. The role and
 * permissions come from the live users row, not the copy on the session.
 */
function getRequestToken(req, allowCookie) {
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) return authHeader.substring(7);
  if (allowCookie) return req.cookies?.get("auth_token")?.value || null;
  return null;
}

export async function authorizeRequest(
  req,
  { roles = STAFF_ROLES, modules, allowCookie = false } = {},
) {
  const token = getRequestToken(req, allowCookie);
  if (!token) {
    return { error: authFailure("Unauthorized", 401) };
  }

  let session;
  try {
    session = await prisma.sessions.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            user_type: true,
            is_active: true,
            employee_id: true,
            module_access: true,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error validating session token:", error);
    return { error: authFailure("Unauthorized", 401) };
  }

  if (!session || !session.user) {
    return { error: authFailure("Unauthorized", 401) };
  }
  if (new Date() > new Date(session.expires_at)) {
    return { error: authFailure("Session expired", 401) };
  }
  if (!session.user.is_active) {
    return { error: authFailure("Account is inactive", 401) };
  }

  const userType = session.user.user_type.toLowerCase();
  if (!roles.includes(userType)) {
    return { error: authFailure("Insufficient permissions", 403) };
  }

  const moduleAccess = session.user.module_access;
  if (modules && userType !== "master-admin") {
    const required = Array.isArray(modules) ? modules : [modules];
    if (!required.some((key) => moduleAccess?.[key] === true)) {
      return { error: authFailure("Insufficient permissions", 403) };
    }
  }

  return {
    auth: { session, user: session.user, userType, moduleAccess },
  };
}

// True when the caller holds the module flag (master-admin always does)
export function hasModule(auth, key) {
  return auth.userType === "master-admin" || auth.moduleAccess?.[key] === true;
}

// Drop-in variant of authorizeRequest that returns the error response or null
export async function requireAuth(req, options) {
  const { error } = await authorizeRequest(req, options);
  return error ?? null;
}

// "employee" users may only work on lots where they are the installer
export function canAccessLot(auth, lot) {
  if (auth.userType !== "employee") return true;
  return (
    Boolean(lot?.installer_id) && lot.installer_id === auth.user.employee_id
  );
}

export async function canAccessLotFile(auth, lotFileId) {
  if (auth.userType !== "employee") return true;
  const lotFile = await prisma.lot_file.findUnique({
    where: { id: lotFileId },
    select: { tab: { select: { lot: { select: { installer_id: true } } } } },
  });
  return canAccessLot(auth, lotFile?.tab?.lot);
}
