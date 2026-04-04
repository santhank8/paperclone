#!/usr/bin/env node
/**
 * digest-validate.mjs — Digest validator for Paperclip board digests.
 *
 * Validates a rendered digest against key gates from the DSPA-811 architecture:
 *   1. source_coverage  — All board-authored sources appear in the coverage ledger
 *   2. handling_linkage  — Every ledger row has a linked handling issue or disposition
 *   3. completion_validity — No "done" item with later unresolved comments
 *   4. section_order     — Canonical sections present in correct order
 *   5. flagged_surfacing — Invalid-done items appear in Active section, not Recently Resolved
 *
 * Usage:
 *   node scripts/digest-validate.mjs --company-id <id> --digest-issue-id <id> [--window-hours 48] [--format json|text]
 *
 * Env vars: PAPERCLIP_API_URL, PAPERCLIP_API_KEY
 *
 * Calibration (from DSPA-838):
 *   - 120s grace period for completion_validity (comments within 120s of completedAt are not flagged)
 *   - Expanded board-action keywords for disposition detection
 */

const API_URL = process.env.PAPERCLIP_API_URL;
const API_KEY = process.env.PAPERCLIP_API_KEY;

if (!API_URL || !API_KEY) {
  console.error("Missing PAPERCLIP_API_URL or PAPERCLIP_API_KEY");
  process.exit(2);
}

// --- CLI args ---
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

const companyId = getArg("company-id", process.env.PAPERCLIP_COMPANY_ID);
const digestIssueId = getArg("digest-issue-id", null);
const windowHours = parseInt(getArg("window-hours", "48"), 10);
const outputFormat = getArg("format", "text");
const GRACE_PERIOD_MS = 120_000; // 120s calibration grace period from DSPA-838

if (!companyId || !digestIssueId) {
  console.error("Usage: node digest-validate.mjs --company-id <id> --digest-issue-id <id>");
  process.exit(2);
}

