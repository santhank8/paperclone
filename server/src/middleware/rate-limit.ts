import type { Request, Response, NextFunction } from "express";

/**
 * Simple in-memory sliding-window rate limiter for HTTP API routes.
 * Limits requests per IP address. No external dependencies required.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodically clean up expired entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000).unref();

export function rateLimitMiddleware(opts: {
  /** Max requests per window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();

    let entry = store.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + opts.windowMs };
      store.set(key, entry);
    }

    entry.count++;

    res.setHeader("X-RateLimit-Limit", opts.max);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, opts.max - entry.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));

    if (entry.count > opts.max) {
      res.status(429).json({
        error: "Too many requests",
        retryAfterMs: entry.resetAt - now,
      });
      return;
    }

    next();
  };
}
