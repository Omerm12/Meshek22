/**
 * Calendar-date ↔ UTC-instant conversion for Asia/Jerusalem.
 *
 * Node (and Vercel's serverless runtime — see vercel.json) always runs in
 * UTC regardless of deploy region, so "the whole of 12/03/2026 in Israel" is
 * NOT the same UTC window as "00:00–24:00 UTC on 12/03/2026": Israel is
 * UTC+2 (IST) or UTC+3 (IDT, roughly March–October) depending on the date.
 * This resolves a Y/M/D calendar date — what a shop owner means by picking
 * it from an <input type="date">, regardless of what timezone the server
 * happens to run in — into the exact UTC instants that bound that day in
 * Asia/Jerusalem. Used by the sales report to query orders.created_at so
 * the selected day never silently loses or gains a couple of hours to the
 * DST offset.
 */

const IL_TIME_ZONE = "Asia/Jerusalem";

const PARTS_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: IL_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Reads `date` as wall-clock time in Asia/Jerusalem, expressed as if it were UTC. */
function asIsraeliWallClockMs(date: Date): number {
  const parts = PARTS_FORMATTER.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

/**
 * The UTC instant at which the given wall-clock time occurs in Asia/Jerusalem.
 *
 * Converges in two passes: the first guess (treating the wall time as if it
 * were already UTC) can be off by the zone's offset (2h or 3h), and
 * recomputing the offset from that corrected guess settles it even for a
 * date right at a DST transition.
 */
function israelWallTimeToUtc(y: number, m: number, d: number, hh: number, mm: number, ss: number): Date {
  const desired = Date.UTC(y, m - 1, d, hh, mm, ss);
  let guess = desired;
  for (let i = 0; i < 2; i++) {
    const wallClockOfGuess = asIsraeliWallClockMs(new Date(guess));
    guess += desired - wallClockOfGuess;
  }
  return new Date(guess);
}

export interface DateOnly {
  year: number;
  month: number;
  day: number;
}

/** Parses a strict "YYYY-MM-DD" string (the format <input type="date"> submits). */
export function parseDateOnly(value: string): DateOnly | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

/**
 * [startUtc, endUtc) spanning every Israel calendar day from `from` through
 * `to` inclusive. `endUtc` is the instant the day AFTER `to` begins, so
 * callers use a half-open `created_at >= startUtc AND created_at < endUtc`
 * and never lose an order placed in the last second of the end date.
 */
export function israelDateRangeToUtc(from: DateOnly, to: DateOnly): { startUtc: Date; endUtc: Date } {
  const startUtc = israelWallTimeToUtc(from.year, from.month, from.day, 0, 0, 0);

  // Date.UTC normalises day overflow (e.g. day 32 rolls into the next
  // month), so this is a plain "add one calendar day" with no month/year
  // special-casing.
  const dayAfterTo = new Date(Date.UTC(to.year, to.month - 1, to.day + 1));
  const endUtc = israelWallTimeToUtc(
    dayAfterTo.getUTCFullYear(),
    dayAfterTo.getUTCMonth() + 1,
    dayAfterTo.getUTCDate(),
    0,
    0,
    0
  );

  return { startUtc, endUtc };
}

/** DD/MM/YYYY — the exact format the report's filter line must show. */
export function formatDateOnlyDisplay(value: DateOnly): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(value.day)}/${pad(value.month)}/${value.year}`;
}

/** The current moment, formatted for display in Israel local time. */
export function formatIsraelNow(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: IL_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/**
 * Today's date in Israel, as "YYYY-MM-DD" — the value an
 * <input type="date"> expects. Safe to call in the browser: Intl with an
 * explicit `timeZone` does not depend on the visitor's own local timezone.
 */
export function todayInIsrael(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: IL_TIME_ZONE }).format(new Date());
}
