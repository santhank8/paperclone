#!/usr/bin/env node

const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const util = require('util');
const execFilePromise = util.promisify(execFile);

const { Client } = require('/Users/daehan/Documents/persona/paperclip/node_modules/.pnpm/node_modules/pg');

const DB_URL = process.env.PAPERCLIP_DB_URL || 'postgres://paperclip:paperclip@127.0.0.1:54329/paperclip';
const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID || 'a900f7fe-3219-4afb-8fc2-6f55dedd5fe8';
const PROJECT_ID = process.env.ARTICLE_LOOP_PROJECT_ID || 'c35ff304-0182-48e5-8bb3-375b191a371d'; // Draft Engine
const TARGET_SITE = process.env.ARTICLE_LOOP_TARGET_SITE || 'fluxaivory.com';
const TOPIC_SCOUT_SCRIPT = process.env.ARTICLE_LOOP_TOPIC_SCOUT_SCRIPT || '/Users/daehan/Documents/persona/paperclip/scripts/obsidian_rss_topic_scout.py';
const RSS_REFRESH_SCRIPT = process.env.ARTICLE_LOOP_RSS_REFRESH_SCRIPT === undefined
  ? '/Users/daehan/Documents/persona/paperclip/scripts/refresh_obsidian_rss_dashboard.py'
  : String(process.env.ARTICLE_LOOP_RSS_REFRESH_SCRIPT).trim();
const BLOG_RUNS_DIR = path.join(os.homedir(), '.paperclip', 'instances', 'default', 'data', 'blog-runs');
const REUSED_RUN_TRACEABILITY_REASON = 'article_quality_loop_bridge';
const TOPIC_COOLDOWN_HOURS = Number(process.env.ARTICLE_LOOP_TOPIC_COOLDOWN_HOURS || 12);
const RSS_MAX_AGE_HOURS = Number(process.env.ARTICLE_LOOP_RSS_MAX_AGE_HOURS || 48);
const WP_API_URL = String(process.env.PUBLISH_WP_API_URL || process.env.WP_API_URL || 'https://fluxaivory.com/wp-json/wp/v2').trim();
const PUBLISHED_TITLES_TIMEOUT_MS = Number(process.env.ARTICLE_LOOP_PUBLISHED_TITLES_TIMEOUT_MS || 1500);

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const next = argv[i + 1];
    const key = token.slice(2);
    if (!next || next.startsWith('--')) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function isDisabledValue(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off';
}

async function runTopicScout(vertical) {
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'paperclip-topic-scout-'));
  const outPath = path.join(tmp, 'topic-scout.json');
  try {
    await execFilePromise('python3', [TOPIC_SCOUT_SCRIPT, '--vertical', vertical, '--out', outPath], {
      maxBuffer: 1024 * 1024 * 4,
    });
    return JSON.parse(await fsp.readFile(outPath, 'utf8'));
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

async function refreshDashboardIfConfigured() {
  if (!RSS_REFRESH_SCRIPT || isDisabledValue(RSS_REFRESH_SCRIPT)) return null;
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'paperclip-rss-refresh-'));
  const outPath = path.join(tmp, 'rss-refresh.json');
  try {
    const vertical = String(process.env.ARTICLE_LOOP_REFRESH_VERTICAL || '').trim();
    const args = [RSS_REFRESH_SCRIPT, '--out', outPath];
    if (vertical) args.push('--vertical', vertical);
    const { stdout } = await execFilePromise('python3', args, {
      maxBuffer: 1024 * 1024 * 4,
    });
    const filePayload = await fsp.readFile(outPath, 'utf8').then((raw) => JSON.parse(raw)).catch(() => null);
    if (filePayload) return filePayload;
    return JSON.parse(String(stdout || '{}'));
  } finally {
    await fsp.rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}

function buildContext(topicScout, vertical, issueId) {
  const topic = String(topicScout.selected_topic || '').trim();
  return {
    topic,
    verticalKey: vertical,
    topicScout,
    title: topic,
    publishReadyGateMode: 'strict',
    publicVerifyContractMode: 'compat',
    highThroughputQualityLoop: true,
    articleLoop: {
      enabled: true,
      articleAttempt: 1,
      maxAttempts: 3,
      specialistGuidanceUsed: {},
      lastFailedGates: [],
      lastGateReasonSummary: {},
      backlog: false,
    },
    sourceRoutineIssueId: issueId || null,
  };
}

function normalizeContext(topic, contextJson) {
  return {
    ...(contextJson && typeof contextJson === 'object' && !Array.isArray(contextJson) ? contextJson : {}),
    topic: String(topic || '').trim(),
  };
}

function normalizeTopicKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function selectTopicWithCooldown(topicScout, recentTopics, cooldownHours) {
  const generatedAt = Date.parse(String(topicScout?.generated_at || ''));
  const candidates = Array.isArray(topicScout?.top10_candidates) ? topicScout.top10_candidates : [];
  const normalizedRecent = recentTopics
    .map((entry) => ({
      topicKey: normalizeTopicKey(entry.topic),
      createdAtMs: Date.parse(String(entry.created_at || '')),
    }))
    .filter((entry) => entry.topicKey && Number.isFinite(entry.createdAtMs));
  const cooldownMs = Math.max(0, Number(cooldownHours || 0)) * 60 * 60 * 1000;

  if (!Number.isFinite(generatedAt) || cooldownMs <= 0) {
    const selected = candidates[0] || null;
    return {
      selectedTopic: String(selected?.title || topicScout?.selected_topic || '').trim() || null,
      selectedBucket: String(selected?.bucket || topicScout?.selected_bucket || '').trim() || null,
      selectionReason: String(selected?.why_now || topicScout?.selection_reason || 'no candidates'),
      topicScorecard: selected?.topic_scorecard || topicScout?.topic_scorecard || {},
      selectedRank: selected?.rank || 1,
      cooldownApplied: false,
      skippedRecentTopics: [],
    };
  }

  const skippedRecentTopics = [];
  for (const candidate of candidates) {
    const topicKey = normalizeTopicKey(candidate?.title);
    if (!topicKey) continue;
    const conflict = normalizedRecent.find((entry) => entry.topicKey === topicKey && (generatedAt - entry.createdAtMs) < cooldownMs);
    if (conflict) {
      skippedRecentTopics.push({
        title: String(candidate?.title || '').trim(),
        rank: Number(candidate?.rank || 0),
        previousCreatedAt: new Date(conflict.createdAtMs).toISOString(),
      });
      continue;
    }
    return {
      selectedTopic: String(candidate?.title || '').trim() || null,
      selectedBucket: String(candidate?.bucket || '').trim() || null,
      selectionReason: String(candidate?.why_now || topicScout?.selection_reason || 'candidate selected'),
      topicScorecard: candidate?.topic_scorecard || topicScout?.topic_scorecard || {},
      selectedRank: Number(candidate?.rank || 0) || 1,
      cooldownApplied: skippedRecentTopics.length > 0,
      skippedRecentTopics,
    };
  }

  const selected = candidates[0] || null;
  return {
    selectedTopic: String(selected?.title || topicScout?.selected_topic || '').trim() || null,
    selectedBucket: String(selected?.bucket || topicScout?.selected_bucket || '').trim() || null,
    selectionReason: String(selected?.why_now || topicScout?.selection_reason || 'no candidates'),
    topicScorecard: selected?.topic_scorecard || topicScout?.topic_scorecard || {},
    selectedRank: selected?.rank || 1,
    cooldownApplied: skippedRecentTopics.length > 0,
    skippedRecentTopics,
  };
}

function selectTopicAvoidingPublished(topicScout, recentTopics, publishedTitles, cooldownHours) {
  const base = selectTopicWithCooldown(topicScout, recentTopics, cooldownHours);
  const candidates = Array.isArray(topicScout?.top10_candidates) ? topicScout.top10_candidates : [];
  const published = new Set((publishedTitles || []).map((title) => normalizeTopicKey(title)).filter(Boolean));
  const selectedKey = normalizeTopicKey(base.selectedTopic);
  if (!selectedKey || !published.has(selectedKey)) {
    return {
      ...base,
      skippedPublishedTopics: [],
    };
  }

  const skippedPublishedTopics = [{ title: base.selectedTopic, rank: base.selectedRank }];
  for (const candidate of candidates) {
    const candidateKey = normalizeTopicKey(candidate?.title);
    if (!candidateKey || published.has(candidateKey)) {
      if (candidate?.title && candidate?.title !== base.selectedTopic) {
        skippedPublishedTopics.push({ title: String(candidate.title), rank: Number(candidate.rank || 0) });
      }
      continue;
    }
    return {
      selectedTopic: String(candidate?.title || '').trim() || null,
      selectedBucket: String(candidate?.bucket || '').trim() || null,
      selectionReason: String(candidate?.why_now || topicScout?.selection_reason || 'candidate selected'),
      topicScorecard: candidate?.topic_scorecard || topicScout?.topic_scorecard || {},
      selectedRank: Number(candidate?.rank || 0) || 1,
      cooldownApplied: base.cooldownApplied,
      skippedRecentTopics: base.skippedRecentTopics,
      skippedPublishedTopics,
    };
  }

  return {
    ...base,
    skippedPublishedTopics,
  };
}