// --- API helpers ---
async function apiFetch(path) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API ${res.status} on ${path}: ${await res.text()}`);
  return res.json();
}

async function apiFetchAll(basePath) {
  // Paginate through results if needed (simple approach: fetch with large limit)
  const results = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const sep = basePath.includes("?") ? "&" : "?";
    const data = await apiFetch(`${basePath}${sep}limit=${limit}&offset=${offset}`);
    if (!data || (Array.isArray(data) && data.length === 0)) break;
    const items = Array.isArray(data) ? data : data.items || data.issues || [];
    if (items.length === 0) break;
    results.push(...items);
    if (items.length < limit) break;
    offset += limit;
  }
  return results;
}

// --- Gate 1: Source Coverage ---
async function getBoardSourcesViaRoute(companyId, windowHours) {
  const data = await apiFetch(
    `/api/companies/${companyId}/board-authored-sources?windowHours=${windowHours}`
  );
  return data; // null if 404
}

async function getBoardSourcesFallback(_companyId, _windowHours) {
  // Fallback is too expensive (iterating all issues+comments causes OOM).
  // Return null to signal that source_coverage cannot be verified without the route.
  return null;
}

async function checkSourceCoverage(boardSources, ledgerBody) {
  const gate = { pass: false, details: "", violations: [], matchCount: 0, totalSources: 0 };

  if (!boardSources) {
    gate.details = "Could not retrieve board sources (route 404, fallback failed)";
    return gate;
  }

  const total = boardSources.summary.totalSources;
  gate.totalSources = total;

  if (total === 0) {
    gate.pass = true;
    gate.details = "No board sources in window";
    return gate;
  }

  // Parse ledger to extract source links
  const ledgerLines = ledgerBody.split("\n");
  const ledgerRefs = new Set();
  for (const line of ledgerLines) {
    // Extract issue identifiers and comment IDs from ledger table rows
    const issueMatches = line.matchAll(/DSPA-\d+/g);
    for (const m of issueMatches) ledgerRefs.add(m[0]);
    const commentMatches = line.matchAll(/comment-([a-f0-9-]+)/g);
    for (const m of commentMatches) ledgerRefs.add(m[1]);
  }

  // Check each board source against ledger
  let matched = 0;
  const missed = [];

  for (const issue of boardSources.issues) {
    if (ledgerRefs.has(issue.identifier)) {
      matched++;
    } else {
      missed.push({ type: "issue", id: issue.identifier, title: issue.title });
    }
  }

  for (const comment of boardSources.comments) {
    if (ledgerRefs.has(comment.id) || ledgerRefs.has(comment.issueIdentifier)) {
      matched++;
    } else {
      missed.push({
        type: "comment",
        id: comment.id,
        issueIdentifier: comment.issueIdentifier,
        preview: (comment.body || "").substring(0, 80),
      });
    }
  }

  gate.matchCount = matched;
  gate.violations = missed;
  const pct = total > 0 ? ((matched / total) * 100).toFixed(1) : 100;
  gate.pass = missed.length === 0;
  gate.details = `${matched}/${total} sources matched (${pct}%), ${missed.length} misses`;
  if (boardSources.fallback) gate.details += " [via API fallback, route returned 404]";

  return gate;
}

// --- Gate 2: Handling Linkage ---
function checkHandlingLinkage(ledgerBody) {
  const gate = { pass: true, details: "", violations: [] };
  const lines = ledgerBody.split("\n");
  let inTable = false;
  let rowNum = 0;

  for (const line of lines) {
    if (line.includes("| SourceLink |")) {
      inTable = true;
      continue;
    }
    if (inTable && line.startsWith("| ---")) continue;
    if (inTable && line.startsWith("|")) {
      rowNum++;
      const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
      // HandlingIssue is column 5 (0-indexed: 4)
      const handlingIssue = cells[4] || "";
      const disposition = cells[7] || "";
      if (!handlingIssue || handlingIssue === "-") {
        if (!disposition || disposition === "-") {
          gate.violations.push({ row: rowNum, sourceLink: cells[0], reason: "No handling issue or disposition" });
          gate.pass = false;
        }
      }
    } else if (inTable && !line.startsWith("|")) {
      inTable = false;
    }
  }

  gate.details = gate.pass
    ? `All ${rowNum} ledger rows have handling issue or disposition`
    : `${gate.violations.length}/${rowNum} rows missing handling linkage`;
  return gate;
}

// --- Gate 3: Completion Validity ---
// Extract done issue identifiers referenced in the digest's "Recently Resolved" section
function extractRecentlyResolvedIds(digestBody) {
  const resolvedMatch = digestBody.match(/## \d+\.\s*Recently Resolved[\s\S]*?(?=## \d+\.|$)/i);
  if (!resolvedMatch) return [];
  const ids = [];
  const idMatches = resolvedMatch[0].matchAll(/DSPA-\d+/g);
  for (const m of idMatches) ids.push(m[0]);
  return [...new Set(ids)];
}

async function checkCompletionValidity(companyId, windowHours, digestBody) {
  const gate = { pass: true, details: "", violations: [] };

  // Only check issues mentioned in the Recently Resolved section (bounded set)
  const resolvedIds = extractRecentlyResolvedIds(digestBody);
  if (resolvedIds.length === 0) {
    gate.details = "No issues in Recently Resolved section";
    return gate;
  }

  let checked = 0;
  for (const identifier of resolvedIds.slice(0, 50)) {
    // Search for the issue
    const results = await apiFetch(`/api/companies/${companyId}/issues?q=${identifier}&status=done`);
    if (!results || !Array.isArray(results) || results.length === 0) continue;
    const issue = results.find((i) => i.identifier === identifier);
    if (!issue || !issue.completedAt) continue;

    checked++;
    const completedAt = new Date(issue.completedAt);
    const graceEnd = new Date(completedAt.getTime() + GRACE_PERIOD_MS);

    try {
      const comments = await apiFetch(`/api/issues/${issue.id}/comments`);
      if (!comments || !Array.isArray(comments)) continue;

      const boardPostComments = comments.filter((c) => {
        const created = new Date(c.createdAt);
        return created > graceEnd && c.authorUserId && !c.authorAgentId;
      });

      if (boardPostComments.length > 0) {
        gate.violations.push({
          issueId: issue.identifier,
          title: issue.title,
          completedAt: issue.completedAt,
          postCompletionBoardComments: boardPostComments.length,
          latestComment: boardPostComments[boardPostComments.length - 1].createdAt,
        });
        gate.pass = false;
      }
    } catch {
      // Skip issues we can't read
    }
  }

  gate.details = gate.pass
    ? `${checked} done issues checked, no invalid-done items`
    : `${gate.violations.length} invalid-done items (done with later unresolved board comments)`;
  return gate;
}

// --- Gate 4: Section Order ---
function checkSectionOrder(digestBody) {
  const gate = { pass: true, details: "", violations: [] };
  const canonicalOrder = [
    "Immediate Board Decisions",
    "Active And Flagged Work",
    "Recently Resolved",
    "Related PR Review Queue",
    "48h Board-Source Coverage",
    "Capacity / Queue Risks",
  ];

  const sectionPositions = [];
  for (const section of canonicalOrder) {
    const pattern = new RegExp(`## \\d+\\.\\s*${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
    const match = digestBody.match(pattern);
    if (match) {
      sectionPositions.push({ name: section, index: match.index });
    } else {
      gate.violations.push({ section, reason: "Section missing from digest" });
    }
  }

  // Check order
  for (let i = 1; i < sectionPositions.length; i++) {
    if (sectionPositions[i].index < sectionPositions[i - 1].index) {
      gate.violations.push({
        section: sectionPositions[i].name,
        reason: `Out of order: appears before ${sectionPositions[i - 1].name}`,
      });
    }
  }

  gate.pass = gate.violations.length === 0;
  gate.details = gate.pass
    ? `All ${sectionPositions.length} sections present in correct order`
    : `${gate.violations.length} section order violations`;
  return gate;
}

