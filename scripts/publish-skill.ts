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

import { readFileSync, readdirSync, existsSync, writeFileSync } from "fs";
import { join, dirname, basename } from "path";

const BASE_URL = "https://energized-ant-422.convex.site";
const API_KEY = "m9Rj7Lh5XVjsU6bjdUvY9Cns4ygvSEWYAMX8KmDxngE";

// --- INSTALL.md generator ---

function generateInstallMd(
  name: string,
  slug: string,
  skillDir: string,
  refFiles: string[],
  wfFiles: string[],
  skillBody: string
): string {
  const displayName = name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const hasWorkflows = wfFiles.length > 0;

  // Extract hook mentions from skill body
  const hookMentions: string[] = [];
  if (/PreToolUse/i.test(skillBody)) hookMentions.push("PreToolUse");
  if (/PostToolUse/i.test(skillBody)) hookMentions.push("PostToolUse");
  if (/SessionStart/i.test(skillBody)) hookMentions.push("SessionStart");
  if (/\bStop\b/.test(skillBody)) hookMentions.push("Stop");

  // Extract MCP mentions
  const mcpMentions: string[] = [];
  const mcpMatches = skillBody.matchAll(/`([a-z][a-z0-9-]+(?:\/[a-z][a-z0-9-]+)?)`\s+MCP|MCP\s+server[s]?\s+(?:for\s+)?["`]?([a-z][a-z0-9-]+)/gi);
  for (const m of mcpMatches) {
    const val = m[1] || m[2];
    if (val) mcpMentions.push(val);
  }

  // Phase 1: Prerequisites
  let phase1 = `## Phase 1: Prerequisites Check\n- [ ] Claude Code installed and running`;
  if (mcpMentions.length > 0) {
    for (const mcp of [...new Set(mcpMentions)]) {
      phase1 += `\n- [ ] \`${mcp}\` MCP server configured`;
    }
  }

  // Phase 2: Configuration
  let phase2 = `## Phase 2: Configuration`;
  if (hookMentions.length > 0) {
    phase2 += `\nSet up the following hooks in \`~/.claude/settings.json\`:\n\`\`\`json\n{\n  "hooks": {`;
    for (const hook of hookMentions) {
      phase2 += `\n    "${hook}": [{ "hooks": [{ "type": "command", "command": "/abs/path/to/hook.sh" }] }]`;
    }
    phase2 += `\n  }\n}\n\`\`\`\n\n**Critical:** Use absolute paths in hook commands. Relative paths silently fail.`;
  } else {
    phase2 += `\nNo hook configuration required for this skill.`;
  }
  phase2 += `\n\nChoose your preferred defaults:\n- Create \`~/.claude/skill-customizations/${slug}/PREFERENCES.md\` with your choices (see Phase 4)`;

  // Phase 3: Installation
  let phase3 = `## Phase 3: Installation\nCopy skill files to your Claude Code skills directory:\n\n\`\`\`bash\n# Create skill directory\nmkdir -p ~/.claude/skills/${slug}/references`;
  if (hasWorkflows) {
    phase3 += `\nmkdir -p ~/.claude/skills/${slug}/Workflows`;
  }
  phase3 += `\n\n# Copy SKILL.md\ncp SKILL.md ~/.claude/skills/${slug}/SKILL.md`;

  if (refFiles.length > 0) {
    phase3 += `\n\n# Copy reference files`;
    for (const f of refFiles) {
      phase3 += `\ncp references/${f} ~/.claude/skills/${slug}/references/${f}`;
    }
  }

  if (hasWorkflows) {
    phase3 += `\n\n# Copy workflow files`;
    for (const f of wfFiles) {
      phase3 += `\ncp Workflows/${f} ~/.claude/skills/${slug}/Workflows/${f}`;
    }
  }

  phase3 += `\n\`\`\``;

  // Phase 4: Customization
  const phase4 = `## Phase 4: Customization (Optional)\nCreate a customization file to override defaults:\n\`\`\`bash\nmkdir -p ~/.claude/skill-customizations/${slug}\ncat > ~/.claude/skill-customizations/${slug}/PREFERENCES.md << 'EOF'\n# Skill Customization: ${slug}\n# Add your preferences below\nEOF\n\`\`\``;

  // Phase 5: Verify
  const phase5 = `## Phase 5: Verify Installation\nRun the verification checklist: see VERIFY.md`;

  return `# Install: ${displayName}\n\n${phase1}\n\n${phase2}\n\n${phase3}\n\n${phase4}\n\n${phase5}\n`;
}

// --- VERIFY.md generator ---

function generateVerifyMd(
  name: string,
  slug: string,
  skillDir: string,
  refFiles: string[],
  wfFiles: string[]
): string {
  const displayName = name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const hasWorkflows = wfFiles.length > 0;

  // Parse test-cases.md
  const testCasesPath = join(skillDir, "references", "test-cases.md");
  let triggerTests: string[] = [];
  let noFireTests: string[] = [];
  let smokeTest = "";

  if (existsSync(testCasesPath)) {
    const tc = readFileSync(testCasesPath, "utf-8");

    // Extract trigger tests — rows with TRIGGER
    const triggerMatches = tc.matchAll(/\|\s*T\d+\s*\|\s*"([^"]+)"\s*\|\s*TRIGGER\s*\|/g);
    for (const m of triggerMatches) {
      triggerTests.push(m[1]);
    }

    // Extract no-fire tests — rows with NO TRIGGER
    const noFireMatches = tc.matchAll(/\|\s*N\d+\s*\|\s*"([^"]+)"\s*\|\s*NO TRIGGER\s*\|/g);
    for (const m of noFireMatches) {
      noFireTests.push(m[1]);
    }

    // Smoke test: first trigger test
    if (triggerTests.length > 0) {
      smokeTest = triggerTests[0];
    }
  }

  // File check section
  let fileCheck = `## File Check\n- [ ] \`~/.claude/skills/${slug}/SKILL.md\` exists`;
  for (const f of refFiles) {
    fileCheck += `\n- [ ] \`~/.claude/skills/${slug}/references/${f}\` exists`;
  }
  if (hasWorkflows) {
    for (const f of wfFiles) {
      fileCheck += `\n- [ ] \`~/.claude/skills/${slug}/Workflows/${f}\` exists`;
    }
  }

  // Trigger tests section
  let triggerSection = `## Trigger Tests\nTry these prompts — the skill should fire:`;
  if (triggerTests.length > 0) {
    for (const t of triggerTests) {
      triggerSection += `\n- [ ] "${t}" → skill activates`;
    }
  } else {
    triggerSection += `\n- [ ] (No trigger tests found in test-cases.md)`;
  }

  // No-fire tests section
  let noFireSection = `## No-Fire Tests\nTry these prompts — the skill should NOT fire:`;
  if (noFireTests.length > 0) {
    for (const t of noFireTests) {
      noFireSection += `\n- [ ] "${t}" → skill does NOT activate`;
    }
  } else {
    noFireSection += `\n- [ ] (No no-fire tests found in test-cases.md)`;
  }

  // Smoke test section
  let smokeSection = `## Quick Smoke Test`;
  if (smokeTest) {
    smokeSection += `\n1. Open Claude Code\n2. Type: "${smokeTest}"\n3. Verify the skill activates and provides relevant guidance\n4. Confirm output references the correct primitives for the goal`;
  } else {
    smokeSection += `\n1. Open Claude Code\n2. Enter a trigger phrase from Trigger Tests above\n3. Verify the skill activates`;
  }

  // Troubleshooting
  const troubleshooting = `## Troubleshooting\n- **Skill doesn't trigger:** Check that SKILL.md is at \`~/.claude/skills/${slug}/SKILL.md\`. Restart Claude Code.\n- **Partial functionality:** Verify all reference files copied. Check for missing MCP servers.\n- **Unexpected behavior:** Check \`~/.claude/skill-customizations/${slug}/\` for overrides.`;

  return `# Verify: ${displayName}\n\n${fileCheck}\n\n${triggerSection}\n\n${noFireSection}\n\n${smokeSection}\n\n${troubleshooting}\n`;
}

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