function getTopicScoutStaleReason(topicScout, maxAgeHours) {
  const age = Number(topicScout?.dashboard_age_hours);
  if (!Number.isFinite(age)) return null;
  const limit = Math.max(0, Number(maxAgeHours || 0));
  if (limit <= 0) return null;
  if (age <= limit) return null;
  return `article_quality_loop_dashboard_stale:${age}h>${limit}h`;
}

function normalizeTraceability(traceability) {
  return traceability && typeof traceability === 'object' && !Array.isArray(traceability)
    ? { ...traceability }
    : {};
}

async function resolveIssueIdentifier(client, issueId) {
  if (!issueId) return null;
  const result = await client.query(
    `select identifier
       from issues
      where id = $1
        and company_id = $2
      limit 1`,
    [issueId, COMPANY_ID],
  );
  const identifier = result.rows[0]?.identifier;
  return typeof identifier === 'string' && identifier.trim() ? identifier.trim() : null;
}

async function listRecentTopics(client, projectId, limit = 25) {
  const result = await client.query(
    `select topic, created_at
       from blog_runs
      where company_id = $1
        and project_id = $2
      order by created_at desc
      limit $3`,
    [COMPANY_ID, projectId, limit],
  );
  return result.rows;
}

async function listPublishedTitles(limit = 50) {
  if (isDisabledValue(process.env.ARTICLE_LOOP_FETCH_PUBLISHED_TITLES)) {
    return [];
  }
  const base = WP_API_URL.endsWith('/') ? WP_API_URL : `${WP_API_URL}/`;
  const url = new URL(`posts?per_page=${limit}&_embed=1&orderby=date&order=desc&status=publish`, base);
  const request = {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'paperclip-article-loop/0.1',
    },
  };
  if (
    Number.isFinite(PUBLISHED_TITLES_TIMEOUT_MS) &&
    PUBLISHED_TITLES_TIMEOUT_MS > 0 &&
    typeof AbortSignal !== 'undefined' &&
    typeof AbortSignal.timeout === 'function'
  ) {
    request.signal = AbortSignal.timeout(PUBLISHED_TITLES_TIMEOUT_MS);
  }
  const res = await fetch(url.toString(), request);
  if (!res.ok) {
    throw new Error(`published_titles_fetch_failed:${res.status}`);
  }
  const posts = await res.json();
  return Array.isArray(posts)
    ? posts
      .map((post) => String(post?.title?.rendered || '').replace(/<[^>]+>/g, '').trim())
      .filter(Boolean)
    : [];
}

