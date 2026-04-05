
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { asRecord, asStringArray, asTrimmedString, ensureDir, readFileIfExists, resolveHermesHome } from '../shared/utils.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED_SKILLS_ROOT = path.resolve(MODULE_DIR, '..', '..', 'skills');

function builtinsRoot() {
  return BUNDLED_SKILLS_ROOT;
}

function resolveDesiredSkillNames(config, desiredSkills = null) {
  if (Array.isArray(desiredSkills)) return desiredSkills.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
  return asStringArray(config.desiredSkills || config.skills || config.enabledSkills);
}

async function scanBundledSkills() {
  const entries = [];
  try {
    const categories = await fs.readdir(builtinsRoot(), { withFileTypes: true });
    for (const category of categories) {
      if (!category.isDirectory()) continue;
      const categoryPath = path.join(builtinsRoot(), category.name);
      const skills = await fs.readdir(categoryPath, { withFileTypes: true });
      for (const skillDir of skills) {
        if (!skillDir.isDirectory()) continue;
        const skillPath = path.join(categoryPath, skillDir.name);
        const skillFile = path.join(skillPath, 'SKILL.md');
        const stat = await fs.stat(skillFile).catch(() => null);
        if (!stat) continue;
        entries.push({
          key: skillDir.name,
          runtimeName: skillDir.name,
          category: category.name,
          sourcePath: skillPath,
          skillFile,
        });
      }
    }
  } catch {
    // no bundled skills
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

async function scanHermesSkills(config) {
  const skillsRoot = path.join(resolveHermesHome(config), 'skills');
  const entries = [];
  try {
    const categories = await fs.readdir(skillsRoot, { withFileTypes: true });
    for (const category of categories) {
      if (!category.isDirectory()) continue;
      const categoryPath = path.join(skillsRoot, category.name);
      const children = await fs.readdir(categoryPath, { withFileTypes: true }).catch(() => []);
      for (const child of children) {
        if (!child.isDirectory()) continue;
        const skillFile = path.join(categoryPath, child.name, 'SKILL.md');
        const stat = await fs.stat(skillFile).catch(() => null);
        if (!stat) continue;
        const content = await readFileIfExists(skillFile);
        entries.push({
          key: child.name,
          runtimeName: child.name,
          category: category.name,
          sourcePath: path.join(categoryPath, child.name),
          skillFile,
          detail: parseSkillDescription(content || ''),
        });
      }
    }
  } catch {
    // no user skills
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * @param {string} content
 */
export function parseSkillDescription(content) {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return '';
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('description:')) continue;
    return line.slice('description:'.length).trim().replace(/^['"]|['"]$/g, '');
  }
  return '';
}

export async function listHermesSkills(ctx) {
  return await buildSkillSnapshot(ctx.config, null);
}

export async function syncHermesSkills(ctx, desiredSkills = []) {
  return await buildSkillSnapshot(ctx.config, desiredSkills, true);
}

export function resolveHermesDesiredSkillNames(config, availableEntries, desiredSkills = null) {
  const desired = resolveDesiredSkillNames(config, desiredSkills);
  const available = new Set(availableEntries.map((entry) => entry.key));
  return desired.filter((name) => available.has(name));
}

export async function buildSkillSnapshot(config, desiredSkills = null, shouldSync = false) {
  const bundled = await scanBundledSkills();
  const hermes = await scanHermesSkills(config);
  const desired = resolveDesiredSkillNames(config, desiredSkills);
  const desiredSet = new Set(desired);

  if (shouldSync) {
    for (const entry of bundled) {
      if (!desiredSet.has(entry.key)) continue;
      await installBundledSkill(config, entry);
    }
  }

  const installedAfterSync = await scanHermesSkills(config);
  const bundledByKey = new Map(bundled.map((entry) => [entry.key, entry]));
  const installedByKey = new Map(installedAfterSync.map((entry) => [entry.key, entry]));

  const allKeys = [...new Set([...bundledByKey.keys(), ...installedByKey.keys(), ...desired])].sort();
  const entries = [];
  const warnings = [];

  for (const key of allKeys) {
    const bundledEntry = bundledByKey.get(key);
    const installedEntry = installedByKey.get(key);
    const desiredFlag = desiredSet.has(key);

    if (bundledEntry && installedEntry) {
      entries.push({
        key,
        runtimeName: key,
        desired: desiredFlag,
        managed: true,
        state: 'installed',
        origin: 'company_managed',
        originLabel: 'Bundled with adapter',
        locationLabel: installedEntry.sourcePath,
        readOnly: false,
        sourcePath: bundledEntry.sourcePath,
        targetPath: installedEntry.sourcePath,
        detail: installedEntry.detail || '',
      });
      continue;
    }

    if (bundledEntry && !installedEntry) {
      entries.push({
        key,
        runtimeName: key,
        desired: desiredFlag,
        managed: true,
        state: desiredFlag ? 'missing' : 'available',
        origin: 'company_managed',
        originLabel: 'Bundled with adapter',
        readOnly: false,
        sourcePath: bundledEntry.sourcePath,
        targetPath: null,
        detail: desiredFlag ? 'Selected but not yet installed into Hermes home.' : '',
      });
      if (desiredFlag) warnings.push(`Desired skill "${key}" has not been installed into ~/.hermes/skills yet.`);
      continue;
    }

    if (!bundledEntry && installedEntry) {
      entries.push({
        key,
        runtimeName: key,
        desired: desiredFlag,
        managed: false,
        state: 'installed',
        origin: 'user_installed',
        originLabel: 'Hermes user skill',
        locationLabel: installedEntry.sourcePath,
        readOnly: true,
        sourcePath: installedEntry.sourcePath,
        targetPath: installedEntry.sourcePath,
        detail: installedEntry.detail || '',
      });
      continue;
    }

    entries.push({
      key,
      runtimeName: null,
      desired: desiredFlag,
      managed: true,
      state: 'missing',
      origin: 'external_unknown',
      originLabel: 'Unknown skill',
      readOnly: false,
      sourcePath: null,
      targetPath: null,
      detail: 'Desired skill was not found in bundled skills or Hermes home.',
    });
    warnings.push(`Desired skill "${key}" is unknown.`);
  }

  return {
    adapterType: 'hermes_local',
    supported: true,
    mode: 'persistent',
    desiredSkills: desired,
    entries,
    warnings,
  };
}

export async function installBundledSkill(config, entry) {
  const targetRoot = path.join(resolveHermesHome(config), 'skills', entry.category, entry.runtimeName);
  await ensureDir(path.dirname(targetRoot));
  await copyDirectory(entry.sourcePath, targetRoot);
  return targetRoot;
}

async function copyDirectory(sourceDir, targetDir) {
  await fs.rm(targetDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(source, target);
    } else {
      await fs.copyFile(source, target);
    }
  }
}
