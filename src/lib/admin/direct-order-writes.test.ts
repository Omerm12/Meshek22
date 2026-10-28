import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261028000000_lock_down_direct_order_writes.sql"),
  "utf8"
);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
  );
}

describe("direct end-user order writes are locked down", () => {
  it("the migration drops both own-insert policies and revokes INSERT from anon/authenticated", () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "orders_own_insert"      ON public.orders');
    expect(migration).toContain('DROP POLICY IF EXISTS "order_items_own_insert" ON public.order_items');
    expect(migration).toMatch(/REVOKE INSERT ON public\.orders\s+FROM anon, authenticated/);
    expect(migration).toMatch(/REVOKE INSERT ON public\.order_items\s+FROM anon, authenticated/);
  });

  it("is a single transaction and never touches data", () => {
    expect(migration).toMatch(/^BEGIN;/m);
    expect(migration).toMatch(/^COMMIT;/m);
    expect(migration).not.toMatch(/\b(DELETE FROM|UPDATE\s+public|INSERT INTO|TRUNCATE)\b/i);
  });

  it("no app code inserts orders/order_items with the end-user (cookie session) client", () => {
    const offenders = walk(join(process.cwd(), "src"))
      .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f))
      .filter((f) => {
        const s = readFileSync(f, "utf8");
        return /from\("(orders|order_items)"\)\s*\.insert\(/.test(s) && /await createClient\(\)/.test(s);
      });
    expect(offenders).toEqual([]);
  });
});
