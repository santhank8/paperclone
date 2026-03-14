import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, execSync } from "node:child_process";
import * as p from "@clack/prompts";
import pc from "picocolors";
import type { Command } from "commander";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ServiceStatusOptions = { json?: boolean };
type ServiceLogsOptions = { follow?: boolean; lines?: number };

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

const PAPERCLIP_LOG_DIR = path.join(os.homedir(), ".paperclip", "logs");
const SERVICE_LOG_PATH = path.join(PAPERCLIP_LOG_DIR, "service.log");

function paperclipRootDir(): string {
  // Walk up from cli/src/commands/service.ts → repo root
  return path.resolve(import.meta.dirname, "..", "..", "..");
}

function nodeExecPath(): string {
  return process.execPath;
}

function devRunnerPath(): string {
  return path.join(paperclipRootDir(), "scripts", "dev-runner.mjs");
}

// ---------------------------------------------------------------------------
// macOS launchd helpers
// ---------------------------------------------------------------------------

const LAUNCHD_LABEL = "com.paperclipai.paperclip";
const LAUNCHD_PLIST_DIR = path.join(os.homedir(), "Library", "LaunchAgents");
const LAUNCHD_PLIST_PATH = path.join(LAUNCHD_PLIST_DIR, `${LAUNCHD_LABEL}.plist`);

export function generateLaunchdPlist(): string {
  const node = nodeExecPath();
  const runner = devRunnerPath();
  const workDir = paperclipRootDir();

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCHD_LABEL}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${node}</string>
    <string>${runner}</string>
    <string>watch</string>
  </array>

  <key>WorkingDirectory</key>
  <string>${workDir}</string>

  <key>KeepAlive</key>
  <true/>

  <key>RunAtLoad</key>
  <true/>

  <key>ThrottleInterval</key>
  <integer>10</integer>

  <key>StandardOutPath</key>
  <string>${SERVICE_LOG_PATH}</string>

  <key>StandardErrorPath</key>
  <string>${SERVICE_LOG_PATH}</string>
</dict>
</plist>
`;
}

// ---------------------------------------------------------------------------
// Linux systemd helpers
// ---------------------------------------------------------------------------

const SYSTEMD_UNIT_DIR = path.join(os.homedir(), ".config", "systemd", "user");
const SYSTEMD_UNIT_PATH = path.join(SYSTEMD_UNIT_DIR, "paperclip.service");

export function generateSystemdUnit(): string {
  const node = nodeExecPath();
  const runner = devRunnerPath();
  const workDir = paperclipRootDir();

  return `[Unit]
Description=Paperclip Agent Orchestration Server
After=network.target

[Service]
Type=simple
ExecStart=${node} ${runner} watch
WorkingDirectory=${workDir}
Restart=always
RestartSec=10
StandardOutput=append:%h/.paperclip/logs/service.log
StandardError=append:%h/.paperclip/logs/service.log

