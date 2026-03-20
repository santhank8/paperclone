const TELEGRAM_API = "https://api.telegram.org";

export async function sendTelegram(
  html: string,
  opts?: { botToken?: string; chatId?: string; threadId?: number }
): Promise<void> {
  const token = opts?.botToken ?? process.env.TELEGRAM_BOT_TOKEN;
  const chatId = opts?.chatId ?? process.env.TELEGRAM_CHAT_ID;
  const threadId = opts?.threadId ?? (process.env.TELEGRAM_THREAD_ID ? Number(process.env.TELEGRAM_THREAD_ID) : undefined);

  if (!token || !chatId) throw new Error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
  };
  if (threadId) body.message_thread_id = threadId;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return;
    const err = await res.text();
    console.error(`Telegram attempt ${attempt + 1} failed: ${res.status} ${err}`);
    if (attempt < 2) await new Promise((r) => setTimeout(r, 30_000));
  }
  throw new Error("Telegram send failed after 3 retries");
}
