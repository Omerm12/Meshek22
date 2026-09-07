# Migration Audit — Production vs. Local Migrations

Date of inspection: 2026-09-07.
Project ref inspected: `czcldqhfshtoypkguist` (`https://czcldqhfshtoypkguist.supabase.co`,
from `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`). This is a `NEXT_PUBLIC_` variable —
public by design — so the URL itself is not a secret and is quoted here for
traceability. **I do not have Vercel CLI/dashboard access from this environment**,
so I could not directly diff this against Vercel's own configured Production
env var. Please confirm in the Vercel dashboard that Production's
`NEXT_PUBLIC_SUPABASE_URL` is exactly this value before trusting the rest of
this audit. Everything below assumes it is.

`supabase_migrations.schema_migrations` does not exist in this project, so
none of this relied on migration history — every row below was verified (or
explicitly marked as unverifiable) against the real database.

## Method and its limits

No Supabase CLI is installed in this environment, there is no `DATABASE_URL`,
and no direct Postgres connection is available — consistent with prior notes
that only the SQL Editor path has ever worked for this project. So "read-only
queries only" was done two ways:

1. **Table/column/function existence** — via PostgREST's own OpenAPI schema
   document (`GET /rest/v1/` with the service-role key), which lists every
   table, view and RPC PostgREST currently has cached, plus full column lists
   and nullability per table. This is a single authoritative read, not a
   per-object guess.
2. **Cross-checks** — targeted `SELECT ... LIMIT 1` probes per column (to
   independently confirm the OpenAPI listing) and RPC calls using
   syntactically-valid but business-invalid arguments chosen so each
   function's own validation raises *before* any `INSERT`/`UPDATE`/`DELETE`
   statement executes (e.g. `create_guest_order_atomic` was called with a
   1-character idempotency key, which its first `IF` rejects immediately).
   `prune_admin_login_attempts` was deliberately never called — it is a real
   `DELETE`, even though idempotent by design, and calling it would not have
   been read-only. A couple of matching anon-key reads on `orders` and
   `categories` confirmed RLS is actively filtering, not just present.

Everything that needs `pg_catalog`/`information_schema` — indexes by name,
constraints by name, trigger existence, exact RLS policy definitions — **I
cannot verify from here.** Each such row below is marked `UNKNOWN` with the
exact query to run in the Supabase SQL Editor.

**A methodology note, in the interest of not hiding a mistake:** my first
inspection pass (simple per-table `SELECT` probes checking for Postgres error
code `42P01`) returned `EXISTS` for `promotions`, `promotion_items` and
`admin_login_attempts`. A repeat of the same probes 90 seconds later, and the
OpenAPI document itself (fetched 4 times over several seconds), consistently
say these do **not** exist. I attribute the first result to a cold-start
artifact (the project may have been paused/idle) rather than the schema
actually flapping — but I'm flagging it rather than quietly using the more
convenient answer. The `MISSING` verdicts below are the ones repeated
identically across the OpenAPI document (fetched independently 4 times) and a
6-repeat per-table probe loop, so I trust them.

## ⚠️ Discrepancy from the stated known issue

The task states the following are missing from `public.orders`:
`customer_email_sent_at`, `admin_email_sent_at`, `cardcom_approval_number`,
`payment_metadata`.

**My inspection found all four columns present in production right now**,
confirmed two independent ways: a live `SELECT` of a real row (values were
`NULL`, as expected for a fresh column, not an error), and the OpenAPI
schema's `orders` column list. This was stable across every repeat.

