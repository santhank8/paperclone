import {
  ensureAgentJwtSecret,
  readAgentJwtSecretFromEnv,
  readAgentJwtSecretFromEnvFile,
  resolveAgentJwtEnvFile,
} from "../config/env.js";
import type { CheckResult } from "./index.js";

export function agentJwtSecretCheck(configPath?: string): CheckResult {
  if (readAgentJwtSecretFromEnv(configPath)) {
    return {
      name: "智能体 JWT 密钥",
      status: "pass",
      message: "PAPERCLIP_AGENT_JWT_SECRET 已在环境变量中设置",
    };
  }

  const envPath = resolveAgentJwtEnvFile(configPath);
  const fileSecret = readAgentJwtSecretFromEnvFile(envPath);

  if (fileSecret) {
    return {
      name: "智能体 JWT 密钥",
      status: "warn",
      message: `PAPERCLIP_AGENT_JWT_SECRET 存在于 ${envPath} 但未加载到环境变量中`,
      repairHint: `在启动 Paperclip 服务器之前，请在 shell 中设置 ${envPath} 中的值`,
    };
  }

  return {
    name: "智能体 JWT 密钥",
    status: "fail",
    message: `PAPERCLIP_AGENT_JWT_SECRET 在环境变量和 ${envPath} 中均缺失`,
    canRepair: true,
    repair: () => {
      ensureAgentJwtSecret(configPath);
    },
    repairHint: `使用 --repair 运行以创建包含 PAPERCLIP_AGENT_JWT_SECRET 的 ${envPath}`,
  };
}
