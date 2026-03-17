/**
 * Cron occurrence calculator — computes future execution times for cron expressions.
 * Ported from Mission Control's src/lib/cron-occurrences.ts.
 */

export interface CronOccurrence {
  atMs: number;
  dayKey: string; // YYYY-MM-DD
}

/**
 * Parse a cron field into a set of matching values.
 */
function parseCronField(field: string, min: number, max: number): Set<number> | null {
  if (field === "*") return null; // null means "any"

  const values = new Set<number>();

  for (const part of field.split(",")) {
    const stepMatch = part.match(/^(.+)\/(\d+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[2], 10);
      const base = stepMatch[1];
      let start = min;
      let end = max;

      if (base !== "*") {
        const rangeMatch = base.match(/^(\d+)-(\d+)$/);
        if (rangeMatch) {
          start = parseInt(rangeMatch[1], 10);
          end = parseInt(rangeMatch[2], 10);
        } else {
          start = parseInt(base, 10);
          end = max;
        }
      }

      for (let i = start; i <= end; i += step) {
        values.add(i);
      }
      continue;
    }

    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let i = start; i <= end; i++) {
        values.add(i);
      }
      continue;
    }

    const num = parseInt(part, 10);
    if (!isNaN(num)) {
      values.add(num);
    }
  }

  return values.size > 0 ? values : null;
}

function buildDayKeyFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildDayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Get all cron occurrences within a time range.
 */
export function getCronOccurrences(
  schedule: string,
  rangeStartMs: number,
  rangeEndMs: number,
  max = 1000,
): CronOccurrence[] {
  // Strip timezone suffix if present: "0 9 * * * (America/Monterrey)" → "0 9 * * *"
  const normalized = schedule.replace(/\s*\([^)]+\)\s*$/, "").trim();
  const parts = normalized.split(/\s+/);
  if (parts.length !== 5) return [];

  const minuteSet = parseCronField(parts[0], 0, 59);
  const hourSet = parseCronField(parts[1], 0, 23);
  const domSet = parseCronField(parts[2], 1, 31);
  const monthSet = parseCronField(parts[3], 1, 12);
  const dowSet = parseCronField(parts[4], 0, 6);

  // Normalize dow: 7 = 0 (Sunday)
  if (dowSet?.has(7)) {
    dowSet.add(0);
    dowSet.delete(7);
  }

  const results: CronOccurrence[] = [];
  const start = new Date(rangeStartMs);
  const end = new Date(rangeEndMs);

  // Iterate minute by minute would be too slow. Instead iterate by day, then check hours/minutes.
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());

  while (cursor.getTime() <= end.getTime() && results.length < max) {
    const month1 = cursor.getMonth() + 1;
    const dom = cursor.getDate();
    const dow = cursor.getDay();

    // Check month
    if (monthSet && !monthSet.has(month1)) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    // Check DOM and DOW — if both are restricted (not *), match either (OR logic per cron spec)
    const domMatch = domSet ? domSet.has(dom) : true;
    const dowMatch = dowSet ? dowSet.has(dow) : true;

    if (domSet && dowSet) {
      if (!domMatch && !dowMatch) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }
    } else {
      if (!domMatch || !dowMatch) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }
    }

    // Iterate hours and minutes for this day
    const hours = hourSet ? Array.from(hourSet).sort((a, b) => a - b) : Array.from({ length: 24 }, (_, i) => i);
    const minutes = minuteSet ? Array.from(minuteSet).sort((a, b) => a - b) : Array.from({ length: 60 }, (_, i) => i);

    for (const h of hours) {
      for (const m of minutes) {
        const t = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), h, m);
        const ms = t.getTime();
        if (ms < rangeStartMs) continue;
        if (ms > rangeEndMs) break;
        results.push({ atMs: ms, dayKey: buildDayKeyFromDate(t) });
        if (results.length >= max) return results;
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return results;
}

/**
 * Get the next occurrence of a cron expression after a given time.
 */
export function getNextCronOccurrence(cronExpr: string, afterMs: number): number | null {
  const results = getCronOccurrences(cronExpr, afterMs, afterMs + 366 * 24 * 60 * 60 * 1000, 1);
  return results.length > 0 ? results[0].atMs : null;
}
