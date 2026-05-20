import type { ATSResult } from "./ats-engine";
import type { AtsUpgradeInput } from "./server/schemas";
import type {
  GenerateCoverLetterResponse,
  GenerateResumeResponse,
  Resume,
} from "./types";

export type { AtsUpgradeInput };

export function atsResultToUpgradeInput(ats: ATSResult): AtsUpgradeInput {
  return {
    score: ats.score,
    platform: {
      label: ats.platform.label,
      strictness: ats.platform.strictness,
    },
    topReasons: ats.topReasons,
    requirementGroups: ats.requirementGroups.map((g) => ({
      label: g.label,
      missing: g.missing,
    })),
    suggestions: ats.suggestions.map((s) => ({
      severity: s.severity,
      title: s.title,
      description: s.description,
    })),
  };
}

const SESSION_EXPIRED_DETAIL =
  "Your session expired. Please sign in again.";

export type LlmProvider = "anthropic" | "openai";

export type PdfTemplate = "classic" | "minimal" | "structured" | "editorial";

export type GeneratePayload = {
  ats_upgrade?: AtsUpgradeInput;
  job_description: string;
  source_resume: string;
  display_name: string;
  email: string;
  phone?: string;
  address?: string;
  linkedin?: string;
  llm_provider: LlmProvider;
  llm_model?: string;
  anthropic_model?: string;
  anthropic_max_tokens?: number;
  claude_output_effort?: string;
  pdf_template?: PdfTemplate;
};

export type CoverLetterPayload = {
  job_description: string;
  source_resume?: string;
  resume: Resume;
  display_name: string;
  company_name?: string | null;
  llm_provider: LlmProvider;
  llm_model?: string;
  anthropic_model?: string;
  anthropic_max_tokens?: number;
  claude_output_effort?: string;
};

const fetchJsonOptions: RequestInit = {
  credentials: "same-origin",
  redirect: "manual",
};

async function parseApiError(res: Response): Promise<string> {
  if (res.status === 401) {
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { detail?: unknown };
      if (typeof j.detail === "string" && j.detail.trim()) return j.detail.trim();
    } catch {
      void 0;
    }
    return SESSION_EXPIRED_DETAIL;
  }

  const text = await res.text();
  try {
    const j = JSON.parse(text) as { detail?: unknown };
    if (typeof j.detail === "string" && j.detail.trim()) return j.detail.trim();
  } catch {
    void 0;
  }

  const trimmed = text.trim().slice(0, 400);
  if (trimmed.startsWith("<") || trimmed.toLowerCase().includes("<!doctype")) {
    return "Unexpected response from the server. Try refreshing the page or signing in again.";
  }
  if (trimmed) return trimmed;
  return res.statusText.trim() || `Request failed (${res.status})`;
}

function assertFollowableResponse(res: Response): void {
  if (res.type === "opaqueredirect") {
    throw new Error(SESSION_EXPIRED_DETAIL);
  }
  if (res.status >= 300 && res.status < 400) {
    throw new Error(SESSION_EXPIRED_DETAIL);
  }
}

async function postJsonOrThrow(
  url: string,
  body: unknown,
): Promise<Response> {
  const res = await fetch(url, {
    ...fetchJsonOptions,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  assertFollowableResponse(res);
  return res;
}

export async function generateResume(
  body: GeneratePayload,
): Promise<GenerateResumeResponse> {
  const res = await postJsonOrThrow("/api/generate-resume", body);
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  return res.json() as Promise<GenerateResumeResponse>;
}

export async function generateCoverLetter(
  body: CoverLetterPayload,
): Promise<GenerateCoverLetterResponse> {
  const res = await postJsonOrThrow("/api/generate-cover-letter", body);
  if (!res.ok) {
    throw new Error(await parseApiError(res));
  }
  return res.json() as Promise<GenerateCoverLetterResponse>;
}
