import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getLocalCliSkillTargets } from "../commands/client/agent.js";

const ORIGINAL_OPENCODE_CONFIG_DIR = process.env.OPENCODE_CONFIG_DIR;

describe("getLocalCliSkillTargets", () => {
  afterEach(() => {
    if (ORIGINAL_OPENCODE_CONFIG_DIR === undefined) {
      delete process.env.OPENCODE_CONFIG_DIR;
    } else {
      process.env.OPENCODE_CONFIG_DIR = ORIGINAL_OPENCODE_CONFIG_DIR;
    }
  });

  it("includes the native OpenCode skills directory by default", () => {
    delete process.env.OPENCODE_CONFIG_DIR;

    expect(getLocalCliSkillTargets()).toEqual(
      expect.arrayContaining([
        {
          tool: "opencode",
          target: path.join(os.homedir(), ".config", "opencode", "skills"),
        },
      ]),
    );
  });

  it("uses OPENCODE_CONFIG_DIR when present", () => {
    process.env.OPENCODE_CONFIG_DIR = "/tmp/paperclip-opencode-config";

    expect(getLocalCliSkillTargets()).toEqual(
      expect.arrayContaining([
        {
          tool: "opencode",
          target: "/tmp/paperclip-opencode-config/skills",
        },
      ]),
    );
  });
});
