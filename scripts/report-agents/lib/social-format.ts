import { moneySmart } from "./formatters.js";

interface ParsedTweet {
  link_tweet: string;
  views: number;
  like: number;
  retweet: number;
  reply: number;
  date: string;
  content: string;
}

async function fetchTweets(userId: string, apiKey: string): Promise<any> {
  const url = `https://twitter241.p.rapidapi.com/user-tweets?user=${userId}&count=6`;
  const res = await fetch(url, {
    headers: {
      "x-rapidapi-host": "twitter241.p.rapidapi.com",
      "x-rapidapi-key": apiKey,
    },
  });
  if (!res.ok) throw new Error(`RapidAPI ${res.status}`);
  return res.json();
}

function parseTweets(data: any): ParsedTweet[] {
  const output: ParsedTweet[] = [];
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));

  function isYesterday(dateStr: string): boolean {
    const d = new Date(dateStr);
    return d.getUTCFullYear() === yesterday.getUTCFullYear() &&
      d.getUTCMonth() === yesterday.getUTCMonth() &&
      d.getUTCDate() === yesterday.getUTCDate();
  }

  function normalize(r: any) { return r?.tweet ?? r; }
  function fmt(dateStr: string) {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
  }

  function process(tweet: any): ParsedTweet | null {
    if (!tweet?.legacy) return null;
    const l = tweet.legacy;
    if (l.full_text?.startsWith("RT @") || !isYesterday(l.created_at) || l.in_reply_to_status_id_str) return null;
    const user = tweet.core?.user_results?.result?.core?.screen_name ?? tweet.core?.user_results?.result?.legacy?.screen_name;
    const id = l.id_str;
    if (!user || !id) return null;
    return {
      link_tweet: `https://x.com/${user}/status/${id}`,
      views: parseInt(tweet.views?.count || "0"),
      like: l.favorite_count, retweet: l.retweet_count, reply: l.reply_count,
      date: fmt(l.created_at),
      content: l.full_text?.replace(/https:\/\/t\.co\/\w+/g, "").trim() ?? "",
    };
  }

  for (const instr of data?.result?.timeline?.instructions ?? []) {
    if (instr.type === "TimelinePinEntry") {
      const r = process(normalize(instr.entry?.content?.itemContent?.tweet_results?.result));
      if (r) output.push(r);
    }
    if (instr.type === "TimelineAddEntries") {
      for (const e of instr.entries ?? []) {
        const r = process(normalize(e?.content?.itemContent?.tweet_results?.result));
        if (r) output.push(r);
      }
    }
    if (instr.type === "TimelineTimelineModule") {
      for (const it of instr.items ?? []) {
        const r = process(normalize(it?.item?.itemContent?.tweet_results?.result));
        if (r) { output.push(r); break; }
      }
    }
  }
  return output;
}

function getEngagement(likes: number): string {
  if (likes > 50) return "Strong";
  if (likes > 20) return "Good";
  if (likes > 5) return "Moderate";
  return "Weak";
}

export async function runSocialCollector(apiKey: string, accounts: Array<{ id: string; name: string }>): Promise<string | null> {
  const todayFormatted = new Date().toLocaleDateString("en-GB", {
    timeZone: "Asia/Bangkok", day: "2-digit", month: "2-digit",
  });

  let report = `<b>Whales Market Social Report ${todayFormatted}:</b>\n\n`;
  let hasTweets = false;

  for (const account of accounts) {
    try {
      const raw = await fetchTweets(account.id, apiKey);
      const tweets = parseTweets(raw);
      if (tweets.length === 0) continue;
      hasTweets = true;

      report += `<b>@${account.name}</b>\n`;
      for (const t of tweets) {
        const link = `<a href="${t.link_tweet}">${t.content.slice(0, 50)}</a>`;
        report += `<b>${t.date}</b> - ${link}\n`;
        report += `Likes: ${t.like} | Retweet: ${t.retweet} | Reply: ${t.reply} | Views: ${moneySmart(t.views, "")}\n`;
        report += `Engagement: ${getEngagement(t.like)}\n\n`;
      }
    } catch (e) {
      report += `<b>@${account.name}</b>: Error - ${e}\n\n`;
    }
  }

  return hasTweets ? report : null;
}
