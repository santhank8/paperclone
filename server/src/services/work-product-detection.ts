import { logger } from "../middleware/logger.js";
import type { IssueWorkProduct } from "@paperclipai/shared";

export interface ExtractedPr {
  url: string;
  provider: "github" | "gitlab";
  owner: string;
  repo: string;
  number: string;
}

const PR_URL_PATTERNS = [
  // GitHub: https://github.com/{owner}/{repo}/pull/{number}
  /https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)/g,
  // GitLab: https://gitlab.com/{group}[/{subgroup}...]/{repo}/-/merge_requests/{number}
  /https:\/\/gitlab\.com\/([\w.-]+)\/([\w.-]+(?:\/[\w.-]+)*)\/-\/merge_requests\/(\d+)/g,
];

export function extractPrUrls(text: string): ExtractedPr[] {
  const seen = new Set<string>();
  const results: ExtractedPr[] = [];

  for (const pattern of PR_URL_PATTERNS) {
    // Reset lastIndex since we reuse the regex with /g flag
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const url = match[0];
      if (seen.has(url)) continue;
      seen.add(url);
      const provider = url.includes("github.com") ? "github" : "gitlab";
      results.push({
        url,
        provider,
        owner: match[1],
        repo: match[2],
        number: match[3],
      });
    }
  }

  return results;
}

interface CreatePrWorkProductData {
  type: string;
  provider: string;
  externalId?: string | null;
  title: string;
  url?: string | null;
  status: string;
  isPrimary?: boolean;
  createdByRunId?: string | null;
  healthStatus?: string;
  reviewState?: string;
}

export interface PrDetectionContext {
  issueId: string;
  companyId: string;
  runId: string;
  seenUrls: Set<string>;
  workProductsSvc: {
    listForIssue: (issueId: string) => Promise<IssueWorkProduct[]>;
    createForIssue: (
      issueId: string,
      companyId: string,
      data: CreatePrWorkProductData,
    ) => Promise<IssueWorkProduct | null>;
  };
}

export async function createPrWorkProductIfNew(params: {
  issueId: string;
  companyId: string;
  runId: string;
  pr: ExtractedPr;
  seenUrls: Set<string>;
  workProductsSvc: PrDetectionContext["workProductsSvc"];
}): Promise<void> {
  const { issueId, companyId, runId, pr, seenUrls, workProductsSvc } = params;

  // In-memory dedup: skip if already seen in this run
  if (seenUrls.has(pr.url)) return;
  seenUrls.add(pr.url);

  // DB dedup: check if a work product with this URL already exists
  const existing = await workProductsSvc.listForIssue(issueId);
  if (existing.some((wp) => wp.url === pr.url)) return;

  const hasPrAlready = existing.some((wp) => wp.type === "pull_request");

  await workProductsSvc.createForIssue(issueId, companyId, {
    type: "pull_request",
    provider: pr.provider,
    externalId: pr.number,
    title: `${pr.owner}/${pr.repo}#${pr.number}`,
    url: pr.url,
    status: "active",
    isPrimary: !hasPrAlready,
    createdByRunId: runId,
    healthStatus: "unknown",
    reviewState: "none",
  });
}

export async function detectPrFromLogChunk(
  chunk: string,
  context: PrDetectionContext,
): Promise<void> {
  try {
    const prs = extractPrUrls(chunk);
    for (const pr of prs) {
      await createPrWorkProductIfNew({
        issueId: context.issueId,
        companyId: context.companyId,
        runId: context.runId,
        pr,
        seenUrls: context.seenUrls,
        workProductsSvc: context.workProductsSvc,
      });
    }
  } catch (err) {
    logger.warn({ err }, "PR work product detection failed (non-fatal)");
  }
}
