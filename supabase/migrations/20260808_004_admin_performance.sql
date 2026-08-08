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

-- NOTE ON fulfillment_method
-- No index. It has two values over a table of a few hundred rows, so the planner
-- will always prefer a sequential scan; the only filter that touches it is
-- inside admin_dashboard_counts, which already scans the small operational set.
-- An index here would be write amplification for no measurable read gain.

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
-- The fallback issues nine head-only COUNT queries in parallel; each still costs
-- a full PostgREST round-trip (TLS + auth + planning). One RPC returns the whole
-- payload in a single trip.
--
-- The keys below are the DASHBOARD CARDS, not raw statuses, and must stay
-- semantically identical to the fallback in src/lib/admin/dashboard-counts.ts.
-- The two are interchangeable: the shop owner must never see a number change
-- merely because a migration landed. The application probes for
-- `orders_awaiting_payment_call` and ignores an older function that lacks it,
-- so a stale deployment falls back rather than mis-counting.
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
  WITH operational AS (
    -- Incomplete online-card attempts are internal records, not orders anyone
    -- packs, so they are excluded from every card. The `IS NULL` arm matters:
    -- in SQL, NULL <> 'credit_card' evaluates to NULL rather than TRUE, so
    -- without it every historical order would silently vanish from the counts.
    SELECT *
    FROM orders
    WHERE payment_method IS NULL
       OR payment_method <> 'credit_card'
       OR payment_status = 'paid'
  )
  SELECT jsonb_build_object(
    -- Phone-credit only: never a CardCom attempt, never cash, never already paid.
    'orders_awaiting_payment_call', (SELECT count(*) FROM operational
                                      WHERE order_status   = 'pending_payment'
                                        AND payment_method = 'phone_credit'
                                        AND payment_status = 'pending'),
    'orders_new',                   (SELECT count(*) FROM operational WHERE order_status = 'confirmed'),
    'orders_preparing',             (SELECT count(*) FROM operational WHERE order_status = 'preparing'),
    -- One enum value, two jobs: on the road vs waiting on the shelf. A row with
    -- no fulfillment_method predates pickup and is therefore a delivery.
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
