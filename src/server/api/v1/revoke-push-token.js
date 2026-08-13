import "server-only";

import crypto from "crypto";

import { apiError, apiSuccess } from "@/lib/api/response";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";

const REVOCATION_HASH_BYTES = 32;
const revokeRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many revocation attempts, please try again later.",
  keyGenerator: (request) => {
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded
      ? forwarded.split(",")[0].trim()
      : request.headers.get("x-real-ip") || "unknown";
    return `push-revoke:${ip}`;
  },
});

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function hashHandle(handle) {
  return crypto.createHash("sha256").update(handle, "utf8").digest();
}

function handlesMatch(handle, storedHash) {
  if (typeof handle !== "string" || handle.length < 32 || handle.length > 256) {
    return false;
  }
  if (typeof storedHash !== "string" || !/^[a-f0-9]{64}$/i.test(storedHash)) {
    return false;
  }

  return crypto.timingSafeEqual(
    hashHandle(handle),
    Buffer.from(storedHash, "hex").subarray(0, REVOCATION_HASH_BYTES),
  );
}

export async function revokePushToken(request) {
  try {
    const rateLimitResult = await revokeRateLimit(request);
    if (!rateLimitResult.success) {
      return apiError(
        rateLimitResult.message,
        429,
        { retryAfter: rateLimitResult.retryAfter },
        { "Retry-After": rateLimitResult.retryAfter.toString() },
      );
    }

    const body = await readJson(request);
    const registrationId = body?.registration_id;
    const revocationHandle = body?.revocation_handle;

    if (
      typeof registrationId !== "string" ||
      registrationId.length === 0 ||
      registrationId.length > 191 ||
      typeof revocationHandle !== "string"
    ) {
      return apiError(
        "registration_id and revocation_handle are required",
        400,
      );
    }

    const registration = await prisma.push_tokens.findUnique({
      where: { id: registrationId },
      select: {
        id: true,
        revocation_handle_hash: true,
      },
    });

    if (
      registration &&
      handlesMatch(revocationHandle, registration.revocation_handle_hash)
    ) {
      await prisma.push_tokens.updateMany({
        where: {
          id: registration.id,
          revocation_handle_hash: registration.revocation_handle_hash,
        },
        data: {
          enabled: false,
          session_id: null,
          disabled_at: new Date(),
        },
      });
    }

    // Do not reveal whether a registration exists or a handle matched.
    return apiSuccess(undefined);
  } catch (error) {
    console.error("Scoped push token revocation error:", error);
    return apiError("Internal server error");
  }
}
