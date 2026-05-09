import type { GenerateResumeResponse, PdfTemplate } from "./types";

const base = (): string => {
  const u = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!u) {
    throw new Error(
      "Set NEXT_PUBLIC_API_URL to your FastAPI base URL (e.g. http://localhost:8000)",
    );
  }
  return u.replace(/\/$/, "");
};

export type GeneratePayload = {
  system_prompt: string;
  job_description: string;
  source_resume: string;
  display_name: string;
  email: string;
  phone?: string;
  target_role: string;
  anthropic_model?: string;
  anthropic_max_tokens?: number;
  claude_output_effort?: string;
  pdf_template?: PdfTemplate;
};

export async function generateResume(
  body: GeneratePayload,
): Promise<GenerateResumeResponse> {
  const res = await fetch(`${base()}/api/generate-resume`, {
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
