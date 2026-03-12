import { Router } from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  pluginActionResponseSchema,
  pluginInstallBodySchema,
  pluginListResponseSchema,
  pluginRestartResponseSchema,
  pluginToggleBodySchema,
} from "@paperclipai/shared";
import { assertBoard } from "./authz.js";
import { validate } from "../middleware/validate.js";
import { badRequest } from "../errors.js";

type CliJson = Record<string, unknown>;

function resolveRepoRoot(): string {
  return path.resolve(process.cwd());
}

function maybeInstanceArgs(instanceId: string | null): string[] {
  if (!instanceId) return [];
  return ["--instance", instanceId];
}

function readInstanceQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function runPluginCliJson(args: string[]): Promise<CliJson> {
  const repoRoot = resolveRepoRoot();
  const tsxCli = path.resolve(repoRoot, "cli/node_modules/tsx/dist/cli.mjs");
  const cliEntrypoint = path.resolve(repoRoot, "cli/src/index.ts");

  const hasLocalTsxCli = existsSync(tsxCli) && existsSync(cliEntrypoint);

  const command = hasLocalTsxCli ? process.execPath : "paperclipai";
  const commandArgs = hasLocalTsxCli
    ? [tsxCli, cliEntrypoint, "plugin", ...args, "--json"]
    : ["plugin", ...args, "--json"];

  const { stdout, stderr, code } = await new Promise<{
    stdout: string;
    stderr: string;
    code: number | null;
  }>((resolve) => {
    const child = spawn(command, commandArgs, {
      cwd: repoRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("close", (exitCode) => {
      resolve({ stdout, stderr, code: exitCode });
    });
  });

  if (code !== 0) {
    const message = stderr.trim() || stdout.trim() || `plugin command failed (exit ${String(code)})`;
    throw badRequest(message);
  }

  try {
    return JSON.parse(stdout) as CliJson;
  } catch {
    throw badRequest("plugin command returned invalid JSON");
  }
}

export function pluginRoutes() {
  const router = Router();

  router.get("/instance/plugins", async (req, res) => {
    assertBoard(req);
    const instanceId = readInstanceQuery(req.query.instance);
    const payload = await runPluginCliJson(["list", ...maybeInstanceArgs(instanceId)]);
    const parsed = pluginListResponseSchema.parse(payload);
    res.json(parsed);
  });

  router.post("/instance/plugins/install", validate(pluginInstallBodySchema), async (req, res) => {
    assertBoard(req);
    const instanceId = readInstanceQuery(req.query.instance);
    const payload = await runPluginCliJson([
      "install",
      req.body.path,
      ...(req.body.skipBootstrap ? ["--skip-bootstrap"] : []),
      ...maybeInstanceArgs(instanceId),
    ]);
    const parsed = pluginActionResponseSchema.parse(payload);
    res.status(201).json(parsed);
  });

  router.patch("/instance/plugins/:pluginId/enabled", validate(pluginToggleBodySchema), async (req, res) => {
    assertBoard(req);
    const instanceId = readInstanceQuery(req.query.instance);
    const command = req.body.enabled ? "enable" : "disable";
    const payload = await runPluginCliJson([
      command,
      String(req.params.pluginId),
      ...maybeInstanceArgs(instanceId),
    ]);
    const parsed = pluginActionResponseSchema.parse(payload);
    res.json(parsed);
  });

  router.post("/instance/plugins/:pluginId/restart", async (req, res) => {
    assertBoard(req);
    const instanceId = readInstanceQuery(req.query.instance);

    const resultPayload = await runPluginCliJson([
      "restart",
      String(req.params.pluginId),
      ...maybeInstanceArgs(instanceId),
    ]);

    const listPayload = await runPluginCliJson(["list", ...maybeInstanceArgs(instanceId)]);

    const parsedResult = pluginRestartResponseSchema
      .pick({ result: true })
      .parse({ result: resultPayload.result });
    const parsedList = pluginListResponseSchema.parse(listPayload);
    const plugin = parsedList.plugins.find((item) => item.pluginId === String(req.params.pluginId));
    if (!plugin) {
      throw badRequest(`Plugin not found after restart: ${String(req.params.pluginId)}`);
    }

    res.json({ result: parsedResult.result, plugin });
  });

  return router;
}
