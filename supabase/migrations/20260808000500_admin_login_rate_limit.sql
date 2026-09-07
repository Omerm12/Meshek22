-- ============================================================
-- משק 22 – Administrator login rate limiting
-- Migration: 20260808_005_admin_login_rate_limit.sql
--
-- Records FAILED administrator sign-in attempts so the login Server Action can
-- lock out brute force by IP and by submitted username.
--
-- Privacy / security notes:
--   * No password, and no plaintext username or IP, is ever stored — only a
--     salted SHA-256 hash produced by the application (ADMIN_RATE_LIMIT_SALT).
--   * RLS is enabled with NO policies, so anon and authenticated can neither
--     read nor write. Only service_role (server-side) touches this table.
--   * Successful logins are recorded too, so a legitimate sign-in can clear the
--     counter for that identity.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_hash TEXT        NOT NULL,
  identity_kind TEXT        NOT NULL CHECK (identity_kind IN ('ip', 'username')),
  succeeded     BOOLEAN     NOT NULL DEFAULT FALSE,
  attempted_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_login_attempts IS
  'Admin sign-in attempt log used purely for rate limiting. identity_hash is a salted SHA-256 of the IP or submitted username — never the raw value, never a password.';

CREATE INDEX IF NOT EXISTS admin_login_attempts_lookup_idx
  ON public.admin_login_attempts (identity_hash, attempted_at DESC);

CREATE INDEX IF NOT EXISTS admin_login_attempts_cleanup_idx
  ON public.admin_login_attempts (attempted_at);

ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: service_role bypasses RLS, everyone else is denied.

REVOKE ALL ON TABLE public.admin_login_attempts FROM PUBLIC;
REVOKE ALL ON TABLE public.admin_login_attempts FROM anon;
REVOKE ALL ON TABLE public.admin_login_attempts FROM authenticated;
GRANT  ALL ON TABLE public.admin_login_attempts TO service_role;


-- Housekeeping helper — prunes rows older than one day. Called opportunistically
-- by the login action so the table never grows unbounded without a cron job.
CREATE OR REPLACE FUNCTION public.prune_admin_login_attempts()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.admin_login_attempts WHERE attempted_at < now() - INTERVAL '1 day';
$$;

REVOKE ALL     ON FUNCTION public.prune_admin_login_attempts FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.prune_admin_login_attempts FROM anon;
REVOKE ALL     ON FUNCTION public.prune_admin_login_attempts FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.prune_admin_login_attempts TO service_role;
