import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";
import { asString } from "../utils.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:1234";

function summarize(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((c) => c.level === "error")) return "fail";
  if (checks.some((c) => c.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const baseUrl = asString(ctx.config.baseUrl, DEFAULT_BASE_URL).replace(/\/$/, "");
  const model = asString(ctx.config.model, "");

  checks.push({
    code: "lmstudio_base_url",
    level: "info",
    message: `LM Studio base URL: ${baseUrl}`,
  });

  if (model) {
    checks.push({ code: "lmstudio_model_configured", level: "info", message: `Model: ${model}` });
  } else {
    checks.push({ code: "lmstudio_model_default", level: "info", message: "Model: qwen/qwen3.5-35b-a3b (default)" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    if (res.ok) {
      const data = (await res.json()) as { data?: Array<{ id: string }> };
      const models = (data?.data ?? []).map((m) => m.id);
      checks.push({
        code: "lmstudio_reachable",
        level: "info",
        message: `LM Studio is reachable. ${models.length} model(s) loaded: ${models.slice(0, 5).join(", ")}`,
      });
      if (model && !models.includes(model)) {
        checks.push({
          code: "lmstudio_model_not_loaded",
          level: "warn",
          message: `Model "${model}" is not currently loaded in LM Studio.`,
          hint: "Load the model in LM Studio before running this agent.",
        });
      }
    } else {
      checks.push({
        code: "lmstudio_error_response",
        level: "warn",
        message: `LM Studio returned HTTP ${res.status}. May still be starting up.`,
      });
    }
  } catch {
    checks.push({
      code: "lmstudio_unreachable",
      level: "warn",
      message: `Cannot reach LM Studio at ${baseUrl}.`,
      hint: "Start LM Studio and load a model before invoking this agent.",
    });
  } finally {
    clearTimeout(timeout);
  }

  return {
    adapterType: "lmstudio_local",
    status: summarize(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
