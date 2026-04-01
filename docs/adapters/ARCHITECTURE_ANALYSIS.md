# Paperclip Adapter Architecture Analysis

## Overview

Paperclip's adapter system is a modular, three-consumer architecture that bridges the orchestration layer to various AI agent runtimes. Each adapter is a self-contained package that serves the server, UI, and CLI with runtime-specific implementations.

---

## 1. Directory Structure & Package Layout

### Root Structure
```
packages/adapters/
├── claude-local/          # Claude Code (local)
├── codex-local/           # Codex CLI (local)
├── copilot-cli/           # GitHub Copilot CLI
├── cursor-local/          # Cursor IDE (local)
├── gemini-local/          # Google Gemini (local)
├── openclaw-gateway/      # OpenClaw API gateway
├── opencode-local/        # OpenCode (local)
└── pi-local/              # Pi (local)
```

### Package Structure (Example: claude-local)
```
packages/adapters/claude-local/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts               # Metadata & routing (shared by all consumers)
    ├── server/
    │   ├── index.ts           # Server exports
    │   ├── execute.ts         # Main execution logic
    │   ├── parse.ts           # Output parser
    │   ├── test.ts            # Environment diagnostics
    │   ├── batch.ts           # Batch API support (Claude-specific)
    │   ├── quota.ts           # Quota tracking
    │   └── skills.ts          # Skill management
    ├── ui/
    │   ├── index.ts           # UI exports
    │   ├── parse-stdout.ts    # Transcript parsing
    │   └── build-config.ts    # Config builder
    └── cli/
        ├── index.ts           # CLI exports
        ├── format-event.ts    # Terminal formatting
        └── quota-probe.ts     # CLI quota probing
```

---

## 2. The Four-Export Convention

Each adapter package exports exactly **four entry points** to serve different consumers:

```json
{
  "exports": {
    ".": "./src/index.ts",           # Metadata (all consumers)
    "./server": "./src/server/index.ts",  # Server
    "./ui": "./src/ui/index.ts",          # UI
    "./cli": "./src/cli/index.ts"         # CLI
  }
}
```

This enforces clean module boundaries:
- **Root export (`.`)**: Metadata only (type, label, models, documentation) — no Node.js APIs, no React
- **Server export (`./server`)**: Full Node.js access, process spawning, file I/O, async operations
- **UI export (`./ui`)**: React components, DOM utilities — no Node.js APIs
- **CLI export (`./cli`)**: Terminal formatting, colored output — no React, minimal overhead

---

## 3. Three-Consumer Registration Pattern

### Server Registry (`server/src/adapters/registry.ts`)

Registers `ServerAdapterModule` implementations:

```typescript
interface ServerAdapterModule {
  type: string;                          // "claude_local", "codex_local", etc.
  execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult>;
  testEnvironment(ctx: AdapterEnvironmentTestContext): Promise<AdapterEnvironmentTestResult>;
  listSkills?: (ctx: AdapterSkillContext) => Promise<AdapterSkillSnapshot>;
  syncSkills?: (ctx: AdapterSkillContext, entries: AdapterSkillEntry[]) => Promise<void>;
  sessionCodec?: AdapterSessionCodec;
  sessionManagement?: SessionManagementOptions;
  models?: AdapterModel[];
  listModels?: () => Promise<AdapterModel[]>;
  supportsLocalAgentJwt?: boolean;
  agentConfigurationDoc?: string;
  getQuotaWindows?: (ctx: AdapterSkillContext) => Promise<QuotaWindow[]>;
}
```

**Current adapters registered** (10 total):
- claude_local (with quota tracking, batch API)
- codex_local (with model listing, quota tracking)
- cursor (with model listing)
- gemini_local
- openclaw_gateway
- opencode_local (with dynamic model listing)
- pi_local (with dynamic model listing)
- hermes_local (external package)
- copilot_cli
- process (built-in, for spawning arbitrary processes)
- http (built-in, for HTTP endpoints)

### UI Registry (`ui/src/adapters/registry.ts`)

Registers `UIAdapterModule` implementations (React components + builders):

```typescript
interface UIAdapterModule {
  type: string;
  label: string;
  parseStdoutLine(line: string, ts: string): TranscriptEntry[];
  ConfigFields: ComponentType<AdapterConfigFieldsProps>;
  buildAdapterConfig(values: CreateConfigValues): Record<string, unknown>;
}
```

Adapters are queried by type; fallback to `processUIAdapter` if type not found.

