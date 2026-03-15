/**
 * Slack request signature verification.
 * See: https://api.slack.com/authentication/verifying-requests-from-slack
 *
 * Every inbound Slack webhook must be verified to prevent spoofing.
 * Slack signs each request with HMAC-SHA256 using the app's signing secret.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const SLACK_VERSION = "v0";
const MAX_TIMESTAMP_DRIFT_SECONDS = 300; // 5 minutes

export interface SlackVerifyInput {
  signingSecret: string;
  signature: string;   // x-slack-signature header
  timestamp: string;   // x-slack-request-timestamp header
  rawBody: string;
}

export function verifySlackSignature(input: SlackVerifyInput): boolean {
  const { signingSecret, signature, timestamp, rawBody } = input;

  // Reject if timestamp is too old (replay attack prevention)
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > MAX_TIMESTAMP_DRIFT_SECONDS) return false;

  // Compute expected signature
  const sigBaseString = `${SLACK_VERSION}:${timestamp}:${rawBody}`;
  const expectedSignature = `${SLACK_VERSION}=${createHmac("sha256", signingSecret).update(sigBaseString).digest("hex")}`;

  // Timing-safe comparison
  if (signature.length !== expectedSignature.length) return false;
  return timingSafeEqual(
    Buffer.from(signature, "utf8"),
    Buffer.from(expectedSignature, "utf8"),
  );
}
