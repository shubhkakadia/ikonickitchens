import "server-only";

import {
  clockPunchInclude,
  getClockPunchDayBounds,
  getMinimumBreakEnd,
  MINIMUM_BREAK_MINUTES,
} from "@/lib/clockPunch";
import { getAllowedNextActions } from "@/lib/clockPunchSequence";
import { prisma } from "@/lib/db";

const MAX_TRANSACTION_ATTEMPTS = 3;

function isMatchingIdempotentPunch(
  punch,
  { employeeId, userId, action, punchType, nfcTagId },
) {
  return (
    punch.employee_id === employeeId &&
    punch.user_id === userId &&
    punch.action === action &&
    punch.punch_type === punchType &&
    punch.nfc_tag_id === nfcTagId
  );
}

/**
 * Creates an employee clock punch using the canonical sequence and break rules.
 * NFC callers may provide an idempotency key so app retries cannot double punch.
 */
export async function createClockPunch({
  employeeId,
  userId,
  action,
  punchType,
  nfcTagId = null,
  idempotencyKey = null,
}) {
  const requestIdentity = {
    employeeId,
    userId,
    action,
    punchType,
    nfcTagId,
  };

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      const punchedAt = new Date();
      const dayBounds = getClockPunchDayBounds(punchedAt);

      return await prisma.$transaction(
        async (tx) => {
          if (idempotencyKey) {
            const existingPunch = await tx.clock_punch.findUnique({
              where: { idempotency_key: idempotencyKey },
              include: clockPunchInclude,
            });

            if (existingPunch) {
              return isMatchingIdempotentPunch(
                existingPunch,
                requestIdentity,
              )
                ? {
                    conflict: null,
                    punch: existingPunch,
                    idempotentReplay: true,
                  }
                : {
                    conflict: { code: "IDEMPOTENCY_KEY_REUSED" },
                    punch: null,
                    idempotentReplay: false,
                  };
            }
          }

          const previousPunch = await tx.clock_punch.findFirst({
            where: {
              employee_id: employeeId,
              review_status: { not: "REJECTED" },
              punched_at: {
                gte: dayBounds.start,
                lt: dayBounds.end,
              },
            },
            orderBy: [
              { punched_at: "desc" },
              { createdAt: "desc" },
              { id: "desc" },
            ],
            select: {
              id: true,
              action: true,
              punched_at: true,
            },
          });

          const allowedActions = getAllowedNextActions(previousPunch?.action);
          if (!allowedActions.includes(action)) {
            return {
              conflict: {
                code: "INVALID_PUNCH_SEQUENCE",
                previousPunch,
                allowedActions,
              },
              punch: null,
              idempotentReplay: false,
            };
          }

          if (action === "BREAK_OUT" && previousPunch?.action === "BREAK_IN") {
            const minimumBreakEndsAt = getMinimumBreakEnd(
              previousPunch.punched_at,
            );

            if (punchedAt < minimumBreakEndsAt) {
              return {
                conflict: {
                  code: "MINIMUM_BREAK_NOT_MET",
                  previousPunch,
                  minimumBreakMinutes: MINIMUM_BREAK_MINUTES,
                  minimumBreakEndsAt,
                  remainingSeconds: Math.ceil(
                    (minimumBreakEndsAt.getTime() - punchedAt.getTime()) / 1000,
                  ),
                  allowedActions: ["BREAK_OUT"],
                },
                punch: null,
                idempotentReplay: false,
              };
            }
          }

          const punch = await tx.clock_punch.create({
            data: {
              employee_id: employeeId,
              user_id: userId,
              action,
              punch_type: punchType,
              punched_at: punchedAt,
              nfc_tag_id: nfcTagId,
              idempotency_key: idempotencyKey,
            },
            include: clockPunchInclude,
          });

          return { conflict: null, punch, idempotentReplay: false };
        },
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (error?.code === "P2034" && attempt < MAX_TRANSACTION_ATTEMPTS) {
        continue;
      }

      // A concurrent retry may lose the unique-key race after both requests
      // initially observe no punch. Return the winning request as a replay.
      if (error?.code === "P2002" && idempotencyKey) {
        const existingPunch = await prisma.clock_punch.findUnique({
          where: { idempotency_key: idempotencyKey },
          include: clockPunchInclude,
        });

        if (
          existingPunch &&
          isMatchingIdempotentPunch(existingPunch, requestIdentity)
        ) {
          return {
            conflict: null,
            punch: existingPunch,
            idempotentReplay: true,
          };
        }

        return {
          conflict: { code: "IDEMPOTENCY_KEY_REUSED" },
          punch: null,
          idempotentReplay: false,
        };
      }

      throw error;
    }
  }
}
