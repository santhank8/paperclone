
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHermesOutput, parseHermesStdoutLine, isUnknownSessionError } from '../src/server/parse.js';

test('parseHermesOutput extracts session id, usage, cost, and response', () => {
  const stdout = 'Done.\n\nsession_id: abc123';
  const stderr = 'tokens: 12 input 34 output\ncost: $0.12';
  const parsed = parseHermesOutput(stdout, stderr);
  assert.equal(parsed.sessionId, 'abc123');
  assert.equal(parsed.response, 'Done.');
  assert.deepEqual(parsed.usage, { inputTokens: 12, outputTokens: 34 });
  assert.equal(parsed.costUsd, 0.12);
});

test('parseHermesStdoutLine yields structured tool events', () => {
  const entries = parseHermesStdoutLine('┊ terminal curl -s 0.2s', '2026-01-01T00:00:00Z');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].kind, 'tool_call');
  assert.equal(entries[1].kind, 'tool_result');
});

test('isUnknownSessionError detects resume failures', () => {
  assert.equal(isUnknownSessionError('', 'Unknown session: abc'), true);
  assert.equal(isUnknownSessionError('', 'all good'), false);
});
