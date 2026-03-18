import { Router, type RequestHandler } from "express";
import type { DeploymentExposure, DeploymentMode } from "@paperclipai/shared";
import {
  PLATFORM_CAPABILITY_DOMAINS,
  type InstalledAgentAdapterInfo,
  type PlatformCapabilitiesPayload,
} from "@paperclipai/shared";
import { unauthorized } from "../errors.js";
import { listServerAdapters } from "../adapters/index.js";
import { serverVersion } from "../version.js";

export function platformCapabilitiesRoutes(opts: {
  deploymentMode: DeploymentMode;
  deploymentExposure: DeploymentExposure;
  authReady: boolean;
  companyDeletionEnabled: boolean;
}): Router {
  const router = Router();

  const requireActor: RequestHandler = (req, res, next) => {
    if (opts.deploymentMode === "local_trusted") {
      next();
      return;
    }
    if (req.actor.type === "board" || req.actor.type === "agent") {
      next();
      return;
    }
    next(unauthorized());
  };

  router.get("/platform/capabilities", requireActor, (_req, res) => {
    const adapters = listServerAdapters();
    const installedAgentAdapters: InstalledAgentAdapterInfo[] = adapters
      .map((a) => ({
        type: a.type,
        supportsLocalAgentJwt: Boolean(a.supportsLocalAgentJwt),
        hasSessionCodec: Boolean(a.sessionCodec),
        modelCount: a.models?.length ?? 0,
      }))
      .sort((x, y) => x.type.localeCompare(y.type));

    const payload: PlatformCapabilitiesPayload = {
      schemaVersion: 1,
      core: PLATFORM_CAPABILITY_DOMAINS,
      installedAgentAdapters,
      deploymentMode: opts.deploymentMode,
      deploymentExposure: opts.deploymentExposure,
      version: serverVersion,
      features: {
        companyDeletionEnabled: opts.companyDeletionEnabled,
        authReady: opts.authReady,
      },
    };
    res.json(payload);
  });

  return router;
}
