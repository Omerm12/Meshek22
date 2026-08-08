import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The three transactional fixes in 20260808_006.
 *
 * They are PL/pgSQL, so they cannot be executed without a database. These tests
 * pin the properties that make them correct — each one corresponds to a way the
 * previous multi-request flow could corrupt state — plus the application wiring
 * that must call them.
 */
const migration = readFileSync(
  "supabase/migrations/20260808_006_transactional_integrity.sql",
  "utf8"
);
const promotionActions = readFileSync(
  "src/app/meshek22-control/(protected)/promotions/actions.ts",
  "utf8"
);
const checkoutActions = readFileSync("src/app/(shop)/checkout/actions.ts", "utf8");

// ─── Promotions ───────────────────────────────────────────────────────────────

describe("atomic promotion save", () => {
  it("replaces membership and applies the active flag in one transaction", () => {
    expect(migration).toContain("CREATE OR REPLACE FUNCTION public.save_promotion");
    const body = migration.slice(
      migration.indexOf("save_promotion"),
      migration.indexOf("REVOKE ALL     ON FUNCTION public.save_promotion")
    );
    expect(body).toContain("DELETE FROM promotion_items");
    expect(body).toContain("INSERT INTO promotion_items");
  });

  it("deactivates before swapping so the overlap guard judges the final set", () => {
    const body = migration.slice(migration.indexOf("save_promotion"));
    const deactivate = body.indexOf("SET    is_active = FALSE");
    const deleteItems = body.indexOf("DELETE FROM promotion_items");
    const finalUpdate = body.indexOf("is_active           = p_is_active");

    expect(deactivate).toBeGreaterThan(-1);
    expect(deactivate).toBeLessThan(deleteItems);
    // The requested active state is applied LAST, after the new membership.
    expect(deleteItems).toBeLessThan(finalUpdate);
  });

  it("refuses a promotion with no variants rather than creating an empty one", () => {
    expect(migration).toContain("promotion must include at least one product variant");
  });

  it("is service-role only", () => {
    expect(migration).toContain("REVOKE ALL     ON FUNCTION public.save_promotion FROM anon");
    expect(migration).toContain("GRANT  EXECUTE ON FUNCTION public.save_promotion TO service_role");
  });

  it("is called by both admin actions instead of the old three-request flow", () => {
    expect(promotionActions).toContain('db.rpc("save_promotion"');
    expect(promotionActions).toContain("p_promotion_id:        null");
    expect(promotionActions).toContain("p_promotion_id:        id");
    // The rollback-by-hand delete is gone.
    expect(promotionActions).not.toContain('from("promotions").delete().eq("id", promotion.id)');
    expect(promotionActions).not.toContain('from("promotion_items").delete()');
  });

  it("still reports overlap and per_kg rejections in Hebrew", () => {
    expect(promotionActions).toContain("overlapping active promotion");
    expect(promotionActions).toContain("לא ניתן לכלול מוצרים הנמכרים לפי משקל");
  });
});

// ─── Guest order idempotency ──────────────────────────────────────────────────

describe("concurrency-safe guest order creation", () => {
  it("arbitrates concurrent first submissions on the unique index", () => {
    // SELECT-then-INSERT loses the race; catching unique_violation cannot.
    expect(migration).toContain("WHEN unique_violation THEN");
  });

  it("returns the existing order as a duplicate instead of a generic error", () => {
    const idx = migration.indexOf("WHEN unique_violation THEN");
    const handler = migration.slice(idx, idx + 900);
    expect(handler).toContain("FROM   orders");
    expect(handler).toContain("idempotency_key = p_idempotency_key");
    expect(handler).toContain("TRUE"); // out_is_duplicate
  });

  it("re-raises a unique violation that is not the idempotency key", () => {
    const idx = migration.indexOf("WHEN unique_violation THEN");
    expect(migration.slice(idx, idx + 900)).toContain("RAISE;");
  });

  it("keeps the order and its items in one insert path", () => {
    expect(migration).toContain("INSERT INTO order_items");
  });

  it("keeps guest token rotation and service-role-only execution", () => {
    expect(migration).toContain("guest_access_token_hash = p_guest_token_hash");
    expect(migration).toContain(
      "GRANT  EXECUTE ON FUNCTION public.create_guest_order_atomic TO service_role"
    );
  });
});

// ─── Stock ────────────────────────────────────────────────────────────────────

