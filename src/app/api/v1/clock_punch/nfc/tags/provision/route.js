import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  createNfcSecret,
  getNfcProvisioningExpiry,
  hashNfcSecret,
  jsonNfcError,
  NFC_PROVISIONING_TTL_MINUTES,
  nfcTagPublicSelect,
  readNfcJsonBody,
  requireNfcAdmin,
} from "@/lib/nfcPunchTag";
import { withLogging } from "@/lib/withLogging";

const MAX_TAG_FIELD_LENGTH = 191;

function normalizeField(value, fieldName, required) {
  if (value === undefined && !required) return { value: undefined };
  if (typeof value !== "string") {
    return { error: `${fieldName} must be a string` };
  }

  const normalized = value.trim();
  if (!normalized) return { error: `${fieldName} is required` };
  if (normalized.length > MAX_TAG_FIELD_LENGTH) {
    return {
      error: `${fieldName} cannot exceed ${MAX_TAG_FIELD_LENGTH} characters`,
    };
  }

  return { value: normalized };
}

export async function POST(request) {
  try {
    const { error: authError } = await requireNfcAdmin(request);
    if (authError) return authError;

    const { body, error: bodyError } = await readNfcJsonBody(request);
    if (bodyError) return bodyError;

    if (body?.tag_id !== undefined && typeof body.tag_id !== "string") {
      return jsonNfcError("tag_id must be a string", 400);
    }

    const tagId = typeof body?.tag_id === "string" ? body.tag_id.trim() : "";
    if (body?.tag_id !== undefined && !tagId) {
      return jsonNfcError("tag_id cannot be empty", 400);
    }
    const isUpdate = Boolean(tagId);
    const name = normalizeField(body?.name, "name", !isUpdate);
    if (name.error) return jsonNfcError(name.error, 400);
    const location = normalizeField(body?.location, "location", !isUpdate);
    if (location.error) return jsonNfcError(location.error, 400);

    let existingTag = null;
    if (isUpdate) {
      existingTag = await prisma.nfc_punch_tag.findFirst({
        where: { id: tagId, is_deleted: false },
        select: { id: true },
      });

      if (!existingTag) return jsonNfcError("NFC punch tag not found", 404);
    }

    const tagToken = createNfcSecret();
    const expiresAt = getNfcProvisioningExpiry();
    const pendingData = {
      pending_token_hash: hashNfcSecret(tagToken),
      provisioning_expires_at: expiresAt,
      ...(name.value === undefined ? {} : { name: name.value }),
      ...(location.value === undefined
        ? {}
        : { location: location.value }),
    };

    const tag = isUpdate
      ? await prisma.nfc_punch_tag.update({
          where: { id: tagId },
          data: pendingData,
          select: nfcTagPublicSelect(),
        })
      : await prisma.nfc_punch_tag.create({
          data: {
            ...pendingData,
            name: name.value,
            location: location.value,
            is_active: false,
          },
          select: nfcTagPublicSelect(),
        });

    await withLogging(
      request,
      "nfc_punch_tag",
      tag.id,
      isUpdate ? "UPDATE" : "CREATE",
      `${isUpdate ? "NFC tag update" : "New NFC tag"} prepared for ${tag.name} (${tag.location})`,
    );

    return NextResponse.json(
      {
        status: true,
        message: `NFC tag ${isUpdate ? "update" : "creation"} prepared. Write the token and confirm within ${NFC_PROVISIONING_TTL_MINUTES} minutes.`,
        data: {
          tag,
          operation: isUpdate ? "UPDATE" : "CREATE",
          tag_token: tagToken,
          expires_at: expiresAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Error in POST /api/v1/clock_punch/nfc/tags/provision:",
      error,
    );
    return jsonNfcError("Internal server error", 500);
  }
}
