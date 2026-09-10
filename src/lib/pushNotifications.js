import "server-only";

import crypto from "crypto";
import { Expo } from "expo-server-sdk";

import { prisma } from "@/lib/db";
import { sendPushAlert } from "@/lib/pushAlerts";

const MAX_RECIPIENTS_PER_EVENT = 1000;
const RECEIPT_BATCH_SIZE = 1000;
const RECEIPT_DELAY_MS = 15 * 60 * 1000;
const RECEIPT_EXPIRY_MS = 24 * 60 * 60 * 1000;
const RECEIPT_EXPIRY_WARNING_MS = 22 * 60 * 60 * 1000;
const RECEIPT_FETCH_MAX_ATTEMPTS = 4;
const RECEIPT_RETRY_BASE_DELAY_MS = 1000;
const RECEIPT_RETRY_MAX_DELAY_MS = 6 * 60 * 60 * 1000;
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
  "BadDeviceToken",
  "DeveloperError",
  "ExpoError",
  "InvalidCredentials",
  "MessageTooBig",
  "MismatchSenderId",
  "ProviderError",
]);
// Only the production EAS profile is signed with aps-environment: production.
// Tokens minted by these profiles are sandbox (or, for Expo Go, belong to a
// different bundle identifier) and are excluded from production sends.
const INTERNAL_BUILD_PROFILES = ["development", "preview", "expo-go"];
const PRODUCTION_BUILD_PROFILE = "production";
// Wrong-environment failures. Retrying never helps, so they are permanent for
// the current registration and are healed only by re-registration.
const PERMANENT_ENVIRONMENT_ERRORS = [
  { code: "BadDeviceToken", reason: "bad_device_token" },
  { code: "MismatchSenderId", reason: "mismatch_sender_id" },
];
const BAD_DEVICE_TOKEN_WINDOW_MS = 24 * 60 * 60 * 1000;
const BAD_DEVICE_TOKEN_MIN_SAMPLE = 50;
const BAD_DEVICE_TOKEN_ALERT_RATIO = 0.01;
// Credential and wrong-environment problems persist until someone fixes them,
// so these page once per window rather than on every 15-minute cron run. The
// per-run monitor log still records each occurrence.
const PERSISTENT_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

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

/**
 * Expo does not surface wrong-environment failures as a stable enum the way it
 * does DeviceNotRegistered. Depending on the failure they arrive as a
 * DeveloperError, as details.error, or only as an APNs reason inside the
 * human-readable message, so match on both.
 */
