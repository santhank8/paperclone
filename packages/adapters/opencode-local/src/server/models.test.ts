import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  discoverOpenCodeModels,
  ensureOpenCodeModelConfiguredAndAvailable,
  listOpenCodeModels,
  resetOpenCodeModelsCacheForTests,
} from "./models.js";

async function withMockOpenCodeCommand(
  stdout: string,
  run: (commandPath: string, cwd: string) => Promise<void>,
) {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-opencode-models-"));
  const commandPath = path.join(cwd, "opencode-mock.sh");
  await fs.writeFile(
    commandPath,
    [
      "#!/usr/bin/env bash",
      "if [ \"$1\" = \"models\" ]; then",
      "cat <<'__OPENCODE_MODELS__'",
      stdout,
      "__OPENCODE_MODELS__",
      "exit 0",
      "fi",
      "echo \"unexpected args: $*\" >&2",
      "exit 1",
      "",
    ].join("\n"),
    "utf8",
  );
  await fs.chmod(commandPath, 0o755);

  try {
    await run(commandPath, cwd);
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
}

describe("openCode models", () => {
  afterEach(() => {
    delete process.env.PAPERCLIP_OPENCODE_COMMAND;
    resetOpenCodeModelsCacheForTests();
  });

  it("returns an empty list when discovery command is unavailable", async () => {
    process.env.PAPERCLIP_OPENCODE_COMMAND = "__paperclip_missing_opencode_command__";
    await expect(listOpenCodeModels()).resolves.toEqual([]);
  });

  it("rejects when model is missing", async () => {
    await expect(
      ensureOpenCodeModelConfiguredAndAvailable({ model: "" }),
    ).rejects.toThrow("OpenCode requires `adapterConfig.model`");
  });

  it("rejects when discovery cannot run for configured model", async () => {
    process.env.PAPERCLIP_OPENCODE_COMMAND = "__paperclip_missing_opencode_command__";
    await expect(
      ensureOpenCodeModelConfiguredAndAvailable({
        model: "openai/gpt-5",
      }),
    ).rejects.toThrow("Failed to start command");
  });

  it("parses plain model ids from `opencode models` output", async () => {
    await withMockOpenCodeCommand(
      [
        "Available models",
        "qwen3-coder-next",
        "gemma-3-27b-it",
      ].join("\n"),
      async (commandPath, cwd) => {
        const models = await discoverOpenCodeModels({ command: commandPath, cwd });
        expect(models).toEqual([
          { id: "gemma-3-27b-it", label: "gemma-3-27b-it" },
          { id: "qwen3-coder-next", label: "qwen3-coder-next" },
        ]);
      },
    );
  });

  it("parses table-style output that mixes provider/model and plain ids", async () => {
    await withMockOpenCodeCommand(
      [
        "| Model | Provider |",
        "| --- | --- |",
        "| litellm/qwen3-coder-next | litellm |",
        "| o3-mini | openai |",
      ].join("\n"),
      async (commandPath, cwd) => {
        const models = await discoverOpenCodeModels({ command: commandPath, cwd });
        expect(models).toEqual([
          { id: "litellm/qwen3-coder-next", label: "litellm/qwen3-coder-next" },
          { id: "o3-mini", label: "o3-mini" },
        ]);
      },
    );
  });
});
