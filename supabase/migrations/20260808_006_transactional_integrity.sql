-- ============================================================
-- משק 22 – Transactional integrity fixes
-- Migration: 20260808_006_transactional_integrity.sql
--
-- Three independent correctness problems, all of the same shape: a sequence of
-- statements that must succeed or fail as one, currently issued as separate
-- requests that can leave the database in a state no single step intended.
--
--   1. save_promotion()            – promotion + its membership in one transaction
--   2. create_guest_order_atomic() – concurrency-safe idempotency
--   3. stock reservation           – no overselling a configured stock quantity
--
-- Every function is SECURITY DEFINER with a fixed search_path and EXECUTE
-- granted to service_role only, matching the existing RPCs. Re-running the file
-- is safe (CREATE OR REPLACE / IF NOT EXISTS throughout).
-- ============================================================


-- ============================================================
-- 1. Atomic promotion create/update
-- ============================================================
--
-- The admin action previously did: UPDATE promotion → DELETE all items →
-- INSERT new items, as three separate PostgREST requests. If the insert failed
-- (a per_kg variant, an overlapping promotion) the promotion was left ACTIVE
-- with NO eligible products — silently pricing nothing. The activation trigger
-- could also reject the update while the OLD membership was still in place.
--
-- This function does the whole thing in one transaction, in an order the guards
-- can actually validate:
--   • create or update the row, forced inactive
--   • replace the membership completely
--   • apply the caller's real dates and active flag LAST, so
--     promotions_activation_guard sees the final membership set
-- Any failure raises, and the entire operation rolls back — including the
-- membership delete.

