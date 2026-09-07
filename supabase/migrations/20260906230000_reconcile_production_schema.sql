-- ============================================================
-- משק 22 – Production schema reconciliation
-- Migration: 20260906230000_reconcile_production_schema.sql
--
-- Why this file exists
-- ---------------------
-- supabase_migrations.schema_migrations does not exist in production: every
-- historical migration in this repo was run by hand through the Supabase SQL
-- Editor, so the CLI has no record of what actually landed. A read-only audit
-- (see MIGRATION_AUDIT.md, generated the same day as this file) found that
-- production is NOT at the state the local migration files describe:
--
--   • 20260808000200_group_promotions.sql       — MISSING entirely
--       (promotions, promotion_items tables; their trigger guards; RLS)
--   • 20260808000400_admin_performance.sql       — MISSING entirely
--       (admin_dashboard_counts() — the app's own fallback already detects
--        its absence and falls back to 9 separate COUNT queries, so nothing
--        breaks either way, but this closes the gap)
--   • 20260808000500_admin_login_rate_limit.sql  — MISSING entirely
--       (admin_login_attempts table + prune function)
--   • 20260808000600_transactional_integrity.sql — PARTIALLY applied:
--       save_promotion() and reserve_stock_for_items() exist as functions,
--       but save_promotion's target tables (promotions/promotion_items) do
--       not, so calling it today fails at the first INSERT.
--   • 20260906_more_from_the_farm_categories.sql — never applied (written,
--       committed, but never run against production)
--
-- Everything else this audit checked (20260517_payment_hardening's 4 CardCom
-- columns included) was already present and is only defensively re-asserted
-- here (ADD COLUMN IF NOT EXISTS / CREATE OR REPLACE), which is a guaranteed
-- no-op if it's already correct.
--
-- What is deliberately NOT in this file
-- --------------------------------------
--   • 001_initial_schema.sql's own category-merge logic (the INSERT that
--     creates 'ice-creams-and-nuts') is NOT re-run here. It is confirmed
--     already applied, and re-running it after section 7 below (which
--     renames that exact row to 'more-from-the-farm') would wrongly
--     recreate a stray 'ice-creams-and-nuts' row from scratch — its INSERT
--     guard only checks for that one slug, which by the end of this file no
--     longer exists under that name. Nothing here reads or writes that slug
--     except section 7, in the correct order.
--   • 003_admin_rls.sql / 20260423_rls_hardening.sql's exact policy/grant
--     text — the audit could not verify these via the REST API (no
--     information_schema/pg_catalog access from this environment) and they
--     are not part of the known-missing set above. Re-asserting policies you
--     cannot see the current definition of risks silently narrowing access
--     that was deliberately widened by a later, untracked hand-edit. See
--     MIGRATION_AUDIT.md for the exact SQL Editor queries to check these
--     before touching them.
--   • 005_order_domain_hardening.sql's chk_confirmed_requires_paid — flagged
--     in MIGRATION_AUDIT.md as a possible conflict with how cash orders are
--     created today. That is a business-rule question, not a "does
--     production match the migration files" question, and is out of scope
--     for a reconciliation migration. Left untouched either way.
--
-- Safety
-- ------
-- Every statement is guarded (IF NOT EXISTS / CREATE OR REPLACE / a
-- pg_constraint existence check) so this file is safe to run more than once.
-- No DELETE, no DROP, no TRUNCATE, no UPDATE of existing product/order/
-- customer data anywhere in this file. The one migration this folds in that
-- itself touches existing rows (20260906's category rename) only ever
-- UPDATEs a category row's name/slug/parent_id by id — never a product, and
-- never a customer or order.
-- ============================================================

BEGIN;


-- ============================================================
-- 1. Re-assert 20260517_payment_hardening.sql (defensive)
-- ============================================================
-- Audit finding: already present. ADD COLUMN IF NOT EXISTS makes this a
-- guaranteed no-op either way.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_email_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS admin_email_sent_at      timestamptz,
  ADD COLUMN IF NOT EXISTS cardcom_approval_number  text,
  ADD COLUMN IF NOT EXISTS payment_metadata         jsonb;

COMMENT ON COLUMN public.orders.customer_email_sent_at IS
  'Set after customer confirmation email is sent successfully. NULL = not yet sent.';
COMMENT ON COLUMN public.orders.admin_email_sent_at IS
  'Set after admin new-order email is sent successfully. NULL = not yet sent.';
COMMENT ON COLUMN public.orders.cardcom_approval_number IS
  'TranzactionInfo.ApprovalNumber from Cardcom GetLpResult response.';
COMMENT ON COLUMN public.orders.payment_metadata IS
  'Raw Cardcom GetLpResult JSON response stored for audit and dispute resolution.';


-- ============================================================
-- 2. Re-assert 20260808000300_guest_checkout_fulfillment.sql columns/
--    constraints/index (defensive). The function itself is NOT re-asserted
--    here — see section 3, which applies its final (006) form only, so an
--    older function body can never be the last one written.
-- ============================================================

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

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS guest_access_token_hash TEXT;

CREATE INDEX IF NOT EXISTS orders_guest_token_idx
  ON public.orders (guest_access_token_hash)
  WHERE guest_access_token_hash IS NOT NULL;

COMMENT ON COLUMN public.orders.guest_access_token_hash IS
  'SHA-256 (hex) of the cryptographically random access token handed to the guest. The plaintext token is never persisted. Required to view a guest order, poll its payment status, or retry its payment.';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_breakdown JSONB;

COMMENT ON COLUMN public.orders.discount_breakdown IS
  'Snapshot of the promotions applied at purchase time: [{ promotion_id, name, required_quantity, bundle_price_agorot, groups_applied, discount_agorot, source }]. Kept so a historical order stays understandable after the promotion is edited or deleted.';

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


-- ============================================================
-- 3. Apply 20260808000200_group_promotions.sql (MISSING — create fully)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.promotions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 120),
  description         TEXT,
  promotion_type      TEXT        NOT NULL DEFAULT 'mix_and_match_quantity'
                        CHECK (promotion_type IN ('mix_and_match_quantity')),
  required_quantity   INTEGER     NOT NULL CHECK (required_quantity BETWEEN 2 AND 100),
  bundle_price_agorot INTEGER     NOT NULL CHECK (bundle_price_agorot >= 0),
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  starts_at           TIMESTAMPTZ,
  ends_at             TIMESTAMPTZ,
  sort_order          INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT promotions_window_chk
    CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

