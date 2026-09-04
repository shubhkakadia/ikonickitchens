import { NextResponse } from "next/server";

import {
  authenticateClockPunchRequest,
  MINIMUM_BREAK_MINUTES,
  normalizeClockPunchAction,
} from "@/lib/clockPunch";
import { createClockPunch } from "@/lib/clockPunchService";
import { prisma } from "@/lib/db";
import {
  hashNfcSecret,
  MAX_NFC_TAG_TOKEN_LENGTH,
  MIN_NFC_TAG_TOKEN_LENGTH,
  normalizeNfcSecret,
} from "@/lib/nfcPunchTag";
import { withLogging } from "@/lib/withLogging";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

function jsonError(message, status, data) {
  return NextResponse.json(
    { status: false, message, ...(data === undefined ? {} : { data }) },
    { status },
  );
}

async function readJsonBody(request) {
  try {
    return { body: await request.json(), error: null };
  } catch {
    return {
      body: null,
      error: jsonError("A valid JSON body is required", 400),
    };
  }
}

function getConflictResponse(conflict) {
  if (conflict.code === "IDEMPOTENCY_KEY_REUSED") {
    return jsonError(
      "The idempotency key has already been used for another punch",
      409,
      conflict,
    );
  }

  if (conflict.code === "MINIMUM_BREAK_NOT_MET") {
    return jsonError(
      `Break-out is available after the minimum ${MINIMUM_BREAK_MINUTES}-minute break`,
      409,
      conflict,
    );
  }

  return jsonError(
    conflict.allowedActions.length === 0
      ? "This day is already clocked out. Only one shift can be recorded per day."
      : `Invalid punch sequence. Allowed next action${
          conflict.allowedActions.length === 1 ? " is" : "s are"
        }: ${conflict.allowedActions.join(", ")}`,
    409,
    conflict,
  );
}

export async function POST(request) {
  try {
    const { error: authError, session } =
      await authenticateClockPunchRequest(request);
    if (authError) return authError;

    const { body, error: bodyError } = await readJsonBody(request);
    if (bodyError) return bodyError;

    const action = normalizeClockPunchAction(body?.action);
    if (!action) {
      return jsonError(
        "action must be one of CLOCK_IN, BREAK_IN, BREAK_OUT, or CLOCK_OUT",
        400,
      );
    }

    const tagToken = normalizeNfcSecret(body?.tag_token);
    if (!tagToken) {
      return jsonError(
        `tag_token must be between ${MIN_NFC_TAG_TOKEN_LENGTH} and ${MAX_NFC_TAG_TOKEN_LENGTH} characters`,
        400,
      );
    }

    const idempotencyKey =
      typeof body?.idempotency_key === "string"
        ? body.idempotency_key.trim()
        : "";
    if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
      return jsonError(
        "idempotency_key must be 16-128 characters using letters, numbers, dot, underscore, colon, or hyphen",
        400,
      );
    }

    const [tag, actor] = await Promise.all([
      prisma.nfc_punch_tag.findFirst({
        where: {
          token_hash: hashNfcSecret(tagToken),
          is_active: true,
          is_deleted: false,
        },
        select: {
          id: true,
          name: true,
          location: true,
        },
      }),
      prisma.users.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          employee: {
            select: {
              employee_id: true,
              is_active: true,
              is_deleted: true,
            },
          },
        },
      }),
    ]);

    if (!tag) {
      return jsonError("The NFC tag is not recognised or is inactive", 403);
    }

    if (!actor) {
      return jsonError("User not found", 404);
    }

    if (!actor.employee) {
      return jsonError(
        "Your user account is not linked to an employee",
        400,
      );
    }

    if (!actor.employee.is_active || actor.employee.is_deleted) {
      return jsonError("The linked employee is not active", 403);
    }

    const result = await createClockPunch({
      employeeId: actor.employee.employee_id,
      userId: actor.id,
      action,
      punchType: "NFC",
      nfcTagId: tag.id,
      idempotencyKey,
    });

    if (result.conflict) return getConflictResponse(result.conflict);

    if (result.idempotentReplay) {
      return NextResponse.json({
        status: true,
        message: "Clock punch was already recorded",
        data: result.punch,
        idempotent_replay: true,
      });
    }

    const logged = await withLogging(
      request,
      "clock_punch",
      result.punch.id,
      "CREATE",
      `NFC clock punch recorded: ${action} at ${tag.name} (${tag.location})`,
    );

    return NextResponse.json(
      {
        status: true,
        message: "NFC clock punch recorded successfully",
        data: result.punch,
        ...(logged
          ? {}
          : { warning: "Punch recorded but audit logging failed" }),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in POST /api/v1/clock_punch/nfc:", error);
    return jsonError("Internal server error", 500);
  }
}
