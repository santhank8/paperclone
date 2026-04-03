import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { companies } from "./companies.js";
import { issues } from "./issues.js";
import { projects } from "./projects.js";

export const blogRuns = pgTable(
  "blog_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    topic: text("topic").notNull(),
    lane: text("lane").notNull().default("publish"),
    targetSite: text("target_site").notNull().default("fluxaivory.com"),
    status: text("status").notNull().default("queued"),
    currentStep: text("current_step"),
    approvalMode: text("approval_mode").notNull().default("manual"),
    publishMode: text("publish_mode").notNull().default("draft"),
    wordpressPostId: bigint("wordpress_post_id", { mode: "number" }),
    publishedUrl: text("published_url"),
    approvalKeyHash: text("approval_key_hash"),
    publishIdempotencyKey: text("publish_idempotency_key"),
    contextJson: jsonb("context_json").$type<Record<string, unknown>>(),
    failedReason: text("failed_reason"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyStatusIdx: index("blog_runs_company_status_idx").on(table.companyId, table.status),
    companyProjectCreatedIdx: index("blog_runs_company_project_created_idx").on(
      table.companyId,
      table.projectId,
      table.createdAt,
    ),
    issueIdx: index("blog_runs_issue_idx").on(table.issueId),
    publishIdempotencyIdx: uniqueIndex("blog_runs_publish_idempotency_uq").on(table.publishIdempotencyKey),
  }),
);

export const blogRunStepAttempts = pgTable(
  "blog_run_step_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blogRunId: uuid("blog_run_id").notNull().references(() => blogRuns.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    stepKey: text("step_key").notNull(),
    attemptNumber: integer("attempt_number").notNull().default(1),
    status: text("status").notNull().default("queued"),
    workerAgentId: uuid("worker_agent_id").references(() => agents.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    resultJson: jsonb("result_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runStepAttemptUq: uniqueIndex("blog_run_step_attempts_run_step_attempt_uq").on(
      table.blogRunId,
      table.stepKey,
      table.attemptNumber,
    ),
    companyStatusIdx: index("blog_run_step_attempts_company_status_idx").on(table.companyId, table.status),
    runStepIdx: index("blog_run_step_attempts_run_step_idx").on(table.blogRunId, table.stepKey),
  }),
);

export const blogArtifacts = pgTable(
  "blog_artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blogRunId: uuid("blog_run_id").notNull().references(() => blogRuns.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    stepAttemptId: uuid("step_attempt_id").references(() => blogRunStepAttempts.id, { onDelete: "set null" }),
    stepKey: text("step_key").notNull(),
    artifactKind: text("artifact_kind").notNull(),
    contentType: text("content_type").notNull(),
    storageKind: text("storage_kind").notNull().default("local_fs"),
    storagePath: text("storage_path"),
    bodyPreview: text("body_preview"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runStepIdx: index("blog_artifacts_run_step_idx").on(table.blogRunId, table.stepKey),
    companyArtifactIdx: index("blog_artifacts_company_kind_idx").on(table.companyId, table.artifactKind),
  }),
);

export const blogPublishApprovals = pgTable(
  "blog_publish_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blogRunId: uuid("blog_run_id").notNull().references(() => blogRuns.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    targetSlug: text("target_slug").notNull(),
    siteId: text("site_id").notNull().default("fluxaivory.com"),
    artifactHash: text("artifact_hash").notNull(),
    normalizedDomHash: text("normalized_dom_hash").notNull(),
    policyVersion: text("policy_version").notNull().default("publish-gateway-v1"),
    approvalKeyHash: text("approval_key_hash").notNull(),
    approvalPayload: jsonb("approval_payload").$type<Record<string, unknown>>(),
    approvedByAgentId: uuid("approved_by_agent_id").references(() => agents.id, { onDelete: "set null" }),
    approvedByUserId: text("approved_by_user_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: text("revocation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runApprovalKeyUq: uniqueIndex("blog_publish_approvals_run_key_uq").on(table.blogRunId, table.approvalKeyHash),
    activeApprovalIdx: index("blog_publish_approvals_run_revoked_idx").on(table.blogRunId, table.revokedAt),
    companyApprovedIdx: index("blog_publish_approvals_company_approved_idx").on(table.companyId, table.approvedAt),
  }),
);

export const blogPublishExecutions = pgTable(
  "blog_publish_executions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    blogRunId: uuid("blog_run_id").notNull().references(() => blogRuns.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    approvalId: uuid("approval_id").notNull().references(() => blogPublishApprovals.id, { onDelete: "cascade" }),
    siteId: text("site_id").notNull(),
    targetSlug: text("target_slug").notNull(),
    publishIdempotencyKey: text("publish_idempotency_key").notNull(),
    wordpressPostId: bigint("wordpress_post_id", { mode: "number" }),
    publishedUrl: text("published_url"),
    resultJson: jsonb("result_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    publishIdempotencyUq: uniqueIndex("blog_publish_executions_idempotency_uq").on(table.publishIdempotencyKey),
    runIdx: index("blog_publish_executions_run_idx").on(table.blogRunId),
    approvalIdx: index("blog_publish_executions_approval_idx").on(table.approvalId),
  }),
);
