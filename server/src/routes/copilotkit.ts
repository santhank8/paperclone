import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNodeHttpEndpoint,
} from "@copilotkit/runtime";
import { Router } from "express";

export function copilotKitRoutes(): Router {
  const router = Router();

  if (!process.env.OPENAI_API_KEY) {
    router.all("/copilotkit", (_req, res) => {
      res.status(503).json({ error: "CopilotKit is not configured (OPENAI_API_KEY not set)" });
    });
    return router;
  }

  const serviceAdapter = new OpenAIAdapter({
    model: process.env.COPILOTKIT_MODEL ?? "gpt-5.4",
  });

  const runtime = new CopilotRuntime();

  const handler = copilotRuntimeNodeHttpEndpoint({
    endpoint: "/copilotkit",
    runtime,
    serviceAdapter,
  });

  router.all("/copilotkit", async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
