#!/usr/bin/env node

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runNodeScript, runPnpm } from "./utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageDir, "../..");
const stageDir = path.resolve(packageDir, ".stage", "app");
const stageNodeModules = path.resolve(stageDir, "node_modules");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  const nextContents = `${JSON.stringify(value, null, 2)}\n`;
  const tempPath = `${filePath}.tmp`;

  rmSync(tempPath, { force: true });
  writeFileSync(tempPath, nextContents);
  rmSync(filePath, { force: true });
  renameSync(tempPath, filePath);
}

function isInsideStage(targetPath) {
  const realTarget = realpathSync(targetPath);
  const relative = path.relative(stageDir, realTarget);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function collectScopedPackageJsons(rootDir, scopeName) {
  const packageJsons = new Set();

  const topLevelScopeDir = path.resolve(rootDir, scopeName);
  if (existsSync(topLevelScopeDir)) {
    for (const entry of readdirSync(topLevelScopeDir, { withFileTypes: true })) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const candidate = path.resolve(topLevelScopeDir, entry.name, "package.json");
      if (existsSync(candidate)) {
        packageJsons.add(candidate);
      }
    }
  }

  const pnpmDir = path.resolve(rootDir, ".pnpm");
  if (!existsSync(pnpmDir)) {
    return [...packageJsons];
  }

  const stack = [pnpmDir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const nextPath = path.resolve(current, entry.name);
      if (!entry.isDirectory()) continue;

      if (entry.name === scopeName) {
        for (const scopedEntry of readdirSync(nextPath, { withFileTypes: true })) {
          if (!scopedEntry.isDirectory()) continue;
          const candidate = path.resolve(nextPath, scopedEntry.name, "package.json");
          if (existsSync(candidate)) {
            packageJsons.add(candidate);
          }
        }
        continue;
      }

      stack.push(nextPath);
    }
  }

  return [...packageJsons];
}

function patchPublishMetadata(packageJsonPath) {
  if (!existsSync(packageJsonPath)) return false;
  if (!isInsideStage(packageJsonPath)) return false;

  const fileStat = lstatSync(packageJsonPath);
  if (fileStat.isSymbolicLink()) {
    return false;
  }

  const stat = lstatSync(path.dirname(packageJsonPath));
  if (stat.isSymbolicLink()) {
    return false;
  }

  const pkg = readJson(packageJsonPath);
  if (!pkg.name?.startsWith("@penclipai/")) return false;

  let changed = false;
  if (pkg.publishConfig?.exports) {
    pkg.exports = pkg.publishConfig.exports;
    changed = true;
  }
  if (pkg.publishConfig?.main) {
    pkg.main = pkg.publishConfig.main;
    changed = true;
  }
  if (pkg.publishConfig?.types) {
    pkg.types = pkg.publishConfig.types;
    changed = true;
  }

  if (!changed) return false;
  writeJson(packageJsonPath, pkg);
  return true;
}

console.log("[desktop-stage] Building server workspace and dependencies...");
runPnpm(["--dir", repoRoot, "--filter", "@penclipai/server...", "build"], {
  cwd: repoRoot,
});

console.log("[desktop-stage] Preparing bundled UI...");
runNodeScript(path.resolve(repoRoot, "scripts", "prepare-server-ui-dist.mjs"), [], {
  cwd: repoRoot,
});

console.log("[desktop-stage] Building Electron shell...");
runPnpm(["--dir", repoRoot, "--filter", "@penclipai/desktop-electron", "build:release"], {
  cwd: repoRoot,
});

console.log("[desktop-stage] Creating staged app directory...");
rmSync(stageDir, { recursive: true, force: true });
mkdirSync(path.dirname(stageDir), { recursive: true });

runPnpm(
  [
    "--config.node-linker=hoisted",
    "--dir",
    repoRoot,
    "--filter",
    "@penclipai/desktop-electron",
    "deploy",
    "--prod",
    stageDir,
  ],
  { cwd: repoRoot },
);

console.log("[desktop-stage] Patching deployed workspace package metadata...");
const packageJsons = collectScopedPackageJsons(stageNodeModules, "@penclipai");
let patchedCount = 0;
for (const packageJsonPath of packageJsons) {
  if (patchPublishMetadata(packageJsonPath)) {
    patchedCount += 1;
  }
}

console.log(`[desktop-stage] Patched ${patchedCount} deployed package manifests.`);