### CLI Registry (`cli/src/adapters/registry.ts`)

Registers `CLIAdapterModule` implementations:

```typescript
interface CLIAdapterModule {
  type: string;
  formatStdoutEvent(line: string, debug: boolean): void;
}
```

Used by `paperclipai run --watch` to pretty-print agent output in real-time.

---

## 4. Core Execution Flow

### AdapterExecutionContext (Input)
```typescript
interface AdapterExecutionContext {
  runId: string;
  agent: AdapterAgent;                // { id, companyId, name, adapterType, adapterConfig }
  runtime: AdapterRuntime;            // Session & task context
  config: Record<string, unknown>;    // Agent's adapterConfig blob
  context: Record<string, unknown>;   // Runtime context (taskId, wakeReason, etc.)
  onLog: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
  onMeta?: (meta: AdapterInvocationMeta) => Promise<void>;
  onSpawn?: (meta: { pid: number; startedAt: string }) => Promise<void>;
  authToken?: string;
}
```

### AdapterExecutionResult (Output)
```typescript
interface AdapterExecutionResult {
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  errorMessage?: string | null;
  usage?: UsageSummary;                // Token counts
  sessionParams?: Record<string, unknown> | null;  // Persisted state
  sessionDisplayId?: string | null;
  provider?: string | null;
  model?: string | null;
  costUsd?: number | null;
  billingType?: AdapterBillingType | null;
  resultJson?: Record<string, unknown> | null;
  summary?: string | null;
  clearSession?: boolean;              // Wipe stale session
  question?: {                         // Interactive prompts
    prompt: string;
    choices: Array<{ key: string; label: string }>;
  } | null;
}
```

### Lifecycle

1. **Build config** — extract & validate `config` values with type-safe helpers
2. **Build environment** — inject `PAPERCLIP_*` env vars, apply user overrides
3. **Resolve session** — check stored session params for resumable state
4. **Render prompt** — template expansion with `{{agent.id}}`, `{{run.id}}`, etc.
5. **Emit metadata** — call `onMeta()` with command, args, env (redacted), prompt metrics
6. **Spawn process** — run agent CLI or call HTTP endpoint
7. **Stream output** — call `onLog()` for all stdout/stderr (feeds real-time UI)
8. **Parse output** — extract session ID, usage, summary, errors
9. **Handle session errors** — if resume failed, retry fresh and set `clearSession: true`
10. **Return result** — populate `AdapterExecutionResult` with all collected data

---

## 5. Session Management & Resumption

### Design Principle

Sessions enable agents to maintain conversation context across multiple runs. Treat resumption as the **default**, not an optimization:

- Agent assigned to issue → run 1 (initial work)
- Issue assigned to different agent → run 2 (may be requested back)
- Comment added to issue → run 3 (wake-up call)
- Approval granted → run 4 (proceed with approval)

Each wake should resume the previous conversation, not start fresh. This avoids retrying the same analysis and prevents contradictory decisions.

### Session Codec

```typescript
interface AdapterSessionCodec {
  deserialize(raw: unknown): Record<string, unknown> | null;
  serialize(params: Record<string, unknown> | null): Record<string, unknown> | null;
  getDisplayId?(params: Record<string, unknown> | null): string | null;
}
```

The codec is opaque — each adapter defines its own session schema. The server stores the serialized form in the database and passes it back on subsequent runs.

### Claude-Local Session Example

```typescript
// Stores session ID + working directory
{
  sessionId: "claude-session-xyz",
  cwd: "/path/to/workspace",
  workspaceId: "ws-123",
  repoUrl: "https://github.com/org/repo",
  repoRef: "main"
}
```

**Resume logic:**
- If `cwd` doesn't match current config cwd → skip resume (prevents cross-project contamination)
- If session lookup fails with "unknown session" → retry fresh, return `clearSession: true`

### CWD-Aware Resumption Pattern

```typescript
const canResumeSession =
  runtimeSessionId.length > 0 &&
  (runtimeSessionCwd.length === 0 || path.resolve(runtimeSessionCwd) === path.resolve(cwd));
```

This prevents a session created in `/project-a` from contaminating `/project-b` if the agent is repurposed.

---

## 6. Environment Injection Strategy

### Standard Paperclip Env Vars (Server-Injected)

