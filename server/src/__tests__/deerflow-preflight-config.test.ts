import { describe, expect, it } from "vitest";
import {
  DEERFLOW_PREFLIGHT_RECURSION_LIMIT,
  DEERFLOW_PREFLIGHT_RESEARCH_PROMPT,
  buildDeerflowPreflightConfig,
} from "../services/heartbeat.js";

// ---------------------------------------------------------------------------
// These tests cover the root cause of the DeerFlow pre-flight recursion bug:
//
//   1. The research prompt must tell the model to bound its exploration
//      (tool-call budget, failed-search stopping rule, read-file discipline,
//      no-subagent rule). Without these, a Haiku-tier local model running on
//      an unfamiliar codebase walks breadth-first via many small tool calls
//      and blows past the LangGraph recursion_limit.
//
//   2. The pre-flight adapter config must force `subagentEnabled: false` and
//      `thinkingEnabled: false` regardless of the parent agent's defaults,
//      so the lead-agent system prompt doesn't include the 140-line
//      <subagent_system> block that further inflates context and invites
//      decomposition behavior on a task that only needs a short brief.
// ---------------------------------------------------------------------------

describe("buildDeerflowPreflightConfig", () => {
  it("forces subagentEnabled: false even when the base config enables it", () => {
    const base = {
      model: "local-vllm",
      subagentEnabled: true,
      maxTurnsPerRun: 80,
    };
    const cfg = buildDeerflowPreflightConfig(base, 90);
    expect(cfg.subagentEnabled).toBe(false);
  });

  it("forces thinkingEnabled: false even when the base config enables it", () => {
    const base = {
      model: "local-vllm",
      thinkingEnabled: true,
    };
    const cfg = buildDeerflowPreflightConfig(base, 120);
    expect(cfg.thinkingEnabled).toBe(false);
  });

  it("passes through the requested timeoutSec", () => {
    const cfg = buildDeerflowPreflightConfig({}, 42);
    expect(cfg.timeoutSec).toBe(42);
  });

  it("preserves unrelated base-config fields (model, paths, permissions)", () => {
    const base = {
      model: "local-vllm",
      cwd: "/home/prime/Projects",
      instructionsFilePath: "/home/prime/Projects/agents/backend-assistant/AGENTS.md",
      dangerouslySkipPermissions: true,
      maxTurnsPerRun: 80,
      graceSec: 15,
    };
    const cfg = buildDeerflowPreflightConfig(base, 120);
    expect(cfg.model).toBe("local-vllm");
    expect(cfg.cwd).toBe("/home/prime/Projects");
    expect(cfg.instructionsFilePath).toBe("/home/prime/Projects/agents/backend-assistant/AGENTS.md");
    expect(cfg.dangerouslySkipPermissions).toBe(true);
    expect(cfg.maxTurnsPerRun).toBe(80);
    expect(cfg.graceSec).toBe(15);
  });

  it("does not mutate the base config", () => {
    const base: Record<string, unknown> = {
      model: "local-vllm",
      subagentEnabled: true,
      thinkingEnabled: true,
      timeoutSec: 600,
    };
    const snapshot = { ...base };
    buildDeerflowPreflightConfig(base, 120);
    expect(base).toEqual(snapshot);
  });

  it("timeoutSec always wins over the base config's value", () => {
    const base = { timeoutSec: 999 };
    const cfg = buildDeerflowPreflightConfig(base, 60);
    expect(cfg.timeoutSec).toBe(60);
  });

  it("sets recursionLimit to the pre-flight constant", () => {
    // Pre-flight gets more recursion budget than the regular adapter default
    // because the research prompt legitimately asks the assistant to explore
    // an unfamiliar codebase. See DEERFLOW_PREFLIGHT_RECURSION_LIMIT for
    // the rationale.
    const cfg = buildDeerflowPreflightConfig({}, 120);
    expect(cfg.recursionLimit).toBe(DEERFLOW_PREFLIGHT_RECURSION_LIMIT);
    expect(DEERFLOW_PREFLIGHT_RECURSION_LIMIT).toBeGreaterThan(50);
  });

  it("overrides a lower base-config recursionLimit", () => {
    // Even if some upstream config sets a lower recursionLimit, pre-flight
    // should always use the wider budget.
    const cfg = buildDeerflowPreflightConfig({ recursionLimit: 25 }, 120);
    expect(cfg.recursionLimit).toBe(DEERFLOW_PREFLIGHT_RECURSION_LIMIT);
  });
});

describe("DEERFLOW_PREFLIGHT_RESEARCH_PROMPT", () => {
  it("contains the tool-call budget constraint", () => {
    expect(DEERFLOW_PREFLIGHT_RESEARCH_PROMPT).toMatch(/AT MOST 6 tool calls/);
  });

  it("contains the failed-search stopping rule", () => {
    // Three failed attempts → stop and report, don't keep searching.
    expect(DEERFLOW_PREFLIGHT_RESEARCH_PROMPT).toMatch(/3 attempts/);
    expect(DEERFLOW_PREFLIGHT_RESEARCH_PROMPT).toMatch(/STOP/);
    expect(DEERFLOW_PREFLIGHT_RESEARCH_PROMPT).toMatch(/Could not locate/);
  });

  it("contains the read_file line-range discipline", () => {
    expect(DEERFLOW_PREFLIGHT_RESEARCH_PROMPT).toMatch(/start_line/);
    expect(DEERFLOW_PREFLIGHT_RESEARCH_PROMPT).toMatch(/end_line/);
    expect(DEERFLOW_PREFLIGHT_RESEARCH_PROMPT).toMatch(/Never read a full file/);
  });

  it("tells the assistant not to spawn subagents", () => {
    expect(DEERFLOW_PREFLIGHT_RESEARCH_PROMPT).toMatch(/Do NOT spawn subagents/);
    expect(DEERFLOW_PREFLIGHT_RESEARCH_PROMPT).toMatch(/Do NOT use the `task` tool/);
  });

  it("tells the assistant not to restate the task", () => {
    expect(DEERFLOW_PREFLIGHT_RESEARCH_PROMPT).toMatch(/Do NOT restate the task/);
  });

  it("includes the {issueTitle} and {issueBody} placeholders", () => {
    expect(DEERFLOW_PREFLIGHT_RESEARCH_PROMPT).toContain("{issueTitle}");
    expect(DEERFLOW_PREFLIGHT_RESEARCH_PROMPT).toContain("{issueBody}");
  });

  it("specifies an output-length cap in the brief template", () => {
    expect(DEERFLOW_PREFLIGHT_RESEARCH_PROMPT).toMatch(/under 1500 characters/);
  });

  it("has a reasonable upper bound on its own size", () => {
    // The prompt goes into the system-prompt budget of a small local model;
    // anything over ~4 KB risks crowding out the actual task content.
    expect(DEERFLOW_PREFLIGHT_RESEARCH_PROMPT.length).toBeLessThan(4000);
  });
});
