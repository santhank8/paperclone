import * as p from "@clack/prompts";
import pc from "picocolors";
import type { PaperclipConfig } from "../config/schema.js";
import { readConfig, resolveConfigPath } from "../config/store.js";
import {
  agentJwtSecretCheck,
  configCheck,
  databaseCheck,
  deploymentAuthCheck,
  llmCheck,
  logCheck,
  portCheck,
  secretsCheck,
  storageCheck,
  type CheckResult,
} from "../checks/index.js";
import { loadPaperclipEnvFile } from "../config/env.js";
import { printPaperclipCliBanner } from "../utils/banner.js";
import {
  resolveEffectiveDeploymentConfig,
  hasCompleteEnvConfig,
  type EffectiveDeploymentConfig,
} from "../config/effective.js";

const STATUS_ICON = {
  pass: pc.green("✓"),
  warn: pc.yellow("!"),
  fail: pc.red("✗"),
} as const;

export async function doctor(opts: {
  config?: string;
  repair?: boolean;
  yes?: boolean;
}): Promise<{ passed: number; warned: number; failed: number }> {
  printPaperclipCliBanner();
  p.intro(pc.bgCyan(pc.black(" paperclip doctor ")));

  const configPath = resolveConfigPath(opts.config);
  loadPaperclipEnvFile(configPath);
  const results: CheckResult[] = [];

  // 1. Config check (may warn instead of fail in env-driven mode)
  const cfgResult = configCheck(opts.config);
  results.push(cfgResult);
  printResult(cfgResult);

  // If config check failed hard (no config and no complete env), stop here
  if (cfgResult.status === "fail") {
    return printSummary(results);
  }

  // Get effective config (from env and/or file)
  const effectiveConfig = resolveEffectiveDeploymentConfig(configPath);
  const config = effectiveConfig.config;

  // In env-only mode, we can still run some checks
  if (!config && effectiveConfig.databaseUrl) {
    // Run checks that work with env-only config
    results.push(...await runEnvOnlyChecks(effectiveConfig, configPath, opts));
    return printSummary(results);
  }

  // Standard flow with config file
  if (!config) {
    const readResult: CheckResult = {
      name: "Config file",
      status: "fail",
      message: "Could not read config and env vars are incomplete",
      canRepair: false,
      repairHint: "Run `paperclipai configure --section database` or `paperclipai onboard`",
    };
    results.push(readResult);
    printResult(readResult);
    return printSummary(results);
  }

  // 2. Deployment/auth mode check
  const deploymentAuthResult = deploymentAuthCheck(config);
  results.push(deploymentAuthResult);
  printResult(deploymentAuthResult);

  // 3. Agent JWT check
  results.push(
    await runRepairableCheck({
      run: () => agentJwtSecretCheck(opts.config),
      configPath,
      opts,
    }),
  );

  // 4. Secrets adapter check
  results.push(
    await runRepairableCheck({
      run: () => secretsCheck(config, configPath),
      configPath,
      opts,
    }),
  );

  // 5. Storage check
  results.push(
    await runRepairableCheck({
      run: () => storageCheck(config, configPath),
      configPath,
      opts,
    }),
  );

  // 6. Database check
  results.push(
    await runRepairableCheck({
      run: () => databaseCheck(config, configPath),
      configPath,
      opts,
    }),
  );

  // 7. LLM check
  const llmResult = await llmCheck(config);
  results.push(llmResult);
  printResult(llmResult);

  // 8. Log directory check
  results.push(
    await runRepairableCheck({
      run: () => logCheck(config, configPath),
      configPath,
      opts,
    }),
  );

  // 9. Port check
  const portResult = await portCheck(config);
  results.push(portResult);
  printResult(portResult);

  // Summary
  return printSummary(results);
}

/**
 * Run checks that work in env-only mode (no config file).
 */