| Variable | Source | Purpose |
|----------|--------|---------|
| `PAPERCLIP_AGENT_ID` | `agent.id` | Identify running agent |
| `PAPERCLIP_COMPANY_ID` | `agent.companyId` | Company isolation |
| `PAPERCLIP_API_URL` | Server URL | Agent can call back to Paperclip |
| `PAPERCLIP_RUN_ID` | Current run | Trace execution |
| `PAPERCLIP_TASK_ID` | `context.taskId` | Assigned work item |
| `PAPERCLIP_WAKE_REASON` | `context.wakeReason` | Why agent is running |
| `PAPERCLIP_WAKE_COMMENT_ID` | `context.wakeCommentId` | Comment that woke agent |
| `PAPERCLIP_APPROVAL_ID` | `context.approvalId` | Approval being acted on |
| `PAPERCLIP_APPROVAL_STATUS` | `context.approvalStatus` | approved/rejected/etc. |
| `PAPERCLIP_LINKED_ISSUE_IDS` | `context.issueIds` | Related issues (comma-separated) |
| `PAPERCLIP_WORKSPACE_CWD` | Workspace config | Working directory |
| `PAPERCLIP_WORKSPACE_SOURCE` | Workspace meta | How workspace was created |
| `PAPERCLIP_RUNTIME_PRIMARY_URL` | Runtime service | Service endpoint URL |

### Secret Injection Pattern (Sidecar Injection)

**Rule: Never put secrets in prompts or config fields.**

Instead:
1. Store secret in `config.env.SOME_API_KEY`
2. Server extracts & injects as environment variable
3. Agent's tools read from `$SOME_API_KEY` directly
4. Redact in logs with `redactEnvForLogs()` (masks keys matching `/(key|token|secret|password|authorization|cookie)/i`)

This ensures the LLM never sees the real secret, but spawned tools can access it.

---

## 7. Output Parsing & Transcript Building

### Three-Level Parsing

1. **Server-side parse** (`server/parse.ts`)
   - Extract structured data from agent stdout (session ID, usage, summary, errors)
   - Used by `execute()` to populate `AdapterExecutionResult`
   - Must handle unknown session detection for retry logic

2. **UI-side parse** (`ui/parse-stdout.ts`)
   - Line-by-line JSON parsing for real-time transcript display
   - Produces `TranscriptEntry[]` with kind: "init", "assistant", "tool_call", "tool_result", "result", etc.
   - Used by run detail viewer

3. **CLI-side format** (`cli/format-event.ts`)
   - Pretty-print with colors for `paperclipai run --watch`
   - Uses `picocolors` for cross-platform terminal coloring

### TranscriptEntry Kinds

| Kind | Fields | Usage |
|------|--------|-------|
| `init` | `model`, `sessionId` | Agent initialization |
| `assistant` | `text` | Agent text response |
| `thinking` | `text` | Agent reasoning/thinking |
| `user` | `text` | User message |
| `tool_call` | `name`, `input` | Tool invocation |
| `tool_result` | `toolUseId`, `content`, `isError` | Tool result |
| `result` | `text`, `inputTokens`, `outputTokens`, `costUsd`, etc. | Final result with usage |
| `stderr` | `text` | Stderr output |
| `system` | `text` | System messages |
| `stdout` | `text` | Raw stdout fallback |

---

## 8. Configuration & Form Building

### Config Flow

1. **Agent creation form** (UI)
   - `ConfigFields` React component renders adapter-specific fields
   - User fills in values → `CreateConfigValues`

2. **Config builder** (`ui/build-config.ts`)
   - `buildAdapterConfig(values) → Record<string, unknown>`
   - Stores as JSON blob in `agents.adapter_config` column

3. **Runtime extraction** (`server/execute.ts`)
   - Read & validate with type-safe helpers:
     - `asString(config.cwd, fallback)`
     - `asNumber(config.timeoutSec, 30)`
     - `asBoolean(config.chrome, false)`
     - `asStringArray(config.extraArgs)`
     - `parseObject(config.env)`

### Example: Claude-Local Config

```typescript
{
  cwd: "/path/to/project",
  model: "claude-opus-4-6",
  effort: "high",
  chrome: false,
  promptTemplate: "You are {{agent.name}}...",
  maxTurnsPerRun: 10,
  timeoutSec: 300,
  graceSec: 15,
  env: {
    "MY_API_KEY": "...",
    "CUSTOM_VAR": "value"
  },
  batchMode: "smart",
  batchMaxWaitSec: 86400
}
```

---

## 9. Environment Testing Contract

### Purpose

The "Test environment" button in the agent configuration form runs `testEnvironment()` to validate the runtime setup before saving the agent. Errors block save; warnings are informational.