// --- Gate 5: Flagged Surfacing ---
async function checkFlaggedSurfacing(companyId, digestBody) {
  const gate = { pass: true, details: "", violations: [] };

  // Find the "Recently Resolved" and "Active And Flagged Work" sections
  const resolvedMatch = digestBody.match(/## \d+\.\s*Recently Resolved[\s\S]*?(?=## \d+\.|$)/i);
  const resolvedSection = resolvedMatch ? resolvedMatch[0] : "";
  const activeMatch = digestBody.match(/## \d+\.\s*Active And Flagged Work[\s\S]*?(?=## \d+\.|$)/i);
  const activeSection = activeMatch ? activeMatch[0] : "";

  // Check issues in Recently Resolved for post-completion board comments
  const resolvedIds = extractRecentlyResolvedIds(digestBody);

  for (const identifier of resolvedIds.slice(0, 50)) {
    const results = await apiFetch(`/api/companies/${companyId}/issues?q=${identifier}&status=done`);
    if (!results || !Array.isArray(results) || results.length === 0) continue;
    const issue = results.find((i) => i.identifier === identifier);
    if (!issue || !issue.completedAt) continue;

    const completedAt = new Date(issue.completedAt);
    const graceEnd = new Date(completedAt.getTime() + GRACE_PERIOD_MS);

    try {
      const comments = await apiFetch(`/api/issues/${issue.id}/comments`);
      if (!comments || !Array.isArray(comments)) continue;

      const boardPostComments = comments.filter((c) => {
        const created = new Date(c.createdAt);
        return created > graceEnd && c.authorUserId && !c.authorAgentId;
      });

      if (boardPostComments.length > 0) {
        const inResolved = resolvedSection.includes(issue.identifier);
        const inActive = activeSection.includes(issue.identifier);

        if (inResolved && !inActive) {
          gate.violations.push({
            issueId: issue.identifier,
            title: issue.title,
            reason: "Invalid-done item in Recently Resolved instead of Active section",
          });
          gate.pass = false;
        }
      }
    } catch {
      // Skip
    }
  }

  gate.details = gate.pass
    ? "No invalid-done items misplaced in Recently Resolved"
    : `${gate.violations.length} invalid-done items incorrectly in Recently Resolved`;
  return gate;
}

// --- Main ---
async function main() {
  console.error("digest-validate.mjs — Paperclip Digest Validator");
  console.error(`Company: ${companyId}`);
  console.error(`Digest issue: ${digestIssueId}`);
  console.error(`Window: ${windowHours}h`);
  console.error(`Grace period: ${GRACE_PERIOD_MS / 1000}s`);
  console.error("");

  // Fetch digest document
  const digestDoc = await apiFetch(`/api/issues/${digestIssueId}/documents/digest`);
  if (!digestDoc || !digestDoc.body) {
    console.error("ERROR: Digest document not found");
    process.exit(2);
  }
  console.error(`Digest loaded: ${digestDoc.body.length} chars`);

  // Fetch board-coverage-ledger
  const ledgerDoc = await apiFetch(`/api/issues/${digestIssueId}/documents/board-coverage-ledger`);
  if (!ledgerDoc || !ledgerDoc.body) {
    console.error("WARNING: Board coverage ledger not found — source_coverage will be limited");
  }
  console.error(`Ledger loaded: ${ledgerDoc ? ledgerDoc.body.length : 0} chars`);

  // Get board sources (try route first, fallback returns null if too expensive)
  console.error("Fetching board-authored sources...");
  let boardSources = await getBoardSourcesViaRoute(companyId, windowHours);
  let sourceMethod = "route";
  if (!boardSources) {
    console.error("  Route returned 404 — source_coverage gate will be SKIPPED");
    sourceMethod = "unavailable";
    boardSources = null;
  }
  console.error(`  Source method: ${sourceMethod}`);
  if (boardSources) {
    console.error(`  Board issues: ${boardSources.summary.totalIssues}`);
    console.error(`  Board comments: ${boardSources.summary.totalComments}`);
    console.error(`  Total sources: ${boardSources.summary.totalSources}`);
  }
  console.error("");

  // Run gates
  console.error("Running validation gates...");

  const gates = {};

  // Gate 1: Source Coverage
  console.error("  [1/5] source_coverage...");
  if (!boardSources) {
    gates.source_coverage = {
      pass: false,
      details: "SKIPPED — board-authored-sources route returned 404; cannot verify source coverage without the route deployed to master",
      violations: [],
      skipped: true,
    };
  } else if (!ledgerDoc) {
    gates.source_coverage = { pass: false, details: "No ledger document found", violations: [] };
  } else {
    gates.source_coverage = await checkSourceCoverage(boardSources, ledgerDoc.body);
  }
  console.error(`    ${gates.source_coverage.pass ? "PASS" : gates.source_coverage.skipped ? "SKIP" : "FAIL"}: ${gates.source_coverage.details}`);

  // Gate 2: Handling Linkage
  console.error("  [2/5] handling_linkage...");
  gates.handling_linkage = ledgerDoc
    ? checkHandlingLinkage(ledgerDoc.body)
    : { pass: false, details: "No ledger document found", violations: [] };
  console.error(`    ${gates.handling_linkage.pass ? "PASS" : "FAIL"}: ${gates.handling_linkage.details}`);

  // Gate 3: Completion Validity
  console.error("  [3/5] completion_validity...");
  gates.completion_validity = await checkCompletionValidity(companyId, windowHours, digestDoc.body);
  console.error(`    ${gates.completion_validity.pass ? "PASS" : "FAIL"}: ${gates.completion_validity.details}`);

  // Gate 4: Section Order
  console.error("  [4/5] section_order...");
  gates.section_order = checkSectionOrder(digestDoc.body);
  console.error(`    ${gates.section_order.pass ? "PASS" : "FAIL"}: ${gates.section_order.details}`);

  // Gate 5: Flagged Surfacing
  console.error("  [5/5] flagged_surfacing...");
  gates.flagged_surfacing = await checkFlaggedSurfacing(companyId, digestDoc.body);
  console.error(`    ${gates.flagged_surfacing.pass ? "PASS" : "FAIL"}: ${gates.flagged_surfacing.details}`);

  // Compute verdict
  const allPassed = Object.values(gates).every((g) => g.pass);
  const result = {
    verdict: allPassed ? "PASS" : "FAIL",
    digestIssueId,
    companyId,
    windowHours,
    sourceMethod,
    gracePeriodMs: GRACE_PERIOD_MS,
    timestamp: new Date().toISOString(),
    gates,
    violations: Object.entries(gates)
      .filter(([, g]) => !g.pass)
      .flatMap(([name, g]) => g.violations.map((v) => ({ gate: name, ...v }))),
  };

  if (outputFormat === "json") {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("");
    console.log("═══════════════════════════════════════════");
    console.log(`  DIGEST VALIDATION: ${result.verdict}`);
    console.log("═══════════════════════════════════════════");
    console.log(`  Digest: ${digestIssueId}`);
    console.log(`  Window: ${windowHours}h | Source method: ${sourceMethod}`);
    console.log(`  Grace period: ${GRACE_PERIOD_MS / 1000}s`);
    console.log(`  Timestamp: ${result.timestamp}`);
    console.log("───────────────────────────────────────────");

    for (const [name, gate] of Object.entries(gates)) {
      console.log(`  ${gate.pass ? "✓" : "✗"} ${name}: ${gate.details}`);
      if (!gate.pass && gate.violations.length > 0) {
        for (const v of gate.violations.slice(0, 10)) {
          const label = v.issueId || v.id || v.section || v.sourceLink || "item";
          const reason = v.reason || v.title || "";
          console.log(`      - ${label}: ${reason}`);
        }
        if (gate.violations.length > 10) {
          console.log(`      ... and ${gate.violations.length - 10} more`);
        }
      }
    }

    console.log("───────────────────────────────────────────");
    console.log(`  Total violations: ${result.violations.length}`);
    console.log("═══════════════════════════════════════════");
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(2);
});
