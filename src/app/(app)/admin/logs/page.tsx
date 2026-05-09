import {
  AdminGenerationLogTable,
  type GenerationLogRow,
} from "@/components/admin-generation-log-table";
import { UserMenu } from "@/components/user-menu";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AdminLogsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("generation_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  const initialRows = (data ?? []) as GenerationLogRow[];

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
              href="/"
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
            Generation log
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-stone-600">
            History of successful resume generations: who ran them, model and token usage, estimated
            cost, and full prompts. API keys are never stored—only a non-secret source label.
          </p>
          <p className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link
              href="/admin/users"
              className="font-medium text-accent underline-offset-2 transition hover:text-accent-pressed hover:underline"
            >
              Members
            </Link>
            <Link
              href="/"
              className="font-medium text-accent underline-offset-2 transition hover:text-accent-pressed hover:underline"
            >
              Back to tailor
            </Link>
          </p>
        </header>

        <AdminGenerationLogTable
          initialRows={initialRows}
          fetchError={error?.message ?? null}
        />
      </div>
    </div>
  );
}
