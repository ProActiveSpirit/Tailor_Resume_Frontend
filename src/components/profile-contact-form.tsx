"use client";

import { createClient } from "@/lib/supabase/client";
import {
  isValidEmailAddress,
  isValidOptionalHttpUrl,
} from "@/lib/auth-validation";
import {
  displayTitleStyle,
  uiFieldHint,
  uiFieldLabel,
  uiFormDescription,
  uiPanelTitle,
} from "@/lib/ui-classes";
import { useCallback, useState } from "react";

export type ProfileContactInitial = {
  display_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  linkedin: string | null;
};

const cardChrome =
  "rounded-2xl border border-[var(--border-muted)] bg-[var(--card)] shadow-[0_8px_28px_var(--shadow-soft)]";
const fieldFill =
  "bg-[color:color-mix(in_srgb,var(--card)_58%,var(--paper))]";
const fieldControl = `min-h-11 w-full rounded-lg border border-[var(--border-muted)] ${fieldFill} px-3 py-2 text-sm text-stone-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent/25`;

type Props = {
  authEmail: string | null;
  initial: ProfileContactInitial;
};

export function ProfileContactForm({ authEmail, initial }: Props) {
  const [displayName, setDisplayName] = useState(
    typeof initial.display_name === "string" ? initial.display_name : "",
  );
  const [email, setEmail] = useState(
    typeof initial.email === "string" && initial.email.trim()
      ? initial.email
      : authEmail ?? "",
  );
  const [phone, setPhone] = useState(
    typeof initial.phone === "string" ? initial.phone : "",
  );
  const [address, setAddress] = useState(
    typeof initial.address === "string" ? initial.address : "",
  );
  const [linkedin, setLinkedin] = useState(
    typeof initial.linkedin === "string" ? initial.linkedin : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    setError(null);
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    if (!isValidEmailAddress(email)) {
      setError("Enter a valid email for your resume header.");
      return;
    }
    const li = linkedin.trim();
    if (li && !isValidOptionalHttpUrl(li)) {
      setError("LinkedIn must be a valid http(s) URL.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u) {
        setError("Sign in to save your profile.");
        return;
      }
      const { error: upErr } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          linkedin: li || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", u.id);
      if (upErr) {
        setError(upErr.message);
        return;
      }
      setSavedAt(Date.now());
      window.setTimeout(() => setSavedAt(null), 2800);
    } finally {
      setSaving(false);
    }
  }, [displayName, email, phone, address, linkedin]);

  return (
    <section
      className={`${cardChrome} p-6 sm:p-7`}
      aria-labelledby="profile-contact-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h2
            id="profile-contact-heading"
            className={uiPanelTitle}
            style={displayTitleStyle}
          >
            Resume contact
          </h2>
          <p className={uiFormDescription}>
            These fields appear on your tailored resume. Keep them current before you generate.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex min-h-10 w-full shrink-0 items-center justify-center rounded-xl bg-accent-strong px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-pressed disabled:cursor-not-allowed disabled:opacity-60 sm:mt-1 sm:w-auto"
        >
          {saving ? "Saving…" : "Save contact"}
        </button>
      </div>

      {savedAt ? (
        <p className="mt-3 text-xs font-medium text-emerald-700" role="status">
          Contact saved
        </p>
      ) : null}
      {error ? (
        <p
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label
            htmlFor="profile-display-name"
            className={`${uiFieldLabel} mb-0.5`}
          >
            Display name{" "}
            <span className="font-semibold text-accent-pressed">*</span>
          </label>
          <input
            id="profile-display-name"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={fieldControl}
          />
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="profile-email"
            className={`${uiFieldLabel} mb-0.5`}
          >
            Email on resume{" "}
            <span className="font-semibold text-accent-pressed">*</span>
          </label>
          <input
            id="profile-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={fieldControl}
          />
          {authEmail ? (
            <p className={`mt-1 ${uiFieldHint}`}>
              Sign-in email:{" "}
              <span className="font-semibold text-stone-700">{authEmail}</span>{" "}
              — can differ from the address above.
            </p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor="profile-phone"
            className={`${uiFieldLabel} mb-0.5`}
          >
            Phone <span className="font-normal text-stone-500">(optional)</span>
          </label>
          <input
            id="profile-phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={fieldControl}
            placeholder="e.g. +1 555 123 4567"
          />
        </div>
        <div>
          <label
            htmlFor="profile-linkedin"
            className={`${uiFieldLabel} mb-0.5`}
          >
            LinkedIn{" "}
            <span className="font-normal text-stone-500">(optional)</span>
          </label>
          <input
            id="profile-linkedin"
            type="url"
            inputMode="url"
            autoComplete="url"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            className={fieldControl}
            placeholder="https://www.linkedin.com/in/…"
          />
        </div>
        <div className="sm:col-span-2">
          <label
            htmlFor="profile-address"
            className={`${uiFieldLabel} mb-0.5`}
          >
            Address / location{" "}
            <span className="font-normal text-stone-500">(optional)</span>
          </label>
          <input
            id="profile-address"
            autoComplete="street-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={fieldControl}
            placeholder="City, state, or full address"
          />
        </div>
      </div>
    </section>
  );
}
