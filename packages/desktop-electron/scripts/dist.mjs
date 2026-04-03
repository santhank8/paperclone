#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runNodeScript, runPnpm } from "./utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(packageDir, "..", "..");
const releaseDir = path.resolve(packageDir, "release");
const generatedWorkspaceDir = path.resolve(packageDir, "packages");
const stageNodeModulesDir = path.resolve(packageDir, ".stage", "app", "node_modules");
const bundledSkillsDir = path.resolve(repoRoot, "skills");
const winUnpackedDir = path.resolve(releaseDir, "win-unpacked");
const packagedRuntimeDir = path.resolve(winUnpackedDir, "resources", "app-runtime");
const packagedRuntimeNodeModulesDir = path.resolve(
  packagedRuntimeDir,
  "node_modules",
);
const packagedRuntimeSkillsDir = path.resolve(packagedRuntimeDir, "skills");
const prepareStageScript = path.resolve(packageDir, "scripts", "prepare-stage.mjs");
const expectedExecutablePath = path.resolve(winUnpackedDir, "Paperclip CN.exe");

function parseArgs(argv) {
  return {
    dirOnly: argv.includes("--dir-only"),
  };
}

function listRequiredTopLevelPackages(nodeModulesDir) {
  return readdirSync(nodeModulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== ".bin" && name !== ".pnpm")
    .sort((left, right) => left.localeCompare(right));
}

function listSkillDirectories(skillsDir) {
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

function resolveInstallerArtifacts() {
  if (!existsSync(releaseDir)) {
    return [];
  }

  return readdirSync(releaseDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".exe"))
    .map((entry) => path.resolve(releaseDir, entry.name));
}

function verifyPackagedRuntime() {
  if (!existsSync(expectedExecutablePath)) {
    throw new Error(`Missing unpacked executable: ${expectedExecutablePath}`);
  }

  if (!existsSync(stageNodeModulesDir)) {
    throw new Error(`Missing staged runtime node_modules: ${stageNodeModulesDir}`);
  }

  if (!existsSync(bundledSkillsDir)) {
    throw new Error(`Missing bundled Paperclip skills: ${bundledSkillsDir}`);
  }

  if (!existsSync(packagedRuntimeNodeModulesDir)) {
    throw new Error(`Missing packaged runtime node_modules: ${packagedRuntimeNodeModulesDir}`);
  }

  if (!existsSync(packagedRuntimeSkillsDir)) {
    throw new Error(`Missing packaged runtime skills directory: ${packagedRuntimeSkillsDir}`);
  }

  const stagedPackages = listRequiredTopLevelPackages(stageNodeModulesDir);
  const packagedPackages = new Set(listRequiredTopLevelPackages(packagedRuntimeNodeModulesDir));
  const missingTopLevelPackages = stagedPackages.filter((name) => !packagedPackages.has(name));

  if (missingTopLevelPackages.length > 0) {
    throw new Error(
      `Packaged runtime is missing top-level node_modules entries: ${missingTopLevelPackages.join(", ")}`,
    );
  }

  const requiredPaths = [
    path.resolve(packagedRuntimeNodeModulesDir, "@aws-sdk", "client-s3"),
    path.resolve(packagedRuntimeNodeModulesDir, "@embedded-postgres", "windows-x64"),
    path.resolve(packagedRuntimeNodeModulesDir, "@penclipai", "server"),
    path.resolve(packagedRuntimeNodeModulesDir, "@penclipai", "db"),
    path.resolve(packagedRuntimeNodeModulesDir, "@penclipai", "shared"),
  ];

  for (const requiredPath of requiredPaths) {
    if (!existsSync(requiredPath)) {
      throw new Error(`Packaged runtime is missing required dependency path: ${requiredPath}`);
    }
  }

  const sourceSkillDirs = listSkillDirectories(bundledSkillsDir);
  const packagedSkillDirs = new Set(listSkillDirectories(packagedRuntimeSkillsDir));
  const missingSkillDirs = sourceSkillDirs.filter((name) => !packagedSkillDirs.has(name));

  if (missingSkillDirs.length > 0) {
    throw new Error(
      `Packaged runtime is missing bundled Paperclip skills: ${missingSkillDirs.join(", ")}`,
    );
  }

  console.log(
    `[desktop-dist] Verified packaged runtime completeness (${stagedPackages.length} top-level package roots, ${sourceSkillDirs.length} bundled skills).`,
  );
}

function runPowerShell(command, { ignoreFailure = false } = {}) {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", command],
    {
      cwd: packageDir,
      stdio: "inherit",
      windowsHide: true,
    },
  );

  if (ignoreFailure) {
    return result;
  }

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`PowerShell command failed with exit code ${result.status}`);
  }

  return result;
}

