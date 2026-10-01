import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  jsonNfcError,
  nfcTagPublicSelect,
  readNfcJsonBody,
  requireNfcAdmin,
} from "@/lib/nfcPunchTag";
import { withLogging } from "@/lib/withLogging";

const MAX_TAG_FIELD_LENGTH = 191;

function normalizeOptionalField(value, fieldName) {
  if (value === undefined) return { value: undefined };
  if (typeof value !== "string") {
    return { error: `${fieldName} must be a string` };
  }

  const normalized = value.trim();
  if (!normalized) return { error: `${fieldName} cannot be empty` };
  if (normalized.length > MAX_TAG_FIELD_LENGTH) {
    return {
      error: `${fieldName} cannot exceed ${MAX_TAG_FIELD_LENGTH} characters`,
    };
  }

  return { value: normalized };
}

export async function PATCH(request, { params }) {
  try {
    const { error: authError } = await requireNfcAdmin(request);
    if (authError) return authError;

    const { id } = await params;
    const { body, error: bodyError } = await readNfcJsonBody(request);
    if (bodyError) return bodyError;

    const name = normalizeOptionalField(body?.name, "name");
    if (name.error) return jsonNfcError(name.error, 400);
    const location = normalizeOptionalField(body?.location, "location");
    if (location.error) return jsonNfcError(location.error, 400);

    if (
      body?.is_active !== undefined &&
      typeof body.is_active !== "boolean"
    ) {
      return jsonNfcError("is_active must be a boolean", 400);
    }
    if (
      body?.cancel_provisioning !== undefined &&
      typeof body.cancel_provisioning !== "boolean"
    ) {
      return jsonNfcError("cancel_provisioning must be a boolean", 400);
    }

    const tag = await prisma.nfc_punch_tag.findFirst({
      where: { id, is_deleted: false },
      select: { id: true, token_hash: true },
    });
    if (!tag) return jsonNfcError("NFC punch tag not found", 404);

    if (body?.is_active === true && !tag.token_hash) {
      return jsonNfcError(
        "An NFC tag cannot be activated until its token is confirmed",
        409,
      );
    }

    const data = {
      ...(name.value === undefined ? {} : { name: name.value }),
      ...(location.value === undefined
        ? {}
        : { location: location.value }),
      ...(body?.is_active === undefined
        ? {}
        : { is_active: body.is_active }),
      ...(body?.cancel_provisioning
        ? {
            pending_token_hash: null,
            provisioning_expires_at: null,
          }
        : {}),
    };

    if (Object.keys(data).length === 0) {
      return jsonNfcError("No supported fields were provided", 400);
    }

    const updatedTag = await prisma.nfc_punch_tag.update({
      where: { id },
      data,
      select: nfcTagPublicSelect(),
    });

    await withLogging(
      request,
      "nfc_punch_tag",
      id,
      "UPDATE",
      body?.cancel_provisioning
        ? `NFC tag provisioning cancelled for ${updatedTag.name}`
        : `NFC tag settings updated for ${updatedTag.name}`,
    );

    return NextResponse.json({
      status: true,
      message: "NFC punch tag updated successfully",
      data: updatedTag,
    });
  } catch (error) {
    console.error("Error in PATCH /api/v1/clock_punch/nfc/tags/[id]:", error);
    return jsonNfcError("Internal server error", 500);
  }
}

export async function DELETE(request, { params }) {
  try {
    const { error: authError } = await requireNfcAdmin(request);
    if (authError) return authError;

    const { id } = await params;
    const existingTag = await prisma.nfc_punch_tag.findUnique({
      where: { id },
      select: nfcTagPublicSelect(),
    });
    if (!existingTag) return jsonNfcError("NFC punch tag not found", 404);

    if (existingTag.is_deleted) {
      return NextResponse.json({
        status: true,
        message: "NFC punch tag was already removed",
        data: existingTag,
        idempotent_replay: true,
      });
    }

    const tag = await prisma.nfc_punch_tag.update({
      where: { id },
      data: {
        is_active: false,
        is_deleted: true,
        pending_token_hash: null,
        provisioning_expires_at: null,
      },
      select: nfcTagPublicSelect(),
    });

    await withLogging(
      request,
      "nfc_punch_tag",
      id,
      "DELETE",
      `NFC punch tag soft-deleted: ${existingTag.name}`,
    );

    return NextResponse.json({
      status: true,
      message: "NFC punch tag removed successfully",
      data: tag,
    });
  } catch (error) {
    console.error("Error in DELETE /api/v1/clock_punch/nfc/tags/[id]:", error);
    return jsonNfcError("Internal server error", 500);
  }
}
