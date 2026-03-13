import i18n from "../i18n";

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

export function timeAgo(date: Date | string): string {
  const t = (key: string, opts?: Record<string, unknown>) =>
    i18n.t(key, { ns: "common", ...opts });

  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.round((now - then) / 1000);

  if (seconds < MINUTE) return t("time.justNow");
  if (seconds < HOUR) {
    const m = Math.floor(seconds / MINUTE);
    return t("time.mAgo", { m });
  }
  if (seconds < DAY) {
    const h = Math.floor(seconds / HOUR);
    return t("time.hAgo", { h });
  }
  if (seconds < WEEK) {
    const d = Math.floor(seconds / DAY);
    return t("time.dAgo", { d });
  }
  if (seconds < MONTH) {
    const w = Math.floor(seconds / WEEK);
    return t("time.wAgo", { w });
  }
  const mo = Math.floor(seconds / MONTH);
  return t("time.moAgo", { mo });
}