function sleepMs(milliseconds) {
  if (milliseconds <= 0) {
    return;
  }

  runPowerShell(`Start-Sleep -Milliseconds ${milliseconds}`, { ignoreFailure: true });
}

function stopProcessesUsingReleaseDir() {
  if (process.platform !== "win32" || !existsSync(releaseDir)) {
    return;
  }

  const escapedReleaseDir = releaseDir.replace(/'/g, "''");
  runPowerShell(
    `
$releaseDir = '${escapedReleaseDir}';
Get-Process -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -and $_.Path.StartsWith($releaseDir, [System.StringComparison]::OrdinalIgnoreCase) } |
  Stop-Process -Force -ErrorAction SilentlyContinue
`,
    { ignoreFailure: true },
  );
}

function removePathWithRetries(targetPath, description, attempts = 4) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      rmSync(targetPath, { recursive: true, force: true });
      return;
    } catch (error) {
      const retryable =
        error &&
        typeof error === "object" &&
        "code" in error &&
        ["EPERM", "EBUSY", "ENOTEMPTY"].includes(error.code);

      if (!retryable || attempt === attempts) {
        throw error;
      }

      console.warn(
        `[desktop-dist] Retry ${attempt}/${attempts - 1} while removing ${description}; attempting to stop lingering packaged processes...`,
      );
      stopProcessesUsingReleaseDir();
      sleepMs(750);
    }
  }
}

function cleanReleaseArtifacts() {
  stopProcessesUsingReleaseDir();
  removePathWithRetries(releaseDir, "release directory");
  removePathWithRetries(generatedWorkspaceDir, "generated workspace directory");
}

function buildUnpackedWindowsApp() {
  runPnpm(
    ["exec", "electron-builder", "--config", "electron-builder.yml", "--dir", "--win", "--publish", "never"],
    { cwd: packageDir },
  );
}

function copyRuntimeAssetsIntoUnpackedApp() {
  if (!existsSync(stageNodeModulesDir)) {
    throw new Error(`Missing staged runtime node_modules: ${stageNodeModulesDir}`);
  }
  if (!existsSync(bundledSkillsDir)) {
    throw new Error(`Missing bundled Paperclip skills: ${bundledSkillsDir}`);
  }
  if (!existsSync(winUnpackedDir)) {
    throw new Error(`Missing win-unpacked output: ${winUnpackedDir}`);
  }

  rmSync(packagedRuntimeDir, { recursive: true, force: true });
  mkdirSync(packagedRuntimeDir, { recursive: true });
  cpSync(stageNodeModulesDir, packagedRuntimeNodeModulesDir, { recursive: true, force: true });
  // Packaged local adapters and the packaged server both expect the bundled
  // Paperclip skills to live alongside the runtime node_modules tree.
  cpSync(bundledSkillsDir, packagedRuntimeSkillsDir, { recursive: true, force: true });

  console.log("[desktop-dist] Copied staged runtime assets into win-unpacked/resources/app-runtime.");
}

function buildWindowsInstallerFromPrepackagedApp() {
  runPnpm(
    [
      "exec",
      "electron-builder",
      "--config",
      "electron-builder.yml",
      "--win",
      "nsis",
      "--prepackaged",
      winUnpackedDir,
      "--publish",
      "never",
    ],
    { cwd: packageDir },
  );
}

function verifyInstallerArtifacts() {
  const installerArtifacts = resolveInstallerArtifacts();
  if (installerArtifacts.length === 0) {
    throw new Error(`No Windows installer artifact was produced in ${releaseDir}`);
  }

  console.log(
    `[desktop-dist] Installer artifacts: ${installerArtifacts.map((artifact) => path.basename(artifact)).join(", ")}`,
  );
}

function run() {
  const { dirOnly } = parseArgs(process.argv.slice(2));

  cleanReleaseArtifacts();

  console.log("[desktop-dist] Preparing staged desktop runtime...");
  runNodeScript(prepareStageScript, [], { cwd: packageDir });

  console.log("[desktop-dist] Building verified win-unpacked output...");
  buildUnpackedWindowsApp();
  copyRuntimeAssetsIntoUnpackedApp();
  verifyPackagedRuntime();

  if (dirOnly) {
    return;
  }

  console.log("[desktop-dist] Building NSIS installer from verified win-unpacked output...");
  buildWindowsInstallerFromPrepackagedApp();
  verifyInstallerArtifacts();
}

try {
  run();
} catch (error) {
  console.error("[desktop-dist] Failed:", error);
  process.exitCode = 1;
}
