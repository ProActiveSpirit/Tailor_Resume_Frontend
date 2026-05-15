"use client";

import type {
  CSSProperties,
  ChangeEvent,
  Dispatch,
  FormEvent,
  MutableRefObject,
  ReactNode,
  SetStateAction,
} from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AtsPanel } from "@/components/ats-panel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserMenu } from "@/components/user-menu";
import { computeATS, type ATSResult, type ATSSuggestion } from "@/lib/ats-engine";
import {
  generateCoverLetter,
  generateResume,
  type GeneratePayload,
  type LlmProvider,
  type PdfTemplate,
} from "@/lib/api";
import {
  generateCoverLetterViaPuter,
  generateResumeViaPuter,
} from "@/lib/puter-resume";
import { createClient } from "@/lib/supabase/client";
import {
  isValidEmailAddress,
  isValidOptionalHttpUrl,
} from "@/lib/auth-validation";
import { formatResumeDateRange } from "@/lib/resume-date-format";
import type { GenerateResumeResponse, GenerationMeta, Resume } from "@/lib/types";
import { contactLines } from "@/lib/resume-contact-lines";
import {
  type TailorInitialProfile,
  TAILOR_PROFILE_DB_COLUMNS,
} from "@/lib/tailor-initial-profile";
import {
  displayTitleStyle,
  uiCompactLabel,
  uiFieldHint,
  uiFieldLabel,
  uiHintEmphasis,
  uiResumeContactMeta,
  uiResumePreviewSectionTitle,
  uiSectionEyebrow,
} from "@/lib/ui-classes";

type TailorResultState = GenerateResumeResponse | null;
type PresetSelectChange = ChangeEvent<HTMLSelectElement>;
type FormRef = MutableRefObject<HTMLFormElement | null>;

const TAILOR_WORKSHOP_LAST_EDITOR_KEY = "tailor-workshop-last-editor";

function readLastWorkshopEditor(): "system" | "experience" {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.sessionStorage.getItem(TAILOR_WORKSHOP_LAST_EDITOR_KEY);
    return v === "experience" ? "experience" : "system";
  } catch {
    return "system";
  }
}

const SYSTEM_PROMPT_SOFT_WARN_CHARS = 12_000;

const DEFAULT_SYSTEM_PROMPT = `You are an expert ATS resume strategist. Tailor the resume to the target job using only truthful facts from the candidate source material. Preserve every distinct employer/role and employment date. Set a clear target title from the job title or closest truthful supported variant. Put the strongest supported must-have phrases in the first summary sentence, order 8-18 skills by exact job-description must-haves first, and weave supported requirements into experience evidence. For each experience entry, write exactly 3 concise bullets: one role-alignment bullet, one measurable impact bullet when evidence exists, and one tools/process/leadership bullet matched to the job description. Mirror important job-description keywords naturally in the target title, summary, skills, and bullets, but never fabricate, exaggerate, or keyword-stuff. Keep the resume recruiter-readable, ATS-safe, and focused on strongest supported evidence.`;

function buildAtsUpgradeSystemPrompt(
  basePrompt: string,
  ats: ATSResult,
): string {
  const missingByGroup = ats.requirementGroups
    .filter((group) => group.missing.length > 0)
    .map(
      (group) =>
        `- ${group.label}: ${group.missing.slice(0, 8).join(", ")}`,
    )
    .slice(0, 5);
  const prioritySuggestions = ats.suggestions
    .filter((s) => s.severity === "high" || s.severity === "medium")
    .slice(0, 10)
    .map((s) => `- ${s.title}: ${s.description}`);

  return `${basePrompt.trim()}

ATS upgrade request:
- Regenerate the resume to improve the enterprise ATS simulation score while preserving truthfulness and recruiter readability.
- Current ATS profile: ${ats.platform.label} (${ats.platform.strictness.replace("_", " ")}).
- Current score: ${ats.score}/100.
- Score reasons:
${ats.topReasons.map((reason) => `  - ${reason}`).join("\n") || "  - No specific score reasons."}
- Missing or weak requirement coverage:
${missingByGroup.length ? missingByGroup.join("\n") : "- No major missing requirement groups."}
- Priority fixes:
${prioritySuggestions.length ? prioritySuggestions.join("\n") : "- Keep the resume concise, clear, and ATS-readable."}

Upgrade instructions:
- Set target_title to the exact job title or closest truthful supported variant.
- Rewrite the first summary sentence to include the target role and the strongest supported must-have phrases.
- Reorder skills to 8-18 concise items, placing exact supported must-have terms first.
- Rewrite experience bullets so supported must-have requirements appear as evidence inside bullets, not only as skills.
- Use strong action verbs and truthful metrics when present in the source; if no numbers exist, use truthful scope without inventing metrics.

Apply these findings by improving the target title, summary, skills, and experience bullets where the candidate source material supports it. Do not invent claims, do not add unsupported skills, and do not keyword-stuff. Use exact job-description terminology only when it is truthful and supported by the candidate facts.`;
}

function initialSystemPromptFromProfile(
  row: TailorInitialProfile | null,
): string {
  return typeof row?.system_prompt === "string" && row.system_prompt.trim()
    ? row.system_prompt.trim()
    : DEFAULT_SYSTEM_PROMPT;
}

function initialSourceResumeFromProfile(row: TailorInitialProfile | null): string {
  return typeof row?.source_resume === "string" &&
    row.source_resume.trim()
    ? row.source_resume.trim()
    : "";
}

const DEFAULT_LLM_PROVIDER: LlmProvider = "openai";
const DEFAULT_LLM_MODEL = "gpt-4.1";
const ANTHROPIC_DEFAULT_LLM_MODEL = "claude-sonnet-4-6";