describe("stock reservation", () => {
  it("reserves inside the order transaction, not in the Server Action", () => {
    expect(migration).toContain("PERFORM public.reserve_stock_for_items(p_items)");
    // Reserved before the order row exists, so a shortage rolls everything back.
    const reserveAt = migration.indexOf("PERFORM public.reserve_stock_for_items");
    const insertAt = migration.indexOf("INSERT INTO orders (");
    expect(reserveAt).toBeLessThan(insertAt);
  });

  it("treats NULL stock as unlimited", () => {
    expect(migration).toContain("CONTINUE WHEN v_stock IS NULL");
  });

  it("treats per_kg variants as unlimited, rather than inventing weight semantics", () => {
    expect(migration).toContain("v_mode = 'per_kg'");
    expect(migration).toContain("documented limitation");
  });

  it("decrements conditionally so two orders cannot take the same last item", () => {
    // The WHERE clause is the concurrency control: it re-checks at write time.
    expect(migration).toContain("AND  stock_quantity >= CEIL(v_quantity)::INTEGER");
    expect(migration).toContain("GET DIAGNOSTICS v_updated = ROW_COUNT");
    expect(migration).toContain("insufficient stock for");
  });

  it("can never leave a negative stock value", () => {
    expect(migration).toContain("product_variants_stock_non_negative_chk");
    expect(migration).toContain("stock_quantity IS NULL OR stock_quantity >= 0");
  });

  it("tells the customer what happened when stock runs out mid-checkout", () => {
    expect(checkoutActions).toContain("insufficient stock");
    expect(checkoutActions).toContain("אזל מהמלאי");
  });

  it("logs full diagnostics for an order-creation failure", () => {
    const idx = checkoutActions.indexOf("create_guest_order_atomic failed");
    const block = checkoutActions.slice(idx, idx + 400);
    for (const field of ["code:", "message:", "details:", "hint:"]) {
      expect(block).toContain(field);
    }
  });
});

// ─── Category migration self-containment ──────────────────────────────────────

describe("category migration is self-contained", () => {
  const categoryMigration = readFileSync(
    "supabase/migrations/20260808_001_ice_cream_nuts_categories.sql",
    "utf8"
  );

  it("creates the columns it depends on, which the initial schema lacks", () => {
    // 001_initial_schema.sql defines is_featured on products, not categories.
    expect(categoryMigration).toContain("ADD COLUMN IF NOT EXISTS is_featured");
    expect(categoryMigration).toContain("ADD COLUMN IF NOT EXISTS parent_id");
  });

  it("adds the self-reference FK safely and idempotently", () => {
    expect(categoryMigration).toContain("categories_parent_id_fkey");
    expect(categoryMigration).toContain("ON DELETE SET NULL");
    expect(categoryMigration).toMatch(/IF NOT EXISTS \([\s\S]*pg_constraint/);
  });

  it("prevents a category being its own parent", () => {
    expect(categoryMigration).toContain("categories_no_self_parent_chk");
    expect(categoryMigration).toContain("parent_id IS NULL OR parent_id <> id");
  });

  it("creates the parent lookup index next to the column it indexes", () => {
    expect(categoryMigration).toContain("CREATE INDEX IF NOT EXISTS categories_parent_sort_idx");
  });
});

// ─── Index deduplication ──────────────────────────────────────────────────────

describe("admin performance indexes", () => {
  const perf = readFileSync("supabase/migrations/20260808_004_admin_performance.sql", "utf8");
  const initial = readFileSync("supabase/migrations/001_initial_schema.sql", "utf8");

  it("no longer duplicates indexes the initial schema already creates", () => {
    // Each of these exists under another name in 001; a duplicate index is pure
    // write amplification because the planner will never prefer it.
    expect(initial).toContain("idx_orders_status");
    expect(initial).toContain("idx_settlements_name");

    expect(perf).not.toContain("CREATE INDEX IF NOT EXISTS orders_status_created_at_idx");
    expect(perf).not.toContain("CREATE INDEX IF NOT EXISTS orders_payment_status_idx");
    expect(perf).not.toContain("CREATE INDEX IF NOT EXISTS orders_order_number_idx");
    expect(perf).not.toContain("CREATE INDEX IF NOT EXISTS order_items_order_id_idx");
    expect(perf).not.toContain("CREATE INDEX IF NOT EXISTS product_variants_product_id_idx");
    expect(perf).not.toContain("CREATE INDEX IF NOT EXISTS settlements_name_idx");
    expect(perf).not.toContain("CREATE INDEX IF NOT EXISTS settlements_zone_idx");
  });

  it("keeps only the genuinely new access paths", () => {
    expect(perf).toContain("CREATE INDEX IF NOT EXISTS orders_created_at_desc_idx");
    expect(perf).toContain("CREATE INDEX IF NOT EXISTS products_active_sort_idx");
  });

  it("does not re-create the category parent index owned by 001", () => {
    expect(perf).not.toContain("CREATE INDEX IF NOT EXISTS categories_parent_sort_idx");
  });
});
