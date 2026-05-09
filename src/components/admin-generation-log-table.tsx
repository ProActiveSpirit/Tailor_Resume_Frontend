"use client";

import { Fragment, useCallback, useState } from "react";

export type GenerationLogRow = {
  id: string;
  user_id: string;
  created_at: string;
  user_email: string | null;
  system_prompt: string;
  job_description: string;
  source_resume: string;
  display_name: string;
  target_role: string;
  phone: string | null;
  pdf_template: string;
  anthropic_model: string | null;
  anthropic_max_tokens: number | null;
  claude_output_effort: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
  estimated_cost_usd: string | number | null;
  api_key_source: string;
};

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatCost(v: string | number | null): string {
  if (v === null || v === "") return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  return n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(3)}`;
}

function tokenCell(inT: number | null, outT: number | null): string {
  if (inT == null && outT == null) return "—";
  return `${inT ?? "—"} in / ${outT ?? "—"} out`;
}

const promptBlock =
  "mt-2 max-h-48 overflow-y-auto rounded-xl border border-[var(--border-muted)] bg-[color:color-mix(in_srgb,var(--card)_58%,var(--paper))] p-3 font-mono text-xs leading-relaxed text-stone-800 scrollbar-tailor whitespace-pre-wrap";

export function AdminGenerationLogTable({
  initialRows,
  fetchError,
}: {
  initialRows: GenerationLogRow[];
  fetchError: string | null;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (fetchError) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900" role="alert">
        {fetchError}
      </p>
    );
  }

  if (initialRows.length === 0) {
    return (
      <p className="text-sm text-stone-600">
        No generations logged yet. Successful tailor runs from the home page will appear here.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border-muted)] bg-[var(--card)] shadow-[0_8px_28px_var(--shadow-soft)]">
      <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border-muted)] bg-accent-soft/30">
            <th scope="col" className="px-4 py-3 font-semibold text-stone-800">
              When
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-stone-800">
              Who
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-stone-800">
              Model
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-stone-800">
              Tokens
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-stone-800">
              Est. cost
            </th>
            <th scope="col" className="px-4 py-3 font-semibold text-stone-800">
              Key source
            </th>
            <th scope="col" className="w-28 px-4 py-3 font-semibold text-stone-800">
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {initialRows.map((row) => {
            const isOpen = expanded.has(row.id);
            return (
              <Fragment key={row.id}>
                <tr className="border-b border-[var(--border-muted)] align-top transition-colors hover:bg-accent-soft/20">
                  <td className="px-4 py-3 text-stone-800">{formatWhen(row.created_at)}</td>
                  <td className="px-4 py-3 text-stone-800">
                    <span className="font-medium">{row.user_email ?? "—"}</span>
                  </td>
                  <td className="max-w-[14rem] px-4 py-3 font-mono text-xs text-stone-700">
                    {row.anthropic_model ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                    {tokenCell(row.input_tokens, row.output_tokens)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-stone-800">
                    {formatCost(row.estimated_cost_usd)}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-600">{row.api_key_source}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="rounded-lg border border-[var(--border-muted)] bg-accent-soft/70 px-2.5 py-1 text-xs font-medium text-accent-strong transition hover:border-accent hover:bg-accent-soft"
                      aria-expanded={isOpen}
                      onClick={() => toggle(row.id)}
                    >
                      {isOpen ? "Hide" : "View"}
                    </button>
                  </td>
                </tr>
                {isOpen ? (
                  <tr className="border-b border-[var(--border-muted)] bg-[color:color-mix(in_srgb,var(--paper)_88%,var(--accent-soft))]">
                    <td colSpan={7} className="px-0 py-0">
                      <div className="px-4 py-5">
                        <div className="mx-auto max-w-5xl space-y-4">
                          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-stone-600">
                            <span>
                              <span className="font-semibold text-stone-800">Name:</span>{" "}
                              {row.display_name}
                            </span>
                            <span>
                              <span className="font-semibold text-stone-800">Target role:</span>{" "}
                              {row.target_role}
                            </span>
                            {row.phone ? (
                              <span>
                                <span className="font-semibold text-stone-800">Phone:</span>{" "}
                                {row.phone}
                              </span>
                            ) : null}
                            <span>
                              <span className="font-semibold text-stone-800">PDF template:</span>{" "}
                              {row.pdf_template}
                            </span>
                            <span>
                              <span className="font-semibold text-stone-800">Max tokens:</span>{" "}
                              {row.anthropic_max_tokens ?? "—"}
                            </span>
                            <span>
                              <span className="font-semibold text-stone-800">Output effort:</span>{" "}
                              {row.claude_output_effort || "—"}
                            </span>
                            {row.cache_read_input_tokens != null ||
                            row.cache_creation_input_tokens != null ? (
                              <span>
                                <span className="font-semibold text-stone-800">Cache:</span> read{" "}
                                {row.cache_read_input_tokens ?? "—"} · write{" "}
                                {row.cache_creation_input_tokens ?? "—"}
                              </span>
                            ) : null}
                          </div>
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-accent">
                              System prompt
                            </h3>
                            <pre className={promptBlock} tabIndex={0}>
                              {row.system_prompt}
                            </pre>
                          </div>
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-accent">
                              Job description
                            </h3>
                            <pre className={promptBlock} tabIndex={0}>
                              {row.job_description}
                            </pre>
                          </div>
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-accent">
                              Source resume / experience
                            </h3>
                            <pre className={`${promptBlock} max-h-64`} tabIndex={0}>
                              {row.source_resume}
                            </pre>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
