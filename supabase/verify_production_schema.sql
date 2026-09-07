-- ============================================================
-- משק 22 – Production schema verification (READ-ONLY)
--
-- Reports PASS/FAIL for every table, column, constraint, index, function,
-- trigger, policy and required data row this project's migrations are
-- expected to have produced, as of 20260906230000_reconcile_production_schema.sql.
--
-- Safe to run any number of times, in production, at any time: every check
-- is a SELECT against pg_catalog / information_schema, or a SELECT against
-- application tables. Nothing here writes, and nothing here can fail the
-- statement itself — an unmet check reports FAIL as a row, it does not raise.
--
-- Usage: run the whole file in the Supabase SQL Editor. Scroll the single
-- result set; every row not saying PASS needs attention. A one-line summary
-- (pass/fail counts) is printed last.
-- ============================================================

WITH checks(section, check_name, passed) AS (

  -- ── Tables ──────────────────────────────────────────────────────────────
  VALUES
  ('tables', 'profiles',              to_regclass('public.profiles')              IS NOT NULL),
  ('tables', 'delivery_zones',        to_regclass('public.delivery_zones')        IS NOT NULL),
  ('tables', 'settlements',           to_regclass('public.settlements')           IS NOT NULL),
  ('tables', 'addresses',             to_regclass('public.addresses')             IS NOT NULL),
  ('tables', 'categories',            to_regclass('public.categories')            IS NOT NULL),
  ('tables', 'products',              to_regclass('public.products')              IS NOT NULL),
  ('tables', 'product_variants',      to_regclass('public.product_variants')      IS NOT NULL),
  ('tables', 'carts',                 to_regclass('public.carts')                 IS NOT NULL),
  ('tables', 'cart_items',            to_regclass('public.cart_items')            IS NOT NULL),
  ('tables', 'orders',                to_regclass('public.orders')                IS NOT NULL),
  ('tables', 'order_items',           to_regclass('public.order_items')           IS NOT NULL),
  ('tables', 'user_cart_items',       to_regclass('public.user_cart_items')       IS NOT NULL),
  ('tables', 'otp_rate_limits',       to_regclass('public.otp_rate_limits')       IS NOT NULL),
  ('tables', 'promotions',            to_regclass('public.promotions')            IS NOT NULL),
  ('tables', 'promotion_items',       to_regclass('public.promotion_items')       IS NOT NULL),
  ('tables', 'admin_login_attempts',  to_regclass('public.admin_login_attempts')  IS NOT NULL)

  UNION ALL

  -- ── Columns (only the additive ones a migration introduced after 001) ───
  SELECT 'columns', label, EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = t AND column_name = c
  )
  FROM (VALUES
    ('profiles',         'last_login_at',            'profiles.last_login_at'),
    ('categories',        'parent_id',                'categories.parent_id'),
    ('categories',        'is_featured',              'categories.is_featured'),
    ('orders',            'idempotency_key',          'orders.idempotency_key'),
    ('orders',            'fulfillment_method',       'orders.fulfillment_method'),
    ('orders',            'guest_access_token_hash',  'orders.guest_access_token_hash'),
    ('orders',            'discount_breakdown',       'orders.discount_breakdown'),
    ('orders',            'customer_email_sent_at',   'orders.customer_email_sent_at'),
    ('orders',            'admin_email_sent_at',      'orders.admin_email_sent_at'),
    ('orders',            'cardcom_approval_number',  'orders.cardcom_approval_number'),
    ('orders',            'payment_metadata',         'orders.payment_metadata'),
    ('order_items',       'discount_agorot',          'order_items.discount_agorot'),
    ('order_items',       'promotion_id',             'order_items.promotion_id'),
    ('order_items',       'promotion_snapshot',       'order_items.promotion_snapshot'),
    ('product_variants',  'quantity_pricing_mode',    'product_variants.quantity_pricing_mode'),
    ('product_variants',  'quantity_step',            'product_variants.quantity_step'),
    ('product_variants',  'min_quantity',             'product_variants.min_quantity'),
    ('products',          'qty_deal_enabled',         'products.qty_deal_enabled'),
    ('products',          'qty_deal_quantity',        'products.qty_deal_quantity'),
    ('products',          'qty_deal_price_agorot',    'products.qty_deal_price_agorot'),
    ('user_cart_items',   'image_url',                'user_cart_items.image_url'),
    ('user_cart_items',   'quantity_pricing_mode',    'user_cart_items.quantity_pricing_mode'),
    ('user_cart_items',   'quantity_step',            'user_cart_items.quantity_step'),
    ('user_cart_items',   'min_quantity',             'user_cart_items.min_quantity'),
    ('user_cart_items',   'deal_enabled',             'user_cart_items.deal_enabled'),
    ('user_cart_items',   'deal_quantity',            'user_cart_items.deal_quantity'),
    ('user_cart_items',   'deal_price_agorot',        'user_cart_items.deal_price_agorot')
  ) AS c(t, c, label)

  UNION ALL

  -- ── Column nullability (where a migration specifically changed it) ──────
  VALUES
  (
    'nullability', 'delivery_zones.min_order_agorot is nullable (012)',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'delivery_zones'
        AND column_name = 'min_order_agorot' AND is_nullable = 'YES'
    )
  ),
  (
    'nullability', 'orders.delivery_zone_id is nullable (20260808_003)',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders'
        AND column_name = 'delivery_zone_id' AND is_nullable = 'YES'
    )
  ),
  (
    'nullability', 'profiles.email is nullable (007)',
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles'
        AND column_name = 'email' AND is_nullable = 'YES'
    )
  )

  UNION ALL

  -- ── Constraints ───────────────────────────────────────────────────────────
  SELECT 'constraints', name, EXISTS (SELECT 1 FROM pg_constraint WHERE conname = name)
  FROM (VALUES
    ('chk_total'),
    ('chk_cart_owner'),
    ('chk_compare_price'),
    ('chk_confirmed_requires_paid'),
    ('categories_parent_id_fkey'),
    ('categories_no_self_parent_chk'),
    ('orders_fulfillment_method_chk'),
    ('orders_delivery_zone_required_chk'),
    ('orders_payment_method_chk'),
    ('order_items_discount_range_chk'),
    ('product_variants_stock_non_negative_chk'),
    ('promotions_window_chk')
  ) AS x(name)

  UNION ALL

  -- ── Indexes ───────────────────────────────────────────────────────────────
  SELECT 'indexes', name, EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = name)
  FROM (VALUES
    ('idx_orders_status'), ('idx_orders_payment'), ('idx_orders_number'),
    ('idx_order_items_order'), ('idx_variants_product'), ('idx_products_category'),
    ('idx_settlements_name'), ('idx_settlements_zone'),
    ('orders_idempotency_key_uidx'), ('orders_guest_token_idx'),
    ('categories_parent_sort_idx'), ('orders_created_at_desc_idx'),
    ('products_active_sort_idx'), ('promotions_active_idx'),
    ('promotion_items_variant_idx'), ('otp_rate_limits_window_idx'),
    ('admin_login_attempts_lookup_idx'), ('admin_login_attempts_cleanup_idx'),
    ('user_cart_items_user_id_idx')
  ) AS x(name)

  UNION ALL

  -- ── Functions (by name; overload-agnostic via pg_proc.proname) ───────────
  SELECT 'functions', name, EXISTS (SELECT 1 FROM pg_proc WHERE proname = name)
  FROM (VALUES
    ('handle_new_user'), ('set_updated_at'), ('generate_order_number'),
    ('get_or_create_cart'), ('is_admin'), ('create_order_atomic'),
    ('create_guest_order_atomic'), ('promotions_set_updated_at'),
    ('promotion_windows_overlap'), ('promotion_items_guard'),
    ('promotions_activation_guard'), ('save_promotion'),
    ('reserve_stock_for_items'), ('admin_dashboard_counts'),
    ('prune_admin_login_attempts')
  ) AS x(name)

  UNION ALL

  -- ── Triggers ──────────────────────────────────────────────────────────────
  SELECT 'triggers', name, EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = name AND NOT tgisinternal
  )
  FROM (VALUES
    ('on_auth_user_created'), ('profiles_updated_at'), ('delivery_zones_updated_at'),
    ('products_updated_at'), ('product_variants_updated_at'), ('carts_updated_at'),
    ('cart_items_updated_at'), ('orders_updated_at'), ('user_cart_items_updated_at'),
    ('promotions_updated_at'), ('promotion_items_guard_trg'),
    ('promotions_activation_guard_trg')
  ) AS x(name)

  UNION ALL

  -- ── RLS enabled ───────────────────────────────────────────────────────────
  SELECT 'rls_enabled', t, COALESCE(
    (SELECT relrowsecurity FROM pg_class WHERE oid = to_regclass('public.' || t)),
    FALSE
  )
  FROM (VALUES
    ('profiles'), ('addresses'), ('carts'), ('cart_items'), ('orders'),
    ('order_items'), ('categories'), ('products'), ('product_variants'),
    ('delivery_zones'), ('settlements'), ('user_cart_items'),
    ('otp_rate_limits'), ('promotions'), ('promotion_items'),
    ('admin_login_attempts')
  ) AS x(t)

  UNION ALL

  -- ── RLS policies (spot check — the ones each migration explicitly names) ─
  SELECT 'policies', tbl || '.' || pol, EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = pol
  )
  FROM (VALUES
    ('categories', 'categories_public_read'),
    ('categories', 'admin_categories_all'),
    ('products', 'products_public_read'),
    ('products', 'admin_products_all'),
    ('orders', 'orders_own_select'),
    ('orders', 'orders_own_insert'),
    ('orders', 'admin_orders_select'),
    ('order_items', 'order_items_own_insert'),
    ('profiles', 'profiles_own_insert'),
    ('user_cart_items', 'user_cart_items_own'),
    ('promotions', 'promotions_public_select'),
    ('promotions', 'promotions_admin_all'),
    ('promotion_items', 'promotion_items_public_select'),
    ('promotion_items', 'promotion_items_admin_all')
  ) AS x(tbl, pol)

  UNION ALL

  -- ── Storage ───────────────────────────────────────────────────────────────
  VALUES (
    'storage', 'product-images bucket (public, 5MB limit)',
    EXISTS (
      SELECT 1 FROM storage.buckets
      WHERE id = 'product-images' AND public = TRUE AND file_size_limit = 5242880
    )
  )

  UNION ALL

  -- ── Required data ─────────────────────────────────────────────────────────
  VALUES
  (
    'data', 'exactly 6 delivery zones',
    (SELECT count(*) FROM delivery_zones) = 6
  ),
  (
    'data', 'more-from-the-farm: one active top-level parent',
    EXISTS (
      SELECT 1 FROM categories
      WHERE slug = 'more-from-the-farm' AND is_active AND parent_id IS NULL
    )
  ),
  (
    'data', 'more-from-the-farm: no leftover ice-creams-and-nuts row',
    NOT EXISTS (SELECT 1 FROM categories WHERE slug = 'ice-creams-and-nuts')
  ),
  (
    'data', 'more-from-the-farm: all 7 required children present, correctly parented',
    (
      SELECT count(*) FROM categories c
      JOIN categories p ON p.id = c.parent_id
      WHERE p.slug = 'more-from-the-farm'
        AND c.slug IN ('spices', 'eggs', 'nuts', 'olive-oil',
                       'crunchy-vegetables', 'knives-and-peelers', 'ice-creams')
    ) = 7
  ),
  (
    'data', 'no product has a null category_id',
    NOT EXISTS (SELECT 1 FROM products WHERE category_id IS NULL)
  ),
  (
    'data', 'no category referenced by a product was deleted (FK integrity)',
    NOT EXISTS (
      SELECT 1 FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE c.id IS NULL
    )
  )

)

SELECT section, check_name, status FROM (
  SELECT
    section,
    check_name,
    CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS status,
    passed,
    0 AS sort_group
  FROM checks

  UNION ALL

  -- Summary row, sorted to the very top so it's the first thing visible.
  SELECT
    '0_summary',
    format('%s / %s checks passed', count(*) FILTER (WHERE passed), count(*)),
    CASE WHEN bool_and(passed) THEN 'PASS' ELSE 'FAIL' END,
    bool_and(passed),
    -1 AS sort_group
  FROM checks
) AS report
ORDER BY sort_group, passed ASC, section, check_name;
