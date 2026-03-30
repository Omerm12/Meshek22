"use client";

import { useState } from "react";
import { User, Phone, Loader2, CheckCircle2 } from "lucide-react";
import { updateProfile } from "@/app/(account)/actions";
import type { Database } from "@/types/database";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export function ProfileForm({ profile }: { profile: ProfileRow }) {
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setSuccess(false);
    setError("");

    const result = await updateProfile(new FormData(e.currentTarget));
    setPending(false);

    if (result?.error) {
      setError(result.error);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Full name */}
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1.5">
          שם מלא
        </label>
        <div className="relative">
          <User
            className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            defaultValue={profile.full_name ?? ""}
            autoComplete="name"
            className="w-full h-11 bg-white border border-stone-200 rounded-xl ps-10 pe-4 text-sm text-gray-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
          />
        </div>
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
          טלפון{" "}
          <span className="text-stone-400 font-normal">(לא חובה)</span>
        </label>
        <div className="relative">
          <Phone
            className="absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-stone-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="phone"
            name="phone"
            type="tel"
            dir="ltr"
            autoComplete="tel"
            defaultValue={profile.phone ?? ""}
            placeholder="0501234567"
            className="w-full h-11 bg-white border border-stone-200 rounded-xl ps-10 pe-4 text-sm text-gray-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-shadow"
          />
        </div>
      </div>

      {/* Email (read-only) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          אימייל
        </label>
        <p
          className="h-11 flex items-center px-4 bg-stone-50 border border-stone-100 rounded-xl text-sm text-stone-500"
          dir="ltr"
        >
          {profile.email}
        </p>
        <p className="mt-1 text-xs text-stone-400">לשינוי האימייל פנו לתמיכה</p>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>
      )}

      {success && (
        <p className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          הפרופיל עודכן בהצלחה
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="h-11 px-8 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 active:bg-brand-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          "שמרו שינויים"
        )}
      </button>
    </form>
  );
}
