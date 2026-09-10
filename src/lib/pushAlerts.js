import "server-only";

const ALERT_TIMEOUT_MS = 5000;
const DEFAULT_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * The receipt cron runs every 15 minutes and several alert conditions persist
 * for hours, so an uncooled alert would page on every run until the underlying
 * problem is fixed. Suppression is per key and in-process, which is sufficient
 * because a single API instance owns the cron; running several instances would
 * page once per instance.
 *
 * A suppressed alert is not lost: the durable record is the push monitor log
 * and the delivery metrics written on every run.
 */
const lastAlertedAt = new Map();

function isWithinCooldown(key, cooldownMs, now) {
  const previous = lastAlertedAt.get(key);
  if (previous !== undefined && now - previous < cooldownMs) {
    return true;
  }

  lastAlertedAt.set(key, now);
  return false;
}

/**
 * Backend-only alert sink for push credential, failure-rate, and expired-receipt
 * events. The URL must never be exposed through an EXPO_PUBLIC_ variable.
 *
 * Alerting is best effort: a webhook outage must never fail a send or abort the
 * receipt worker, so every error is swallowed after being logged.
 */
export async function sendPushAlert({
  severity = "warning",
  title,
  description,
  context = {},
  dedupeKey = title,
  cooldownMs = DEFAULT_COOLDOWN_MS,
}) {
  if (isWithinCooldown(dedupeKey, cooldownMs, Date.now())) {
    return false;
  }

  const webhookUrl = process.env.PUSH_ALERT_WEBHOOK_URL;

  if (!webhookUrl) {
    // Without a configured sink the console remains the record of the alert.
    console.warn(`[PushAlert:${severity}] ${title} - ${description}`, context);
    return false;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        severity,
        title,
        description,
        context,
        service: "ikonic-api",
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(ALERT_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(
        `Push alert webhook responded ${response.status} for "${title}"`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("Push alert webhook delivery failed:", error);
    return false;
  }
}
