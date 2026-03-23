// bot-listener.ts
// Long-polling Telegram bot with conversation memory
// /report triggers collectors, free text → Claude CLI with context

import "dotenv/config";
import Database from "better-sqlite3";
import { sendTelegram } from "./lib/telegram.js";
import { fetchPlatformMetrics } from "./lib/metabase-queries.js";
import { fetchGA4Metrics } from "./lib/ga4-client.js";
import { moneySmart, growthBadge } from "./lib/formatters.js";
import { execFile } from "child_process";
import { promisify } from "util";
const execFileAsync = promisify(execFile);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("Missing TELEGRAM_BOT_TOKEN");

const WHALES_DB_PATH = process.env.WHALES_DB_PATH;
const TELEGRAM_API = "https://api.telegram.org";
let offset = 0;

// ============================================================
// CONVERSATION MEMORY — per chat, last 10 messages
// ============================================================

interface ChatMessage {
  role: "user" | "bot";
  text: string;
  timestamp: number;
}

const chatHistory = new Map<string, ChatMessage[]>();
const MAX_HISTORY = 10;
const HISTORY_TTL_MS = 30 * 60 * 1000; // 30 minutes — reset context after inactivity

function addToHistory(chatKey: string, role: "user" | "bot", text: string) {
  if (!chatHistory.has(chatKey)) chatHistory.set(chatKey, []);
  const history = chatHistory.get(chatKey)!;

  // Clear if last message was >30 min ago (new conversation)
  if (history.length > 0 && Date.now() - history[history.length - 1].timestamp > HISTORY_TTL_MS) {
    history.length = 0;
  }

  history.push({ role, text: text.slice(0, 1000), timestamp: Date.now() });

  // Keep last N messages
  while (history.length > MAX_HISTORY) history.shift();
}

function getHistoryContext(chatKey: string): string {
  const history = chatHistory.get(chatKey) ?? [];
  if (history.length === 0) return "";

  // Filter out stale messages
  const now = Date.now();
  const recent = history.filter((m) => now - m.timestamp < HISTORY_TTL_MS);

  if (recent.length === 0) return "";

  const lines = recent.map((m) =>
    m.role === "user" ? `User: ${m.text}` : `Bot: ${m.text}`
  );
  return `\n## Lịch sử hội thoại gần đây (dùng để hiểu context):\n${lines.join("\n")}\n`;
}

// ============================================================
// TELEGRAM
// ============================================================

async function getUpdates(): Promise<any[]> {
  const res = await fetch(`${TELEGRAM_API}/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`);
  if (!res.ok) return [];
  const data = await res.json() as any;
  return data.result ?? [];
}

async function reply(chatId: string, text: string, threadId?: number): Promise<string> {
  await sendTelegram(text, { botToken: BOT_TOKEN!, chatId, threadId });
  return text;
}

// ============================================================
// /report command
// ============================================================

