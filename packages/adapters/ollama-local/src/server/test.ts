import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import { asString, parseObject } from "@paperclipai/adapter-utils/server-utils";
import {
  chatWithOllama,
  discoverOllamaModels,
  ensureOllamaModelConfiguredAndAvailable,
  normalizeOllamaBaseUrl,
} from "./models.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function firstNonEmptyLine(text: string) {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  );
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const configuredModel = asString(config.model, "").trim();
  const allowUndiscoveredModel = config.allowUndiscoveredModel === true;

  let baseUrl = "";
  try {
    baseUrl = normalizeOllamaBaseUrl(config.baseUrl ?? config.url);
    checks.push({
      code: "ollama_base_url_valid",
      level: "info",
      message: `Ollama base URL: ${baseUrl}`,
    });
  } catch (err) {
    checks.push({
      code: "ollama_base_url_invalid",
      level: "error",
      message: err instanceof Error ? err.message : "Invalid Ollama base URL",
    });
  }

  if (!configuredModel) {
    checks.push({
      code: "ollama_model_required",
      level: "error",
      message: "Ollama requires a configured model.",
      hint: "Set adapterConfig.model to a local model such as qwen2.5:7b.",
    });
  }

  const canProbe = checks.every((check) => check.level !== "error");

  if (canProbe) {
    try {
      const discovered = await discoverOllamaModels({ baseUrl });
      checks.push({
        code: "ollama_models_discovered",
        level: discovered.length > 0 ? "info" : "warn",
        message:
          discovered.length > 0
            ? `Discovered ${discovered.length} local model(s) from Ollama.`
            : "Ollama returned no local models from /api/tags.",
      });
    } catch (err) {
      checks.push({
        code: "ollama_models_discovery_failed",
        level: allowUndiscoveredModel ? "warn" : "error",
        message: err instanceof Error ? err.message : "Failed to query Ollama /api/tags.",
        hint: "Check that Ollama is running and reachable from this machine.",
      });
    }
  }

  if (canProbe && configuredModel) {
    try {
      await ensureOllamaModelConfiguredAndAvailable({
        model: configuredModel,
        baseUrl,
        allowUndiscoveredModel,
      });
      checks.push({
        code: "ollama_model_configured",
        level: "info",
        message: `Configured model: ${configuredModel}`,
      });
    } catch (err) {
      checks.push({
        code: "ollama_model_invalid",
        level: allowUndiscoveredModel ? "warn" : "error",
        message: err instanceof Error ? err.message : "Configured Ollama model is unavailable.",
        hint: allowUndiscoveredModel
          ? "Model discovery was relaxed. If runs still fail, verify the model name in `ollama list`."
          : "Run `ollama list` and choose a local model name returned by Ollama.",
      });
    }
  }

  if (canProbe && configuredModel) {
    try {
      const response = await chatWithOllama({
        baseUrl,
        model: configuredModel,
        timeoutMs: 60_000,
        messages: [
          { role: "user", content: "Respond with hello." },
        ],
      });
      const reply = response.message?.content?.trim() ?? "";
      const hasHello = /\bhello\b/i.test(reply);
      checks.push({
        code: hasHello ? "ollama_hello_probe_passed" : "ollama_hello_probe_unexpected_output",
        level: hasHello ? "info" : "warn",
        message: hasHello
          ? "Ollama hello probe succeeded."
          : "Ollama replied, but the response did not include `hello`.",
        ...(reply ? { detail: firstNonEmptyLine(reply).slice(0, 240) } : {}),
      });
    } catch (err) {
      checks.push({
        code: "ollama_hello_probe_failed",
        level: "error",
        message: err instanceof Error ? err.message : "Ollama hello probe failed.",
        hint: "Verify that the selected model is pulled locally and Ollama is serving requests.",
      });
    }
  }

  return {
    adapterType: "ollama_local",
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
