import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import { asString, parseObject } from "@paperclipai/adapter-utils/server-utils";
import { DEFAULT_GITHUB_MODEL } from "../models.js";

const GITHUB_MODELS_API = "https://models.inference.ai.azure.com";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const configEnv = parseObject(config.env);
  const model = asString(config.model, DEFAULT_GITHUB_MODEL).trim() || DEFAULT_GITHUB_MODEL;

  // Resolve GITHUB_TOKEN from config env or host environment
  const configToken =
    isNonEmpty(configEnv.GITHUB_TOKEN) ? (configEnv.GITHUB_TOKEN as string).trim() : null;
  const hostToken =
    isNonEmpty(process.env.GITHUB_TOKEN) ? process.env.GITHUB_TOKEN!.trim() : null;
  const githubToken = configToken ?? hostToken;

  if (githubToken) {
    const tokenSource = configToken ? "adapter config env" : "server host environment";
    checks.push({
      code: "copilot_token_present",
      level: "info",
      message: "GITHUB_TOKEN is configured.",
      detail: `Detected in ${tokenSource}.`,
    });
  } else {
    checks.push({
      code: "copilot_token_missing",
      level: "error",
      message: "GITHUB_TOKEN is not set.",
      hint: "Set GITHUB_TOKEN in adapter env or server host environment. Use `gh auth token` to get a token from the GitHub CLI.",
    });
    return {
      adapterType: ctx.adapterType,
      status: summarizeStatus(checks),
      checks,
      testedAt: new Date().toISOString(),
    };
  }

  // Run a hello probe against the GitHub Models API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);

    let probeStatus: number | null = null;
    let probeBody = "";

    try {
      const response = await fetch(`${GITHUB_MODELS_API}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${githubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Respond with exactly: hello" }],
          max_tokens: 32,
          stream: false,
        }),
        signal: controller.signal,
      });
      probeStatus = response.status;
      probeBody = await response.text().catch(() => "");
    } finally {
      clearTimeout(timer);
    }

    if (probeStatus === 200) {
      let replyText = "";
      try {
        const parsed = JSON.parse(probeBody) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        replyText = parsed.choices?.[0]?.message?.content?.trim() ?? "";
      } catch {
        // ignore parse errors
      }
      const hasHello = /hello/i.test(replyText);
      checks.push({
        code: hasHello ? "copilot_hello_probe_passed" : "copilot_hello_probe_unexpected_output",
        level: hasHello ? "info" : "warn",
        message: hasHello
          ? "GitHub Models API hello probe succeeded."
          : "GitHub Models API responded but did not return 'hello' as expected.",
        ...(replyText ? { detail: replyText.slice(0, 240) } : {}),
        ...(!hasHello
          ? { hint: "The model responded but with unexpected content. API access is likely working." }
          : {}),
      });
    } else if (probeStatus === 401 || probeStatus === 403) {
      checks.push({
        code: "copilot_hello_probe_auth_failed",
        level: "error",
        message: `GitHub Models API returned HTTP ${probeStatus} — authentication failed.`,
        hint: "Verify GITHUB_TOKEN is valid and has Copilot access. Run `gh auth status` to check.",
        detail: probeBody.slice(0, 240) || null,
      });
    } else if (probeStatus === 429) {
      checks.push({
        code: "copilot_hello_probe_rate_limited",
        level: "warn",
        message: "GitHub Models API returned HTTP 429 — rate limited.",
        hint: "You are being rate-limited. Wait a moment and retry the probe.",
      });
    } else {
      const detail = probeBody.replace(/\s+/g, " ").trim().slice(0, 240);
      checks.push({
        code: "copilot_hello_probe_failed",
        level: "error",
        message: `GitHub Models API hello probe failed with HTTP ${probeStatus ?? "unknown"}.`,
        ...(detail ? { detail } : {}),
        hint: "Check that your GITHUB_TOKEN has access to GitHub Models. See https://docs.github.com/en/github-models.",
      });
    }
  } catch (err) {
    const name = (err as Error).name;
    if (name === "AbortError") {
      checks.push({
        code: "copilot_hello_probe_timed_out",
        level: "warn",
        message: "GitHub Models API hello probe timed out.",
        hint: "Check your network connectivity to models.inference.ai.azure.com.",
      });
    } else {
      const message = err instanceof Error ? err.message : String(err);
      checks.push({
        code: "copilot_hello_probe_network_error",
        level: "error",
        message: "GitHub Models API hello probe encountered a network error.",
        detail: message.slice(0, 240),
        hint: "Check your network connectivity and proxy settings.",
      });
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
