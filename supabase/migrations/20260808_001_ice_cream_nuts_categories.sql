-- ============================================================
-- משק 22 – Seed the combined "גלידות ופיצוחים" storefront category
-- Migration: 20260808_001_ice_cream_nuts_categories.sql
--
-- Structure created:
--   גלידות ופיצוחים  (slug: ice-creams-and-nuts)   ← top level, customer-facing
--     ├── גלידות     (slug: ice-creams)            ← child, admin assignment only
--     └── פיצוחים    (slug: nuts)                  ← child, admin assignment only
--
-- The two children exist purely so the shop owner can file a product as an ice
-- cream or as a nut in the admin panel. They have NO customer-facing page of
-- their own: /ice-creams and /nuts permanently redirect to the combined page,
-- where the children appear only as on-page filter tabs.
--
-- The storefront query for a top-level category reads products assigned to the
-- parent itself AND to every active child, so a product filed in any of the
-- three places shows up on the combined page exactly once.
--
-- Idempotent and self-healing:
--   • Nothing is inserted when a slug already exists.
--   • An earlier revision of this migration created ice-creams and nuts as two
--     separate TOP-LEVEL categories. If that version was already applied to a
--     database, step 3 re-parents those rows under the combined category rather
--     than leaving orphaned top-level entries behind. Products keep their
--     category_id, so no product assignment is lost.
--   • Re-running the whole file is a no-op.
--
-- No products are created, deleted or reassigned.
-- ============================================================


-- ── 1. Combined parent category ──────────────────────────────────────────────

INSERT INTO public.categories (name, slug, description, sort_order, is_active, is_featured, parent_id)
SELECT 'גלידות ופיצוחים', 'ice-creams-and-nuts',
       'גלידות, ארטיקים, אגוזים ופיצוחים – משהו מתוק ומשהו מלוח',
       30, TRUE, FALSE, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories WHERE slug = 'ice-creams-and-nuts'
);


-- ── 2. Child categories (admin assignment only) ──────────────────────────────

INSERT INTO public.categories (name, slug, description, sort_order, is_active, is_featured, parent_id)
SELECT 'גלידות', 'ice-creams',
       'גלידות, ארטיקים וקינוחים קפואים',
       10, TRUE, FALSE, parent.id
FROM public.categories AS parent
WHERE parent.slug = 'ice-creams-and-nuts'
  AND NOT EXISTS (
    SELECT 1 FROM public.categories WHERE slug = 'ice-creams'
  );

INSERT INTO public.categories (name, slug, description, sort_order, is_active, is_featured, parent_id)
SELECT 'פיצוחים', 'nuts',
       'אגוזים, שקדים, גרעינים ופיצוחים',
       20, TRUE, FALSE, parent.id
FROM public.categories AS parent
WHERE parent.slug = 'ice-creams-and-nuts'
  AND NOT EXISTS (
    SELECT 1 FROM public.categories WHERE slug = 'nuts'
  );


-- ── 3. Re-parent rows left over from the earlier two-category revision ───────
--
-- Only touches rows whose parent_id is not already the combined category, so
-- this is a no-op on a database seeded by steps 1–2 above.

UPDATE public.categories AS child
SET    parent_id   = parent.id,
       is_featured = FALSE,
       sort_order  = CASE child.slug WHEN 'ice-creams' THEN 10 ELSE 20 END
FROM   public.categories AS parent
WHERE  parent.slug = 'ice-creams-and-nuts'
  AND  child.slug IN ('ice-creams', 'nuts')
  AND  child.parent_id IS DISTINCT FROM parent.id;
