#!/usr/bin/env bun
export {};
/**
 * Publish a skill to aiskillslab.dev catalog.
 *
 * Reads a SKILL.md, extracts frontmatter, concatenates reference files,
 * and pushes to the Convex skills table via HTTP API.
 *
 * Usage:
 *   bun run scripts/publish-skill.ts skills/agent-building/autonomous-agent/SKILL.md
 *   bun run scripts/publish-skill.ts skills/agent-building/persistent-memory/SKILL.md
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname, basename } from "path";

const BASE_URL = "https://energized-ant-422.convex.site";
const API_KEY = "m9Rj7Lh5XVjsU6bjdUvY9Cns4ygvSEWYAMX8KmDxngE";

const skillPath = process.argv[2];
if (!skillPath) {
  console.error("Usage: publish-skill.ts <path/to/SKILL.md>");
  process.exit(1);
}

// Read SKILL.md
const raw = readFileSync(skillPath, "utf-8");

// Parse frontmatter
const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
if (!fmMatch) {
  console.error("No frontmatter found in SKILL.md");
  process.exit(1);
}

const frontmatter = fmMatch[1];
const body = fmMatch[2];

// Extract fields from frontmatter
function getFmField(fm: string, field: string): string {
  const match = fm.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return match ? match[1].trim() : "";
}

const name = getFmField(frontmatter, "name");
const description = getFmField(frontmatter, "description");
const version = getFmField(frontmatter, "version") || "1.0.0";

if (!name) {
  console.error("SKILL.md frontmatter missing 'name' field");
  process.exit(1);
}

// Derive slug from path, category from frontmatter (with directory fallback)
// e.g. skills/agent-building/autonomous-agent/SKILL.md
const skillDir = dirname(skillPath);
const slug = basename(skillDir);
const category = getFmField(frontmatter, "category") || basename(dirname(skillDir));

// Strip frontmatter, use body only
let fullContent = fmMatch[2].trim();
const refsDir = join(skillDir, "references");
if (existsSync(refsDir)) {
  const refFiles = readdirSync(refsDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("test-"))
    .sort();

  for (const refFile of refFiles) {
    const refContent = readFileSync(join(refsDir, refFile), "utf-8");
    fullContent += `\n\n---\n\n<!-- reference: ${refFile} -->\n\n${refContent}`;
  }
}

// After reference file bundling, add workflow bundling
const workflowsDir = join(skillDir, "Workflows");
if (existsSync(workflowsDir)) {
  const wfFiles = readdirSync(workflowsDir)
    .filter((f) => f.endsWith(".md"))
    .sort();

  for (const wfFile of wfFiles) {
    const wfContent = readFileSync(join(workflowsDir, wfFile), "utf-8");
    fullContent += `\n\n---\n\n<!-- workflow: ${wfFile} -->\n\n${wfContent}`;
  }
}

// Extract tags from keywords in description
const tags = name
  .split("-")
  .concat(category.split("-"))
  .filter((t) => t.length > 2);

// Publish
const payload = {
  name: name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
  slug,
  description,
  content: fullContent,
  category,
  version,
  providers: ["claude-code"],
  tags,
};

console.log(`Publishing: ${payload.name} (${slug}) v${version}`);
console.log(`  Category: ${category}`);
console.log(`  Version:  ${version}`);
console.log(`  Content:  ${fullContent.length} chars`);

const res = await fetch(`${BASE_URL}/api/skills/publish`, {
  method: "POST",
  headers: {
    "x-agent-key": API_KEY,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

if (!res.ok) {
  console.error(`Error: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const result = await res.json();
console.log(`Done: ${(result as { action: string }).action} (ID: ${(result as { id: string }).id})`);
