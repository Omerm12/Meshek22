-- ============================================================
-- משק 22 – One combined "גלידות ופיצוחים" category
-- Migration: 20260808_001_ice_cream_nuts_categories.sql
--
-- Final state after this migration:
--
--   גלידות ופיצוחים  (slug: ice-creams-and-nuts, parent_id NULL, is_active TRUE)
--
-- and NOTHING else for ice creams or nuts. There are no `ice-creams` or `nuts`
-- categories, no child categories, no filter tabs and no duplicate product
-- assignment. A product is filed once, directly under the combined category.
--
-- Safe to run on a database in any of these states:
--   • none of the three categories exists      → creates the combined one
--   • only the combined category exists        → no-op
--   • only the legacy categories exist         → creates combined, moves, deletes
--   • all three exist                          → moves, deletes
--   • products assigned to the legacy rows     → every product is reassigned
--
-- Re-running the whole file is a no-op. No product is deleted, lost or
-- duplicated: reassignment is an UPDATE of category_id, and the legacy rows are
-- only removed once nothing references them.
--
-- The fruit/vegetable hierarchy is untouched — the parent/child machinery stays,
-- it is simply not used by this category.
-- ============================================================


-- ── 0. Columns and constraints this migration depends on ─────────────────────
-- Added idempotently so the file is safe on an older schema.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS parent_id UUID;

-- Self-reference FK. ON DELETE SET NULL means removing a parent promotes its
-- children to top level rather than deleting them.
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

-- A category can never be its own parent.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'categories_no_self_parent_chk'
  ) THEN
    ALTER TABLE public.categories
      ADD CONSTRAINT categories_no_self_parent_chk
      CHECK (parent_id IS NULL OR parent_id <> id);
  END IF;
END $$;

-- Parent → children lookup, used by every parent-category storefront page and
-- by the admin category tree. Defined here, next to the column it indexes,
-- rather than in a later migration: the column does not exist before this file.
CREATE INDEX IF NOT EXISTS categories_parent_sort_idx
  ON public.categories (parent_id, sort_order);


-- ── 1. Ensure the combined category exists ───────────────────────────────────

INSERT INTO public.categories (name, slug, description, sort_order, is_active, is_featured, parent_id)
SELECT 'גלידות ופיצוחים', 'ice-creams-and-nuts',
       'גלידות, ארטיקים, אגוזים ופיצוחים – משהו מתוק ומשהו מלוח',
       30, TRUE, FALSE, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories WHERE slug = 'ice-creams-and-nuts'
);

-- If it already existed but had been nested or deactivated by an earlier
-- revision, put it back at top level and make sure it is selectable.
UPDATE public.categories
SET    parent_id = NULL,
       is_active = TRUE,
       name      = 'גלידות ופיצוחים'
WHERE  slug = 'ice-creams-and-nuts'
  AND (parent_id IS NOT NULL OR is_active = FALSE OR name <> 'גלידות ופיצוחים');


-- ── 2..5. Reassign products, then retire the legacy rows ─────────────────────
--
-- Wrapped in one block so the move and the delete cannot be separated: the
-- legacy rows are only ever dropped after every product has been moved off them.

DO $$
DECLARE
  v_combined_id  UUID;
  v_legacy_ids   UUID[];
  v_moved        INTEGER := 0;
  v_orphaned     INTEGER := 0;
BEGIN
  SELECT id INTO v_combined_id
  FROM public.categories
  WHERE slug = 'ice-creams-and-nuts';

  IF v_combined_id IS NULL THEN
    RAISE EXCEPTION 'combined category ice-creams-and-nuts is missing after step 1';
  END IF;

  SELECT array_agg(id) INTO v_legacy_ids
  FROM public.categories
  WHERE slug IN ('ice-creams', 'nuts')
    AND id <> v_combined_id;

  IF v_legacy_ids IS NULL OR array_length(v_legacy_ids, 1) IS NULL THEN
    RAISE NOTICE 'no legacy ice-creams/nuts categories present — nothing to migrate';
    RETURN;
  END IF;

  -- 2/3. Move every product onto the combined category. A product carries a
  -- single category_id, so this can neither lose nor duplicate a product.
  UPDATE public.products
  SET    category_id = v_combined_id,
         updated_at  = now()
  WHERE  category_id = ANY(v_legacy_ids);

  GET DIAGNOSTICS v_moved = ROW_COUNT;

  -- Any category that was nested under a legacy row is re-parented to the
  -- combined category so the delete below cannot orphan or remove it.
  UPDATE public.categories
  SET    parent_id = v_combined_id
  WHERE  parent_id = ANY(v_legacy_ids)
    AND  id <> v_combined_id;

  GET DIAGNOSTICS v_orphaned = ROW_COUNT;

  -- 5. Retire the legacy rows. The guard is belt-and-braces: the UPDATE above
  -- already moved everything, so this must find nothing left behind.
  IF EXISTS (SELECT 1 FROM public.products WHERE category_id = ANY(v_legacy_ids)) THEN
    RAISE EXCEPTION 'refusing to delete legacy categories: products still reference them';
  END IF;

  DELETE FROM public.categories WHERE id = ANY(v_legacy_ids);

  RAISE NOTICE 'ice-creams/nuts merge: % products moved, % subcategories re-parented, % legacy rows removed',
    v_moved, v_orphaned, array_length(v_legacy_ids, 1);
END $$;


-- ── 6. Verification ──────────────────────────────────────────────────────────
-- Fails loudly rather than leaving the database half-migrated.

DO $$
DECLARE
  v_combined_count INTEGER;
  v_legacy_count   INTEGER;
BEGIN
  SELECT count(*) INTO v_combined_count
  FROM public.categories
  WHERE slug = 'ice-creams-and-nuts' AND is_active AND parent_id IS NULL;

  SELECT count(*) INTO v_legacy_count
  FROM public.categories
  WHERE slug IN ('ice-creams', 'nuts');

  IF v_combined_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one active top-level ice-creams-and-nuts category, found %', v_combined_count;
  END IF;

  IF v_legacy_count <> 0 THEN
    RAISE EXCEPTION 'legacy ice-creams/nuts categories still present (%)', v_legacy_count;
  END IF;
END $$;
