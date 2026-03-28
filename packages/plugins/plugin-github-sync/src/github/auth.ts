import type { PluginContext } from "@paperclipai/plugin-sdk";
import type { GitHubInstallationToken, GitHubSyncConfig } from "./types.js";
import { GITHUB_TOKEN_REFRESH_MARGIN_MS } from "../constants.js";

let cachedToken: GitHubInstallationToken | null = null;

function base64UrlEncode(data: Uint8Array): string {
  const base64 = Buffer.from(data).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createJwt(appId: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Import private key
  const pemContents = privateKeyPem
    .replace(/-----BEGIN RSA PRIVATE KEY-----/, "")
    .replace(/-----END RSA PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder.encode(signingInput)),
  );

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

export async function getInstallationToken(
  ctx: PluginContext,
  config: GitHubSyncConfig,
): Promise<string> {
  // Return cached token if still valid
  if (
    cachedToken &&
    cachedToken.expiresAt.getTime() - Date.now() > GITHUB_TOKEN_REFRESH_MARGIN_MS
  ) {
    return cachedToken.token;
  }

  const privateKey = await ctx.secrets.resolve(config.privateKeySecret);
  const jwt = await createJwt(config.githubAppId, privateKey);

  const response = await ctx.http.fetch(
    `https://api.github.com/app/installations/${config.githubInstallationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to get installation token: ${response.status} ${body}`);
  }

  const data = (await response.json()) as { token: string; expires_at: string };
  cachedToken = {
    token: data.token,
    expiresAt: new Date(data.expires_at),
  };

  ctx.logger.info("GitHub installation token refreshed", {
    expiresAt: data.expires_at,
  });

  return cachedToken.token;
}

export function clearTokenCache(): void {
  cachedToken = null;
}
