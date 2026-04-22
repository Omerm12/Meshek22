-- ============================================================
-- משק 22 – RLS Hardening & Security Fixes
-- Migration: 20260423_rls_hardening.sql
--
-- This migration does NOT replace existing policies wholesale.
-- It AUDITS the current policy set, FIXES three identified holes,
-- and DOCUMENTS the complete intended policy surface in one place.
--
-- Holes fixed:
--   1. profiles role-escalation: authenticated users could SET role = 'admin'
--      on their own row, because profiles_own_update has no column restriction.
--   2. orders null-user insert: orders_own_insert allowed user_id IS NULL,
--      creating ownerless orders via direct API (bypassing the RPC).
--   3. create_order_atomic idempotency: the 20260422 rewrite dropped
--      user_id = v_user_id from the duplicate check — a guessed UUID key
--      would return another user's order ID + number.
--
-- Everything else was already correct. Policies are documented here
-- for reference even when not changed.
-- ============================================================


-- ============================================================
-- FIX 1: Prevent role escalation via column-level privilege revocation
-- ============================================================
--
-- The profiles_own_update RLS policy lets a user UPDATE their own row,
-- but PostgreSQL has no per-column RLS filtering — it is all-or-nothing
-- at the row level. The correct layer for column-level restrictions is
-- the column privilege system (same technique already used for last_login_at).
--
-- After this: authenticated users CAN update full_name, email, phone.
--             authenticated users CANNOT update role, id, created_at.
--             service_role (admin panel) retains full access.

REVOKE UPDATE (role)       ON profiles FROM authenticated;
REVOKE UPDATE (id)         ON profiles FROM authenticated;
REVOKE UPDATE (created_at) ON profiles FROM authenticated;
REVOKE INSERT (role)       ON profiles FROM authenticated;

-- Restore explicit service_role grants for clarity.
GRANT  UPDATE (role) ON profiles TO service_role;
GRANT  INSERT (role) ON profiles TO service_role;


-- ============================================================
-- FIX 2: Tighten orders_own_insert — remove the user_id IS NULL escape hatch
-- ============================================================
--
-- The existing policy `orders_own_insert` has:
--   WITH CHECK (auth.uid() = user_id OR user_id IS NULL)
--
-- The NULL branch was meant to support guest checkout, but:
--   a) Guest checkout is not implemented — all orders go through
--      create_order_atomic(), which is SECURITY DEFINER and derives
--      user_id from auth.uid() server-side (bypassing this policy entirely).
--   b) The NULL branch allows any authenticated user to INSERT an order
--      with no owner, which is unreachable via orders_own_select and
--      creates permanent orphaned rows.
--
-- The correct policy: only your JWT user_id is allowed, no exceptions.
-- The RPC create_order_atomic() is SECURITY DEFINER so it is unaffected.

DROP POLICY IF EXISTS "orders_own_insert" ON public.orders;
CREATE POLICY "orders_own_insert" ON public.orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Note: orders_own_select (read own orders) and orders_own_update
-- (none for regular users — payment updates go through service_role)
-- are unchanged.


-- ============================================================
-- FIX 3: Restore user_id scope to create_order_atomic idempotency check
-- ============================================================
--
-- Migration 20260422 rewrote the function and accidentally dropped
-- the `AND user_id = v_user_id` condition from the idempotency SELECT.
-- Without it, if user A submits a UUID that happens to match an existing
-- key from user B, A receives B's order_id and order_number.
-- UUIDs make accidental collision virtually impossible, but intentional
-- brute-force is a concern for any multi-tenant system.
--
-- Restored fix: filter by BOTH idempotency_key AND the calling user's id.