async function runEnvOnlyChecks(
  effectiveConfig: EffectiveDeploymentConfig,
  configPath: string,
  opts: { repair?: boolean; yes?: boolean },
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // Deployment mode check from env
  const deploymentModeResult: CheckResult = {
    name: "Deployment mode",
    status: "pass",
    message: `Running in ${effectiveConfig.deploymentMode} mode (from environment)`,
  };
  results.push(deploymentModeResult);
  printResult(deploymentModeResult);

  // Database URL check
  const dbUrlResult: CheckResult = effectiveConfig.databaseUrl
    ? {
        name: "Database",
        status: "pass",
        message: "DATABASE_URL is set",
      }
    : {
        name: "Database",
        status: "fail",
        message: "DATABASE_URL is not set",
        canRepair: false,
        repairHint: "Set DATABASE_URL environment variable",
      };
  results.push(dbUrlResult);
  printResult(dbUrlResult);

  // Public URL check (warning if missing in authenticated mode)
  if (effectiveConfig.deploymentMode === "authenticated") {
    const publicUrlResult: CheckResult = effectiveConfig.publicBaseUrl
      ? {
          name: "Public URL",
          status: "pass",
          message: `Public URL: ${effectiveConfig.publicBaseUrl}`,
        }
      : {
          name: "Public URL",
          status: "warn",
          message: "No public URL configured (PAPERCLIP_PUBLIC_URL not set)",
          canRepair: false,
          repairHint: "Set PAPERCLIP_PUBLIC_URL for proper invite links and auth redirects",
        };
    results.push(publicUrlResult);
    printResult(publicUrlResult);
  }

  // Agent JWT check (works in env-only mode)
  results.push(
    await runRepairableCheck({
      run: () => agentJwtSecretCheck(configPath),
      configPath,
      opts,
    }),
  );

  return results;
}

function printResult(result: CheckResult): void {
  const icon = STATUS_ICON[result.status];
  p.log.message(`${icon} ${pc.bold(result.name)}: ${result.message}`);
  if (result.status !== "pass" && result.repairHint) {
    p.log.message(`  ${pc.dim(result.repairHint)}`);
  }
}

async function maybeRepair(
  result: CheckResult,
  opts: { repair?: boolean; yes?: boolean },
): Promise<boolean> {
  if (result.status === "pass" || !result.canRepair || !result.repair) return false;
  if (!opts.repair) return false;

  let shouldRepair = opts.yes;
  if (!shouldRepair) {
    const answer = await p.confirm({
      message: `Repair "${result.name}"?`,
      initialValue: true,
    });
    if (p.isCancel(answer)) return false;
    shouldRepair = answer;
  }

  if (shouldRepair) {
    try {
      await result.repair();
      p.log.success(`Repaired: ${result.name}`);
      return true;
    } catch (err) {
      p.log.error(`Repair failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return false;
}

async function runRepairableCheck(input: {
  run: () => CheckResult | Promise<CheckResult>;
  configPath: string;
  opts: { repair?: boolean; yes?: boolean };
}): Promise<CheckResult> {
  let result = await input.run();
  printResult(result);

  const repaired = await maybeRepair(result, input.opts);
  if (!repaired) return result;

  // Repairs may create/update the adjacent .env file or other local resources.
  loadPaperclipEnvFile(input.configPath);
  result = await input.run();
  printResult(result);
  return result;
}

function printSummary(results: CheckResult[]): { passed: number; warned: number; failed: number } {
  const passed = results.filter((r) => r.status === "pass").length;
  const warned = results.filter((r) => r.status === "warn").length;
  const failed = results.filter((r) => r.status === "fail").length;

  const parts: string[] = [];
  parts.push(pc.green(`${passed} passed`));
  if (warned) parts.push(pc.yellow(`${warned} warnings`));
  if (failed) parts.push(pc.red(`${failed} failed`));

  p.note(parts.join(", "), "Summary");

  if (failed > 0) {
    p.outro(pc.red("Some checks failed. Fix the issues above and re-run doctor."));
  } else if (warned > 0) {
    p.outro(pc.yellow("All critical checks passed with some warnings."));
  } else {
    p.outro(pc.green("All checks passed!"));
  }

  return { passed, warned, failed };
}
