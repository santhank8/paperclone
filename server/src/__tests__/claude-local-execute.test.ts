import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execute } from "@paperclipai/adapter-claude-local/server";

async function writeFakeClaudeCommand(commandPath: string): Promise<void> {
  const script = `#!/usr/bin/env node
const fs = require("node:fs");

const capturePath = process.env.PAPERCLIP_TEST_CAPTURE_PATH;
const payload = {
  argv: process.argv.slice(2),
  prompt: fs.readFileSync(0, "utf8"),
  home: process.env.HOME || null,
  claudeConfigDir: process.env.CLAUDE_CONFIG_DIR || null,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || null,
};
if (capturePath) {
  fs.writeFileSync(capturePath, JSON.stringify(payload), "utf8");
}
console.log(JSON.stringify({ type: "system", subtype: "init", session_id: "claude-session-1", model: "claude-sonnet" }));
console.log(JSON.stringify({ type: "assistant", session_id: "claude-session-1", message: { content: [{ type: "text", text: "hello" }] } }));
console.log(JSON.stringify({ type: "result", session_id: "claude-session-1", result: "hello", usage: { input_tokens: 1, cache_read_input_tokens: 0, output_tokens: 1 } }));
`;
  await fs.writeFile(commandPath, script, "utf8");
  await fs.chmod(commandPath, 0o755);
}

