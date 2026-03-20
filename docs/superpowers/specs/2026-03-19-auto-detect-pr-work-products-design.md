# Auto-Detect PR Work Products from Agent Runs

## Summary

Automatically detect when a Claude-local agent creates a pull request during a run by parsing the streaming stdout for PR URLs. Create work products in real-time so PR badges appear in the UI while the agent is still running.

## Context

- Agents run via the heartbeat service in `server/src/services/heartbeat.ts`, which constructs an `onLog` callback that streams stdout/stderr chunks
- Claude-local is invoked with `--output-format stream-json`, so stdout contains raw JSON lines. PR URLs appear as string values embedded within JSON structures (e.g., inside tool result content). A simple regex scan of the raw text will match URL substrings within JSON string values
- The work products API (`POST /issues/:id/work-products`) exists and the UI already renders PR badges from work products (implemented in the previous feature)
- Currently nothing calls the work products API — agents create PRs but Paperclip doesn't know about them

## Approach

Add a detection layer in the heartbeat `onLog` path that parses stdout chunks for PR URLs, deduplicates, and creates work products via the existing `workProductService`.

## New File: `server/src/services/work-product-detection.ts`

### `extractPrUrls(text: string)`

Pure function that scans text for PR/MR URLs and returns structured matches.

**Patterns matched:**
- GitHub: `https://github.com/{owner}/{repo}/pull/{number}`
- GitLab: `https://gitlab.com/{owner}/{repo}/-/merge_requests/{number}`

**Returns:** `Array<{ url: string; provider: "github" | "gitlab"; owner: string; repo: string; number: string }>`

**Known limitation:** OS pipe chunks do not align with newline boundaries, so a URL could theoretically be split across two chunks. This is accepted as a rare edge case — the URL will typically appear again in a later `result`-type event in the stream.

### `createPrWorkProductIfNew(params)`

Accepts:
- `issueId`, `companyId`, `runId` — from run context
- `pr` — extracted PR info (url, provider, number, owner, repo)
- `seenUrls` — `Set<string>` maintained per run for in-memory dedup
- `workProductsSvc` — the work product service instance

Logic:
1. If `pr.url` is already in `seenUrls`, skip (same URL seen earlier in this run's output)
2. Add `pr.url` to `seenUrls`
3. Query existing work products for this issue to check if one with the same `url` already exists (covers re-runs, resumed sessions)
4. If not found, create a work product with:
   - `type`: `"pull_request"`
   - `provider`: `"github"` or `"gitlab"`
   - `externalId`: PR number as string (e.g., `"47"`)
   - `title`: `"{owner}/{repo}#{number}"`
   - `url`: full PR URL
   - `status`: `"active"`
   - `isPrimary`: `true` if this is the first PR work product on the issue, `false` otherwise
   - `createdByRunId`: current run ID
   - Fields `reviewState`, `healthStatus`, and `metadata` are omitted — they use database defaults (`"none"`, `"unknown"`, `null`)

### `detectPrFromLogChunk(chunk, context)`

Entry point called from heartbeat. Combines `extractPrUrls` + `createPrWorkProductIfNew`.

Accepts:
- `chunk` — the stdout text
- `context` — `{ issueId, companyId, runId, seenUrls, workProductsSvc }`

Calls `extractPrUrls` on the chunk, then `createPrWorkProductIfNew` for each match. Errors are caught and logged — detection failures must never break the run.

## Modified File: `server/src/services/heartbeat.ts`

In `executeRun`, where `onLog` is constructed:

1. Import `detectPrFromLogChunk` from `./work-product-detection.js`
2. Import `workProductService` from `./work-products.js` and instantiate `const workProductsSvc = workProductService(db)` in the `heartbeatService` factory alongside existing service instantiations
3. Create a `seenUrls = new Set<string>()` before the run starts
4. The adapter type guard (`agent.adapterType === "claude_local"`) and the issue guard (`issueId !== null`) are evaluated **once** when constructing `onLog`, not on every chunk. If either is false, detection is not wired in at all
5. In the `onLog` callback, after the existing log-append and live-event-publish logic, for `stdout` chunks only, call `detectPrFromLogChunk(chunk, context)` without awaiting it (fire-and-forget to avoid slowing the log stream)

The context (`issueId`, `companyId`, `runId`) is already available in the `executeRun` scope. `workProductsSvc` must be added (see step 2). Runs without an associated issue skip PR detection entirely.

## Deduplication Strategy

Two layers:
1. **In-memory per-run**: `Set<string>` of URLs seen in the current run's output. Avoids repeated DB queries when the same PR URL appears multiple times in agent output (common — agent may reference the PR URL in subsequent messages).
2. **Database check**: Before creating, query `workProductsSvc.listForIssue(issueId)` and check if any existing work product has a matching `url`. Covers cases where a previous run already registered the same PR.

## Error Handling

All detection logic is wrapped in try/catch. Failures are logged as warnings but never propagate — a detection failure must not affect the agent run.

## Files Changed

| File | Change |
|------|--------|
| `server/src/services/work-product-detection.ts` | New file — extraction, dedup, creation logic |
| `server/src/services/heartbeat.ts` | Hook detection into `onLog` callback for claude_local stdout |

## Out of Scope

- Updating PR status after creation (open → merged → closed)
- Detecting PRs from non-claude-local adapters
- Detecting branch pushes without PR creation
- GitHub API integration (we parse stdout only)
- GitLab self-hosted URL detection (only gitlab.com)
- GitHub Enterprise URL detection (only github.com)
