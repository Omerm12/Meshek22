-- ============================================================
-- READ-ONLY diagnostic: why a "פטריות" (mushroom) category (or any other
-- newly-created child category) is not appearing on its expected parent page.
--
-- Nothing here writes, updates, or deletes data. Safe to run in the Supabase
-- SQL editor against production at any time.
--
-- Does not hardcode a category id — matches generically by name/slug so it
-- keeps working for any future category, not just this one.
-- ============================================================

-- 1. The category itself, plus its resolved parent (if any) and how many
--    active products are currently filed under it.
--
--    Interpretation:
--      is_active = false          -> category is hidden storefront-wide;
--                                     this alone fully explains its absence.
--      parent_id IS NULL          -> it is NOT a child of anything — it is
--                                     its own top-level category, so it will
--                                     never appear under ירקות's page.
--      parent_slug <> 'vegetables'-> it is parented to a DIFFERENT row than
--                                     the one /vegetables actually renders
--                                     (see query 2 below for why that is a
--                                     realistic possibility in this database).
--      active_product_count = 0   -> the category itself is fine; it will
--                                     render with an empty product grid until
--                                     a product is assigned to it.
select
  c.id                                as category_id,
  c.name                              as category_name,
  c.slug                              as category_slug,
  c.is_active,
  c.show_in_navbar,                   -- present once 20260919120000_category_navbar_visibility.sql has run
  c.parent_id,
  p.name                              as parent_name,
  p.slug                              as parent_slug,
  p.is_active                         as parent_is_active,
  (
    select count(*)
    from public.products pr
    where pr.category_id = c.id
      and pr.is_active = true
  )                                   as active_product_count
from public.categories c
left join public.categories p on p.id = c.parent_id
where c.name ilike '%פטריות%'
   or c.slug ilike '%mushroom%'
order by c.created_at;

-- 2. Every top-level (parent_id IS NULL) category named "ירקות", by slug.
--
--    If this returns MORE THAN ONE ROW, that is very likely the root cause:
--    a legacy row (historically seeded with slug 'yerakot') and the row the
--    storefront actually resolves by slug ('vegetables') can both be named
--    "ירקות" and are visually indistinguishable in the admin's parent-category
--    dropdown, which previously showed only the name. A new child accidentally
--    parented to the wrong one of these rows will never appear on /vegetables,
--    because /vegetables resolves its parent strictly by slug = 'vegetables',
--    not by name.
select
  id,
  name,
  slug,
  is_active,
  show_in_navbar,   -- present once 20260919120000_category_navbar_visibility.sql has run
  sort_order,
  (select count(*) from public.categories ch where ch.parent_id = categories.id) as child_count
from public.categories
where parent_id is null
  and name = 'ירקות'
order by created_at;

-- 3. Direct children of the row that /vegetables actually renders
--    (parent resolved by slug, matching src/lib/data/storefront.ts exactly).
--    If the mushroom category is missing from this list, its parent_id does
--    not point at this row — that is the fix, made through the admin edit
--    form (see report for exact steps).
select
  child.id,
  child.name,
  child.slug,
  child.is_active,
  child.show_in_navbar   -- present once 20260919120000_category_navbar_visibility.sql has run
from public.categories parent
join public.categories child on child.parent_id = parent.id
where parent.slug = 'vegetables'
order by child.sort_order;
