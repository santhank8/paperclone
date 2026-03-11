#!/usr/bin/env node

/**
 * Validates that a PR description contains required evidence sections.
 * Usage:
 *   node scripts/check-pr-evidence.mjs                    # reads from stdin
 *   node scripts/check-pr-evidence.mjs --file <path>      # reads from file
 *   echo "PR body" | node scripts/check-pr-evidence.mjs   # pipe input
 *
 * In CI, pipe the PR body from gh:
 *   gh pr view $PR_NUMBER --json body -q .body | node scripts/check-pr-evidence.mjs
 *
 * Exit 0 on success, 1 on validation failure.
 */

import { readFileSync } from 'fs';

const REQUIRED_SECTIONS = [
  {
    name: 'Scope',
    patterns: [/^#+\s*scope/im, /^\*\*scope\*\*/im],
    description: 'What this PR changes and why',
  },
  {
    name: 'Verification',
    patterns: [/^#+\s*verification/im, /^\*\*verification\*\*/im],
    description: 'Evidence that the change works (typecheck, test:run, build output)',
  },
  {
    name: 'Contract Sync',
    patterns: [/^#+\s*contract\s*sync/im, /^\*\*contract\s*sync\*\*/im],
    description: 'Which contracts were checked/updated',
  },
  {
    name: 'Risks',
    patterns: [/^#+\s*risks?/im, /^\*\*risks?\*\*/im],
    description: 'Known risks, edge cases, or limitations',
  },
];

const VERIFICATION_COMMANDS = [
  { name: 'typecheck', pattern: /typecheck/i },
  { name: 'test:run', pattern: /test:run|test run|tests? pass/i },
  { name: 'build', pattern: /\bbuild\b/i },
];

// Read PR body
let body = '';
const args = process.argv.slice(2);
const fileIdx = args.indexOf('--file');

if (fileIdx !== -1 && args[fileIdx + 1]) {
  body = readFileSync(args[fileIdx + 1], 'utf-8');
} else if (args[0] === '--help' || args[0] === '-h') {
  console.log('Usage: check-pr-evidence.mjs [--file <path>]');
  console.log('       Reads PR body from stdin if no --file specified.');
  console.log('');
  console.log('Required sections: Scope, Verification, Contract Sync, Risks');
  process.exit(0);
} else {
  // Read from stdin
  try {
    body = readFileSync('/dev/stdin', 'utf-8');
  } catch {
    console.error('No input provided. Pass PR body via stdin or --file.');
    process.exit(1);
  }
}

if (!body.trim()) {
  console.error('PR body is empty.');
  process.exit(1);
}

let errors = [];

// Check required sections
for (const section of REQUIRED_SECTIONS) {
  const found = section.patterns.some(p => p.test(body));
  if (!found) {
    errors.push(`Missing required section: ${section.name} — ${section.description}`);
  }
}

// Check verification references — look at content after the Verification heading
const verLines = body.split('\n');
let inVerification = false;
let verContent = '';
for (const line of verLines) {
  if (/^#+\s*verification/i.test(line) || /^\*\*verification\*\*/i.test(line)) {
    inVerification = true;
    continue;
  }
  if (inVerification && (/^#+\s/.test(line) || /^\*\*[A-Z]/.test(line))) {
    break;
  }
  if (inVerification) {
    verContent += line + '\n';
  }
}
if (verContent) {
  for (const cmd of VERIFICATION_COMMANDS) {
    if (!cmd.pattern.test(verContent)) {
      errors.push(`Verification section should reference ${cmd.name} output`);
    }
  }
}

// Report
if (errors.length > 0) {
  console.error('PR evidence check FAILED:\n');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  console.error(`\n${errors.length} issue(s) found.`);
  process.exit(1);
} else {
  console.log('PR evidence check PASSED');
  console.log(`  - ${REQUIRED_SECTIONS.length} required sections found`);
  console.log('  - Verification references complete');
  process.exit(0);
}
