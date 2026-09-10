import "server-only";

import crypto from "crypto";
import { Expo } from "expo-server-sdk";

import { apiError, apiSuccess } from "@/lib/api/response";
import { withAuth } from "@/lib/auth-middleware";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";

const SUPPORTED_PLATFORMS = new Set(["ios", "android"]);
const REVOCATION_HANDLE_BYTES = 32;
const BUILD_PROFILE_MAX_LENGTH = 64;
const BUILD_PROFILE_PATTERN = /^[a-zA-Z0-9._-]+$/;
const pushTokenRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: "Too many push token changes, please try again later.",
  keyGenerator: (request) => {
    const authorization = request.headers.get("authorization") || "unknown";
    const digest = crypto
      .createHash("sha256")
      .update(authorization)
      .digest("hex");
    return `push-token:${digest}`;
  },
});

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function validateExpoPushToken(expoPushToken) {
  return (
    typeof expoPushToken === "string" &&
    expoPushToken.length <= 191 &&
    Expo.isExpoPushToken(expoPushToken)
  );
}

/**
 * The build profile is a diagnostic only: it records which EAS build minted the
 * token so a permanent delivery error can be traced back to an APNs
 * environment. It is never an authorization input, so an unusable value is
 * dropped rather than rejected.
 */
function normalizeBuildProfile(buildProfile) {
  if (typeof buildProfile !== "string") return null;

  const trimmed = buildProfile.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > BUILD_PROFILE_MAX_LENGTH ||
    !BUILD_PROFILE_PATTERN.test(trimmed)
  ) {
    return null;
  }

  return trimmed;
}

function createRevocationHandle() {
  return crypto.randomBytes(REVOCATION_HANDLE_BYTES).toString("base64url");
}

function hashRevocationHandle(handle) {
  return crypto.createHash("sha256").update(handle, "utf8").digest("hex");
}

async function enforceRateLimit(request) {
  const result = await pushTokenRateLimit(request);
  if (result.success) return null;

  return apiError(
    result.message,
    429,
    {
      retryAfter: result.retryAfter,
    },
    {
      "Retry-After": result.retryAfter.toString(),
    },
  );
}

async function registerPushToken(request, sessionData) {
  try {
    const rateLimitError = await enforceRateLimit(request);
    if (rateLimitError) return rateLimitError;

    const body = await readJson(request);

    if (!body || !validateExpoPushToken(body.expo_push_token)) {
      return apiError("A valid expo_push_token is required", 400);
    }

    if (!SUPPORTED_PLATFORMS.has(body.platform)) {
      return apiError("platform must be either ios or android", 400);
    }

    if (body.user_id !== undefined || body.userId !== undefined) {
      return apiError("Token ownership is derived from authentication", 400);
    }

    const now = new Date();
    const buildProfile = normalizeBuildProfile(body.build_profile);
    const revocationHandle = createRevocationHandle();
    const revocationHandleHash = hashRevocationHandle(revocationHandle);

    const pushToken = await prisma.$transaction(async (tx) => {
      const registration = await tx.push_tokens.upsert({
        where: { expo_push_token: body.expo_push_token },
        create: {
          user_id: sessionData.userId,
          session_id: sessionData.sessionId,
          expo_push_token: body.expo_push_token,
          platform: body.platform,
          build_profile: buildProfile,
          enabled: true,
          revocation_handle_hash: revocationHandleHash,
          consented_at: now,
          disabled_at: null,
          disabled_reason: null,
          last_registered_at: now,
        },
        // Re-registration is the only recovery path for a row the receipt
        // worker disabled, so it must clear the whole disable/error record.
        update: {
          user_id: sessionData.userId,
          session_id: sessionData.sessionId,
          platform: body.platform,
          // A client that reports no profile must not erase the last known
          // one. With EAS Update an older JS bundle can run on a preview
          // native build, and nulling the column would make that sandbox
          // registration eligible for production sends again.
          ...(buildProfile ? { build_profile: buildProfile } : {}),
          enabled: true,
          revocation_handle_hash: revocationHandleHash,
          consented_at: now,
          disabled_at: null,
          disabled_reason: null,
          last_registered_at: now,
          last_error_code: null,
          last_error: null,
          last_error_at: null,
        },
      });

      await tx.logs.create({
        data: {
          user_id: sessionData.userId,
          entity_type: "push_token",
          entity_id: registration.id,
          action: "UPDATE",
          description: `Registered an ${body.platform} push notification device${buildProfile ? ` (${buildProfile} build)` : ""}`,
        },
      });

      return registration;
    });

    return apiSuccess({
      registration_id: pushToken.id,
      revocation_handle: revocationHandle,
    });
  } catch (error) {
    console.error("Push token registration error:", error);
    return apiError("Internal server error");
  }
}

async function disablePushToken(request, sessionData) {
  try {
    const rateLimitError = await enforceRateLimit(request);
    if (rateLimitError) return rateLimitError;

    const body = await readJson(request);

    if (!body || !validateExpoPushToken(body.expo_push_token)) {
      return apiError("A valid expo_push_token is required", 400);
    }

    if (body.user_id !== undefined || body.userId !== undefined) {
      return apiError("Token ownership is derived from authentication", 400);
    }

    const disabled = await prisma.push_tokens.updateMany({
      where: {
        expo_push_token: body.expo_push_token,
        user_id: sessionData.userId,
      },
      data: {
        enabled: false,
        session_id: null,
        disabled_at: new Date(),
        disabled_reason: "user_disabled",
      },
    });

    if (disabled.count > 0) {
      await prisma.logs.create({
        data: {
          user_id: sessionData.userId,
          entity_type: "push_token",
          entity_id: sessionData.userId,
          action: "UPDATE",
          description: "Disabled a push notification device",
        },
      });
    }

    return apiSuccess(null);
  } catch (error) {
    console.error("Push token disable error:", error);
    return apiError("Internal server error");
  }
}

export const POST = withAuth(registerPushToken);
export const DELETE = withAuth(disablePushToken);
