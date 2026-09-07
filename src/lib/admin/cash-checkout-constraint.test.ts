import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * 20260907220000_fix_cash_checkout_constraint.sql — the migration that
 * resolves the cash-checkout root cause: chk_confirmed_requires_paid forbade
 * order_status='confirmed' with payment_status='pending', which is exactly
 * the state every cash order is created in.
 *
 * This is PL/SQL DDL, so (consistent with the other migration-content tests
 * in this file's sibling transactional-integrity.test.ts) it is pinned by
 * source-text assertions rather than executed against a real database.
 */
const migration = readFileSync(
  "supabase/migrations/20260907220000_fix_cash_checkout_constraint.sql",
  "utf8"
);
const reconcileMigration = readFileSync(
  "supabase/migrations/20260906230000_reconcile_production_schema.sql",
  "utf8"
);
const checkoutActions = readFileSync("src/app/(shop)/checkout/actions.ts", "utf8");

describe("cash-checkout constraint fix", () => {
  it("is timestamped after every existing migration, per the required naming convention", () => {
    const files = readdirSync("supabase/migrations")
      .filter((f) => f.endsWith(".sql") && /^\d{14}_/.test(f))
      .sort();
    expect(files[files.length - 1]).toBe("20260907220000_fix_cash_checkout_constraint.sql");
  });

  it("is transactional", () => {
    expect(migration).toMatch(/^\s*BEGIN;/m);
    expect(migration).toMatch(/COMMIT;\s*$/m);
  });

  it("is idempotent: drops the old constraint by name before re-adding it", () => {
    // The file's own header comment quotes the ADD CONSTRAINT text of the
    // ORIGINAL (005) migration for context, so search for the real statement
    // only after the DROP, not from the start of the file.
    const dropIdx = migration.indexOf("DROP CONSTRAINT IF EXISTS chk_confirmed_requires_paid");
    const addIdx = migration.indexOf("ADD CONSTRAINT chk_confirmed_requires_paid", dropIdx);
    expect(dropIdx).toBeGreaterThan(-1);
    expect(addIdx).toBeGreaterThan(dropIdx);
  });

  it("still requires payment before confirmation for every method except cash", () => {
    const body = migration.slice(migration.indexOf("CHECK ("), migration.indexOf(") NOT VALID"));
    expect(body).toContain("order_status != 'confirmed'");
    expect(body).toContain("payment_status = 'paid'");
    expect(body).toContain("payment_method = 'cash'");
  });

  it("is added NOT VALID, so it cannot fail on pre-existing historical rows", () => {
    expect(migration).toContain(") NOT VALID;");
  });

  it("touches no data — no DELETE, DROP TABLE, TRUNCATE or UPDATE anywhere in the file", () => {
    expect(migration).not.toMatch(/\bDELETE\b/i);
    expect(migration).not.toMatch(/\bDROP TABLE\b/i);
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
    expect(migration).not.toMatch(/\bUPDATE\b/i);
  });

  it("was not folded into a historical migration file", () => {
    // The reconcile migration's own header comment explains why it
    // deliberately left chk_confirmed_requires_paid untouched (mentioning
    // the name is fine) — what must never appear there is a statement that
    // actually redefines it.
    expect(reconcileMigration).not.toContain("DROP CONSTRAINT chk_confirmed_requires_paid");
    expect(reconcileMigration).not.toContain("ADD CONSTRAINT chk_confirmed_requires_paid");
    expect(reconcileMigration).not.toContain("DROP CONSTRAINT IF EXISTS chk_confirmed_requires_paid");
  });

  it("matches the order_status/payment_status values the checkout action actually writes for cash orders", () => {
    expect(checkoutActions).toContain('paymentMethod === "cash" ? "confirmed" : "pending_payment"');
    expect(checkoutActions).toContain('const paymentStatus = "pending"');
  });
});
