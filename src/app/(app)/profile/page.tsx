import { UserMenu } from "@/components/user-menu";
import { createClient } from "@/lib/supabase/server";
import { fetchProfileRole } from "@/lib/supabase/profile-role";
import { roleLabel, type AppRole } from "@/lib/roles";
import Link from "next/link";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "—";

  let displayRole: AppRole = "normal";
  if (user) {
    displayRole = await fetchProfileRole(supabase, user.id, user.email);
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-accent-soft/55 to-transparent lg:h-32"
      />
      <div className="relative flex min-h-0 flex-1 flex-col px-4 pb-10 pt-8 sm:px-6 lg:max-w-[90rem] lg:px-6 lg:pb-8 lg:pt-6 xl:mx-auto xl:w-full xl:px-8">
        <header className="mb-8 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <Link
              href={displayRole === "normal" ? "/pending" : "/"}
              className="min-w-0 rounded-sm text-accent outline-none ring-offset-2 ring-offset-[var(--paper)] transition hover:text-accent-pressed focus-visible:ring-2 focus-visible:ring-accent"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] sm:text-sm">
                Resume tailor
              </p>
            </Link>
            <UserMenu />
          </div>
          <h1
            className="mt-4 max-w-3xl text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl"
            style={{ fontFamily: "var(--font-display), ui-serif, Georgia, serif" }}
          >
            Profile
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-stone-600">
            Signed-in account for Resume Tailor.
          </p>
        </header>

        <section
          className="max-w-md rounded-2xl border border-[var(--border-muted)] bg-[var(--card)] p-6 shadow-[0_8px_28px_var(--shadow-soft)]"
          aria-labelledby="profile-email-label"
        >
          <h2 id="profile-email-label" className="text-sm font-semibold text-stone-800">
            Email
          </h2>
          <p className="mt-2 break-all text-sm text-stone-700">{email}</p>
          <h2 className="mt-6 text-sm font-semibold text-stone-800">Role</h2>
          <p className="mt-2 text-sm text-stone-700">{roleLabel(displayRole)}</p>
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
      </div>
    </div>
  );
}
