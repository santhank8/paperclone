#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

function resolveTarget(target) {
  return path.resolve(process.cwd(), target);
}

async function removeTargets(targets) {
  await Promise.all(targets.map((target) => fs.rm(resolveTarget(target), { recursive: true, force: true })));
}

async function ensureDirectories(targets) {
  await Promise.all(targets.map((target) => fs.mkdir(resolveTarget(target), { recursive: true })));
}

async function copyTarget(source, destination, copyContents) {
  const sourcePath = resolveTarget(source);
  const destinationPath = resolveTarget(destination);

  if (!copyContents) {
    await fs.cp(sourcePath, destinationPath, { recursive: true, force: true });
    return;
  }

  await fs.mkdir(destinationPath, { recursive: true });
  const entries = await fs.readdir(sourcePath, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    await fs.cp(
      path.join(sourcePath, entry.name),
      path.join(destinationPath, entry.name),
      { recursive: true, force: true },
    );
  }));
}

async function moveTarget(source, destination, ignoreMissing) {
  const sourcePath = resolveTarget(source);
  const destinationPath = resolveTarget(destination);
  try {
    await fs.rename(sourcePath, destinationPath);
  } catch (error) {
    if (ignoreMissing && error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

async function chmodTarget(target, mode) {
  if (process.platform === "win32") return;
  await fs.chmod(resolveTarget(target), Number.parseInt(mode, 8));
}

async function main() {
  const [command, ...rawArgs] = process.argv.slice(2);

  if (!command) {
    throw new Error("Missing command");
  }

  switch (command) {
    case "rm":
      if (rawArgs.length === 0) throw new Error("rm requires at least one target");
      await removeTargets(rawArgs);
      return;
    case "mkdir":
      if (rawArgs.length === 0) throw new Error("mkdir requires at least one target");
      await ensureDirectories(rawArgs);
      return;
    case "cp": {
      const copyContents = rawArgs.includes("--contents");
      const args = rawArgs.filter((arg) => arg !== "--contents");
      if (args.length !== 2) throw new Error("cp requires <source> <destination>");
      await copyTarget(args[0], args[1], copyContents);
      return;
    }
    case "mv": {
      const ignoreMissing = rawArgs.includes("--if-exists");
      const args = rawArgs.filter((arg) => arg !== "--if-exists");
      if (args.length !== 2) throw new Error("mv requires <source> <destination>");
      await moveTarget(args[0], args[1], ignoreMissing);
      return;
    }
    case "chmod":
      if (rawArgs.length < 1 || rawArgs.length > 2) throw new Error("chmod requires <target> [mode]");
      await chmodTarget(rawArgs[0], rawArgs[1] ?? "755");
      return;
    default:
      throw new Error(`Unsupported command: ${command}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
