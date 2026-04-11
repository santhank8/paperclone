import { createDb, blogPublishApprovals, blogPublishExecutions, blogRuns } from "/Users/daehan/Documents/persona/paperclip/packages/db/src/index.ts";
import { eq, desc } from "/Users/daehan/Documents/persona/paperclip/node_modules/.pnpm/node_modules/drizzle-orm";
import { blogRunWorkerService } from "../server/src/services/blog-run-worker.ts";
import { blogRunService } from "../server/src/services/blog-runs.ts";
import { blogPublisherService } from "../server/src/services/blog-publisher.ts";
import fs from "node:fs";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFile("/Users/daehan/ec2-migration/home-ubuntu/board-app/.env");
  loadEnvFile("/Users/daehan/Documents/persona/paperclip/.env");
  const runId = process.argv[2];
  if (!runId) {
    throw new Error("run_id_required");
  }

  const db = createDb(process.env.PAPERCLIP_DB_URL || "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip");
  const runs = blogRunService(db);
  const worker = blogRunWorkerService(db);
  const publisher = blogPublisherService(db);

  const [before] = await db.select().from(blogRuns).where(eq(blogRuns.id, runId)).limit(1);
  if (!before) throw new Error("run_not_found");

  const slug = `live-verify-${Date.now()}`;
  const nextContext = {
    ...(before.contextJson || {}),
    targetSlug: slug,
    publicVerifyContractMode: "strict",
  };

  await db.update(blogRuns).set({
    publishMode: "publish",
    status: "publish_approval_pending",
    currentStep: "publish",
    failedReason: null,
    completedAt: null,
    approvalKeyHash: null,
    publishIdempotencyKey: null,
    publishedUrl: null,
    wordpressPostId: null,
    contextJson: nextContext,
    updatedAt: new Date(),
  }).where(eq(blogRuns.id, runId));

  const approved = await runs.requestPublishApprovalFromRun(runId, {
    approvedByUserId: "codex-live-verify",
  });
  const publishStep = await worker.runNext(runId);
  const verifyStep = await worker.runNext(runId);

  const [run] = await db.select().from(blogRuns).where(eq(blogRuns.id, runId)).limit(1);
  const approvals = await db.select().from(blogPublishApprovals).where(eq(blogPublishApprovals.blogRunId, runId)).orderBy(desc(blogPublishApprovals.createdAt)).limit(1);
  const executions = await db.select().from(blogPublishExecutions).where(eq(blogPublishExecutions.blogRunId, runId)).orderBy(desc(blogPublishExecutions.createdAt)).limit(1);

  let quarantine = null;
  if (run?.wordpressPostId && executions[0]?.publishedUrl) {
    const observedSlug = String((executions[0] as any)?.resultJson?.slug || "").trim() || slug;
    quarantine = await publisher.quarantinePost({
      blogRunId: runId,
      companyId: run.companyId,
      mode: "live_run",
      approvalArtifactRef: approvals[0]?.id || runId,
      approvalIssueIdentifier: "live-verify",
      requestedByIssueIdentifier: "codex-live-verify",
      postId: run.wordpressPostId,
      expectedSlug: observedSlug,
      expectedPublicUrl: executions[0].publishedUrl,
      expectedPreMutationStatus: "publish",
      quarantineAction: "move_to_trash",
    });
  }

  console.log(JSON.stringify({
    slug,
    afterApproval: approved.run ? { status: approved.run.status, currentStep: approved.run.currentStep } : null,
    publishStep: publishStep?.run ? {
      status: publishStep.run.status,
      currentStep: publishStep.run.currentStep,
      failedReason: publishStep.run.failedReason || null,
    } : null,
    verifyStep: verifyStep?.run ? {
      status: verifyStep.run.status,
      currentStep: verifyStep.run.currentStep,
      failedReason: verifyStep.run.failedReason || null,
    } : null,
    finalRun: run ? {
      status: run.status,
      currentStep: run.currentStep,
      failedReason: run.failedReason,
      publishedUrl: run.publishedUrl,
      wordpressPostId: run.wordpressPostId,
      publishMode: run.publishMode,
    } : null,
    approvalId: approvals[0]?.id || null,
    execution: executions[0] ? {
      id: executions[0].id,
      publishedUrl: executions[0].publishedUrl,
      wordpressPostId: executions[0].wordpressPostId,
    } : null,
    quarantine,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
