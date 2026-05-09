import { UserMenu } from "@/components/user-menu";

import Link from "next/link";

export default function PendingApprovalPage() {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-accent-soft/55 to-transparent lg:h-32"
      />
      <div className="relative flex min-h-0 flex-1 flex-col px-4 pb-10 pt-8 sm:px-6 lg:max-w-[90rem] lg:px-6 lg:pb-8 lg:pt-6 xl:mx-auto xl:w-full xl:px-8">
        <header className="mb-10 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent sm:text-sm">
              Resume tailor
            </p>
            <UserMenu />
          </div>
          <h1
            className="mt-6 max-w-3xl text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl"
            style={{ fontFamily: "var(--font-display), ui-serif, Georgia, serif" }}
          >
            Waiting for approval
          </h1>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-stone-700">
            Your account is active, but access to Resume Tailor is restricted until an{" "}
            <span className="font-medium text-stone-900">administrator</span> assigns you the
            Developer or Admin role.
          </p>
          <p className="mt-6 text-sm">
            <Link
              href="/profile"
              className="font-medium text-accent underline-offset-2 transition hover:text-accent-pressed hover:underline"
            >
              View profile
            </Link>
          </p>
        </header>

        <section
          className="max-w-lg rounded-2xl border border-[var(--border-muted)] bg-[var(--card)] p-6 shadow-[0_8px_28px_var(--shadow-soft)]"
          aria-labelledby="pending-detail-heading"
        >
          <h2 id="pending-detail-heading" className="text-sm font-semibold text-stone-800">
            What happens next
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-stone-600">
            Once an admin approves you under{" "}
            <span className="font-medium text-stone-800">Members</span>, you&apos;ll be able to use
            the tailoring workspace. Use the avatar menu to sign out if needed.
          </p>
        </section>
      </div>
    </div>
  );
}
