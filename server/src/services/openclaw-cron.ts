import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { logger } from "../middleware/logger.js";

export interface OpenClawCronJob {
  id: string;
  agentId: string;
  name: string;
  enabled: boolean;
  createdAtMs?: number;
  updatedAtMs?: number;
  schedule: {
    kind: string;
    expr?: string;
    at?: string;
    tz?: string;
  };
  sessionTarget?: string;
  wakeMode?: string;
  payload: {
    kind: string;
    message?: string;
    model?: string;
    thinking?: string;
    timeoutSeconds?: number;
  };
  delivery?: {
    mode: string;
    channel?: string;
    to?: string;
  };
  state?: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: string;
    lastDurationMs?: number;
    lastError?: string;
  };
}

interface OpenClawCronFile {
  version: number;
  jobs: OpenClawCronJob[];
}

interface OpenClawRunEntry {
  jobId: string;
  status: string;
  deliveryStatus?: string;
  timestamp?: number;
  startedAtMs?: number;
  durationMs?: number;
  error?: string;
}

// Simple async mutex to serialize file writes and prevent race conditions
let writeLock: Promise<unknown> = Promise.resolve();
function toggleMutex<T>(fn: () => Promise<T>): Promise<T> {
  const prev = writeLock;
  let resolve: () => void;
  writeLock = new Promise((r) => { resolve = r; });
  return prev.then(fn).finally(() => resolve!());
}

function getOpenClawStateDir(): string {
  return process.env.OPENCLAW_STATE_DIR ?? join(homedir(), ".openclaw");
}

function getCronFilePath(): string {
  return join(getOpenClawStateDir(), "cron", "jobs.json");
}

function getRunsFilePath(): string {
  return join(getOpenClawStateDir(), "cron", "runs.json");
}

export function openclawCronService() {
  return {
    async loadCronJobs(): Promise<OpenClawCronJob[]> {
      try {
        const raw = await readFile(getCronFilePath(), "utf-8");
        const data: OpenClawCronFile = JSON.parse(raw);
        return data.jobs ?? [];
      } catch {
        return [];
      }
    },

    async loadRunHistory(
      jobId: string,
      page = 0,
      pageSize = 20,
    ): Promise<{ entries: OpenClawRunEntry[]; total: number; hasMore: boolean }> {
      try {
        const raw = await readFile(getRunsFilePath(), "utf-8");
        const allRuns: OpenClawRunEntry[] = JSON.parse(raw);
        const filtered = allRuns
          .filter((r) => r.jobId === jobId)
          .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
        const start = page * pageSize;
        const entries = filtered.slice(start, start + pageSize);
        return { entries, total: filtered.length, hasMore: start + pageSize < filtered.length };
      } catch {
        return { entries: [], total: 0, hasMore: false };
      }
    },

    async toggleJob(jobId: string, enabled: boolean): Promise<boolean> {
      // Serialize file writes to prevent concurrent read-modify-write corruption
      return toggleMutex(async () => {
        try {
          const raw = await readFile(getCronFilePath(), "utf-8");
          const data: OpenClawCronFile = JSON.parse(raw);
          const job = data.jobs.find((j) => j.id === jobId);
          if (!job) return false;
          job.enabled = enabled;
          job.updatedAtMs = Date.now();
          await writeFile(getCronFilePath(), JSON.stringify(data, null, 2));
          return true;
        } catch (err) {
          logger.error({ err }, "Failed to toggle OpenClaw cron job");
          return false;
        }
      });
    },
  };
}