function classifyPermanentEnvironmentError({ code, message }) {
  for (const candidate of PERMANENT_ENVIRONMENT_ERRORS) {
    if (code === candidate.code) return candidate;
    if (typeof message === "string" && message.includes(candidate.code)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Internal-profile registrations are excluded from production sends. Set
 * PUSH_ALLOW_INTERNAL_BUILD_PROFILES=true to send to them from a production
 * deployment while smoke-testing an internal build.
 */
function shouldExcludeInternalBuildProfiles() {
  if (process.env.PUSH_ALLOW_INTERNAL_BUILD_PROFILES === "true") return false;

  return process.env.NODE_ENV === "production";
}

function createRunState() {
  return {
    metrics: new Map(),
    credentialFailures: 0,
    productionEnvironmentFailures: 0,
  };
}

function recordDeliveryMetric(runState, { code, platform, buildProfile }) {
  const key = `${code}|${platform || "unknown"}|${buildProfile || "unreported"}`;
  runState.metrics.set(key, (runState.metrics.get(key) || 0) + 1);
}

/**
 * Emits one aggregated counter per error code / platform / build profile so
 * wrong-environment failures are visible as a rate rather than as single rows.
 */
async function emitDeliveryMetrics(runState, scope) {
  if (runState.metrics.size === 0) return;

  const summary = [...runState.metrics.entries()]
    .map(([key, count]) => {
      const [code, platform, buildProfile] = key.split("|");
      return `${code}/${platform}/${buildProfile}=${count}`;
    })
    .sort()
    .join(", ");

  await logPushMonitor(
    `${scope}-delivery-metrics`,
    `Push delivery errors by code/platform/build_profile: ${summary}`,
  );
}

/**
 * A permanent environment failure on an internal build is expected noise from
 * testing; the same failure on a production-signed build points at an APNs key,
 * team, or bundle identifier mismatch and must page on-call.
 */
async function alertOnRunState(runState, scope) {
  if (runState.credentialFailures > 0) {
    const description = `${runState.credentialFailures} InvalidCredentials result(s) during ${scope}. APNs/FCM credentials or the Expo access token need attention.`;
    await logPushMonitor("credential-monitor", description);
    await sendPushAlert({
      severity: "critical",
      title: "Expo push credentials rejected",
      description,
      context: { scope, count: runState.credentialFailures },
      cooldownMs: PERSISTENT_ALERT_COOLDOWN_MS,
    });
  }

  if (runState.productionEnvironmentFailures > 0) {
    const description = `${runState.productionEnvironmentFailures} wrong-environment delivery error(s) on production-profile registrations during ${scope}. Check the APNs key, Apple team, and bundle identifier.`;
    await logPushMonitor("wrong-environment-monitor", description);
    await sendPushAlert({
      severity: "critical",
      title: "Production build produced rejected device tokens",
      description,
      context: {
        scope,
        build_profile: PRODUCTION_BUILD_PROFILE,
        count: runState.productionEnvironmentFailures,
      },
      cooldownMs: PERSISTENT_ALERT_COOLDOWN_MS,
    });
  }
}

/**
 * Rolling-window rate check. A healthy project sits near zero because
 * production tokens that go bad normally surface as DeviceNotRegistered.
 */
async function evaluateBadDeviceTokenRate() {
  const since = new Date(Date.now() - BAD_DEVICE_TOKEN_WINDOW_MS);
  const productionScope = {
    createdAt: { gte: since },
    push_token: { is: { build_profile: PRODUCTION_BUILD_PROFILE } },
  };

  const [total, permanentFailures] = await Promise.all([
    prisma.push_notification_tickets.count({ where: productionScope }),
    prisma.push_notification_tickets.count({
      where: {
        ...productionScope,
        error_code: { in: PERMANENT_ENVIRONMENT_ERRORS.map((e) => e.code) },
      },
    }),
  ]);

  if (total < BAD_DEVICE_TOKEN_MIN_SAMPLE) return null;

  const ratio = permanentFailures / total;
  if (ratio < BAD_DEVICE_TOKEN_ALERT_RATIO)
    return { total, permanentFailures, ratio };

  const description = `${permanentFailures}/${total} (${(ratio * 100).toFixed(2)}%) of production-profile pushes in the last 24 hours were rejected as wrong-environment tokens.`;
  await logPushMonitor("wrong-environment-rate-monitor", description);
  await sendPushAlert({
    severity: "critical",
    title: "Wrong-environment push failure rate is elevated",
    description,
    cooldownMs: PERSISTENT_ALERT_COOLDOWN_MS,
    context: {
      window_hours: BAD_DEVICE_TOKEN_WINDOW_MS / (60 * 60 * 1000),
      threshold: BAD_DEVICE_TOKEN_ALERT_RATIO,
      permanent_failures: permanentFailures,
      total,
    },
  });

  return { total, permanentFailures, ratio };
}

/**
 * Builds the push_tokens update for a delivery failure. A row is disabled but
 * never deleted: the unique index on expo_push_token is what lets a later
 * registration find and re-enable it.
 */
function tokenFailureData({ code, message, disableReason, occurredAt }) {
  return {
    ...(disableReason
      ? {
          enabled: false,
          session_id: null,
          disabled_at: occurredAt,
          disabled_reason: disableReason,
        }
      : {}),
    last_error_code: code,
    last_error: `${code}: ${message}`,
    last_error_at: occurredAt,
  };
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

  if (classification === "CREDENTIAL_ERROR") {
    await sendPushAlert({
      severity: "critical",
      title: "Expo rejected the push access token",
      description: `Expo receipt fetch failed with HTTP ${status}. Rotate or repair EXPO_PUSH_ACCESS_TOKEN.`,
      context: { status, code, receipt_count: receiptIds.length },
      cooldownMs: PERSISTENT_ALERT_COOLDOWN_MS,
    });
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

async function logPushMonitor(entityId, description) {
  try {
    await prisma.logs.create({
      data: {
        user_id: null,
        entity_type: "push_receipt",
        entity_id: entityId,
        action: "OTHER",
        description,
      },
    });
  } catch (loggingError) {
    console.error(
      "Failed to persist Expo receipt monitor audit:",
      loggingError,
    );
  }
}

async function fetchReceiptsWithRetry(expo, receiptIds, onAttempt) {
  for (let attempt = 1; attempt <= RECEIPT_FETCH_MAX_ATTEMPTS; attempt += 1) {
    try {
      await onAttempt?.(attempt);
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
 * Shared delivery path for every push event. Resolves the devices belonging to
 * the users matched by `userWhere`, sends the message, and persists the tickets
 * the receipt cron later reconciles.
 */
export async function sendPushToUsers({
  userWhere,
  title,
  body,
  channelId,
  data,
  lotId = null,
  auditEntityId,
  scope = "send",
}) {
  const tokenRecords = await prisma.push_tokens.findMany({
    where: {
      enabled: true,
      session: {
        is: {
          expires_at: { gt: new Date() },
        },
      },
      user: userWhere,
      // Sandbox and Expo Go tokens are excluded from production sends rather
      // than sent to and then disabled. Rows from clients that never reported a
      // profile stay eligible.
      ...(shouldExcludeInternalBuildProfiles()
        ? {
            OR: [
              { build_profile: null },
              { build_profile: { notIn: INTERNAL_BUILD_PROFILES } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      expo_push_token: true,
      platform: true,
      build_profile: true,
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
        session_id: null,
        disabled_at: new Date(),
        disabled_reason: "invalid_expo_push_token",
        last_error_code: "InvalidExpoPushToken",
        last_error: "Invalid Expo push token",
        last_error_at: new Date(),
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
  const eventId = crypto.randomUUID();
  const receiptAvailableAt = new Date(Date.now() + RECEIPT_DELAY_MS);
  const messages = validTokens.map(({ expo_push_token }) => ({
    to: expo_push_token,
    sound: "default",
    title,
    body,
    channelId,
    data,
  }));

  const runState = createRunState();
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
          event_id: eventId,
          expo_ticket_id: ticket.id,
          push_token_id: tokenRecord.id,
          lot_id: lotId,
          next_attempt_at: receiptAvailableAt,
        });
        sent += 1;
        continue;
      }

      const error = ticketError(ticket);
      const environmentError = classifyPermanentEnvironmentError(error);
      // Normalize so a wrong-environment failure delivered as a DeveloperError
      // is still queryable by its real cause.
      const code = environmentError?.code ?? error.code;
      const disableReason =
        error.code === "DeviceNotRegistered"
          ? "device_not_registered"
          : (environmentError?.reason ?? null);

      rejected += 1;
      recordDeliveryMetric(runState, {
        code,
        platform: tokenRecord.platform,
        buildProfile: tokenRecord.build_profile,
      });

      if (code === "InvalidCredentials") runState.credentialFailures += 1;
      if (
        environmentError &&
        tokenRecord.build_profile === PRODUCTION_BUILD_PROFILE
      ) {
        runState.productionEnvironmentFailures += 1;
      }

      await prisma.push_tokens.update({
        where: { id: tokenRecord.id },
        data: tokenFailureData({
          code,
          message: error.message,
          disableReason,
          occurredAt: new Date(),
        }),
      });
      await logDeliveryError({
        code,
        message: error.message,
        entityId: auditEntityId,
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

  await emitDeliveryMetrics(runState, scope);
  await alertOnRunState(runState, scope);

  return { recipients: tokenRecords.length, sent, rejected };
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

  const result = await sendPushToUsers({
    userWhere: {
      is_active: true,
      employee_id: { in: [...employeeIds] },
      ...(actorUserId ? { id: { not: actorUserId } } : {}),
    },
    title: "Project updated",
    body: "An assigned project has new information.",
    channelId: "project-updates",
    data: { screen: "projects" },
    lotId: lot.lot_id,
    auditEntityId: lot.lot_id,
    scope: "send",
  });

  await recordSendAudit({
    actorUserId,
    lotId: lot.lot_id,
    sent: result.sent,
    rejected: result.rejected,
  });

  return result;
}

/**
 * Fetches delivery receipts for queued Expo tickets. Safe to invoke from a
 * background job; missing receipts remain pending for the next run.
 */
export async function processPushNotificationReceipts() {
  const now = new Date();
  const readyBefore = new Date(now.getTime() - RECEIPT_DELAY_MS);
  const expiredBefore = new Date(now.getTime() - RECEIPT_EXPIRY_MS);
  const expiryWarningBefore = new Date(
    now.getTime() - RECEIPT_EXPIRY_WARNING_MS,
  );

  const expiredTickets = await prisma.push_notification_tickets.updateMany({
    where: {
      status: "PENDING",
      createdAt: { lt: expiredBefore },
    },
    data: {
      status: "EXPIRED",
      next_attempt_at: null,
      receipt_checked_at: now,
      error_message: "Expo receipt was not available within 24 hours",
    },
  });

  const pendingTickets = await prisma.push_notification_tickets.findMany({
    where: {
      status: "PENDING",
      createdAt: { lte: readyBefore },
      OR: [{ next_attempt_at: null }, { next_attempt_at: { lte: now } }],
    },
    select: {
      expo_ticket_id: true,
      push_token_id: true,
      lot_id: true,
      attempt_count: true,
      // createdAt is written immediately after the send call, so it is the
      // send time the freshness guard below compares against.
      createdAt: true,
      push_token: {
        select: {
          platform: true,
          build_profile: true,
          last_registered_at: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
    take: RECEIPT_BATCH_SIZE,
  });

  const expiringTicketCount = await prisma.push_notification_tickets.count({
    where: {
      status: "PENDING",
      createdAt: {
        gt: expiredBefore,
        lte: expiryWarningBefore,
      },
    },
  });

  if (expiredTickets.count > 0) {
    const description = `${expiredTickets.count} Expo push receipt(s) expired before processing`;
    await logPushMonitor("expiry-monitor", description);
    await sendPushAlert({
      severity: "warning",
      title: "Expo push receipts expired unprocessed",
      description,
      context: { expired: expiredTickets.count },
    });
  }

  if (expiringTicketCount > 0) {
    const description = `${expiringTicketCount} Expo push receipt(s) remain unprocessed within two hours of expiry`;
    await logPushMonitor("expiry-warning-monitor", description);
    await sendPushAlert({
      severity: "warning",
      title: "Expo push receipts near expiry",
      description,
      context: { pending: expiringTicketCount },
    });
  }

  if (pendingTickets.length === 0) {
    return {
      checked: 0,
      delivered: 0,
      failed: 0,
      expired: expiredTickets.count,
    };
  }

  const expo = getExpoClient();
  const runState = createRunState();
  const ticketById = new Map(
    pendingTickets.map((ticket) => [ticket.expo_ticket_id, ticket]),
  );
  let checked = 0;
  let delivered = 0;
  let failed = 0;

  for (const chunk of expo.chunkPushNotificationReceiptIds([
    ...ticketById.keys(),
  ])) {
    const previousAttemptCount = Math.max(
      0,
      ...chunk.map(
        (receiptId) => ticketById.get(receiptId)?.attempt_count || 0,
      ),
    );
    const receipts = await fetchReceiptsWithRetry(
      expo,
      chunk,
      async (attempt) => {
        const retryDelay = Math.min(
          RECEIPT_DELAY_MS * 2 ** (previousAttemptCount + attempt - 1),
          RECEIPT_RETRY_MAX_DELAY_MS,
        );
        await prisma.push_notification_tickets.updateMany({
          where: { expo_ticket_id: { in: chunk } },
          data: {
            attempt_count: { increment: 1 },
            next_attempt_at: new Date(Date.now() + retryDelay),
          },
        });
      },
    );

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
            next_attempt_at: null,
            receipt_checked_at: now,
            receipt_result: JSON.stringify(receipt),
            error_code: null,
            error_message: null,
          },
        });
        continue;
      }

      failed += 1;
      const error = ticketError(receipt);
      const registration = pendingTicket.push_token;
      const environmentError = classifyPermanentEnvironmentError(error);
      // A receipt is fetched roughly 15 minutes after the send, so the device
      // may already have re-registered a good token. Only act on a registration
      // that has not been refreshed since the failing send.
      const registrationIsStale =
        registration.last_registered_at <= pendingTicket.createdAt;
      const code = environmentError?.code ?? error.code;
      const disableReason =
        error.code === "DeviceNotRegistered"
          ? "device_not_registered"
          : environmentError && registrationIsStale
            ? environmentError.reason
            : null;

      recordDeliveryMetric(runState, {
        code,
        platform: registration.platform,
        buildProfile: registration.build_profile,
      });

      if (code === "InvalidCredentials") runState.credentialFailures += 1;
      if (
        environmentError &&
        registration.build_profile === PRODUCTION_BUILD_PROFILE
      ) {
        runState.productionEnvironmentFailures += 1;
      }

      await prisma.$transaction([
        // Permanently failed: this is not a backoff case, so the attempt
        // counter is left alone and no next attempt is scheduled.
        prisma.push_notification_tickets.update({
          where: { expo_ticket_id: receiptId },
          data: {
            status: "ERROR",
            next_attempt_at: null,
            receipt_checked_at: now,
            receipt_result: JSON.stringify(receipt),
            error_code: code,
            error_message: error.message,
          },
        }),
        prisma.push_tokens.update({
          where: { id: pendingTicket.push_token_id },
          data: tokenFailureData({
            code,
            message: error.message,
            disableReason,
            occurredAt: now,
          }),
        }),
      ]);
      await logDeliveryError({
        code,
        message: error.message,
        entityId: pendingTicket.lot_id || receiptId,
        tokenId: pendingTicket.push_token_id,
      });
    }
  }

  await emitDeliveryMetrics(runState, "receipts");
  await alertOnRunState(runState, "receipts");
  await evaluateBadDeviceTokenRate();

  if (checked >= 10 && failed / checked >= 0.25) {
    const description = `Abnormal Expo receipt failure rate: ${failed}/${checked} (${Math.round((failed / checked) * 100)}%)`;
    await logPushMonitor("failure-rate-monitor", description);
    await sendPushAlert({
      severity: "warning",
      title: "Abnormal Expo receipt failure rate",
      description,
      context: { checked, failed },
    });
  }

  return { checked, delivered, failed, expired: expiredTickets.count };
}
