import fs from "node:fs/promises";
import path from "node:path";
import { resolveDefaultAgentRuntimeDir } from "../home-paths.js";

const DEFAULT_CONTAINER_AGENTS_DIR = "/paperclip-agents";

function getAgentRuntimeDir() {
  const fromEnv = process.env.PAPERCLIP_AGENT_RUNTIME_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return resolveDefaultAgentRuntimeDir();
}

function getContainerAgentsDir() {
  const fromEnv = process.env.PAPERCLIP_AGENTS_DIR_IN_CONTAINER?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return DEFAULT_CONTAINER_AGENTS_DIR;
}

async function isReadableFile(filePath: string) {
  return fs.stat(filePath).then((s) => s.isFile()).catch(() => false);
}

function configuredPathSuffixFromAgentsDir(configuredPath: string): string | null {
  const normalized = configuredPath.replace(/\\/g, "/");
  const match = normalized.match(/(?:^|\/)agents\/(.+)$/);
  return match?.[1] ?? null;
}

async function resolveReadableInstructionsSource(
  configuredPath: string,
  workspaceCwd?: string | null,
): Promise<string | null> {
  const trimmed = configuredPath.trim();
  if (!trimmed) return null;

  const candidates: string[] = [];
  if (path.isAbsolute(trimmed)) {
    candidates.push(trimmed);

    const suffix = configuredPathSuffixFromAgentsDir(trimmed);
    if (suffix) {
      candidates.push(path.join(getContainerAgentsDir(), ...suffix.split("/")));
    }
  } else {
    if (workspaceCwd && workspaceCwd.trim().length > 0) {
      candidates.push(path.resolve(workspaceCwd, trimmed));
    }
    candidates.push(path.resolve(process.cwd(), trimmed));
  }

  for (const candidate of candidates) {
    if (await isReadableFile(candidate)) return candidate;
  }
  return null;
}

async function writeIfChanged(targetPath: string, contents: string) {
  const existing = await fs.readFile(targetPath, "utf8").catch(() => null);
  if (existing === contents) return false;
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, contents, "utf8");
  return true;
}

export async function materializeAgentInstructionsForRuntime(input: {
  agentId: string;
  configuredPath: string;
  workspaceCwd?: string | null;
}): Promise<{
  runtimePath: string | null;
  sourcePath: string | null;
  copied: boolean;
}> {
  const configuredPath = input.configuredPath.trim();
  if (!configuredPath) {
    return { runtimePath: null, sourcePath: null, copied: false };
  }

  const runtimePath = path.join(getAgentRuntimeDir(), input.agentId, "AGENTS.md");
  const sourcePath = await resolveReadableInstructionsSource(configuredPath, input.workspaceCwd);

  if (sourcePath) {
    const contents = await fs.readFile(sourcePath, "utf8");
    const copied = await writeIfChanged(runtimePath, contents);
    return { runtimePath, sourcePath, copied };
  }

  if (await isReadableFile(runtimePath)) {
    return { runtimePath, sourcePath: null, copied: false };
  }

  return { runtimePath: null, sourcePath: null, copied: false };
}
