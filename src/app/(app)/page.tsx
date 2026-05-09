"use client";

import type { CSSProperties } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { UserMenu } from "@/components/user-menu";
import { generateResume } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { isValidEmailAddress } from "@/lib/auth-validation";
import type { PdfTemplate, Resume } from "@/lib/types";

const DEFAULT_SYSTEM_PROMPT = `You tailor resumes for specific roles. Output must be honest: every employer, date, degree, and metric must appear in the candidate's source material (or be fairly implied there, e.g. city from context). Rephrase for clarity and impact; do not fabricate.`;

const PRESET_ANTHROPIC_MODELS: { value: string; label: string }[] = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4 (2025-05-14)" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4 (2025-05-14)" },
  { value: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
];

const CUSTOM_MODEL_SENTINEL = "__custom__";
const PRESET_MODEL_IDS = new Set(PRESET_ANTHROPIC_MODELS.map((m) => m.value));

const TOKEN_SLIDER_MIN = 256;
const TOKEN_SLIDER_MAX = 8192;
const TOKEN_SLIDER_STEP = 256;

/** Space between the fixed drawer’s right edge and the Job description card (matches `lg:gap-x-4`). */
const DRAWER_JD_GAP_PX = 16;

const PDF_LAYOUT_OPTIONS: {
  id: PdfTemplate;
  title: string;
  description: string;
  stripClass: string;
  typeLabel: string;
}[] = [
  {
    id: "classic",
    title: "Classic",
    description: "Crisp sans-serif with a subtle teal accent on section titles — balanced and ATS-friendly.",
    stripClass: "bg-[#2d5a5f]",
    typeLabel: "Helvetica · accent headers",
  },
  {
    id: "minimal",
    title: "Minimal",
    description: "Extra breathing room, soft gray dividers, and restrained type — quiet and modern.",
    stripClass: "bg-stone-400",
    typeLabel: "Helvetica · airy spacing",
  },
  {
    id: "structured",
    title: "Structured",
    description: "Strong hierarchy with rules under each section and a bold masthead — easy to scan.",
    stripClass: "bg-stone-800",
    typeLabel: "Helvetica · rules & bands",
  },
  {
    id: "editorial",
    title: "Editorial",
    description: "Serif-forward typography for a traditional, boardroom-ready impression.",
    stripClass: "bg-amber-900/85",
    typeLabel: "Times · classic résumé",
  },
];

const OUTPUT_EFFORT_OPTIONS: { value: string; label: string }[] = [
  {
    value: "",
    label: "Default (API — omits effort, same as high)",
  },
  { value: "low", label: "Low — efficient; speed and cost" },
  { value: "medium", label: "Medium — balanced" },
  { value: "high", label: "High — explicit API level" },
  { value: "max", label: "Max — deepest capability (supported models)" },
  { value: "xhigh", label: "xhigh — extended horizon (Claude Opus 4.7)" },
];

const selectChevronStyle: CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236d5342'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
};

