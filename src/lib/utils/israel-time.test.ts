import { describe, expect, it } from "vitest";
import {
  formatDateOnlyDisplay,
  israelDateRangeToUtc,
  parseDateOnly,
  todayInIsrael,
} from "./israel-time";

function formatUtcInIsrael(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

describe("parseDateOnly", () => {
  it("parses a valid YYYY-MM-DD string", () => {
    expect(parseDateOnly("2026-03-15")).toEqual({ year: 2026, month: 3, day: 15 });
  });

  it("rejects malformed or out-of-range input", () => {
    expect(parseDateOnly("15/03/2026")).toBeNull();
    expect(parseDateOnly("2026-13-01")).toBeNull();
    expect(parseDateOnly("2026-01-00")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
  });
});

describe("israelDateRangeToUtc", () => {
  it("resolves a winter day's start to exactly 00:00:00 Israel time (IST, UTC+2)", () => {
    const { startUtc } = israelDateRangeToUtc(
      { year: 2026, month: 1, day: 15 },
      { year: 2026, month: 1, day: 15 }
    );
    expect(formatUtcInIsrael(startUtc)).toBe("01/15/2026, 00:00:00");
  });

  it("resolves a summer (DST) day's start to exactly 00:00:00 Israel time (IDT, UTC+3)", () => {
    const { startUtc } = israelDateRangeToUtc(
      { year: 2026, month: 7, day: 15 },
      { year: 2026, month: 7, day: 15 }
    );
    expect(formatUtcInIsrael(startUtc)).toBe("07/15/2026, 00:00:00");
  });

  it("the winter and summer UTC offsets differ by exactly one hour — DST genuinely applies, not ignored", () => {
    const winterStart = israelDateRangeToUtc(
      { year: 2026, month: 1, day: 15 },
      { year: 2026, month: 1, day: 15 }
    ).startUtc;
    const summerStart = israelDateRangeToUtc(
      { year: 2026, month: 7, day: 15 },
      { year: 2026, month: 7, day: 15 }
    ).startUtc;

    const winterOffsetMs = Date.UTC(2026, 0, 15, 0, 0, 0) - winterStart.getTime();
    const summerOffsetMs = Date.UTC(2026, 6, 15, 0, 0, 0) - summerStart.getTime();
    expect(Math.abs(summerOffsetMs - winterOffsetMs)).toBe(60 * 60 * 1000);
  });

  it("the end boundary is midnight at the START of the day after `to` — the whole last day is included", () => {
    const { endUtc } = israelDateRangeToUtc(
      { year: 2026, month: 1, day: 1 },
      { year: 2026, month: 1, day: 31 }
    );
    expect(formatUtcInIsrael(endUtc)).toBe("02/01/2026, 00:00:00");
  });

  it("end boundary correctly rolls over a month/year, not just a day", () => {
    const { endUtc } = israelDateRangeToUtc(
      { year: 2025, month: 12, day: 20 },
      { year: 2025, month: 12, day: 31 }
    );
    expect(formatUtcInIsrael(endUtc)).toBe("01/01/2026, 00:00:00");
  });

  it("a single-day range spans exactly 24 hours outside of a DST transition day", () => {
    const { startUtc, endUtc } = israelDateRangeToUtc(
      { year: 2026, month: 1, day: 15 },
      { year: 2026, month: 1, day: 15 }
    );
    expect(endUtc.getTime() - startUtc.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe("formatDateOnlyDisplay", () => {
  it("renders DD/MM/YYYY with zero-padding", () => {
    expect(formatDateOnlyDisplay({ year: 2026, month: 3, day: 5 })).toBe("05/03/2026");
    expect(formatDateOnlyDisplay({ year: 2026, month: 12, day: 31 })).toBe("31/12/2026");
  });
});

describe("todayInIsrael", () => {
  it("returns a well-formed YYYY-MM-DD string", () => {
    expect(todayInIsrael()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
