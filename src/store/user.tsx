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
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Fetch role from profiles whenever session changes.
  // Uses the existing profiles_own_select RLS policy — users can only read their own row.
  useEffect(() => {
    if (!session?.user) {
      setRole(null);
      return;
    }
    supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        setRole(data?.role ?? null);
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