const PRESET_MODELS: { provider: LlmProvider; value: string; label: string }[] =
  [
    {
      provider: "openai",
      value: "gpt-4.1",
      label: "OpenAI GPT-4.1",
    },
    {
      provider: "anthropic",
      value: ANTHROPIC_DEFAULT_LLM_MODEL,
      label: "Claude Sonnet-4-6",
    },
    {
      provider: "anthropic",
      value: "claude-opus-4-6-fast",
      label: "Claude Opus-4-6-fast",
    },
  ];

function presetCompositeKey(provider: LlmProvider, value: string): string {
  return `${provider}:${value}`;
}

function initialLlmProviderFromRow(row: TailorInitialProfile | null): LlmProvider {
  const p = row?.llm_provider;
  return p === "openai" || p === "anthropic" ? p : DEFAULT_LLM_PROVIDER;
}

function initialLlmModelFromRow(
  row: TailorInitialProfile | null,
  provider: LlmProvider,
): string {
  const raw = typeof row?.llm_model === "string" ? row.llm_model.trim() : "";
  if (raw && PRESET_MODELS.some((m) => m.provider === provider && m.value === raw))
    return raw;
  if (provider === "openai") return DEFAULT_LLM_MODEL;
  return ANTHROPIC_DEFAULT_LLM_MODEL;
}

const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

const PDF_TEMPLATES = ["classic", "minimal", "structured", "editorial"] as const;

function isPdfTemplate(value: string): value is PdfTemplate {
  return (PDF_TEMPLATES as readonly string[]).includes(value);
}

function isValidPublicJobUrl(raw: string): boolean {
  const s = raw.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const SESSION_EXPIRED_DETAIL = "Your session expired. Please sign in again.";

class SessionExpiredError extends Error {
  constructor(message = SESSION_EXPIRED_DETAIL) {
    super(message);
    this.name = "SessionExpiredError";
  }
}

async function parseApiDetail(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === "string" && j.detail.trim()) return j.detail.trim();
  } catch {
    void 0;
  }
  return text.trim() || res.statusText || `Request failed (${res.status})`;
}

async function persistGenerationRecord(
  generation: GeneratePayload,
  generationMeta: GenerationMeta,
  options: { persistProfile: boolean },
): Promise<void> {
  const res = await fetch("/api/generation-record", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generation,
      generation_meta: generationMeta,
      persist_profile: options.persistProfile,
    }),
  });

  if (res.ok) return;

  const detail = await parseApiDetail(res);
  if (res.status === 401) {
    throw new SessionExpiredError(detail);
  }
  console.error("generation record persist failed:", detail);
}

type ApplyTailorProfileRowSetters = {
  setDisplayName: Dispatch<SetStateAction<string>>;
  setEmail: Dispatch<SetStateAction<string>>;
  setPhone: Dispatch<SetStateAction<string>>;
  setAddress: Dispatch<SetStateAction<string>>;
  setLinkedin: Dispatch<SetStateAction<string>>;
  setSystemPrompt: Dispatch<SetStateAction<string>>;
  setSystemBaseline: Dispatch<SetStateAction<string>>;
  setSourceResume: Dispatch<SetStateAction<string>>;
  setExperienceBaseline: Dispatch<SetStateAction<string>>;
  setPdfTemplate: Dispatch<SetStateAction<PdfTemplate>>;
  setLlmProvider: Dispatch<SetStateAction<LlmProvider>>;
  setLlmModel: Dispatch<SetStateAction<string>>;
};

function applyTailorProfileRow(
  row: TailorInitialProfile | null,
  fallbackEmail: string | null,
  s: ApplyTailorProfileRowSetters,
): void {
  if (!row) {
    if (fallbackEmail) s.setEmail(fallbackEmail);
    return;
  }
  if (typeof row.display_name === "string" && row.display_name)
    s.setDisplayName(row.display_name);
  s.setEmail(
    typeof row.email === "string" && row.email.trim()
      ? row.email.trim()
      : fallbackEmail ?? "",
  );
  if (typeof row.phone === "string" && row.phone) s.setPhone(row.phone);
  if (typeof row.address === "string" && row.address) s.setAddress(row.address);
  if (typeof row.linkedin === "string" && row.linkedin) s.setLinkedin(row.linkedin);
  {
    const nextSys = initialSystemPromptFromProfile(row);
    const nextSrc = initialSourceResumeFromProfile(row);
    s.setSystemPrompt(nextSys);
    s.setSystemBaseline(nextSys);
    s.setSourceResume(nextSrc);
    s.setExperienceBaseline(nextSrc);
  }
  if (
    typeof row.pdf_template === "string" &&
    isPdfTemplate(row.pdf_template)
  )
    s.setPdfTemplate(row.pdf_template);
  const p = initialLlmProviderFromRow(row);
  s.setLlmProvider(p);
  s.setLlmModel(initialLlmModelFromRow(row, p));
}

const selectChevronStyle: CSSProperties = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236d5342'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
};

