import "server-only";

import crypto from "node:crypto";
import { NextResponse } from "next/server";

import {
  authenticateClockPunchRequest,
  isClockPunchReviewer,
} from "@/lib/clockPunch";

export const NFC_TAG_TOKEN_BYTES = 32;
export const NFC_PROVISIONING_TTL_MINUTES = 15;
export const MIN_NFC_TAG_TOKEN_LENGTH = 32;
export const MAX_NFC_TAG_TOKEN_LENGTH = 512;

export function createNfcSecret(bytes = NFC_TAG_TOKEN_BYTES) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function hashNfcSecret(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function normalizeNfcSecret(value) {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (
    normalized.length < MIN_NFC_TAG_TOKEN_LENGTH ||
    normalized.length > MAX_NFC_TAG_TOKEN_LENGTH
  ) {
    return null;
  }

  return normalized;
}

export function getNfcProvisioningExpiry(now = new Date()) {
  return new Date(
    now.getTime() + NFC_PROVISIONING_TTL_MINUTES * 60 * 1000,
  );
}

export function nfcTagPublicSelect() {
  return {
    id: true,
    name: true,
    location: true,
    is_active: true,
    is_deleted: true,
    provisioning_expires_at: true,
    createdAt: true,
    updatedAt: true,
  };
}

export function jsonNfcError(message, status, data) {
  return NextResponse.json(
    { status: false, message, ...(data === undefined ? {} : { data }) },
    { status },
  );
}

export async function readNfcJsonBody(request) {
  try {
    return { body: await request.json(), error: null };
  } catch {
    return {
      body: null,
      error: jsonNfcError("A valid JSON body is required", 400),
    };
  }
}

export async function requireNfcAdmin(request) {
  const auth = await authenticateClockPunchRequest(request);
  if (auth.error) return auth;

  if (!isClockPunchReviewer(auth.session.userType)) {
    return {
      error: jsonNfcError(
        "Only administrators can manage NFC punch tags",
        403,
      ),
      session: auth.session,
    };
  }

  return auth;
}
