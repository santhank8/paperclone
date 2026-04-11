import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const LEGACY_AI_WORKER_PATH = "/Users/daehan/ec2-migration/home-ubuntu/board-app/ai-worker.js";

type AiWorkerModule = {
  runVerifyContract: (html?: string, lane?: string, options?: Record<string, unknown>) => unknown;
  verifyPublishedPostContract: (post?: Record<string, unknown>, lane?: string) => unknown;
};

function getAiWorkerModule(): AiWorkerModule {
  return require(LEGACY_AI_WORKER_PATH) as AiWorkerModule;
}

export function runVerifyContract(html = "", lane = "publish", options: Record<string, unknown> = {}): unknown {
  return getAiWorkerModule().runVerifyContract(html, lane, options);
}

export function verifyPublishedPostContract(post: Record<string, unknown> = {}, lane = "publish"): unknown {
  return getAiWorkerModule().verifyPublishedPostContract(post, lane);
}
