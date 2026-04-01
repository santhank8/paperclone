import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("node:child_process", async (importOriginal) => {
  const cp = await importOriginal<typeof import("node:child_process")>();
  return { ...cp, execSync: vi.fn() };
});

import { execSync } from "node:child_process";
import { testEnvironment } from "./test-env.js";

const mockedExecSync = vi.mocked(execSync);

describe("testEnvironment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes when docker, image, and network are available", async () => {
    mockedExecSync.mockImplementation((cmd: string) => {
      if (cmd === "docker --version") return "Docker version 24.0.0";
      if (cmd.includes("docker image inspect")) return "[]";
      if (cmd.includes("docker network inspect")) return "[]";
      return "";
    });

    const result = await testEnvironment({
      companyId: "co-1",
      adapterType: "claude_container",
      config: {},
    });

    expect(result.status).toBe("pass");
    expect(result.checks.every((c) => c.level === "info")).toBe(true);
  });

  it("fails when docker is not available", async () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error("command not found: docker");
    });

    const result = await testEnvironment({
      companyId: "co-1",
      adapterType: "claude_container",
      config: {},
    });

    expect(result.status).toBe("fail");
    expect(result.checks.some((c) => c.code === "container_docker_missing")).toBe(true);
  });

  it("warns when image is not found", async () => {
    mockedExecSync.mockImplementation((cmd: string) => {
      if (cmd === "docker --version") return "Docker version 24.0.0";
      if (cmd.includes("docker image inspect")) throw new Error("No such image");
      if (cmd.includes("docker network inspect")) return "[]";
      return "";
    });

    const result = await testEnvironment({
      companyId: "co-1",
      adapterType: "claude_container",
      config: {},
    });

    expect(result.status).toBe("warn");
    expect(result.checks.some((c) => c.code === "container_image_missing")).toBe(true);
  });
});
