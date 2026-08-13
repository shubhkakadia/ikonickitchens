import "server-only";

import { Expo } from "expo-server-sdk";

import { prisma } from "@/lib/db";

const MAX_RECIPIENTS_PER_EVENT = 1000;
const RECEIPT_BATCH_SIZE = 1000;
const RECEIPT_DELAY_MS = 15 * 60 * 1000;
const RECEIPT_EXPIRY_MS = 24 * 60 * 60 * 1000;
const RECEIPT_FETCH_MAX_ATTEMPTS = 4;
const RECEIPT_RETRY_BASE_DELAY_MS = 1000;
const RETRYABLE_NETWORK_CODES = new Set([
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
]);
const INVESTIGATABLE_DELIVERY_CODES = new Set([
  "DeveloperError",
  "ExpoError",
  "InvalidCredentials",
  "MessageTooBig",
  "ProviderError",
]);

let expoClient;

function getExpoClient() {
  if (!process.env.EXPO_PUSH_ACCESS_TOKEN) {
    throw new Error("EXPO_PUSH_ACCESS_TOKEN is not configured");
  }

  expoClient ??= new Expo({
    accessToken: process.env.EXPO_PUSH_ACCESS_TOKEN,
    maxConcurrentRequests: 4,
  });

  return expoClient;
}

function ticketError(ticket) {
  return {
    code: ticket.details?.error || "ExpoError",
    message: ticket.message || "Expo rejected the push notification",
  };
}

function expoRequestStatus(error) {
  const status = Number(error?.statusCode);
  return Number.isInteger(status) ? status : null;
}

function expoRequestCode(error) {
  return error?.code || error?.cause?.code || null;
}

function isRetryableExpoRequestError(error) {
  const status = expoRequestStatus(error);
  if (status === 429 || (status !== null && status >= 500)) return true;

  return RETRYABLE_NETWORK_CODES.has(expoRequestCode(error));
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function logReceiptFetchError(error, receiptIds, attempts, retryable) {
  const status = expoRequestStatus(error);
  const code = expoRequestCode(error);
  const classification =
    status === 401 || status === 403
      ? "CREDENTIAL_ERROR"
      : status !== null && status >= 400 && status < 500 && status !== 429
        ? "PAYLOAD_ERROR"
        : retryable
          ? "TEMPORARY_ERROR"
          : "REQUEST_ERROR";
  const message = String(error?.message || "Unknown Expo receipt error").slice(
    0,
    1000,
  );

  try {
    await prisma.logs.create({
      data: {
        user_id: null,
        entity_type: "push_receipt",
        entity_id: receiptIds[0] || "receipt-batch",
        action: "OTHER",
        description: `${classification}: Expo receipt fetch failed after ${attempts} attempt(s)${status ? ` (HTTP ${status})` : ""}${code ? ` [${code}]` : ""}: ${message}`,
      },
    });
  } catch (loggingError) {
    console.error("Failed to persist Expo receipt error audit:", loggingError);
  }
}

async function logDeliveryError({ code, message, entityId, tokenId }) {
  if (!INVESTIGATABLE_DELIVERY_CODES.has(code)) return;

  try {
    await prisma.logs.create({
      data: {
        user_id: null,
        entity_type: "push_notification",
        entity_id: entityId,
        action: "OTHER",
        description: `Expo delivery error ${code} for device ${tokenId}: ${String(message).slice(0, 1000)}`,
      },
    });
  } catch (loggingError) {
    console.error("Failed to persist Expo delivery error audit:", loggingError);
  }
}

async function fetchReceiptsWithRetry(expo, receiptIds) {
  for (let attempt = 1; attempt <= RECEIPT_FETCH_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await expo.getPushNotificationReceiptsAsync(receiptIds);
    } catch (error) {
      const retryable = isRetryableExpoRequestError(error);
      const exhausted = attempt === RECEIPT_FETCH_MAX_ATTEMPTS;

      if (!retryable || exhausted) {
        await logReceiptFetchError(error, receiptIds, attempt, retryable);
        throw error;
      }

      const exponentialDelay = RECEIPT_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      const jitter = Math.floor(Math.random() * 250);
      await wait(exponentialDelay + jitter);
    }
  }

  throw new Error("Expo receipt retry loop exited unexpectedly");
}

async function recordSendAudit({ actorUserId, lotId, sent, rejected }) {
  await prisma.logs.create({
    data: {
      user_id: actorUserId || null,
      entity_type: "push_notification",
      entity_id: lotId,
      action: "OTHER",
      description: `Project update push queued for ${sent} device(s); ${rejected} rejected`,
    },
  });
}

/**
 * Selects recipients on the backend from the lot's installer and stage
 * assignments, then sends and persists Expo push tickets.
 */
