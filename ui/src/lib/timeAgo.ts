import { readStoredUiLanguage } from "./ui-language";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

export function timeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.round((now - then) / 1000);
  const locale = readStoredUiLanguage() === "zh-CN" ? "zh-CN" : "en-US";
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (seconds < MINUTE) return locale === "zh-CN" ? "刚刚" : "just now";
  if (seconds < HOUR) {
    const m = Math.floor(seconds / MINUTE);
    return rtf.format(-m, "minute");
  }
  if (seconds < DAY) {
    const h = Math.floor(seconds / HOUR);
    return rtf.format(-h, "hour");
  }
  if (seconds < WEEK) {
    const d = Math.floor(seconds / DAY);
    return rtf.format(-d, "day");
  }
  if (seconds < MONTH) {
    const w = Math.floor(seconds / WEEK);
    return rtf.format(-w, "week");
  }
  const mo = Math.floor(seconds / MONTH);
  return rtf.format(-mo, "month");
}
