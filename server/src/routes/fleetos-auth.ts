import { Router } from "express";
import { logger } from "../middleware/logger.js";

/**
 * Validate a FleetOS API key by calling the FleetOS backend.
 * Returns tenant info on success, null on failure.
 */
async function validateFleetosApiKey(
  fleetosApiUrl: string,
  apiKey: string,
): Promise<{ tenantId: string; tenantName: string; companyId: string } | null> {
  try {
    const res = await fetch(`${fleetosApiUrl}/api/tenants`, {
      method: "GET",
      headers: {
        "X-API-Key": apiKey,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      id?: string;
      tenant_id?: string;
      name?: string;
      tenant_name?: string;
      company_id?: string;
    };
    const tenantId = data.tenant_id ?? data.id;
    const tenantName = data.tenant_name ?? data.name ?? "FleetOS Tenant";
    // FleetOS tenant_id maps to a Paperclip companyId. If the response includes
    // a company_id field we use it; otherwise we derive from the tenant_id.
    if (!tenantId) return null;
    const companyId = data.company_id ?? tenantId;
    return { tenantId, tenantName, companyId };
  } catch (err) {
    logger.warn({ err }, "FleetOS API key validation request failed");
    return null;
  }
}

export interface FleetosAuthRoutesOptions {
  fleetosApiUrl: string;
}

export function fleetosAuthRoutes(opts: FleetosAuthRoutesOptions) {
  const router = Router();

  /**
   * POST /api/fleetos/login
   * Accepts { apiKey: string }, validates against FleetOS, creates a session cookie.
   */
  router.post("/login", async (req, res) => {
    const { apiKey } = req.body as { apiKey?: string };
    if (!apiKey || typeof apiKey !== "string") {
      res.status(400).json({ error: "apiKey is required" });
      return;
    }

    const tenant = await validateFleetosApiKey(opts.fleetosApiUrl, apiKey);
    if (!tenant) {
      res.status(401).json({ error: "Invalid FleetOS API key" });
      return;
    }

    // Store the API key and tenant info in an httpOnly session cookie.
    // We use a signed cookie with JSON payload so the middleware can read it back.
    const sessionPayload = JSON.stringify({
      apiKey,
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
      companyId: tenant.companyId,
    });
    const encoded = Buffer.from(sessionPayload).toString("base64");

    res.cookie("fleetos_session", encoded, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    res.json({
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
      companyId: tenant.companyId,
    });
  });

  /**
   * POST /api/fleetos/logout
   * Clears the FleetOS session cookie.
   */
  router.post("/logout", (_req, res) => {
    res.clearCookie("fleetos_session", { path: "/" });
    res.json({ ok: true });
  });

  /**
   * GET /api/fleetos/me
   * Returns current tenant info from the FleetOS session cookie.
   */
  router.get("/me", (req, res) => {
    if (
      req.actor.type === "board" &&
      req.actor.source === "fleetos_api_key" &&
      req.actor.fleetosTenantId
    ) {
      res.json({
        tenantId: req.actor.fleetosTenantId,
        companyId: req.actor.companyId,
        userId: req.actor.userId,
      });
      return;
    }
    res.status(401).json({ error: "No active FleetOS session" });
  });

  return router;
}

export { validateFleetosApiKey };