function downloadPdfBase64(filename: string, base64: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ResumePreview({ resume, compact }: { resume: Resume; compact?: boolean }) {
  const density = compact ? "space-y-5 text-[13px] leading-relaxed" : "space-y-8 text-[15px] leading-relaxed";
  return (
    <article className={`${density} text-stone-800`}>
      <header className={`space-y-1 border-b border-[var(--border-muted)] ${compact ? "pb-4" : "pb-6"}`}>
        <h2
          className={`${compact ? "text-2xl" : "text-3xl"} font-semibold tracking-tight text-stone-900`}
          style={{ fontFamily: "var(--font-display), ui-serif, Georgia, serif" }}
        >
          {resume.contact.name}
        </h2>
        {resume.target_title ? (
          <p className="text-sm font-semibold text-accent">{resume.target_title}</p>
        ) : null}
        <p className="text-sm text-stone-500">
          {[
            resume.contact.email,
            resume.contact.phone,
            resume.contact.location,
            resume.contact.linkedin,
            resume.contact.website,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>
      <section>
        <h3
          className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-accent"
          style={{ fontFamily: "var(--font-display), ui-serif, Georgia, serif" }}
        >
          Summary
        </h3>
        <p className="whitespace-pre-wrap text-stone-700">{resume.summary}</p>
      </section>
      <section>
        <h3
          className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-accent"
          style={{ fontFamily: "var(--font-display), ui-serif, Georgia, serif" }}
        >
          Skills
        </h3>
        <p className="text-stone-700">{resume.skills.join(" · ")}</p>
      </section>
      <section className="space-y-5">
        <h3
          className="text-xs font-bold uppercase tracking-[0.12em] text-accent"
          style={{ fontFamily: "var(--font-display), ui-serif, Georgia, serif" }}
        >
          Experience
        </h3>
        <ul className="space-y-5">
          {resume.experience.map((exp, i) => (
            <li key={`${exp.company}-${i}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-stone-900">
                  {exp.title} — {exp.company}
                  {exp.location ? ` (${exp.location})` : ""}
                </span>
                <span className="text-xs text-stone-500">{exp.dates}</span>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-stone-700">
                {exp.bullets.map((b, j) => (
                  <li key={j}>{b}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>
      {resume.education.length ? (
        <section className="space-y-3">
          <h3
            className="text-xs font-bold uppercase tracking-[0.12em] text-accent"
            style={{ fontFamily: "var(--font-display), ui-serif, Georgia, serif" }}
          >
            Education
          </h3>
          <ul className="space-y-3">
            {resume.education.map((ed, i) => (
              <li key={i}>
                <p className="font-semibold text-stone-900">
                  {ed.degree} — {ed.institution}
                </p>
                <p className="text-sm text-stone-500">
                  {[ed.dates, ed.details].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {resume.projects.length ? (
        <section className="space-y-3">
          <h3
            className="text-xs font-bold uppercase tracking-[0.12em] text-accent"
            style={{ fontFamily: "var(--font-display), ui-serif, Georgia, serif" }}
          >
            Projects
          </h3>
          <ul className="space-y-4">
            {resume.projects.map((p, i) => (
              <li key={i}>
                <p className="font-semibold text-stone-900">{p.name}</p>
                {p.description ? (
                  <p className="text-stone-700">{p.description}</p>
                ) : null}
                <ul className="mt-1 list-disc space-y-1 pl-5 text-stone-700">
                  {p.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}

export default function Home() {
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [jobDescription, setJobDescription] = useState("");
  const [sourceResume, setSourceResume] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [targetRole, setTargetRole] = useState("");

  const [anthropicModel, setAnthropicModel] = useState("claude-sonnet-4-6");
  const [anthropicMaxTokens, setAnthropicMaxTokens] = useState(6144);
  const [claudeOutputEffort, setClaudeOutputEffort] = useState("");
  const [pdfTemplate, setPdfTemplate] = useState<PdfTemplate>("classic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    resume: Resume;
    pdf_base64: string;
  } | null>(null);

  const jobDescriptionRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const drawerTextareaRef = useRef<HTMLTextAreaElement>(null);
  type EditorDrawer = "system" | "experience" | "pdfLayout";
  const [editorDrawer, setEditorDrawer] = useState<EditorDrawer | null>(null);
  const [drawerWidthPx, setDrawerWidthPx] = useState(320);

  const closeEditorDrawer = useCallback(() => setEditorDrawer(null), []);

  const measureDrawerWidth = useCallback(() => {
    const jd = jobDescriptionRef.current;
    if (!jd) return;
    const left = jd.getBoundingClientRect().left;
    setDrawerWidthPx(Math.max(0, Math.ceil(left) - DRAWER_JD_GAP_PX));
  }, []);

  useLayoutEffect(() => {
    measureDrawerWidth();
    const win = typeof window !== "undefined" ? window : null;
    win?.addEventListener("resize", measureDrawerWidth);
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => measureDrawerWidth())
        : null;
    const form = formRef.current;
    const jdEl = jobDescriptionRef.current;
    if (ro) {
      if (form) ro.observe(form);
      if (jdEl) ro.observe(jdEl);
    }
    return () => {
      win?.removeEventListener("resize", measureDrawerWidth);
      ro?.disconnect();
    };
  }, [measureDrawerWidth]);

  useLayoutEffect(() => {
    if (!editorDrawer) return;
    measureDrawerWidth();
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      measureDrawerWidth();
      raf2 = requestAnimationFrame(() => measureDrawerWidth());
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [editorDrawer, measureDrawerWidth]);

  useEffect(() => {
    if (!editorDrawer || editorDrawer === "pdfLayout") return;
    drawerTextareaRef.current?.focus({ preventScroll: true });
  }, [editorDrawer]);

  useEffect(() => {
    if (!editorDrawer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeEditorDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [editorDrawer, closeEditorDrawer]);

  const modelSelectValue = PRESET_MODEL_IDS.has(anthropicModel)
    ? anthropicModel
    : CUSTOM_MODEL_SENTINEL;

  const handlePresetModelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value;
      if (v === CUSTOM_MODEL_SENTINEL) {
        setAnthropicModel("");
      } else {
        setAnthropicModel(v);
      }
    },
    [],
  );

  const canSubmit = useMemo(() => {
    return (
      displayName.trim().length > 0 &&
      isValidEmailAddress(email) &&
      targetRole.trim().length > 0 &&
      systemPrompt.trim().length >= 10 &&
      jobDescription.trim().length >= 20 &&
      sourceResume.trim().length >= 20
    );
  }, [
    displayName,
    email,
    targetRole,
    systemPrompt,
    jobDescription,
    sourceResume,
  ]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!canSubmit) {
        setError(
          "Fill in display name, a valid email, target role, system prompt, job description, and your experience before generating.",
        );
        return;
      }
      setLoading(true);
      try {
        const res = await generateResume({
          system_prompt: systemPrompt,
          job_description: jobDescription,
          source_resume: sourceResume,
          display_name: displayName.trim(),
          email: email.trim(),
          ...(phone.trim() && { phone: phone.trim() }),
          target_role: targetRole.trim(),
          ...(anthropicModel.trim() && {
            anthropic_model: anthropicModel.trim(),
          }),
          ...(Number.isFinite(anthropicMaxTokens) && {
            anthropic_max_tokens: anthropicMaxTokens,
          }),
          ...(claudeOutputEffort.trim() && {
            claude_output_effort: claudeOutputEffort.trim(),
          }),
          pdf_template: pdfTemplate,
        });
        setResult(res);

        const supabase = createClient();
        const {
          data: { user: u },
        } = await supabase.auth.getUser();
        if (u) {
          const m = res.generation_meta;
          const { error: logErr } = await supabase.from("generation_logs").insert({
            user_id: u.id,
            user_email: u.email ?? null,
            system_prompt: systemPrompt,
            job_description: jobDescription,
            source_resume: sourceResume,
            display_name: displayName.trim(),
            target_role: targetRole.trim(),
            phone: phone.trim() || null,
            pdf_template: pdfTemplate,
            anthropic_model: m.resolved_model,
            anthropic_max_tokens: m.max_tokens,
            claude_output_effort: claudeOutputEffort.trim() || null,
            input_tokens: m.input_tokens,
            output_tokens: m.output_tokens,
            cache_creation_input_tokens: m.cache_creation_input_tokens,
            cache_read_input_tokens: m.cache_read_input_tokens,
            estimated_cost_usd: m.estimated_cost_usd,
            api_key_source: m.api_key_source,
          });
          if (logErr) console.error("generation_logs insert failed:", logErr.message);
        }
      } catch (err) {
        setResult(null);
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    },
    [
      canSubmit,
      systemPrompt,
      jobDescription,
      sourceResume,
      displayName,
      email,
      phone,
      targetRole,
      anthropicModel,
      anthropicMaxTokens,
      claudeOutputEffort,
      pdfTemplate,
    ],
  );

  const handleDownload = useCallback(() => {
    if (!result) return;
    const safeName = result.resume.contact.name
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60);
    downloadPdfBase64(`${safeName || "resume"}-tailored.pdf`, result.pdf_base64);
  }, [result]);

  const cardChrome =
    "rounded-2xl border border-[var(--border-muted)] bg-[var(--card)] shadow-[0_8px_28px_var(--shadow-soft)]";
  const panel = `${cardChrome} p-3 sm:p-4`;
  const fieldFill =
    "bg-[color:color-mix(in_srgb,var(--card)_58%,var(--paper))]";
  const textareaBase =
    `w-full resize-y rounded-xl border border-[var(--border-muted)] ${fieldFill} scrollbar-tailor px-3 py-2 text-sm text-stone-800 shadow-inner outline-none ring-accent/20 transition placeholder:text-stone-500 focus:border-accent focus:ring-2 focus:ring-accent/25`;
  const textareaFill = `${textareaBase} flex-1 min-h-[6rem] lg:h-full lg:min-h-0 lg:resize-y`;
  const textareaDrawer = `${textareaBase} min-h-0 flex-1 resize-y leading-relaxed`;
  const fieldControl =
    `min-h-11 w-full rounded-lg border border-[var(--border-muted)] ${fieldFill} px-3 py-2 text-sm text-stone-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent/25`;

  const drawerPanelWidthStyle: CSSProperties =
    drawerWidthPx > 120
      ? { width: drawerWidthPx }
      : { width: "min(calc(100vw - 1.5rem), 28rem)" };

  const aboveDrawerBackdrop = editorDrawer ? "relative z-[41]" : "";

  return (
    <div className="relative flex min-h-screen flex-col lg:h-[100dvh] lg:min-h-[100dvh] lg:overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-accent-soft/55 to-transparent lg:h-32"
      />
      <div className="relative flex min-h-0 flex-1 flex-col px-4 pb-10 pt-8 sm:px-6 lg:max-w-[90rem] lg:min-h-0 lg:max-h-full lg:flex-1 lg:px-6 lg:pb-4 lg:pt-4 xl:mx-auto xl:w-full xl:px-8">
        <header className="mb-5 shrink-0 lg:mb-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent sm:text-sm">
                Resume tailor
              </p>
              <span className="hidden text-stone-300 sm:inline" aria-hidden>
                ·
              </span>
            </div>
            <UserMenu />
          </div>
          <h1
            className="mt-2 max-w-3xl text-2xl font-semibold tracking-tight text-stone-900 sm:text-3xl lg:text-2xl xl:text-[1.65rem]"
            style={{ fontFamily: "var(--font-display), ui-serif, Georgia, serif" }}
          >
            Match your story to the role
          </h1>
        </header>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:min-h-0 lg:grid-cols-[minmax(10rem,0.72fr)_minmax(14rem,1fr)_minmax(18rem,1.48fr)] lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:[grid-template-areas:'opt_jd_preview'_'adv_jd_preview'_'rail_jd_preview'] lg:gap-x-4 lg:gap-y-3"
        >
          <fieldset
            aria-label="Resume header: display name, email, optional phone, and target role (required fields marked)"
            className={`${panel} space-y-3 lg:order-none`}
            style={{ gridArea: "opt" }}
          >
            <div className="flex flex-col gap-3">
              <div>
                <label
                  htmlFor="name"
                  className="mb-0.5 block text-sm font-medium text-stone-600"
                >
                  Display name{" "}
                  <span className="font-semibold text-accent-pressed">*</span>
                </label>
                <input
                  id="name"
                  required
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={fieldControl}
                  aria-required="true"
                />
              </div>
              <div>
                <label
                  htmlFor="mail"
                  className="mb-0.5 block text-sm font-medium text-stone-600"
                >
                  Email{" "}
                  <span className="font-semibold text-accent-pressed">*</span>
                </label>
                <input
                  id="mail"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldControl}
                  aria-required="true"
                />
              </div>
              <div>
                <label
                  htmlFor="phone"
                  className="mb-0.5 block text-sm font-medium text-stone-600"
                >
                  Phone <span className="font-normal text-stone-500">(optional)</span>
                </label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={fieldControl}
                  placeholder="e.g. +1 555 123 4567"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="role"
                className="mb-0.5 block text-sm font-medium text-stone-600"
              >
                Target role title{" "}
                <span className="font-semibold text-accent-pressed">*</span>
              </label>
              <input
                id="role"
                required
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className={fieldControl}
                placeholder="e.g. Senior Product Engineer"
                aria-required="true"
              />
            </div>
          </fieldset>

          <div
            className="flex min-h-0 flex-col gap-3 lg:order-none"
            style={{ gridArea: "adv" }}
          >
            <details open className={`${panel} group`}>
              <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wider text-stone-600 sm:text-sm [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  Advanced
                  <span className="font-normal normal-case text-stone-400">
                    (model, tokens, effort)
                  </span>
                </span>
              </summary>
              <div className="mt-3 space-y-3 pt-0.5">
                <div>
                  <label
                    htmlFor="model-preset"
                    className="mb-0.5 block text-sm font-medium text-stone-600"
                  >
                    Anthropic model
                  </label>
                  <select
                    id="model-preset"
                    value={modelSelectValue}
                    onChange={handlePresetModelChange}
                    className={`${fieldControl} appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-9`}
                    style={selectChevronStyle}
                  >
                    {PRESET_ANTHROPIC_MODELS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                    <option value={CUSTOM_MODEL_SENTINEL}>Custom model ID…</option>
                  </select>
                  {modelSelectValue === CUSTOM_MODEL_SENTINEL ? (
                    <>
                      <label htmlFor="model-custom" className="sr-only">
                        Custom Anthropic model ID
                      </label>
                      <input
                        id="model-custom"
                        value={anthropicModel}
                        onChange={(e) => setAnthropicModel(e.target.value)}
                        className={`${fieldControl} mt-2`}
                        placeholder="Exact API model id"
                        autoComplete="off"
                      />
                    </>
                  ) : null}
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                    <label
                      htmlFor="max-tok"
                      className="text-sm font-medium text-stone-600"
                    >
                      Max output tokens
                    </label>
                    <span
                      className="font-mono text-sm tabular-nums text-stone-500"
                      aria-live="polite"
                    >
                      {anthropicMaxTokens.toLocaleString()}
                    </span>
                  </div>
                  <input
                    id="max-tok"
                    type="range"
                    min={TOKEN_SLIDER_MIN}
                    max={TOKEN_SLIDER_MAX}
                    step={TOKEN_SLIDER_STEP}
                    value={anthropicMaxTokens}
                    onChange={(e) =>
                      setAnthropicMaxTokens(Number(e.target.value))
                    }
                    className="h-2 w-full cursor-pointer accent-accent-strong disabled:cursor-not-allowed"
                  />
                  <div className="mt-1 flex justify-between text-xs text-stone-400">
                    <span>{TOKEN_SLIDER_MIN.toLocaleString()}</span>
                    <span>{TOKEN_SLIDER_MAX.toLocaleString()}</span>
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="effort"
                    className="mb-0.5 block text-sm font-medium text-stone-600"
                  >
                    Output effort
                  </label>
                  <select
                    id="effort"
                    value={claudeOutputEffort}
                    onChange={(e) => setClaudeOutputEffort(e.target.value)}
                    className={`${fieldControl} appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-9`}
                    style={selectChevronStyle}
                  >
                    {OUTPUT_EFFORT_OPTIONS.map((o) => (
                      <option key={o.value || "default"} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </details>
            {error ? (
              <p
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </div>

          <div
            className={`${cardChrome} flex min-h-[10rem] flex-col items-center justify-center gap-2.5 px-4 py-8 lg:order-none lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:px-3 lg:py-6`}
            style={{ gridArea: "rail" }}
          >
            <div className="flex w-full max-w-xs flex-col gap-2.5 lg:max-w-[11.5rem]">
              <button
                type="button"
                onClick={() => setEditorDrawer("system")}
                className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--border-muted)] ${fieldFill} px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-sm transition hover:border-accent hover:bg-accent-soft/70 hover:text-accent-pressed`}
              >
                System prompt
              </button>
              <button
                type="button"
                onClick={() => setEditorDrawer("experience")}
                className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--border-muted)] ${fieldFill} px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-sm transition hover:border-accent hover:bg-accent-soft/70 hover:text-accent-pressed`}
              >
                Your experience / current resume
              </button>
              <button
                type="button"
                onClick={() => setEditorDrawer("pdfLayout")}
                className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--border-muted)] ${fieldFill} px-4 py-2.5 text-sm font-semibold text-stone-800 shadow-sm transition hover:border-accent hover:bg-accent-soft/70 hover:text-accent-pressed`}
              >
                PDF layout
              </button>
            </div>
          </div>

          <div
            ref={jobDescriptionRef}
            className={`${panel} flex min-h-[12rem] flex-1 flex-col lg:order-none lg:h-full lg:min-h-0 lg:overflow-hidden ${aboveDrawerBackdrop}`}
            style={{ gridArea: "jd" }}
          >
            <div className="mb-1 flex shrink-0 flex-wrap items-center justify-between gap-2">
              <label
                htmlFor="jd"
                className="text-base font-semibold text-stone-700"
              >
                Job description
              </label>
              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="inline-flex min-h-9 items-center justify-center rounded-lg bg-accent-strong px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-pressed disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              >
                {loading ? "Generating…" : "Generate"}
              </button>
            </div>
            <textarea
              id="jd"
              required
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className={textareaFill}
              placeholder="Paste the full posting or the parts that matter."
            />
          </div>

          <section
            className={`${cardChrome} order-8 flex min-h-[16rem] flex-1 flex-col overflow-hidden p-0 sm:min-h-[18rem] lg:order-none lg:h-full lg:min-h-0 ${aboveDrawerBackdrop}`}
            style={{ gridArea: "preview" }}
          >
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border-muted)] px-3 py-2.5 sm:px-4">
              <h2
                className="text-base font-semibold text-stone-900 sm:text-lg"
                style={{ fontFamily: "var(--font-display), ui-serif, Georgia, serif" }}
              >
                Preview
              </h2>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {result ? (
                  <>
                    <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-400">
                      PDF:{" "}
                      {PDF_LAYOUT_OPTIONS.find((o) => o.id === pdfTemplate)?.title ??
                        pdfTemplate}
                    </span>
                    <button
                      type="button"
                      onClick={handleDownload}
                      className={`inline-flex min-h-9 items-center justify-center rounded-lg border border-[var(--border-muted)] ${fieldFill} px-4 py-2 text-xs font-semibold text-stone-800 shadow-sm transition hover:border-accent hover:text-accent-pressed sm:text-sm`}
                    >
                      Download PDF
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="scrollbar-tailor min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
              {!result ? (
                <div className="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-muted)] bg-accent-soft/35 px-4 py-10 text-center lg:min-h-[8rem]">
                  <p className="max-w-[18rem] text-sm text-stone-500">
                    Your tailored resume appears here after generation. Nothing is
                    stored on our servers in this version.
                  </p>
                </div>
              ) : (
                <ResumePreview resume={result.resume} compact />
              )}
            </div>
          </section>

          {editorDrawer ? (
            <>
              <div
                role="presentation"
                aria-hidden
                className="fixed inset-0 z-40 bg-stone-900/25 backdrop-blur-[1px]"
                onClick={closeEditorDrawer}
              />
              <div
                role="dialog"
                aria-modal={false}
                aria-labelledby="editor-drawer-title"
                aria-describedby="editor-drawer-desc"
                className="fixed left-0 top-0 z-50 flex h-[100dvh] flex-col border-r border-[var(--border-muted)] bg-[var(--card)] shadow-[8px_0_32px_var(--shadow-soft)]"
                style={drawerPanelWidthStyle}
              >
                <p id="editor-drawer-desc" className="sr-only">
                  Job description, preview, Generate (job description header), and Download
                  PDF (preview header) stay usable while this panel is open. PDF layout
                  choices apply to the next generated export.
                </p>
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-muted)] px-4 py-3 sm:px-5">
                  <h2
                    id="editor-drawer-title"
                    className="pr-6 text-base font-semibold tracking-tight text-stone-900"
                    style={{
                      fontFamily: "var(--font-display), ui-serif, Georgia, serif",
                    }}
                  >
                    {editorDrawer === "system"
                      ? "System prompt"
                      : editorDrawer === "experience"
                        ? "Your experience / current resume"
                        : "PDF layout"}
                  </h2>
                  <button
                    type="button"
                    onClick={closeEditorDrawer}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-stone-600 transition hover:bg-accent-soft/80 hover:text-stone-900"
                  >
                    Close
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 pb-4 pt-3 sm:px-5">
                  {editorDrawer === "pdfLayout" ? (
                    <p className="text-xs text-stone-500">
                      Pick a typesetting style for the file you download. Run{" "}
                      <span className="font-medium text-stone-600">Generate</span> again to
                      rebuild the PDF after switching.
                    </p>
                  ) : editorDrawer === "experience" ? (
                    <p className="text-xs text-stone-500">
                      Paste roles, dates, and impact—we only rephrase what you provide.
                      <span className="font-medium text-stone-600"> Required </span>
                      for generation (with display name, email, optional phone, and target role in the
                      header).
                    </p>
                  ) : (
                    <p className="text-xs text-stone-500">
                      Rules for how the assistant tailors your resume for each posting.
                    </p>
                  )}
                  {editorDrawer === "system" ? (
                    <textarea
                      ref={drawerTextareaRef}
                      id="sys"
                      value={systemPrompt}
                      onChange={(e) => setSystemPrompt(e.target.value)}
                      className={textareaDrawer}
                      placeholder="Tailoring rules…"
                      autoComplete="off"
                    />
                  ) : editorDrawer === "experience" ? (
                    <textarea
                      ref={drawerTextareaRef}
                      id="src"
                      value={sourceResume}
                      onChange={(e) => setSourceResume(e.target.value)}
                      className={textareaDrawer}
                      placeholder="Roles, dates, impact, skills—everything we must not invent."
                      autoComplete="off"
                    />
                  ) : (
                    <div
                      role="radiogroup"
                      aria-label="PDF export layout"
                      className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pb-0.5"
                    >
                      {PDF_LAYOUT_OPTIONS.map((opt) => {
                        const selected = pdfTemplate === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setPdfTemplate(opt.id)}
                            className={
                              `shrink-0 rounded-xl border px-3.5 py-3 text-left shadow-sm outline-none transition ` +
                              (selected
                                ? "border-accent bg-accent-soft/45 ring-2 ring-accent/25"
                                : `border-[var(--border-muted)] ${fieldFill} hover:border-accent/55 hover:bg-accent-soft/30`)
                            }
                          >
                            <div className="flex gap-3">
                              <span
                                className={`mt-0.5 w-1 shrink-0 self-stretch rounded-full ${opt.stripClass}`}
                                aria-hidden
                              />
                              <div className="min-w-0 space-y-1">
                                <p className="text-sm font-semibold text-stone-900">
                                  {opt.title}
                                </p>
                                <p className="text-xs leading-relaxed text-stone-600">
                                  {opt.description}
                                </p>
                                <p className="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                                  {opt.typeLabel}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </form>
      </div>
    </div>
  );
}
