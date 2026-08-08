-- ============================================================
-- משק 22 – Guest checkout, fulfillment methods, offline payment methods
-- Migration: 20260808_003_guest_checkout_fulfillment.sql
--
-- 1. orders.fulfillment_method  – 'delivery' | 'pickup'
-- 2. orders.delivery_zone_id    – nullable, but ONLY for pickup orders
-- 3. orders.payment_method      – constrained allowlist (NOT VALID: legacy rows untouched)
-- 4. orders.guest_access_token_hash – SHA-256 hash of the guest's order access token.
--                                     The plaintext token is never stored.
-- 5. orders.discount_breakdown  – promotion snapshot so historical orders stay
--                                 readable after a promotion changes or is deleted
-- 6. order_items.discount_agorot / promotion_id / promotion_snapshot
--                                 – per-line promotion attribution. The charged
--                                   amount for a line is
--                                   total_price_agorot - discount_agorot,
--                                   which is exactly what is sent to CardCom.
-- 7. create_guest_order_atomic() – atomic + idempotent guest order creation,
--                                  callable ONLY by service_role (server-side).
--
-- Backward compatible: every existing order, order item and the existing
-- create_order_atomic() RPC are left untouched.
-- ============================================================


-- ── 1. Fulfillment method ────────────────────────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS fulfillment_method TEXT NOT NULL DEFAULT 'delivery';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_fulfillment_method_chk'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_fulfillment_method_chk
      CHECK (fulfillment_method IN ('delivery', 'pickup'));
  END IF;
END $$;

COMMENT ON COLUMN public.orders.fulfillment_method IS
  'delivery = shipped to the customer address; pickup = collected at משק 22, מושב ינון.';


-- ── 2. delivery_zone_id nullable for pickup only ─────────────────────────────

ALTER TABLE public.orders ALTER COLUMN delivery_zone_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_delivery_zone_required_chk'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_delivery_zone_required_chk
      CHECK (fulfillment_method = 'pickup' OR delivery_zone_id IS NOT NULL);
  END IF;
END $$;


-- ── 3. payment_method allowlist ──────────────────────────────────────────────
-- NOT VALID: existing rows are never re-checked, so no historical order can be
-- invalidated by this migration. New/updated rows are checked normally.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_payment_method_chk'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_payment_method_chk
      CHECK (payment_method IS NULL
             OR payment_method IN ('credit_card', 'cash', 'phone_credit'))
      NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN public.orders.payment_method IS
  'credit_card = paid online through CardCom; cash = paid on handover; phone_credit = customer asked to be called for card details (card data is NEVER collected or stored by this site).';


-- ── 4. Guest order access token (hash only) ──────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS guest_access_token_hash TEXT;

CREATE INDEX IF NOT EXISTS orders_guest_token_idx
  ON public.orders (guest_access_token_hash)
  WHERE guest_access_token_hash IS NOT NULL;

COMMENT ON COLUMN public.orders.guest_access_token_hash IS
  'SHA-256 (hex) of the cryptographically random access token handed to the guest. The plaintext token is never persisted. Required to view a guest order, poll its payment status, or retry its payment.';


-- ── 5. Order-level promotion snapshot ────────────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_breakdown JSONB;

COMMENT ON COLUMN public.orders.discount_breakdown IS
  'Snapshot of the promotions applied at purchase time: [{ promotion_id, name, required_quantity, bundle_price_agorot, groups_applied, discount_agorot, source }]. Kept so a historical order stays understandable after the promotion is edited or deleted.';


-- ── 6. Per-line promotion attribution ────────────────────────────────────────

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS discount_agorot    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promotion_id       UUID,
  ADD COLUMN IF NOT EXISTS promotion_snapshot JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_discount_range_chk'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_discount_range_chk
      CHECK (discount_agorot >= 0 AND discount_agorot <= total_price_agorot)
      NOT VALID;
  END IF;
END $$;

COMMENT ON COLUMN public.order_items.discount_agorot IS
  'Promotion discount allocated to this line. The amount actually charged for the line is total_price_agorot - discount_agorot; that is the figure sent to CardCom as TotalLineCost.';
COMMENT ON COLUMN public.order_items.promotion_id IS
  'Promotion that produced discount_agorot. Intentionally NOT a foreign key: the order must survive deletion of the promotion. promotion_snapshot preserves the readable details.';


-- ── 7. Atomic + idempotent guest order creation ──────────────────────────────
--
-- Security model:
--   * SECURITY DEFINER, fixed search_path.
--   * EXECUTE is granted to service_role ONLY. anon and authenticated cannot
--     call it, so a guest can never mint an order with prices of their choosing —
--     every amount is recomputed by the Server Action before this is invoked.
--   * user_id is always NULL here (guest orders). Authenticated orders continue
--     to use create_order_atomic().
--   * Idempotent replay: a repeated idempotency_key returns the existing order
--     and rotates its access token to the newly supplied hash, so only the most
--     recent submitter of that key holds a working token.

