-- ============================================================
-- Lock down direct order writes by end-user (anon/authenticated) roles
--
-- Why: orders and order_items are created ONLY server-side, with the
-- service-role client / SECURITY DEFINER RPCs (see checkout/actions.ts).
-- The original 001/005 policies "orders_own_insert" and
-- "order_items_own_insert" still let any *authenticated* Supabase Auth user
-- INSERT a row straight through the public REST API using the (public) anon
-- key — including an arbitrary total_agorot and payment_status = 'paid'.
-- Customer login was removed from the site, so nothing legitimate uses them;
-- but if "Allow new users to sign up" is enabled in Supabase Auth, anyone can
-- obtain such a session. Such rows would show up in the admin and be counted
-- in the paid-orders sales report.
--
-- Effect: no change to checkout, payments, admin or the storefront (all use
-- the service role, which bypasses RLS and these grants). Idempotent.
-- Reading policies (orders_own_select, admin_*) are NOT touched.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS "orders_own_insert"      ON public.orders;
DROP POLICY IF EXISTS "order_items_own_insert" ON public.order_items;

REVOKE INSERT ON public.orders      FROM anon, authenticated;
REVOKE INSERT ON public.order_items FROM anon, authenticated;

COMMIT;
