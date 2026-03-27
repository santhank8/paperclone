import { generateKeyPairSync } from "node:crypto";
import {
  DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  DEFAULT_CODEX_LOCAL_MODEL,
} from "@paperclipai/adapter-codex-local";
import { DEFAULT_CURSOR_LOCAL_MODEL } from "@paperclipai/adapter-cursor-local";
import { DEFAULT_GEMINI_LOCAL_MODEL } from "@paperclipai/adapter-gemini-local";

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseBooleanLike(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
    return false;
  }
  return null;
}

function generateEd25519PrivateKeyPem(): string {
  const { privateKey } = generateKeyPairSync("ed25519");
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}

function ensureGatewayDeviceKey(
  adapterType: string | null | undefined,
  adapterConfig: Record<string, unknown>,
): Record<string, unknown> {
  if (adapterType !== "openclaw_gateway") return adapterConfig;
  const disableDeviceAuth = parseBooleanLike(adapterConfig.disableDeviceAuth) === true;
  if (disableDeviceAuth) return adapterConfig;
  if (asNonEmptyString(adapterConfig.devicePrivateKeyPem)) return adapterConfig;
  return { ...adapterConfig, devicePrivateKeyPem: generateEd25519PrivateKeyPem() };
}

export function applyAdapterConfigDefaults(
  adapterType: string | null | undefined,
  adapterConfig: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...adapterConfig };
  if (adapterType === "codex_local") {
    if (!asNonEmptyString(next.model)) {
      next.model = DEFAULT_CODEX_LOCAL_MODEL;
    }
    const hasBypassFlag =
      typeof next.dangerouslyBypassApprovalsAndSandbox === "boolean" ||
      typeof next.dangerouslyBypassSandbox === "boolean";
    if (!hasBypassFlag) {
      next.dangerouslyBypassApprovalsAndSandbox = DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX;
    }
    return ensureGatewayDeviceKey(adapterType, next);
  }
  if (adapterType === "gemini_local" && !asNonEmptyString(next.model)) {
    next.model = DEFAULT_GEMINI_LOCAL_MODEL;
    return ensureGatewayDeviceKey(adapterType, next);
  }
  // OpenCode requires explicit model selection — no default
  if (adapterType === "cursor" && !asNonEmptyString(next.model)) {
    next.model = DEFAULT_CURSOR_LOCAL_MODEL;
  }
  return ensureGatewayDeviceKey(adapterType, next);
}
