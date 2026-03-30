-- ============================================================
-- משק 22 – Initial Database Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

create type order_status as enum (
  'pending_payment',
  'paid',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
  'cancelled'
);

create type payment_status as enum (
  'pending',
  'paid',
  'failed',
  'refunded'
);

create type user_role as enum (
  'customer',
  'admin',
  'manager'
);

create type variant_unit as enum (
  'unit',       -- יחידה
  '250g',       -- 250 גרם
  '500g',       -- 500 גרם
  '1kg',        -- 1 ק"ג
  '2kg',        -- 2 ק"ג
  'bunch',      -- צרור
  'pack'        -- מארז
);

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================

create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  phone         text,
  role          user_role not null default 'customer',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', null)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Auto-update updated_at
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure set_updated_at();

-- ============================================================
-- DELIVERY ZONES
-- ============================================================

create table delivery_zones (
  id                                uuid primary key default uuid_generate_v4(),
  name                              text not null,
  slug                              text not null unique,
  description                       text,
  delivery_fee_agorot               integer not null check (delivery_fee_agorot >= 0),
  min_order_agorot                  integer not null default 0 check (min_order_agorot >= 0),
  free_delivery_threshold_agorot    integer check (free_delivery_threshold_agorot > 0),
  delivery_days                     text[] not null default '{"ראשון","שני","שלישי","רביעי","חמישי"}',
  estimated_delivery_hours          integer default 24,
  is_active                         boolean not null default true,
  sort_order                        integer not null default 0,
  created_at                        timestamptz not null default now(),
  updated_at                        timestamptz not null default now()
);

create trigger delivery_zones_updated_at
  before update on delivery_zones
  for each row execute procedure set_updated_at();

-- ============================================================
-- SETTLEMENTS (cities / yishuvim)
-- ============================================================

