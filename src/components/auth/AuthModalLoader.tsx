"use client";

/**
 * Client Component wrapper that lazily loads AuthModal on the client only.
 *
 * `next/dynamic` with `ssr: false` is only valid inside Client Components.
 * layout.tsx is a Server Component, so the dynamic() call must live here instead.
 * This wrapper is itself a Client Component ("use client"), which makes it legal.
 *
 * Performance effect is identical to the original intent:
 * - AuthModal + LoginForm + RegisterForm + react-hook-form are NOT included in
 *   the server-rendered HTML or the initial JS bundle.
 * - The chunk is fetched by the browser after hydration, on first client render
 *   of this wrapper.
 * - Because isOpen is false on first render, the modal doesn't paint — but the
 *   chunk is already loaded, so opening it later is instant.
 */

import dynamic from "next/dynamic";

const AuthModal = dynamic(
  () =>
    import("@/components/auth/AuthModal").then((m) => ({
      default: m.AuthModal,
    })),
  { ssr: false }
);

export function AuthModalLoader() {
  return <AuthModal />;
}
