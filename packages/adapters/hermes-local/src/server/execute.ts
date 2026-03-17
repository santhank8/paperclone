/**
 * Server-side execution logic for the Hermes Agent adapter.
 *
 * Spawns `hermes chat -q "..." -Q` as a child process, streams output,
 * and returns structured results to Paperclip.
 *
 * Verified CLI flags (hermes chat):
 *   -q/--query         single query (non-interactive)
 *   -Q/--quiet         quiet mode (no banner/spinner, only response + session_id)
 *   -m/--model         model name (e.g. anthropic/claude-sonnet-4)
 *   -t/--toolsets      comma-separated toolsets to enable
 *   --provider         inference provider (auto, openrouter, nous, etc.)
 *   -r/--resume        resume session by ID
 *   -w/--worktree      isolated git worktree
 *   -v/--verbose       verbose output
 *   --checkpoints      filesystem checkpoints
 */

import {
  runChildProcess,
  buildPaperclipEnv,
  renderTemplate,
  ensureAbsoluteDirectory,
  parseObject,
} from "@paperclipai/adapter-utils/server-utils";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  HERMES_CLI,
  DEFAULT_TIMEOUT_SEC,
  DEFAULT_GRACE_SEC,
  DEFAULT_MODEL,
  AUTO_MODEL,
  VALID_PROVIDERS,
  SESSION_ID_REGEX,
  SESSION_ID_REGEX_LEGACY,
  TOKEN_USAGE_REGEX,
  COST_REGEX,
} from "./constants.js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

// ---------------------------------------------------------------------------
// Config helpers
// ---------------------------------------------------------------------------

