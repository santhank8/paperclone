
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createHermesStdoutParser,
  parseHermesOutput,
  parseHermesStdoutLine,
  isUnknownSessionError,
} from '../src/server/parse.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');

function readFixture(name) {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

function parseFixtureTranscript(name, ts = '2026-01-01T00:00:00Z') {
  const parser = createHermesStdoutParser();
  return readFixture(name)
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .flatMap((line) => parser.parseLine(line, ts));
}

test('parseHermesOutput extracts final assistant text from non-quiet Hermes fixture output', () => {
  const stdout = `${readFixture('banner-simple.stdout')}\nsession_id: SESSION_ID`;
  const stderr = 'tokens: 12 input 34 output\ncost: $0.12';
  const parsed = parseHermesOutput(stdout, stderr);
  assert.equal(parsed.sessionId, 'SESSION_ID');
  assert.equal(parsed.response, 'OK');
  assert.deepEqual(parsed.usage, { inputTokens: 12, outputTokens: 34 });
  assert.equal(parsed.costUsd, 0.12);
});

test('parseHermesStdoutLine parses real Hermes tool preview rows', () => {
  const entries = parseHermesStdoutLine('  ┊ 💻 $         pwd  0.2s', '2026-01-01T00:00:00Z');
  assert.equal(entries.length, 2);
  assert.equal(entries[0].kind, 'tool_call');
  assert.equal(entries[0].name, 'shell');
  assert.deepEqual(entries[0].input, { command: 'pwd' });
  assert.equal(entries[1].kind, 'tool_result');
  assert.equal(entries[1].content, 'status: completed\nduration: 0.2s\n\npwd');
});

test('createHermesStdoutParser suppresses Hermes boilerplate and keeps assistant panels from fixture captures', () => {
  const ts = '2026-01-01T00:00:00Z';
  const entries = parseFixtureTranscript('banner-tool.stdout', ts);
  assert.deepEqual(
    entries,
    [
      {
        kind: 'tool_call',
        ts,
        name: 'shell',
        input: { command: 'pwd' },
        toolUseId: entries[0]?.toolUseId,
      },
      {
        kind: 'tool_result',
        ts,
        toolUseId: entries[0]?.toolUseId,
        toolName: 'shell',
        content: 'status: completed\nduration: 0.2s\n\npwd',
        isError: false,
      },
      { kind: 'assistant', ts, text: 'The current working directory is /home/toor.' },
    ]
  );
});

test('createHermesStdoutParser parses quiet tool previews without panel footers from fixture captures', () => {
  const ts = '2026-01-01T00:00:00Z';
  const entries = parseFixtureTranscript('quiet-tool.stdout', ts);
  assert.deepEqual(
    entries,
    [
      {
        kind: 'tool_call',
        ts,
        name: 'shell',
        input: { command: 'pwd' },
        toolUseId: entries[0]?.toolUseId,
      },
      {
        kind: 'tool_result',
        ts,
        toolUseId: entries[0]?.toolUseId,
        toolName: 'shell',
        content: 'status: completed\nduration: 0.2s\n\npwd',
        isError: false,
      },
      { kind: 'assistant', ts, text: 'The working directory is /home/toor.' },
    ]
  );
});

test('createHermesStdoutParser parses inline Hermes diffs from fixture captures', () => {
  const ts = '2026-01-01T00:00:00Z';
  const entries = parseFixtureTranscript('quiet-write-diff.stdout', ts);
  assert.deepEqual(
    entries,
    [
      {
        kind: 'tool_call',
        ts,
        name: 'write',
        input: { path: 'hello.txt' },
        toolUseId: entries[0]?.toolUseId,
      },
      {
        kind: 'tool_result',
        ts,
        toolUseId: entries[0]?.toolUseId,
        toolName: 'write',
        content: 'status: completed\nduration: 0.4s\n\nhello.txt',
        isError: false,
      },
      { kind: 'diff', ts, changeType: 'file_header', text: 'a/hello.txt -> b/hello.txt' },
      { kind: 'diff', ts, changeType: 'hunk', text: '@@ -0,0 +1 @@' },
      { kind: 'diff', ts, changeType: 'add', text: '+hello world' },
      {
        kind: 'assistant',
        ts,
        text: 'I have created the file `hello.txt` containing the text "hello world". Let me know if there\'s anything else you\'d like me to do!',
      },
    ]
  );
});

test('createHermesStdoutParser parses failed shell previews from fixture captures', () => {
  const ts = '2026-01-01T00:00:00Z';
  const entries = parseFixtureTranscript('quiet-failed-shell.stdout', ts);
  assert.deepEqual(
    entries,
    [
      {
        kind: 'tool_call',
        ts,
        name: 'shell',
        input: { command: 'exit 7' },
        toolUseId: entries[0]?.toolUseId,
      },
      {
        kind: 'tool_result',
        ts,
        toolUseId: entries[0]?.toolUseId,
        toolName: 'shell',
        content: 'status: failed\nexit_code: 7\nduration: 0.2s\n\nexit 7',
        isError: true,
      },
      {
        kind: 'assistant',
        ts,
        text: 'The shell command was executed and failed with an exit code of 7.',
      },
    ]
  );
});

test('isUnknownSessionError detects resume failures', () => {
  assert.equal(isUnknownSessionError('', 'Unknown session: abc'), true);
  assert.equal(isUnknownSessionError('', 'all good'), false);
});
