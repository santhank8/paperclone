/**
 * Resolves the monorepo root from the server service layer.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export function resolveServerRepoRoot() {
  return repoRoot;
}
