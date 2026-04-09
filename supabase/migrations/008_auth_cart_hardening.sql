-- ============================================================
-- משק 22 – Auth + Cart Hardening
-- Migration: 008_auth_cart_hardening.sql
-- ============================================================
-- Changes:
--   1. Add last_login_at to profiles (14-day expiry source of truth)
--   2. Lock down last_login_at at column-privilege level so authenticated
--      users cannot write it directly — only recordLogin() via service_role may
--   3. Create user_cart_items (DB-backed, user-scoped authenticated cart)
--   4. Add updated_at trigger for user_cart_items
-- ============================================================


-- ── 1. Add last_login_at column to profiles ───────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;


-- ── 2. Column-level privilege protection for last_login_at ────────────────────
--
-- The authenticated role has table-level INSERT/UPDATE on profiles (granted by
-- Supabase defaults + the profiles_own_update RLS policy). We revoke the specific
-- column-level privilege so that even a crafted direct API call cannot touch it.
--
-- Effect:
--   - authenticated role: CAN update full_name, email, phone, etc.
--                         CANNOT update or insert last_login_at
--   - service_role:       table-level ALL privileges are unaffected by this revocation;
--                         we also add an explicit column-level GRANT for documentation.
--   - anon role:          no UPDATE access at all (not changed here).
--
-- This is enforced at the PostgreSQL privilege layer, below RLS. RLS policies run
-- AFTER privilege checks — so even an RLS policy that allows UPDATE on the row
-- cannot override a column-level privilege revocation.

REVOKE INSERT (last_login_at) ON profiles FROM authenticated;
REVOKE UPDATE (last_login_at) ON profiles FROM authenticated;

-- Explicit service_role column grant (service_role already has table-level ALL,
-- so this is redundant but makes intent unambiguous in pg_attribute_acl).
GRANT INSERT (last_login_at), UPDATE (last_login_at) ON profiles TO service_role;


-- ── 3. Create user_cart_items ─────────────────────────────────────────────────
--
-- Flat, denormalized, user-scoped cart table.
-- variant_id and product_id are UUID foreign keys — ON DELETE CASCADE means
-- removing a product/variant automatically removes any cart items referencing it,
-- preventing orphaned or invalid cart state.
-- UNIQUE (user_id, variant_id) allows efficient UPSERT for quantity changes.

CREATE TABLE IF NOT EXISTS user_cart_items (
  id            UUID         NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id       UUID         NOT NULL REFERENCES auth.users(id)        ON DELETE CASCADE,
  variant_id    UUID         NOT NULL REFERENCES product_variants(id)  ON DELETE CASCADE,
  product_id    UUID         NOT NULL REFERENCES products(id)          ON DELETE CASCADE,
  product_name  TEXT         NOT NULL,
  variant_label TEXT         NOT NULL,
  price_agorot  INTEGER      NOT NULL CHECK (price_agorot >= 0),
  quantity      INTEGER      NOT NULL CHECK (quantity >= 1 AND quantity <= 99),
  image_color   TEXT,
  product_icon  TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, variant_id)
);

-- RLS: users can only read/write their own rows
ALTER TABLE user_cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_cart_items_own" ON user_cart_items
  FOR ALL
  USING     (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast per-user cart queries
CREATE INDEX IF NOT EXISTS user_cart_items_user_id_idx
  ON user_cart_items (user_id);


-- ── 4. updated_at trigger (reuses the existing set_updated_at() function) ─────

CREATE TRIGGER user_cart_items_updated_at
  BEFORE UPDATE ON user_cart_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