[Install]
WantedBy=default.target
`;
}

// ---------------------------------------------------------------------------
// OS detection
// ---------------------------------------------------------------------------

export type SupportedPlatform = "darwin" | "linux";

export function detectPlatform(): SupportedPlatform {
  const plat = process.platform;
  if (plat === "darwin") return "darwin";
  if (plat === "linux") return "linux";
  p.log.error(
    `Platform ${pc.bold(plat)} is not supported. ` +
      `Paperclip service management is available on macOS (launchd) and Linux (systemd).`,
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Ensure log directory
// ---------------------------------------------------------------------------

function ensureLogDir(): void {
  if (!existsSync(PAPERCLIP_LOG_DIR)) {
    mkdirSync(PAPERCLIP_LOG_DIR, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

async function serviceInstall(): Promise<void> {
  const platform = detectPlatform();
  ensureLogDir();

  p.intro(pc.bgCyan(pc.black(" paperclipai service install ")));

  if (platform === "darwin") {
    if (!existsSync(LAUNCHD_PLIST_DIR)) {
      mkdirSync(LAUNCHD_PLIST_DIR, { recursive: true });
    }
    const plist = generateLaunchdPlist();
    writeFileSync(LAUNCHD_PLIST_PATH, plist, "utf8");
    p.log.success(`Wrote plist to ${pc.dim(LAUNCHD_PLIST_PATH)}`);

    try {
      execFileSync("launchctl", ["load", "-w", LAUNCHD_PLIST_PATH], { stdio: "pipe" });
    } catch {
      // May already be loaded — try bootstrap instead
      try {
        execFileSync("launchctl", ["bootstrap", `gui/${process.getuid!()}`, LAUNCHD_PLIST_PATH], {
          stdio: "pipe",
        });
      } catch {
        // Already bootstrapped is fine
      }
    }
    p.log.success("Service loaded via launchd");
  } else {
    if (!existsSync(SYSTEMD_UNIT_DIR)) {
      mkdirSync(SYSTEMD_UNIT_DIR, { recursive: true });
    }
    const unit = generateSystemdUnit();
    writeFileSync(SYSTEMD_UNIT_PATH, unit, "utf8");
    p.log.success(`Wrote unit file to ${pc.dim(SYSTEMD_UNIT_PATH)}`);

    execFileSync("systemctl", ["--user", "daemon-reload"], { stdio: "pipe" });
    execFileSync("systemctl", ["--user", "enable", "--now", "paperclip.service"], { stdio: "pipe" });
    p.log.success("Service enabled and started via systemd");
  }

  p.outro(pc.green("Paperclip service installed and running."));
}

// ---------------------------------------------------------------------------
// Uninstall
// ---------------------------------------------------------------------------

async function serviceUninstall(): Promise<void> {
  const platform = detectPlatform();

  p.intro(pc.bgCyan(pc.black(" paperclipai service uninstall ")));

  if (platform === "darwin") {
    try {
      execFileSync("launchctl", ["unload", "-w", LAUNCHD_PLIST_PATH], { stdio: "pipe" });
    } catch {
      try {
        execFileSync("launchctl", ["bootout", `gui/${process.getuid!()}`, LAUNCHD_PLIST_PATH], {
          stdio: "pipe",
        });
      } catch {
        // Already removed
      }
    }
    if (existsSync(LAUNCHD_PLIST_PATH)) {
      unlinkSync(LAUNCHD_PLIST_PATH);
    }
    p.log.success("Plist removed and service unloaded");
  } else {
    try {
      execFileSync("systemctl", ["--user", "disable", "--now", "paperclip.service"], { stdio: "pipe" });
    } catch {
      // May not exist
    }
    if (existsSync(SYSTEMD_UNIT_PATH)) {
      unlinkSync(SYSTEMD_UNIT_PATH);
    }
    execFileSync("systemctl", ["--user", "daemon-reload"], { stdio: "pipe" });
    p.log.success("Systemd unit removed and daemon reloaded");
  }

  p.outro(pc.green("Paperclip service uninstalled."));
}

// ---------------------------------------------------------------------------
// Start / Stop / Restart
// ---------------------------------------------------------------------------

async function serviceStart(): Promise<void> {
  const platform = detectPlatform();
  if (platform === "darwin") {
    execFileSync("launchctl", ["start", LAUNCHD_LABEL], { stdio: "pipe" });
  } else {
    execFileSync("systemctl", ["--user", "start", "paperclip.service"], { stdio: "pipe" });
  }
  p.log.success("Paperclip service started.");
}

async function serviceStop(): Promise<void> {
  const platform = detectPlatform();
  if (platform === "darwin") {
    execFileSync("launchctl", ["stop", LAUNCHD_LABEL], { stdio: "pipe" });
  } else {
    execFileSync("systemctl", ["--user", "stop", "paperclip.service"], { stdio: "pipe" });
  }
  p.log.success("Paperclip service stopped.");
}

async function serviceRestart(): Promise<void> {
  const platform = detectPlatform();
  if (platform === "darwin") {
    execFileSync("launchctl", ["stop", LAUNCHD_LABEL], { stdio: "pipe" });
    execFileSync("launchctl", ["start", LAUNCHD_LABEL], { stdio: "pipe" });
  } else {
    execFileSync("systemctl", ["--user", "restart", "paperclip.service"], { stdio: "pipe" });
  }
  p.log.success("Paperclip service restarted.");
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

async function serviceStatus(opts: ServiceStatusOptions): Promise<void> {
  const platform = detectPlatform();

  if (platform === "darwin") {
    try {
      const raw = execFileSync("launchctl", ["list", LAUNCHD_LABEL], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });

      if (opts.json) {
        console.log(JSON.stringify({ platform: "darwin", label: LAUNCHD_LABEL, raw: raw.trim() }));
        return;
      }

      p.log.info(pc.bold("Paperclip service status (launchd)"));
      // Parse PID and status from launchctl list output
      const pidMatch = raw.match(/"PID"\s*=\s*(\d+)/);
      const statusMatch = raw.match(/"LastExitStatus"\s*=\s*(\d+)/);
      if (pidMatch) p.log.message(`PID: ${pc.green(pidMatch[1])}`);
      if (statusMatch) p.log.message(`Last exit status: ${statusMatch[1]}`);
      p.log.message(pc.dim(raw.trim()));
    } catch {
      p.log.warn("Service is not loaded. Run " + pc.bold("paperclipai service install") + " first.");
    }
  } else {
    try {
      const raw = execFileSync("systemctl", ["--user", "status", "paperclip.service"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });

      if (opts.json) {
        console.log(JSON.stringify({ platform: "linux", unit: "paperclip.service", raw: raw.trim() }));
        return;
      }

      p.log.info(pc.bold("Paperclip service status (systemd)"));
      p.log.message(raw.trim());
    } catch (err: unknown) {
      // systemctl status exits with code 3 when inactive — still has output
      const output = (err as { stdout?: string }).stdout;
      if (output) {
        if (opts.json) {
          console.log(JSON.stringify({ platform: "linux", unit: "paperclip.service", raw: output.trim() }));
          return;
        }
        p.log.info(pc.bold("Paperclip service status (systemd)"));
        p.log.message(output.trim());
      } else {
        p.log.warn("Service is not installed. Run " + pc.bold("paperclipai service install") + " first.");
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

async function serviceLogs(opts: ServiceLogsOptions): Promise<void> {
  const lines = opts.lines ?? 50;

  if (!existsSync(SERVICE_LOG_PATH)) {
    p.log.warn(`No log file found at ${pc.dim(SERVICE_LOG_PATH)}`);
    return;
  }

  if (opts.follow) {
    // Stream live — hand off to tail -f (inherits stdio)
    try {
      execFileSync("tail", ["-n", String(lines), "-f", SERVICE_LOG_PATH], {
        stdio: "inherit",
      });
    } catch {
      // User hit Ctrl-C
    }
  } else {
    const output = execFileSync("tail", ["-n", String(lines), SERVICE_LOG_PATH], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    console.log(output);
  }
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerServiceCommands(program: Command): void {
  const service = program.command("service").description("Manage Paperclip as a persistent OS service");

  service
    .command("install")
    .description("Generate and install the OS service unit, then start it")
    .action(serviceInstall);

  service
    .command("uninstall")
    .description("Stop and remove the OS service unit")
    .action(serviceUninstall);

  service
    .command("start")
    .description("Start the Paperclip service")
    .action(serviceStart);

  service
    .command("stop")
    .description("Stop the Paperclip service")
    .action(serviceStop);

  service
    .command("restart")
    .description("Restart the Paperclip service")
    .action(serviceRestart);

  service
    .command("status")
    .description("Show service running state, PID, and uptime")
    .option("--json", "Output raw JSON")
    .action(serviceStatus);

  service
    .command("logs")
    .description("Tail the service log")
    .option("-f, --follow", "Follow log output in real time")
    .option("-n, --lines <count>", "Number of lines to show", (v) => Number(v), 50)
    .action(serviceLogs);
}
