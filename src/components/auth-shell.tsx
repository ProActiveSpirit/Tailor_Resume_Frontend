import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  const cardChrome =
    "rounded-2xl border border-[var(--border-muted)] bg-[var(--card)] shadow-[0_8px_28px_var(--shadow-soft)]";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 pb-16 pt-10 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-accent-soft/55 to-transparent"
      />
      <div className={`relative z-[1] w-full max-w-md ${cardChrome} p-6 sm:p-8`}>
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent sm:text-sm">
            Resume tailor
          </p>
          <h1
            className="mt-2 text-2xl font-semibold tracking-tight text-stone-900"
            style={{
              fontFamily:
                "var(--font-display), ui-serif, Georgia, serif",
            }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-sm text-stone-600">{subtitle}</p>
          ) : null}
        </div>
        <div className="space-y-4">{children ?? null}</div>
      </div>
    </div>
  );
}