COMMENT ON TABLE public.promotions IS
  'Mix-and-match quantity promotions: any required_quantity eligible items for bundle_price_agorot.';

CREATE INDEX IF NOT EXISTS promotions_active_idx
  ON public.promotions (is_active, sort_order, created_at);

CREATE TABLE IF NOT EXISTS public.promotion_items (
  promotion_id       UUID        NOT NULL REFERENCES public.promotions(id)       ON DELETE CASCADE,
  product_variant_id UUID        NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (promotion_id, product_variant_id)
);

COMMENT ON TABLE public.promotion_items IS
  'Eligible product variants for a promotion. Variant-level membership avoids unit/kg ambiguity.';

CREATE INDEX IF NOT EXISTS promotion_items_variant_idx
  ON public.promotion_items (product_variant_id);

CREATE OR REPLACE FUNCTION public.promotions_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS promotions_updated_at ON public.promotions;
CREATE TRIGGER promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.promotions_set_updated_at();

CREATE OR REPLACE FUNCTION public.promotion_windows_overlap(
  a_starts TIMESTAMPTZ, a_ends TIMESTAMPTZ,
  b_starts TIMESTAMPTZ, b_ends TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (a_starts IS NULL OR b_ends   IS NULL OR a_starts <  b_ends)
     AND (b_starts IS NULL OR a_ends   IS NULL OR b_starts <  a_ends);
$$;

CREATE OR REPLACE FUNCTION public.promotion_items_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_mode      TEXT;
  v_self      public.promotions%ROWTYPE;
  v_conflict  TEXT;
BEGIN
  SELECT quantity_pricing_mode INTO v_mode
  FROM public.product_variants WHERE id = NEW.product_variant_id;

  IF v_mode IS NULL THEN
    RAISE EXCEPTION 'promotion_items: product variant % does not exist', NEW.product_variant_id;
  END IF;

  IF v_mode = 'per_kg' THEN
    RAISE EXCEPTION
      'promotion_items: per_kg variants cannot join a fixed-unit quantity promotion (variant %)',
      NEW.product_variant_id;
  END IF;

  SELECT * INTO v_self FROM public.promotions WHERE id = NEW.promotion_id;

  IF v_self.is_active THEN
    SELECT p.name INTO v_conflict
    FROM public.promotion_items pi
    JOIN public.promotions p ON p.id = pi.promotion_id
    WHERE pi.product_variant_id = NEW.product_variant_id
      AND pi.promotion_id      <> NEW.promotion_id
      AND p.is_active
      AND public.promotion_windows_overlap(v_self.starts_at, v_self.ends_at, p.starts_at, p.ends_at)
    LIMIT 1;

    IF v_conflict IS NOT NULL THEN
      RAISE EXCEPTION
        'promotion_items: variant % already belongs to overlapping active promotion "%"',
        NEW.product_variant_id, v_conflict;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS promotion_items_guard_trg ON public.promotion_items;
CREATE TRIGGER promotion_items_guard_trg
  BEFORE INSERT OR UPDATE ON public.promotion_items
  FOR EACH ROW EXECUTE FUNCTION public.promotion_items_guard();

CREATE OR REPLACE FUNCTION public.promotions_activation_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_conflict TEXT;
BEGIN
  IF NOT NEW.is_active THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.is_active = NEW.is_active
     AND OLD.starts_at IS NOT DISTINCT FROM NEW.starts_at
     AND OLD.ends_at   IS NOT DISTINCT FROM NEW.ends_at THEN
    RETURN NEW;
  END IF;

  SELECT p.name INTO v_conflict
  FROM public.promotion_items self
  JOIN public.promotion_items other ON other.product_variant_id = self.product_variant_id
  JOIN public.promotions      p     ON p.id = other.promotion_id
  WHERE self.promotion_id  = NEW.id
    AND other.promotion_id <> NEW.id
    AND p.is_active
    AND public.promotion_windows_overlap(NEW.starts_at, NEW.ends_at, p.starts_at, p.ends_at)
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION
      'promotions: activating "%" would overlap promotion "%" on a shared variant',
      NEW.name, v_conflict;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS promotions_activation_guard_trg ON public.promotions;
CREATE TRIGGER promotions_activation_guard_trg
  BEFORE INSERT OR UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.promotions_activation_guard();

ALTER TABLE public.promotions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promotions_public_select ON public.promotions;
CREATE POLICY promotions_public_select ON public.promotions
  FOR SELECT
  TO anon, authenticated
  USING (
    is_active
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at   IS NULL OR ends_at   >  now())
  );