This doesn't change what the reconciliation migration should contain — `ADD
COLUMN IF NOT EXISTS` is correct and harmless whichever of us is right about
the current state — but it does mean the specific *reason* given for this
work (CardCom finalization failing because these columns don't exist) may not
be the actual current cause, if it is still failing. Please double-check
you're looking at the same project (see the ref above) before relying on this
being the fix.

## ⚠️ Discovered risk (out of scope, flagged not fixed)

`005_order_domain_hardening.sql` adds `chk_confirmed_requires_paid: CHECK
(order_status != 'confirmed' OR payment_status = 'paid')`. The current
application's cash-checkout path creates orders with `order_status =
'confirmed'` and `payment_status = 'pending'` at the same time (see
`create_guest_order_atomic`'s own validation, which independently allows
`p_order_status IN ('pending_payment','confirmed')` and `p_payment_status IN
('pending','paid')` — nothing in the function itself forbids that specific
combination). If this constraint is active in production, **every cash order
should currently fail to insert.** If cash checkout is actually working in
production, the constraint has likely already been dropped or altered outside
any tracked migration.

I have not touched this — it's a business-rule question, not a "does the
schema match the migration files" question, and altering or dropping a CHECK
constraint isn't something to fold silently into a baselining task. Verify
with:

```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'chk_confirmed_requires_paid';
```

If it exists, decide (separately from this work) whether to drop it, loosen
it, or change the cash-order creation path.

## Comparison table

| Migration | Expected changes | Status | Missing objects / data | Verification |
|---|---|---|---|---|
| `001_initial_schema.sql` | 11 tables, 4 enums, base indexes/triggers/RLS | **APPLIED** | — | OpenAPI lists all 11 tables with expected columns; `order_status` enum has no `'paid'` value (see 005) confirming at least 001+005 both landed |
| `002_auth_fixes.sql` | `handle_new_user()` phone capture, `profiles_own_insert` policy | **UNKNOWN** | Function body and policy existence need `pg_proc`/`pg_policies` | `SELECT prosrc FROM pg_proc WHERE proname='handle_new_user';` / `SELECT policyname FROM pg_policies WHERE tablename='profiles' AND policyname='profiles_own_insert';` |
| `003_admin_rls.sql` | `is_admin()`, 8 admin policies | **APPLIED** (function) / **UNKNOWN** (policies) | Policy rows | `is_admin()` RPC callable (confirmed). `SELECT policyname FROM pg_policies WHERE policyname LIKE 'admin_%';` |
| `004_seed_delivery_data.sql` | 6 zones + ~80 settlements | **APPLIED** | — | `delivery_zones`/`settlements` tables exist and are queried successfully by the app today (not independently row-counted here — recommend `SELECT count(*) FROM delivery_zones;` should read 6) |
| `005_order_domain_hardening.sql` | enum rebuild w/o `'paid'`, `chk_confirmed_requires_paid` | **PARTIAL / UNKNOWN** | Enum rebuild appears done (no errors possible with `'paid'` anywhere); constraint presence **unverified — see risk section above** | `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='order_status';` and the constraint query above |
| `006_order_idempotency.sql` | `orders.idempotency_key`, unique partial index, `create_order_atomic` (v1) | **APPLIED** | Index existence unverified | Column confirmed via OpenAPI (`orders.idempotency_key` present, nullable). RPC `create_order_atomic` exists (10-param signature matches). `SELECT indexname FROM pg_indexes WHERE indexname='orders_idempotency_key_uidx';` |
| `007_sms_auth_fix.sql` | `profiles.email` nullable, `handle_new_user` update | **APPLIED** (column) / **UNKNOWN** (function body) | — | OpenAPI: `profiles.email` not in `required` list → nullable, confirmed |
| `008_auth_cart_hardening.sql` | `profiles.last_login_at`, `user_cart_items` table+RLS+trigger | **APPLIED** | Trigger/RLS policy detail unverified | `profiles.last_login_at` and `user_cart_items` (with all its columns) both present via OpenAPI |
| `009_storage_setup.sql` | `product-images` storage bucket | **UNKNOWN** | Storage isn't exposed via `/rest/v1/` | `SELECT id, public, file_size_limit FROM storage.buckets WHERE id='product-images';` in SQL Editor |
| `010_cart_image_url.sql` | `user_cart_items.image_url` | **APPLIED** | — | Confirmed present via OpenAPI |
| `011_otp_rate_limits.sql` | `otp_rate_limits` table, RLS enabled/no policies | **APPLIED** (table) | RLS policy absence unverified | `otp_rate_limits` present in OpenAPI table list |
| `012_delivery_optional_fields.sql` | `delivery_zones.min_order_agorot` nullable, default dropped | **APPLIED** | — | OpenAPI: `min_order_agorot` absent from `delivery_zones.required`, and its schema shows no server-side default remaining as NOT NULL |
| `20260422_fractional_quantity.sql` | pricing-mode columns on `product_variants`/`user_cart_items`, quantity → NUMERIC on 3 tables, `create_order_atomic` v2 | **APPLIED** | — | All 6 new columns confirmed present via OpenAPI |
| `20260422_quantity_deals.sql` | `qty_deal_*` on `products`, `deal_*` on `user_cart_items` | **APPLIED** | — | All 6 columns confirmed present via OpenAPI |
| `20260423_rls_hardening.sql` | column-privilege revokes on `profiles`, `orders_own_insert` rewrite, `create_order_atomic` v3 | **UNKNOWN** | Privilege grants and policy text aren't visible via REST | `SELECT grantee, privilege_type FROM information_schema.column_privileges WHERE table_name='profiles' AND column_name IN ('role','id','created_at');` |
| `20260517_payment_hardening.sql` | 4 columns on `orders` | **APPLIED** — **contradicts the stated known issue, see above** | — | All 4 confirmed present via a live row read and the OpenAPI schema, independently, repeatably |
| `20260808_001_ice_cream_nuts_categories.sql` | `categories.parent_id`/`is_featured`, FK/check/index, `ice-creams-and-nuts` row + legacy merge | **APPLIED**, but **superseded** | Row now renamed to `more-from-the-farm` per the newer migration (expected — see that row) | `categories.parent_id`/`is_featured` confirmed via OpenAPI; no row with slug `ice-creams-and-nuts` remains (expected, per 20260906) |
| `20260808_002_group_promotions.sql` | `promotions`, `promotion_items` tables, guard functions/triggers, RLS | **MISSING** | Both tables absent; `promotion_windows_overlap` RPC absent; guard triggers therefore cannot exist either | `promotions`/`promotion_items` absent from OpenAPI table list (confirmed 2 independent ways); `promotion_windows_overlap` RPC returns `PGRST202` |
| `20260808_003_guest_checkout_fulfillment.sql` | 6 new columns on `orders`/`order_items`, 4 constraints, 1 index, `create_guest_order_atomic` v1 | **APPLIED** | Constraint/index names unverified | All 6 columns confirmed via OpenAPI; `create_guest_order_atomic` RPC exists with the exact 16-param signature |
| `20260808_004_admin_performance.sql` | 2 indexes, `admin_dashboard_counts()` | **MISSING (function) / UNKNOWN (indexes)** | `admin_dashboard_counts` RPC absent | `PGRST202` on a zero-arg call — reliable, since this signature takes no parameters at all |
| `20260808_005_admin_login_rate_limit.sql` | `admin_login_attempts` table, 2 indexes, `prune_admin_login_attempts()` | **MISSING** | Table absent; function therefore cannot do anything useful even if it exists | `admin_login_attempts` absent from OpenAPI table list (confirmed 2 independent ways) |
| `20260808_006_transactional_integrity.sql` | `save_promotion`, `create_guest_order_atomic` v2 (race-safe), `reserve_stock_for_items`, 1 constraint | **PARTIAL** | `save_promotion` and `reserve_stock_for_items` **exist as functions but their target table (`promotions`) does not** — calling `save_promotion` today will fail with "relation promotions does not exist" the instant it tries to write | Both RPCs answer with their own validation errors (proving they exist) rather than `PGRST202`; cross-referenced against the missing `promotions` table from 002 |
| `20260906_more_from_the_farm_categories.sql` | renames the `ice-creams-and-nuts` row, adds 7 children | **NOT YET APPLIED** (migration file only just written, not yet run against production) | Everything in this file | `SELECT slug, name, parent_id FROM categories WHERE slug IN ('more-from-the-farm','spices','eggs','nuts','olive-oil','crunchy-vegetables','knives-and-peelers','ice-creams');` — expect 0 rows today |

## What this actually means for the reconciliation migration

Production is missing exactly the second half of the 20260808 batch, in a way
that lines up with "someone ran the file up to a point and stopped, or ran an
older/incomplete copy of it":

- Fully missing: `promotions`, `promotion_items` (002), `admin_login_attempts`
  (005), `admin_dashboard_counts()` (004).
- Applied on top of that missing foundation anyway: `save_promotion` and the
  race-safe `create_guest_order_atomic`/`reserve_stock_for_items` (006) —
  these exist as functions but `save_promotion` cannot currently do anything
  without the 002 tables.
- The four CardCom columns (20260517) and everything through
  20260808_003/20260808_001 (as later superseded by 20260906) are present.

The reconciliation migration (`20260906230000_reconcile_production_schema.sql`)
brings 002, 004, 005 up to their intended final state, re-asserts 20260517's 4
columns and 20260808_003/006's columns/functions (all safely idempotent
whether or not they're already there), and applies 20260906's category
rename+children. It deliberately does **not** touch `chk_confirmed_requires_paid`
— see the flagged risk above.

## Data safety confirmation

Row counts observed (service-role, unrestricted) at inspection time:
`categories` = 27, `products` = 158, `orders` = 30. Anon-key reads of `orders`
returned `count = 0` (RLS correctly hides other people's orders from an
unauthenticated read) and of `categories` returned `count = 27` (matching the
unrestricted count — i.e. every current category is `is_active = true`),
which is a reasonable spot-check that RLS is live, not just declared.

Every RPC probe used during this audit was verified afterward to have left no
trace: no `promotions` row named `probe` exists (the table doesn't exist, so
there's nothing to check — the probe raised before any write was even
attempted), and no ownerless row (`user_id IS NULL AND session_id IS NULL`)
exists in `carts`.

## Local validation performed

No Supabase CLI is installed and Docker's daemon is not reachable from this
environment (`docker ps` fails to connect), so `supabase start` could not be
used. Instead, the reconciliation migration and `verify_production_schema.sql`
were both executed for real against an embedded PGlite (WASM) Postgres,
seeded with a minimal stand-in schema shaped like production's actual
partially-migrated state (base tables present, one `ice-creams-and-nuts`
category row, `promotions`/`promotion_items`/`admin_login_attempts`/
`admin_dashboard_counts` absent):

- The reconciliation migration ran to completion with no errors.
- `verify_production_schema.sql` ran with no errors and correctly reported
  PASS for every object the reconciliation is responsible for (all new
  columns, constraints, indexes, functions, triggers, RLS, policies, and the
  category data — one active top-level `more-from-the-farm` row, all 7
  children correctly parented, zero leftover `ice-creams-and-nuts` row). It
  correctly reported FAIL for objects the stub deliberately didn't include
  (profiles, user_cart_items, otp_rate_limits and their triggers/policies) —
  expected, since those aren't part of what this migration touches.
- The reconciliation migration was run a **second** time against the same
  database to confirm idempotency: it completed with no errors, and the
  category table's final contents were unchanged (still exactly one parent +
  seven children, no duplicates).

This is a real execution against a real (if minimal) Postgres engine, not a
syntax-only check — but it is not a substitute for running
`verify_production_schema.sql` against actual production once the
reconciliation has been applied there, since the stub cannot reproduce
Supabase-specific state (real RLS policy history, the exact current grants,
the untracked backup/staging tables) precisely.

## Runbook — do not run until you've reviewed everything above

I do not have the project's database password or a working Docker daemon in
this environment, so I cannot execute any of the following myself. This is
the exact sequence to run yourself, in order, stopping immediately if any
check doesn't match what's expected.

```bash
# 1. Link to the correct project (interactive login / access token required).
npx supabase login
npx supabase link --project-ref czcldqhfshtoypkguist

