-- ============================================================
-- משק 22 – Order Domain Hardening
-- Migration: 005_order_domain_hardening.sql
--
-- Changes:
--   1. Remove 'paid' from order_status enum.
--      'paid' was a redundant order lifecycle state — payment
--      confirmation is already tracked by payment_status = 'paid'.
--      Existing rows with order_status = 'paid' are migrated to
--      'confirmed' (payment was already marked paid at that point).
--
--   2. Add check constraint: order_status = 'confirmed' requires
--      payment_status = 'paid'. Enforces the business rule at the
--      DB level regardless of the calling code path.
--
--   3. Add missing RLS INSERT policy on order_items so authenticated
--      users can insert items into their own orders via the user key.
--      (Admin panel uses service role and bypasses RLS; this policy
--       is needed for the checkout server action which uses the user key.)
-- ============================================================

-- ── 1. Migrate 'paid' order_status rows → 'confirmed' ────────────────────────

UPDATE orders
SET order_status = 'confirmed'
WHERE order_status = 'paid';

-- ── 2. Rebuild order_status enum without 'paid' ───────────────────────────────
-- PostgreSQL does not support DROP VALUE on an enum; the standard approach
-- is to create a new type, migrate the column, then rename.

CREATE TYPE order_status_new AS ENUM (
  'pending_payment',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
  'cancelled'
);

ALTER TABLE orders
  ALTER COLUMN order_status TYPE order_status_new
  USING order_status::text::order_status_new;

DROP TYPE order_status;
ALTER TYPE order_status_new RENAME TO order_status;

-- ── 3. Business rule constraint ───────────────────────────────────────────────
-- An order cannot be 'confirmed' unless it has been paid for.

ALTER TABLE orders
  ADD CONSTRAINT chk_confirmed_requires_paid
  CHECK (
    order_status != 'confirmed' OR payment_status = 'paid'
  );

-- ── 4. RLS: allow authenticated users to insert their own order_items ─────────
-- Without this policy, the checkout server action (which uses the user JWT key)
-- cannot insert order_items. Service role bypasses this automatically.

DROP POLICY IF EXISTS "order_items_own_insert" ON public.order_items;
CREATE POLICY "order_items_own_insert" ON public.order_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
  );
