# Migration Inventory

Complete catalog of every object each local migration file creates or changes,
read in full and in chronological (filename) order. This is the reference the
audit (`MIGRATION_AUDIT.md`) and the reconciliation migration are built from.

`supabase_migrations.schema_migrations` does not exist in production, so
nothing here assumes the CLI's migration history — every fact below comes from
reading the `.sql` files themselves.

---

## 001_initial_schema.sql

**Tables:** `profiles`, `delivery_zones`, `settlements`, `addresses`,
`categories`, `products`, `product_variants`, `carts`, `cart_items`, `orders`,
`order_items`.

**Enums:** `order_status` (7 values incl. `paid`), `payment_status`,
`user_role`, `variant_unit`.

**Key columns:** as listed in each `CREATE TABLE`. Notably `orders.order_status
order_status not null default 'pending_payment'`, `orders.payment_status
payment_status not null default 'pending'`, `products.category_id uuid not
null references categories(id) on delete restrict`.

**Constraints:** `chk_compare_price`, `chk_cart_owner`, `chk_total` (orders
total = subtotal + fee − discount), plus every FK in the `CREATE TABLE`
statements (`ON DELETE CASCADE/RESTRICT/SET NULL` as specified).

**Indexes:** `idx_settlements_zone`, `idx_settlements_name`, `idx_addresses_user`,
`idx_addresses_one_default` (partial, one default per user),
`idx_categories_active_sort`, `idx_products_category`, `idx_products_featured`
(partial), `idx_products_slug`, `idx_variants_product`,
`idx_variants_one_default` (partial), `idx_carts_user`, `idx_carts_session`,
`idx_cart_items_cart`, `idx_orders_user`, `idx_orders_status`,
`idx_orders_payment`, `idx_orders_number`, `idx_order_items_order`.

**Functions:** `handle_new_user()` (trigger), `set_updated_at()` (trigger),
`generate_order_number()` (sequence-backed, `order_number_seq` starting 1000),
`get_or_create_cart(p_user_id, p_session_id)` (SECURITY DEFINER).

**Triggers:** `on_auth_user_created` (auth.users → handle_new_user),
`profiles_updated_at`, `delivery_zones_updated_at`, `products_updated_at`,
`product_variants_updated_at`, `carts_updated_at`, `cart_items_updated_at`,
`orders_updated_at` (all → `set_updated_at`).

**RLS:** enabled on all 11 tables. Public read policies for
categories/products/product_variants/delivery_zones/settlements (active-only).
Own-row policies for profiles/addresses/carts/cart_items/orders/order_items.

**Seed/data:** none.

**Dependencies:** none (base schema).

---

## 002_auth_fixes.sql

**Functions:** replaces `handle_new_user()` to also capture `phone` from
signup metadata; `ON CONFLICT (id) DO NOTHING`.

**RLS:** adds `profiles_own_insert` policy.

**Dependencies:** 001 (profiles table, handle_new_user).

---

## 003_admin_rls.sql

**Functions:** `is_admin()` — SECURITY DEFINER, STABLE, checks
`profiles.role = 'admin'`.

**RLS:** admin-all/select/update policies on profiles, orders, order_items,
categories, products, product_variants, delivery_zones, settlements (all
`DROP POLICY IF EXISTS` + `CREATE POLICY`, idempotent).

**Dependencies:** 001 (profiles.role, all target tables).

---

## 004_seed_delivery_data.sql

**Seed/data:** 6 delivery zones (`INSERT ... ON CONFLICT (slug) DO UPDATE`),
~80 settlements mapped to zones by slug (`ON CONFLICT (name) DO UPDATE`).
Idempotent upsert.

**RLS:** `delivery_zones_public_read`, `settlements_public_read` (re-asserted,
`DROP POLICY IF EXISTS` first).

**Dependencies:** 001 (delivery_zones, settlements tables).

---

## 005_order_domain_hardening.sql

**Data migration:** `UPDATE orders SET order_status='confirmed' WHERE
order_status='paid'` (run once, before the enum rebuild).

**Enum:** rebuilds `order_status` without the `'paid'` value (create
`order_status_new`, cast column, drop old type, rename).

