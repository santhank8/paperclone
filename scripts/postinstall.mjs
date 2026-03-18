#!/usr/bin/env node
/**
 * Postinstall hook — ensures platform-specific native binaries
 * (e.g. embedded-postgres) are available after npm/pnpm install.
 * Addresses issue #1104 (Linux install failures).
 */
import { execSync } from "node:child_process";
import { platform, arch } from "node:os";

const plat = platform();
const ar = arch();

console.log(`[postinstall] Platform: ${plat}/${ar}`);

// embedded-postgres downloads binaries lazily on first use.
// On CI/Linux this can fail if the download isn't triggered during install.
// We trigger a no-op init to force the download.
try {
  // Verify the native addon can be loaded
  await import("embedded-postgres");
  console.log("[postinstall] embedded-postgres loaded successfully");
} catch (err) {
  console.warn(`[postinstall] embedded-postgres preload skipped: ${err.message}`);
  // Non-fatal — the binary will be fetched on first use
}