// Collect reference files (excluding test- files)
const refsDir = join(skillDir, "references");
const refFiles: string[] = [];
if (existsSync(refsDir)) {
  const allRefFiles = readdirSync(refsDir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("test-"))
    .sort();
  refFiles.push(...allRefFiles);

  for (const refFile of refFiles) {
    const refContent = readFileSync(join(refsDir, refFile), "utf-8");
    fullContent += `\n\n---\n\n<!-- reference: ${refFile} -->\n\n${refContent}`;
  }
}

// Collect workflow files
const workflowsDir = join(skillDir, "Workflows");
const wfFiles: string[] = [];
if (existsSync(workflowsDir)) {
  const allWfFiles = readdirSync(workflowsDir)
    .filter((f) => f.endsWith(".md"))
    .sort();
  wfFiles.push(...allWfFiles);

  for (const wfFile of wfFiles) {
    const wfContent = readFileSync(join(workflowsDir, wfFile), "utf-8");
    fullContent += `\n\n---\n\n<!-- workflow: ${wfFile} -->\n\n${wfContent}`;
  }
}

// Generate INSTALL.md and VERIFY.md
const installContent = generateInstallMd(name, slug, skillDir, refFiles, wfFiles, body);
const verifyContent = generateVerifyMd(name, slug, skillDir, refFiles, wfFiles);

writeFileSync(join(skillDir, "INSTALL.md"), installContent);
writeFileSync(join(skillDir, "VERIFY.md"), verifyContent);

console.log(`Generated: INSTALL.md (${installContent.length} chars)`);
console.log(`Generated: VERIFY.md (${verifyContent.length} chars)`);

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
  installGuide: installContent,
  verifyChecklist: verifyContent,
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
