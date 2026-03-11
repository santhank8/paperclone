#!/usr/bin/env node

/**
 * Enforces import boundary rules between monorepo packages.
 * Usage: node scripts/arch-lint.mjs
 * Exit 0 on success, 1 on violation.
 *
 * Rules:
 * 1. ui/ must not import from server/ or packages/db/
 * 2. packages/shared/ must not import from server/, ui/, or packages/db/
 * 3. packages/db/ must not import from server/, ui/, or packages/shared/
 * 4. packages/adapters/ must not import from server/ or ui/
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, relative, extname } from 'path';

const ROOT = process.cwd();

const RULES = [
  {
    source: 'ui/src',
    forbidden: [
      { pattern: /@paperclipai\/db/, label: '@paperclipai/db' },
      { pattern: /from\s+['"]\.\.\/.*server/,  label: 'server/ (relative)' },
      { pattern: /from\s+['"].*\/server\//,     label: 'server/ (path)' },
    ],
    description: 'ui/ must not import from server/ or packages/db/',
  },
  {
    source: 'packages/shared/src',
    forbidden: [
      { pattern: /@paperclipai\/db/, label: '@paperclipai/db' },
      { pattern: /from\s+['"].*\/server\//, label: 'server/' },
      { pattern: /from\s+['"].*\/ui\//, label: 'ui/' },
    ],
    description: 'packages/shared/ must not import from server/, ui/, or packages/db/',
  },
  {
    source: 'packages/db/src',
    forbidden: [
      { pattern: /@paperclipai\/shared/, label: '@paperclipai/shared' },
      { pattern: /from\s+['"].*\/server\//, label: 'server/' },
      { pattern: /from\s+['"].*\/ui\//, label: 'ui/' },
    ],
    description: 'packages/db/ must not import from server/, ui/, or packages/shared/',
  },
  {
    source: 'packages/adapters',
    forbidden: [
      { pattern: /from\s+['"].*\/server\//, label: 'server/ (relative)' },
      { pattern: /from\s+['"].*\/ui\//, label: 'ui/' },
    ],
    description: 'packages/adapters/ must not import from server/ or ui/',
  },
];

const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);

function walkDir(dir) {
  const files = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'dist' || entry === '.next') continue;
    const fullPath = resolve(dir, entry);
    const stat = statSync(fullPath, { throwIfNoEntry: false });
    if (!stat) continue;
    if (stat.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (TS_EXTENSIONS.has(extname(entry))) {
      files.push(fullPath);
    }
  }
  return files;
}

let violations = [];

for (const rule of RULES) {
  const sourceDir = resolve(ROOT, rule.source);
  const files = walkDir(sourceDir);

  for (const filePath of files) {
    let content;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Only check import/require lines
      if (!line.includes('import') && !line.includes('require')) continue;

      for (const { pattern, label } of rule.forbidden) {
        if (pattern.test(line)) {
          const relPath = relative(ROOT, filePath);
          violations.push({
            file: relPath,
            line: i + 1,
            rule: rule.description,
            imported: label,
            code: line.trim(),
          });
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error('Architecture lint FAILED:\n');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    Rule: ${v.rule}`);
    console.error(`    Forbidden import: ${v.imported}`);
    console.error(`    Code: ${v.code}\n`);
  }
  console.error(`${violations.length} violation(s) found.`);
  process.exit(1);
} else {
  console.log('Architecture lint PASSED');
  console.log(`  - ${RULES.length} boundary rules checked`);
  console.log('  - No violations found');
  process.exit(0);
}
