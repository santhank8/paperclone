import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  blogArtifacts,
  blogPublishApprovals,
  blogPublishExecutions,
  blogRunStepAttempts,
  blogRuns,
  companies,
  createDb,
  projects,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { blogArtifactMirrorService } from "../services/blog-artifact-mirror.ts";
import { blogPublisherService } from "../services/blog-publisher.ts";
import { blogRunService } from "../services/blog-runs.ts";
import { blogRunWorkerService } from "../services/blog-run-worker.ts";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

function createJsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

function createSharedVerifyResult(
  verdict: "pass" | "fail" = "pass",
  failureNames: string[] = verdict === "fail" ? ["PUBLIC_VERIFY_REGRESSION"] : [],
) {
  return {
    schemaVersion: "shared-public-verify.v1",
    verifyId: "verify-1",
    approvedArtifactRef: {
      issueIdentifier: "FLU-45",
      artifactId: "artifact-1",
      artifactLabel: "Approved article",
    },
    approvedArtifact: {
      issueIdentifier: "FLU-45",
      artifactId: "artifact-1",
      artifactLabel: "Approved article",
      headline: "Live publish title",
      decisionState: verdict === "pass" ? "adopt" : "unclear",
      decisionSummary: "Approved package expected a decision-ready article.",
      requiredSections: ["verdict_overview", "evidence_breakdown", "who_should_adopt"],
    },
    publisherExpectations: {
      headline: "Live publish title",
      decisionState: verdict === "pass" ? "adopt" : "unclear",
      decisionSummary: "Publisher expected a decision-ready article.",
      publishStatus: "publish",
      featuredMedia: {
        required: false,
        label: "No featured image required",
      },
    },
    publishReceiptId: "receipt-1",
    publishReceiptLabel: "Receipt 1",
    publishReceipt: {
      receiptId: "receipt-1",
      label: "Receipt 1",
      mode: "live-run",
      lifecycle: "executed",
      target: "wordpress.production",
      targetUrl: "https://fluxaivory.com/test-post/",
      publishedAt: "2026-04-04T10:00:00.000Z",
    },
    publicUrl: "https://fluxaivory.com/test-post/",
    verifiedAt: "2026-04-04T10:01:00.000Z",
    verdict,
    readerDecisionState: verdict === "pass" ? "adopt" : "unclear",
    readerDecisionSummary: verdict === "pass"
      ? "Reader can reach a clear adopt decision."
      : "Reader cannot safely reach a decision.",
    coreChecks: [
      { checkId: "public_visibility", status: verdict === "pass" ? "pass" : "fail", overrideable: false, summary: "Visibility check." },
      { checkId: "title_framing", status: "pass", overrideable: false, summary: "Title framing check." },
      { checkId: "body_contract", status: "pass", overrideable: false, summary: "Body contract check." },
      { checkId: "media_and_status", status: verdict === "pass" ? "pass" : "fail", overrideable: false, summary: "Media and status check." },
      { checkId: "artifact_parity", status: verdict === "pass" ? "pass" : "fail", overrideable: false, summary: "Artifact parity check." },
      { checkId: "reader_decision", status: verdict === "pass" ? "pass" : "fail", overrideable: false, summary: "Reader decision check." },
    ],
    failureNames,
    warnings: [],
    evidence: [
      { surface: "approved_package", signal: "approved article present" },
      { surface: "publication_receipt", signal: "publish receipt present" },
      { surface: "public_verify", signal: "public verify evidence present" },
    ],
    publicObservation: {
      observedAt: "2026-04-04T10:01:00.000Z",
      url: "https://fluxaivory.com/test-post/",
      fetchStatus: verdict === "pass" ? "reachable" : "missing",
      httpStatus: verdict === "pass" ? 200 : 404,
      publishStatus: verdict === "pass" ? "publish" : "missing",
      featuredMediaPresent: false,
      featuredMediaLabel: null,
      headline: verdict === "pass" ? "Live publish title" : null,
      decisionState: verdict === "pass" ? "adopt" : "unclear",
      decisionSummary: verdict === "pass" ? "Reader can still adopt." : "Reader cannot evaluate the page.",
      summary: verdict === "pass" ? "Public page matched expectations." : "Public page was missing.",
    },
    driftSummary: {
      class: verdict === "pass" ? "none" : "public_visibility",
      summary: verdict === "pass" ? "No drift." : "Public article never became reachable.",
    },
    overrideSummary: {
      applied: [],
      blocked: verdict === "pass" ? [] : [`${failureNames[0] ?? "PUBLIC_VERIFY_REGRESSION"} is non-overrideable`],
    },
  };
}

