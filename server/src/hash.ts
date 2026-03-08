import { createHash, createHmac } from "node:crypto";

export function legacyHashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashToken(token: string): string {
  const secret = process.env.PAPERCLIP_AGENT_JWT_SECRET;
  if (!secret) {
    throw new Error("PAPERCLIP_AGENT_JWT_SECRET must be configured to secure API keys.");
  }
  return createHmac("sha256", secret).update(token).digest("hex");
}
