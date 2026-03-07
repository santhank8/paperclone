import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { AdapterModel } from "./types.js";
import { asString, asStringArray, parseObject, ensurePathInEnv } from "./utils.js";

const ACP_MODELS_TIMEOUT_MS = 15_000;
const ACP_MODELS_CACHE_TTL_MS = 120_000;

interface CacheEntry {
  fingerprint: string;
  expiresAt: number;
  models: AdapterModel[];
}

let cached: CacheEntry | null = null;

function fingerprint(command: string, args: string[]): string {
  return `${command}:${args.join(",")}`;
}

function parseAvailableModels(result: Record<string, unknown>): AdapterModel[] {
  const models: AdapterModel[] = [];
  const modelsObj = result.models as Record<string, unknown> | undefined;
  if (!modelsObj || typeof modelsObj !== "object") return models;

  const available = modelsObj.availableModels;
  if (!Array.isArray(available)) return models;

  const seen = new Set<string>();
  for (const entry of available) {
    if (typeof entry !== "object" || entry === null) continue;
    const rec = entry as Record<string, unknown>;
    const id = typeof rec.modelId === "string" ? rec.modelId.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = typeof rec.name === "string" ? rec.name.trim() : id;
    models.push({ id, label: name });
  }

  return models;
}

function probeModels(
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
): Promise<AdapterModel[]> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve([]);
    }, ACP_MODELS_TIMEOUT_MS);

    const proc = spawn(command, args, {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    function cleanup() {
      clearTimeout(timeout);
      try { proc.kill("SIGTERM"); } catch { /* ignore */ }
    }

    proc.on("error", () => {
      cleanup();
      resolve([]);
    });

    const rl = createInterface({ input: proc.stdout! });
    let initDone = false;

    rl.on("line", (line) => {
      try {
        const msg = JSON.parse(line);

        // Response to initialize (id=1)
        if (msg.id === 1 && !initDone) {
          initDone = true;
          if (msg.error) {
            cleanup();
            rl.close();
            resolve([]);
            return;
          }
          // Send session/new to get available models
          proc.stdin?.write(JSON.stringify({
            jsonrpc: "2.0",
            id: 2,
            method: "session/new",
            params: { cwd, mcpServers: [] },
          }) + "\n");
        }

        // Response to session/new (id=2)
        if (msg.id === 2) {
          cleanup();
          rl.close();
          if (msg.error || !msg.result) {
            resolve([]);
            return;
          }
          resolve(parseAvailableModels(msg.result));
        }
      } catch {
        // Not JSON — ignore
      }
    });

    // Send initialize
    proc.stdin?.write(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: 1,
        clientCapabilities: {
          fs: { readTextFile: true, writeTextFile: true },
          terminal: true,
        },
        clientInfo: { name: "paperclip", version: "1.0.0" },
      },
    }) + "\n");
  });
}

export async function listAcpModels(config?: Record<string, unknown>): Promise<AdapterModel[]> {
  const cfg = config ?? {};
  const command = asString(cfg.command, "kiro-cli");
  const args = asStringArray(cfg.args).length > 0 ? asStringArray(cfg.args) : ["acp"];
  const cwd = asString(cfg.cwd, process.cwd());
  const fp = fingerprint(command, args);

  const now = Date.now();
  if (cached && cached.fingerprint === fp && cached.expiresAt > now) {
    return cached.models;
  }

  const envConfig = parseObject(cfg.env);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(envConfig)) {
    if (typeof v === "string") env[k] = v;
  }
  const fullEnv = ensurePathInEnv({ ...process.env, ...env }) as Record<string, string>;

  const discovered = await probeModels(command, args, cwd, fullEnv);

  if (discovered.length > 0) {
    cached = { fingerprint: fp, expiresAt: now + ACP_MODELS_CACHE_TTL_MS, models: discovered };
    return discovered;
  }

  // Return stale cache if probe failed
  if (cached && cached.fingerprint === fp && cached.models.length > 0) {
    return cached.models;
  }

  return [];
}
