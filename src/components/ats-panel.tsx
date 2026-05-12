"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ATSResult, ATSSuggestion } from "@/lib/ats-engine";

type Props = {
  result: ATSResult;
  onClose: () => void;
  onApply: (suggestion: ATSSuggestion) => void;
  onApplyAll: () => void;
};

function scoreTone(score: number): { ring: string; label: string } {
  if (score < 50)
    return { ring: "text-red-600", label: "Needs attention" };
  if (score < 75)
    return { ring: "text-amber-600", label: "Solid — room to improve" };
  return { ring: "text-emerald-600", label: "Strong match" };
}

function severityClasses(sev: ATSSuggestion["severity"]): string {
  if (sev === "high")
    return "border-red-200 bg-red-50 text-red-900";
  if (sev === "medium")
    return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-stone-200 bg-stone-100 text-stone-800";
}

function ScoreRing({ score }: { score: number }) {
  const size = 112;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  const tone = scoreTone(score);

  return (
    <div className="relative flex h-[7.5rem] w-[7.5rem] shrink-0 items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="stroke-[color:color-mix(in_srgb,var(--border-muted)_85%,transparent)]"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={`${tone.ring} transition-[stroke-dasharray] duration-500 ease-out`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          className="font-mono text-3xl font-bold tabular-nums text-stone-900"
          aria-live="polite"
        >
          {score}
        </span>
        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-stone-500">
          / 100
        </span>
      </div>
    </div>
  );
}

function BreakdownBar({
  label,
  score,
  max,
}: {
  label: string;
  score: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((score / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-stone-600">{label}</span>
        <span className="font-mono tabular-nums text-stone-500">
          {score}/{max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,var(--border-muted)_55%,var(--paper))]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-strong to-accent-pressed transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function AtsPanel({ result, onClose, onApply, onApplyAll }: Props) {
  const applicable = useMemo(
    () => result.suggestions.filter((s) => s.canApply && s.apply),
    [result.suggestions],
  );

  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedIds, setAppliedIds] = useState(() => new Set<string>());
  const [applyAllBusy, setApplyAllBusy] = useState(false);

  const tone = scoreTone(result.score);

  const markApplied = useCallback((id: string) => {
    setAppliedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleApply = (s: ATSSuggestion) => {
    if (!s.apply) return;
    setApplyingId(s.id);
    try {
      onApply(s);
      markApplied(s.id);
    } finally {
      setApplyingId(null);
    }
  };

  const handleApplyAll = () => {
    if (!applicable.length) return;
    setApplyAllBusy(true);
    try {
      onApplyAll();
      for (const s of applicable) markApplied(s.id);
    } finally {
      setApplyAllBusy(false);
    }
  };

  return (
    <>
      <div
        role="presentation"
        aria-hidden
        className="fixed inset-0 z-40 bg-stone-900/25 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ats-panel-title"
        className="fixed right-0 top-0 z-50 flex h-[100dvh] w-[min(calc(100vw-1.5rem),28rem)] flex-col border-l border-[var(--border-muted)] bg-[var(--card)] shadow-[-8px_0_32px_var(--shadow-soft)]"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-muted)] px-4 py-3 sm:px-5">
          <div className="min-w-0 pr-2">
            <h2
              id="ats-panel-title"
              className="text-base font-semibold tracking-tight text-stone-900"
              style={{
                fontFamily: "var(--font-display), ui-serif, Georgia, serif",
              }}
            >
              ATS check
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Heuristic score vs your job description — no AI calls.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-stone-600 transition hover:bg-accent-soft/80 hover:text-stone-900"
          >
            Close
          </button>
        </div>

        <div className="scrollbar-tailor flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--border-muted)] bg-accent-soft/25 px-4 py-4">
            <ScoreRing score={result.score} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className={`text-sm font-semibold ${tone.ring}`}>{tone.label}</p>
              <p className="text-xs leading-relaxed text-stone-600">
                Keyword overlap, structure, bullets, and contact fields are
                weighted. Use suggestions to tighten your draft — then re-run
                this check.
              </p>
              {applicable.length > 0 ? (
                <button
                  type="button"
                  onClick={() => void handleApplyAll()}
                  disabled={applyAllBusy}
                  className="mt-2 inline-flex min-h-10 items-center justify-center rounded-xl bg-accent-strong px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-pressed disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {applyAllBusy ? "Applying…" : `Apply all (${applicable.length})`}
                </button>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
              Breakdown
            </p>
            <div className="space-y-3 rounded-2xl border border-[var(--border-muted)] bg-[var(--paper)]/60 p-4">
              <BreakdownBar
                label="Keywords (vs posting)"
                score={result.breakdown.keywords.score}
                max={result.breakdown.keywords.max}
              />
              <BreakdownBar
                label="Sections"
                score={result.breakdown.sections.score}
                max={result.breakdown.sections.max}
              />
              <BreakdownBar
                label="Contact"
                score={result.breakdown.contact.score}
                max={result.breakdown.contact.max}
              />
              <BreakdownBar
                label="Bullet quality"
                score={result.breakdown.bullets.score}
                max={result.breakdown.bullets.max}
              />
              <BreakdownBar
                label="Skills density"
                score={result.breakdown.skillsDensity.score}
                max={result.breakdown.skillsDensity.max}
              />
            </div>
          </div>

          <div className="space-y-2 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-600">
              Suggestions
            </p>
            {result.suggestions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border-muted)] bg-accent-soft/20 px-4 py-8 text-center text-sm text-stone-500">
                Nothing flagged — great baseline.
              </p>
            ) : (
              <ul className="space-y-2">
                {result.suggestions.map((s) => {
                  const done = appliedIds.has(s.id);
                  return (
                    <li
                      key={s.id}
                      className={`rounded-xl border px-3 py-3 sm:px-4 ${severityClasses(s.severity)} ${done ? "opacity-80 ring-1 ring-emerald-300/60" : ""}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-snug">
                          {s.title}
                        </p>
                        <span className="shrink-0 text-[0.65rem] font-bold uppercase tracking-wider text-stone-600">
                          {s.severity}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed opacity-95">
                        {s.description}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {s.canApply && s.apply ? (
                          <button
                            type="button"
                            disabled={done || applyingId === s.id}
                            onClick={() => handleApply(s)}
                            className="inline-flex min-h-9 items-center justify-center rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {done
                              ? "Applied"
                              : applyingId === s.id
                                ? "Applying…"
                                : "Apply"}
                          </button>
                        ) : null}
                        {done ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800"
                            role="status"
                          >
                            <span aria-hidden>✓</span> Done
                          </span>
                        ) : null}
                        {!s.canApply ? (
                          <span className="text-[0.7rem] font-medium text-stone-600">
                            Edit manually in preview / source
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
