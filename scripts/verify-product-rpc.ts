#!/usr/bin/env npx tsx
/**
 * Standalone, one-off verification for admin_save_product_with_variants
 * (supabase/migrations/20260923000000_admin_product_variants_rpc.sql).
 *
 * NOT part of `npm test` — this hits the REAL Supabase project over the
 * network and needs the migration already applied. Run it once, by hand,
 * right after pasting that migration into the Supabase SQL Editor, to
 * confirm the function behaves as documented before trusting it with real
 * product data. The checked-in vitest suite cannot do this itself: it never
 * hits a live network (see admin-mutations.test.ts's structural,
 * source-text-based tests for how RPC call SHAPE is verified instead), and
 * this RPC did not exist in production while this repo's tests were written.
 *
 * Creates and deletes its OWN throwaway category/product/variants/auth user —
 * never touches any real row. Prints PASS/FAIL for each check and exits with
 * a non-zero code if anything failed.
 *
 * Usage: npx tsx scripts/verify-product-rpc.ts
 * Required env vars (in .env.local): NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 */

// Must be first — loads .env.local / .env before any process.env reads
import "./lib/env.js";

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
  process.exit(1);
}

// Narrowed to definite strings past the guard above, so they can be used
// inside main() (a separate function scope, where TS does not carry the
// module-level narrowing forward).
const SUPABASE_URL: string = url;
const ANON_KEY: string = anonKey;

