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

export async function POST(request) {
  try {
    const { error: authError } = await requireNfcAdmin(request);
    if (authError) return authError;

    const { body, error: bodyError } = await readNfcJsonBody(request);
    if (bodyError) return bodyError;

    const tagToken = normalizeNfcSecret(body?.tag_token);
    if (!tagToken) return jsonNfcError("A valid tag_token is required", 400);

    const tokenHash = hashNfcSecret(tagToken);
    const tag = await prisma.nfc_punch_tag.findFirst({
      where: {
        is_deleted: false,
        OR: [{ token_hash: tokenHash }, { pending_token_hash: tokenHash }],
      },
      select: {
        ...nfcTagPublicSelect(),
        token_hash: true,
        pending_token_hash: true,
      },
    });

    if (!tag) return jsonNfcError("NFC punch tag not found", 404);

    const isPendingToken = tag.pending_token_hash === tokenHash;
    const tokenState = isPendingToken
      ? tag.provisioning_expires_at &&
        tag.provisioning_expires_at <= new Date()
        ? "PENDING_EXPIRED"
        : "PENDING_CONFIRMATION"
      : "CURRENT";
    const { token_hash, pending_token_hash, ...publicTag } = tag;
    void token_hash;
    void pending_token_hash;

    return NextResponse.json({
      status: true,
      message: "NFC punch tag identified",
      data: { ...publicTag, token_state: tokenState },
    });
  } catch (error) {
    console.error(
      "Error in POST /api/v1/clock_punch/nfc/tags/inspect:",
      error,
    );
    return jsonNfcError("Internal server error", 500);
  }
}
