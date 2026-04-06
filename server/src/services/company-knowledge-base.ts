/**
 * Writes local, company-scoped knowledge snapshots for agents to reuse.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveServerRepoRoot } from "./repo-root.js";

type JsonRecord = Record<string, unknown>;

export interface OfficelyKnowledgeSnapshotExportInput {
  companyId: string;
  companyName: string;
  workspaceKey: string | null;
  connectorRows: Array<{
    kind: string;
    status: string;
    displayName: string;
    configSummary: string | null;
    lastSyncAt: Date | null;
    updatedAt: Date;
  }>;
  operatingSnapshot: JsonRecord;
  profiles: unknown[];
  insights: unknown[];
  payload: unknown;
  counts: {
    internalAccounts: number;
    xeroInvoices: number;
    xeroCashReceipts: number;
    stripeEvents: number;
    posthogAccounts: number;
  };
}

export interface KnowledgeSnapshotExportResult {
  absolutePath: string;
  relativePath: string;
  latestAbsolutePath: string;
  latestRelativePath: string;
}

function slugifySegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "company";
}

function resolveKnowledgeBaseRoot() {
  const override = process.env.PAPERCLIP_COMPANY_KB_DIR?.trim();
  if (override) return path.resolve(override);
  return path.join(resolveServerRepoRoot(), ".context", "company-kb");
}

function isoFileStamp(now: Date) {
  return now.toISOString().replace(/[:.]/g, "-");
}

export async function writeOfficelyKnowledgeSnapshot(
  input: OfficelyKnowledgeSnapshotExportInput,
): Promise<KnowledgeSnapshotExportResult> {
  const companyKey = slugifySegment(input.workspaceKey ?? input.companyName ?? input.companyId);
  const baseDir = path.join(resolveKnowledgeBaseRoot(), "companies", companyKey, "raw", "sources", "app-db");
  await mkdir(baseDir, { recursive: true });

  const now = new Date();
  const snapshot = {
    schemaVersion: 1,
    snapshotType: "officely_sync",
    generatedAt: now.toISOString(),
    company: {
      id: input.companyId,
      name: input.companyName,
      workspaceKey: input.workspaceKey,
    },
    counts: {
      ...input.counts,
      customerProfiles: input.profiles.length,
      insightCards: input.insights.length,
    },
    connectorStatuses: input.connectorRows.map((row) => ({
      kind: row.kind,
      status: row.status,
      displayName: row.displayName,
      configSummary: row.configSummary,
      lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    })),
    operatingSnapshot: input.operatingSnapshot,
    customerProfiles: input.profiles,
    insightCards: input.insights,
    syncPayload: input.payload,
  };

  const versionedFilename = `${isoFileStamp(now)}-officely-sync-snapshot.json`;
  const latestFilename = "latest-officely-sync-snapshot.json";
  const absolutePath = path.join(baseDir, versionedFilename);
  const latestAbsolutePath = path.join(baseDir, latestFilename);
  const body = `${JSON.stringify(snapshot, null, 2)}\n`;

  await writeFile(absolutePath, body, "utf8");
  await writeFile(latestAbsolutePath, body, "utf8");

  return {
    absolutePath,
    relativePath: path.relative(resolveServerRepoRoot(), absolutePath),
    latestAbsolutePath,
    latestRelativePath: path.relative(resolveServerRepoRoot(), latestAbsolutePath),
  };
}
