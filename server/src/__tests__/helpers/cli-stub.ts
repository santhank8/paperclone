/**
 * Fake CLIs for adapter execute/env tests. Unix uses a shebang script; Windows uses
 * .cmd + .cjs because spawn cannot execute extensionless scripts.
 */
import fs from "node:fs/promises";
import path from "node:path";

export async function installNodeCliStub(
  directory: string,
  baseName: string,
  cjsBody: string,
): Promise<string> {
  if (process.platform === "win32") {
    const runner = path.join(directory, `${baseName}-stub.cjs`);
    await fs.writeFile(runner, cjsBody, "utf8");
    const cmdPath = path.join(directory, `${baseName}.cmd`);
    const node = process.execPath;
    await fs.writeFile(
      cmdPath,
      `@echo off\r\n"${node}" "${runner}" %*\r\n`,
      "utf8",
    );
    return cmdPath;
  }
  const unixPath = path.join(directory, baseName);
  await fs.writeFile(
    unixPath,
    `#!/usr/bin/env node\n${cjsBody}`,
    "utf8",
  );
  try {
    await fs.chmod(unixPath, 0o755);
  } catch {
    /* Windows */
  }
  return unixPath;
}
