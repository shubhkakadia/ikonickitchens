import { NextResponse } from "next/server";
import { authenticateRequest } from "./session";

export function withAuth(handler) {
  return async function (request, ...args) {
    try {
      const authResult = await authenticateRequest(request);

      if (!authResult.success) {
        return NextResponse.json(
          {
            status: false,
            message: authResult.error,
          },
          { status: authResult.statusCode }
        );
      }

      // Call the original handler with session data
      return await handler(request, authResult.sessionData, ...args);
    } catch (error) {
      console.error("Auth middleware error:", error);
      return NextResponse.json(
        {
          status: false,
          message: "Authentication failed",
          error: error.message,
        },
        { status: 500 }
      );
    }
  };
}

export function withUserType(allowedTypes) {
  return function (handler) {
    return withAuth(async function (request, sessionData, ...args) {
      if (!allowedTypes.includes(sessionData.userType)) {
        return NextResponse.json(
          {
            status: false,
            message: "Insufficient permissions",
          },
          { status: 403 }
        );
      }

      return await handler(request, sessionData, ...args);
    });
  };
}

export const withAdminAuth = withUserType(["admin", "master-admin"]);


export const withMasterAdminAuth = withUserType(["master-admin"]);