const admin = createClient(SUPABASE_URL, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface Variant {
  id: string;
  unit: string;
  label: string;
  price_agorot: number;
  compare_price_agorot: number | null;
  stock_quantity: number | null;
  quantity_pricing_mode: string;
  quantity_step: number;
  min_quantity: number;
  is_available: boolean;
  is_default: boolean;
  sort_order: number;
}

interface RpcResult {
  product: { id: string; name: string };
  variants: Variant[];
}

type NewVariant = Omit<Variant, "id"> & { id?: string };

let failures = 0;
function check(label: string, cond: boolean, extra?: unknown): void {
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}`, extra ?? "");
  }
}

/** Round-trips a returned variant back into the shape the RPC accepts. */
function toPayload(v: Variant, overrides: Partial<Variant> = {}): NewVariant {
  const merged = { ...v, ...overrides };
  return {
    id: merged.id,
    unit: merged.unit,
    label: merged.label,
    price_agorot: merged.price_agorot,
    compare_price_agorot: merged.compare_price_agorot,
    stock_quantity: merged.stock_quantity,
    quantity_pricing_mode: merged.quantity_pricing_mode,
    quantity_step: merged.quantity_step,
    min_quantity: merged.min_quantity,
    is_available: merged.is_available,
    is_default: merged.is_default,
    sort_order: merged.sort_order,
  };
}

async function main(): Promise<void> {
  console.log("Verifying admin_save_product_with_variants...\n");
  const stamp = Date.now();

  const { data: category, error: catErr } = await admin
    .from("categories")
    .insert({
      name: `__verify_rpc_${stamp}`,
      slug: `__verify-rpc-${stamp}`,
      sort_order: 9999,
      is_active: false,
    })
    .select("id")
    .single();

  if (catErr || !category) {
    console.error("Could not create fixture category — aborting.", catErr);
    process.exit(1);
  }

  const baseArgs = {
    p_category_id: category.id,
    p_name: "__verify rpc product",
    p_slug: `__verify-rpc-product-${stamp}`,
    p_description: "",
    p_image_url: "",
    p_is_active: false,
    p_is_featured: false,
    p_sort_order: 0,
    p_qty_deal_enabled: false,
    p_qty_deal_quantity: null,
    p_qty_deal_price_agorot: null,
  };

  let productId: string | null = null;

  try {
    // ── 1. Create with two variants ────────────────────────────────────
    const { data: created, error: createErr } = await admin.rpc("admin_save_product_with_variants", {
      p_product_id: null,
      ...baseArgs,
      p_variants: [
        {
          unit: "1kg", label: '1 ק"ג', price_agorot: 1000, compare_price_agorot: null,
          stock_quantity: null, quantity_pricing_mode: "per_kg", quantity_step: 0.5,
          min_quantity: 0.5, is_available: true, is_default: true, sort_order: 0,
        },
        {
          unit: "unit", label: "יחידה", price_agorot: 500, compare_price_agorot: null,
          stock_quantity: null, quantity_pricing_mode: "fixed", quantity_step: 1,
          min_quantity: 1, is_available: true, is_default: false, sort_order: 1,
        },
      ],
    });

    check("create succeeds", !createErr, createErr);
    const createResult = created as RpcResult | null;
    productId = createResult?.product?.id ?? null;
    check(
      "create returns exactly 2 variants with real ids",
      (createResult?.variants.length ?? 0) === 2 && (createResult?.variants ?? []).every((v) => typeof v.id === "string")
    );
    if (!productId) throw new Error("no product id returned from create — cannot continue");

    // ── 2. Repeat-save with the SAME ids must not duplicate ────────────
    const { data: resaved, error: resaveErr } = await admin.rpc("admin_save_product_with_variants", {
      p_product_id: productId,
      ...baseArgs,
      p_variants: createResult!.variants.map((v) => toPayload(v)),
    });
    check("repeat-save (same ids) succeeds", !resaveErr, resaveErr);
    const resavedVariants = (resaved as RpcResult | null)?.variants ?? [];
    check("repeat-save still has exactly 2 variants (no duplicates)", resavedVariants.length === 2);

    // ── 3. Add exactly one variant ──────────────────────────────────────
    const { data: added, error: addErr } = await admin.rpc("admin_save_product_with_variants", {
      p_product_id: productId,
      ...baseArgs,
      p_variants: [
        ...resavedVariants.map((v) => toPayload(v)),
        {
          unit: "500g", label: "500 גרם", price_agorot: 700, compare_price_agorot: null,
          stock_quantity: null, quantity_pricing_mode: "fixed", quantity_step: 1,
          min_quantity: 1, is_available: true, is_default: false, sort_order: 2,
        },
      ],
    });
    check("add-one-variant succeeds", !addErr, addErr);
    const addedVariants = (added as RpcResult | null)?.variants ?? [];
    check("add-one-variant results in exactly 3 variants", addedVariants.length === 3);

    // ── 4. Delete only the targeted variant ─────────────────────────────
    const toRemove = addedVariants.find((v) => v.unit === "500g");
    const remaining = addedVariants.filter((v) => v.unit !== "500g");
    const { data: deleted, error: delErr } = await admin.rpc("admin_save_product_with_variants", {
      p_product_id: productId,
      ...baseArgs,
      p_variants: remaining.map((v) => toPayload(v)),
    });
    check("delete-one-variant succeeds", !delErr, delErr);
    const afterDelete = (deleted as RpcResult | null)?.variants ?? [];
    check("delete-one-variant leaves exactly 2 variants", afterDelete.length === 2);
    check("the removed variant's id is actually gone", !afterDelete.some((v) => v.id === toRemove?.id));

    // ── 5. 1kg → unit price sync ────────────────────────────────────────
    const kgVariant = afterDelete.find((v) => v.unit === "1kg")!;
    const unitVariant = afterDelete.find((v) => v.unit === "unit")!;
    const newKgAgorot = Math.round(kgVariant.price_agorot * 1.5); // +50%
    const { data: synced, error: syncErr } = await admin.rpc("admin_save_product_with_variants", {
      p_product_id: productId,
      ...baseArgs,
      p_variants: afterDelete.map((v) =>
        toPayload(v, v.unit === "1kg" ? { price_agorot: newKgAgorot } : {})
      ),
    });
    check("1kg price-change save succeeds", !syncErr, syncErr);
    const syncedVariants = (synced as RpcResult | null)?.variants ?? [];
    const syncedUnit = syncedVariants.find((v) => v.unit === "unit");
    const expectedUnitAgorot = Math.round(unitVariant.price_agorot * 1.5);
    check(
      `unit variant price scaled proportionally (expected ${expectedUnitAgorot}, got ${syncedUnit?.price_agorot})`,
      syncedUnit?.price_agorot === expectedUnitAgorot
    );

    // ── 6. Rollback on a rejected write ──────────────────────────────────
    // Submitting two variants both flagged is_default violates
    // idx_variants_one_default (unique partial index). The product's name
    // change bundled into the SAME call must not survive either — proof the
    // whole transaction rolled back, not just the variant half.
    const { data: beforeBadSave } = await admin.from("products").select("name").eq("id", productId).single();
    const { error: badErr } = await admin.rpc("admin_save_product_with_variants", {
      p_product_id: productId,
      ...baseArgs,
      p_name: "__this name must NOT be saved__",
      p_variants: syncedVariants.map((v) => toPayload(v, { is_default: true })),
    });
    check("a write that violates the one-default-variant constraint is rejected", !!badErr, badErr ? undefined : "expected an error, got success");
    const { data: afterBadSave } = await admin.from("products").select("name").eq("id", productId).single();
    check(
      "the rejected write did not change the product name (whole transaction rolled back)",
      afterBadSave?.name === beforeBadSave?.name
    );
  } finally {
    if (productId) await admin.from("products").delete().eq("id", productId);
    await admin.from("categories").delete().eq("id", category.id);
  }

  // ── 7. Non-admin denial ────────────────────────────────────────────────
  // A real signed-in, non-admin user must be rejected — not just an
  // unauthenticated (anon-role) request.
  const throwawayEmail = `verify-rpc-${stamp}@example.invalid`;
  const throwawayPassword = `Verify-${stamp}-Rpc!`;
  const { data: createdUser, error: createUserErr } = await admin.auth.admin.createUser({
    email: throwawayEmail,
    password: throwawayPassword,
    email_confirm: true,
  });

  if (createUserErr || !createdUser?.user) {
    console.log("  SKIP  non-admin denial check — could not create a throwaway auth user:", createUserErr?.message);
  } else {
    try {
      const anonClient = createClient(SUPABASE_URL, ANON_KEY);
      const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({
        email: throwawayEmail,
        password: throwawayPassword,
      });

      if (signInErr || !signIn.session) {
        console.log("  SKIP  non-admin denial check — could not sign in as the throwaway user:", signInErr?.message);
      } else {
        const asNonAdmin = createClient(SUPABASE_URL, ANON_KEY, {
          global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
        });
        const badSlug = `__should-never-exist-${stamp}`;
        const { error: deniedErr } = await asNonAdmin.rpc("admin_save_product_with_variants", {
          p_product_id: null,
          p_category_id: category.id,
          p_name: "should never be created",
          p_slug: badSlug,
          p_description: "", p_image_url: "", p_is_active: false, p_is_featured: false, p_sort_order: 0,
          p_qty_deal_enabled: false, p_qty_deal_quantity: null, p_qty_deal_price_agorot: null,
          p_variants: [{
            unit: "unit", label: "יחידה", price_agorot: 100, compare_price_agorot: null,
            stock_quantity: null, quantity_pricing_mode: "fixed", quantity_step: 1,
            min_quantity: 1, is_available: true, is_default: true, sort_order: 0,
          }],
        });
        check(
          "a signed-in non-admin cannot call the RPC (permission denied, not a partial success)",
          !!deniedErr,
          deniedErr ? undefined : "expected an error, got success — SECURITY HOLE"
        );

        const { data: leaked } = await admin.from("products").select("id").eq("slug", badSlug);
        check("no product leaked through despite the denial", !leaked || leaked.length === 0);
        if (leaked && leaked.length > 0) {
          await admin.from("products").delete().eq("slug", badSlug);
        }
      }
    } finally {
      await admin.auth.admin.deleteUser(createdUser.user.id);
    }
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Verification script crashed:", err);
  process.exit(1);
});
