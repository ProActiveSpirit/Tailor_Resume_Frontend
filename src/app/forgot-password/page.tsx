"use client";

import { AuthShell } from "@/components/auth-shell";
import { isValidEmailAddress } from "@/lib/auth-validation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

const fieldControl =
  "min-h-11 w-full rounded-lg border border-[var(--border-muted)] bg-[color:color-mix(in_srgb,var(--card)_58%,var(--paper))] px-3 py-2 text-sm text-stone-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent/25";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => isValidEmailAddress(email), [email]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const eTrim = email.trim();
    if (!isValidEmailAddress(eTrim)) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const next = encodeURIComponent("/auth/update-password");
      const supabase = createClient();
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(eTrim, {
        redirectTo: `${origin}/auth/callback?next=${next}`,
      });
      if (resetErr) {
        setError(resetErr.message);
        return;
      }
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="We’ll email you a link if an account exists for this address."
    >
      {sent ? (
        <p className="rounded-lg border border-accent/40 bg-accent-soft/60 px-3 py-2.5 text-sm text-stone-800">
          If an account exists for that email, you’ll receive a reset link shortly.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <p
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <div>
            <label htmlFor="forgot-email" className="mb-0.5 block text-sm font-medium text-stone-600">
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className={fieldControl}
            />
            {email.trim() && !isValidEmailAddress(email) ? (
              <p className="mt-1 text-xs text-red-800">Enter a valid email address.</p>
            ) : null}
          </div>
          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-accent-strong px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-pressed disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      <p className="pt-2 text-center text-sm text-stone-600">
        <Link href="/login" className="font-semibold text-accent-strong hover:text-accent-pressed">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
