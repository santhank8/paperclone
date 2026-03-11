#!/usr/bin/env node

/**
 * Validates the harness scorecard document schema and required headings.
 * Usage: node scripts/harness-scorecard.mjs
 * Exit 0 on success, 1 on validation failure.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const SCORECARD_PATH = resolve(process.cwd(), 'doc/HARNESS_SCORECARD.md');
const REQUIRED_PARAMETERS = 11;

const REQUIRED_HEADINGS = [
  '# Harness Engineering Scorecard',
  '## Parameters',
  '## Scoring Method',
  '## Update History',
  '## Quarterly Delta',
];

const REQUIRED_FRONTMATTER = [
  'Owner',
  'Last Verified',
  'Applies To',
  'Links',
  'Update Cadence',
];

const REQUIRED_TABLE_COLUMNS = [
  '#',
  'Parameter',
  'Baseline',
  'Target',
  'Current',
  'Metric Source',
];

let errors = [];

// Read file
let content;
try {
  content = readFileSync(SCORECARD_PATH, 'utf-8');
} catch {
  console.error(`FAIL: Cannot read ${SCORECARD_PATH}`);
  process.exit(1);
}

const lines = content.split('\n');

// Check frontmatter
const fmStart = lines.indexOf('---');
const fmEnd = lines.indexOf('---', fmStart + 1);
if (fmStart === -1 || fmEnd === -1) {
  errors.push('Missing YAML frontmatter (--- delimiters)');
} else {
  const frontmatter = lines.slice(fmStart + 1, fmEnd).join('\n');
  for (const field of REQUIRED_FRONTMATTER) {
    if (!frontmatter.includes(`${field}:`)) {
      errors.push(`Missing frontmatter field: ${field}`);
    }
  }
}

// Check required headings
for (const heading of REQUIRED_HEADINGS) {
  if (!content.includes(heading)) {
    errors.push(`Missing required heading: ${heading}`);
  }
}

// Check parameters table
const paramTableStart = lines.findIndex(l => l.includes('| # |') && l.includes('Parameter'));
if (paramTableStart === -1) {
  errors.push('Missing parameters table with columns: #, Parameter, Baseline, Target, Current, Metric Source');
} else {
  const headerLine = lines[paramTableStart];
  for (const col of REQUIRED_TABLE_COLUMNS) {
    if (!headerLine.includes(col)) {
      errors.push(`Parameters table missing column: ${col}`);
    }
  }

  // Count data rows (skip header + separator)
  let rowCount = 0;
  for (let i = paramTableStart + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;
    rowCount++;
  }

  if (rowCount < REQUIRED_PARAMETERS) {
    errors.push(`Parameters table has ${rowCount} rows, expected at least ${REQUIRED_PARAMETERS}`);
  }
}

// Check metric source is non-empty for each parameter
if (paramTableStart !== -1) {
  for (let i = paramTableStart + 2; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith('|')) break;
    const cells = line.split('|').map(c => c.trim()).filter(Boolean);
    if (cells.length >= 6) {
      const metricSource = cells[5];
      if (!metricSource || metricSource === '-') {
        errors.push(`Parameter ${cells[0]} (${cells[1]}) has empty metric source`);
      }
    }
  }
}

// Report
if (errors.length > 0) {
  console.error('Harness scorecard validation FAILED:\n');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  console.error(`\n${errors.length} error(s) found.`);
  process.exit(1);
} else {
  console.log('Harness scorecard validation PASSED');
  console.log(`  - ${REQUIRED_PARAMETERS} parameters found`);
  console.log(`  - All frontmatter fields present`);
  console.log(`  - All required headings present`);
  console.log(`  - All metric sources populated`);
  process.exit(0);
}
