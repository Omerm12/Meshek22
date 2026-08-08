"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2, Lock, User } from "lucide-react";
import { adminLogin, type AdminLoginState } from "@/app/meshek22-control/login/actions";

const inputClass =
  "w-full h-12 px-3.5 rounded-xl border border-stone-200 bg-white text-gray-900 text-base " +
  "placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 " +
  "focus:border-transparent transition-shadow";

const initialState: AdminLoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-12 rounded-xl bg-brand-600 text-white font-bold text-base
                 hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60
                 disabled:cursor-not-allowed transition-colors
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
                 focus-visible:ring-offset-2 flex items-center justify-center gap-2"
    >
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {pending ? "מתחבר..." : "כניסה"}
    </button>
  );
}

export function AdminLoginForm() {
  const [state, formAction] = useActionState(adminLogin, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div>
        <label htmlFor="admin-username" className="block text-sm font-medium text-gray-700 mb-1.5">
          שם משתמש
        </label>
        <div className="relative">
          <User
            className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400"
            aria-hidden="true"
          />
          <input
            id="admin-username"
            name="username"
            type="text"
            autoComplete="username"
            required
            aria-describedby={state.error ? "admin-login-error" : undefined}
            aria-invalid={state.error ? true : undefined}
            className={`${inputClass} ps-10`}
          />
        </div>
      </div>

      <div>
        <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-1.5">
          סיסמה
        </label>
        <div className="relative">
          <Lock
            className="absolute start-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400"
            aria-hidden="true"
          />
          <input
            id="admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-describedby={state.error ? "admin-login-error" : undefined}
            aria-invalid={state.error ? true : undefined}
            className={`${inputClass} ps-10`}
          />
        </div>
      </div>

      {/* role="alert" + aria-live so screen readers announce the failure without
          the user having to hunt for it. The message is identical for every
          failure mode, by design. */}
      {state.error && (
        <div
          id="admin-login-error"
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{state.error}</span>
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