CREATE OR REPLACE FUNCTION public.save_promotion(
  p_promotion_id        UUID,          -- NULL = create
  p_name                TEXT,
  p_description         TEXT,
  p_required_quantity   INTEGER,
  p_bundle_price_agorot INTEGER,
  p_is_active           BOOLEAN,
  p_starts_at           TIMESTAMPTZ,
  p_ends_at             TIMESTAMPTZ,
  p_sort_order          INTEGER,
  p_variant_ids         UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_variant_ids IS NULL OR array_length(p_variant_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'promotion must include at least one product variant'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_promotion_id IS NULL THEN
    -- Created inactive; the requested state is applied at the end.
    INSERT INTO promotions (
      name, description, promotion_type, required_quantity,
      bundle_price_agorot, is_active, starts_at, ends_at, sort_order
    ) VALUES (
      p_name, p_description, 'mix_and_match_quantity', p_required_quantity,
      p_bundle_price_agorot, FALSE, p_starts_at, p_ends_at, p_sort_order
    )
    RETURNING id INTO v_id;
  ELSE
    v_id := p_promotion_id;

    -- Deactivate first so the overlap guard cannot reject the edit on the
    -- strength of the membership we are about to replace.
    UPDATE promotions
    SET    is_active = FALSE
    WHERE  id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'promotion % not found', v_id USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  -- Replace the membership wholesale. Both statements are inside this
  -- transaction, so a rejected INSERT rolls the DELETE back too.
  DELETE FROM promotion_items WHERE promotion_id = v_id;

  INSERT INTO promotion_items (promotion_id, product_variant_id)
  SELECT v_id, variant_id
  FROM   unnest(p_variant_ids) AS variant_id;

  -- Apply the real values last, so promotions_activation_guard validates the
  -- final membership set rather than a half-updated one.
  UPDATE promotions
  SET    name                = p_name,
         description         = p_description,
         required_quantity   = p_required_quantity,
         bundle_price_agorot = p_bundle_price_agorot,
         starts_at           = p_starts_at,
         ends_at             = p_ends_at,
         sort_order          = p_sort_order,
         is_active           = p_is_active
  WHERE  id = v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL     ON FUNCTION public.save_promotion FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.save_promotion FROM anon;
REVOKE ALL     ON FUNCTION public.save_promotion FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.save_promotion TO service_role;


-- ============================================================
-- 2. Concurrency-safe guest order idempotency
-- ============================================================
--
-- The previous body did SELECT-then-INSERT. Two simultaneous first submissions
-- of the same idempotency key both miss the SELECT; one then dies on the unique
-- index and the customer sees a generic failure for an order that did succeed.
--
-- Fixed by attempting the INSERT and catching unique_violation, which is the
-- only race-free pattern here: the unique index is the arbitration point. On
-- conflict the existing row is re-read and reported as a duplicate, so the
-- caller receives the same order either way and items are never inserted twice.
--
-- Everything else is unchanged: service-role only, guest token hashing, atomic
-- insertion of the order together with its items.

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

  -- ── Fast path: an already-known key ────────────────────────────────────────
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

  -- ── Insert, arbitrating concurrent first submissions on the unique index ───
  BEGIN
    v_order_number := generate_order_number();

    -- Stock is reserved inside the same transaction: if any line is short the
    -- reservation raises and this INSERT is rolled back with it.
    PERFORM public.reserve_stock_for_items(p_items);

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

  EXCEPTION
    WHEN unique_violation THEN
      -- Another request inserted the same idempotency key first. Re-read its
      -- order and report the duplicate, so both callers get the same answer and
      -- neither sees a spurious failure. No items were written by this branch.
      SELECT id, order_number
      INTO   v_order_id, v_order_number
      FROM   orders
      WHERE  idempotency_key = p_idempotency_key
        AND  user_id IS NULL;

      IF NOT FOUND THEN
        -- The unique violation came from something other than the idempotency
        -- key (e.g. order_number). Surface it rather than guessing.
        RAISE;
      END IF;

      UPDATE orders
      SET    guest_access_token_hash = p_guest_token_hash,
             updated_at              = now()
      WHERE  id = v_order_id;

      RETURN QUERY SELECT v_order_id, v_order_number, TRUE;
  END;
END;
$$;

REVOKE ALL    ON FUNCTION public.create_guest_order_atomic FROM PUBLIC;
REVOKE ALL    ON FUNCTION public.create_guest_order_atomic FROM anon;
REVOKE ALL    ON FUNCTION public.create_guest_order_atomic FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.create_guest_order_atomic TO service_role;


-- ============================================================
-- 3. Stock reservation
-- ============================================================
--
-- product_variants.stock_quantity is editable in the admin panel but was never
-- read at checkout, so a configured stock could be oversold without limit.
--
-- SCOPE — deliberately narrow. stock_quantity is an INTEGER and the admin form
-- labels it as a plain unit count. A per_kg variant is sold by weight in
-- fractional quantities (0.5 kg steps), which an integer column cannot represent
-- without inventing semantics nobody specified — is "10" ten kilograms, or ten
-- half-kilo bags? Rather than guess, enforcement applies ONLY to fixed-unit
-- variants. A per_kg variant is treated as unlimited regardless of the value
-- stored, exactly as before this migration. Extending to weight-based stock
-- requires a deliberate schema change (e.g. NUMERIC stock_grams).
--
--   NULL stock_quantity → unlimited (unchanged)
--   per_kg variant      → unlimited (documented limitation)
--   fixed-unit variant  → decremented, and never below zero
--
-- The UPDATE ... WHERE stock_quantity >= qty is the concurrency control: two
-- simultaneous orders for the last item cannot both match, so exactly one wins
-- and the other raises and rolls back.

CREATE OR REPLACE FUNCTION public.reserve_stock_for_items(p_items JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item        JSONB;
  v_variant_id  UUID;
  v_quantity    NUMERIC;
  v_mode        TEXT;
  v_stock       INTEGER;
  v_updated     INTEGER;
  v_name        TEXT;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_variant_id := (v_item ->> 'product_variant_id')::UUID;
    v_quantity   := (v_item ->> 'quantity')::NUMERIC;

    SELECT pv.quantity_pricing_mode, pv.stock_quantity, p.name
    INTO   v_mode, v_stock, v_name
    FROM   product_variants pv
    JOIN   products p ON p.id = pv.product_id
    WHERE  pv.id = v_variant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product variant % no longer exists', v_variant_id
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- Unlimited: nothing configured, or a weight-based variant (see scope note).
    CONTINUE WHEN v_stock IS NULL OR v_mode = 'per_kg';

    -- Conditional decrement. The WHERE clause is what makes this safe under
    -- concurrency — it re-checks availability at write time, not at read time.
    UPDATE product_variants
    SET    stock_quantity = stock_quantity - CEIL(v_quantity)::INTEGER,
           updated_at     = now()
    WHERE  id             = v_variant_id
      AND  stock_quantity >= CEIL(v_quantity)::INTEGER;

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
      RAISE EXCEPTION 'insufficient stock for %', COALESCE(v_name, v_variant_id::TEXT)
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL     ON FUNCTION public.reserve_stock_for_items FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.reserve_stock_for_items FROM anon;
REVOKE ALL     ON FUNCTION public.reserve_stock_for_items FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.reserve_stock_for_items TO service_role;

-- Stock can never go negative, whatever writes it.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_stock_non_negative_chk'
  ) THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_stock_non_negative_chk
      CHECK (stock_quantity IS NULL OR stock_quantity >= 0)
      NOT VALID;   -- existing rows are not re-checked
  END IF;
END $$;
