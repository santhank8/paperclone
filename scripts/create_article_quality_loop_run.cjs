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
const TOPIC_SCOUT_SCRIPT = '/Users/daehan/Documents/persona/paperclip/scripts/obsidian_rss_topic_scout.py';
const BLOG_RUNS_DIR = path.join(os.homedir(), '.paperclip', 'instances', 'default', 'data', 'blog-runs');

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

function buildContext(topicScout, vertical, issueId) {
  return {
    verticalKey: vertical,
    topicScout,
    title: String(topicScout.selected_topic || '').trim(),
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

async function writeJson(filePath, payload) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

async function createRun({ topic, issueId, contextJson }) {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const existing = await client.query(
      `select id, status, current_step
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
      return { reused: true, run: existing.rows[0] };
    }

    const runId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const inserted = await client.query(
      `insert into blog_runs (
         id, company_id, project_id, issue_id, topic, lane, target_site, status, current_step,
         approval_mode, publish_mode, context_json
       ) values ($1,$2,$3,$4,$5,'publish',$6,'queued','research','manual','dry_run',$7)
       returning id, topic, status, current_step, context_json, created_at`,
      [runId, COMPANY_ID, PROJECT_ID, issueId || null, topic, TARGET_SITE, contextJson],
    );

    const runDir = path.join(BLOG_RUNS_DIR, runId);
    await writeJson(path.join(runDir, 'context.json'), {
      run_id: runId,
      created_at: createdAt,
      topic,
      lane: 'publish',
      target_site: TARGET_SITE,
      wordpress: { publish: false, status: 'draft', post_id: null },
      ...contextJson,
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
  const topicScout = await runTopicScout(vertical);
  const topic = String(topicScout.selected_topic || '').trim();
  if (!topic) {
    throw new Error('article_quality_loop_topic_missing');
  }
  const result = await createRun({
    topic,
    issueId,
    contextJson: buildContext(topicScout, vertical, issueId),
  });
  process.stdout.write(`${JSON.stringify({
    ok: true,
    vertical,
    topic,
    reused: result.reused,
    run: result.run,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({ ok: false, error: String(error.message || error) }, null, 2)}\n`);
  process.exitCode = 1;
});