function workshopMobileChevron(open: boolean): ReactNode {
  return (
    <svg
      aria-hidden
      className={`h-5 w-5 shrink-0 text-stone-500 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function slugifyForFilename(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || "resume";
}

function localCalendarYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ResumePreview({ resume, compact }: { resume: Resume; compact?: boolean }) {
  const density = compact ? "space-y-5 text-[13px] leading-relaxed" : "space-y-8 text-[15px] leading-relaxed";
  return (
    <article className={`${density} text-stone-800`}>
      <header className={`space-y-1 border-b border-[var(--border-muted)] ${compact ? "pb-4" : "pb-6"}`}>
        <h2
          className={`${compact ? "text-2xl" : "text-3xl"} font-semibold tracking-tight text-stone-900`}
          style={displayTitleStyle}
        >
          {resume.contact.name}
        </h2>
        {resume.target_title ? (
          <p className="text-sm font-semibold text-accent">{resume.target_title}</p>
        ) : null}
        <div
          className={`flex flex-col gap-0.5 ${uiResumeContactMeta}`}
        >
          {contactLines(resume).map((line, i) => (
            <span key={i} className="block break-words">
              {line}
            </span>
          ))}
        </div>
      </header>
      <section>
        <h3
          className={uiResumePreviewSectionTitle}
          style={displayTitleStyle}
        >
          Summary
        </h3>
        <p className="whitespace-pre-wrap text-stone-700">{resume.summary}</p>
      </section>
      <section>
        <h3
          className={uiResumePreviewSectionTitle}
          style={displayTitleStyle}
        >
          Skills
        </h3>
        <p className="text-stone-700">{resume.skills.join(" · ")}</p>
      </section>
      <section className="space-y-5">
        <h3
          className={uiResumePreviewSectionTitle}
          style={displayTitleStyle}
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
                <span className="whitespace-nowrap text-xs text-stone-500">
                  {formatResumeDateRange(exp.dates)}
                </span>
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
            className={uiResumePreviewSectionTitle}
            style={displayTitleStyle}
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
            className={uiResumePreviewSectionTitle}
            style={displayTitleStyle}
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

type TailorHomeClientProps = {
  initialProfile: TailorInitialProfile | null;
  authEmail: string | null;
};

export function TailorHomeClient({
  initialProfile,
  authEmail,
}: TailorHomeClientProps) {
  const router = useRouter();
  const [systemPrompt, setSystemPrompt] = useState(() =>
    initialSystemPromptFromProfile(initialProfile),
  );
  const [systemBaseline, setSystemBaseline] = useState(() =>
    initialSystemPromptFromProfile(initialProfile),
  );
  const [jobLink, setJobLink] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [sourceResume, setSourceResume] = useState(() =>
    initialSourceResumeFromProfile(initialProfile),
  );
  const [experienceBaseline, setExperienceBaseline] = useState(() =>
    initialSourceResumeFromProfile(initialProfile),
  );
  const [displayName, setDisplayName] = useState(() =>
    typeof initialProfile?.display_name === "string" && initialProfile.display_name
      ? initialProfile.display_name
      : "",
  );
  const [email, setEmail] = useState(() =>
    typeof initialProfile?.email === "string" && initialProfile.email.trim()
      ? initialProfile.email.trim()
      : authEmail ?? "",
  );
  const [phone, setPhone] = useState(() =>
    typeof initialProfile?.phone === "string" && initialProfile.phone
      ? initialProfile.phone
      : "",
  );
  const [address, setAddress] = useState(() =>
    typeof initialProfile?.address === "string" && initialProfile.address
      ? initialProfile.address
      : "",
  );
  const [linkedin, setLinkedin] = useState(() =>
    typeof initialProfile?.linkedin === "string" && initialProfile.linkedin
      ? initialProfile.linkedin
      : "",
  );

  const [llmProvider, setLlmProvider] = useState<LlmProvider>(() =>
    initialLlmProviderFromRow(initialProfile),
  );
  const [llmModel, setLlmModel] = useState(() =>
    initialLlmModelFromRow(
      initialProfile,
      initialLlmProviderFromRow(initialProfile),
    ),
  );
  const [pdfTemplate, setPdfTemplate] = useState<PdfTemplate>(() => {
    const p = initialProfile?.pdf_template;
    return typeof p === "string" && isPdfTemplate(p) ? p : "classic";
  });
  const [usePuterFree, setUsePuterFree] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null as string | null);
  const [result, setResult] = useState(null as TailorResultState);
  const [systemPromptSavedAt, setSystemPromptSavedAt] = useState(
    null as number | null,
  );
  const [experienceSavedAt, setExperienceSavedAt] = useState(
    null as number | null,
  );
  const [savingTailoringRules, setSavingTailoringRules] = useState(false);
  const [savingExperienceDraft, setSavingExperienceDraft] = useState(false);

  const [mobileJobOpen, setMobileJobOpen] = useState(true);
  /** Match server first paint; session preference applied in useEffect after mount. */
  const [mobileSystemOpen, setMobileSystemOpen] = useState(true);
  const [mobileExperienceOpen, setMobileExperienceOpen] = useState(false);

  const [atsOpen, setAtsOpen] = useState(false);
  const [atsResult, setAtsResult] = useState(
    null as ReturnType<typeof computeATS> | null,
  );
  const [atsSessionKey, setAtsSessionKey] = useState(0);
  const [atsLoading, setAtsLoading] = useState(false);
  const [resumeUpgradeLoading, setResumeUpgradeLoading] = useState(false);

  const [coverLetter, setCoverLetter] = useState(null as string | null);
  const [coverLetterLoading, setCoverLetterLoading] = useState(false);

  const formRef = useRef(null) as FormRef;
  const sysTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const srcTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const serverSystemPromptSnapshot =
    initialProfile?.system_prompt === null ||
    typeof initialProfile?.system_prompt !== "string"
      ? null
      : initialProfile.system_prompt;
  const serverSourceResumeSnapshot =
    initialProfile?.source_resume === null ||
    typeof initialProfile?.source_resume !== "string"
      ? null
      : initialProfile.source_resume;

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- read sessionStorage after mount so SSR and first client paint match */
    const last = readLastWorkshopEditor();
    if (last === "experience") {
      setMobileSystemOpen(false);
      setMobileExperienceOpen(true);
    } else {
      setMobileSystemOpen(true);
      setMobileExperienceOpen(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    const row = {
      system_prompt: serverSystemPromptSnapshot,
      source_resume: serverSourceResumeSnapshot,
    } as TailorInitialProfile;
    const sys = initialSystemPromptFromProfile(row);
    const src = initialSourceResumeFromProfile(row);
    /* eslint-disable react-hooks/set-state-in-effect -- mirror DB columns when server snapshot changes after refresh/navigation */
    setSystemPrompt((prev) => (prev !== sys ? sys : prev));
    setSystemBaseline((prev) => (prev !== sys ? sys : prev));
    setSourceResume((prev) => (prev !== src ? src : prev));
    setExperienceBaseline((prev) => (prev !== src ? src : prev));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [serverSystemPromptSnapshot, serverSourceResumeSnapshot]);

  const systemDirty =
    systemPrompt.trim() !== systemBaseline;
  const experienceDirty =
    sourceResume.trim() !== experienceBaseline;

  const toggleMobileJob = useCallback(() => {
    setMobileJobOpen((v) => !v);
  }, []);

  const toggleMobileSystem = useCallback(() => {
    setMobileSystemOpen((prev) => {
      const next = !prev;
      if (next) {
        setMobileExperienceOpen(false);
        try {
          sessionStorage.setItem(TAILOR_WORKSHOP_LAST_EDITOR_KEY, "system");
        } catch {
          void 0;
        }
      }
      return next;
    });
  }, []);

  const toggleMobileExperience = useCallback(() => {
    setMobileExperienceOpen((prev) => {
      const next = !prev;
      if (next) {
        setMobileSystemOpen(false);
        try {
          sessionStorage.setItem(TAILOR_WORKSHOP_LAST_EDITOR_KEY, "experience");
        } catch {
          void 0;
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event !== "SIGNED_IN" || !session?.user) return;
        const u = session.user;
        try {
          const { data: row } = await supabase
            .from("profiles")
            .select(TAILOR_PROFILE_DB_COLUMNS)
            .eq("id", u.id)
            .maybeSingle();
          applyTailorProfileRow(
            (row ?? null) as TailorInitialProfile | null,
            u.email ?? null,
            {
              setDisplayName,
              setEmail,
              setPhone,
              setAddress,
              setLinkedin,
              setSystemPrompt,
              setSystemBaseline,
              setSourceResume,
              setExperienceBaseline,
              setPdfTemplate,
              setLlmProvider,
              setLlmModel,
            },
          );
        } catch {
          void 0;
        }
      },
    );
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async (): Promise<void> => {
      const supabase = createClient();
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u || cancelled) return;
      try {
        const { data: row } = await supabase
          .from("profiles")
          .select(TAILOR_PROFILE_DB_COLUMNS)
          .eq("id", u.id)
          .maybeSingle();
        if (cancelled) return;
        applyTailorProfileRow((row ?? null) as TailorInitialProfile | null, u.email ?? null, {
          setDisplayName,
          setEmail,
          setPhone,
          setAddress,
          setLinkedin,
          setSystemPrompt,
          setSystemBaseline,
          setSourceResume,
          setExperienceBaseline,
          setPdfTemplate,
          setLlmProvider,
          setLlmModel,
        });
      } catch {
        void 0;
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const modelSelectValue = presetCompositeKey(llmProvider, llmModel);

  const handlePresetModelChange = useCallback((e: PresetSelectChange) => {
    const v = e.target.value;
    const sep = v.indexOf(":");
    if (sep === -1) return;
    const provider = v.slice(0, sep) as LlmProvider;
    const id = v.slice(sep + 1);
    setLlmProvider(provider);
    setLlmModel(id);
  }, []);

  const linkedinOk = useMemo(() => {
    const t = linkedin.trim();
    return !t || isValidOptionalHttpUrl(t);
  }, [linkedin]);

  const jobLinkOk = useMemo(() => {
    return !jobLink.trim() || isValidPublicJobUrl(jobLink);
  }, [jobLink]);

  const canSubmit = useMemo(() => {
    return (
      displayName.trim().length > 0 &&
      isValidEmailAddress(email) &&
      linkedinOk &&
      jobLinkOk &&
      systemPrompt.trim().length >= 10 &&
      jobDescription.trim().length >= 20 &&
      sourceResume.trim().length >= 20
    );
  }, [
    displayName,
    email,
    linkedinOk,
    jobLinkOk,
    systemPrompt,
    jobDescription,
    sourceResume,
  ]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!canSubmit) {
        setError(
          "Complete your contact details on Profile (display name and valid email required). On this page, paste the job description (20+ characters), add system prompt (10+ characters), and experience (20+ characters). Job link is optional; if you add one, use a full https:// URL. If LinkedIn is set on Profile, it must be a valid http(s) URL.",
        );
        return;
      }
      setLoading(true);
      try {
        const jd = jobDescription.trim();
        if (jd.length < 20) {
          setError(
            "Job description must be at least 20 characters. Paste the full posting text.",
          );
          return;
        }
        const generationPayload: GeneratePayload = {
          system_prompt: systemPrompt,
          job_description: jd,
          source_resume: sourceResume,
          display_name: displayName.trim(),
          email: email.trim(),
          ...(phone.trim() && { phone: phone.trim() }),
          ...(address.trim() && { address: address.trim() }),
          ...(linkedin.trim() && { linkedin: linkedin.trim() }),
          llm_provider: llmProvider,
          ...(llmModel.trim() && { llm_model: llmModel.trim() }),
          anthropic_max_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
          pdf_template: pdfTemplate,
        };
        console.log("generationPayload:", generationPayload);
        console.log("usePuterFree:", usePuterFree);
        const res = usePuterFree
          ? await generateResumeViaPuter(generationPayload)
          : await generateResume(generationPayload);
        setResult(res);
        setCoverLetter(null);
        setAtsOpen(false);
        setAtsResult(null);
        setAtsSessionKey(0);

        await persistGenerationRecord(generationPayload, res.generation_meta, {
          persistProfile: true,
        });
      } catch (err) {
        setResult(null);
        setCoverLetter(null);
        setAtsOpen(false);
        setAtsResult(null);
        setAtsSessionKey(0);
        if (err instanceof SessionExpiredError) {
          setError(err.message);
          router.replace("/login");
          router.refresh();
          return;
        }
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
      address,
      linkedin,
      llmProvider,
      llmModel,
      pdfTemplate,
      usePuterFree,
      router,
    ],
  );

  const cardChrome =
    "rounded-2xl border border-[var(--border-muted)] bg-[var(--card)] shadow-[0_8px_28px_var(--shadow-soft)]";
  const panel = `${cardChrome} p-3 sm:p-4`;
  const fieldFill =
    "bg-[color:color-mix(in_srgb,var(--card)_58%,var(--paper))]";
  const textareaJob =
    `h-[6rem] w-full shrink-0 resize-none overflow-y-auto rounded-xl border border-[var(--border-muted)] ${fieldFill} px-3 py-2 text-sm text-stone-800 shadow-inner outline-none ring-accent/20 transition placeholder:text-stone-500 focus:border-accent focus:ring-2 focus:ring-accent/25`;
  const textareaWorkshopShell =
    `w-full min-h-0 shrink-0 resize-none overflow-y-auto rounded-xl border border-[var(--border-muted)] ${fieldFill} px-3 py-2 text-sm text-stone-800 shadow-inner outline-none ring-accent/20 transition placeholder:text-stone-500 focus:border-accent focus:ring-2 focus:ring-accent/25`;
  const textareaWorkshopSystem = `${textareaWorkshopShell} h-[12rem] w-full font-mono text-[13px] leading-relaxed`;
  const textareaWorkshopExperience = `${textareaWorkshopShell} h-[10rem] w-full leading-relaxed`;
  const fieldControl =
    `min-h-11 w-full rounded-lg border border-[var(--border-muted)] ${fieldFill} px-3 py-2 text-sm text-stone-800 outline-none focus:border-accent focus:ring-2 focus:ring-accent/25`;
  const workshopBtnPrimary =
    "inline-flex min-h-8 shrink-0 items-center justify-center rounded-lg bg-accent-strong px-2.5 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-pressed disabled:cursor-not-allowed disabled:opacity-50";
  const workshopBtnSecondary =
    "inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-muted)] bg-[var(--paper)] px-2.5 py-1 text-xs font-semibold text-stone-800 shadow-sm transition hover:border-accent hover:bg-accent-soft/50 disabled:cursor-not-allowed disabled:opacity-50";

  const saveSystemPromptToProfile = useCallback(async () => {
    setError(null);
    const trimmed = systemPrompt.trim();
    if (trimmed.length < 10) {
      setError("System prompt must be at least 10 characters to save.");
      return;
    }
    const supabase = createClient();
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    if (!u) {
      setError("Sign in to save tailoring rules.");
      return;
    }
    console.log("u:" , u);
    setSavingTailoringRules(true);
    try {
      const { data: savedRows, error: upErr } = await supabase
        .from("profiles")
        .update({
          system_prompt: trimmed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", u.id)
        .select("id");
      if (upErr) {
        console.error(
          "profiles system_prompt persist failed:",
          upErr.message,
        );
        setError(upErr.message);
        return;
      }
      if (!savedRows?.length) {
        const msg =
          "Could not save tailoring rules (no profile row updated). Sign in again, or confirm the profiles RLS policy allows your user to UPDATE their own row.";
        console.error(msg);
        setError(msg);
        return;
      }
      setSystemPrompt(trimmed);
      setSystemBaseline(trimmed);
      setSystemPromptSavedAt(Date.now());
      window.setTimeout(() => setSystemPromptSavedAt(null), 2800);
    } finally {
      setSavingTailoringRules(false);
    }
  }, [systemPrompt]);

  const saveExperienceToProfile = useCallback(async () => {
    setError(null);
    const trimmed = sourceResume.trim();
    if (trimmed.length < 20) {
      setError("Your experience must be at least 20 characters to save.");
      return;
    }
    const supabase = createClient();
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    if (!u) {
      setError("Sign in to save your experience.");
      return;
    }
    setSavingExperienceDraft(true);
    try {
      const { data: savedRows, error: upErr } = await supabase
        .from("profiles")
        .update({
          source_resume: trimmed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", u.id)
        .select("id");
      if (upErr) {
        console.error(
          "profiles source_resume persist failed:",
          upErr.message,
        );
        setError(upErr.message);
        return;
      }
      if (!savedRows?.length) {
        const msg =
          "Could not save experience (no profile row updated). Sign in again, or confirm the profiles RLS policy allows your user to UPDATE their own row.";
        console.error(msg);
        setError(msg);
        return;
      }
      setSourceResume(trimmed);
      setExperienceBaseline(trimmed);
      setExperienceSavedAt(Date.now());
      window.setTimeout(() => setExperienceSavedAt(null), 2800);
    } finally {
      setSavingExperienceDraft(false);
    }
  }, [sourceResume]);

  const generateCoverLetterAction = useCallback(async () => {
    if (!result?.resume) return;
    setError(null);
    const jdCover = jobDescription.trim();
    if (jdCover.length < 20) {
      setError(
        "Paste at least 20 characters of job description before generating a cover letter.",
      );
      return;
    }
    setCoverLetterLoading(true);
    try {
      const payload = {
        job_description: jdCover,
        source_resume: sourceResume,
        resume: result.resume,
        display_name: displayName.trim(),
        company_name: result.company_name ?? undefined,
        llm_provider: llmProvider,
        llm_model: llmModel.trim() || undefined,
        anthropic_max_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
      };
      const res = usePuterFree
        ? await generateCoverLetterViaPuter(payload)
        : await generateCoverLetter(payload);
      setCoverLetter(res.letter.trim());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Cover letter generation failed",
      );
    } finally {
      setCoverLetterLoading(false);
    }
  }, [
    result,
    jobDescription,
    sourceResume,
    displayName,
    llmProvider,
    llmModel,
    usePuterFree,
  ]);

  const downloadZip = useCallback(async () => {
    if (!result?.resume) return;
    setError(null);
    try {
      const export_date = localCalendarYmd();
      const company_name = result.company_name ?? null;
      const job_title = result.job_title ?? null;
      const res = await fetch("/api/download-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resume: result.resume,
          pdf_template: pdfTemplate,
          ...(coverLetter?.trim() && {
            cover_letter_body: coverLetter.trim(),
          }),
          company_name,
          job_title,
          export_date,
        }),
      });
      if (!res.ok) {
        let detail = res.statusText;
        try {
          const j = (await res.json()) as { detail?: string };
          if (typeof j.detail === "string") detail = j.detail;
        } catch {
          void 0;
        }
        throw new Error(detail || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const companySegment =
        typeof company_name === "string" && company_name.trim() !== ""
          ? company_name.trim()
          : "company-unknown";
      const jobTitleSegment =
        typeof job_title === "string" && job_title.trim() !== ""
          ? job_title.trim()
          : "role-unknown";
      a.download = `${export_date}-${slugifyForFilename(companySegment)}-${slugifyForFilename(jobTitleSegment)}-${slugifyForFilename(result.resume.contact.name)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ZIP download failed");
    }
  }, [result, pdfTemplate, coverLetter]);

  const runAtsCheck = useCallback(() => {
    if (!result) return;
    setAtsLoading(true);
    requestAnimationFrame(() => {
      const r = computeATS(result.resume, jobDescription, {
        jobUrl: jobLink,
        sourceResume,
      });
      setAtsSessionKey((k) => k + 1);
      setAtsResult(r);
      setAtsOpen(true);
      setAtsLoading(false);
    });
  }, [result, jobDescription, jobLink, sourceResume]);

  const applyAtsSuggestion = useCallback(
    (suggestion: ATSSuggestion) => {
      if (!suggestion.apply) return;
      setCoverLetter(null);
      setResult((prev) => {
        if (!prev) return prev;
        const updated = suggestion.apply!(prev.resume);
        setAtsResult(
          computeATS(updated, jobDescription, {
            jobUrl: jobLink,
            sourceResume,
          }),
        );
        return { ...prev, resume: updated };
      });
    },
    [jobDescription, jobLink, sourceResume],
  );

  const applyAllAtsSuggestions = useCallback(() => {
    setCoverLetter(null);
    setResult((prev) => {
      if (!prev) return prev;
      let resume = prev.resume;
      for (let i = 0; i < 64; i++) {
        const pass = computeATS(resume, jobDescription, {
          jobUrl: jobLink,
          sourceResume,
        });
        const next = pass.suggestions.find((s) => s.canApply && s.apply);
        if (!next?.apply) break;
        resume = next.apply(resume);
      }
      setAtsResult(
        computeATS(resume, jobDescription, {
          jobUrl: jobLink,
          sourceResume,
        }),
      );
      return { ...prev, resume };
    });
  }, [jobDescription, jobLink, sourceResume]);

  const upgradeResumeFromAts = useCallback(async () => {
    if (!result?.resume || !atsResult) return;
    setError(null);
    const jd = jobDescription.trim();
    if (jd.length < 20) {
      setError(
        "Job description must be available before upgrading from ATS findings.",
      );
      return;
    }

    setResumeUpgradeLoading(true);
    try {
      const upgradedSystemPrompt = buildAtsUpgradeSystemPrompt(
        systemPrompt,
        atsResult,
      );
      const generationPayload: GeneratePayload = {
        system_prompt: upgradedSystemPrompt,
        job_description: jd,
        source_resume: sourceResume,
        display_name: displayName.trim(),
        email: email.trim(),
        ...(phone.trim() && { phone: phone.trim() }),
        ...(address.trim() && { address: address.trim() }),
        ...(linkedin.trim() && { linkedin: linkedin.trim() }),
        llm_provider: llmProvider,
        ...(llmModel.trim() && { llm_model: llmModel.trim() }),
        anthropic_max_tokens: DEFAULT_MAX_OUTPUT_TOKENS,
        pdf_template: pdfTemplate,
      };

      const upgraded = usePuterFree
        ? await generateResumeViaPuter(generationPayload)
        : await generateResume(generationPayload);
      const upgradedAts = computeATS(upgraded.resume, jd, {
        jobUrl: jobLink,
        sourceResume,
      });

      setResult(upgraded);
      setCoverLetter(null);
      setAtsResult(upgradedAts);
      setAtsOpen(true);
      setAtsSessionKey((k) => k + 1);

      await persistGenerationRecord(generationPayload, upgraded.generation_meta, {
        persistProfile: false,
      });
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        setError(err.message);
        router.replace("/login");
        router.refresh();
        return;
      }
      setError(err instanceof Error ? err.message : "Resume upgrade failed");
    } finally {
      setResumeUpgradeLoading(false);
    }
  }, [
    result,
    atsResult,
    jobDescription,
    systemPrompt,
    sourceResume,
    displayName,
    email,
    phone,
    address,
    linkedin,
    llmProvider,
    llmModel,
    pdfTemplate,
    usePuterFree,
    jobLink,
    router,
  ]);

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
              <h1 className="text-xs font-semibold uppercase tracking-[0.2em] text-accent sm:text-sm">
                Resume tailor
              </h1>
              <span className="hidden text-stone-300 sm:inline" aria-hidden>
                ·
              </span>
            </div>
            <UserMenu />
          </div>
        </header>

        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col gap-3 lg:min-h-0 lg:flex-1 lg:gap-4"
        >
          <div
            className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:min-h-0 lg:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] lg:items-stretch lg:gap-4"
          >
            <div
              className={`${panel} scrollbar-tailor flex min-h-[14rem] flex-col gap-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto`}
            >
              <button
                type="button"
                onClick={toggleMobileJob}
                aria-expanded={mobileJobOpen}
                className="mb-3 flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--border-muted)] bg-accent-soft/25 px-3 py-2.5 text-left lg:hidden"
              >
                <span className={`${uiSectionEyebrow} !mt-0`}>Job posting</span>
                {workshopMobileChevron(mobileJobOpen)}
              </button>

              <div
                className={
                  !mobileJobOpen ? "hidden lg:block" : "block"
                }
              >
                <div className="flex flex-col gap-3">
                  <div className="shrink-0">
                    <label htmlFor="jd" className={uiFieldLabel}>
                      Job description (required)
                    </label>
                  </div>
                  <textarea
                    id="jd"
                    required
                    minLength={20}
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className={textareaJob}
                    placeholder="Paste the full job posting text (minimum 20 characters)."
                  />
                  <div className="shrink-0 space-y-1.5">
                    <label htmlFor="job-link" className={uiFieldLabel}>
                      Job link (optional)
                    </label>
                    <div className="flex items-stretch gap-2">
                      <input
                        id="job-link"
                        type="url"
                        inputMode="url"
                        autoComplete="url"
                        placeholder="https://… (helps ATS detection)"
                        value={jobLink}
                        onChange={(e) => setJobLink(e.target.value)}
                        className={`${fieldControl} min-w-0 flex-1`}
                      />
                      <button
                        type="submit"
                        disabled={!canSubmit || loading}
                        className={workshopBtnPrimary}
                      >
                        {loading ? "Generating…" : "Generate"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border-muted)] pt-4">
                {/* <p className={uiFieldLabel}>Model</p> */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <label htmlFor="model-preset" className="sr-only">
                      Model preset
                    </label>
                    <select
                      id="model-preset"
                      value={modelSelectValue}
                      onChange={handlePresetModelChange}
                      className={`${fieldControl} w-full appearance-none bg-[length:1rem] bg-[right_0.65rem_center] bg-no-repeat pr-9`}
                      style={selectChevronStyle}
                    >
                      {PRESET_MODELS.map((m) => (
                        <option
                          key={presetCompositeKey(m.provider, m.value)}
                          value={presetCompositeKey(m.provider, m.value)}
                        >
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <label
                    className={`inline-flex cursor-pointer items-center gap-2 ${uiCompactLabel} sm:shrink-0`}
                    title="Use Puter in the browser instead of the app server and API keys"
                  >
                    <input
                      type="checkbox"
                      checked={usePuterFree}
                      onChange={(e) => setUsePuterFree(e.target.checked)}
                      aria-label="Use Puter in the browser (no app API key)"
                      className="h-4 w-4 shrink-0 rounded border-stone-300 accent-accent-strong"
                    />
                    <span>
                      Puter{" "}
                      <span className="hidden font-normal text-stone-500 sm:inline">
                        (browser)
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="mt-4 border-t border-[var(--border-muted)] pt-4">
                <div className="mb-3 flex items-stretch gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={toggleMobileSystem}
                    aria-expanded={mobileSystemOpen}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-[var(--border-muted)] bg-accent-soft/25 px-3 py-2.5 text-left"
                  >
                    <span className={`${uiFieldLabel} !mt-0`}>
                      Tailoring rules
                    </span>
                    {workshopMobileChevron(mobileSystemOpen)}
                  </button>
                  {systemDirty ? (
                    <button
                      type="button"
                      disabled={savingTailoringRules}
                      onClick={() => void saveSystemPromptToProfile()}
                      className={workshopBtnPrimary}
                    >
                      Save tailoring rules
                    </button>
                  ) : null}
                </div>
                <div className="mb-2 hidden items-center justify-between gap-3 lg:flex">
                  <h3 className={`${uiFieldLabel} mb-0 min-w-0`}>
                    Tailoring rules
                  </h3>
                  {systemDirty ? (
                    <button
                      type="button"
                      disabled={savingTailoringRules}
                      onClick={() => void saveSystemPromptToProfile()}
                      className={workshopBtnPrimary}
                    >
                      Save tailoring rules
                    </button>
                  ) : null}
                </div>
                <div
                  className={
                    !mobileSystemOpen ? "hidden lg:block" : "block"
                  }
                >
                  <textarea
                    ref={sysTextareaRef}
                    id="sys"
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className={textareaWorkshopSystem}
                    placeholder="Tailoring rules…"
                    autoComplete="off"
                    spellCheck
                  />
                  {systemPrompt.length > SYSTEM_PROMPT_SOFT_WARN_CHARS ? (
                    <p className="mt-1.5 text-xs text-amber-900/90">
                      Very long prompts may increase cost and API latency.
                    </p>
                  ) : null}
                  {systemPromptSavedAt ? (
                    <div className="sticky bottom-0 z-[2] -mx-3 mt-3 border-t border-[var(--border-muted)] bg-[color:color-mix(in_srgb,var(--card)_93%,transparent)] px-3 py-3 backdrop-blur-[6px] sm:-mx-4 sm:px-4">
                      <p
                        className="text-xs font-medium text-emerald-700"
                        role="status"
                      >
                        Tailoring rules saved
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 border-t border-[var(--border-muted)] pt-4">
                <div className="mb-3 flex items-stretch gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={toggleMobileExperience}
                    aria-expanded={mobileExperienceOpen}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-xl border border-[var(--border-muted)] bg-accent-soft/25 px-3 py-2.5 text-left"
                  >
                    <span className={`${uiFieldLabel} !mt-0`}>
                      Your experience
                    </span>
                    {workshopMobileChevron(mobileExperienceOpen)}
                  </button>
                  {experienceDirty ? (
                    <button
                      type="button"
                      disabled={savingExperienceDraft}
                      onClick={() => void saveExperienceToProfile()}
                      className={workshopBtnPrimary}
                    >
                      Save experience
                    </button>
                  ) : null}
                </div>
                <div className="mb-2 hidden items-center justify-between gap-3 lg:flex">
                  <h3 className={`${uiFieldLabel} mb-0 min-w-0`}>
                    Your experience
                  </h3>
                  {experienceDirty ? (
                    <button
                      type="button"
                      disabled={savingExperienceDraft}
                      onClick={() => void saveExperienceToProfile()}
                      className={workshopBtnPrimary}
                    >
                      Save experience
                    </button>
                  ) : null}
                </div>
                <div
                  className={
                    !mobileExperienceOpen ? "hidden lg:block" : "block"
                  }
                >
                  <textarea
                    ref={srcTextareaRef}
                    id="src"
                    value={sourceResume}
                    onChange={(e) => setSourceResume(e.target.value)}
                    className={textareaWorkshopExperience}
                    placeholder="Roles, dates, impact, skills—everything we must not invent."
                    autoComplete="off"
                    spellCheck
                  />
                  {experienceSavedAt ? (
                    <div className="sticky bottom-0 z-[2] -mx-3 mt-3 border-t border-[var(--border-muted)] bg-[color:color-mix(in_srgb,var(--card)_93%,transparent)] px-3 py-3 backdrop-blur-[6px] sm:-mx-4 sm:px-4">
                      <p
                        className="text-xs font-medium text-emerald-700"
                        role="status"
                      >
                        Experience saved
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              {error ? (
                <p
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 lg:min-h-0 lg:max-h-full lg:flex-row lg:gap-4">
              <section
                className={`${cardChrome} flex min-h-[min(42vh,20rem)] w-full min-w-0 flex-1 flex-col overflow-hidden sm:min-h-[18rem] lg:min-h-0 lg:max-h-full lg:w-1/2 lg:max-w-[50%] lg:flex-1`}
              >
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border-muted)] px-3 py-2.5 sm:px-4">
                <h2 className={`${uiFieldLabel} mb-0`}>
                  Preview
                </h2>
                {result ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void generateCoverLetterAction()}
                      disabled={coverLetterLoading}
                      className={workshopBtnSecondary}
                      title={
                        coverLetter
                          ? "Regenerate cover letter"
                          : "Generate a cover letter for this job"
                      }
                    >
                      <span aria-hidden className="text-accent-pressed">
                        ✉
                      </span>
                      {coverLetterLoading
                        ? "Letter…"
                        : coverLetter
                          ? "Regenerate letter"
                          : "Cover letter"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void downloadZip()}
                      className={workshopBtnSecondary}
                    >
                      Download ZIP
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="scrollbar-tailor min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
                {!result ? (
                  <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border-muted)] bg-accent-soft/35 px-4 py-10 text-center lg:min-h-[8rem]">
                    <p className={`max-w-[20rem] ${uiFieldHint}`}>
                      Your tailored resume appears here after you generate. Set
                      your contact fields on{" "}
                      <Link
                        href="/profile"
                        className="font-medium text-accent underline-offset-2 hover:underline"
                      >
                        Profile
                      </Link>
                      . Edit tailoring rules and your experience below (use{" "}
                      <span className={uiHintEmphasis}>
                        Save
                      </span>{" "}
                      on each section to clear its unsaved indicator).
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <ResumePreview resume={result.resume} compact />
                    {coverLetter ? (
                      <p className={uiFieldHint}>
                        Cover letter ready — included as{" "}
                        <span className={uiHintEmphasis}>
                          cover-letter.docx
                        </span>{" "}
                        in Download ZIP.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            </section>

              <section
                className={`${cardChrome} flex min-h-[min(42vh,20rem)] w-full min-w-0 flex-1 flex-col overflow-hidden sm:min-h-[18rem] lg:min-h-0 lg:max-h-full lg:w-1/2 lg:max-w-[50%] lg:flex-1`}
              >
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--border-muted)] px-3 py-2.5 sm:px-4">
                  <h2 className={`${uiFieldLabel} mb-0`}>Enterprise ATS</h2>
                  {result ? (
                    <button
                      type="button"
                      onClick={() => void runAtsCheck()}
                      disabled={atsLoading}
                      className={workshopBtnSecondary}
                      title="Enterprise ATS-style check (no AI)"
                    >
                      <span aria-hidden className="text-accent-pressed">
                        ◎
                      </span>
                      {atsLoading ? "Checking…" : "ATS Check"}
                    </button>
                  ) : null}
                </div>
                <div className="scrollbar-tailor min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
                  {!result ? (
                    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border-muted)] bg-accent-soft/35 px-4 py-10 text-center lg:min-h-[8rem]">
                      <p className={`max-w-[20rem] ${uiFieldHint}`}>
                        After you generate a tailored resume in Preview, run an
                        enterprise ATS simulation here — requirement match,
                        parser safety, and resume quality hints only, no AI.
                      </p>
                    </div>
                  ) : atsOpen && atsResult ? (
                    <AtsPanel
                      key={atsSessionKey}
                      variant="inline"
                      result={atsResult}
                      onClose={() => setAtsOpen(false)}
                      onApply={applyAtsSuggestion}
                      onApplyAll={applyAllAtsSuggestions}
                      onUpgrade={() => void upgradeResumeFromAts()}
                      upgradeBusy={resumeUpgradeLoading}
                    />
                  ) : (
                    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--border-muted)] bg-accent-soft/35 px-4 py-10 text-center lg:min-h-[8rem]">
                      <p className={`max-w-[20rem] ${uiFieldHint}`}>
                        Use{" "}
                        <span className={uiHintEmphasis}>ATS Check</span> above
                        to analyze this résumé against the job description.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
