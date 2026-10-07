// v1.2.0 — calendar dates the way the API sends them: "YYYY-MM-DD", with no
// time and no zone, so they can be compared as strings.

/** Today on this computer's calendar — Phnom Penh at the till. */
export function today(): string {
  const now = new Date();
  return isoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** The day a timestamp falls on here: "2026-10-05T18:30:00Z" → "2026-10-06" in Phnom Penh. */
export function dayOf(timestamp: string): string {
  const at = new Date(timestamp);
  return isoDate(at.getFullYear(), at.getMonth() + 1, at.getDate());
}

/** The day before `date`: "2026-09-01" → "2026-08-31". */
export function dayBefore(date: string): string {
  return daysBefore(date, 1);
}

/** `days` days before `date`: ("2026-10-05", 29) → "2026-09-06". */
export function daysBefore(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const before = new Date(Date.UTC(year, month - 1, day - days));
  return isoDate(before.getUTCFullYear(), before.getUTCMonth() + 1, before.getUTCDate());
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
