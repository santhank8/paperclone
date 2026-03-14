import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { generateLaunchdPlist, generateSystemdUnit, detectPlatform } from "../commands/service.js";

// ---------------------------------------------------------------------------
// Template generation
// ---------------------------------------------------------------------------

describe("generateLaunchdPlist", () => {
  it("produces valid XML with expected keys", () => {
    const plist = generateLaunchdPlist();
    expect(plist).toContain("<?xml version");
    expect(plist).toContain("<key>Label</key>");
    expect(plist).toContain("com.paperclipai.paperclip");
    expect(plist).toContain("<key>KeepAlive</key>");
    expect(plist).toContain("<key>RunAtLoad</key>");
    expect(plist).toContain("<key>ThrottleInterval</key>");
    expect(plist).toContain("<integer>10</integer>");
    expect(plist).toContain("dev-runner.mjs");
    expect(plist).toContain("watch");
    expect(plist).toContain("service.log");
  });

  it("uses the current node executable path", () => {
    const plist = generateLaunchdPlist();
    expect(plist).toContain(process.execPath);
  });

  it("sets WorkingDirectory to the repo root", () => {
    const plist = generateLaunchdPlist();
    expect(plist).toContain("<key>WorkingDirectory</key>");
    // The repo root should contain scripts/dev-runner.mjs
    expect(plist).toContain("scripts/dev-runner.mjs");
  });
});

describe("generateSystemdUnit", () => {
  it("produces a valid systemd unit with required sections", () => {
    const unit = generateSystemdUnit();
    expect(unit).toContain("[Unit]");
    expect(unit).toContain("[Service]");
    expect(unit).toContain("[Install]");
  });

  it("sets Restart=always and RestartSec=10", () => {
    const unit = generateSystemdUnit();
    expect(unit).toContain("Restart=always");
    expect(unit).toContain("RestartSec=10");
  });

  it("uses %h for home directory in log paths", () => {
    const unit = generateSystemdUnit();
    expect(unit).toContain("%h/.paperclip/logs/service.log");
  });

  it("targets network.target and default.target", () => {
    const unit = generateSystemdUnit();
    expect(unit).toContain("After=network.target");
    expect(unit).toContain("WantedBy=default.target");
  });

  it("uses the current node executable in ExecStart", () => {
    const unit = generateSystemdUnit();
    expect(unit).toContain(`ExecStart=${process.execPath}`);
    expect(unit).toContain("dev-runner.mjs watch");
  });
});

// ---------------------------------------------------------------------------
// OS detection
// ---------------------------------------------------------------------------

describe("detectPlatform", () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(process, "platform")!;

  afterEach(() => {
    Object.defineProperty(process, "platform", originalPlatform);
  });

  it("returns 'darwin' on macOS", () => {
    Object.defineProperty(process, "platform", { value: "darwin", configurable: true });
    expect(detectPlatform()).toBe("darwin");
  });

  it("returns 'linux' on Linux", () => {
    Object.defineProperty(process, "platform", { value: "linux", configurable: true });
    expect(detectPlatform()).toBe("linux");
  });

  it("exits on unsupported platforms", () => {
    Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    const mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    expect(() => detectPlatform()).toThrow("process.exit");
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

describe("path resolution in templates", () => {
  it("plist ProgramArguments contains absolute node path and runner path", () => {
    const plist = generateLaunchdPlist();
    // Node path should be absolute
    const nodePathMatch = plist.match(/<string>(\/[^<]+node[^<]*)<\/string>/);
    expect(nodePathMatch).not.toBeNull();
    // Runner path should be absolute
    const lines = plist.split("\n");
    const runnerLine = lines.find((l) => l.includes("dev-runner.mjs"));
    expect(runnerLine).toBeDefined();
    expect(runnerLine).toContain("/");
  });

  it("systemd ExecStart contains absolute paths", () => {
    const unit = generateSystemdUnit();
    const execLine = unit.split("\n").find((l) => l.startsWith("ExecStart="))!;
    expect(execLine).toMatch(/^ExecStart=\//);
  });
});
