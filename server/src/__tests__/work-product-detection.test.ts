import { describe, expect, it, vi } from "vitest";
import {
  extractPrUrls,
  createPrWorkProductIfNew,
  detectPrFromLogChunk,
  type ExtractedPr,
} from "../services/work-product-detection.ts";

describe("extractPrUrls", () => {
  it("extracts GitHub PR URL", () => {
    const text = "Created PR: https://github.com/paperclipai/paperclip/pull/47";
    const results = extractPrUrls(text);
    expect(results).toEqual([
      {
        url: "https://github.com/paperclipai/paperclip/pull/47",
        provider: "github",
        owner: "paperclipai",
        repo: "paperclip",
        number: "47",
      },
    ]);
  });

  it("extracts GitLab MR URL", () => {
    const text = "MR: https://gitlab.com/org/repo/-/merge_requests/123";
    const results = extractPrUrls(text);
    expect(results).toEqual([
      {
        url: "https://gitlab.com/org/repo/-/merge_requests/123",
        provider: "gitlab",
        owner: "org",
        repo: "repo",
        number: "123",
      },
    ]);
  });

  it("extracts multiple URLs from one chunk", () => {
    const text =
      "PR1: https://github.com/a/b/pull/1 and PR2: https://github.com/c/d/pull/2";
    expect(extractPrUrls(text)).toHaveLength(2);
  });

  it("returns empty array for text without PR URLs", () => {
    expect(extractPrUrls("just some log output")).toEqual([]);
  });

  it("handles URL embedded in JSON string", () => {
    const text = '{"content":"https://github.com/org/repo/pull/99"}';
    const results = extractPrUrls(text);
    expect(results).toHaveLength(1);
    expect(results[0].number).toBe("99");
  });

  it("deduplicates same URL appearing twice in one chunk", () => {
    const text =
      "https://github.com/a/b/pull/5 then again https://github.com/a/b/pull/5";
    expect(extractPrUrls(text)).toHaveLength(1);
  });

  it("handles nested GitHub org/repo paths", () => {
    const text = "https://github.com/my-org/my-repo/pull/100";
    const results = extractPrUrls(text);
    expect(results[0].owner).toBe("my-org");
    expect(results[0].repo).toBe("my-repo");
  });
});

describe("createPrWorkProductIfNew", () => {
  const pr: ExtractedPr = {
    url: "https://github.com/org/repo/pull/42",
    provider: "github",
    owner: "org",
    repo: "repo",
    number: "42",
  };

  it("skips if URL already in seenUrls", async () => {
    const seenUrls = new Set(["https://github.com/org/repo/pull/42"]);
    const listForIssue = vi.fn();
    const createForIssue = vi.fn();
    const svc = { listForIssue, createForIssue } as any;

    await createPrWorkProductIfNew({
      issueId: "issue-1",
      companyId: "company-1",
      runId: "run-1",
      pr,
      seenUrls,
      workProductsSvc: svc,
    });

    expect(listForIssue).not.toHaveBeenCalled();
    expect(createForIssue).not.toHaveBeenCalled();
  });

  it("skips if work product with same URL already exists in DB", async () => {
    const seenUrls = new Set<string>();
    const listForIssue = vi.fn().mockResolvedValue([
      { id: "wp-1", type: "pull_request", url: "https://github.com/org/repo/pull/42" },
    ]);
    const createForIssue = vi.fn();
    const svc = { listForIssue, createForIssue } as any;

    await createPrWorkProductIfNew({
      issueId: "issue-1",
      companyId: "company-1",
      runId: "run-1",
      pr,
      seenUrls,
      workProductsSvc: svc,
    });

    expect(seenUrls.has(pr.url)).toBe(true);
    expect(listForIssue).toHaveBeenCalledWith("issue-1");
    expect(createForIssue).not.toHaveBeenCalled();
  });

  it("creates work product when URL is new", async () => {
    const seenUrls = new Set<string>();
    const listForIssue = vi.fn().mockResolvedValue([]);
    const createForIssue = vi.fn().mockResolvedValue({ id: "wp-new" });
    const svc = { listForIssue, createForIssue } as any;

    await createPrWorkProductIfNew({
      issueId: "issue-1",
      companyId: "company-1",
      runId: "run-1",
      pr,
      seenUrls,
      workProductsSvc: svc,
    });

    expect(createForIssue).toHaveBeenCalledWith("issue-1", "company-1", {
      type: "pull_request",
      provider: "github",
      externalId: "42",
      title: "org/repo#42",
      url: "https://github.com/org/repo/pull/42",
      status: "active",
      isPrimary: true,
      createdByRunId: "run-1",
      healthStatus: "unknown",
      reviewState: "none",
    });
  });

  it("sets isPrimary false when issue already has a PR work product", async () => {
    const seenUrls = new Set<string>();
    const listForIssue = vi.fn().mockResolvedValue([
      { id: "wp-1", type: "pull_request", url: "https://github.com/org/repo/pull/10" },
    ]);
    const createForIssue = vi.fn().mockResolvedValue({ id: "wp-new" });
    const svc = { listForIssue, createForIssue } as any;

    await createPrWorkProductIfNew({
      issueId: "issue-1",
      companyId: "company-1",
      runId: "run-1",
      pr,
      seenUrls,
      workProductsSvc: svc,
    });

    expect(createForIssue).toHaveBeenCalledWith(
      "issue-1",
      "company-1",
      expect.objectContaining({ isPrimary: false }),
    );
  });
});

describe("detectPrFromLogChunk", () => {
  it("detects and creates PR from log chunk", async () => {
    const seenUrls = new Set<string>();
    const listForIssue = vi.fn().mockResolvedValue([]);
    const createForIssue = vi.fn().mockResolvedValue({ id: "wp-new" });
    const svc = { listForIssue, createForIssue } as any;

    await detectPrFromLogChunk(
      'Created https://github.com/org/repo/pull/55',
      {
        issueId: "issue-1",
        companyId: "company-1",
        runId: "run-1",
        seenUrls,
        workProductsSvc: svc,
      },
    );

    expect(createForIssue).toHaveBeenCalledTimes(1);
  });

  it("does not throw on error", async () => {
    const seenUrls = new Set<string>();
    const listForIssue = vi.fn().mockRejectedValue(new Error("DB down"));
    const svc = { listForIssue } as any;

    // Should not throw
    await detectPrFromLogChunk(
      "https://github.com/org/repo/pull/1",
      {
        issueId: "issue-1",
        companyId: "company-1",
        runId: "run-1",
        seenUrls,
        workProductsSvc: svc,
      },
    );
  });
});
