---
title: Adapter Protocol
description: AgentRunAdapter interface — invoke/cancel/status contract that all agent runtimes implement
type: mechanism
links: [heartbeat-system, claude-local-adapter, session-resume, ../org-structure]
---

# Adapter Protocol

Paperclip is adapter-agnostic. The key is a protocol, not a specific runtime. Any agent that can receive a heartbeat and report results can be an employee.

## Core Interface

```ts
interface AgentRunAdapter {
  type: string;
  protocolVersion: "agent-run/v1";
  capabilities: {
    resumableSession: boolean;
    statusUpdates: boolean;
    logStreaming: boolean;
    tokenUsage: boolean;
  };
  validateConfig(config: unknown): { ok: true } | { ok: false; errors: string[] };
  invoke(
    input: AdapterInvokeInput,
    hooks: AdapterHooks,
    signal: AbortSignal
  ): Promise<AdapterInvokeResult>;
}
```

## Invoke Input

The [[heartbeat-system]] builds this and passes it to the adapter:

```ts
interface AdapterInvokeInput {
  protocolVersion: "agent-run/v1";
  companyId: string;
  agentId: string;
  runId: string;
  wakeupSource: "timer" | "assignment" | "on_demand" | "automation";
  cwd: string;
  prompt: string;
  adapterConfig: Record<string, unknown>;
  runtimeState: Record<string, unknown>;
  env: Record<string, string>;
  timeoutSec: number;
}
```

## Hooks

Adapters communicate back to the control plane via hooks:

- `status(message, color)` — short status updates (shown in UI live)
- `log(stream, chunk)` — stdout/stderr streaming
- `usage(tokens)` — token usage reporting
- `event(type, payload)` — structured events

## Invoke Result

```ts
interface AdapterInvokeResult {
  outcome: "succeeded" | "failed" | "cancelled" | "timed_out";
  exitCode: number | null;
  sessionId?: string | null;    // for [[session-resume]]
  usage?: TokenUsage | null;
  costUsd?: number | null;
  runtimeStatePatch?: Record<string, unknown>;
}
```

## Built-in Adapter Types

| Type | Description |
|---|---|
| `claude_local` | Local Claude CLI — see [[claude-local-adapter]] |
| `codex_local` | Local Codex CLI |
| `process` | Generic shell command |
| `http` | External HTTP webhook |

Each agent in the [[../org-structure]] has an `adapter_type` and `adapter_config`. The adapter registry maps type to implementation and validates config on save.

## Required Behavior

1. `validateConfig` runs before saving or invoking
2. Adapter must not mutate DB directly — returns data via result/hooks only
3. If `invoke` throws, the executor records the run as `failed`
4. Adapter must emit enough context for errors to be debuggable

## Context Delivery Modes

- `thin`: send IDs and pointers only; agent fetches context via API
- `fat`: include assignments, goal summary, budget snapshot, recent comments
