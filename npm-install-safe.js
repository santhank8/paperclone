#!/usr/bin/env node
/**
 * Safe npm install wrapper that enforces minimum release age.
 * Uses npm's --before flag to only install packages released
 * at least 7 days ago.
 */

import { execSync } from 'child_process';
import process from 'process';

const MIN_AGE_DAYS = 7;

function getCutoffDate(days) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(now.getDate() - days);
  return cutoff.toISOString().split('T')[0];
}

function main() {
  const args = process.argv.slice(2);
  const cutoffDate = getCutoffDate(MIN_AGE_DAYS);
  
  const npmArgs = ['install', `--before=${cutoffDate}`, ...args];
  
  console.log(`Installing packages released on or before ${cutoffDate} (≥${MIN_AGE_DAYS} days old)...`);
  console.log(`Command: npm ${npmArgs.join(' ')}`);
  
  try {
    execSync('npm ' + npmArgs.join(' '), { stdio: 'inherit' });
  } catch (error) {
    console.error('\nInstall failed. To bypass the minimum release age check, use:');
    console.error(`  npm install --before=$(date +%Y-%m-%d) ${args.join(' ')}`);
    process.exit(error.status || 1);
  }
}

main();
