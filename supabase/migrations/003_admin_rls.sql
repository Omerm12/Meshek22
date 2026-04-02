-- ============================================================
-- משק 22 – Admin RLS Policies
-- Migration: 003_admin_rls.sql
-- ============================================================
-- Adds a reusable is_admin() helper and admin-level RLS policies.
--
-- Design notes:
-- • The admin panel uses createAdminClient() (service role key) for all data
--   access, which bypasses RLS entirely. These policies are defense-in-depth —
--   they ensure admin access works even if accessed through the anon key
--   (e.g., during local development or future API endpoints using the user key).
-- • is_admin() is SECURITY DEFINER so it runs as the postgres superuser,
--   bypassing the RLS that would otherwise prevent reading other users' profiles.
-- • All policies use DROP POLICY IF EXISTS before CREATE so this migration is
--   idempotent (safe to re-run).
-- ============================================================

-- ── Helper function ───────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id   = auth.uid()
      AND role = 'admin'
  );
$$;

-- ── Profiles: admin can read/update any profile ───────────────────────────────

DROP POLICY IF EXISTS "admin_profiles_select" ON public.profiles;
CREATE POLICY "admin_profiles_select" ON public.profiles
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "admin_profiles_update" ON public.profiles;
CREATE POLICY "admin_profiles_update" ON public.profiles
  FOR UPDATE USING (is_admin());

-- ── Orders: admin can read and update any order ───────────────────────────────

DROP POLICY IF EXISTS "admin_orders_select" ON public.orders;
CREATE POLICY "admin_orders_select" ON public.orders
  FOR SELECT USING (is_admin());

DROP POLICY IF EXISTS "admin_orders_update" ON public.orders;
CREATE POLICY "admin_orders_update" ON public.orders
  FOR UPDATE USING (is_admin());

-- ── Order items: admin can read all ──────────────────────────────────────────

DROP POLICY IF EXISTS "admin_order_items_select" ON public.order_items;
CREATE POLICY "admin_order_items_select" ON public.order_items
  FOR SELECT USING (is_admin());

-- ── Catalog: admin can do full CRUD ──────────────────────────────────────────

-- Categories (existing policy only allows public SELECT for is_active rows)
DROP POLICY IF EXISTS "admin_categories_all" ON public.categories;
CREATE POLICY "admin_categories_all" ON public.categories
  FOR ALL USING (is_admin());

-- Products
DROP POLICY IF EXISTS "admin_products_all" ON public.products;
CREATE POLICY "admin_products_all" ON public.products
  FOR ALL USING (is_admin());

-- Product variants
DROP POLICY IF EXISTS "admin_variants_all" ON public.product_variants;
CREATE POLICY "admin_variants_all" ON public.product_variants
  FOR ALL USING (is_admin());

-- Delivery zones
DROP POLICY IF EXISTS "admin_zones_all" ON public.delivery_zones;
CREATE POLICY "admin_zones_all" ON public.delivery_zones
  FOR ALL USING (is_admin());

-- Settlements
DROP POLICY IF EXISTS "admin_settlements_all" ON public.settlements;
CREATE POLICY "admin_settlements_all" ON public.settlements
  FOR ALL USING (is_admin());
