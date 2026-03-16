#!/usr/bin/env bun
/**
 * X/Twitter API CLI — OAuth 1.0a posting via DougsMaestroBot
 *
 * Usage:
 *   bun run tools/x-api.ts post "Your tweet text here"
 *   bun run tools/x-api.ts reply <tweet_id> "Your reply text"
 *   bun run tools/x-api.ts verify
 *   bun run tools/x-api.ts delete <tweet_id>
 */

import { createHmac, randomBytes } from "crypto";

// --- Config from env ---

const CONSUMER_KEY = process.env.X_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.X_CONSUMER_SECRET;
const ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
const ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;

function checkEnv() {
  if (!CONSUMER_KEY || !CONSUMER_SECRET || !ACCESS_TOKEN || !ACCESS_TOKEN_SECRET) {
    console.error("Missing X API credentials. Set X_CONSUMER_KEY, X_CONSUMER_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET in .env");
    process.exit(1);
  }
}

// --- OAuth 1.0a signing ---

function percentEncode(str: string): string {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function generateNonce(): string {
  return randomBytes(16).toString("hex");
}

function buildOAuthHeader(method: string, url: string, body?: Record<string, string>): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = generateNonce();

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: CONSUMER_KEY!,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: ACCESS_TOKEN!,
    oauth_version: "1.0",
  };

  // Combine oauth params + body params (if form-encoded) for signature base
  const allParams: Record<string, string> = { ...oauthParams };
  if (body) {
    for (const [k, v] of Object.entries(body)) {
      allParams[k] = v;
    }
  }

  // Sort and encode
  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join("&");

  const signatureBase = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(CONSUMER_SECRET!)}&${percentEncode(ACCESS_TOKEN_SECRET!)}`;
  const signature = createHmac("sha1", signingKey).update(signatureBase).digest("base64");

  oauthParams["oauth_signature"] = signature;

  const header = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(", ");

  return `OAuth ${header}`;
}

// --- API calls ---

async function postTweet(text: string, replyToId?: string): Promise<string> {
  const url = "https://api.twitter.com/2/tweets";
  const bodyObj: Record<string, unknown> = { text };
  if (replyToId) {
    bodyObj.reply = { in_reply_to_tweet_id: replyToId };
  }
  const bodyStr = JSON.stringify(bodyObj);

  // For JSON body, don't include body params in OAuth signature (per Twitter API v2 spec)
  const authHeader = buildOAuthHeader("POST", url);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: bodyStr,
  });

  const data = (await res.json()) as { data?: { id: string } };

  if (!res.ok) {
    console.error(`Error ${res.status}:`, JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const tweetUrl = `https://x.com/i/status/${data.data!.id}`;
  console.log(`Tweet posted: ${tweetUrl}`);
  return tweetUrl;
}

async function deleteTweet(id: string): Promise<void> {
  const url = `https://api.twitter.com/2/tweets/${id}`;
  const authHeader = buildOAuthHeader("DELETE", url);

  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: authHeader },
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`Error ${res.status}:`, JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log(`Tweet ${id} deleted.`);
}

async function verifyCredentials(): Promise<void> {
  const url = "https://api.twitter.com/2/users/me";
  const authHeader = buildOAuthHeader("GET", url);

  const res = await fetch(url, {
    headers: { Authorization: authHeader },
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`Error ${res.status}:`, JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log(`Authenticated as @${data.data.username} (${data.data.name})`);
  console.log(`ID: ${data.data.id}`);
}

// --- CLI ---

const [command, ...args] = process.argv.slice(2);

checkEnv();

switch (command) {
  case "post": {
    const text = args.join(" ");
    if (!text) {
      console.error('Usage: bun run tools/x-api.ts post "Your tweet text"');
      process.exit(1);
    }
    await postTweet(text);
    break;
  }
  case "reply": {
    const replyToId = args[0];
    const replyText = args.slice(1).join(" ");
    if (!replyToId || !replyText) {
      console.error('Usage: bun run tools/x-api.ts reply <tweet_id> "Your reply text"');
      process.exit(1);
    }
    await postTweet(replyText, replyToId);
    break;
  }
  case "delete": {
    const id = args[0];
    if (!id) {
      console.error("Usage: bun run tools/x-api.ts delete <tweet_id>");
      process.exit(1);
    }
    await deleteTweet(id);
    break;
  }
  case "verify":
    await verifyCredentials();
    break;
  default:
    console.error("Commands: post, delete, verify");
    console.error('  post "text"    — Post a tweet');
    console.error("  delete <id>    — Delete a tweet by ID");
    console.error("  verify         — Check credentials");
    process.exit(1);
}
