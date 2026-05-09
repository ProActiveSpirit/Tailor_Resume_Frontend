"use client";

import { AuthShell } from "@/components/auth-shell";
import {
  isValidEmailAddress,
  validateAuthPassword,
} from "@/lib/auth-validation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

const fieldControl =
  "min-h-11 w-full rounded-lg border border-[var(--border-muted)] bg-[color:color-mix(in_srgb,var(--card)_58%,var(--paper))] px-3 py-2 text-sm text-stone-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent/25";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pwdError = validateAuthPassword(password);

  const canSubmit = useMemo(() => {
    return isValidEmailAddress(email) && !pwdError;
  }, [email, pwdError]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const eTrim = email.trim();
    const pwMsg = validateAuthPassword(password);
    if (!isValidEmailAddress(eTrim)) {
      setError("Enter a valid email address.");
      return;
    }
    if (pwMsg) {
      setError(pwMsg);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: eTrim,
        password,
      });
      if (signErr) {
        setError(signErr.message);
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Sign in" subtitle="Use the email and password for your account.">
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
          <label htmlFor="login-email" className="mb-0.5 block text-sm font-medium text-stone-600">
            Email
          </label>
          <input
            id="login-email"
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
        <div>
          <label htmlFor="login-password" className="mb-0.5 block text-sm font-medium text-stone-600">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className={fieldControl}
          />
          {pwdError ? <p className="mt-1 text-xs text-red-800">{pwdError}</p> : null}
        </div>
        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-accent-strong px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-pressed disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-sm">
          <Link href="/forgot-password" className="font-medium text-accent-strong hover:text-accent-pressed">
            Forgot password?
          </Link>
          <Link href="/signup" className="font-medium text-accent-strong hover:text-accent-pressed">
            Create an account
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
