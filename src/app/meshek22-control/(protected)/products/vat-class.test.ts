import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The admin VAT control: the form schema validates the value server-side, and
 * createProduct / updateProduct persist it on the products row. Supabase and the
 * Next.js cache/auth helpers are stubbed — no network, no database.
 */

const { dbRef } = vi.hoisted(() => ({ dbRef: { current: null as unknown } }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/admin/revalidate", () => ({ revalidateStorefront: vi.fn() }));
vi.mock("@/lib/admin/auth", () => ({ requireAdmin: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => dbRef.current }));
vi.mock("@/lib/admin/instrumentation", () => ({
  completeMutation: vi.fn(),
  completeUpdateMutation: vi.fn(() => ({ success: true })),
  logMutationTiming: vi.fn(),
}));

import { createProduct, updateProduct } from "./actions";
import { productFormSchema } from "@/lib/validations/admin-product";

/** Chainable, awaitable Supabase stub that records every write payload. */
function makeDb() {
  const writes: { table: string; op: string; payload: unknown }[] = [];
  const builder = (table: string, op = "select") => {
    const b: Record<string, unknown> = {};
    const chain = new Proxy(b, {
      get(_t, prop: string) {
        if (prop === "then") {
          return (resolve: (v: unknown) => void) =>
            resolve({ data: op === "select" ? [] : null, error: null });
        }
        if (prop === "single") return async () => ({ data: { id: "new-product-id" }, error: null });
        return (...args: unknown[]) => {
          if (["insert", "update", "upsert", "delete"].includes(prop)) {
            writes.push({ table, op: prop, payload: args[0] });
            return builder(table, prop);
          }
          return chain;
        };
      },
    });
    return chain;
  };
  return { writes, from: (table: string) => builder(table) };
}

const variant = {
  unit: "unit", label: "יחידה", price: 10, compare_price: null, stock_quantity: null,
  quantity_pricing_mode: "fixed", quantity_step: 1, min_quantity: 1,
  is_available: true, is_default: true, sort_order: 0,
};

function productData(overrides: Record<string, unknown> = {}) {
  return {
    category_id: "cat-1", name: "תפוחים", slug: "apples", description: "", image_url: "",
    is_active: true, is_featured: false, vat_class: "standard", sort_order: 0,
    qty_deal_enabled: false, qty_deal_quantity: null, qty_deal_price: null,
    variants: [variant],
    ...overrides,
  };
}

const form = (data: unknown) => {
  const fd = new FormData();
  fd.set("data", JSON.stringify(data));
  return fd;
};

describe("productFormSchema.vat_class", () => {
  it("accepts both classes", () => {
    for (const vat_class of ["standard", "zero_rated"]) {
      expect(productFormSchema.safeParse(productData({ vat_class })).success).toBe(true);
    }
  });

  it("rejects an unknown or missing class", () => {
    expect(productFormSchema.safeParse(productData({ vat_class: "exempt" })).success).toBe(false);
    expect(productFormSchema.safeParse(productData({ vat_class: undefined })).success).toBe(false);
  });
});

describe("saving the VAT class", () => {
  beforeEach(() => {
    dbRef.current = makeDb();
  });

  it("createProduct persists the chosen class on the new product row", async () => {
    for (const vat_class of ["zero_rated", "standard"] as const) {
      const db = makeDb();
      dbRef.current = db;
      await createProduct(form(productData({ vat_class })));
      const insert = db.writes.find((w) => w.table === "products" && w.op === "insert");
      expect((insert?.payload as { vat_class: string }).vat_class).toBe(vat_class);
    }
  });

  it("updateProduct persists a changed class on the existing product row", async () => {
    const db = makeDb();
    dbRef.current = db;
    const result = await updateProduct("product-1", form(productData({ vat_class: "zero_rated" })));
    expect(result).toMatchObject({ success: true });
    const update = db.writes.find((w) => w.table === "products" && w.op === "update");
    expect((update?.payload as { vat_class: string }).vat_class).toBe("zero_rated");
  });

  it("an invalid class never reaches the database", async () => {
    const db = makeDb();
    dbRef.current = db;
    const created = await createProduct(form(productData({ vat_class: "bogus" })));
    const updated = await updateProduct("product-1", form(productData({ vat_class: "bogus" })));
    expect(created).toMatchObject({ success: false });
    expect(updated).toMatchObject({ success: false });
    expect(db.writes).toHaveLength(0);
  });
});
