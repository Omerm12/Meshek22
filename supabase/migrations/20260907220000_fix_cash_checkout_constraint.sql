-- ============================================================
-- משק 22 – Fix cash-on-delivery checkout constraint conflict
-- Migration: 20260907220000_fix_cash_checkout_constraint.sql
--
-- Root cause
-- ----------
-- 005_order_domain_hardening.sql added:
--
--   ALTER TABLE orders ADD CONSTRAINT chk_confirmed_requires_paid
--     CHECK (order_status != 'confirmed' OR payment_status = 'paid');
--
-- The cash-on-delivery checkout path (src/app/(shop)/checkout/actions.ts)
-- creates every cash order with order_status = 'confirmed' and
-- payment_status = 'pending' by design: the shop needs to see and start
-- packing the order immediately, while the money is only collected on
-- handover. That is exactly the combination this constraint forbids, so
-- create_guest_order_atomic()'s INSERT raises a check_violation for every
-- cash order, which the Server Action reports as a generic "try again"
-- failure. This was flagged (but deliberately left unfixed, as a business-rule
-- decision) by MIGRATION_AUDIT.md and supabase/MIGRATION_INVENTORY.md.
--
-- Fix
-- ---
-- Replace the constraint with a version that special-cases cash: a confirmed
-- order must be paid UNLESS it is a cash-on-delivery order, which is allowed
-- to be confirmed (packed, shipped) while payment is still pending. Every
-- other payment method (credit_card, phone_credit, NULL/legacy) keeps the
-- original rule unchanged — an online-card order can still never be
-- 'confirmed' without payment_status = 'paid'.
--
-- Safety
-- ------
-- Transactional (BEGIN/COMMIT). No data is deleted, updated or migrated —
-- this only redefines a CHECK constraint. Added NOT VALID (consistent with
-- every other CHECK constraint added to `orders` after its initial creation
-- in this codebase, e.g. orders_payment_method_chk), so pre-existing rows are
-- never re-validated and this migration cannot fail or roll back because of
-- historical data; only rows written or updated from now on are checked.
-- Re-running this file is a no-op the second time (DROP … IF EXISTS, then
-- CREATE), so it is safe to apply more than once.
-- ============================================================

BEGIN;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS chk_confirmed_requires_paid;

ALTER TABLE public.orders
  ADD CONSTRAINT chk_confirmed_requires_paid
  CHECK (
    order_status != 'confirmed'
    OR payment_status = 'paid'
    OR payment_method = 'cash'
  ) NOT VALID;

COMMENT ON CONSTRAINT chk_confirmed_requires_paid ON public.orders IS
  'A confirmed order must be paid, except cash-on-delivery orders: those are legitimately confirmed and packed before the cash is actually collected on handover.';

COMMIT;
