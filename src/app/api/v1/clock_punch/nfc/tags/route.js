import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import {
  jsonNfcError,
  nfcTagPublicSelect,
  requireNfcAdmin,
} from "@/lib/nfcPunchTag";

export async function GET(request) {
  try {
    const { error: authError } = await requireNfcAdmin(request);
    if (authError) return authError;

    const tags = await prisma.nfc_punch_tag.findMany({
      where: { is_deleted: false },
      select: {
        ...nfcTagPublicSelect(),
        token_hash: true,
        pending_token_hash: true,
      },
      orderBy: [{ location: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({
      status: true,
      message: "NFC punch tags fetched successfully",
      data: tags.map(({ token_hash, pending_token_hash, ...tag }) => {
        const pendingExpired =
          pending_token_hash &&
          tag.provisioning_expires_at &&
          tag.provisioning_expires_at <= new Date();

        return {
          ...tag,
          has_active_token: Boolean(token_hash),
          provisioning_status: pending_token_hash
            ? pendingExpired
              ? "EXPIRED"
              : "PENDING_CONFIRMATION"
            : token_hash
              ? "READY"
              : "NOT_PROVISIONED",
        };
      }),
    });
  } catch (error) {
    console.error("Error in GET /api/v1/clock_punch/nfc/tags:", error);
    return jsonNfcError("Internal server error", 500);
  }
}