async function writeJson(filePath, payload) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function createRun({ topic, issueId, contextJson }) {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const normalizedContextJson = normalizeContext(topic, contextJson);
    const existing = await client.query(
      `select id, topic, lane, target_site, publish_mode, wordpress_post_id, status, current_step, context_json, created_at, issue_id
         from blog_runs
        where company_id = $1
          and project_id = $2
          and topic = $3
          and status not in ('failed', 'public_verified', 'human_review_backlog')
        order by created_at desc
        limit 1`,
      [COMPANY_ID, PROJECT_ID, topic],
    );
    if (existing.rows[0]) {
      const row = existing.rows[0];
      const nextContextJson = normalizeContext(topic, row.context_json);
      const traceability = normalizeTraceability(nextContextJson.traceability);
      const originIssueIdentifier =
        typeof traceability.originIssueIdentifier === 'string' && traceability.originIssueIdentifier.trim()
          ? traceability.originIssueIdentifier.trim()
          : await resolveIssueIdentifier(client, row.issue_id);
      const lastTouchedIssueIdentifier = await resolveIssueIdentifier(client, issueId);
      const touchedAt = new Date().toISOString();
      nextContextJson.traceability = {
        ...traceability,
        originIssueIdentifier: originIssueIdentifier || lastTouchedIssueIdentifier || null,
        lastTouchedIssueIdentifier: lastTouchedIssueIdentifier || traceability.lastTouchedIssueIdentifier || originIssueIdentifier || null,
        continuity: 'reused_existing_run',
        lastTouchedAt: touchedAt,
        reuseReason: REUSED_RUN_TRACEABILITY_REASON,
      };
      if (issueId) {
        nextContextJson.sourceRoutineIssueId = issueId;
      }
      const updated = await client.query(
        `update blog_runs
            set context_json = $2
          where id = $1
        returning id, topic, lane, target_site, publish_mode, wordpress_post_id, status, current_step, context_json, created_at`,
        [row.id, nextContextJson],
      );
      const reusedRow = updated.rows[0];
      const runDir = path.join(BLOG_RUNS_DIR, reusedRow.id);
      await writeJson(path.join(runDir, 'context.json'), {
        run_id: reusedRow.id,
        created_at: reusedRow.created_at instanceof Date ? reusedRow.created_at.toISOString() : new Date().toISOString(),
        topic: reusedRow.topic,
        lane: reusedRow.lane,
        target_site: reusedRow.target_site || TARGET_SITE,
        wordpress: {
          publish: reusedRow.publish_mode === 'publish',
          status: reusedRow.publish_mode === 'publish' ? 'publish' : 'draft',
          post_id: reusedRow.wordpress_post_id ?? null,
        },
        ...nextContextJson,
      });
      return { reused: true, run: reusedRow };
    }

    const runId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const inserted = await client.query(
      `insert into blog_runs (
         id, company_id, project_id, issue_id, topic, lane, target_site, status, current_step,
         approval_mode, publish_mode, context_json
       ) values ($1,$2,$3,$4,$5,'publish',$6,'queued','research','manual','dry_run',$7)
       returning id, topic, status, current_step, context_json, created_at`,
      [runId, COMPANY_ID, PROJECT_ID, issueId || null, topic, TARGET_SITE, normalizedContextJson],
    );

    const runDir = path.join(BLOG_RUNS_DIR, runId);
    await writeJson(path.join(runDir, 'context.json'), {
      run_id: runId,
      created_at: createdAt,
      topic,
      lane: 'publish',
      target_site: TARGET_SITE,
      wordpress: { publish: false, status: 'draft', post_id: null },
      ...normalizedContextJson,
    });
    await writeJson(path.join(runDir, 'status.json'), {
      phase: 'research',
      state: 'running',
      last_completed_step: null,
      next_step: 'research',
      error: null,
      updated_at: createdAt,
    });

    return { reused: false, run: inserted.rows[0] };
  } finally {
    await client.end();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const vertical = String(args.vertical || 'ai-tech').trim();
  const issueId = String(args['issue-id'] || process.env.PAPERCLIP_TASK_ID || '').trim() || null;
  process.env.ARTICLE_LOOP_REFRESH_VERTICAL = vertical;
  const dashboardRefresh = await refreshDashboardIfConfigured().catch((error) => ({
    ok: false,
    error: String(error.message || error),
  }));
  const topicScout = await runTopicScout(vertical);
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  let topic = null;
  let selectedBucket = null;
  let selectionReason = null;
  let topicScorecard = {};
  let selectedRank = 1;
  let cooldownApplied = false;
  let skippedRecentTopics = [];
  try {
    const recentTopics = await listRecentTopics(client, PROJECT_ID);
    const publishedTitles = await listPublishedTitles().catch(() => []);
    const selected = selectTopicAvoidingPublished(topicScout, recentTopics, publishedTitles, TOPIC_COOLDOWN_HOURS);
    topic = selected.selectedTopic;
    selectedBucket = selected.selectedBucket;
    selectionReason = selected.selectionReason;
    topicScorecard = selected.topicScorecard;
    selectedRank = selected.selectedRank;
    cooldownApplied = selected.cooldownApplied;
    skippedRecentTopics = selected.skippedRecentTopics;
  } finally {
    await client.end();
  }
  const staleReason = getTopicScoutStaleReason(topicScout, RSS_MAX_AGE_HOURS);
  if (staleReason) {
    throw new Error(staleReason);
  }
  if (!topic) {
    throw new Error('article_quality_loop_topic_missing');
  }
  topicScout.selected_topic = topic;
  topicScout.selected_bucket = selectedBucket;
  topicScout.selection_reason = selectionReason;
  topicScout.topic_scorecard = topicScorecard;
  topicScout.cooldown_applied = cooldownApplied;
  topicScout.skipped_recent_topics = skippedRecentTopics;
  topicScout.selected_rank = selectedRank;
  const result = await createRun({
    topic,
    issueId,
    contextJson: buildContext(topicScout, vertical, issueId),
  });
  process.stdout.write(`${JSON.stringify({
    ok: true,
    vertical,
    topic,
    dashboardRefresh,
    reused: result.reused,
    run: result.run,
  }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: String(error.message || error) }, null, 2)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  normalizeTopicKey,
  selectTopicWithCooldown,
  selectTopicAvoidingPublished,
  getTopicScoutStaleReason,
};
