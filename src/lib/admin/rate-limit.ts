/**
 * Server-side rate limiting for administrator sign-in.
 *
 * Two independent counters are kept, both of which must stay under their limit:
 *   • per client IP      — blunts a distributed guess against one account
 *   • per submitted name — blunts a spray across many usernames from one host
 *
 * Only a salted SHA-256 of each identity is written, so the table never holds a
 * raw IP, username or anything resembling a password. Attempts older than the
 * window are ignored, and rows older than a day are pruned opportunistically.
 *
 * Server-only: it uses the service-role client and must never be imported into
 * client code.
 */

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";

/** Failed attempts allowed per identity inside WINDOW_MINUTES. */
const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

function hashIdentity(value: string): string {
  // The salt makes the stored digest useless for reversing common values such as
  // an IP address or the username "admin".
  const salt = process.env.ADMIN_RATE_LIMIT_SALT ?? "";
  return createHash("sha256").update(`${salt}:${value.toLowerCase().trim()}`).digest("hex");
}

interface Identity {
  kind: "ip" | "username";
  value: string;
}

/**
 * True when this IP or username has already burned through its failed-attempt
 * budget. Fails OPEN on a database error: a logging outage must not lock the
 * shop owner out of their own admin panel, and every other authentication check
 * still applies.
 */
export async function isAdminLoginRateLimited(identities: Identity[]): Promise<boolean> {
  const db = createAdminClient();
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

  try {
    const results = await Promise.all(
      identities
        .filter((i) => i.value.length > 0)
        .map((identity) =>
          db
            .from("admin_login_attempts")
            .select("id", { count: "exact", head: true })
            .eq("identity_hash", hashIdentity(identity.value))
            .eq("identity_kind", identity.kind)
            .eq("succeeded", false)
            .gte("attempted_at", since)
        )
    );

    return results.some((r) => (r.count ?? 0) >= MAX_ATTEMPTS);
  } catch {
    return false;
  }
}

/**
 * Record the outcome of an attempt. A success clears that identity's failures so
 * a legitimate admin who mistyped their password a few times is not left locked
 * out for the rest of the window.
 */
export async function recordAdminLoginAttempt(
  identities: Identity[],
  succeeded: boolean
): Promise<void> {
  const db = createAdminClient();
  const valid = identities.filter((i) => i.value.length > 0);
  if (valid.length === 0) return;

  try {
    if (succeeded) {
      await Promise.all(
        valid.map((identity) =>
          db
            .from("admin_login_attempts")
            .delete()
            .eq("identity_hash", hashIdentity(identity.value))
            .eq("identity_kind", identity.kind)
        )
      );
      return;
    }

    await db.from("admin_login_attempts").insert(
      valid.map((identity) => ({
        identity_hash: hashIdentity(identity.value),
        identity_kind: identity.kind,
        succeeded: false,
      }))
    );

    // Opportunistic housekeeping so the table cannot grow without a cron job.
    // Roughly one run in twenty failed attempts.
    if (Math.random() < 0.05) {
      await db.rpc("prune_admin_login_attempts");
    }
  } catch {
    // Never let attempt logging break the login flow.
  }
}
