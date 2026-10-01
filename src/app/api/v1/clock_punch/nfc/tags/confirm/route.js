import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  hashNfcSecret,
  jsonNfcError,
  nfcTagPublicSelect,
  normalizeNfcSecret,
  readNfcJsonBody,
  requireNfcAdmin,
} from "@/lib/nfcPunchTag";
import { withLogging } from "@/lib/withLogging";

export async function POST(request) {
  try {
    const { error: authError } = await requireNfcAdmin(request);
    if (authError) return authError;

    const { body, error: bodyError } = await readNfcJsonBody(request);
    if (bodyError) return bodyError;

    const tagId = typeof body?.tag_id === "string" ? body.tag_id.trim() : "";
    const tagToken = normalizeNfcSecret(body?.tag_token);

    if (!tagId) return jsonNfcError("tag_id is required", 400);
    if (!tagToken) return jsonNfcError("A valid tag_token is required", 400);

    const tagTokenHash = hashNfcSecret(tagToken);
    const tag = await prisma.nfc_punch_tag.findFirst({
      where: { id: tagId, is_deleted: false },
      select: {
        ...nfcTagPublicSelect(),
        token_hash: true,
        pending_token_hash: true,
      },
    });

    if (!tag) return jsonNfcError("NFC punch tag not found", 404);

    // Confirmation retries are safe after the first request has committed.
    if (tag.token_hash === tagTokenHash && !tag.pending_token_hash) {
      return NextResponse.json({
        status: true,
        message: "NFC tag was already confirmed",
        data: {
          id: tag.id,
          name: tag.name,
          location: tag.location,
          is_active: tag.is_active,
          is_deleted: tag.is_deleted,
          provisioning_expires_at: tag.provisioning_expires_at,
          createdAt: tag.createdAt,
          updatedAt: tag.updatedAt,
        },
        idempotent_replay: true,
      });
    }

    if (tag.pending_token_hash !== tagTokenHash) {
      return jsonNfcError(
        "The provisioning request does not match this NFC tag",
        409,
      );
    }

    if (
      !tag.provisioning_expires_at ||
      tag.provisioning_expires_at <= new Date()
    ) {
      return jsonNfcError(
        "The NFC provisioning request has expired. Prepare and write a new token.",
        410,
      );
    }

    const confirmation = await prisma.nfc_punch_tag.updateMany({
      where: {
        id: tag.id,
        is_deleted: false,
        pending_token_hash: tagTokenHash,
        provisioning_expires_at: { gt: new Date() },
      },
      data: {
        token_hash: tagTokenHash,
        pending_token_hash: null,
        provisioning_expires_at: null,
        is_active: true,
      },
    });

    if (confirmation.count !== 1) {
      return jsonNfcError(
        "The provisioning request changed before it could be confirmed",
        409,
      );
    }

    const confirmedTag = await prisma.nfc_punch_tag.findUnique({
      where: { id: tag.id },
      select: nfcTagPublicSelect(),
    });

    await withLogging(
      request,
      "nfc_punch_tag",
      tag.id,
      "UPDATE",
      `NFC tag token confirmed for ${tag.name} (${tag.location})`,
    );

    return NextResponse.json({
      status: true,
      message: "NFC tag token confirmed and activated",
      data: confirmedTag,
    });
  } catch (error) {
    console.error(
      "Error in POST /api/v1/clock_punch/nfc/tags/confirm:",
      error,
    );
    return jsonNfcError("Internal server error", 500);
  }
}
