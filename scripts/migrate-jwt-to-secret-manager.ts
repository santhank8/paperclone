/**
 * Migrate JWT signing secret from .env to GCP Secret Manager.
 *
 * Usage:
 *   npx tsx scripts/migrate-jwt-to-secret-manager.ts --dry-run
 *   npx tsx scripts/migrate-jwt-to-secret-manager.ts --apply
 *
 * Prerequisites:
 *   - PAPERCLIP_GCP_PROJECT_ID env var set
 *   - GOOGLE_APPLICATION_CREDENTIALS or ADC configured
 *   - @google-cloud/secret-manager installed (already in server deps)
 *
 * What it does:
 *   1. Reads PAPERCLIP_AGENT_JWT_SECRET from .env
 *   2. Creates/updates the secret in GCP Secret Manager
 *   3. Prints the env var changes needed (.env update)
 *
 * After running with --apply:
 *   1. Set PAPERCLIP_AGENT_JWT_SECRET_SM_NAME in your .env
 *   2. Set PAPERCLIP_AGENT_JWT_SECRET_PREVIOUS to the old secret value
 *   3. Remove PAPERCLIP_AGENT_JWT_SECRET from .env
 *   4. Restart the server — it will load from SM
 *   5. After 48h (token TTL), remove PAPERCLIP_AGENT_JWT_SECRET_PREVIOUS
 */

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const GCP_SECRET_NAME = "paperclip-agent-jwt-secret";

async function main() {
  const apply = process.argv.includes("--apply");
  const rotate = process.argv.includes("--rotate");

  const gcpProject = process.env.PAPERCLIP_GCP_PROJECT_ID;
  if (!gcpProject) {
    console.error("Error: PAPERCLIP_GCP_PROJECT_ID must be set");
    process.exit(1);
  }

  // Read current secret from env or .env file
  let currentSecret = process.env.PAPERCLIP_AGENT_JWT_SECRET;
  if (!currentSecret) {
    const envPath = resolve(process.cwd(), ".env");
    if (existsSync(envPath)) {
      const envContent = readFileSync(envPath, "utf8");
      const match = envContent.match(
        /^PAPERCLIP_AGENT_JWT_SECRET=(.+)$/m,
      );
      if (match) currentSecret = match[1].trim().replace(/^["']|["']$/g, "");
    }
  }

  if (!currentSecret && !rotate) {
    console.error(
      "Error: No JWT secret found. Set PAPERCLIP_AGENT_JWT_SECRET or use --rotate to generate a new one.",
    );
    process.exit(1);
  }

  const secretValue = rotate
    ? randomBytes(64).toString("base64url")
    : currentSecret!;

  console.log(`GCP Project: ${gcpProject}`);
  console.log(`Secret name: ${GCP_SECRET_NAME}`);
  console.log(
    `Mode: ${rotate ? "rotate (new random secret)" : "migrate (existing secret)"}`,
  );
  console.log(`Apply: ${apply ? "YES" : "no (dry run)"}`);
  console.log();

  if (!apply) {
    console.log("Dry run — no changes made. Pass --apply to execute.\n");
    printPostSteps(rotate, currentSecret);
    return;
  }

  // Import GCP SDK
  let mod: typeof import("@google-cloud/secret-manager");
  try {
    mod = await import("@google-cloud/secret-manager");
  } catch {
    console.error(
      "Error: @google-cloud/secret-manager not installed. Run: pnpm add @google-cloud/secret-manager",
    );
    process.exit(1);
  }

  const client = new mod.SecretManagerServiceClient();
  const secretParent = `projects/${gcpProject}/secrets/${GCP_SECRET_NAME}`;

  // Create secret resource if needed
  try {
    await client.getSecret({ name: secretParent });
    console.log(`Secret resource exists: ${secretParent}`);
  } catch (err: unknown) {
    const code = (err as { code?: number }).code;
    if (code === 5 /* NOT_FOUND */) {
      console.log(`Creating secret resource: ${secretParent}`);
      await client.createSecret({
        parent: `projects/${gcpProject}`,
        secretId: GCP_SECRET_NAME,
        secret: { replication: { automatic: {} } },
      });
    } else {
      throw err;
    }
  }

  // Add new version
  console.log("Adding secret version...");
  const [version] = await client.addSecretVersion({
    parent: secretParent,
    payload: { data: Buffer.from(secretValue, "utf8") },
  });
  console.log(`Created version: ${version.name}`);
  console.log();

  printPostSteps(rotate, currentSecret);
}

function printPostSteps(rotate: boolean, oldSecret: string | undefined) {
  console.log("=== Post-migration steps ===\n");
  console.log("Update your .env (or Cloud Run env vars):\n");
  console.log(`  # Add these:`);
  console.log(
    `  PAPERCLIP_AGENT_JWT_SECRET_SM_NAME=${GCP_SECRET_NAME}`,
  );

  if (oldSecret) {
    console.log(
      `  PAPERCLIP_AGENT_JWT_SECRET_PREVIOUS=${oldSecret}`,
    );
  }

  console.log();
  console.log(`  # Remove this:`);
  console.log(`  # PAPERCLIP_AGENT_JWT_SECRET=...`);
  console.log();
  console.log("Then restart the server. After 48h (token TTL window):");
  console.log("  - Remove PAPERCLIP_AGENT_JWT_SECRET_PREVIOUS");
  console.log();
  console.log("To verify: check server logs for");
  console.log(
    '  "[agent-auth-jwt] Loaded JWT secret from GCP Secret Manager"',
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