export async function sendProjectUpdate({ lotId, actorUserId = null }) {
  const lot = await prisma.lot.findFirst({
    where: {
      OR: [{ id: lotId }, { lot_id: lotId }],
      is_deleted: false,
    },
    select: {
      lot_id: true,
      installer_id: true,
      stages: {
        select: {
          assigned_to: {
            select: { employee_id: true },
          },
        },
      },
    },
  });

  if (!lot) {
    throw new Error(`Cannot send project update: lot ${lotId} was not found`);
  }

  const employeeIds = new Set();
  if (lot.installer_id) employeeIds.add(lot.installer_id);
  for (const stage of lot.stages) {
    for (const assignment of stage.assigned_to) {
      employeeIds.add(assignment.employee_id);
    }
  }

  if (employeeIds.size === 0) {
    return { recipients: 0, sent: 0, rejected: 0 };
  }

  const tokenRecords = await prisma.push_tokens.findMany({
    where: {
      enabled: true,
      user: {
        is_active: true,
        employee_id: { in: [...employeeIds] },
        ...(actorUserId ? { id: { not: actorUserId } } : {}),
      },
    },
    select: {
      id: true,
      expo_push_token: true,
    },
    take: MAX_RECIPIENTS_PER_EVENT,
  });

  const validTokens = [];
  const invalidTokenIds = [];
  for (const tokenRecord of tokenRecords) {
    if (Expo.isExpoPushToken(tokenRecord.expo_push_token)) {
      validTokens.push(tokenRecord);
    } else {
      invalidTokenIds.push(tokenRecord.id);
    }
  }

  if (invalidTokenIds.length > 0) {
    await prisma.push_tokens.updateMany({
      where: { id: { in: invalidTokenIds } },
      data: {
        enabled: false,
        last_error: "Invalid Expo push token",
      },
    });
  }

  if (validTokens.length === 0) {
    return {
      recipients: tokenRecords.length,
      sent: 0,
      rejected: invalidTokenIds.length,
    };
  }

  const expo = getExpoClient();
  const messages = validTokens.map(({ expo_push_token }) => ({
    to: expo_push_token,
    sound: "default",
    title: "Project updated",
    body: "An assigned project has new information.",
    channelId: "project-updates",
    data: {
      screen: "projects",
      lotId: lot.lot_id,
    },
  }));

  let offset = 0;
  let sent = 0;
  let rejected = invalidTokenIds.length;

  for (const chunk of expo.chunkPushNotifications(messages)) {
    const chunkTokens = validTokens.slice(offset, offset + chunk.length);
    const tickets = await expo.sendPushNotificationsAsync(chunk);
    const successfulTickets = [];

    for (let index = 0; index < tickets.length; index += 1) {
      const ticket = tickets[index];
      const tokenRecord = chunkTokens[index];

      if (ticket.status === "ok") {
        successfulTickets.push({
          expo_ticket_id: ticket.id,
          push_token_id: tokenRecord.id,
          lot_id: lot.lot_id,
        });
        sent += 1;
        continue;
      }

      const error = ticketError(ticket);
      rejected += 1;
      await prisma.push_tokens.update({
        where: { id: tokenRecord.id },
        data: {
          enabled: error.code !== "DeviceNotRegistered",
          last_error: `${error.code}: ${error.message}`,
        },
      });
      await logDeliveryError({
        code: error.code,
        message: error.message,
        entityId: lot.lot_id,
        tokenId: tokenRecord.id,
      });
    }

    if (successfulTickets.length > 0) {
      await prisma.push_notification_tickets.createMany({
        data: successfulTickets,
        skipDuplicates: true,
      });
    }

    offset += chunk.length;
  }

  await recordSendAudit({ actorUserId, lotId: lot.lot_id, sent, rejected });

  return { recipients: tokenRecords.length, sent, rejected };
}

/**
 * Fetches delivery receipts for queued Expo tickets. Safe to invoke from a
 * background job; missing receipts remain pending for the next run.
 */
export async function processPushNotificationReceipts() {
  const now = new Date();
  const readyBefore = new Date(now.getTime() - RECEIPT_DELAY_MS);
  const expiredBefore = new Date(now.getTime() - RECEIPT_EXPIRY_MS);

  const expiredTickets = await prisma.push_notification_tickets.updateMany({
    where: {
      status: "PENDING",
      createdAt: { lt: expiredBefore },
    },
    data: {
      status: "EXPIRED",
      receipt_checked_at: now,
      error_message: "Expo receipt was not available within 24 hours",
    },
  });

  const pendingTickets = await prisma.push_notification_tickets.findMany({
    where: {
      status: "PENDING",
      createdAt: { lte: readyBefore },
    },
    select: {
      expo_ticket_id: true,
      push_token_id: true,
      lot_id: true,
    },
    orderBy: { createdAt: "asc" },
    take: RECEIPT_BATCH_SIZE,
  });

  if (pendingTickets.length === 0) {
    return {
      checked: 0,
      delivered: 0,
      failed: 0,
      expired: expiredTickets.count,
    };
  }

  const expo = getExpoClient();
  const ticketById = new Map(
    pendingTickets.map((ticket) => [ticket.expo_ticket_id, ticket]),
  );
  let checked = 0;
  let delivered = 0;
  let failed = 0;

  for (const chunk of expo.chunkPushNotificationReceiptIds([
    ...ticketById.keys(),
  ])) {
    const receipts = await fetchReceiptsWithRetry(expo, chunk);

    for (const [receiptId, receipt] of Object.entries(receipts)) {
      const pendingTicket = ticketById.get(receiptId);
      if (!pendingTicket) continue;

      checked += 1;
      if (receipt.status === "ok") {
        delivered += 1;
        await prisma.push_notification_tickets.update({
          where: { expo_ticket_id: receiptId },
          data: {
            status: "DELIVERED",
            receipt_checked_at: now,
            error_code: null,
            error_message: null,
          },
        });
        continue;
      }

      failed += 1;
      const error = ticketError(receipt);
      await prisma.$transaction([
        prisma.push_notification_tickets.update({
          where: { expo_ticket_id: receiptId },
          data: {
            status: "ERROR",
            receipt_checked_at: now,
            error_code: error.code,
            error_message: error.message,
          },
        }),
        prisma.push_tokens.update({
          where: { id: pendingTicket.push_token_id },
          data: {
            enabled: error.code !== "DeviceNotRegistered",
            last_error: `${error.code}: ${error.message}`,
          },
        }),
      ]);
      await logDeliveryError({
        code: error.code,
        message: error.message,
        entityId: pendingTicket.lot_id || receiptId,
        tokenId: pendingTicket.push_token_id,
      });
    }
  }

  return { checked, delivered, failed, expired: expiredTickets.count };
}
