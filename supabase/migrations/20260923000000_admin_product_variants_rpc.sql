-- ============================================================
-- משק 22 – Admin product+variant save, one round trip
-- Migration: 20260923000000_admin_product_variants_rpc.sql
--
-- Why this exists
-- ----------------
-- updateProduct() in src/app/meshek22-control/(protected)/products/actions.ts
-- used to issue 3-4 sequential groups of Supabase REST calls (update+read →
-- clear-defaults+delete → upsert+insert) to save one product and its
-- variants. Each round trip pays full network latency to the Supabase
-- project (AWS ap-southeast-1). This folds the whole save into one
-- PostgREST call, executed as one Postgres transaction — a failure at any
-- step rolls back everything, including the product row itself.
--
-- Pattern matches the existing save_promotion() in
-- 20260808000600_transactional_integrity.sql exactly: SECURITY DEFINER, a
-- fixed search_path, EXECUTE granted to service_role only. Admin
-- authorization is enforced by requireAdmin() in the Server Action before
-- this RPC is ever called — the same model as every other admin RPC in this
-- codebase. createAdminClient() (src/lib/supabase/server.ts) authenticates
-- with the service-role key alone, with no end-user JWT and therefore no
-- auth.uid() to check inside the function; REVOKE ALL FROM anon/authenticated
-- is what actually makes this unreachable from the browser or from a
-- logged-in non-admin's own session — not an in-function role check, which
-- would have nothing to check against under this client.
--
-- Business rules preserved exactly from the TypeScript it replaces:
--   • idx_variants_one_default (a unique partial index on
--     product_variants(product_id) WHERE is_default) is why every existing
--     variant's is_default is cleared before the upsert — otherwise a
--     changed default would collide with the still-true old one mid-write.
--   • The 1kg → unit price-sync rule: if the submitted '1kg' variant's price
--     differs from what is currently stored, the 'unit' variant's price (and
--     compare_price, if set) is scaled by the same ratio — this used to
--     require a pre-read from the Server Action; it now happens inside the
--     same transaction using the pre-write row.
--   • A variant no longer present in the submission is deleted; one that has
--     no 'id' in its JSON object is a new row (id key must be OMITTED, not
--     set to JSON null, for a new variant — see the "elem ? 'id'" checks
--     below, which test key presence).
--   • Removing a variant that already has order history hits the same
--     order_items foreign key it does today and raises the same 23503 the
--     Server Action already knows how to translate into a Hebrew message —
--     nothing new to catch here, the error just propagates.
--
-- Returns the saved product and its full variant list, WITH REAL DATABASE
-- IDS for every variant (including ones just created) — the Server Action
-- passes this back to the client so a newly added variant is never
-- resubmitted as "new" on a second save without a page reload, which used to
-- create a duplicate row (ProductForm.tsx never wrote server-assigned ids
-- back into its local form state).
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_save_product_with_variants(
  p_product_id            UUID,             -- NULL = create
  p_category_id           UUID,
  p_name                  TEXT,
  p_slug                  TEXT,
  p_description           TEXT,
  p_image_url             TEXT,
  p_is_active             BOOLEAN,
  p_is_featured           BOOLEAN,
  p_sort_order            INTEGER,
  p_qty_deal_enabled      BOOLEAN,
  p_qty_deal_quantity     INTEGER,
  p_qty_deal_price_agorot INTEGER,
  p_variants              JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id                   UUID;
  v_current_kg_agorot    INTEGER;
  v_current_unit_agorot  INTEGER;
  v_current_unit_compare INTEGER;
  v_submitted_kg_agorot  INTEGER;
  v_ratio                NUMERIC;
  v_variant              JSONB;
  v_adjusted             JSONB[] := '{}';
  v_variants             JSONB;
  v_submitted_ids        UUID[];
  v_ids_to_delete        UUID[];
BEGIN
  IF p_variants IS NULL OR jsonb_array_length(p_variants) = 0 THEN
    RAISE EXCEPTION 'product must have at least one variant'
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── 1. Product row ──────────────────────────────────────────────────────
  IF p_product_id IS NULL THEN
    INSERT INTO products (
      category_id, name, slug, description, image_url,
      is_active, is_featured, sort_order,
      qty_deal_enabled, qty_deal_quantity, qty_deal_price_agorot
    ) VALUES (
      p_category_id, p_name, p_slug, p_description, p_image_url,
      p_is_active, p_is_featured, p_sort_order,
      p_qty_deal_enabled, p_qty_deal_quantity, p_qty_deal_price_agorot
    )
    RETURNING id INTO v_id;
  ELSE
    v_id := p_product_id;

    UPDATE products
    SET    category_id           = p_category_id,
           name                  = p_name,
           slug                  = p_slug,
           description           = p_description,
           image_url             = p_image_url,
           is_active             = p_is_active,
           is_featured           = p_is_featured,
           sort_order            = p_sort_order,
           qty_deal_enabled      = p_qty_deal_enabled,
           qty_deal_quantity     = p_qty_deal_quantity,
           qty_deal_price_agorot = p_qty_deal_price_agorot
    WHERE  id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product % not found', v_id USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  -- ── 2. 1kg → unit price-sync rule (create has nothing to sync against —
  --      v_current_kg_agorot stays NULL and the loop below is a no-op) ─────
  IF p_product_id IS NOT NULL THEN
    SELECT price_agorot INTO v_current_kg_agorot
    FROM   product_variants WHERE product_id = v_id AND unit = '1kg';

    SELECT price_agorot, compare_price_agorot INTO v_current_unit_agorot, v_current_unit_compare
    FROM   product_variants WHERE product_id = v_id AND unit = 'unit';
  END IF;

  SELECT (elem->>'price_agorot')::INTEGER INTO v_submitted_kg_agorot
  FROM   jsonb_array_elements(p_variants) elem
  WHERE  elem->>'unit' = '1kg' AND elem ? 'id'
  LIMIT  1;

  v_ratio := NULL;
  IF v_current_kg_agorot IS NOT NULL AND v_current_kg_agorot > 0
     AND v_submitted_kg_agorot IS NOT NULL
     AND v_submitted_kg_agorot <> v_current_kg_agorot THEN
    v_ratio := v_submitted_kg_agorot::NUMERIC / v_current_kg_agorot::NUMERIC;
  END IF;

  FOR v_variant IN SELECT * FROM jsonb_array_elements(p_variants)
  LOOP
    IF v_ratio IS NOT NULL AND v_variant->>'unit' = 'unit' AND v_current_unit_agorot IS NOT NULL THEN
      v_variant := jsonb_set(v_variant, '{price_agorot}', to_jsonb(ROUND(v_current_unit_agorot * v_ratio)::INTEGER));
      IF v_current_unit_compare IS NOT NULL THEN
        v_variant := jsonb_set(v_variant, '{compare_price_agorot}', to_jsonb(ROUND(v_current_unit_compare * v_ratio)::INTEGER));
      END IF;
    END IF;
    v_adjusted := v_adjusted || v_variant;
  END LOOP;

  v_variants := to_jsonb(v_adjusted);

  -- ── 3. Clear defaults first — see idx_variants_one_default above ────────
  UPDATE product_variants SET is_default = FALSE WHERE product_id = v_id;

  -- ── 4. Delete variants dropped from the submission ───────────────────────
  SELECT array_agg((elem->>'id')::UUID) INTO v_submitted_ids
  FROM   jsonb_array_elements(v_variants) elem
  WHERE  elem ? 'id';

  SELECT array_agg(pv.id) INTO v_ids_to_delete
  FROM   product_variants pv
  WHERE  pv.product_id = v_id
    AND  (v_submitted_ids IS NULL OR pv.id <> ALL (v_submitted_ids));

  IF v_ids_to_delete IS NOT NULL THEN
    DELETE FROM product_variants WHERE id = ANY (v_ids_to_delete);
  END IF;

  -- ── 5. Upsert existing variants, insert new ones ─────────────────────────
  INSERT INTO product_variants (
    id, product_id, unit, label, price_agorot, compare_price_agorot,
    stock_quantity, quantity_pricing_mode, quantity_step, min_quantity,
    is_available, is_default, sort_order
  )
  SELECT
    COALESCE((elem->>'id')::UUID, gen_random_uuid()),
    v_id,
    elem->>'unit',
    elem->>'label',
    (elem->>'price_agorot')::INTEGER,
    (elem->>'compare_price_agorot')::INTEGER,
    (elem->>'stock_quantity')::INTEGER,
    elem->>'quantity_pricing_mode',
    (elem->>'quantity_step')::NUMERIC,
    (elem->>'min_quantity')::NUMERIC,
    (elem->>'is_available')::BOOLEAN,
    (elem->>'is_default')::BOOLEAN,
    (elem->>'sort_order')::INTEGER
  FROM jsonb_array_elements(v_variants) elem
  ON CONFLICT (id) DO UPDATE SET
    unit                  = EXCLUDED.unit,
    label                 = EXCLUDED.label,
    price_agorot          = EXCLUDED.price_agorot,
    compare_price_agorot  = EXCLUDED.compare_price_agorot,
    stock_quantity        = EXCLUDED.stock_quantity,
    quantity_pricing_mode = EXCLUDED.quantity_pricing_mode,
    quantity_step         = EXCLUDED.quantity_step,
    min_quantity          = EXCLUDED.min_quantity,
    is_available          = EXCLUDED.is_available,
    is_default            = EXCLUDED.is_default,
    sort_order            = EXCLUDED.sort_order;

  -- ── 6. Return the saved shape, with real ids for every variant ──────────
  RETURN jsonb_build_object(
    'product',  (SELECT to_jsonb(p) FROM products p WHERE p.id = v_id),
    'variants', (SELECT jsonb_agg(to_jsonb(pv) ORDER BY pv.sort_order) FROM product_variants pv WHERE pv.product_id = v_id)
  );
END;
$$;

REVOKE ALL     ON FUNCTION public.admin_save_product_with_variants FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.admin_save_product_with_variants FROM anon;
REVOKE ALL     ON FUNCTION public.admin_save_product_with_variants FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_save_product_with_variants TO service_role;
