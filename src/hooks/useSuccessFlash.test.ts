import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * useSuccessFlash backs the "עודכן בהצלחה" indicator in the five admin
 * create/edit forms (see admin-mutations.test.ts for the per-form wiring
 * check). No jsdom/testing-library in this repo (see Header.test.ts), so —
 * consistent with the rest of the admin test suite — this is pinned by
 * source inspection rather than by actually rendering the hook.
 */
const source = readFileSync("src/hooks/useSuccessFlash.ts", "utf8");

describe("useSuccessFlash", () => {
  it("is a client hook (no server-only imports, safe for the five 'use client' forms)", () => {
    expect(source).toMatch(/^"use client";/);
  });

  it("trigger() shows the flash and schedules it to hide again after durationMs", () => {
    const triggerBody = source.slice(source.indexOf("const trigger = useCallback"));
    expect(triggerBody).toMatch(/setVisible\(true\)/);
    expect(triggerBody).toMatch(/setTimeout\(\(\) => setVisible\(false\), durationMs\)/);
  });

  it("trigger() clears any previous pending timeout before scheduling a new one — a second save shouldn't be hidden early by the first save's timer", () => {
    const triggerBody = source.slice(
      source.indexOf("const trigger = useCallback"),
      source.indexOf("const reset = useCallback")
    );
    const clearIdx = triggerBody.indexOf("clearTimeout(timeoutRef.current)");
    const setIdx = triggerBody.indexOf("timeoutRef.current = setTimeout(");
    expect(clearIdx).toBeGreaterThan(-1);
    expect(setIdx).toBeGreaterThan(clearIdx);
  });

  it("reset() hides the flash immediately and cancels any pending auto-hide", () => {
    const resetBody = source.slice(
      source.indexOf("const reset = useCallback"),
      source.indexOf("return { visible, trigger, reset }")
    );
    expect(resetBody).toMatch(/setVisible\(false\)/);
    expect(resetBody).toMatch(/clearTimeout\(timeoutRef\.current\)/);
  });

  it("clears its timeout on unmount so a late timer never touches an unmounted component", () => {
    const cleanupIdx = source.indexOf("useEffect(\n    () => () => {");
    expect(cleanupIdx).toBeGreaterThan(-1);
    const cleanupBody = source.slice(cleanupIdx, cleanupIdx + 150);
    expect(cleanupBody).toMatch(/clearTimeout\(timeoutRef\.current\)/);
  });

  it("exposes exactly {visible, trigger, reset} — no extra surface for callers to depend on", () => {
    expect(source).toContain("return { visible, trigger, reset } as const;");
  });
});
