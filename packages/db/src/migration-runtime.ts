import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { ensurePostgresDatabase } from "./client.js";
import {
  buildEmbeddedPostgresStartupError,
  createEmbeddedPostgresRuntimeLogBuffer,
  findAvailablePortState,
  findReusableEmbeddedPostgresConnection,
  readPidFilePort,
  readRunningPostmasterPid,
} from "./embedded-postgres-runtime.js";
import { resolveDatabaseTarget } from "./runtime-config.js";

type EmbeddedPostgresInstance = {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

type EmbeddedPostgresCtor = new (opts: {
  databaseDir: string;
  user: string;
  password: string;
  port: number;
  persistent: boolean;
  initdbFlags?: string[];
  onLog?: (message: unknown) => void;
  onError?: (message: unknown) => void;
}) => EmbeddedPostgresInstance;

export type MigrationConnection = {
  connectionString: string;
  source: string;
  stop: () => Promise<void>;
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

async function loadEmbeddedPostgresCtor(): Promise<EmbeddedPostgresCtor> {
  try {
    const mod = await import("embedded-postgres");
    return mod.default as EmbeddedPostgresCtor;
  } catch {
    throw new Error(
      "Embedded PostgreSQL support requires dependency `embedded-postgres`. Reinstall dependencies and try again.",
    );
  }
}

async function ensureEmbeddedPostgresConnection(
  dataDir: string,
  preferredPort: number,
): Promise<MigrationConnection> {
  const EmbeddedPostgres = await loadEmbeddedPostgresCtor();
  const postmasterPidFile = path.resolve(dataDir, "postmaster.pid");
  const pgVersionFile = path.resolve(dataDir, "PG_VERSION");
  const runningPid = readRunningPostmasterPid(postmasterPidFile);
  const runningPort = readPidFilePort(postmasterPidFile);
  const candidatePorts = Array.from({ length: 20 }, (_, index) => preferredPort + index);
  const logBuffer = createEmbeddedPostgresRuntimeLogBuffer({
    verbose: process.env.PAPERCLIP_EMBEDDED_POSTGRES_VERBOSE === "true",
  });

  if (!runningPid && existsSync(pgVersionFile)) {
    const reused = await findReusableEmbeddedPostgresConnection(dataDir, candidatePorts);
    if (reused) {
      process.emitWarning(
        `Adopting an existing PostgreSQL instance on port ${reused.port} for embedded data dir ${dataDir} because postmaster.pid is missing.`,
      );
      return {
        connectionString: reused.connectionString,
        source: reused.source,
        stop: async () => {},
      };
    }
  }

  if (runningPid) {
    const port = runningPort ?? preferredPort;
    const adminConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/postgres`;
    await ensurePostgresDatabase(adminConnectionString, "paperclip");
    return {
      connectionString: `postgres://paperclip:paperclip@127.0.0.1:${port}/paperclip`,
      source: `embedded-postgres@${port}`,
      stop: async () => {},
    };
  }

  const { selectedPort } = await findAvailablePortState(preferredPort);
  const instance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "paperclip",
    password: "paperclip",
    port: selectedPort,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: logBuffer.append,
    onError: logBuffer.append,
  });

  if (!existsSync(path.resolve(dataDir, "PG_VERSION"))) {
    try {
      await instance.initialise();
    } catch (error) {
      throw toError(
        error,
        `Failed to initialize embedded PostgreSQL cluster in ${dataDir} on port ${selectedPort}`,
      );
    }
  }
  if (existsSync(postmasterPidFile)) {
    rmSync(postmasterPidFile, { force: true });
  }
  try {
    await instance.start();
  } catch (error) {
    throw buildEmbeddedPostgresStartupError(error, {
      dataDir,
      preferredPort,
      selectedPort,
      recentLogs: logBuffer.recent(),
    });
  }

  const adminConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${selectedPort}/postgres`;
  await ensurePostgresDatabase(adminConnectionString, "paperclip");

  return {
    connectionString: `postgres://paperclip:paperclip@127.0.0.1:${selectedPort}/paperclip`,
    source: `embedded-postgres@${selectedPort}`,
    stop: async () => {
      await instance.stop();
    },
  };
}

export async function resolveMigrationConnection(): Promise<MigrationConnection> {
  const target = resolveDatabaseTarget();
  if (target.mode === "postgres") {
    return {
      connectionString: target.connectionString,
      source: target.source,
      stop: async () => {},
    };
  }

  return ensureEmbeddedPostgresConnection(target.dataDir, target.port);
}
