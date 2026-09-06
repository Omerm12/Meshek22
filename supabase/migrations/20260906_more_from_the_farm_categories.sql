-- ============================================================
-- משק 22 – "עוד מהמשק" (more-from-the-farm) category restructuring
-- Migration: 20260906_more_from_the_farm_categories.sql
--
-- Replaces the customer-facing combined category "גלידות ופיצוחים"
-- (slug: ice-creams-and-nuts) with a broader parent category, "עוד מהמשק"
-- (slug: more-from-the-farm), and gives it seven child categories.
--
-- Design decisions:
--
--   1. The existing ice-creams-and-nuts row (created by
--      20260808_001_ice_cream_nuts_categories.sql) is RENAMED and REUSED as
--      the new parent, rather than creating a second top-level row. Its id
--      does not change, so every product currently filed directly under it
--      keeps the exact same category_id — nothing is moved, nothing is
--      disconnected. fetchProductsByParentCategorySlug() already includes
--      products assigned directly to the parent itself (see
--      src/lib/data/storefront.ts), so those existing products simply keep
--      showing up on the renamed page's default ("all") view.
--
--   2. 20260808_001 deleted the standalone `ice-creams` and `nuts` categories
--      after moving their products onto the combined row, so there is no
--      surviving separate row for either — the two products lines were
--      merged and can no longer be told apart at the database level. This
--      migration therefore CANNOT "reuse" a separate ice-creams/nuts child
--      without guessing which merged product belongs to which — guessing
--      would silently move products, which is exactly what must not happen.
--      Both are created here as fresh, empty child categories (slugs
--      `ice-creams` and `nuts`) under the new parent, per the explicit
--      instruction that empty subcategories are expected and safe: products
--      can be re-filed into them by hand later, at the shop owner's own pace.
--
--   3. A pre-existing "eggs / dairy" category IS handled as a genuine reuse:
--      some environments carry a legacy row named 'ביצים ומוצרי חלב'
--      (historically slugged 'beitsim' in the original flat seed data). If
--      such a row exists, it is renamed to 'ביצים' / slug 'eggs' and
--      reparented here — its description, image and product assignments are
--      left untouched. If no such row exists, a fresh empty 'eggs' row is
--      created, exactly like the other new children.
--
--   4. Every other required child (spices, olive oil, crunchy vegetables,
--      knives & peelers) has no prior category anywhere in this codebase, so
--      each is created fresh.
--
-- Safe to run on a database in any of these states:
--   • ice-creams-and-nuts exists, none of the 7 children exist   → renames
--     the parent, creates all 7 children
--   • this migration already ran once                           → no-op
--   • ice-creams-and-nuts is somehow missing entirely            → creates
--     the parent fresh instead of renaming
--   • a legacy 'beitsim' / 'ביצים ומוצרי חלב' row exists          → reused
--     and renamed to 'ביצים' / 'eggs' instead of creating a duplicate
--
-- No product is ever deleted, moved, or set to a null category_id. No
-- category with products is ever deleted. Re-running the whole file is a
-- no-op.
-- ============================================================


-- ── 0. Columns/constraints this migration depends on ─────────────────────────
-- Idempotent — 20260808_001 already added these in every environment this
-- migration expects to run against, but guarding again costs nothing and
-- keeps this file safe to run standalone.

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


-- ── 1. Reuse or create the parent category ───────────────────────────────────
--
-- Prefer renaming the existing ice-creams-and-nuts row (see design note #1
-- above). Only if no row at all matches either slug does this create a new
-- one — which also makes the whole block safe to re-run.

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


-- ── 2. Children: create fresh, or reparent/rename a genuine match ───────────
--
-- One DO block per child keeps each step independently idempotent and easy to
-- audit. sort_order is set explicitly every run so re-running always restores
-- the requested order, even if an admin has since edited it by hand.

-- 2.1 תבלינים / spices — no prior category anywhere; fresh and empty.
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

-- 2.2 ביצים / eggs — genuine reuse of a legacy eggs/dairy row when one exists.
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
    -- Reuse: rename and reparent only. Description, image_url and every
    -- product's category_id are left exactly as they were.
    UPDATE public.categories
    SET    name      = 'ביצים',
           slug      = 'eggs',
           parent_id = v_parent_id,
           sort_order = 20,
           is_active  = TRUE
    WHERE  id = v_eggs_id;
  END IF;
END $$;

-- 2.3 פיצוחים / nuts — the pre-hierarchy 'nuts' row was merged and deleted by
-- 20260808_001; there is nothing left to reuse, so this is fresh and empty.
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

-- 2.4 שמן זית / olive-oil — no prior category; fresh and empty.
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

-- 2.5 ירקות קרנצ'ים / crunchy-vegetables — no prior category; fresh and empty.
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

-- 2.6 סכינים ומקלפים / knives-and-peelers — no prior category; fresh and empty.
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

-- 2.7 גלידות / ice-creams — the pre-hierarchy 'ice-creams' row was merged and
-- deleted by 20260808_001; there is nothing left to reuse, so this is fresh
-- and empty (see design note #2 above).
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


-- ── 3. Verification ───────────────────────────────────────────────────────────
-- Fails loudly rather than leaving the database half-migrated.

DO $$
DECLARE
  v_parent_id      UUID;
  v_parent_count   INTEGER;
  v_children_count INTEGER;
BEGIN
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
END $$;
