
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPrompt, buildPromptVars } from '../src/server/prompt.js';

const ctx = {
  runId: 'run-1',
  agent: {
    id: 'agent-1',
    companyId: 'company-1',
    name: 'CEO Hermes',
    permissions: { canCreateAgents: true },
  },
  context: {
    taskId: 'ISS-12',
    taskTitle: 'Fix deployment',
    taskBody: 'Find and fix the deployment breakage.',
    approvalId: 'apr-1',
    approvalStatus: 'revision_requested',
    issueIds: ['ISS-12', 'ISS-9'],
    wakeCommentId: 'c-5',
    wakeReason: 'Board requested a revision',
    paperclipWorkspace: { cwd: '/tmp/work', repoUrl: 'https://example.com/repo.git', repoRef: 'main' },
  },
};

test('buildPromptVars makes approval and task context first-class', () => {
  const vars = buildPromptVars(ctx, {});
  assert.equal(vars.taskId, 'ISS-12');
  assert.equal(vars.approvalId, 'apr-1');
  assert.equal(vars.commentId, 'c-5');
  assert.equal(vars.canCreateAgents, true);
  assert.match(vars.workspaceSummary, /cwd: \/tmp\/work/);
});

test('buildPrompt renders task and approval sections', () => {
  const prompt = buildPrompt(ctx, { paperclipApiUrl: 'http://localhost:3100' });
  assert.match(prompt, /Assigned issue/);
  assert.match(prompt, /Approval context/);
  assert.match(prompt, /revision_requested/);
  assert.match(prompt, /\/agent-hires/);
  assert.match(prompt, /\/approvals\/apr-1\/comments/);
  assert.match(prompt, /"body":"Acknowledged\. Proceeding with the approved plan\."/);
  assert.match(prompt, /X-Paperclip-Run-Id/);
});

test('buildPromptVars falls back to issue title and description fields', () => {
  const vars = buildPromptVars(
    {
      ...ctx,
      context: {
        taskId: 'ISS-44',
        issueTitle: 'Smoke test worker',
        issueDescription: 'Post AGENT_OK and close the issue.',
      },
    },
    {},
  );

  assert.equal(vars.taskId, 'ISS-44');
  assert.equal(vars.taskTitle, 'Smoke test worker');
  assert.equal(vars.taskBody, 'Post AGENT_OK and close the issue.');
});
