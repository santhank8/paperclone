import { LANGUAGE_STORAGE_KEY } from "./i18n";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

function getCurrentLanguage(): string {
  try {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? "en";
  } catch {
    return "en";
  }
}

function formatTimeAgoKo(seconds: number): string {
  if (seconds < MINUTE) return "방금 전";
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)}분 전`;
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)}시간 전`;
  if (seconds < WEEK) return `${Math.floor(seconds / DAY)}일 전`;
  if (seconds < MONTH) return `${Math.floor(seconds / WEEK)}주 전`;
  return `${Math.floor(seconds / MONTH)}개월 전`;
}

function formatTimeAgoEn(seconds: number): string {
  if (seconds < MINUTE) return "just now";
  if (seconds < HOUR) return `${Math.floor(seconds / MINUTE)}m ago`;
  if (seconds < DAY) return `${Math.floor(seconds / HOUR)}h ago`;
  if (seconds < WEEK) return `${Math.floor(seconds / DAY)}d ago`;
  if (seconds < MONTH) return `${Math.floor(seconds / WEEK)}w ago`;
  return `${Math.floor(seconds / MONTH)}mo ago`;
}

export function timeAgo(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.round((now - then) / 1000);
  const lang = getCurrentLanguage();

  if (lang === "ko") return formatTimeAgoKo(seconds);
  return formatTimeAgoEn(seconds);
}
