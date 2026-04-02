-- ============================================================
-- משק 22 – Auth Fixes
-- Migration: 002_auth_fixes.sql
-- ============================================================
-- 1. Update handle_new_user trigger to also capture phone from metadata
-- 2. Add INSERT policy on profiles so authenticated users can self-recover
--    a missing row (defensive; trigger should normally handle creation)
-- ============================================================

-- Update the trigger function to capture phone from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
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

-- Add INSERT policy so an authenticated user can create their own profile
-- if it somehow doesn't exist (e.g. user created before trigger was added)
DROP POLICY IF EXISTS "profiles_own_insert" ON public.profiles;
CREATE POLICY "profiles_own_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
