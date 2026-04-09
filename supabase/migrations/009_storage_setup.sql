-- ============================================================
-- משק 22 – Supabase Storage: product images bucket
-- Migration: 009_storage_setup.sql
-- ============================================================
-- Creates the product-images storage bucket used by the admin
-- panel's image upload flow.
--
-- Security model:
--   READ  – public (images are served on the storefront, no auth needed)
--   WRITE – service_role only (uploads happen via the uploadProductImage
--            Server Action which uses createAdminClient(); no direct
--            client-side uploads are allowed)
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,        -- public read: storefront serves images without auth
  5242880,     -- 5 MB per file
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── Storage object RLS ────────────────────────────────────────────────────────
-- Public SELECT is granted automatically by the bucket's public flag.
-- We do NOT grant INSERT/UPDATE/DELETE to authenticated or anon roles —
-- all writes go through the service_role via the Server Action.
-- This prevents direct client-side uploads even by authenticated admins.