### Interface

```typescript
async function testEnvironment(ctx: AdapterEnvironmentTestContext): Promise<AdapterEnvironmentTestResult> {
  // Returns:
  // {
  //   adapterType: "claude_local",
  //   status: "pass" | "warn" | "fail",
  //   checks: [
  //     { code: "claude-installed", level: "error", message: "Claude CLI not found in PATH", hint: "Install from..." },
  //     { code: "anthropic-key", level: "warn", message: "ANTHROPIC_API_KEY not set", detail: "Will use subscription auth" }
  //   ],
  //   testedAt: ISO timestamp
  // }
}
```

### Severity Policy

- **error** — Runtime is unusable (Claude CLI not installed, cwd doesn't exist)
- **warn** — Non-blocking but important (auth method fallback, quota warning)
- **info** — Informational (successful checks, feature availability)

Warnings do **not** block agent save. Errors do.

---

## 10. Skills Injection Pattern

Adapters must make Paperclip skills available to agents without polluting the agent's working directory.

### Claude-Local Pattern (tmpdir + `--add-dir`)

1. Create temp directory: `mkdtemp("paperclip-skills-")`
2. Create `.claude/skills/` structure inside
3. Symlink each skill from repo's `skills/` into tmpdir
4. Pass `--add-dir <tmpdir>` to Claude Code
5. Clean up tmpdir in finally block

**Result**: Skills are discovered as registered skills without touching the project cwd.

### Codex-Local Pattern (global skills dir)

Codex has `$CODEX_HOME/skills` (e.g., `~/.codex/skills`). The adapter:

1. Symlinks Paperclip skills to global skills dir (if not already present)
2. Skips overwriting user's own skills
3. No cleanup needed (skills persist across runs)

**Result**: Skills are available to all Codex agents, not just Paperclip ones.

### HTTP/Process Adapters

For adapters without plugin systems, skills content can be:
- Injected into the prompt template
- Provided as files in the workspace
- Passed via env vars with encoding

---

## 11. Adapter-Specific Features & Extensions

### Batch API Support (Claude-Local)

Claude adapter supports Anthropic's Batch API for async execution:
- Config fields: `batchMode` ("never" | "smart" | "always"), `batchMaxWaitSec`, `batchMaxTokens`
- ~50% cost reduction + ~24h latency
- Single-turn execution (no tool callbacks)
- Best for analysis, reports, data processing

### Quota Tracking (Claude-Local, Codex-Local)

Some adapters implement `getQuotaWindows()` to report provider-side rate limits and usage:

```typescript
interface QuotaWindow {
  label: string;              // "5h", "7d", "Sonnet 7d", "Credits"
  usedPercent: number | null; // 0-100, null if not reported
  resetsAt: string | null;    // ISO timestamp
  valueLabel: string | null;  // "$4.20 remaining"
  detail?: string;
}
```

Used by the board UI to show quota warnings & estimated reset times.

### Dynamic Model Listing (Codex, Pi, OpenCode)

Some adapters provide `listModels()` to dynamically discover available models at agent creation time (vs. static list).

### Workspace Strategies (Claude-Local)

Claude supports configurable workspace creation:
- `{ type: "git_worktree", baseRef?, branchTemplate?, worktreeParentDir? }` — Git worktree per run
- Workspace runtime services — local services realized before agent starts, exposed via env vars

### Runtime Service Management

Adapters can report services they've started (databases, servers, etc.) via `runtimeServices` in execution result:

```typescript
interface AdapterRuntimeServiceReport {
  serviceName: string;
  status: "starting" | "running" | "stopped" | "failed";
  lifecycle: "shared" | "ephemeral";  // shared = reused, ephemeral = cleanup after
  port?: number;
  url?: string;
  healthStatus?: "unknown" | "healthy" | "unhealthy";
}
```

---

## 12. Error Handling Patterns

### Unknown Session Detection

When a resume attempt fails:

```typescript
// Try to resume
const sessionId = runtime.sessionParams?.sessionId;
const proc = await attemptWithSession(sessionId);

// If failed and unknown session error detected
if (sessionId && isClaudeUnknownSessionError(proc.stdout)) {
  // Retry fresh
  const fresh = await attemptWithSession(null);
  return toResult(fresh, { clearSession: true });
}
```

This prevents stale session errors from blocking execution.

### Defensive Output Parsing

Treat agent output as untrusted:
- Parse JSON defensively (return null on invalid JSON)
- Use type-safe extraction helpers (asString, asNumber, etc.)
- Never eval() or dynamically execute anything
- Validate session IDs before passing through
- Record URLs/commands in results without acting on them

### Timeout & Grace Period

```typescript
const timeoutSec = asNumber(config.timeoutSec, 300);  // 5 min default
const graceSec = asNumber(config.graceSec, 15);       // SIGTERM grace

// Child process: SIGTERM after timeout, SIGKILL after grace period
```

Safety rails prevent runaway processes from consuming unbounded resources.

---

## 13. Adapter Lifecycle Hooks

### `onLog(stream, chunk)`

Called for every stdout/stderr line. Feeds the real-time run viewer.

```typescript
await ctx.onLog("stdout", JSON.stringify({ kind: "assistant", text: "I found a bug..." }));
```

### `onMeta(meta)`

Called before spawning the process with invocation metadata:

```typescript
await ctx.onMeta?.({
  adapterType: "claude_local",
  command: "claude",
  commandArgs: ["--effort", "high"],
  env: redactEnvForLogs(env),  // ANTHROPIC_API_KEY masked
  prompt: renderedPrompt,
  promptMetrics: { tokenCount: 450 }
});
```

### `onSpawn(meta)`

Called after process spawns, provides PID & start timestamp.

---

## 14. Built-In Adapters

### Process Adapter

Spawns arbitrary shell commands. Used as a fallback for custom agents.

```typescript
config: {
  command: "node",
  args: ["my-script.js"],
  cwd: "/path/to/project"
}
```

### HTTP Adapter

Calls arbitrary HTTP endpoints. Used for cloud-hosted agents.

```typescript
config: {
  url: "https://api.example.com/agent",
  method: "POST",
  headers: { "Authorization": "Bearer token" }
}
```

Both use same session/metadata framework as specialized adapters.

---

## 15. Naming & Conventions

### Adapter Type (snake_case)
- `claude_local` — Claude Code (local)
- `codex_local` — Codex (local)
- `cursor` — Cursor IDE
- `gemini_local` — Google Gemini (local)
- `openclaw_gateway` — OpenClaw API gateway
- `copilot_cli` — GitHub Copilot CLI
- `process` — Process launcher
- `http` — HTTP endpoint

### Package Name
`@paperclipai/adapter-<kebab-case>`

### Directory
`packages/adapters/<kebab-case>/`

### Function Naming
- `execute<AdapterName>()` — main execution function
- `parse<AdapterName>StreamJson()` — output parser
- `is<AdapterName>UnknownSessionError()` — session error detector
- `print<AdapterName>StreamEvent()` — CLI formatter

---

## 16. Key Lessons from Existing Adapters

### Claude-Local (Most Feature-Complete)

- Batch API support for async execution
- Quota windows for rate limit visibility
- Workspace strategies (git worktree, agent home)
- Runtime service management
- Skill management with desired/managed state
- Comprehensive environment testing
- Session persistence with cwd validation

### Codex-Local (Session-Heavy)

- Emphasis on multi-turn conversation context
- Session chaining via `previous_response_id`
- Dynamic model discovery (uses `codex models` command)
- Global skills directory integration
- Quota probing with refresh intervals

### OpenCode-Local & Pi-Local

- Dynamic model listing via custom commands
- Minimal configuration (mostly defaults)
- Session support with fallback logic

### Process & HTTP

- Simplest possible implementations
- Direct command spawning or HTTP POST
- Same session/metadata framework as complex adapters
- Good reference for minimal adapter patterns

---

## 17. Integration Checklist

When adding a new adapter:

1. **Create package** with four-export structure
2. **Implement server module** (execute, test, parse, session codec)
3. **Implement UI module** (config fields, stdout parser, config builder)
4. **Implement CLI module** (stdout formatter)
5. **Register in server registry** (`server/src/adapters/registry.ts`)
6. **Register in UI registry** (`ui/src/adapters/registry.ts`)
7. **Register in CLI registry** (`cli/src/adapters/registry.ts`)
8. **Add workspace entry** (typically covered by glob in pnpm-workspace.yaml)
9. **Write tests** for parsing, config building, session codec
10. **Document config fields** in `agentConfigurationDoc`

---

## References

- **Skill GUID**: `.claude/skills/create-agent-adapter/SKILL.md`
- **AGENTS.md**: `docs/api/agents.md`
- **Adapter-Utils**: Type definitions and server utilities
- **Existing Adapters**: `/packages/adapters/` (8 implementations)
