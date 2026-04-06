/**
 * Background poller that monitors in-flight FleetOS provisioning jobs.
 *
 * Queries for agents with status "provisioning" and a non-null provisionJobId,
 * polls the Fleet API for each, and updates agent records on completion or failure.
 */

import { eq, and, isNotNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents } from "@paperclipai/db";
import {
  createFleetOSClient,
  FleetOSProxyError,
  type FleetOSProxyClient,
  type ProvisionJob,
} from "./fleetos-client.js";

/** Default polling interval in milliseconds (15 seconds). */
export const PROVISION_POLL_INTERVAL_MS = 15_000;

interface ProvisionPollerOptions {
  /** Override the Fleet API base URL (defaults to FLEETOS_API_URL env var). */
  fleetApiUrl?: string;
  /** API key for authenticating with the Fleet API. */
  fleetApiKey?: string;
}

/**
 * Create a FleetOS client for the poller, returning null if configuration is missing.
 * The poller is a best-effort background process and should not crash the server.
 */
function createPollerClient(opts: ProvisionPollerOptions): FleetOSProxyClient | null {
  const apiKey = opts.fleetApiKey ?? process.env.FLEETOS_API_KEY ?? "";
  const baseUrl = opts.fleetApiUrl ?? process.env.FLEETOS_API_URL;
  if (!baseUrl || !apiKey) return null;
  try {
    return createFleetOSClient(apiKey, baseUrl);
  } catch {
    return null;
  }
}

/**
 * Run a single poll tick: find all agents in "provisioning" status with a
 * provisionJobId, query FleetOS for the job status, and update the agent record.
 */
async function pollProvisioningAgents(
  db: Db,
  client: FleetOSProxyClient,
): Promise<{ checked: number; completed: number; failed: number }> {
  const provisioningAgents = await db
    .select({
      id: agents.id,
      provisionJobId: agents.provisionJobId,
    })
    .from(agents)
    .where(
      and(
        eq(agents.status, "provisioning"),
        isNotNull(agents.provisionJobId),
      ),
    );

  let checked = 0;
  let completed = 0;
  let failed = 0;

  for (const agent of provisioningAgents) {
    if (!agent.provisionJobId) continue;
    checked++;

    let job: ProvisionJob;
    try {
      job = await client.getProvisionJob(agent.provisionJobId);
    } catch (err) {
      // Network/timeout errors are transient — skip and retry next tick
      if (err instanceof FleetOSProxyError && (err.statusCode === 503 || err.statusCode === 504)) {
        continue;
      }
      // For other errors (e.g., 404 job not found), mark as failed
      const message = err instanceof Error ? err.message : String(err);
      await db
        .update(agents)
        .set({
          status: "error",
          provisionError: `Failed to poll provision job: ${message}`,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agent.id));
      failed++;
      continue;
    }

    if (job.status === "complete") {
      const containerId =
        job.container_name ??
        (job.result?.container_id as string | undefined) ??
        null;
      await db
        .update(agents)
        .set({
          status: "idle",
          provisionedContainerId: containerId,
          provisionError: null,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agent.id));
      completed++;
    } else if (job.status === "failed" || job.status === "cancelled" || job.status === "timeout") {
      await db
        .update(agents)
        .set({
          status: "error",
          provisionError: job.error ?? `Provisioning ${job.status}`,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, agent.id));
      failed++;
    }
    // "running" status — leave as-is, will be checked next tick
  }

  return { checked, completed, failed };
}

/**
 * Start the provisioning poller background loop.
 *
 * Returns a cleanup function that stops the interval.
 */
export function startProvisionPoller(
  db: Db,
  opts: ProvisionPollerOptions = {},
  logger?: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void; warn: (...args: unknown[]) => void },
): () => void {
  const client = createPollerClient(opts);
  if (!client) {
    logger?.warn("Provision poller disabled: FleetOS API URL or key not configured");
    return () => {};
  }

  logger?.info("Provision poller started (interval: %dms)", PROVISION_POLL_INTERVAL_MS);

  const interval = setInterval(() => {
    void pollProvisioningAgents(db, client)
      .then((result) => {
        if (result.checked > 0) {
          logger?.info(
            { ...result },
            "provision poller tick: checked=%d completed=%d failed=%d",
            result.checked,
            result.completed,
            result.failed,
          );
        }
      })
      .catch((err) => {
        logger?.error({ err }, "provision poller tick failed");
      });
  }, PROVISION_POLL_INTERVAL_MS);

  return () => clearInterval(interval);
}

/**
 * Query current provision status for a single agent, optionally polling
 * the Fleet API for live progress if the agent is still provisioning.
 */
export async function getProvisionStatus(
  db: Db,
  agentId: string,
  opts: ProvisionPollerOptions = {},
): Promise<{
  status: string;
  jobId: string | null;
  containerId: string | null;
  error: string | null;
  progress: { steps?: ProvisionJob["steps"]; createdAt?: string; completedAt?: string } | null;
}> {
  const [agent] = await db
    .select({
      status: agents.status,
      provisionJobId: agents.provisionJobId,
      provisionedContainerId: agents.provisionedContainerId,
      provisionError: agents.provisionError,
    })
    .from(agents)
    .where(eq(agents.id, agentId));

  if (!agent) {
    return { status: "not_found", jobId: null, containerId: null, error: null, progress: null };
  }

  let progress: {
    steps?: ProvisionJob["steps"];
    createdAt?: string;
    completedAt?: string;
  } | null = null;

  // If still provisioning, try to get live progress from Fleet API
  if (agent.status === "provisioning" && agent.provisionJobId) {
    const client = createPollerClient(opts);
    if (client) {
      try {
        const job = await client.getProvisionJob(agent.provisionJobId);
        progress = {
          steps: job.steps,
          createdAt: job.created_at,
          completedAt: job.completed_at,
        };
      } catch {
        // Swallow errors — live progress is best-effort
      }
    }
  }

  return {
    status: agent.status,
    jobId: agent.provisionJobId,
    containerId: agent.provisionedContainerId,
    error: agent.provisionError,
    progress,
  };
}
