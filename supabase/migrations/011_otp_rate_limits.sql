-- ============================================================
-- משק 22 – OTP Rate Limits
-- Migration: 011_otp_rate_limits.sql
-- ============================================================
-- Tracks every SMS and email OTP send request so the application
-- layer can enforce a rolling per-channel rate limit without
-- relying on Supabase's built-in (and less configurable) throttle.
--
-- Limit: 3 requests per channel per identifier per rolling hour.
--   channel    = 'sms'   → identifier is E.164 phone, e.g. +972501234567
--   channel    = 'email' → identifier is lowercase email address
--
-- Access model:
--   • Service role only (bypasses RLS).
--   • No authenticated or anonymous user may read or write this table.
--   • All reads/writes go through Next.js Route Handlers with the
--     admin (service role) Supabase client.
--
-- Cleanup strategy:
--   Old rows are pruned opportunistically inside the Route Handler
--   (records older than 2 × window = 2 hours). The table stays small
--   even under sustained load — a 2-hour buffer at 100 req/hr across
--   1,000 users is ~200,000 rows max, trivially indexed.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.otp_rate_limits (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel      TEXT        NOT NULL CHECK (channel IN ('sms', 'email')),
  identifier   TEXT        NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.otp_rate_limits IS 'Rolling-window OTP send rate limit tracking (SMS and email).';
COMMENT ON COLUMN public.otp_rate_limits.channel    IS 'Delivery channel: ''sms'' or ''email''.';
COMMENT ON COLUMN public.otp_rate_limits.identifier IS 'E.164 phone for SMS, lowercase email for email channel.';

-- Index drives the rolling-window COUNT query efficiently:
--   WHERE channel = ? AND identifier = ? AND requested_at >= now() - interval '1 hour'
CREATE INDEX IF NOT EXISTS otp_rate_limits_window_idx
  ON public.otp_rate_limits (channel, identifier, requested_at DESC);

-- Service-role only: enable RLS but create no policies.
-- All direct user (anon / authenticated) access is blocked.
ALTER TABLE public.otp_rate_limits ENABLE ROW LEVEL SECURITY;