# 2. Register every EXISTING migration as already applied, WITHOUT running
#    them. This is the baseline step — it only writes rows into
#    supabase_migrations.schema_migrations, it does not touch your schema.
#    (Requires the database password; the CLI will prompt for it.)
npx supabase migration repair --status applied \
  001 002 003 004 005 006 007 008 009 010 011 012 \
  20260422000100 20260422000200 \
  20260423 20260517 \
  20260808000100 20260808000200 20260808000300 20260808000400 20260808000500 20260808000600 \
  20260906

# 3. Confirm ONLY the reconciliation migration is pending.
npx supabase db push --dry-run
# Expected output: exactly one migration listed —
#   20260906230000_reconcile_production_schema.sql
# STOP HERE and do not continue if anything else is listed — it means a
# version string above doesn't match what the CLI derived from a filename,
# and repair needs to be corrected first.

# 4. Only once step 3's output looks exactly like that — apply it.
npx supabase db push

# 5. Verify the result (read-only).
#    Either paste supabase/verify_production_schema.sql into the SQL Editor,
#    or, if you have the DB password:
psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2-)" \
  -f supabase/verify_production_schema.sql

# 6. Lint the resulting schema.
npx supabase db lint --linked --schema public
```

### Statements in the reconciliation migration that write production data

Everything else in the file is `CREATE`/`ALTER ... ADD COLUMN IF NOT EXISTS`/
`CREATE OR REPLACE FUNCTION` (schema only, no existing row is ever modified).
The only statements that touch **existing rows** are in section 7 (the
`more-from-the-farm` rename), and only ever target a category row by
`slug`/`name` match — never a product, order, or customer:

```sql
UPDATE public.categories SET name=..., slug='more-from-the-farm', ... WHERE slug = 'ice-creams-and-nuts';
UPDATE public.categories SET parent_id=..., sort_order=10, is_active=TRUE WHERE slug = 'spices';
UPDATE public.categories SET name='ביצים', slug='eggs', parent_id=..., sort_order=20, is_active=TRUE WHERE id = <resolved legacy eggs row, if one exists>;
UPDATE public.categories SET parent_id=..., sort_order=30, is_active=TRUE WHERE slug = 'nuts';
UPDATE public.categories SET parent_id=..., sort_order=40, is_active=TRUE WHERE slug = 'olive-oil';
UPDATE public.categories SET parent_id=..., sort_order=50, is_active=TRUE WHERE slug = 'crunchy-vegetables';
UPDATE public.categories SET parent_id=..., sort_order=60, is_active=TRUE WHERE slug = 'knives-and-peelers';
UPDATE public.categories SET parent_id=..., sort_order=70, is_active=TRUE WHERE slug = 'ice-creams';
```

### Remaining uncertainty after all of the above

- Whether `chk_confirmed_requires_paid` actually exists in production (see
  the flagged risk above) — unresolved, deliberately not touched.
- The exact current text of every RLS policy and every column-privilege
  grant from `003`, `20260423`, `008` — the audit could only confirm counts/
  presence via what PostgREST exposes, not exact definitions.
- Whether Vercel Production's `NEXT_PUBLIC_SUPABASE_URL` truly matches
  `czcldqhfshtoypkguist` — inferred from `.env.local` and prior session
  context, not cross-checked against the Vercel dashboard directly.