describeEmbeddedPostgres("blog pipeline live publish e2e", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  let scratchRoot = "";

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-blog-publish-e2e-");
    db = createDb(tempDb.connectionString);
    scratchRoot = await blogArtifactMirrorService().createScratchRoot();
  }, 20_000);

  afterEach(async () => {
    await fs.rm(scratchRoot, { recursive: true, force: true }).catch(() => {});
    scratchRoot = await blogArtifactMirrorService().createScratchRoot();
    await db.delete(blogPublishExecutions);
    await db.delete(blogPublishApprovals);
    await db.delete(blogArtifacts);
    await db.delete(blogRunStepAttempts);
    await db.delete(blogRuns);
    await db.delete(projects);
    await db.delete(companies);
  });

  afterAll(async () => {
    await fs.rm(scratchRoot, { recursive: true, force: true }).catch(() => {});
    await tempDb?.cleanup();
  });

  async function seedProject() {
    const companyId = randomUUID();
    const projectId = randomUUID();
    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix: `P${companyId.slice(0, 6).toUpperCase()}`,
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(projects).values({
      id: projectId,
      companyId,
      name: "Blog pipeline",
      status: "in_progress",
    });
    return { companyId, projectId };
  }

  it("publishes through the isolated publisher, reuses duplicate publish executions, and finishes after public verify", async () => {
    const { companyId, projectId } = await seedProject();
    const mirror = blogArtifactMirrorService({ baseDir: scratchRoot });
    const runSvc = blogRunService(db, { artifactMirror: mirror });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(createJsonResponse(200, { id: 7, name: "Local Admin", slug: "localadmin" }))
      .mockResolvedValueOnce(createJsonResponse(201, { id: 978, status: "publish", link: "https://fluxaivory.com/test-post/" }));
    const publisher = blogPublisherService(db, {
      fetchImpl,
      env: {
        WP_API_URL: "https://fluxaivory.com/wp-json/wp/v2",
        WP_USER: "localadmin",
        WP_APP_PASSWORD: "app-pass",
      },
    });
    const worker = blogRunWorkerService(db, {
      runService: runSvc,
      artifactRoot: scratchRoot,
      publisher,
      runGrokArtifactStep: vi.fn().mockResolvedValue({ ok: true, source: "grok-web-artifact-step" }),
      runResearchStep: vi.fn().mockResolvedValue({ summary: "research ok" }),
      runDraftStep: vi.fn().mockResolvedValue({
        title: "Live publish title",
        article_html: "<p>Live publish body</p>",
      }),
      runImageStep: vi.fn().mockResolvedValue({ saved_path: "/tmp/featured.png" }),
      runDraftReviewStep: vi.fn().mockResolvedValue({ verdict: "pass" }),
      runDraftPolishStep: vi.fn().mockResolvedValue({ verdict: "pass" }),
      runFinalReviewStep: vi.fn().mockResolvedValue({ verdict: "approve" }),
      runValidateStep: vi.fn().mockResolvedValue({ ok: true }),
      runQualityGateBundle: vi.fn().mockResolvedValue({
        results: {
          publish_ready: {
            ok: true,
            status: "pass",
            failed_gates: [],
            gate_reason_summary: {},
            summary: "all publish-ready gates passed",
          },
        },
      }),
      runPublicVerifyStep: vi.fn().mockResolvedValue(createSharedVerifyResult("pass")),
    });

    const run = await runSvc.create({
      companyId,
      projectId,
      topic: "Live publish topic",
      lane: "publish",
      publishMode: "publish",
      contextJson: {
        title: "Live publish title",
        article_html: "<p>Live publish body</p>",
      },
    });

    for (let i = 0; i < 7; i += 1) {
      await worker.runNext(run!.id);
    }

    let detail = await runSvc.getDetail(run!.id);
    expect(detail?.run.status).toBe("publish_approval_pending");

    await runSvc.requestPublishApproval(run!.id, {
      targetSlug: "live-publish-title",
      artifactHash: "artifact-hash",
      normalizedDomHash: "dom-hash",
      approvalKeyHash: "approval-hash",
      publishIdempotencyKey: "publish-key",
      approvedByUserId: "operator",
    });

    await worker.runNext(run!.id);

    const firstPublishFetchCalls = fetchImpl.mock.calls.length;
    expect(firstPublishFetchCalls).toBe(2);

    const firstExecutionRows = await db.select().from(blogPublishExecutions);
    expect(firstExecutionRows).toHaveLength(1);
    expect(firstExecutionRows[0]?.publishIdempotencyKey).toBe("publish-key");

    await db.update(blogRuns).set({
      status: "publish_approved",
      currentStep: "publish",
    }).where(eq(blogRuns.id, run!.id));

    await worker.runNext(run!.id);

    expect(fetchImpl.mock.calls.length).toBe(firstPublishFetchCalls);
    const secondExecutionRows = await db.select().from(blogPublishExecutions);
    expect(secondExecutionRows).toHaveLength(1);

    await worker.runNext(run!.id);

    detail = await runSvc.getDetail(run!.id);
    expect(detail?.run.status).toBe("public_verified");
    expect(detail?.run.wordpressPostId).toBe(978);
    expect(detail?.run.publishedUrl).toBe("https://fluxaivory.com/test-post/");

    const publishResult = JSON.parse(await fs.readFile(path.join(scratchRoot, run!.id, "publish.json"), "utf8"));
    const verifyResult = JSON.parse(await fs.readFile(path.join(scratchRoot, run!.id, "verify.json"), "utf8"));

    expect(publishResult).toMatchObject({
      postId: 978,
      url: "https://fluxaivory.com/test-post/",
    });
    expect(verifyResult).toMatchObject({
      schemaVersion: "shared-public-verify.v1",
      verdict: "pass",
    });
  });

  it("marks the run failed when public verify fails after publish", async () => {
    const { companyId, projectId } = await seedProject();
    const mirror = blogArtifactMirrorService({ baseDir: scratchRoot });
    const runSvc = blogRunService(db, { artifactMirror: mirror });
    const publisher = {
      publishPost: vi.fn().mockResolvedValue({
        reusedExecution: false,
        authenticatedUser: "Local Admin",
        post: { id: 979, status: "publish", link: "https://fluxaivory.com/failing-post/" },
        featuredMedia: null,
        supportingMedia: [],
      }),
      publishDraft: vi.fn(),
    };
    const worker = blogRunWorkerService(db, {
      runService: runSvc,
      artifactRoot: scratchRoot,
      publisher: publisher as any,
      runGrokArtifactStep: vi.fn().mockResolvedValue({ ok: true, source: "grok-web-artifact-step" }),
      runResearchStep: vi.fn().mockResolvedValue({ summary: "research ok" }),
      runDraftStep: vi.fn().mockResolvedValue({
        title: "Failure title",
        article_html: "<p>Failure body</p>",
      }),
      runImageStep: vi.fn().mockResolvedValue({ saved_path: "/tmp/featured.png" }),
      runDraftReviewStep: vi.fn().mockResolvedValue({ verdict: "pass" }),
      runDraftPolishStep: vi.fn().mockResolvedValue({ verdict: "pass" }),
      runFinalReviewStep: vi.fn().mockResolvedValue({ verdict: "approve" }),
      runValidateStep: vi.fn().mockResolvedValue({ ok: true }),
      runQualityGateBundle: vi.fn().mockResolvedValue({
        results: {
          publish_ready: {
            ok: true,
            status: "pass",
            failed_gates: [],
            gate_reason_summary: {},
            summary: "all publish-ready gates passed",
          },
        },
      }),
      runPublicVerifyStep: vi.fn().mockResolvedValue(
        createSharedVerifyResult("fail", ["PUBLIC_VERIFY_REGRESSION", "READER_DECISION_UNCLEAR"])
      ),
    });

    const run = await runSvc.create({
      companyId,
      projectId,
      topic: "Verify failure topic",
      lane: "publish",
      publishMode: "publish",
      contextJson: {
        title: "Failure title",
        article_html: "<p>Failure body</p>",
      },
    });

    for (let i = 0; i < 7; i += 1) {
      await worker.runNext(run!.id);
    }
    await runSvc.requestPublishApproval(run!.id, {
      targetSlug: "failure-title",
      artifactHash: "artifact-hash",
      normalizedDomHash: "dom-hash",
      approvalKeyHash: "approval-hash",
      publishIdempotencyKey: "publish-key-fail",
      approvedByUserId: "operator",
    });
    await worker.runNext(run!.id);
    await worker.runNext(run!.id);

    const detail = await runSvc.getDetail(run!.id);
    expect(detail?.run.status).toBe("failed");
    expect(detail?.run.failedReason).toBe(
      "blog_run_public_verify_failed:PUBLIC_VERIFY_REGRESSION,READER_DECISION_UNCLEAR"
    );
  });

  it("allows an explicit live publish canary to run in strict publish-ready mode", async () => {
    const { companyId, projectId } = await seedProject();
    const mirror = blogArtifactMirrorService({ baseDir: scratchRoot });
    const runSvc = blogRunService(db, { artifactMirror: mirror });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(createJsonResponse(200, { id: 7, name: "Local Admin", slug: "localadmin" }))
      .mockResolvedValueOnce(createJsonResponse(201, { id: 980, status: "publish", link: "https://fluxaivory.com/live-canary/" }));
    const publisher = blogPublisherService(db, {
      fetchImpl,
      env: {
        WP_API_URL: "https://fluxaivory.com/wp-json/wp/v2",
        WP_USER: "localadmin",
        WP_APP_PASSWORD: "app-pass",
      },
    });
    const worker = blogRunWorkerService(db, {
      runService: runSvc,
      artifactRoot: scratchRoot,
      publisher,
      runGrokArtifactStep: vi.fn().mockResolvedValue({ ok: true, source: "grok-web-artifact-step" }),
      runResearchStep: vi.fn().mockResolvedValue({
        summary: "research ok",
        notebook_reference: "Fluxaivory AI-Tech Research",
        fact_pack: { items: [1] },
        source_registry: [{ url: "https://example.com" }],
        uncertainty_ledger: [{ claim: "x" }],
      }),
      runDraftStep: vi.fn().mockResolvedValue({
        title: "Live canary title",
        article_html: "<p>Live canary body</p>",
      }),
      runImageStep: vi.fn().mockResolvedValue({
        featured: { sha256: "a" },
        supporting: [
          { kind: "structured_fallback", role: "comparison", heading: "핵심 비교 정리" },
          { kind: "structured_fallback", role: "workflow", heading: "도입 흐름 한눈에 보기" },
        ],
        structured_fallback_used: true,
      }),
      runDraftReviewStep: vi.fn().mockResolvedValue({ verdict: "pass" }),
      runDraftPolishStep: vi.fn().mockResolvedValue({ verdict: "pass" }),
      runFinalReviewStep: vi.fn().mockResolvedValue({ verdict: "approve" }),
      runValidateStep: vi.fn().mockResolvedValue({ ok: true }),
      runPublicVerifyStep: vi.fn().mockResolvedValue(createSharedVerifyResult("pass")),
      runQualityGateBundle: vi.fn().mockResolvedValue({
        results: {
          publish_ready: {
            ok: true,
            status: "pass",
            failed_gates: [],
            summary: "all publish-ready gates passed",
          },
        },
      }),
    });

    const run = await runSvc.create({
      companyId,
      projectId,
      topic: "Live canary topic",
      lane: "publish",
      publishMode: "publish",
      contextJson: {
        title: "Live canary title",
        article_html: "<p>Live canary body</p>",
        publishReadyGateCanary: true,
      },
    });

    expect(run?.contextJson).toMatchObject({
      publishReadyGateCanary: true,
      publishReadyGateMode: "strict",
    });

    for (let i = 0; i < 7; i += 1) {
      await worker.runNext(run!.id);
    }

    let detail = await runSvc.getDetail(run!.id);
    expect(detail?.run.status).toBe("publish_approval_pending");

    await runSvc.requestPublishApproval(run!.id, {
      targetSlug: "live-canary-title",
      artifactHash: "artifact-hash",
      normalizedDomHash: "dom-hash",
      approvalKeyHash: "approval-hash",
      publishIdempotencyKey: "publish-key-live-canary",
      approvedByUserId: "operator",
    });

    await worker.runNext(run!.id);
    await worker.runNext(run!.id);

    detail = await runSvc.getDetail(run!.id);
    expect(detail?.run.status).toBe("public_verified");
    expect(detail?.run.wordpressPostId).toBe(980);
  });
});
