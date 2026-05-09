"use client";

import { AuthShell } from "@/components/auth-shell";
import { validateAuthPassword } from "@/lib/auth-validation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, Suspense, type FormEvent } from "react";

const fieldControl =
  "min-h-11 w-full rounded-lg border border-[var(--border-muted)] bg-[color:color-mix(in_srgb,var(--card)_58%,var(--paper))] px-3 py-2 text-sm text-stone-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent/25";

function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [recoveringSession, setRecoveringSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const pwdError = validateAuthPassword(password);
  const canSubmit = useMemo(() => {
    if (pwdError) return false;
    return password === confirm && confirm.length > 0;
  }, [password, confirm, pwdError]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const code = searchParams.get("code");
        if (code) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) {
            if (!cancelled) {
              setError(exErr.message);
              setRecoveringSession(false);
            }
            return;
          }
        }
        const { data } = await supabase.auth.getSession();
        if (!cancelled) {
          setHasSession(!!data.session);
          setRecoveringSession(false);
        }
      } catch {
        if (!cancelled) {
          setRecoveringSession(false);
          setError("Could not load your reset session.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const pwMsg = validateAuthPassword(password);
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
      const supabase = createClient();
      const { error: upErr } = await supabase.auth.updateUser({
        password,
      });
      if (upErr) {
        setError(upErr.message);
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (recoveringSession) {
    return (
      <AuthShell title="Loading" subtitle="Hang on—we’re validating your reset link." />
    );
  }

  if (!hasSession) {
    return (
      <AuthShell title="Reset link expired" subtitle="Request a new link and try again.">
        <p className="text-center text-sm text-stone-600">
          <Link href="/forgot-password" className="font-semibold text-accent-strong hover:text-accent-pressed">
            Forgot password
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Use at least 8 characters.">
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
          <label htmlFor="new-password" className="mb-0.5 block text-sm font-medium text-stone-600">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className={fieldControl}
          />
          {pwdError ? <p className="mt-1 text-xs text-red-800">{pwdError}</p> : null}
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-0.5 block text-sm font-medium text-stone-600">
            Confirm password
          </label>
          <input
            id="confirm-password"
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
          {loading ? "Updating…" : "Update password"}
        </button>
        <p className="text-center text-sm text-stone-600">
          <Link href="/login" className="font-semibold text-accent-strong hover:text-accent-pressed">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Loading" subtitle="Hang on—we’re validating your reset link." />
      }
    >
      <UpdatePasswordForm />
    </Suspense>
  );
}
