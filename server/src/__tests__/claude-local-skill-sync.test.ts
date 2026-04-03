import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  listClaudeSkills,
  syncClaudeSkills,
} from "@paperclipai/adapter-claude-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createSkillDir(root: string, name: string) {
  const skillDir = path.join(root, name);
  await fs.mkdir(skillDir, { recursive: true });
  await fs.writeFile(path.join(skillDir, "SKILL.md"), `---\nname: ${name}\n---\n`, "utf8");
  return skillDir;
}

describe("claude local skill sync", () => {
  const paperclipKey = "paperclipai/paperclip/paperclip";
  const createAgentKey = "paperclipai/paperclip/paperclip-create-agent";
  const cleanupDirs = new Set<string>();
  const originalHome = process.env.HOME;
  const originalPaperclipHome = process.env.PAPERCLIP_HOME;
  const originalPaperclipInstanceId = process.env.PAPERCLIP_INSTANCE_ID;
  const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;

  afterEach(async () => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalPaperclipHome === undefined) delete process.env.PAPERCLIP_HOME;
    else process.env.PAPERCLIP_HOME = originalPaperclipHome;
    if (originalPaperclipInstanceId === undefined) delete process.env.PAPERCLIP_INSTANCE_ID;
    else process.env.PAPERCLIP_INSTANCE_ID = originalPaperclipInstanceId;
    if (originalClaudeConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR;
    else process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("defaults to mounting all built-in Paperclip skills when no explicit selection exists", async () => {
    const snapshot = await listClaudeSkills({
      agentId: "agent-1",
      companyId: "company-1",
      adapterType: "claude_local",
      config: {},
    });

    expect(snapshot.mode).toBe("ephemeral");
    expect(snapshot.supported).toBe(true);
    expect(snapshot.desiredSkills).toContain(paperclipKey);
    expect(snapshot.entries.find((entry) => entry.key === paperclipKey)?.required).toBe(true);
    expect(snapshot.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("configured");
  });

  it("respects an explicit desired skill list without mutating a persistent home", async () => {
    const snapshot = await syncClaudeSkills({
      agentId: "agent-2",
      companyId: "company-1",
      adapterType: "claude_local",
      config: {
        paperclipSkillSync: {
          desiredSkills: [paperclipKey],
        },
      },
    }, [paperclipKey]);

    expect(snapshot.desiredSkills).toContain(paperclipKey);
    expect(snapshot.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("configured");
    expect(snapshot.entries.find((entry) => entry.key === createAgentKey)?.state).toBe("configured");
  });

  it("normalizes legacy flat Paperclip skill refs to canonical keys", async () => {
    const snapshot = await listClaudeSkills({
      agentId: "agent-3",
      companyId: "company-1",
      adapterType: "claude_local",
      config: {
        paperclipSkillSync: {
          desiredSkills: ["paperclip"],
        },
      },
    });

    expect(snapshot.warnings).toEqual([]);
    expect(snapshot.desiredSkills).toContain(paperclipKey);
    expect(snapshot.desiredSkills).not.toContain("paperclip");
    expect(snapshot.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("configured");
    expect(snapshot.entries.find((entry) => entry.key === "paperclip")).toBeUndefined();
  });

  it("shows host-level user-installed Claude skills as read-only external entries", async () => {
    const home = await makeTempDir("paperclip-claude-user-skills-");
    cleanupDirs.add(home);
    await createSkillDir(path.join(home, ".claude", "skills"), "crack-python");

    const snapshot = await listClaudeSkills({
      agentId: "agent-4",
      companyId: "company-1",
      adapterType: "claude_local",
      config: {
        env: {
          HOME: home,
        },
      },
    });

    expect(snapshot.entries).toContainEqual(expect.objectContaining({
      key: "crack-python",
      runtimeName: "crack-python",
      state: "external",
      managed: false,
      origin: "user_installed",
      originLabel: "User-installed",
      locationLabel: path.join(home, ".claude", "skills"),
      readOnly: true,
      detail: "Installed outside Paperclip management in the Claude skills home.",
    }));
  });

  it("defaults to a managed Claude home instead of host ~/.claude/skills", async () => {
    const root = await makeTempDir("paperclip-claude-managed-skills-");
    const paperclipHome = path.join(root, "paperclip-home");
    cleanupDirs.add(root);
    await createSkillDir(path.join(root, ".claude", "skills"), "host-only-skill");

    process.env.HOME = root;
    process.env.PAPERCLIP_HOME = paperclipHome;
    delete process.env.PAPERCLIP_INSTANCE_ID;
    delete process.env.CLAUDE_CONFIG_DIR;

    const snapshot = await listClaudeSkills({
      agentId: "agent-5",
      companyId: "company-1",
      adapterType: "claude_local",
      config: {},
    });

    expect(snapshot.entries.find((entry) => entry.key === "host-only-skill")).toBeUndefined();
    expect(
      snapshot.entries.some((entry) => entry.origin === "user_installed" && entry.locationLabel === "~/.claude/skills"),
    ).toBe(false);
  });
});
