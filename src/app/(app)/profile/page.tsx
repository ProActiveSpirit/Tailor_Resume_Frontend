import { ProfileContactForm } from "@/components/profile-contact-form";
import { UserMenu } from "@/components/user-menu";
import { createClient } from "@/lib/supabase/server";
import { fetchProfileRole } from "@/lib/supabase/profile-role";
import { roleLabel, type AppRole } from "@/lib/roles";
import {
  displayTitleStyle,
  uiFieldHint,
  uiPageSubtitle,
  uiPanelTitle,
  uiSectionEyebrow,
} from "@/lib/ui-classes";
import Link from "next/link";

const accountCard =
  "rounded-2xl border border-[var(--border-muted)] bg-[var(--card)] p-6 shadow-[0_8px_28px_var(--shadow-soft)]";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const signInEmail = user?.email ?? null;

  let displayRole: AppRole = "normal";
  if (user) {
    displayRole = await fetchProfileRole(supabase, user.id, user.email);
  }

  let profileRow: {
    display_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    linkedin: string | null;
  } | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, email, phone, address, linkedin")
      .eq("id", user.id)
      .maybeSingle();
    profileRow = data ?? null;
  }

  const initial = {
    display_name: profileRow?.display_name ?? null,
    email: profileRow?.email ?? null,
    phone: profileRow?.phone ?? null,
    address: profileRow?.address ?? null,
    linkedin: profileRow?.linkedin ?? null,
  };

  return (
    <div className="relative flex min-h-screen flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-accent-soft/55 to-transparent lg:h-32"
      />
      <div className="relative flex min-h-0 flex-1 flex-col px-4 pb-10 pt-8 sm:px-6 lg:max-w-[90rem] lg:px-6 lg:pb-8 lg:pt-6 xl:mx-auto xl:w-full xl:px-8">
        <header className="mb-8 shrink-0 lg:mb-6">
          <div className="flex items-center justify-between gap-4">
            <Link
              href={displayRole === "normal" ? "/pending" : "/"}
              className="min-w-0 rounded-sm text-accent outline-none ring-offset-2 ring-offset-[var(--paper)] transition hover:text-accent-pressed focus-visible:ring-2 focus-visible:ring-accent"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent sm:text-sm">
                Resume tailor
              </p>
            </Link>
            <UserMenu />
          </div>
          <h1
            className="mt-3 max-w-3xl text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl"
            style={displayTitleStyle}
          >
            Profile
          </h1>
          <p className={uiPageSubtitle}>
            Contact details for your resume and your account summary.
          </p>
        </header>

        <div className="mx-auto w-full max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] lg:items-start">
            <div className="min-w-0">
              {user ? (
                <ProfileContactForm
                  authEmail={signInEmail}
                  initial={initial}
                />
              ) : (
                <p className={`${uiFieldHint} text-sm`}>
                  Sign in to edit your profile.
                </p>
              )}
            </div>

            <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
              <section className={accountCard} aria-labelledby="account-heading">
                <h2
                  id="account-heading"
                  className={uiPanelTitle}
                  style={displayTitleStyle}
                >
                  Account
                </h2>
                <p className={`mt-4 ${uiSectionEyebrow}`}>Sign-in email</p>
                <p className="mt-1 break-all text-sm text-stone-700">
                  {signInEmail ?? "—"}
                </p>
                <p className={`mt-6 ${uiSectionEyebrow}`}>Role</p>
                <p className="mt-2 text-sm text-stone-700">
                  {roleLabel(displayRole)}
                </p>
                <p className="mt-6 text-sm">
                  {displayRole === "normal" ? (
                    <Link
                      href="/pending"
                      className="font-medium text-accent underline-offset-2 transition hover:text-accent-pressed hover:underline"
                    >
                      Approval status
                    </Link>
                  ) : (
                    <Link
                      href="/"
                      className="font-medium text-accent underline-offset-2 transition hover:text-accent-pressed hover:underline"
                    >
                      Back to tailor
                    </Link>
                  )}
                </p>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
