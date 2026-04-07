-- ============================================================
-- משק 22 – SMS OTP Auth Fix
-- Migration: 007_sms_auth_fix.sql
-- ============================================================
-- Root cause: profiles.email was NOT NULL, but SMS-auth users
-- have no email at the moment auth.users is created.
-- The handle_new_user trigger fires immediately on INSERT INTO
-- auth.users and tries INSERT INTO profiles (email = NEW.email).
-- For phone-only OTP users NEW.email IS NULL → violates NOT NULL
-- constraint → Supabase returns "Database error saving new user".
--
-- Fix:
--   1. Make profiles.email nullable (email is collected later,
--      after OTP verification, in the profile-completion step).
--   2. Update handle_new_user to handle NULL email gracefully.
-- ============================================================

-- 1. Drop the NOT NULL constraint on profiles.email
ALTER TABLE public.profiles
  ALTER COLUMN email DROP NOT NULL;

-- 2. Replace handle_new_user so it works for both SMS-only users
--    (email IS NULL) and email-based users (email IS NOT NULL).
--    ON CONFLICT (id) DO NOTHING guards against duplicate triggers.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,                                          -- NULL for SMS-only users; that is now allowed
    COALESCE(NEW.raw_user_meta_data->>'full_name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    'customer',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
