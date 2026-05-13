"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ATSResult, ATSSuggestion } from "@/lib/ats-engine";
import {
  displayTitleStyle,
  uiFieldHint,
  uiPanelTitle,
  uiSectionEyebrow,
} from "@/lib/ui-classes";

type Props = {
  result: ATSResult;
  onClose: () => void;
  onApply: (suggestion: ATSSuggestion) => void;
  onApplyAll: () => void;
  onUpgrade: () => void;
  upgradeBusy?: boolean;
  /** `overlay` = fixed right drawer + backdrop (default). `inline` = column beside preview, no backdrop. */
  variant?: "overlay" | "inline";
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

function strictnessLabel(value: ATSResult["platform"]["strictness"]): string {
  if (value === "very_strict") return "Very strict";
  if (value === "strict") return "Strict";
  return "Standard";
}

function suggestionGroupLabel(category: ATSSuggestion["category"]): string {
  if (
    category === "requirements" ||
    category === "alignment" ||
    category === "keywords"
  ) {
    return "High-impact";
  }
  if (category === "parser" || category === "contact" || category === "sections") {
    return "Parser safety";
  }
  return "Polish";
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

export function AtsPanel({
  result,
  onClose,
  onApply,
  onApplyAll,
  onUpgrade,
  upgradeBusy = false,
  variant = "overlay",
}: Props) {
  const applicable = useMemo(
    () => result.suggestions.filter((s) => s.canApply && s.apply),
    [result.suggestions],
  );
  const groupedSuggestions = useMemo(() => {
    const groups = new Map<string, ATSSuggestion[]>();
    for (const suggestion of result.suggestions) {
      const label = suggestionGroupLabel(suggestion.category);
      const current = groups.get(label) ?? [];
      current.push(suggestion);
      groups.set(label, current);
    }
    return ["High-impact", "Parser safety", "Polish"]
      .map((label) => ({ label, items: groups.get(label) ?? [] }))
      .filter((group) => group.items.length > 0);
  }, [result.suggestions]);

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

  const shell = (
    <div
      role="dialog"
      aria-modal={variant === "overlay"}
      aria-labelledby="ats-panel-title"
      className={
        variant === "overlay"
          ? "fixed right-0 top-0 z-50 flex h-[100dvh] w-[min(calc(100vw-1.5rem),28rem)] flex-col border-l border-[var(--border-muted)] bg-[var(--card)] shadow-[-8px_0_32px_var(--shadow-soft)]"
          : "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border-muted)] bg-[var(--card)] shadow-[0_8px_28px_var(--shadow-soft)]"
      }
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-muted)] px-4 py-3 sm:px-5">
        <div className="min-w-0 pr-2">
          <h2
            id="ats-panel-title"
            className={uiPanelTitle}
            style={displayTitleStyle}
          >
            Enterprise ATS simulation
          </h2>
          <p className={`mt-0.5 ${uiFieldHint}`}>
            Platform-aware match, parser safety, and recruiter-readiness signals.
          </p>
        </div>
        <button
          type="button"
          onClick={onUpgrade}
          disabled={upgradeBusy}
          className="shrink-0 rounded-lg bg-accent-strong px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-pressed disabled:cursor-not-allowed disabled:opacity-60"
        >
          {upgradeBusy ? "Upgrading..." : "Upgrade"}
        </button>
      </div>

      <div className="scrollbar-tailor flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-[var(--border-muted)] bg-accent-soft/25 px-4 py-4">
          <ScoreRing score={result.score} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className={`text-sm font-semibold ${tone.ring}`}>{tone.label}</p>
            <p className={uiFieldHint}>
              Weighted against enterprise ATS behavior: must-have coverage,
              exact searchable terms, parser safety, and evidence quality.
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border-muted)] bg-[var(--paper)]/70 p-4">
            <p className={uiSectionEyebrow}>Likely ATS</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold text-stone-900">
                {result.platform.label}
              </span>
              <span className="rounded-full border border-[var(--border-muted)] bg-white/70 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-stone-600">
                {strictnessLabel(result.platform.strictness)}
              </span>
              <span className="rounded-full bg-accent-soft/70 px-2.5 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-accent-pressed">
                {result.platform.confidence} confidence
              </span>
            </div>
            <p className={`mt-2 ${uiFieldHint}`}>{result.platform.note}</p>
          </div>

          <div className="rounded-2xl border border-[var(--border-muted)] bg-[var(--paper)]/70 p-4">
            <p className={uiSectionEyebrow}>Why this score</p>
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-stone-600">
              {result.topReasons.map((reason) => (
                <li key={reason}>- {reason}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <p className={uiSectionEyebrow}>Breakdown</p>
          <div className="space-y-3 rounded-2xl border border-[var(--border-muted)] bg-[var(--paper)]/60 p-4">
            <BreakdownBar
              label="Requirement fit"
              score={result.breakdown.requirements.score}
              max={result.breakdown.requirements.max}
            />
            <BreakdownBar
              label="Exact ATS keywords"
              score={result.breakdown.exactKeywords.score}
              max={result.breakdown.exactKeywords.max}
            />
            <BreakdownBar
              label="Title and summary"
              score={result.breakdown.titleSummary.score}
              max={result.breakdown.titleSummary.max}
            />
            <BreakdownBar
              label="Parser safety"
              score={result.breakdown.parserSafety.score}
              max={result.breakdown.parserSafety.max}
            />
            <BreakdownBar
              label="Evidence depth"
              score={result.breakdown.evidence.score}
              max={result.breakdown.evidence.max}
            />
            <BreakdownBar
              label="Impact quality"
              score={result.breakdown.impact.score}
              max={result.breakdown.impact.max}
            />
          </div>
        </div>

        {result.requirementGroups.length > 0 ? (
          <div className="space-y-3">
            <p className={uiSectionEyebrow}>Requirement coverage</p>
            <div className="space-y-2 rounded-2xl border border-[var(--border-muted)] bg-[var(--paper)]/60 p-4">
              {result.requirementGroups.map((group) => {
                const covered = group.matched.length;
                const pct = group.total
                  ? Math.round((covered / group.total) * 100)
                  : 0;
                return (
                  <div key={group.id} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-semibold text-stone-700">
                        {group.label}
                      </span>
                      <span className="font-mono text-stone-500">
                        {covered}/{group.total} ({pct}%)
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-stone-500">
                      {group.missing.length
                        ? `Missing: ${group.missing.slice(0, 5).join(", ")}`
                        : `Matched: ${group.matched.slice(0, 5).join(", ")}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}


        <div className="space-y-2 pb-2">
          <p className={uiSectionEyebrow}>Suggestions</p>
          {result.suggestions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[var(--border-muted)] bg-accent-soft/20 px-4 py-8 text-center text-sm text-stone-500">
              Nothing flagged — great baseline.
            </p>
          ) : (
            <div className="space-y-4">
              {groupedSuggestions.map((group) => (
                <div key={group.label} className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                    {group.label}
                  </p>
                  <ul className="space-y-2">
                    {group.items.map((s) => {
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (variant === "overlay") {
    return (
      <>
        <div
          role="presentation"
          aria-hidden
          className="fixed inset-0 z-40 bg-stone-900/25 backdrop-blur-[1px]"
          onClick={onClose}
        />
        {shell}
      </>
    );
  }

  return shell;
}
