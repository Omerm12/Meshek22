import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The root cause of "a create/update succeeds but the admin sees an error":
 * every one of these five forms calls its server action directly
 * (`await action(fd)`) inside its own try/catch for inline error display.
 * A successful create/update ends with redirect() on the server, which
 * communicates across that call as a thrown NEXT_REDIRECT signal, not a
 * resolved value — so it lands in the catch block, which used to treat it
 * as a generic failure. unstable_rethrow() (the officially documented API
 * for exactly this — see https://nextjs.org/docs/app/api-reference/functions/unstable_rethrow)
 * lets that signal keep propagating instead.
 *
 * Structural, not executed: these are "use client" components using
 * react-hook-form + useTransition, and this repo has no jsdom/testing-library
 * (see Header.test.ts) — so, consistent with the rest of the admin test
 * suite, the fix is pinned by source inspection.
 */
const forms = [
  ["CategoryForm", "src/components/admin/categories/CategoryForm.tsx"],
  ["ProductForm", "src/components/admin/products/ProductForm.tsx"],
  ["SettlementForm", "src/components/admin/settlements/SettlementForm.tsx"],
  ["DeliveryZoneForm", "src/components/admin/delivery-zones/DeliveryZoneForm.tsx"],
  ["PromotionForm", "src/components/admin/promotions/PromotionForm.tsx"],
] as const;

describe("admin forms rethrow Next.js redirect signals instead of misreporting them as failures", () => {
  it.each(forms)("%s imports unstable_rethrow from next/navigation", (_name, path) => {
    const source = readFileSync(path, "utf8");
    expect(source).toMatch(/import\s*\{\s*unstable_rethrow\s*\}\s*from\s*"next\/navigation"/);
  });

  it.each(forms)("%s calls unstable_rethrow before setting its error state in the catch block", (_name, path) => {
    const source = readFileSync(path, "utf8");
    // Anchored on the submit call, not the first "catch (err)" in the file —
    // PromotionForm has an earlier, unrelated catch block in its search
    // debounce logic that this must not be confused with.
    const submitIdx = source.indexOf("await action(fd)");
    expect(submitIdx).toBeGreaterThan(-1);

    const catchIdx = source.indexOf("} catch (err) {", submitIdx);
    expect(catchIdx).toBeGreaterThan(submitIdx);

    const rethrowIdx = source.indexOf("unstable_rethrow(err)", catchIdx);
    const setErrorIdx = source.slice(catchIdx).search(/set(ServerError|Error)\(/);

    expect(rethrowIdx).toBeGreaterThan(catchIdx);
    // unstable_rethrow must run before the error message is set, so a real
    // redirect never reaches the setServerError/setError call at all.
    expect(rethrowIdx).toBeLessThan(catchIdx + setErrorIdx);
  });

  it.each(forms)("%s still shows a real error message for a genuine failure", (_name, path) => {
    const source = readFileSync(path, "utf8");
    expect(source).toMatch(/set(ServerError|Error)\("אירעה שגיאה בלתי צפויה\. נסו שוב\."\)/);
  });
});

describe("requireAdmin() is the single chokepoint for auth_failed logging", () => {
  const authSource = readFileSync("src/lib/admin/auth.ts", "utf8");

  it("logs auth_failed before redirecting an unauthenticated/non-admin request", () => {
    const logIdx = authSource.indexOf('stage: "auth_failed"');
    const redirectIdx = authSource.indexOf("redirect(ADMIN_ROUTES.login)");
    expect(logIdx).toBeGreaterThan(-1);
    expect(redirectIdx).toBeGreaterThan(logIdx);
  });

  it("never logs customer/session data — only a fixed scope and stage label", () => {
    const idx = authSource.indexOf('console.log("[admin:timing]"');
    const block = authSource.slice(idx, idx + 200);
    expect(block).not.toMatch(/email|token|password|phone/i);
  });
});
