import type { GenerateResumeResponse } from "./types";

export type LlmProvider = "anthropic" | "openai";

export type PdfTemplate = "classic" | "minimal" | "structured" | "editorial";

export type GeneratePayload = {
  system_prompt: string;
  job_description: string;
  source_resume: string;
  display_name: string;
  email: string;
  phone?: string;
  address?: string;
  llm_provider: LlmProvider;
  llm_model?: string;
  anthropic_model?: string;
  anthropic_max_tokens?: number;
  claude_output_effort?: string;
  pdf_template?: PdfTemplate;
};

export async function generateResume(
  body: GeneratePayload,
): Promise<GenerateResumeResponse> {
  const res = await fetch("/api/generate-resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { detail?: string | unknown };
      if (typeof j.detail === "string") detail = j.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<GenerateResumeResponse>;
}
