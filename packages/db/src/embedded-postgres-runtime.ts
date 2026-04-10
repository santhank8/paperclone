import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { ensurePostgresDatabase, getPostgresDataDirectory } from "./client.js";

export type ReusableEmbeddedPostgresConnection = {
  port: number;
  connectionString: string;
  source: string;
};

export type EmbeddedPostgresLogBuffer = {
  append: (message: unknown) => void;
  recent: () => string[];
};

function toError(error: unknown, fallbackMessage: string): Error {
  if (error instanceof Error) return error;
  if (error === undefined) return new Error(fallbackMessage);
  if (typeof error === "string") return new Error(`${fallbackMessage}: ${error}`);

  try {
    return new Error(`${fallbackMessage}: ${JSON.stringify(error)}`);
  } catch {
    return new Error(`${fallbackMessage}: ${String(error)}`);
  }
}

export function readRunningPostmasterPid(postmasterPidFile: string): number | null {
  if (!existsSync(postmasterPidFile)) return null;
  try {
    const pid = Number(readFileSync(postmasterPidFile, "utf8").split("\n")[0]?.trim());
    if (!Number.isInteger(pid) || pid <= 0) return null;
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}

export function readPidFilePort(postmasterPidFile: string): number | null {
  if (!existsSync(postmasterPidFile)) return null;
  try {
    const lines = readFileSync(postmasterPidFile, "utf8").split("\n");
    const port = Number(lines[3]?.trim());
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

async function isPortInUse(port: number): Promise<boolean> {
  return await new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", (error: NodeJS.ErrnoException) => {
      resolve(error.code === "EADDRINUSE");
    });
    server.listen(port, "127.0.0.1", () => {
      server.close();
      resolve(false);
    });
  });
}

export async function findAvailablePortState(
  startPort: number,
  maxLookahead = 20,
): Promise<{ selectedPort: number; occupiedPorts: number[] }> {
  const occupiedPorts: number[] = [];

  for (let offset = 0; offset < maxLookahead; offset += 1) {
    const port = startPort + offset;
    if (await isPortInUse(port)) {
      occupiedPorts.push(port);
      continue;
    }

    return { selectedPort: port, occupiedPorts };
  }

  throw new Error(
    `Embedded PostgreSQL could not find a free port from ${startPort} to ${startPort + maxLookahead - 1}`,
  );
}

export async function tryReuseEmbeddedPostgresConnection(
  dataDir: string,
  port: number,
): Promise<ReusableEmbeddedPostgresConnection | null> {
  const adminConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/postgres`;

  try {
    const actualDataDir = await getPostgresDataDirectory(adminConnectionString);
    const matchesDataDir =
      typeof actualDataDir === "string" &&
      path.resolve(actualDataDir) === path.resolve(dataDir);
    if (!matchesDataDir) return null;

    await ensurePostgresDatabase(adminConnectionString, "paperclip");
    return {
      port,
      connectionString: `postgres://paperclip:paperclip@127.0.0.1:${port}/paperclip`,
      source: `embedded-postgres@${port}`,
    };
  } catch {
    return null;
  }
}

export async function findReusableEmbeddedPostgresConnection(
  dataDir: string,
  candidatePorts: Iterable<number>,
): Promise<ReusableEmbeddedPostgresConnection | null> {
  const seen = new Set<number>();

  for (const port of candidatePorts) {
    if (!Number.isInteger(port) || port <= 0 || seen.has(port)) continue;
    seen.add(port);
    const reused = await tryReuseEmbeddedPostgresConnection(dataDir, port);
    if (reused) return reused;
  }

  return null;
}

export function createEmbeddedPostgresLogBuffer(options?: {
  limit?: number;
  verbose?: boolean;
  onVerboseLine?: (line: string) => void;
}): EmbeddedPostgresLogBuffer {
  const limit = options?.limit ?? 120;
  const lines: string[] = [];

  return {
    append(message: unknown) {
      const text =
        typeof message === "string"
          ? message
          : message instanceof Error
            ? message.message
            : String(message ?? "");

      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        lines.push(line);
        if (lines.length > limit) {
          lines.splice(0, lines.length - limit);
        }
        if (options?.verbose) {
          options.onVerboseLine?.(line);
        }
      }
    },
    recent() {
      return [...lines];
    },
  };
}

export function buildEmbeddedPostgresStartupError(
  error: unknown,
  options: {
    dataDir: string;
    preferredPort: number;
    selectedPort: number;
    recentLogs: string[];
  },
): Error {
  const baseError = toError(
    error,
    `Failed to start embedded PostgreSQL on port ${options.selectedPort}`,
  );
  const recentLogs = options.recentLogs.map((line) => line.trim()).filter(Boolean);
  const combinedLogs = recentLogs.join("\n");
  const hints: string[] = [];

  if (/administrative permissions is not permitted/i.test(combinedLogs)) {
    hints.push(
      "Windows embedded PostgreSQL cannot be started from an elevated Administrator shell. Close the elevated terminal/app and run Paperclip from a normal user shell.",
    );
  }

  if (/pre-existing shared memory block is still in use/i.test(combinedLogs)) {
    hints.push(
      `Another embedded PostgreSQL process appears to still be using ${options.dataDir}. Stop the old postgres/pg_ctl processes for this Paperclip instance, then retry.`,
    );
  }

  if (/could not bind|address already in use/i.test(combinedLogs)) {
    hints.push(
      `Port ${options.selectedPort} is already in use. If this is another Paperclip embedded PostgreSQL instance, keep the configured port and let Paperclip reuse it; otherwise free the port or change embeddedPostgresPort.`,
    );
  }

  if (options.selectedPort !== options.preferredPort) {
    hints.push(
      `Paperclip fell back from port ${options.preferredPort} to ${options.selectedPort} because the configured port was already occupied.`,
    );
  }

  const sections = [baseError.message];
  if (hints.length > 0) {
    sections.push(`Hint: ${hints.join(" ")}`);
  }
  if (recentLogs.length > 0) {
    sections.push(`Recent PostgreSQL logs:\n- ${recentLogs.join("\n- ")}`);
  }

  return new Error(sections.join("\n\n"));
}
