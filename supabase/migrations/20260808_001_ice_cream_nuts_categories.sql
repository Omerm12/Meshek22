-- ============================================================
-- משק 22 – Seed two new top-level storefront categories
-- Migration: 20260808_001_ice_cream_nuts_categories.sql
--
-- Adds:
--   גלידות  (slug: ice-creams)
--   פיצוחים (slug: nuts)
--
-- Idempotent: inserts ONLY when the slug does not already exist.
-- No products are created or reassigned — the administrator assigns
-- products to these categories manually from the admin panel.
-- Re-running this migration is a no-op.
-- ============================================================

INSERT INTO public.categories (name, slug, description, sort_order, is_active, is_featured, parent_id)
SELECT 'גלידות', 'ice-creams',
       'גלידות, ארטיקים וקינוחים קפואים',
       30, TRUE, FALSE, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories WHERE slug = 'ice-creams'
);

INSERT INTO public.categories (name, slug, description, sort_order, is_active, is_featured, parent_id)
SELECT 'פיצוחים', 'nuts',
       'אגוזים, שקדים, גרעינים ופיצוחים',
       40, TRUE, FALSE, NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories WHERE slug = 'nuts'
);