async function handleReport(chatId: string, threadId?: number) {
  await reply(chatId, "⏳ Generating reports...", threadId);

  if (WHALES_DB_PATH) {
    try {
      const tokens = fetchPlatformMetrics(WHALES_DB_PATH);
      if (tokens.length > 0) {
        const { buildPlatformHtml } = await import("./lib/platform-format.js");
        await reply(chatId, buildPlatformHtml(tokens), threadId);
      } else {
        await reply(chatId, "🐳 Platform: No data in last 24h", threadId);
      }
    } catch (e) {
      await reply(chatId, `🐳 Platform error: ${e}`, threadId);
    }
  }

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  const SOCIAL_ACCOUNTS = process.env.SOCIAL_ACCOUNTS;
  if (RAPIDAPI_KEY && SOCIAL_ACCOUNTS) {
    try {
      const { runSocialCollector } = await import("./lib/social-format.js");
      const html = await runSocialCollector(RAPIDAPI_KEY, JSON.parse(SOCIAL_ACCOUNTS));
      if (html) await reply(chatId, html, threadId);
      else await reply(chatId, "📱 Social: No tweets from yesterday", threadId);
    } catch (e) {
      await reply(chatId, `📱 Social error: ${e}`, threadId);
    }
  }

  if (process.env.GA4_PROPERTY_ID) {
    try {
      const m = await fetchGA4Metrics();
      const lines = [
        `<b>🌐 Website Daily Report</b>\n`,
        `👥 Active Users: <b>${moneySmart(m.activeUsers, "")}</b> (${growthBadge(m.activeUsersPctChange)})`,
        `🆕 New Users: <b>${moneySmart(m.newUsers, "")}</b> (${growthBadge(m.newUsersPctChange)})`,
        `📊 Sessions: <b>${moneySmart(m.sessions, "")}</b> (${growthBadge(m.sessionsPctChange)})`,
      ];
      const premarketPages = m.topLandingPages
        .filter((p: any) => /^\/en\/premarket\//.test(p.page))
        .slice(0, 3);
      if (premarketPages.length > 0) {
        lines.push(`\n🚪 <b>Top Pre-Market Landing Pages:</b>`);
        premarketPages.forEach((p: any) => {
          const token = p.page.replace("/en/premarket/", "");
          lines.push(`  $${token} — ${p.sessions} sessions`);
        });
      }
      await reply(chatId, lines.join("\n"), threadId);
    } catch (e) {
      await reply(chatId, `🌐 GA error: ${e}`, threadId);
    }
  }
}

// ============================================================
// Free text Q&A with conversation context
// ============================================================

async function handleQuestion(chatId: string, question: string, chatKey: string, threadId?: number) {
  if (!WHALES_DB_PATH) {
    await reply(chatId, "❌ Q&A requires WHALES_DB_PATH", threadId);
    return;
  }

  await reply(chatId, "🤔 Thinking...", threadId);

  const historyContext = getHistoryContext(chatKey);

  const prompt = `ĐỌC FILE SYSTEM PROMPT TRƯỚC: /Users/amando/Desktop/Learn/metabase-sync/SYSTEM_PROMPT.md — đây là hướng dẫn chi tiết cách bạn suy nghĩ và trả lời.

Database SQLite tại: ${WHALES_DB_PATH}
${historyContext}
Câu hỏi hiện tại: "${question}"

QUAN TRỌNG — HIỂU CONTEXT:
- Nếu có lịch sử hội thoại ở trên, đọc kỹ để hiểu "token này", "con này" refer đến gì
- Nếu user reply/quote message → đó là context
- Làm theo đúng quy trình trong SYSTEM_PROMPT.md: Hiểu → Query → Validate → Phân tích (Fact → Observation → Recommendation)`;

  try {
    const { stdout } = await execFileAsync("claude", [
      "--print",
      "--dangerously-skip-permissions",
      "--model", "claude-sonnet-4-5-20250929",
      "-p", prompt,
    ], {
      timeout: 120_000,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, PATH: `${process.env.PATH}:/usr/local/bin:/opt/homebrew/bin` },
    });

    const answer = stdout.trim();
    if (answer) {
      const sent = await reply(chatId, answer, threadId);
      // Save bot response to history
      addToHistory(chatKey, "bot", sent.slice(0, 500));
    } else {
      await reply(chatId, "❌ No response from Claude", threadId);
    }
  } catch (e: any) {
    console.error("Claude CLI error:", e.message);
    await reply(chatId, `❌ Error: ${e.message?.slice(0, 200)}`, threadId);
  }
}

// ============================================================
// MAIN LOOP
// ============================================================

async function main() {
  console.log("Bot listener started. Waiting for messages...");

  while (true) {
    try {
      const updates = await getUpdates();
      for (const update of updates) {
        offset = update.update_id + 1;
        const msg = update.message;
        if (!msg?.text) continue;

        const chatId = String(msg.chat.id);
        const threadId = msg.message_thread_id;
        const text = msg.text.trim();

        // Chat key includes thread for topic-based groups
        const chatKey = threadId ? `${chatId}:${threadId}` : chatId;

        // Extract reply context if user is replying to bot message
        let replyContext = "";
        if (msg.reply_to_message?.text) {
          replyContext = `[Đang reply message: "${msg.reply_to_message.text.slice(0, 300)}"] `;
        }

        const cleanText = text.replace(/@\w+/g, "").trim();
        const fullQuestion = replyContext + cleanText;

        if (cleanText === "/report" || cleanText.startsWith("/report")) {
          console.log(`[${chatKey}] /report command`);
          await handleReport(chatId, threadId);
        } else if (cleanText.length > 2) {
          console.log(`[${chatKey}] Question: ${cleanText.slice(0, 50)}`);
          // Save user message to history
          addToHistory(chatKey, "user", fullQuestion);
          await handleQuestion(chatId, fullQuestion, chatKey, threadId);
        }
      }
    } catch (e) {
      console.error("Poll error:", e);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

main();
