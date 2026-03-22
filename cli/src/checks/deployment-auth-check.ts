import type { PaperclipConfig } from "../config/schema.js";
import type { CheckResult } from "./index.js";

function isLoopbackHost(host: string) {
  const normalized = host.trim().toLowerCase();
  return normalized === "127.0.0.1" || normalized === "localhost" || normalized === "::1";
}

export function deploymentAuthCheck(config: PaperclipConfig): CheckResult {
  const mode = config.server.deploymentMode;
  const exposure = config.server.exposure;
  const auth = config.auth;

  if (mode === "local_trusted") {
    if (!isLoopbackHost(config.server.host)) {
      return {
        name: "部署/认证模式",
        status: "fail",
        message: `local_trusted 模式需要回环地址绑定（当前为 ${config.server.host}）`,
        canRepair: false,
        repairHint: "运行 `paperclipai configure --section server` 并将 host 设置为 127.0.0.1",
      };
    }
    return {
      name: "部署/认证模式",
      status: "pass",
      message: "local_trusted 模式已配置为仅回环访问",
    };
  }

  const secret =
    process.env.BETTER_AUTH_SECRET?.trim() ??
    process.env.PAPERCLIP_AGENT_JWT_SECRET?.trim();
  if (!secret) {
    return {
      name: "部署/认证模式",
      status: "fail",
      message: "认证模式需要 BETTER_AUTH_SECRET（或 PAPERCLIP_AGENT_JWT_SECRET）",
      canRepair: false,
      repairHint: "在启动 Paperclip 之前设置 BETTER_AUTH_SECRET",
    };
  }

  if (auth.baseUrlMode === "explicit" && !auth.publicBaseUrl) {
    return {
      name: "部署/认证模式",
      status: "fail",
      message: "auth.baseUrlMode=explicit 需要 auth.publicBaseUrl",
      canRepair: false,
      repairHint: "运行 `paperclipai configure --section server` 并提供基础 URL",
    };
  }

  if (exposure === "public") {
    if (auth.baseUrlMode !== "explicit" || !auth.publicBaseUrl) {
      return {
        name: "部署/认证模式",
        status: "fail",
        message: "authenticated/public 模式需要显式 auth.publicBaseUrl",
        canRepair: false,
        repairHint: "运行 `paperclipai configure --section server` 并选择公开暴露",
      };
    }
    try {
      const url = new URL(auth.publicBaseUrl);
      if (url.protocol !== "https:") {
        return {
          name: "部署/认证模式",
          status: "warn",
          message: "公开暴露应使用 https:// 的 auth.publicBaseUrl",
          canRepair: false,
          repairHint: "在生产环境中使用 HTTPS 以确保会话 Cookie 安全",
        };
      }
    } catch {
      return {
        name: "部署/认证模式",
        status: "fail",
        message: "auth.publicBaseUrl 不是有效的 URL",
        canRepair: false,
        repairHint: "运行 `paperclipai configure --section server` 并提供有效的 URL",
      };
    }
  }

  return {
    name: "部署/认证模式",
    status: "pass",
    message: `模式 ${mode}/${exposure}，认证 URL 模式 ${auth.baseUrlMode}`,
  };
}
