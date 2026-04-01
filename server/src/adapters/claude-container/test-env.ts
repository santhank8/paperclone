import { execSync } from "node:child_process";
import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";
import { asString, parseObject } from "../utils.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((c) => c.level === "error")) return "fail";
  if (checks.some((c) => c.level === "warn")) return "warn";
  return "pass";
}

function tryExec(cmd: string): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, { timeout: 10_000, encoding: "utf-8" });
    return { ok: true, output: output.trim() };
  } catch (err) {
    return { ok: false, output: err instanceof Error ? err.message : String(err) };
  }
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const image = asString(config.image, "nanoclaw-agent:latest");
  const network = asString(config.network, "pkb-net");

  const dockerCheck = tryExec("docker --version");
  if (!dockerCheck.ok) {
    checks.push({
      code: "container_docker_missing",
      level: "error",
      message: "Docker is not available on this system.",
      hint: "Install Docker: https://docs.docker.com/engine/install/",
    });
  } else {
    checks.push({
      code: "container_docker_available",
      level: "info",
      message: `Docker available: ${dockerCheck.output}`,
    });

    const imageCheck = tryExec(`docker image inspect ${image} --format "{{.Id}}"`);
    if (!imageCheck.ok) {
      checks.push({
        code: "container_image_missing",
        level: "warn",
        message: `Docker image "${image}" not found locally.`,
        hint: `Build or pull the image: docker build -t ${image} .`,
      });
    } else {
      checks.push({
        code: "container_image_available",
        level: "info",
        message: `Docker image "${image}" is available.`,
      });
    }

    const networkCheck = tryExec(`docker network inspect ${network} --format "{{.Id}}"`);
    if (!networkCheck.ok) {
      checks.push({
        code: "container_network_missing",
        level: "warn",
        message: `Docker network "${network}" not found.`,
        hint: `Create the network: docker network create ${network}`,
      });
    } else {
      checks.push({
        code: "container_network_available",
        level: "info",
        message: `Docker network "${network}" exists.`,
      });
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
