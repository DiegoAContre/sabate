// The store's day is the Caracas day: Venezuela is UTC−4 all year, no DST.
// Reports group and filter by this, not by the machine's timezone, so dev and
// the store server always agree.
export const CARACAS_TZ = 'America/Caracas';

// en-CA formats as YYYY-MM-DD — cheapest way to get a sortable day key.
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: CARACAS_TZ });

/** 'YYYY-MM-DD' of the Caracas day a moment falls in. */
export function caracasDayOf(date: Date): string {
  return dayFmt.format(date);
}

export function caracasToday(now = new Date()): string {
  return caracasDayOf(now);
}

export function isDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** [start, end) UTC instants covering one Caracas day ('YYYY-MM-DD'). */
export function caracasDayRange(day: string): { start: Date; end: Date } {
  const [year, month, date] = day.split('-').map(Number);
  // Midnight in Caracas (UTC−4) is 04:00 UTC.
  const start = new Date(Date.UTC(year, month - 1, date) + 4 * 60 * 60 * 1000);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