describe("claude execute", () => {
  it("uses a Paperclip-managed Claude home by default while stripping host plugin and skills config", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-claude-execute-managed-"));
    const workspace = path.join(root, "workspace");
    const commandPath = path.join(root, "claude");
    const capturePath = path.join(root, "capture.json");
    const paperclipHome = path.join(root, "paperclip-home");
    const managedHome = path.join(
      paperclipHome,
      "instances",
      "default",
      "companies",
      "company-1",
      "agents",
      "agent-1",
      "claude-home",
    );
    const managedConfigDir = path.join(managedHome, ".claude");
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(path.join(root, ".claude", "skills", "host-only-skill"), { recursive: true });
    await fs.writeFile(
      path.join(root, ".claude", ".credentials.json"),
      JSON.stringify({ claudeAiOauth: { accessToken: "shared-token" } }),
      "utf8",
    );
    await fs.writeFile(
      path.join(root, ".claude", "settings.json"),
      JSON.stringify(
        {
          env: {
            ANTHROPIC_AUTH_TOKEN: "oauth-token",
            ANTHROPIC_BASE_URL: "https://api.z.ai/api/anthropic",
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
          },
          enabledPlugins: {
            "code-simplifier@claude-plugins-official": true,
          },
          statusLine: {
            type: "command",
            command: "~/.claude/statusline.sh",
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    await fs.writeFile(
      path.join(root, ".claude", "settings.local.json"),
      JSON.stringify({ permissions: { allow: ["Bash(cat:*)"] } }, null, 2),
      "utf8",
    );
    await fs.mkdir(managedConfigDir, { recursive: true });
    await fs.symlink(
      path.join(root, ".claude", "settings.json"),
      path.join(managedConfigDir, "settings.json"),
    );
    await writeFakeClaudeCommand(commandPath);

    const previousHome = process.env.HOME;
    const previousPaperclipHome = process.env.PAPERCLIP_HOME;
    const previousPaperclipInstanceId = process.env.PAPERCLIP_INSTANCE_ID;
    const previousPaperclipInWorktree = process.env.PAPERCLIP_IN_WORKTREE;
    const previousClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
    const previousAnthropicApiKey = process.env.ANTHROPIC_API_KEY;
    process.env.HOME = root;
    process.env.PAPERCLIP_HOME = paperclipHome;
    delete process.env.PAPERCLIP_INSTANCE_ID;
    delete process.env.PAPERCLIP_IN_WORKTREE;
    delete process.env.CLAUDE_CONFIG_DIR;
    process.env.ANTHROPIC_API_KEY = "sk-host-override";

    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
    try {
      const result = await execute({
        runId: "run-managed",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Claude Coder",
          adapterType: "claude_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          env: {
            PAPERCLIP_TEST_CAPTURE_PATH: capturePath,
          },
          promptTemplate: "Follow the paperclip heartbeat.",
        },
        context: {},
        authToken: "run-jwt-token",
        onLog: async (stream, chunk) => {
          logs.push({ stream, chunk });
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.errorMessage).toBeNull();

      const capture = JSON.parse(await fs.readFile(capturePath, "utf8")) as {
        argv: string[];
        prompt: string;
        home: string | null;
        claudeConfigDir: string | null;
        anthropicApiKey: string | null;
      };
      expect(capture.home).toBe(managedHome);
      expect(capture.claudeConfigDir).toBe(managedConfigDir);
      expect(capture.anthropicApiKey).toBeNull();
      expect((await fs.lstat(path.join(managedConfigDir, ".credentials.json"))).isFile()).toBe(true);
      expect(await fs.readFile(path.join(managedConfigDir, ".credentials.json"), "utf8")).toBe(
        await fs.readFile(path.join(root, ".claude", ".credentials.json"), "utf8"),
      );
      expect((await fs.lstat(path.join(managedConfigDir, "settings.json"))).isFile()).toBe(true);
      expect(JSON.parse(await fs.readFile(path.join(managedConfigDir, "settings.json"), "utf8"))).toEqual({
        env: {
          ANTHROPIC_AUTH_TOKEN: "oauth-token",
          ANTHROPIC_BASE_URL: "https://api.z.ai/api/anthropic",
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
        },
      });
      expect(JSON.parse(await fs.readFile(path.join(root, ".claude", "settings.json"), "utf8"))).toEqual({
        env: {
          ANTHROPIC_AUTH_TOKEN: "oauth-token",
          ANTHROPIC_BASE_URL: "https://api.z.ai/api/anthropic",
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
        },
        enabledPlugins: {
          "code-simplifier@claude-plugins-official": true,
        },
        statusLine: {
          type: "command",
          command: "~/.claude/statusline.sh",
        },
      });
      await expect(fs.lstat(path.join(managedConfigDir, "settings.local.json"))).rejects.toThrow();
      await expect(fs.lstat(path.join(managedConfigDir, "skills", "host-only-skill"))).rejects.toThrow();
      expect(logs).toContainEqual(
        expect.objectContaining({
          stream: "stdout",
          chunk: expect.stringContaining("Using Paperclip-managed Claude home"),
        }),
      );
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousPaperclipHome === undefined) delete process.env.PAPERCLIP_HOME;
      else process.env.PAPERCLIP_HOME = previousPaperclipHome;
      if (previousPaperclipInstanceId === undefined) delete process.env.PAPERCLIP_INSTANCE_ID;
      else process.env.PAPERCLIP_INSTANCE_ID = previousPaperclipInstanceId;
      if (previousPaperclipInWorktree === undefined) delete process.env.PAPERCLIP_IN_WORKTREE;
      else process.env.PAPERCLIP_IN_WORKTREE = previousPaperclipInWorktree;
      if (previousClaudeConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = previousClaudeConfigDir;
      if (previousAnthropicApiKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = previousAnthropicApiKey;
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("logs HOME, CLAUDE_CONFIG_DIR, and the resolved executable path in invocation metadata", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-claude-execute-meta-"));
    const workspace = path.join(root, "workspace");
    const binDir = path.join(root, "bin");
    const commandPath = path.join(binDir, "claude");
    const capturePath = path.join(root, "capture.json");
    const claudeConfigDir = path.join(root, "claude-config");
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(binDir, { recursive: true });
    await fs.mkdir(claudeConfigDir, { recursive: true });
    await writeFakeClaudeCommand(commandPath);

    const previousHome = process.env.HOME;
    const previousPath = process.env.PATH;
    const previousClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
    process.env.HOME = root;
    process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ""}`;
    process.env.CLAUDE_CONFIG_DIR = claudeConfigDir;

    let loggedCommand: string | null = null;
    let loggedEnv: Record<string, string> = {};
    try {
      const result = await execute({
        runId: "run-meta",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Claude Coder",
          adapterType: "claude_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: "claude",
          cwd: workspace,
          env: {
            PAPERCLIP_TEST_CAPTURE_PATH: capturePath,
            HOME: root,
            CLAUDE_CONFIG_DIR: claudeConfigDir,
          },
          promptTemplate: "Follow the paperclip heartbeat.",
        },
        context: {},
        authToken: "run-jwt-token",
        onLog: async () => {},
        onMeta: async (meta) => {
          loggedCommand = meta.command;
          loggedEnv = meta.env ?? {};
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.errorMessage).toBeNull();
      expect(loggedCommand).toBe(commandPath);
      expect(loggedEnv.HOME).toBe(root);
      expect(loggedEnv.CLAUDE_CONFIG_DIR).toBe(claudeConfigDir);
      expect(loggedEnv.PAPERCLIP_RESOLVED_COMMAND).toBe(commandPath);
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      if (previousClaudeConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
      else process.env.CLAUDE_CONFIG_DIR = previousClaudeConfigDir;
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
