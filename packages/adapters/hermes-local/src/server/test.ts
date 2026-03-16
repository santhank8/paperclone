/**
 * Environment test for Hermes Agent adapter.
 *
 * Verifies that Hermes CLI is available and configured.
 */

import { spawn } from "node:child_process";
import { HERMES_CLI } from "./constants.js";

export interface TestEnvironmentResult {
  ok: boolean;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Test that Hermes CLI is available and can be invoked.
 */
export async function testEnvironment(): Promise<TestEnvironmentResult> {
  return new Promise((resolve) => {
    const proc = spawn(HERMES_CLI, ["--version"], {
      timeout: 5000,
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve({
          ok: true,
          message: `Hermes CLI available: ${stdout.trim() || "ok"}`,
          details: { version: stdout.trim() },
        });
      } else {
        resolve({
          ok: false,
          message: `Hermes CLI exited with code ${code}: ${stderr.trim() || stdout.trim()}`,
        });
      }
    });

    proc.on("error", (err) => {
      resolve({
        ok: false,
        message: `Hermes CLI not found: ${err.message}. Install with: pip install hermes-agent`,
      });
    });
  });
}