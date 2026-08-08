-- ============================================================
-- משק 22 – Admin panel performance
-- Migration: 20260808_004_admin_performance.sql
--
-- 1. Indexes matching the filters the admin list pages actually issue.
-- 2. admin_dashboard_counts() – replaces 8 separate COUNT round-trips with one.
--
-- Every statement is idempotent (IF NOT EXISTS / CREATE OR REPLACE) and
-- non-destructive: no data is read, written or removed.
-- ============================================================


-- ── 1. Indexes ───────────────────────────────────────────────────────────────

-- /meshek22-control/orders default listing: ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS orders_created_at_desc_idx
  ON public.orders (created_at DESC);

-- ?status=<order_status> filter combined with the default sort
CREATE INDEX IF NOT EXISTS orders_status_created_at_idx
  ON public.orders (order_status, created_at DESC);

-- ?payment=<payment_status> filter and the dashboard payment tiles
CREATE INDEX IF NOT EXISTS orders_payment_status_idx
  ON public.orders (payment_status);

-- Fulfillment / payment-method badges and filters added in 003
CREATE INDEX IF NOT EXISTS orders_fulfillment_method_idx
  ON public.orders (fulfillment_method);

-- Exact order-number lookup (admin search + guest success page)
CREATE INDEX IF NOT EXISTS orders_order_number_idx
  ON public.orders (order_number);

-- order detail page: SELECT … WHERE order_id = $1
CREATE INDEX IF NOT EXISTS order_items_order_id_idx
  ON public.order_items (order_id);

-- Product list filtered by category, sorted by sort_order
CREATE INDEX IF NOT EXISTS products_category_sort_idx
  ON public.products (category_id, sort_order);

CREATE INDEX IF NOT EXISTS products_active_sort_idx
  ON public.products (is_active, sort_order);

-- Storefront + admin variant fan-out
CREATE INDEX IF NOT EXISTS product_variants_product_id_idx
  ON public.product_variants (product_id);

-- Settlement admin page: name search + zone filter
CREATE INDEX IF NOT EXISTS settlements_name_idx
  ON public.settlements (name);

CREATE INDEX IF NOT EXISTS settlements_zone_idx
  ON public.settlements (delivery_zone_id);

-- Category tree resolution (parent → children) on every category landing page
CREATE INDEX IF NOT EXISTS categories_parent_sort_idx
  ON public.categories (parent_id, sort_order);

-- NOTE ON TRIGRAM SEARCH
-- A pg_trgm GIN index on products.name / orders.order_number was considered and
-- deliberately NOT added. Current admin search uses `ilike '%q%'` over a catalog
-- of a few hundred products, where a sequential scan is already sub-millisecond;
-- a trigram index would add write amplification and an extension dependency for
-- no measurable gain. Revisit if the product table passes ~50k rows.


-- ── 2. Single-round-trip dashboard counts ────────────────────────────────────
--
-- The dashboard previously issued 8 head-only COUNT queries in parallel; each
-- still costs a full PostgREST round-trip (TLS + auth + planning). One RPC
-- returns the whole payload in a single trip.
--
-- SECURITY DEFINER + service_role-only EXECUTE: the admin panel calls this with
-- the service-role client after requireAdmin() has already authorised the request.

CREATE OR REPLACE FUNCTION public.admin_dashboard_counts()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'orders_pending_payment',  (SELECT count(*) FROM orders WHERE order_status = 'pending_payment'),
    'orders_confirmed',        (SELECT count(*) FROM orders WHERE order_status = 'confirmed'),
    'orders_preparing',        (SELECT count(*) FROM orders WHERE order_status = 'preparing'),
    'orders_out_for_delivery', (SELECT count(*) FROM orders WHERE order_status = 'out_for_delivery'),
    'products_active',         (SELECT count(*) FROM products   WHERE is_active),
    'categories_active',       (SELECT count(*) FROM categories WHERE is_active),
    'settlements',             (SELECT count(*) FROM settlements),
    'delivery_zones',          (SELECT count(*) FROM delivery_zones),
    'promotions_active',       (SELECT count(*) FROM promotions
                                 WHERE is_active
                                   AND (starts_at IS NULL OR starts_at <= now())
                                   AND (ends_at   IS NULL OR ends_at   >  now()))
  );
$$;

REVOKE ALL     ON FUNCTION public.admin_dashboard_counts FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.admin_dashboard_counts FROM anon;
REVOKE ALL     ON FUNCTION public.admin_dashboard_counts FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_dashboard_counts TO service_role;