CREATE OR REPLACE FUNCTION create_order_atomic(
  p_idempotency_key     text,
  p_delivery_zone_id    uuid,
  p_delivery_address    jsonb,
  p_customer            jsonb,
  p_subtotal_agorot     integer,
  p_delivery_fee_agorot integer,
  p_discount_agorot     integer,
  p_total_agorot        integer,
  p_delivery_notes      text,
  p_items               jsonb
)
RETURNS TABLE (
  out_order_id     uuid,
  out_order_number text,
  out_is_duplicate boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id     uuid;
  v_order_number text;
  v_is_duplicate boolean := false;
  v_user_id      uuid    := auth.uid();
BEGIN
  -- Require a valid authenticated caller — never trust a NULL uid.
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  -- Idempotency: return the existing order only if it belongs to THIS user.
  -- Scoping by user_id prevents cross-user key collisions (intentional or not).
  SELECT id, order_number
  INTO   v_order_id, v_order_number
  FROM   orders
  WHERE  idempotency_key = p_idempotency_key
    AND  user_id         = v_user_id;         -- ← the fix

  IF FOUND THEN
    v_is_duplicate := true;
    RETURN QUERY SELECT v_order_id, v_order_number, v_is_duplicate;
    RETURN;
  END IF;

  v_order_number := generate_order_number();

  INSERT INTO orders (
    order_number,
    user_id,
    idempotency_key,
    delivery_zone_id,
    delivery_address_snapshot,
    customer_snapshot,
    subtotal_agorot,
    delivery_fee_agorot,
    discount_agorot,
    total_agorot,
    order_status,
    payment_status,
    delivery_notes
  ) VALUES (
    v_order_number,
    v_user_id,
    p_idempotency_key,
    p_delivery_zone_id,
    p_delivery_address,
    p_customer,
    p_subtotal_agorot,
    p_delivery_fee_agorot,
    p_discount_agorot,
    p_total_agorot,
    'pending_payment',
    'pending',
    p_delivery_notes
  )
  RETURNING id INTO v_order_id;

  INSERT INTO order_items (
    order_id,
    product_variant_id,
    product_snapshot,
    quantity,
    unit_price_agorot,
    total_price_agorot
  )
  SELECT
    v_order_id,
    (item ->> 'product_variant_id')::uuid,
    item -> 'product_snapshot',
    (item ->> 'quantity')::numeric,
    (item ->> 'unit_price_agorot')::integer,
    (item ->> 'total_price_agorot')::integer
  FROM jsonb_array_elements(p_items) AS item;

  RETURN QUERY SELECT v_order_id, v_order_number, v_is_duplicate;
END;
$$;

-- Re-apply grants after function replacement (CREATE OR REPLACE does not
-- preserve grants in all Postgres versions).
REVOKE EXECUTE ON FUNCTION create_order_atomic FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION create_order_atomic TO authenticated;


-- ============================================================
-- REFERENCE: Complete intended policy surface (no changes below)
-- ============================================================
--
-- Listed here as a single source of truth so the full security model
-- is readable without diffing six migration files.
--
-- Legend:
--   [PUBLIC]  anon + authenticated roles
--   [USER]    authenticated role, own rows only
--   [ADMIN]   is_admin() helper (role = 'admin' in profiles)
--   [SVCrole] service_role (createAdminClient) bypasses RLS entirely
--
-- ── CATALOG (public read, admin write) ───────────────────────────────────────
--
--   categories      [PUBLIC]  SELECT where is_active = true
--   categories      [ADMIN]   ALL (via admin_categories_all)
--
--   products        [PUBLIC]  SELECT where is_active = true
--   products        [ADMIN]   ALL (via admin_products_all)
--
--   product_variants[PUBLIC]  SELECT where is_available = true
--   product_variants[ADMIN]   ALL (via admin_variants_all)
--
--   delivery_zones  [PUBLIC]  SELECT where is_active = true
--   delivery_zones  [ADMIN]   ALL (via admin_zones_all)
--
--   settlements     [PUBLIC]  SELECT where is_active = true
--   settlements     [ADMIN]   ALL (via admin_settlements_all)
--
-- ── USER DATA (own rows only) ─────────────────────────────────────────────────
--
--   profiles        [USER]    SELECT own row (profiles_own_select)
--   profiles        [USER]    INSERT own row on signup recovery (profiles_own_insert)
--   profiles        [USER]    UPDATE own row — role/id/created_at columns blocked
--                              by column-level REVOKE (this migration + 008)
--   profiles        [ADMIN]   SELECT + UPDATE any row
--
--   addresses       [USER]    SELECT / INSERT / UPDATE / DELETE own rows
--
--   user_cart_items [USER]    ALL — USING + WITH CHECK (auth.uid() = user_id)
--                              Covers SELECT, INSERT, UPDATE, DELETE atomically.
--                              Service_role bypasses for admin debugging.
--
--   orders          [USER]    SELECT own (orders_own_select)
--   orders          [USER]    INSERT own — only via create_order_atomic RPC in practice;
--                              direct INSERT requires auth.uid() = user_id (this migration)
--   orders          [ADMIN]   SELECT + UPDATE any order
--   orders          [SVCrole] Full access (payment webhook updates, admin panel)
--
--   order_items     [USER]    SELECT where order belongs to caller
--   order_items     [USER]    INSERT where order belongs to caller (created by RPC)
--   order_items     [ADMIN]   SELECT any
--
-- ── LEGACY TABLES (no longer used by app code) ───────────────────────────────
--
--   carts           [USER]    ALL where auth.uid() = user_id
--   cart_items      [USER]    ALL via cart ownership join
--
--   These tables exist from the initial schema (001) but are superseded by
--   user_cart_items. Their RLS policies are correct and harmless; the tables
--   themselves can be dropped in a future cleanup migration.
--
-- ── WHAT service_role (createAdminClient) CAN DO ────────────────────────────
--
--   service_role bypasses ALL RLS policies. The admin panel exclusively uses
--   createAdminClient() for data access. This is intentional and correct —
--   is_admin() policies exist only as defense-in-depth for direct API calls.
--   The service_role key must NEVER be exposed to the browser.
