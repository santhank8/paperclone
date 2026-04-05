
import path from 'node:path';
import { MODELS_CACHE_TTL_MS } from '../shared/constants.js';
import {
  asTrimmedString,
  readFileIfExists,
  readFileIfExistsSync,
  resolveHermesHome,
} from '../shared/utils.js';
import {
  detectModel,
  detectModelSync,
  listConfiguredModels,
  listConfiguredModelsSync,
} from './detect-model.js';

let cache = null;

/**
 * @param {Array<{model:string, provider:string, sourcePath:string, isDefault:boolean}>} entries
 */
export function formatConfiguredModels(entries) {
  const seen = new Set();
  const formatted = [];
  for (const entry of entries) {
    const model = asTrimmedString(entry.model);
    if (!model || seen.has(model)) continue;
    seen.add(model);
    const parts = [];
    if (entry.isDefault) parts.push('default');
    if (entry.provider) parts.push(entry.provider);
    if (!entry.isDefault && entry.sourcePath) parts.push(entry.sourcePath);
    formatted.push({
      id: model,
      label: `${model}${parts.length ? ` (${parts.join(', ')})` : ''}`,
    });
  }
  return formatted.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true, sensitivity: 'base' }));
}

export function getStaticHermesModels() {
  const configured = listConfiguredModelsSync();
  if (configured.length) return formatConfiguredModels(configured);

  const detected = detectModelSync();
  if (detected?.model) {
    return [
      {
        id: detected.model,
        label: `${detected.model} (default${detected.provider ? `, ${detected.provider}` : ''})`,
      },
    ];
  }
  return [];
}

/**
 * List Hermes models by reading config.yaml only.
 *
 * This is deliberate:
 * - it is fast,
 * - it works offline,
 * - and it reflects how Hermes itself is configured, rather than guessing from docs.
 *
 * @param {{forceRefresh?: boolean, configPath?: string}=} options
 */
export async function listHermesModels(options = {}) {
  const now = Date.now();
  if (!options.forceRefresh && cache && cache.expiresAt > now) return cache.models;

  const configured = await listConfiguredModels(options.configPath);
  const models = configured.length
    ? formatConfiguredModels(configured)
    : (() => {
        const fallback = [];
        return fallback;
      })();

  if (!models.length) {
    const detected = await detectModel(options.configPath);
    if (detected?.model) {
      models.push({
        id: detected.model,
        label: `${detected.model} (default${detected.provider ? `, ${detected.provider}` : ''})`,
      });
    }
  }

  if (!models.length) {
    models.push({
      id: '',
      label: 'Configure a Hermes model in ~/.hermes/config.yaml or enter one manually',
    });
  }

  cache = { expiresAt: now + MODELS_CACHE_TTL_MS, models };
  return models;
}

export function resetHermesModelsCacheForTests() {
  cache = null;
}