DROP POLICY IF EXISTS promotions_admin_all ON public.promotions;
CREATE POLICY promotions_admin_all ON public.promotions
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS promotion_items_public_select ON public.promotion_items;
CREATE POLICY promotion_items_public_select ON public.promotion_items
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.promotions p
      WHERE p.id = promotion_items.promotion_id
        AND p.is_active
        AND (p.starts_at IS NULL OR p.starts_at <= now())
        AND (p.ends_at   IS NULL OR p.ends_at   >  now())
    )
  );

DROP POLICY IF EXISTS promotion_items_admin_all ON public.promotion_items;
CREATE POLICY promotion_items_admin_all ON public.promotion_items
  FOR ALL USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON COLUMN public.products.qty_deal_enabled IS
  'DEPRECATED (2026-08-08): legacy single-product quantity deal. Superseded by promotions/promotion_items. Still honoured as a fallback when the variant is not part of any active group promotion.';
COMMENT ON COLUMN public.products.qty_deal_quantity IS
  'DEPRECATED (2026-08-08): see products.qty_deal_enabled.';
COMMENT ON COLUMN public.products.qty_deal_price_agorot IS
  'DEPRECATED (2026-08-08): see products.qty_deal_enabled.';


-- ============================================================
-- 4. Re-assert 20260808000600_transactional_integrity.sql (defensive for
--    reserve_stock_for_items, which already existed; the other two are the
--    final versions of functions this file also touches — this section
--    intentionally runs AFTER section 3 created promotions/promotion_items,
--    so save_promotion has something to operate on from the first call).
-- ============================================================

