-- ============================================================
-- Add show_in_navbar: per-category control over top-nav visibility,
-- independent of is_active.
--
--   is_active = false             -> category unavailable anywhere on the
--                                    storefront (existing behaviour, unchanged)
--   is_active = true,  show_in_navbar = false -> still reachable via its
--                                    parent page / direct URL, just absent
--                                    from the top navbar
--   is_active = true,  show_in_navbar = true  -> may appear in the navbar,
--                                    per the existing hierarchy/sort_order
--
-- An inactive category must never appear in the navbar even if
-- show_in_navbar = true — every storefront read already filters
-- is_active = true first (see getCachedNavbarCategoryTree /
-- getCachedParentCategoryTree in src/lib/data/storefront.ts), so this is
-- enforced in application code rather than a CHECK constraint here.
--
-- Idempotent: safe to run more than once, and safe to run whether or not
-- 20260906_more_from_the_farm_categories.sql / the reconcile migration have
-- already run in this environment (the backfill below is a plain
-- slug-membership UPDATE, so rows that don't exist yet are simply skipped —
-- no error).
-- ============================================================

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS show_in_navbar BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Backfill ──────────────────────────────────────────────────────────────
-- Derived directly from the navbar structure this replaces
-- (PARENT_CATEGORY_NAV in src/lib/config/nav-categories.ts, as of the commit
-- that introduced this migration) so the production navbar does not go empty
-- on deploy: every parent and child slug that is in the static nav today is
-- flagged show_in_navbar = true here. Only rows that are also is_active keep
-- the flag meaningfully on (an inactive row can be flagged and it will still
-- correctly stay out of the navbar — see the application-level filter noted
-- above), but the WHERE clause restricts it to active rows regardless so this
-- migration never "activates" a category's navbar flag ahead of a decision
-- an admin hasn't made.
UPDATE public.categories
SET    show_in_navbar = TRUE
WHERE  is_active = TRUE
AND    slug IN (
  -- Parents
  'vegetables',
  'fruits',
  'more-from-the-farm',

  -- ירקות children
  'regular-vegetables',
  'root-vegetables',
  'leafy-vegetables',
  'herbs',
  'special-vegetables',
  'cut-washed-vegetables',
  'vegetable-trays',

  -- פירות children
  'citrus-fruits',
  'regular-fruits',
  'special-fruits',
  'dried-fruits',
  'organic-fruits',

  -- עוד מהמשק children
  'spices',
  'eggs',
  'nuts',
  'olive-oil',
  'crunchy-vegetables',
  'knives-and-peelers',
  'ice-creams'
);