**Constraints:** adds `chk_confirmed_requires_paid`: `CHECK (order_status !=
'confirmed' OR payment_status = 'paid')`.

**RLS:** adds `order_items_own_insert` policy.

**Dependencies:** 001 (orders.order_status, order_items).

⚠️ **Flagged in the audit** — this constraint appears to conflict with how the
current application creates a cash order (`order_status='confirmed'`,
`payment_status='pending'`, both individually valid per
`create_guest_order_atomic`'s own checks). See `MIGRATION_AUDIT.md` §"Discovered
risk" for the exact query to resolve this before trusting either code path.

---

## 006_order_idempotency.sql

**Columns:** `orders.idempotency_key TEXT` (nullable).

**Indexes:** `orders_idempotency_key_uidx` — unique, partial (`WHERE
idempotency_key IS NOT NULL`).

**Functions:** `create_order_atomic(...)` — SECURITY DEFINER, derives
`user_id` from `auth.uid()`, idempotent replay by `idempotency_key` (no
`user_id` scoping yet — fixed in 20260423). `GRANT EXECUTE ... TO
authenticated` only.

**Dependencies:** 001 (orders, order_items, generate_order_number).

---

## 007_sms_auth_fix.sql

**Columns:** `profiles.email` — `DROP NOT NULL` (nullable for SMS-only users).

**Functions:** replaces `handle_new_user()` again to tolerate `NULL` email.

**Dependencies:** 001/002 (profiles, handle_new_user).

---

## 008_auth_cart_hardening.sql

**Columns:** `profiles.last_login_at TIMESTAMPTZ` (`ADD COLUMN IF NOT
EXISTS`).

**Privileges:** `REVOKE INSERT/UPDATE (last_login_at) ON profiles FROM
authenticated`; explicit `GRANT` to `service_role`.

**Tables:** `user_cart_items` (`CREATE TABLE IF NOT EXISTS`) — user-scoped
denormalized cart, `UNIQUE (user_id, variant_id)`, FKs to
`auth.users`/`product_variants`/`products` all `ON DELETE CASCADE`.

**Indexes:** `user_cart_items_user_id_idx`.

**Triggers:** `user_cart_items_updated_at` → `set_updated_at()`.

**RLS:** enabled on `user_cart_items`; `user_cart_items_own` (ALL, own rows).

**Dependencies:** 001 (profiles, products, product_variants,
set_updated_at()), auth.users (Supabase-managed).

---

## 009_storage_setup.sql

**Storage:** bucket `product-images` (`INSERT ... ON CONFLICT (id) DO
NOTHING`) — public read, 5 MB limit, `image/jpeg|jpg|png|webp` only. No
`storage.objects` policies added (all writes via service_role Server Action).

**Dependencies:** none beyond Supabase's built-in `storage` schema.

---

## 010_cart_image_url.sql

**Columns:** `user_cart_items.image_url TEXT` (`ADD COLUMN IF NOT EXISTS`).

**Dependencies:** 008 (user_cart_items).

---

## 011_otp_rate_limits.sql

**Tables:** `otp_rate_limits` (`CREATE TABLE IF NOT EXISTS`) — `channel` (sms |
email), `identifier`, `requested_at`.

**Indexes:** `otp_rate_limits_window_idx` (channel, identifier, requested_at
DESC).

**RLS:** enabled, **no policies** (service_role-only by omission).

**Dependencies:** none.

---

## 012_delivery_optional_fields.sql

**Columns:** `delivery_zones.min_order_agorot` — `DROP NOT NULL`, `DROP
DEFAULT`.

**Data migration:** `UPDATE delivery_zones SET min_order_agorot = NULL WHERE
min_order_agorot = 0`. Note: none of the seeded zones in 004 ever had the
value `0`, so this UPDATE is a documented no-op against the current seed data
either way — its effect is purely schema-level (nullable, no default).

**Dependencies:** 001/004 (delivery_zones).

---

## 20260422_fractional_quantity.sql

**Columns:**
- `product_variants`: `quantity_pricing_mode TEXT NOT NULL DEFAULT 'fixed'`
  (`CHECK IN ('fixed','per_kg')`), `quantity_step NUMERIC(10,4) NOT NULL
  DEFAULT 1` (`CHECK > 0 AND <= 99`), `min_quantity NUMERIC(10,4) NOT NULL
  DEFAULT 1` (`CHECK > 0 AND <= 99`).
- `user_cart_items`: same three columns (defaults 'fixed'/1/1); `quantity`
  column type changed `INTEGER → NUMERIC(10,4)`.
- `order_items.quantity`: type changed `INTEGER → NUMERIC(10,4)`.
- `cart_items.quantity` (legacy table): type changed `INTEGER → NUMERIC(10,4)`.

**Data migration:** existing `product_variants` rows with `unit = '1kg'` are
set to `quantity_pricing_mode='per_kg', quantity_step=0.5, min_quantity=0.5`.

**Functions:** `create_order_atomic(...)` recreated (`::integer → ::numeric`
for quantity in the INSERT). Same signature/behavior otherwise as 006.

**Dependencies:** 001 (product_variants, order_items, cart_items), 006/008
(user_cart_items, create_order_atomic).

---

## 20260422_quantity_deals.sql

**Columns:**
- `products`: `qty_deal_enabled BOOLEAN NOT NULL DEFAULT false`,
  `qty_deal_quantity INTEGER CHECK (> 0)`, `qty_deal_price_agorot INTEGER
  CHECK (> 0)`.
- `user_cart_items`: `deal_enabled BOOLEAN NOT NULL DEFAULT false`,
  `deal_quantity INTEGER`, `deal_price_agorot INTEGER`.

**Dependencies:** 001 (products), 008 (user_cart_items).

---

## 20260423_rls_hardening.sql

**Privileges:** `REVOKE UPDATE/INSERT (role, id, created_at) ON profiles FROM
authenticated`, explicit `service_role` re-grants (prevents self-promotion to
admin).

**RLS:** replaces `orders_own_insert` to remove the `user_id IS NULL` escape
hatch — `WITH CHECK (auth.uid() = user_id)` only.

**Functions:** `create_order_atomic(...)` recreated again — restores `AND
user_id = v_user_id` in the idempotency lookup (closing a cross-user
idempotency-key collision). Re-applies `REVOKE/GRANT EXECUTE`.

**Reference-only:** a large trailing comment block documenting the complete
intended RLS policy surface as of this migration (no further statements).

**Dependencies:** 001–012 (documents the accumulated policy state), 20260422
(the function it recreates).

---

## 20260517_payment_hardening.sql

**Columns (all `ADD COLUMN IF NOT EXISTS`, all nullable):**
`orders.customer_email_sent_at timestamptz`, `orders.admin_email_sent_at
timestamptz`, `orders.cardcom_approval_number text`, `orders.payment_metadata
jsonb`.

**Comments:** one `COMMENT ON COLUMN` per column, documenting intent.

**No indexes, no constraints, no defaults beyond NULL.**

**Dependencies:** 001 (orders).

---

## 20260808_001_ice_cream_nuts_categories.sql

**Columns:** `categories.is_featured BOOLEAN NOT NULL DEFAULT FALSE`,
`categories.parent_id UUID` (both `ADD COLUMN IF NOT EXISTS`).

**Constraints:** `categories_parent_id_fkey` (self-FK, `ON DELETE SET NULL`,
guarded `IF NOT EXISTS` via `pg_constraint`), `categories_no_self_parent_chk`
(`CHECK (parent_id IS NULL OR parent_id <> id)`, same guard pattern).

**Indexes:** `categories_parent_sort_idx` (parent_id, sort_order).

**Data migration:** creates/normalizes one row — name `'גלידות ופיצוחים'`,
slug `'ice-creams-and-nuts'`, top-level, active. If legacy `'ice-creams'` /
`'nuts'` category rows exist: reassigns their products' `category_id` to the
combined row, re-parents any of their own children onto it, then deletes the
now-empty legacy rows (guarded: refuses to delete if any product still
references them). Ends with a verification block that raises if the end
state isn't exactly one active top-level `ice-creams-and-nuts` row and zero
`ice-creams`/`nuts` rows.

**Dependencies:** 001 (categories, products).

*(Superseded in the app's intended final state by
`20260906_more_from_the_farm_categories.sql`, which renames this same row —
see that entry below.)*

---

## 20260808_002_group_promotions.sql

**Tables:** `promotions` (`CREATE TABLE IF NOT EXISTS`) — name, description,
`promotion_type` (currently only `'mix_and_match_quantity'`),
`required_quantity` (2–100), `bundle_price_agorot`, `is_active`, `starts_at`/
`ends_at` window, `sort_order`. `promotion_items` — composite PK
`(promotion_id, product_variant_id)`, both FKs `ON DELETE CASCADE`.

**Indexes:** `promotions_active_idx`, `promotion_items_variant_idx`.

**Functions:** `promotions_set_updated_at()` (trigger),
`promotion_windows_overlap(...)` (IMMUTABLE, pure), `promotion_items_guard()`
(trigger — rejects `per_kg` variants and overlapping active memberships),
`promotions_activation_guard()` (trigger — re-checks overlap on
activation/window change).

**Triggers:** `promotions_updated_at`, `promotion_items_guard_trg`,
`promotions_activation_guard_trg`.

**RLS:** enabled on both tables; public SELECT of currently-live promotions
only; admin ALL via `is_admin()`.

**Comments:** deprecation notes on `products.qty_deal_*` (superseded by this
model, not dropped).

**Dependencies:** 001 (product_variants), 003 (is_admin), 20260422
(quantity_pricing_mode, qty_deal_* columns referenced in comments).

---

## 20260808_003_guest_checkout_fulfillment.sql

**Columns:**
- `orders`: `fulfillment_method TEXT NOT NULL DEFAULT 'delivery'`,
  `guest_access_token_hash TEXT`, `discount_breakdown JSONB`.
- `order_items`: `discount_agorot INTEGER NOT NULL DEFAULT 0`,
  `promotion_id UUID` (intentionally not a FK), `promotion_snapshot JSONB`.

**Column changes:** `orders.delivery_zone_id` — `DROP NOT NULL` (nullable for
pickup orders).

**Constraints:** `orders_fulfillment_method_chk` (`IN ('delivery',
'pickup')`), `orders_delivery_zone_required_chk` (`fulfillment_method =
'pickup' OR delivery_zone_id IS NOT NULL`), `orders_payment_method_chk`
(`NOT VALID`; `IN ('credit_card','cash','phone_credit')` or NULL),
`order_items_discount_range_chk` (`NOT VALID`; `0 <= discount_agorot <=
total_price_agorot`). All guarded via `pg_constraint` existence checks.

**Indexes:** `orders_guest_token_idx` (partial, `WHERE
guest_access_token_hash IS NOT NULL`).

**Functions:** `create_guest_order_atomic(...)` (16 params) — SECURITY
DEFINER, service_role-only, full parameter validation, SELECT-then-INSERT
idempotent replay (superseded by the concurrency-safe version in 006 below).

**Dependencies:** 001 (orders, order_items, delivery_zones), 20260422
(order_items.quantity is NUMERIC, read by the function body).

---

## 20260808_004_admin_performance.sql

**Indexes:** `orders_created_at_desc_idx`, `products_active_sort_idx`.
Explicitly does *not* recreate 8 indexes/prefixes already covered by 001 (see
the file's own comment for the full list) or the `categories_parent_sort_idx`
already created in 20260808_001.

**Functions:** `admin_dashboard_counts()` — zero-arg, STABLE, SECURITY
DEFINER, `service_role`-only EXECUTE. Returns one JSONB object with 12 keys:
`orders_awaiting_payment_call`, `orders_new`, `orders_preparing`,
`orders_out_for_delivery`, `orders_ready_for_pickup`, `orders_completed`,
`orders_cancelled`, `products_active`, `categories_active`, `settlements`,
`delivery_zones`, `promotions_active`. The application's own fallback
(`src/lib/admin/dashboard-counts.ts`) specifically probes for the
`orders_awaiting_payment_call` key to decide whether this RPC is present and
current, and issues 9 separate COUNT queries itself if not.

**Dependencies:** 20260808_002 (promotions, for the `promotions_active` key —
**this RPC will error at call time if `promotions` does not exist**, since the
`WITH operational AS (...)` CTE and the final `jsonb_build_object` both
reference it directly), 20260808_003 (fulfillment_method).

---

## 20260808_005_admin_login_rate_limit.sql

**Tables:** `admin_login_attempts` (`CREATE TABLE IF NOT EXISTS`) —
`identity_hash`, `identity_kind` (`ip`|`username`), `succeeded`,
`attempted_at`.

**Indexes:** `admin_login_attempts_lookup_idx`,
`admin_login_attempts_cleanup_idx`.

**Functions:** `prune_admin_login_attempts()` — deletes rows older than 1
day. `SECURITY DEFINER`, `service_role`-only EXECUTE.

**RLS:** enabled, no policies (service_role-only by omission, matching
011's pattern).

**Dependencies:** none beyond base schema.

---

## 20260808_006_transactional_integrity.sql

**Functions (all `CREATE OR REPLACE`):**
- `save_promotion(...)` — atomic create/update of a promotion + its full
  `promotion_items` membership in one transaction (deactivate → replace
  membership → apply real values last, so the activation guard validates the
  final state). **Operates directly on `promotions`/`promotion_items` — will
  fail at call time if 20260808_002's tables do not exist.**
- `create_guest_order_atomic(...)` — same 16-param signature as
  20260808_003, rewritten to attempt the INSERT directly and catch
  `unique_violation` (race-safe on concurrent first submissions of the same
  idempotency key) instead of SELECT-then-INSERT. Also now calls `PERFORM
  reserve_stock_for_items(p_items)` before inserting the order.
- `reserve_stock_for_items(p_items)` — decrements `stock_quantity` for
  fixed-unit variants only (`per_kg` and `NULL` stock are treated as
  unlimited), via a conditional `UPDATE ... WHERE stock_quantity >= qty` for
  concurrency safety; raises on insufficient stock.

**Constraints:** `product_variants_stock_non_negative_chk` (`NOT VALID`;
`stock_quantity IS NULL OR stock_quantity >= 0`).

**Dependencies:** 001 (product_variants, orders, order_items), 20260808_002
(promotions, promotion_items — for `save_promotion`), 20260808_003 (the
function it replaces).

---

## 20260906_more_from_the_farm_categories.sql

**Data migration:** renames/reuses the existing `ice-creams-and-nuts` row
(created by 20260808_001) in place — same `id`, new `name` (`'עוד מהמשק'`),
new `slug` (`'more-from-the-farm'`), `parent_id` stays `NULL`. Creates it
fresh only if neither slug exists at all.

Creates or reuses 7 child categories under that parent, each independently
idempotent: `spices` (10), `eggs` (20, reuses a legacy `'beitsim'` /
`'ביצים ומוצרי חלב'` row by slug or name if one exists), `nuts` (30, fresh —
see 001's note above), `olive-oil` (40, fresh), `crunchy-vegetables` (50,
fresh), `knives-and-peelers` (60, fresh), `ice-creams` (70, fresh — see 001's
note above).

**Constraints/columns depended on:** re-adds `parent_id`/`is_featured`
idempotently as a defensive guard (already added by 20260808_001).

**Dependencies:** 20260808_001 (the row it renames; the parent_id/is_featured
columns and FK it depends on).

---

## Objects present in production but not created by ANY local migration file

Discovered during the read-only production inspection (see
`MIGRATION_AUDIT.md`). Not touched by the reconciliation migration.

- `_m22_import_products`, `_m22_import_products_mapped`,
  `_m22_import_variants`, `_m22_target_categories`, `_m22_target_products`,
  and RPC `_m22_norm_name` — look like a one-off bulk product-import/ETL
  working set.
- `categories_backup_before_price_update_20260601`,
  `products_backup_before_price_update_20260601`,
  `product_variants_backup_before_price_update_20260601`, `products_backup`,
  `product_variants_backup` — look like manual pre-change snapshots taken
  before a bulk price update on 2026-06-01.
- `price_update_categories_stage`, `price_update_deals_stage`,
  `price_update_products_stage`, `price_update_resolved_categories_stage`,
  `price_update_variants_stage` — staging tables for that same operation.

These all appear to be intentional, manually-created artifacts from ad-hoc
data work done directly against production. They are left alone; deciding
whether they are still needed is a call only the project owner can make.
