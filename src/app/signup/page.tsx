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

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pwdError = validateAuthPassword(password);

  const canSubmit = useMemo(() => {
    if (!isValidEmailAddress(email)) return false;
    if (pwdError) return false;
    return password === confirm && confirm.length > 0;
  }, [email, password, confirm, pwdError]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
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
    if (password !== confirm) {
      setError("Passwords must match.");
      return;
    }
    setLoading(true);
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const supabase = createClient();
      const { data, error: signErr } = await supabase.auth.signUp({
        email: eTrim,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });
      if (signErr) {
        setError(signErr.message);
        return;
      }
      if (data.session) {
        router.push("/");
        router.refresh();
        return;
      }
      setInfo("Check your email to confirm your account, then sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create account"
      subtitle="We’ll use your email to sign you in securely."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        {info ? (
          <p className="rounded-lg border border-accent/40 bg-accent-soft/60 px-3 py-2.5 text-sm text-stone-800">
            {info}
          </p>
        ) : null}
        <div>
          <label htmlFor="signup-email" className="mb-0.5 block text-sm font-medium text-stone-600">
            Email
          </label>
          <input
            id="signup-email"
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
          <label htmlFor="signup-password" className="mb-0.5 block text-sm font-medium text-stone-600">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className={fieldControl}
          />
          {pwdError ? <p className="mt-1 text-xs text-red-800">{pwdError}</p> : null}
        </div>
        <div>
          <label htmlFor="signup-confirm" className="mb-0.5 block text-sm font-medium text-stone-600">
            Confirm password
          </label>
          <input
            id="signup-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(ev) => setConfirm(ev.target.value)}
            className={fieldControl}
          />
          {confirm && password !== confirm ? (
            <p className="mt-1 text-xs text-red-800">Passwords must match.</p>
          ) : null}
        </div>
        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-accent-strong px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-pressed disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Creating account…" : "Sign up"}
        </button>
        <p className="text-center text-sm text-stone-600">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-accent-strong hover:text-accent-pressed">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