create table settlements (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null unique,
  delivery_zone_id  uuid references delivery_zones(id) on delete set null,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create index idx_settlements_zone on settlements(delivery_zone_id);
create index idx_settlements_name on settlements(name);

-- ============================================================
-- ADDRESSES
-- ============================================================

create table addresses (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references profiles(id) on delete cascade,
  label             text,
  street            text not null,
  house_number      text not null,
  apartment         text,
  city              text not null,
  zip_code          text,
  notes             text,
  is_default        boolean not null default false,
  delivery_zone_id  uuid references delivery_zones(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_addresses_user on addresses(user_id);

-- Ensure only one default per user
create unique index idx_addresses_one_default
  on addresses(user_id)
  where is_default = true;

create trigger addresses_updated_at
  before update on addresses
  for each row execute procedure set_updated_at();

-- ============================================================
-- CATEGORIES
-- ============================================================

create table categories (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  description text,
  image_url   text,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index idx_categories_active_sort on categories(is_active, sort_order);

-- ============================================================
-- PRODUCTS
-- ============================================================

create table products (
  id           uuid primary key default uuid_generate_v4(),
  category_id  uuid not null references categories(id) on delete restrict,
  name         text not null,
  slug         text not null unique,
  description  text,
  image_url    text,
  is_active    boolean not null default true,
  is_featured  boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index idx_products_category on products(category_id, is_active, sort_order);
create index idx_products_featured on products(is_featured) where is_featured = true;
create index idx_products_slug on products(slug);

create trigger products_updated_at
  before update on products
  for each row execute procedure set_updated_at();

-- ============================================================
-- PRODUCT VARIANTS
-- ============================================================

create table product_variants (
  id                      uuid primary key default uuid_generate_v4(),
  product_id              uuid not null references products(id) on delete cascade,
  unit                    variant_unit not null,
  label                   text not null,           -- display label e.g. "1 ק\"ג", "צרור"
  price_agorot            integer not null check (price_agorot > 0),
  compare_price_agorot    integer check (compare_price_agorot > 0),
  stock_quantity          integer,                 -- null = unlimited
  is_available            boolean not null default true,
  is_default              boolean not null default false,
  sort_order              integer not null default 0,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint chk_compare_price check (
    compare_price_agorot is null or compare_price_agorot > price_agorot
  )
);

create index idx_variants_product on product_variants(product_id, is_available, sort_order);

-- Ensure only one default variant per product
create unique index idx_variants_one_default
  on product_variants(product_id)
  where is_default = true;

create trigger product_variants_updated_at
  before update on product_variants
  for each row execute procedure set_updated_at();

-- ============================================================
-- CARTS
-- ============================================================

create table carts (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid references profiles(id) on delete cascade,
  session_id        text,
  delivery_zone_id  uuid references delivery_zones(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint chk_cart_owner check (
    user_id is not null or session_id is not null
  )
);

create index idx_carts_user on carts(user_id) where user_id is not null;
create index idx_carts_session on carts(session_id) where session_id is not null;

create trigger carts_updated_at
  before update on carts
  for each row execute procedure set_updated_at();

-- ============================================================
-- CART ITEMS
-- ============================================================

create table cart_items (
  id                  uuid primary key default uuid_generate_v4(),
  cart_id             uuid not null references carts(id) on delete cascade,
  product_variant_id  uuid not null references product_variants(id) on delete cascade,
  quantity            integer not null check (quantity > 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (cart_id, product_variant_id)
);

create index idx_cart_items_cart on cart_items(cart_id);

create trigger cart_items_updated_at
  before update on cart_items
  for each row execute procedure set_updated_at();

-- ============================================================
-- ORDER NUMBER GENERATOR
-- ============================================================

create sequence order_number_seq start 1000;

create or replace function generate_order_number()
returns text
language plpgsql
as $$
begin
  return 'M22-' || lpad(nextval('order_number_seq')::text, 6, '0');
end;
$$;

-- ============================================================
-- ORDERS
-- ============================================================

create table orders (
  id                          uuid primary key default uuid_generate_v4(),
  order_number                text not null unique default generate_order_number(),
  user_id                     uuid references profiles(id) on delete set null,
  delivery_zone_id            uuid not null references delivery_zones(id) on delete restrict,
  delivery_address_snapshot   jsonb not null,
  customer_snapshot           jsonb not null,
  subtotal_agorot             integer not null check (subtotal_agorot >= 0),
  delivery_fee_agorot         integer not null check (delivery_fee_agorot >= 0),
  discount_agorot             integer not null default 0 check (discount_agorot >= 0),
  total_agorot                integer not null check (total_agorot >= 0),
  order_status                order_status not null default 'pending_payment',
  payment_status              payment_status not null default 'pending',
  payment_method              text,
  payment_reference           text,
  delivery_notes              text,
  requested_delivery_date     date,
  confirmed_delivery_date     date,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  constraint chk_total check (
    total_agorot = subtotal_agorot + delivery_fee_agorot - discount_agorot
  )
);

create index idx_orders_user on orders(user_id) where user_id is not null;
create index idx_orders_status on orders(order_status, created_at desc);
create index idx_orders_payment on orders(payment_status);
create index idx_orders_number on orders(order_number);

create trigger orders_updated_at
  before update on orders
  for each row execute procedure set_updated_at();

-- ============================================================
-- ORDER ITEMS
-- ============================================================

create table order_items (
  id                    uuid primary key default uuid_generate_v4(),
  order_id              uuid not null references orders(id) on delete cascade,
  product_variant_id    uuid not null references product_variants(id) on delete restrict,
  product_snapshot      jsonb not null,   -- frozen copy of product+variant at order time
  quantity              integer not null check (quantity > 0),
  unit_price_agorot     integer not null check (unit_price_agorot > 0),
  total_price_agorot    integer not null check (total_price_agorot > 0),
  created_at            timestamptz not null default now()
);

create index idx_order_items_order on order_items(order_id);

-- ============================================================
-- UTILITY FUNCTION: get or create cart
-- ============================================================

create or replace function get_or_create_cart(
  p_user_id    uuid default null,
  p_session_id text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_cart_id uuid;
begin
  -- Try to find existing cart
  if p_user_id is not null then
    select id into v_cart_id
    from carts
    where user_id = p_user_id
    order by updated_at desc
    limit 1;
  elsif p_session_id is not null then
    select id into v_cart_id
    from carts
    where session_id = p_session_id
    order by updated_at desc
    limit 1;
  end if;

  -- Create if not found
  if v_cart_id is null then
    insert into carts (user_id, session_id)
    values (p_user_id, p_session_id)
    returning id into v_cart_id;
  end if;

  return v_cart_id;
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles enable row level security;
alter table addresses enable row level security;
alter table carts enable row level security;
alter table cart_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- Public read for catalog
alter table categories enable row level security;
alter table products enable row level security;
alter table product_variants enable row level security;
alter table delivery_zones enable row level security;
alter table settlements enable row level security;

-- Catalog: anyone can read active items
create policy "categories_public_read" on categories
  for select using (is_active = true);

create policy "products_public_read" on products
  for select using (is_active = true);

create policy "variants_public_read" on product_variants
  for select using (is_available = true);

create policy "zones_public_read" on delivery_zones
  for select using (is_active = true);

create policy "settlements_public_read" on settlements
  for select using (is_active = true);

-- Profiles: users manage their own
create policy "profiles_own_select" on profiles
  for select using (auth.uid() = id);

create policy "profiles_own_update" on profiles
  for update using (auth.uid() = id);

-- Addresses
create policy "addresses_own_select" on addresses
  for select using (auth.uid() = user_id);

create policy "addresses_own_insert" on addresses
  for insert with check (auth.uid() = user_id);

create policy "addresses_own_update" on addresses
  for update using (auth.uid() = user_id);

create policy "addresses_own_delete" on addresses
  for delete using (auth.uid() = user_id);

-- Carts: users see own, anonymous see by session (handled in app)
create policy "carts_own" on carts
  for all using (
    (auth.uid() is not null and auth.uid() = user_id)
  );

create policy "cart_items_own" on cart_items
  for all using (
    exists (
      select 1 from carts
      where carts.id = cart_items.cart_id
      and (
        (auth.uid() is not null and carts.user_id = auth.uid())
      )
    )
  );

-- Orders: users see their own
create policy "orders_own_select" on orders
  for select using (auth.uid() = user_id);

create policy "orders_own_insert" on orders
  for insert with check (auth.uid() = user_id or user_id is null);

create policy "order_items_own_select" on order_items
  for select using (
    exists (
      select 1 from orders
      where orders.id = order_items.order_id
      and orders.user_id = auth.uid()
    )
  );

-- Admin: service role bypasses RLS automatically
