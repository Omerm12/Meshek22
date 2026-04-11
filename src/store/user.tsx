"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Returns true if the DB-backed last_login_at timestamp is older than 14 days.
 * When last_login_at is null (legacy user who has not yet logged in under the new
 * system), returns false — we do not force-expire users without a recorded timestamp.
 */
function isLoginExpired(lastLoginAt: string | null): boolean {
  if (!lastLoginAt) return false;
  return Date.now() - new Date(lastLoginAt).getTime() > FOURTEEN_DAYS_MS;
}

interface UserContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  /** True only when the authenticated user's profile role === 'admin'. */
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  session: null,
  isLoading: true,
  isAdmin: false,
  signOut: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!ignore) {
        setSession(data.session);
        setIsLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsLoading(false);
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Fetch role and last_login_at from profiles whenever session changes.
  // Combines two concerns into one query to avoid an extra round-trip.
  // Uses the existing profiles_own_select RLS policy — users can only read their own row.
  useEffect(() => {
    if (!session?.user) {
      setRole(null);
      return;
    }
    supabase
      .from("profiles")
      .select("role, last_login_at")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        setRole(data?.role ?? null);

        // Client-side defense-in-depth: sign out if last_login_at is DB-backed and
        // older than 14 days. The authoritative enforcement is in middleware; this
        // catches the case where the user is on a public route (skipped by middleware).
        if (isLoginExpired(data?.last_login_at ?? null)) {
          supabase.auth.signOut();
        }
      });
  }, [session, supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = useMemo<UserContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      isLoading,
      isAdmin: role === "admin",
      signOut,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, isLoading, role],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}