function cfgString(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function cfgNumber(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function cfgBoolean(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

function cfgStringArray(v: unknown): string[] | undefined {
  return Array.isArray(v) && v.every((i) => typeof i === "string")
    ? v
    : undefined;
}

// ---------------------------------------------------------------------------
// Auto-detect current model from Hermes config (config.yaml or .env)
// ---------------------------------------------------------------------------

/**
 * Detect HERMES_HOME from a wrapper script.
 * Checks common locations (/usr/local/bin, ~/.local/bin, ~/bin) for the script
 * and extracts HERMES_HOME from its contents.
 */
function detectHermesHome(hermesCmd: string): string | null {
  // If hermesCmd is just "hermes", use default ~/.hermes
  if (hermesCmd === "hermes" || hermesCmd === HERMES_CLI) {
    return null; // Signal to use default
  }

  // Common script locations to check
  const searchPaths = [
    "/usr/local/bin",
    resolve(homedir(), ".local/bin"),
    resolve(homedir(), "bin"),
  ];

  for (const searchPath of searchPaths) {
    const scriptPath = resolve(searchPath, hermesCmd);
    if (existsSync(scriptPath)) {
      try {
        const content = readFileSync(scriptPath, "utf8");
        // Look for HERMES_HOME= pattern in the script
        const match = content.match(/HERMES_HOME\s*=\s*["']?([^"'\n]+)["']?/);
        if (match?.[1]) {
          return match[1].trim();
        }
        // Also check for HERMES_HOME assignment with tilde expansion
        const tildeMatch = content.match(/HERMES_HOME\s*=\s*(~[^"'\n]*)/);
        if (tildeMatch?.[1]) {
          // Expand tilde to home directory
          return tildeMatch[1].trim().replace(/^~/, homedir());
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  return null;
}

/**
 * Simple YAML parser for Hermes config.yaml model section.
 * Handles nested model: block with default, provider, base_url.
 */
function parseYamlModelSection(content: string): Record<string, string> {
  const lines = content.split("\n");
  const result: Record<string, string> = {};
  let inModelSection = false;
  let modelIndent = 0;

  for (const line of lines) {
    // Match "model:" at start of line
    if (/^model:\s*$/.test(line)) {
      inModelSection = true;
      modelIndent = 0;
      continue;
    }

    if (inModelSection) {
      // Check if we've left the model section (another top-level key)
      if (/^[a-zA-Z]/.test(line) && !line.startsWith(" ")) {
        break;
      }

      // Match nested keys like "  default: glm-5"
      const nestedMatch = line.match(/^(\s+)(default|provider|base_url):\s*(.+)$/);
      if (nestedMatch) {
        const [, indent, key, value] = nestedMatch;
        if (modelIndent === 0) {
          modelIndent = indent.length;
        }
        // Only capture direct children of model:
        if (indent.length === modelIndent) {
          result[key] = value.trim().replace(/^['"]|['"]$/g, "");
        }
      }
    }
  }

  return result;
}

/**
 * Detected Hermes config values.
 */
interface DetectedHermesConfig {
  model: string | null;
  provider: string | null;
  baseUrl: string | null;
}

/**
 * Detect current model/provider/base_url from Hermes config.
 * Priority: config.yaml (new format) > .env (legacy LLM_MODEL)
 * 
 * @param hermesCmd - Optional custom Hermes command (e.g., "hermes-qwen")
 *                    If provided, attempts to detect HERMES_HOME from wrapper script
 */
function detectCurrentModel(hermesCmd?: string): DetectedHermesConfig {
  try {
    // Determine Hermes home directory
    // If a custom command is provided, try to detect its HERMES_HOME
    const hermesHome = hermesCmd 
      ? (detectHermesHome(hermesCmd) || resolve(homedir(), ".hermes"))
      : resolve(homedir(), ".hermes");

    // Try config.yaml first (new format)
    const configPath = resolve(hermesHome, "config.yaml");
    if (existsSync(configPath)) {
      const content = readFileSync(configPath, "utf8");
      const modelCfg = parseYamlModelSection(content);
      if (modelCfg.default) {
        return {
          model: modelCfg.default,
          provider: modelCfg.provider || null,
          baseUrl: modelCfg.base_url || null,
        };
      }
    }

    // Fallback to .env (legacy format)
    const envPath = resolve(hermesHome, ".env");
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, "utf8");
      const match = content.match(/^LLM_MODEL\s*=\s*(.+)$/m);
      if (match?.[1]) {
        return {
          model: match[1].trim().replace(/^['"]|['"]$/g, ""),
          provider: null,
          baseUrl: null,
        };
      }
    }
  } catch {
    // Ignore errors, fall back to default
  }

  return { model: null, provider: null, baseUrl: null };
}

// ---------------------------------------------------------------------------
// Wake-up prompt builder
// ---------------------------------------------------------------------------

const DEFAULT_PROMPT_TEMPLATE = `You are "{{agentName}}", an AI agent employee in a Paperclip-managed company.

IMPORTANT: Use \`terminal\` tool with \`curl\` for ALL Paperclip API calls (web_extract and browser cannot access localhost).

Your Paperclip identity:
  Agent ID: {{agentId}}
  Company ID: {{companyId}}
  API Base: {{paperclipApiUrl}}

CRITICAL: You are an AUTONOMOUS AGENT. When you identify work that needs to be done, DO IT. Do not ask for permission. Do not make recommendations. EXECUTE.

{{#taskId}}
## Assigned Task

Issue ID: {{taskId}}
Title: {{taskTitle}}

{{taskBody}}

## Workflow

1. Checkout the issue: \`curl -s -X POST "{{paperclipApiUrl}}/issues/{{taskId}}/checkout" -H "Content-Type: application/json" -d '{"agentId":"{{agentId}}"}'\`
2. Work on the task using your tools
3. When done, mark completed: \`curl -s -X PATCH "{{paperclipApiUrl}}/issues/{{taskId}}" -H "Content-Type: application/json" -d '{"status":"done"}'\`
4. Report what you did
{{/taskId}}

{{#noTask}}
## Heartbeat Wake — AUTONOMOUS WORK CYCLE

You are autonomous. Follow this procedure EVERY heartbeat:

### Step 1: Check for assigned work
\`curl -s "{{paperclipApiUrl}}/companies/{{companyId}}/issues?assigneeAgentId={{agentId}}&status=todo,in_progress" | python3 -m json.tool\`

If you have assigned work, checkout and do it. Otherwise continue.

### Step 2: Check for unassigned backlog items
\`curl -s "{{paperclipApiUrl}}/companies/{{companyId}}/issues?status=backlog" | python3 -m json.tool\`

If there are unassigned backlog items you can do, checkout and work on them.

### Step 3: Check company goals (CRITICAL - DO NOT SKIP)
\`curl -s "{{paperclipApiUrl}}/companies/{{companyId}}/goals" | python3 -m json.tool\`

For each active goal:
- Check if there are issues linked to it: \`curl -s "{{paperclipApiUrl}}/companies/{{companyId}}/issues?goalId=GOAL_ID" | python3 -m json.tool\`
- If the goal has NO issues or all issues are "done", CREATE tasks to advance the goal
- Use your judgment to break goals into actionable tasks

### Step 4: CREATE TASKS if needed (YOU MUST DO THIS, NOT RECOMMEND)

To create an issue:
\`\`\`bash
curl -s -X POST "{{paperclipApiUrl}}/companies/{{companyId}}/issues" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "Task title",
    "description": "What needs to be done",
    "status": "todo",
    "priority": "high",
    "goalId": "GOAL_ID_IF_APPLICABLE",
    "assigneeAgentId": "AGENT_ID_OR_NULL"
  }'
\`\`\`

### Step 5: Report status
Brief summary of:
- What you checked
- What you found
- What actions you took (tasks created, assigned, etc.)

DO NOT say "standing by" or "waiting for work". If there are goals without tasks, CREATE TASKS.
{{/noTask}}`;

interface BuildPromptContext {
  agent: {
    id: string;
    name: string;
    companyId: string;
  };
  runId: string;
  config?: {
    taskId?: string;
    taskTitle?: string;
    taskBody?: string;
    companyName?: string;
    projectName?: string;
  };
}

function buildPrompt(
  ctx: BuildPromptContext,
  config: Record<string, unknown>
): string {
  const template =
    cfgString(config.promptTemplate) || DEFAULT_PROMPT_TEMPLATE;
  const taskId = cfgString(ctx.config?.taskId);
  const taskTitle = cfgString(ctx.config?.taskTitle) || "";
  const taskBody = cfgString(ctx.config?.taskBody) || "";
  const agentName = ctx.agent.name || "Hermes Agent";
  const companyName = cfgString(ctx.config?.companyName) || "";
  const projectName = cfgString(ctx.config?.projectName) || "";

  // Build API URL — ensure it has the /api path
  let paperclipApiUrl =
    cfgString(config.paperclipApiUrl) ||
    process.env.PAPERCLIP_API_URL ||
    "http://127.0.0.1:3100/api";

  // Ensure /api suffix
  if (!paperclipApiUrl.endsWith("/api")) {
    paperclipApiUrl = paperclipApiUrl.replace(/\/+$/, "") + "/api";
  }

  const vars: Record<string, string> = {
    agentId: ctx.agent.id,
    agentName,
    companyId: ctx.agent.companyId,
    companyName,
    runId: ctx.runId,
    taskId: taskId || "",
    taskTitle,
    taskBody,
    projectName,
    paperclipApiUrl,
  };

  // Handle conditional sections: {{#key}}...{{/key}}
  let rendered = template;

  // {{#taskId}}...{{/taskId}} — include if task is assigned
  rendered = rendered.replace(
    /\{\{#taskId\}\}([\s\S]*?)\{\{\/taskId\}\}/g,
    taskId ? "$1" : ""
  );

  // {{#noTask}}...{{/noTask}} — include if no task
  rendered = rendered.replace(
    /\{\{#noTask\}\}([\s\S]*?)\{\{\/noTask\}\}/g,
    taskId ? "" : "$1"
  );

  // Replace remaining {{variable}} placeholders
  return renderTemplate(rendered, vars);
}

// ---------------------------------------------------------------------------
// Output parsing
// ---------------------------------------------------------------------------

interface ParsedHermesOutput {
  sessionId?: string;
  response?: string;
  usage?: { inputTokens: number; outputTokens: number };
  costUsd?: number;
  errorMessage?: string;
}

function parseHermesOutput(stdout: string, stderr: string): ParsedHermesOutput {
  const combined = stdout + "\n" + stderr;
  const result: ParsedHermesOutput = {};

  // In quiet mode, Hermes outputs:
  //   <response text>
  //
  //   session_id: <id>
  const sessionMatch = stdout.match(SESSION_ID_REGEX);
  if (sessionMatch?.[1]) {
    result.sessionId = sessionMatch[1];
    // The response is everything before the session_id line
    const sessionLineIdx = stdout.lastIndexOf("\nsession_id:");
    if (sessionLineIdx > 0) {
      result.response = stdout.slice(0, sessionLineIdx).trim();
    }
  } else {
    // Legacy format (non-quiet mode)
    const legacyMatch = combined.match(SESSION_ID_REGEX_LEGACY);
    if (legacyMatch?.[1]) {
      result.sessionId = legacyMatch[1];
    }
  }

  // Extract token usage
  const usageMatch = combined.match(TOKEN_USAGE_REGEX);
  if (usageMatch) {
    result.usage = {
      inputTokens: parseInt(usageMatch[1], 10) || 0,
      outputTokens: parseInt(usageMatch[2], 10) || 0,
    };
  }

  // Extract cost
  const costMatch = combined.match(COST_REGEX);
  if (costMatch?.[1]) {
    result.costUsd = parseFloat(costMatch[1]);
  }

  // Check for error patterns in stderr
  if (stderr.trim()) {
    const errorLines = stderr
      .split("\n")
      .filter((line) => /error|exception|traceback|failed/i.test(line))
      .filter((line) => !/INFO|DEBUG|warn/i.test(line)); // skip log-level noise
    if (errorLines.length > 0) {
      result.errorMessage = errorLines.slice(0, 5).join("\n");
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main execute
// ---------------------------------------------------------------------------

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const config = parseObject(ctx.agent.adapterConfig);

  // ── Resolve configuration ──────────────────────────────────────────────
  const hermesCmd = cfgString(config.hermesCommand) || HERMES_CLI;
  const configuredModel = cfgString(config.model);
  const configuredProvider = cfgString(config.provider);

  // Auto-detect from Hermes config.yaml if model/provider not explicitly set
  const detected = detectCurrentModel(hermesCmd);
  const model =
    configuredModel === AUTO_MODEL || !configuredModel
      ? detected.model || DEFAULT_MODEL
      : configuredModel;

  // Provider: use configured, else detected from config.yaml
  // Note: "custom" provider means Hermes handles it internally via config.yaml
  const provider = configuredProvider || detected.provider;

  const timeoutSec = cfgNumber(config.timeoutSec) || DEFAULT_TIMEOUT_SEC;
  const graceSec = cfgNumber(config.graceSec) || DEFAULT_GRACE_SEC;
  const toolsets =
    cfgString(config.toolsets) ||
    cfgStringArray(config.enabledToolsets)?.join(",");
  const extraArgs = cfgStringArray(config.extraArgs);
  const persistSession = cfgBoolean(config.persistSession) !== false;
  const worktreeMode = cfgBoolean(config.worktreeMode) === true;
  const checkpoints = cfgBoolean(config.checkpoints) === true;

  // ── Build prompt ───────────────────────────────────────────────────────
  const prompt = buildPrompt(
    {
      agent: ctx.agent,
      runId: ctx.runId,
      config: {
        taskId: cfgString(ctx.context.taskId) || cfgString(ctx.context.issueId),
        taskTitle: cfgString(ctx.context.taskTitle) || cfgString(ctx.context.issueTitle),
        taskBody: cfgString(ctx.context.taskBody) || cfgString(ctx.context.issueBody),
        companyName: cfgString(ctx.context.companyName),
        projectName: cfgString(ctx.context.projectName),
      },
    },
    config
  );

  // ── Build command args ─────────────────────────────────────────────────
  // Use -Q (quiet) to get clean output: just response + session_id line
  const useQuiet = cfgBoolean(config.quiet) !== false; // default true
  const args = ["chat", "-q", prompt];

  if (useQuiet) args.push("-Q");

  args.push("-m", model);

  // Only pass --provider if it's a valid Hermes provider choice AND not "custom".
  // "custom" provider is handled internally by Hermes via config.yaml.
  if (provider && VALID_PROVIDERS.includes(provider) && provider !== "custom") {
    args.push("--provider", provider);
  }

  if (toolsets) {
    args.push("-t", toolsets);
  }

  if (worktreeMode) args.push("-w");
  if (checkpoints) args.push("--checkpoints");
  if (cfgBoolean(config.verbose) === true) args.push("-v");

  // Session resume
  const prevSessionId = cfgString(ctx.runtime.sessionParams?.sessionId);
  if (persistSession && prevSessionId) {
    args.push("--resume", prevSessionId);
  }

  if (extraArgs?.length) {
    args.push(...extraArgs);
  }

  // ── Build environment ──────────────────────────────────────────────────
  const env: Record<string, string | undefined> = {
    ...process.env,
    ...buildPaperclipEnv({ id: ctx.agent.id, companyId: ctx.agent.companyId }),
  };

  if (ctx.runId) env.PAPERCLIP_RUN_ID = ctx.runId;

  const taskId = cfgString(ctx.context.taskId) || cfgString(ctx.context.issueId);
  if (taskId) env.PAPERCLIP_TASK_ID = taskId;

  const userEnv = config.env;
  if (userEnv && typeof userEnv === "object") {
    Object.assign(env, userEnv as Record<string, string>);
  }

  // ── Resolve working directory ──────────────────────────────────────────
  // Priority: config.cwd > context.paperclipWorkspace.cwd > "."
  const workspaceContext = parseObject(ctx.context.paperclipWorkspace);
  const workspaceCwd = cfgString(workspaceContext.cwd);
  const configuredCwd = cfgString(config.cwd);
  const cwd = configuredCwd || workspaceCwd || ".";
  try {
    await ensureAbsoluteDirectory(cwd);
  } catch {
    // Non-fatal
  }

  // ── Log start ──────────────────────────────────────────────────────────
  await ctx.onLog(
    "stdout",
    `[hermes] Starting Hermes Agent (model=${model}, timeout=${timeoutSec}s)\n`
  );
  if (prevSessionId) {
    await ctx.onLog(
      "stdout",
      `[hermes] Resuming session: ${prevSessionId}\n`
    );
  }

  // ── Execute ────────────────────────────────────────────────────────────
  const result = await runChildProcess(ctx.runId || "unknown", hermesCmd, args, {
    cwd,
    env: env as Record<string, string>,
    timeoutSec,
    graceSec,
    onLog: ctx.onLog,
  });

  // ── Parse output ───────────────────────────────────────────────────────
  const parsed = parseHermesOutput(result.stdout || "", result.stderr || "");

  await ctx.onLog(
    "stdout",
    `[hermes] Exit code: ${result.exitCode ?? "null"}, timed out: ${result.timedOut}\n`
  );

  if (parsed.sessionId) {
    await ctx.onLog("stdout", `[hermes] Session: ${parsed.sessionId}\n`);
  }

  // ── Build result ───────────────────────────────────────────────────────
  const executionResult: AdapterExecutionResult = {
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: result.timedOut,
    provider: provider || null,
    model,
  };

  if (parsed.errorMessage) {
    executionResult.errorMessage = parsed.errorMessage;
  }

  if (parsed.usage) {
    executionResult.usage = parsed.usage;
  }

  if (parsed.costUsd !== undefined) {
    executionResult.costUsd = parsed.costUsd;
  }

  // Summary from agent response
  if (parsed.response) {
    executionResult.summary = parsed.response.slice(0, 2000);
  }

  // Store session ID for next run
  if (persistSession && parsed.sessionId) {
    executionResult.sessionParams = { sessionId: parsed.sessionId };
    executionResult.sessionDisplayId = parsed.sessionId.slice(0, 16);
  }

  return executionResult;
}