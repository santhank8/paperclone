import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolvePaperclipInstanceId, resolvePaperclipInstanceRoot } from "../home-paths.js";
import { resolvePaperclipConfigPath } from "../paths.js";

const INSTANCE_SERVER_LOCK_FILENAME = "instance-server.lock.json";
const LOCK_FILE_VERSION = 1 as const;
const MAX_ACQUIRE_ATTEMPTS = 3;

type InstanceServerLockStage = "starting" | "listening";

export interface InstanceServerLockRecord {
  version: typeof LOCK_FILE_VERSION;
  pid: number;
  instanceId: string;
  instanceRoot: string;
  configPath: string;
  requestedHost: string;
  requestedPort: number;
  listenHost: string | null;
  listenPort: number | null;
  apiUrl: string | null;
  stage: InstanceServerLockStage;
  acquiredAt: string;
  updatedAt: string;
}

export interface InstanceServerLockHandle {
  lockPath: string;
  record: InstanceServerLockRecord;
  markListening(details: {
    host: string;
    port: number;
    apiUrl: string;
  }): Promise<void>;
  release(): Promise<void>;
}

export class InstanceServerAlreadyRunningError extends Error {
  readonly lockPath: string;
  readonly existingLock: InstanceServerLockRecord | null;

  constructor(lockPath: string, existingLock: InstanceServerLockRecord | null) {
    const ownerPort = existingLock?.listenPort ?? existingLock?.requestedPort ?? null;
    const ownerPortLabel = ownerPort === null ? "unknown" : String(ownerPort);
    super(
      existingLock
        ? `Paperclip instance '${existingLock.instanceId}' is already owned by pid ${existingLock.pid} on port ${ownerPortLabel}. ` +
          `Refusing to start a second server for the same instance root (${existingLock.instanceRoot}). ` +
          "Stop the existing server, or use a separate worktree / PAPERCLIP_INSTANCE_ID / PAPERCLIP_CONFIG for parallel development."
        : `Paperclip instance server lock already exists at ${lockPath}. ` +
          "Stop the existing server, or use a separate worktree / PAPERCLIP_INSTANCE_ID / PAPERCLIP_CONFIG for parallel development.",
    );
    this.name = "InstanceServerAlreadyRunningError";
    this.lockPath = lockPath;
    this.existingLock = existingLock;
  }
}

function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function normalizeLockRecord(raw: unknown): InstanceServerLockRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (
    record.version !== LOCK_FILE_VERSION ||
    typeof record.pid !== "number" ||
    typeof record.instanceId !== "string" ||
    typeof record.instanceRoot !== "string" ||
    typeof record.configPath !== "string" ||
    typeof record.requestedHost !== "string" ||
    typeof record.requestedPort !== "number" ||
    typeof record.acquiredAt !== "string" ||
    typeof record.updatedAt !== "string"
  ) {
    return null;
  }

  const stage =
    record.stage === "listening" || record.stage === "starting"
      ? record.stage
      : "starting";

  return {
    version: LOCK_FILE_VERSION,
    pid: record.pid,
    instanceId: record.instanceId,
    instanceRoot: record.instanceRoot,
    configPath: record.configPath,
    requestedHost: record.requestedHost,
    requestedPort: record.requestedPort,
    listenHost: typeof record.listenHost === "string" ? record.listenHost : null,
    listenPort: typeof record.listenPort === "number" ? record.listenPort : null,
    apiUrl: typeof record.apiUrl === "string" ? record.apiUrl : null,
    stage,
    acquiredAt: record.acquiredAt,
    updatedAt: record.updatedAt,
  };
}

async function readLockRecord(lockPath: string): Promise<InstanceServerLockRecord | null> {
  try {
    const raw = JSON.parse(await readFile(lockPath, "utf8")) as unknown;
    return normalizeLockRecord(raw);
  } catch {
    return null;
  }
}

async function writeLockRecord(lockPath: string, record: InstanceServerLockRecord, flag?: "wx") {
  await writeFile(lockPath, `${JSON.stringify(record, null, 2)}\n`, {
    encoding: "utf8",
    ...(flag ? { flag } : {}),
  });
}

export async function acquireInstanceServerLock(input: {
  requestedHost: string;
  requestedPort: number;
  instanceId?: string;
  instanceRoot?: string;
  configPath?: string;
}): Promise<InstanceServerLockHandle> {
  const instanceId = input.instanceId ?? resolvePaperclipInstanceId();
  const instanceRoot = path.resolve(input.instanceRoot ?? resolvePaperclipInstanceRoot());
  const configPath = path.resolve(input.configPath ?? resolvePaperclipConfigPath());
  const lockPath = path.resolve(instanceRoot, "runtime-services", INSTANCE_SERVER_LOCK_FILENAME);

  await mkdir(path.dirname(lockPath), { recursive: true });

  let record: InstanceServerLockRecord | null = null;
  for (let attempt = 0; attempt < MAX_ACQUIRE_ATTEMPTS; attempt += 1) {
    const now = new Date().toISOString();
    const nextRecord: InstanceServerLockRecord = {
      version: LOCK_FILE_VERSION,
      pid: process.pid,
      instanceId,
      instanceRoot,
      configPath,
      requestedHost: input.requestedHost,
      requestedPort: input.requestedPort,
      listenHost: null,
      listenPort: null,
      apiUrl: null,
      stage: "starting",
      acquiredAt: now,
      updatedAt: now,
    };

    try {
      await writeLockRecord(lockPath, nextRecord, "wx");
      record = nextRecord;
      break;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code;
      if (code !== "EEXIST") {
        throw error;
      }

      const existing = await readLockRecord(lockPath);
      if (existing && isPidAlive(existing.pid)) {
        throw new InstanceServerAlreadyRunningError(lockPath, existing);
      }

      await rm(lockPath, { force: true });
    }
  }

  if (!record) {
    const existing = await readLockRecord(lockPath);
    throw new InstanceServerAlreadyRunningError(lockPath, existing);
  }

  let activeRecord = record;
  let released = false;

  return {
    lockPath,
    get record() {
      return activeRecord;
    },
    async markListening(details) {
      if (released) return;
      activeRecord = {
        ...activeRecord,
        listenHost: details.host,
        listenPort: details.port,
        apiUrl: details.apiUrl,
        stage: "listening",
        updatedAt: new Date().toISOString(),
      };
      await writeLockRecord(lockPath, activeRecord);
    },
    async release() {
      if (released) return;
      released = true;

      const existing = await readLockRecord(lockPath);
      if (!existing || existing.pid !== process.pid) {
        return;
      }
      await rm(lockPath, { force: true });
    },
  };
}