CREATE OR REPLACE FUNCTION public.save_promotion(
  p_promotion_id        UUID,
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

    UPDATE promotions
    SET    is_active = FALSE
    WHERE  id = v_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'promotion % not found', v_id USING ERRCODE = 'no_data_found';
    END IF;
  END IF;

  DELETE FROM promotion_items WHERE promotion_id = v_id;

  INSERT INTO promotion_items (promotion_id, product_variant_id)
  SELECT v_id, variant_id
  FROM   unnest(p_variant_ids) AS variant_id;

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

  BEGIN
    v_order_number := generate_order_number();

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
      SELECT id, order_number
      INTO   v_order_id, v_order_number
      FROM   orders
      WHERE  idempotency_key = p_idempotency_key
        AND  user_id IS NULL;

      IF NOT FOUND THEN
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

    CONTINUE WHEN v_stock IS NULL OR v_mode = 'per_kg';

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_variants_stock_non_negative_chk'
  ) THEN
    ALTER TABLE public.product_variants
      ADD CONSTRAINT product_variants_stock_non_negative_chk
      CHECK (stock_quantity IS NULL OR stock_quantity >= 0)
      NOT VALID;
  END IF;
END $$;


-- ============================================================
-- 5. Apply 20260808000400_admin_performance.sql (MISSING — create fully)
-- ============================================================

CREATE INDEX IF NOT EXISTS orders_created_at_desc_idx
  ON public.orders (created_at DESC);

CREATE INDEX IF NOT EXISTS products_active_sort_idx
  ON public.products (is_active, sort_order);

CREATE OR REPLACE FUNCTION public.admin_dashboard_counts()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH operational AS (
    SELECT *
    FROM orders
    WHERE payment_method IS NULL
       OR payment_method <> 'credit_card'
       OR payment_status = 'paid'
  )
  SELECT jsonb_build_object(
    'orders_awaiting_payment_call', (SELECT count(*) FROM operational
                                      WHERE order_status   = 'pending_payment'
                                        AND payment_method = 'phone_credit'
                                        AND payment_status = 'pending'),
    'orders_new',                   (SELECT count(*) FROM operational WHERE order_status = 'confirmed'),
    'orders_preparing',             (SELECT count(*) FROM operational WHERE order_status = 'preparing'),
    'orders_out_for_delivery',      (SELECT count(*) FROM operational
                                      WHERE order_status = 'out_for_delivery'
                                        AND COALESCE(fulfillment_method, 'delivery') = 'delivery'),
    'orders_ready_for_pickup',      (SELECT count(*) FROM operational
                                      WHERE order_status = 'out_for_delivery'
                                        AND fulfillment_method = 'pickup'),
    'orders_completed',             (SELECT count(*) FROM operational WHERE order_status = 'delivered'),
    'orders_cancelled',             (SELECT count(*) FROM operational WHERE order_status = 'cancelled'),
    'products_active',              (SELECT count(*) FROM products   WHERE is_active),
    'categories_active',            (SELECT count(*) FROM categories WHERE is_active),
    'settlements',                  (SELECT count(*) FROM settlements),
    'delivery_zones',               (SELECT count(*) FROM delivery_zones),
    'promotions_active',            (SELECT count(*) FROM promotions
                                      WHERE is_active
                                        AND (starts_at IS NULL OR starts_at <= now())
                                        AND (ends_at   IS NULL OR ends_at   >  now()))
  );
$$;

REVOKE ALL     ON FUNCTION public.admin_dashboard_counts FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.admin_dashboard_counts FROM anon;
REVOKE ALL     ON FUNCTION public.admin_dashboard_counts FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_dashboard_counts TO service_role;


-- ============================================================
-- 6. Apply 20260808000500_admin_login_rate_limit.sql (MISSING — create fully)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_hash TEXT        NOT NULL,
  identity_kind TEXT        NOT NULL CHECK (identity_kind IN ('ip', 'username')),
  succeeded     BOOLEAN     NOT NULL DEFAULT FALSE,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_login_attempts IS
  'Admin sign-in attempt log used purely for rate limiting. identity_hash is a salted SHA-256 of the IP or submitted username — never the raw value, never a password.';

CREATE INDEX IF NOT EXISTS admin_login_attempts_lookup_idx
  ON public.admin_login_attempts (identity_hash, attempted_at DESC);

CREATE INDEX IF NOT EXISTS admin_login_attempts_cleanup_idx
  ON public.admin_login_attempts (attempted_at);

ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_login_attempts FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_login_attempts FROM anon;
REVOKE ALL ON TABLE public.admin_login_attempts FROM authenticated;
GRANT  ALL ON TABLE public.admin_login_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.prune_admin_login_attempts()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.admin_login_attempts WHERE attempted_at < now() - INTERVAL '1 day';
$$;

