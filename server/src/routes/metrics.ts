import { Router, Request, Response, NextFunction } from "express";
import { metricsRegistry } from "../services/metrics.js";

/**
 * Prometheus metrics scrape endpoint.
 *
 * Mounted at the app level (not under /api) so Prometheus can scrape without
 * authentication. Access is restricted at the application layer to private
 * (RFC 1918) and loopback addresses only — Prometheus scrapers must run
 * within the cluster or private network.
 *
 * This guard is defence-in-depth alongside any Traefik IPAllowList middleware
 * configured at the ingress level.
 */

/**
 * Returns true if the given IPv4/IPv6 string is a private or loopback address.
 */
function isPrivateIp(ip: string): boolean {
  // Strip IPv6-mapped IPv4 prefix (::ffff:192.168.1.1 → 192.168.1.1)
  const raw = ip.startsWith("::ffff:") ? ip.slice(7) : ip.trim();

  // IPv6 loopback
  if (raw === "::1") return true;

  // IPv6 unique local (fc00::/7)
  if (/^f[cd]/i.test(raw)) return true;

  const parts = raw.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;

  const [a, b] = parts;
  // 127.0.0.0/8 — loopback
  if (a === 127) return true;
  // 10.0.0.0/8 — RFC 1918
  if (a === 10) return true;
  // 172.16.0.0/12 — RFC 1918
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 — RFC 1918
  if (a === 192 && b === 168) return true;

  return false;
}

/**
 * Restrict /metrics to private-network callers only.
 *
 * Strategy:
 * 1. Check the raw TCP connection IP (req.socket.remoteAddress). If it is
 *    public the request is blocked immediately — no proxy can legitimately
 *    forward a scrape request from the public internet to this endpoint.
 * 2. If the TCP peer is private (e.g. Traefik acting as reverse proxy), also
 *    inspect the X-Forwarded-For header. Traefik prepends the real client IP
 *    as the first XFF entry. If that IP is public the request is blocked.
 *
 * Note: trusting XFF here is safe because (a) the socket peer is already
 * verified to be on the private network, and (b) a public attacker cannot
 * reach this port without first going through a trusted private proxy.
 */
function metricsIpGuard(req: Request, res: Response, next: NextFunction): void {
  const socketIp = req.socket.remoteAddress ?? "";

  // Block any direct connection that arrives from a public address.
  if (!isPrivateIp(socketIp)) {
    res.status(403).send("Forbidden");
    return;
  }

  // The TCP peer is on the private network (could be Traefik, another pod,
  // or a local process). Check XFF to get the real originating client IP
  // when the request is proxied through Traefik.
  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const clientIp = (typeof xff === "string" ? xff : xff[0])
      .split(",")[0]
      .trim();
    if (!isPrivateIp(clientIp)) {
      res.status(403).send("Forbidden");
      return;
    }
  }

  next();
}

export function metricsRoutes(): Router {
  const router = Router();

  router.use(metricsIpGuard);

  router.get("/", async (_req, res) => {
    try {
      const metrics = await metricsRegistry.metrics();
      res.set("Content-Type", metricsRegistry.contentType).send(metrics);
    } catch (err) {
      res.status(500).send(String(err));
    }
  });

  return router;
}
