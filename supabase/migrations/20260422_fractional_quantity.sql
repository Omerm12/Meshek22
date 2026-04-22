-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: fractional quantity support for kg-based product variants
-- Date: 2026-04-22
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Add pricing-mode columns to product_variants ──────────────────────────

ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS quantity_pricing_mode TEXT NOT NULL DEFAULT 'fixed'
    CHECK (quantity_pricing_mode IN ('fixed', 'per_kg')),
  ADD COLUMN IF NOT EXISTS quantity_step NUMERIC(10,4) NOT NULL DEFAULT 1
    CHECK (quantity_step > 0 AND quantity_step <= 99),
  ADD COLUMN IF NOT EXISTS min_quantity NUMERIC(10,4) NOT NULL DEFAULT 1
    CHECK (min_quantity > 0 AND min_quantity <= 99);

-- Auto-configure existing 1kg variants with sensible defaults (0.5 kg steps)
UPDATE product_variants
SET
  quantity_pricing_mode = 'per_kg',
  quantity_step         = 0.5,
  min_quantity          = 0.5
WHERE unit = '1kg';

-- ── 2. Change user_cart_items.quantity to NUMERIC + add mode columns ──────────

ALTER TABLE user_cart_items
  ALTER COLUMN quantity TYPE NUMERIC(10,4);

ALTER TABLE user_cart_items
  ADD COLUMN IF NOT EXISTS quantity_pricing_mode TEXT NOT NULL DEFAULT 'fixed'
    CHECK (quantity_pricing_mode IN ('fixed', 'per_kg')),
  ADD COLUMN IF NOT EXISTS quantity_step NUMERIC(10,4) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS min_quantity NUMERIC(10,4) NOT NULL DEFAULT 1;

-- ── 3. Change order_items.quantity to NUMERIC ─────────────────────────────────

ALTER TABLE order_items
  ALTER COLUMN quantity TYPE NUMERIC(10,4);

-- ── 4. Change legacy cart_items.quantity to NUMERIC ───────────────────────────

ALTER TABLE cart_items
  ALTER COLUMN quantity TYPE NUMERIC(10,4);

-- ── 5. Recreate create_order_atomic with NUMERIC quantity support ─────────────
-- IMPORTANT: This is reconstructed from the TypeScript call site.
-- Verify that the INSERT logic matches your original function before running.
-- The only critical change from the original is: ::integer → ::numeric for quantity.

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
  -- Idempotency: return existing order if same key was already used
  SELECT id, order_number
  INTO   v_order_id, v_order_number
  FROM   orders
  WHERE  idempotency_key = p_idempotency_key;

  IF FOUND THEN
    v_is_duplicate := true;
    RETURN QUERY SELECT v_order_id, v_order_number, v_is_duplicate;
    RETURN;
  END IF;

  -- Generate unique order number
  v_order_number := generate_order_number();

  -- Insert the order header
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

  -- Insert line items — quantity is NUMERIC to support fractional kg amounts
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
