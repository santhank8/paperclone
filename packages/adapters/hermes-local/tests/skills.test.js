
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { syncHermesSkills } from '../src/server/skills.js';

test('syncHermesSkills installs bundled skills into Hermes home', async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hermes-skills-'));
  try {
    const snapshot = await syncHermesSkills(
      { config: { env: { HERMES_HOME: tmp }, desiredSkills: ['paperclip-api'] } },
      ['paperclip-api']
    );
    const installed = path.join(tmp, 'skills', 'paperclip', 'paperclip-api', 'SKILL.md');
    const content = await fs.readFile(installed, 'utf8');
    assert.match(content, /paperclip-api/);
    assert.ok(snapshot.entries.some((entry) => entry.key === 'paperclip-api'));
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
});
