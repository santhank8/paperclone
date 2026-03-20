import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execute } from "../adapters/process/execute.ts";
import { applyExecutionWorkspaceCwdToAdapterConfig } from "../services/heartbeat.ts";

async function writeFakeProcessCommand(commandPath: string): Promise<void> {
  const script = `#!/usr/bin/env node
const fs = require("node:fs");
const capturePath = process.env.PAPERCLIP_TEST_CAPTURE_PATH;
if (capturePath) {
  fs.writeFileSync(capturePath, JSON.stringify({ cwd: process.cwd() }), "utf8");
}
`;
  await fs.writeFile(commandPath, script, "utf8");
  await fs.chmod(commandPath, 0o755);
}

describe("process adapter execute", () => {
  it("runs in the execution workspace cwd when heartbeat overrides config.cwd", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-process-execute-"));
    const staticCwd = path.join(root, "static-config-cwd");
    const executionWorkspaceCwd = path.join(root, "execution-workspace");
    const commandPath = path.join(root, "process-command");
    const capturePath = path.join(root, "capture.json");
    await fs.mkdir(staticCwd, { recursive: true });
    await fs.mkdir(executionWorkspaceCwd, { recursive: true });
    await writeFakeProcessCommand(commandPath);

    let metaCwd: string | null = null;
    try {
      const result = await execute({
        runId: "run-1",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Process Agent",
          adapterType: "process",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: applyExecutionWorkspaceCwdToAdapterConfig(
          {
            command: commandPath,
            cwd: staticCwd,
            env: {
              PAPERCLIP_TEST_CAPTURE_PATH: capturePath,
            },
          },
          executionWorkspaceCwd,
        ),
        context: {},
        onLog: async () => {},
        onMeta: async (meta) => {
          metaCwd = meta.cwd ?? null;
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.errorMessage).toBeUndefined();
      expect(metaCwd).toBe(executionWorkspaceCwd);

      const capture = JSON.parse(await fs.readFile(capturePath, "utf8")) as { cwd: string };
      expect(capture.cwd).toBe(executionWorkspaceCwd);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
