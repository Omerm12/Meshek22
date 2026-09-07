-- ============================================================
-- משק 22 – Group / mix-and-match quantity promotions
-- Migration: 20260808_002_group_promotions.sql
--
-- Introduces a normalised promotion model that supports
-- "any N eligible items for ₪X" across MULTIPLE products/variants
-- (e.g. 2 bananas + 2 cucumbers qualify for one "4 for ₪10" group).
--
-- Tables:
--   promotions       – the deal definition
--   promotion_items  – eligible product VARIANTS (authoritative membership level,
--                      so a 1kg variant and a unit variant are never confused)
--
-- Backward compatibility:
--   The legacy per-product columns products.qty_deal_enabled /
--   qty_deal_quantity / qty_deal_price_agorot are NOT dropped and NOT migrated.
--   They keep working as a legacy single-product fallback. The shared
--   calculation engine (src/lib/promotions/engine.ts) always prefers a group
--   promotion when a variant belongs to one, so the two never stack.
--   Deprecation is documented via COMMENT ON COLUMN below.
--
-- Safety guards enforced in the database (last-resort; the admin UI shows
-- friendly Hebrew validation before these ever fire):
--   1. per_kg (fractional) variants may NOT join a fixed-unit "N for price" deal.
--   2. A variant may not belong to two promotions whose active windows overlap.
-- ============================================================


-- ── 1. promotions ────────────────────────────────────────────────────────────

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


-- ── 2. promotion_items ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.promotion_items (
  promotion_id       UUID        NOT NULL REFERENCES public.promotions(id)       ON DELETE CASCADE,
  product_variant_id UUID        NOT NULL REFERENCES public.product_variants(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (promotion_id, product_variant_id)
);

COMMENT ON TABLE public.promotion_items IS
  'Eligible product variants for a promotion. Variant-level membership avoids unit/kg ambiguity.';

-- Reverse lookup: "which promotion does this variant belong to?" — used on every
-- cart / checkout calculation and by the /promotions storefront collection.
CREATE INDEX IF NOT EXISTS promotion_items_variant_idx
  ON public.promotion_items (product_variant_id);


-- ── 3. updated_at trigger ────────────────────────────────────────────────────

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


-- ── 4. Validity guards ───────────────────────────────────────────────────────
--
-- Two promotions "overlap" when both are active and their optional
-- [starts_at, ends_at) windows intersect. NULL means unbounded on that side.

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

-- Guard A: reject per_kg variants and overlapping memberships on INSERT/UPDATE.
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

-- Guard B: re-check when a promotion is activated or its window is moved.
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


-- ── 5. Row Level Security ────────────────────────────────────────────────────
--
-- Public (anon + authenticated) may read ONLY promotions that are live right
-- now — enough to render the storefront badge and the /promotions collection.
-- Every write is administrator-only; the admin panel uses service_role, which
-- bypasses RLS. The is_admin() policies below are defense-in-depth for any
-- direct PostgREST call.

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


-- ── 6. Deprecation notes on the legacy per-product deal columns ──────────────
--
-- These columns are still read by the storefront and by the calculation engine
-- as a single-product fallback. They are NOT dropped here so existing active
-- deals keep working untouched. Prefer creating a promotion with a single
-- product for all new deals.

COMMENT ON COLUMN public.products.qty_deal_enabled IS
  'DEPRECATED (2026-08-08): legacy single-product quantity deal. Superseded by promotions/promotion_items. Still honoured as a fallback when the variant is not part of any active group promotion.';
COMMENT ON COLUMN public.products.qty_deal_quantity IS
  'DEPRECATED (2026-08-08): see products.qty_deal_enabled.';
COMMENT ON COLUMN public.products.qty_deal_price_agorot IS
  'DEPRECATED (2026-08-08): see products.qty_deal_enabled.';