CREATE OR REPLACE FUNCTION public.create_guest_order_atomic(
  p_idempotency_key     TEXT,
  p_fulfillment_method  TEXT,
  p_delivery_zone_id    UUID,
  p_delivery_address    JSONB,
  p_customer            JSONB,
  p_subtotal_agorot     INTEGER,
  p_delivery_fee_agorot INTEGER,
  p_discount_agorot     INTEGER,
  p_total_agorot        INTEGER,
  p_delivery_notes      TEXT,
  p_payment_method      TEXT,
  p_order_status        TEXT,
  p_payment_status      TEXT,
  p_guest_token_hash    TEXT,
  p_discount_breakdown  JSONB,
  p_items               JSONB
)
RETURNS TABLE (
  out_order_id     UUID,
  out_order_number TEXT,
  out_is_duplicate BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id     UUID;
  v_order_number TEXT;
BEGIN
  -- ── Parameter validation (defense in depth; the Server Action validates first)
  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 10 THEN
    RAISE EXCEPTION 'invalid idempotency key';
  END IF;

  IF p_guest_token_hash IS NULL OR length(p_guest_token_hash) <> 64 THEN
    RAISE EXCEPTION 'invalid guest token hash';
  END IF;

  IF p_fulfillment_method NOT IN ('delivery', 'pickup') THEN
    RAISE EXCEPTION 'invalid fulfillment method';
  END IF;

  IF p_fulfillment_method = 'delivery' AND p_delivery_zone_id IS NULL THEN
    RAISE EXCEPTION 'delivery orders require a delivery zone';
  END IF;

  IF p_payment_method NOT IN ('credit_card', 'cash', 'phone_credit') THEN
    RAISE EXCEPTION 'invalid payment method';
  END IF;

  IF p_order_status NOT IN ('pending_payment', 'confirmed') THEN
    RAISE EXCEPTION 'invalid order status';
  END IF;

  IF p_payment_status NOT IN ('pending', 'paid') THEN
    RAISE EXCEPTION 'invalid payment status';
  END IF;

  IF p_subtotal_agorot < 0 OR p_delivery_fee_agorot < 0 OR p_discount_agorot < 0 THEN
    RAISE EXCEPTION 'negative amounts are not allowed';
  END IF;

  IF p_total_agorot < 0
     OR p_total_agorot <> p_subtotal_agorot + p_delivery_fee_agorot - p_discount_agorot THEN
    RAISE EXCEPTION 'order totals do not balance';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'order must contain at least one item';
  END IF;

  -- ── Idempotent replay ──────────────────────────────────────────────────────
  SELECT id, order_number
  INTO   v_order_id, v_order_number
  FROM   orders
  WHERE  idempotency_key = p_idempotency_key
    AND  user_id IS NULL;

  IF FOUND THEN
    UPDATE orders
    SET    guest_access_token_hash = p_guest_token_hash,
           updated_at              = now()
    WHERE  id = v_order_id;

    RETURN QUERY SELECT v_order_id, v_order_number, TRUE;
    RETURN;
  END IF;

  v_order_number := generate_order_number();

  INSERT INTO orders (
    order_number, user_id, idempotency_key,
    fulfillment_method, delivery_zone_id,
    delivery_address_snapshot, customer_snapshot,
    subtotal_agorot, delivery_fee_agorot, discount_agorot, total_agorot,
    order_status, payment_status, payment_method,
    delivery_notes, guest_access_token_hash, discount_breakdown
  ) VALUES (
    v_order_number, NULL, p_idempotency_key,
    p_fulfillment_method, p_delivery_zone_id,
    p_delivery_address, p_customer,
    p_subtotal_agorot, p_delivery_fee_agorot, p_discount_agorot, p_total_agorot,
    p_order_status::order_status, p_payment_status::payment_status, p_payment_method,
    p_delivery_notes, p_guest_token_hash, p_discount_breakdown
  )
  RETURNING id INTO v_order_id;

  INSERT INTO order_items (
    order_id, product_variant_id, product_snapshot,
    quantity, unit_price_agorot, total_price_agorot,
    discount_agorot, promotion_id, promotion_snapshot
  )
  SELECT
    v_order_id,
    (item ->> 'product_variant_id')::UUID,
    item -> 'product_snapshot',
    (item ->> 'quantity')::NUMERIC,
    (item ->> 'unit_price_agorot')::INTEGER,
    (item ->> 'total_price_agorot')::INTEGER,
    COALESCE((item ->> 'discount_agorot')::INTEGER, 0),
    NULLIF(item ->> 'promotion_id', '')::UUID,
    item -> 'promotion_snapshot'
  FROM jsonb_array_elements(p_items) AS item;

  RETURN QUERY SELECT v_order_id, v_order_number, FALSE;
END;
$$;

-- Server-side callers only. anon/authenticated must never reach this directly.
REVOKE ALL    ON FUNCTION public.create_guest_order_atomic FROM PUBLIC;
REVOKE ALL    ON FUNCTION public.create_guest_order_atomic FROM anon;
REVOKE ALL    ON FUNCTION public.create_guest_order_atomic FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.create_guest_order_atomic TO service_role;
