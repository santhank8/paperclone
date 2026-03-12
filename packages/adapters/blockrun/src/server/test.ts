import type {
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
  AdapterEnvironmentCheck,
} from "@paperclipai/adapter-utils";
import { asString } from "@paperclipai/adapter-utils/server-utils";

function resolveApiUrl(config: Record<string, unknown>): string {
  const explicit = asString(config.apiUrl, "");
  if (explicit) return explicit.replace(/\/+$/, "");
  const network = asString(config.network, "mainnet");
  return network === "testnet"
    ? "https://testnet.blockrun.ai/api"
    : "https://blockrun.ai/api";
}

// Private/reserved IPv4 ranges (CIDR notation converted to prefix checks)
const PRIVATE_IP_PATTERNS = [
  /^127\./, // 127.0.0.0/8 loopback
  /^10\./, // 10.0.0.0/8
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^192\.168\./, // 192.168.0.0/16
  /^169\.254\./, // 169.254.0.0/16 link-local
  /^0\./, // 0.0.0.0/8
];

/**
 * Validate a URL for SSRF safety: only https:// is allowed, plus http://localhost
 * for local development. Private IP ranges are rejected.
 */
function validateUrl(url: string): { ok: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: `Invalid URL: ${url}` };
  }

  // Allow http only for localhost
  if (parsed.protocol === "http:") {
    if (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1"
    ) {
      return { ok: true };
    }
    return {
      ok: false,
      reason: `HTTP is only allowed for localhost. Got: ${parsed.hostname}`,
    };
  }

  // Only https is allowed otherwise
  if (parsed.protocol !== "https:") {
    return {
      ok: false,
      reason: `Only https:// URLs are allowed (or http://localhost). Got: ${parsed.protocol}`,
    };
  }

  // Reject private IP ranges
  const hostname = parsed.hostname;
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return {
        ok: false,
        reason: `Private/reserved IP address not allowed: ${hostname}`,
      };
    }
  }

  // Reject IPv6 private ranges (bracketed in URLs)
  if (hostname.startsWith("[")) {
    return {
      ok: false,
      reason: `IPv6 addresses are not allowed: ${hostname}`,
    };
  }

  return { ok: true };
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = ctx.config;
  const apiUrl = resolveApiUrl(config);
  const privateKey = asString(config.privateKey, "");
  const model = asString(config.model, "");
  const network = asString(config.network, "mainnet");

  // ---- Check: network ----
  if (network !== "mainnet" && network !== "testnet") {
    checks.push({
      code: "blockrun_invalid_network",
      level: "error",
      message: `Invalid network "${network}". Must be "mainnet" or "testnet".`,
    });
  } else {
    checks.push({
      code: "blockrun_network",
      level: "info",
      message: `Network: ${network} (${apiUrl})`,
    });
  }

  // ---- Check: private key ----
  if (!privateKey) {
    checks.push({
      code: "blockrun_no_private_key",
      level: "warn",
      message:
        "No private key configured. Only free models (nvidia/gpt-oss-*) will work.",
      hint: "Add a hex private key (0x...) to enable paid models.",
    });
  } else if (!privateKey.startsWith("0x") || privateKey.length !== 66) {
    checks.push({
      code: "blockrun_invalid_private_key",
      level: "error",
      message:
        "Private key must be a 0x-prefixed 64-character hex string (66 chars total).",
      hint: 'Example: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"',
    });
  } else {
    // Derive wallet address to confirm key is valid
    try {
      const { getWalletAddress } = await import("./x402.js");
      const address = getWalletAddress(privateKey);
      checks.push({
        code: "blockrun_wallet",
        level: "info",
        message: `Wallet: ${address}`,
        detail: "Private key is valid and wallet address derived successfully.",
      });
    } catch (err) {
      checks.push({
        code: "blockrun_invalid_private_key",
        level: "error",
        message: `Failed to derive wallet from private key: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // ---- Check: model ----
  if (model && !model.includes("/")) {
    checks.push({
      code: "blockrun_model_format",
      level: "warn",
      message: `Model "${model}" should be in provider/model format (e.g., "openai/gpt-4o").`,
    });
  }

  // ---- Check: URL safety (SSRF protection) ----
  const urlCheck = validateUrl(apiUrl);
  if (!urlCheck.ok) {
    checks.push({
      code: "blockrun_api_ssrf",
      level: "error",
      message: `API URL rejected: ${urlCheck.reason}`,
      hint: "Only https:// URLs (or http://localhost for local dev) are allowed.",
    });
    return {
      adapterType: "blockrun",
      status: "fail",
      checks,
      testedAt: new Date().toISOString(),
    };
  }

  // ---- Check: API reachability ----
  try {
    const res = await fetch(`${apiUrl}/v1/models`, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        data?: unknown[];
        network?: string;
      };
      const modelCount = Array.isArray(data.data)
        ? data.data.length
        : 0;
      checks.push({
        code: "blockrun_api_reachable",
        level: "info",
        message: `BlockRun API reachable. ${modelCount} models available on ${data.network ?? network}.`,
      });
    } else {
      checks.push({
        code: "blockrun_api_error",
        level: "warn",
        message: `BlockRun API returned HTTP ${res.status}.`,
        hint: "The API may be temporarily unavailable. Runs can still be attempted.",
      });
    }
  } catch (err) {
    checks.push({
      code: "blockrun_api_unreachable",
      level: "error",
      message: `Cannot reach BlockRun API at ${apiUrl}: ${err instanceof Error ? err.message : String(err)}`,
      hint: "Check network connectivity and firewall rules. Ensure outbound HTTPS is allowed.",
    });
  }

  // ---- Determine overall status ----
  const hasError = checks.some((c) => c.level === "error");
  const hasWarn = checks.some((c) => c.level === "warn");

  return {
    adapterType: "blockrun",
    status: hasError ? "fail" : hasWarn ? "warn" : "pass",
    checks,
    testedAt: new Date().toISOString(),
  };
}
