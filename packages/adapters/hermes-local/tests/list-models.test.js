
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatConfiguredModels } from '../src/server/list-models.js';

test('formatConfiguredModels deduplicates by model id and annotates labels', () => {
  const models = formatConfiguredModels([
    { model: 'gpt-5.4', provider: 'copilot', sourcePath: 'model.default', isDefault: true },
    { model: 'gpt-5.4', provider: 'copilot', sourcePath: 'auxiliary.vision.model', isDefault: false },
    { model: 'openai/gpt-4o', provider: 'openrouter', sourcePath: 'auxiliary.vision.model', isDefault: false },
  ]);
  assert.equal(models.length, 2);
  assert.equal(models[0].id, 'gpt-5.4');
  assert.match(models[0].label, /default/);
  assert.match(models[1].label, /auxiliary\.vision\.model/);
});