REVOKE ALL     ON FUNCTION public.prune_admin_login_attempts FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.prune_admin_login_attempts FROM anon;
REVOKE ALL     ON FUNCTION public.prune_admin_login_attempts FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.prune_admin_login_attempts TO service_role;


-- ============================================================
-- 7. Apply 20260906_more_from_the_farm_categories.sql (never applied)
--
-- Identical to the standalone file of the same content already committed to
-- this repo — folded in here because the baseline/repair step (see the
-- accompanying runbook) marks that file's version as already applied,
-- without running it, so its actual effect must happen from here instead.
-- ============================================================

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id UUID;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_parent_id_fkey'
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_parent_id_fkey
      FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL;
  END IF;
END $$;

INSERT INTO public.categories (name, slug, description, sort_order, is_active, is_featured, parent_id)
SELECT 'עוד מהמשק', 'more-from-the-farm',
       'מגוון מוצרים נוספים ממשק 22 — תבלינים, ביצים, פיצוחים, שמן זית ועוד',
       30, TRUE, FALSE, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories WHERE slug IN ('more-from-the-farm', 'ice-creams-and-nuts')
);

UPDATE public.categories
SET    name        = 'עוד מהמשק',
       slug        = 'more-from-the-farm',
       description = 'מגוון מוצרים נוספים ממשק 22 — תבלינים, ביצים, פיצוחים, שמן זית ועוד',
       is_active   = TRUE,
       parent_id   = NULL
WHERE  slug = 'ice-creams-and-nuts';

DO $$
DECLARE v_parent_id UUID;
BEGIN
  SELECT id INTO v_parent_id FROM public.categories WHERE slug = 'more-from-the-farm';

  INSERT INTO public.categories (name, slug, description, sort_order, is_active, is_featured, parent_id)
  SELECT 'תבלינים', 'spices', 'תבלינים טריים ויבשים', 10, TRUE, FALSE, v_parent_id
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'spices');

  UPDATE public.categories
  SET    parent_id = v_parent_id, sort_order = 10, is_active = TRUE
  WHERE  slug = 'spices';
END $$;

DO $$
DECLARE
  v_parent_id UUID;
  v_eggs_id   UUID;
BEGIN
  SELECT id INTO v_parent_id FROM public.categories WHERE slug = 'more-from-the-farm';

  SELECT id INTO v_eggs_id
  FROM public.categories
  WHERE slug IN ('eggs', 'beitsim') OR name = 'ביצים ומוצרי חלב'
  ORDER BY (slug = 'eggs') DESC NULLS LAST
  LIMIT 1;

  IF v_eggs_id IS NULL THEN
    INSERT INTO public.categories (name, slug, description, sort_order, is_active, is_featured, parent_id)
    VALUES ('ביצים', 'eggs', 'ביצים טריות מהמשק', 20, TRUE, FALSE, v_parent_id);
  ELSE
    UPDATE public.categories
    SET    name      = 'ביצים',
           slug      = 'eggs',
           parent_id = v_parent_id,
           sort_order = 20,
           is_active  = TRUE
    WHERE  id = v_eggs_id;
  END IF;
END $$;

DO $$
DECLARE v_parent_id UUID;
BEGIN
  SELECT id INTO v_parent_id FROM public.categories WHERE slug = 'more-from-the-farm';

  INSERT INTO public.categories (name, slug, description, sort_order, is_active, is_featured, parent_id)
  SELECT 'פיצוחים', 'nuts', 'אגוזים, גרעינים ופיצוחים קלויים', 30, TRUE, FALSE, v_parent_id
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'nuts');

  UPDATE public.categories
  SET    parent_id = v_parent_id, sort_order = 30, is_active = TRUE
  WHERE  slug = 'nuts';
END $$;

DO $$
DECLARE v_parent_id UUID;
BEGIN
  SELECT id INTO v_parent_id FROM public.categories WHERE slug = 'more-from-the-farm';

  INSERT INTO public.categories (name, slug, description, sort_order, is_active, is_featured, parent_id)
  SELECT 'שמן זית', 'olive-oil', 'שמן זית כתית מעולה מהמשק', 40, TRUE, FALSE, v_parent_id
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'olive-oil');

  UPDATE public.categories
  SET    parent_id = v_parent_id, sort_order = 40, is_active = TRUE
  WHERE  slug = 'olive-oil';
