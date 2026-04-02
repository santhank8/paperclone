/**
 * FleetOS proxy routes (RAA-292).
 *
 * Proxies FleetOS API calls through the dashboard server so that:
 * 1. The FleetOS API key stays server-side (never exposed to the browser).
 * 2. Responses can be transformed to shapes the UI expects.
 * 3. FleetOS remains internal infrastructure.
 *
 * Tenant isolation (RAA-288) is automatic — FleetOS scopes results by API key.
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { assertBoard } from "./authz.js";
import {
  createFleetOSClient,
  FleetOSProxyError,
  type FleetContainer,
  type FleetHealth,
} from "../services/fleetos-client.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClient() {
  const apiKey = process.env.FLEETOS_API_KEY ?? "";
  if (!apiKey) {
    throw new FleetOSProxyError("FLEETOS_API_KEY is not configured", 500, null);
  }
  return createFleetOSClient(apiKey);
}

/** Formats uptime_seconds into a human-readable string. */
function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

/** Merges container + health into a unified response for the UI. */
function mergeContainerAndHealth(container: FleetContainer, health: FleetHealth | null) {
  return {
    ...container,
    health: health
      ? {
          cpu_percent: health.cpu_percent,
          mem_percent: health.mem_percent,
          disk_percent: health.disk_percent,
          agent_status: health.agent_status,
          uptime_seconds: health.uptime_seconds,
          uptime_display: formatUptime(health.uptime_seconds),
          last_heartbeat: health.last_heartbeat,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function fleetosProxyRoutes(_db: Db) {
  const router = Router();

  // --- List all containers ---
  router.get("/fleetos/containers", async (req, res) => {
    assertBoard(req);
    try {
      const client = getClient();
      const containers = await client.listContainers();

      // Best-effort health fetch for each container (don't fail if one errors)
      const withHealth = await Promise.all(
        containers.map(async (c) => {
          let health: FleetHealth | null = null;
          if (c.status === "running") {
            try {
              health = await client.getHealth(c.id);
            } catch {
              // health unavailable — continue without it
            }
          }
          return mergeContainerAndHealth(c, health);
        }),
      );

      res.json({ containers: withHealth });
    } catch (err) {
      if (err instanceof FleetOSProxyError) {
        res.status(err.statusCode || 502).json({
          error: err.message,
          detail: err.detail,
        });
        return;
      }
      res.status(502).json({ error: "Failed to reach FleetOS" });
    }
  });

  // --- Single container detail (merged with health) ---
  router.get("/fleetos/containers/:containerId", async (req, res) => {
    assertBoard(req);
    const { containerId } = req.params;
    try {
      const client = getClient();
      const container = await client.getContainer(containerId!);
      let health: FleetHealth | null = null;
      if (container.status === "running") {
        try {
          health = await client.getHealth(containerId!);
        } catch {
          // continue without health
        }
      }
      res.json(mergeContainerAndHealth(container, health));
    } catch (err) {
      if (err instanceof FleetOSProxyError) {
        res.status(err.statusCode || 502).json({
          error: err.message,
          detail: err.detail,
        });
        return;
      }
      res.status(502).json({ error: "Failed to reach FleetOS" });
    }
  });

  // --- Health endpoint (for polling) ---
  router.get("/fleetos/containers/:containerId/health", async (req, res) => {
    assertBoard(req);
    const { containerId } = req.params;
    try {
      const client = getClient();
      const health = await client.getHealth(containerId!);
      res.json(health);
    } catch (err) {
      if (err instanceof FleetOSProxyError) {
        res.status(err.statusCode || 502).json({
          error: err.message,
          detail: err.detail,
        });
        return;
      }
      res.status(502).json({ error: "Failed to reach FleetOS" });
    }
  });

  // --- Agent process status ---
  router.get("/fleetos/containers/:containerId/agent", async (req, res) => {
    assertBoard(req);
    const { containerId } = req.params;
    try {
      const client = getClient();
      const agentProcess = await client.getAgentProcess(containerId!);
      res.json(agentProcess);
    } catch (err) {
      if (err instanceof FleetOSProxyError) {
        res.status(err.statusCode || 502).json({
          error: err.message,
          detail: err.detail,
        });
        return;
      }
      res.status(502).json({ error: "Failed to reach FleetOS" });
    }
  });

  // --- Lifecycle actions: start, stop, restart ---
  router.post("/fleetos/containers/:containerId/:action", async (req, res) => {
    assertBoard(req);
    const { containerId, action } = req.params;

    if (!["start", "stop", "restart"].includes(action!)) {
      res.status(400).json({ error: `Invalid action: ${action}` });
      return;
    }

    try {
      const client = getClient();
      let container: FleetContainer;
      switch (action) {
        case "start":
          container = await client.startContainer(containerId!);
          break;
        case "stop":
          container = await client.stopContainer(containerId!);
          break;
        case "restart":
          container = await client.restartContainer(containerId!);
          break;
        default:
          res.status(400).json({ error: `Invalid action: ${action}` });
          return;
      }
      res.json(container);
    } catch (err) {
      if (err instanceof FleetOSProxyError) {
        res.status(err.statusCode || 502).json({
          error: err.message,
          detail: err.detail,
        });
        return;
      }
      res.status(502).json({ error: "Failed to reach FleetOS" });
    }
  });

  return router;
}
