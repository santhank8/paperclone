import { Router } from "express";
import express from "express";
import type { Db } from "@paperclipai/db";
import { webhookDispatcher } from "../services/webhook-dispatcher.js";

export function webhookIngestionRoutes(db: Db) {
  const router = Router();
  const dispatcher = webhookDispatcher(db);

  // Raw body parser — this route must be mounted BEFORE app.use(express.json())
  router.post(
    "/webhooks/incoming/:token",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const token = req.params.token as string;
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body ?? "");

      const headers: Record<string, string | string[] | undefined> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        headers[key] = value;
      }

      const result = await dispatcher.dispatch(token, rawBody, headers);

      if (!result.ok) {
        res.status(result.eventId ? 200 : 404).json(result);
        return;
      }

      res.json(result);
    },
  );

  return router;
}