END $$;

DO $$
DECLARE v_parent_id UUID;
BEGIN
  SELECT id INTO v_parent_id FROM public.categories WHERE slug = 'more-from-the-farm';

  INSERT INTO public.categories (name, slug, description, sort_order, is_active, is_featured, parent_id)
  SELECT 'ירקות קרנצ''ים', 'crunchy-vegetables', 'ירקות פריכים לנשנוש', 50, TRUE, FALSE, v_parent_id
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'crunchy-vegetables');

  UPDATE public.categories
  SET    parent_id = v_parent_id, sort_order = 50, is_active = TRUE
  WHERE  slug = 'crunchy-vegetables';
END $$;

DO $$
DECLARE v_parent_id UUID;
BEGIN
  SELECT id INTO v_parent_id FROM public.categories WHERE slug = 'more-from-the-farm';

  INSERT INTO public.categories (name, slug, description, sort_order, is_active, is_featured, parent_id)
  SELECT 'סכינים ומקלפים', 'knives-and-peelers', 'כלי חיתוך וקילוף למטבח', 60, TRUE, FALSE, v_parent_id
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'knives-and-peelers');

  UPDATE public.categories
  SET    parent_id = v_parent_id, sort_order = 60, is_active = TRUE
  WHERE  slug = 'knives-and-peelers';
END $$;

DO $$
DECLARE v_parent_id UUID;
BEGIN
  SELECT id INTO v_parent_id FROM public.categories WHERE slug = 'more-from-the-farm';

  INSERT INTO public.categories (name, slug, description, sort_order, is_active, is_featured, parent_id)
  SELECT 'גלידות', 'ice-creams', 'גלידות וארטיקים', 70, TRUE, FALSE, v_parent_id
  WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'ice-creams');

  UPDATE public.categories
  SET    parent_id = v_parent_id, sort_order = 70, is_active = TRUE
  WHERE  slug = 'ice-creams';
END $$;


-- ============================================================
-- 8. Verification — fail the whole transaction loudly rather than leaving
--    production half-migrated.
-- ============================================================

DO $$
DECLARE
  v_parent_id      UUID;
  v_parent_count   INTEGER;
  v_children_count INTEGER;
BEGIN
  IF to_regclass('public.promotions') IS NULL THEN
    RAISE EXCEPTION 'reconciliation failed: public.promotions still missing';
  END IF;
  IF to_regclass('public.promotion_items') IS NULL THEN
    RAISE EXCEPTION 'reconciliation failed: public.promotion_items still missing';
  END IF;
  IF to_regclass('public.admin_login_attempts') IS NULL THEN
    RAISE EXCEPTION 'reconciliation failed: public.admin_login_attempts still missing';
  END IF;
  IF to_regprocedure('public.admin_dashboard_counts()') IS NULL THEN
    RAISE EXCEPTION 'reconciliation failed: public.admin_dashboard_counts() still missing';
  END IF;

  SELECT count(*) INTO v_parent_count
  FROM public.categories
  WHERE slug = 'more-from-the-farm' AND is_active AND parent_id IS NULL;

  IF v_parent_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one active top-level more-from-the-farm category, found %', v_parent_count;
  END IF;

  SELECT id INTO v_parent_id FROM public.categories WHERE slug = 'more-from-the-farm';

  SELECT count(*) INTO v_children_count
  FROM public.categories
  WHERE parent_id = v_parent_id
    AND slug IN ('spices', 'eggs', 'nuts', 'olive-oil', 'crunchy-vegetables', 'knives-and-peelers', 'ice-creams');

  IF v_children_count <> 7 THEN
    RAISE EXCEPTION 'expected all 7 more-from-the-farm children to exist, found %', v_children_count;
  END IF;

  IF EXISTS (SELECT 1 FROM public.categories WHERE slug = 'ice-creams-and-nuts') THEN
    RAISE EXCEPTION 'ice-creams-and-nuts should have been renamed to more-from-the-farm, not left behind';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders'
      AND column_name IN ('customer_email_sent_at','admin_email_sent_at','cardcom_approval_number','payment_metadata')
    HAVING count(*) = 4
  ) THEN
    RAISE EXCEPTION 'reconciliation failed: one or more CardCom payment-hardening columns missing from orders';
  END IF;
END $$;

COMMIT;
