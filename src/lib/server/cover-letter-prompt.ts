import type { GenerateCoverLetterRequestParsed } from "./schemas";

export const STATIC_COVER_LETTER_INSTRUCTIONS = `You write concise, professional cover letters as JSON only (schema enforced by the API).

Rules:
- Use only facts from the tailored resume and optional candidate source material. Do not invent employers, degrees, dates, or metrics.
- One page or less. Plain text inside the letter field; separate paragraphs with blank lines (use \\n\\n).
- Sign with the candidate display name provided—no fabricated credentials.
- Mirror important job-description keywords where they honestly apply.`;

export const COVER_LETTER_JSON_FOOTER = `

Output format: a single JSON object only (no markdown fences, no prose before or after) with one key: "letter" (string), the full cover letter body as plain text.`;

export function buildCoverLetterUserPayload(
  body: GenerateCoverLetterRequestParsed,
): string {
  const parts: string[] = [
    "## Job description\n",
    body.job_description.trim(),
    "\n\n## Tailored resume (structured JSON; facts only)\n",
    JSON.stringify(body.resume),
    "\n\n## Candidate display name (sign with this exact name)\n",
    body.display_name.trim(),
  ];
  if (body.company_name?.trim()) {
    parts.push(
      "\n\n## Hiring company (use naturally in the letter)\n",
      body.company_name.trim(),
    );
  }
  if (body.source_resume?.trim()) {
    parts.push(
      "\n\n## Candidate source material (extra facts only)\n",
      body.source_resume.trim(),
    );
  }
  return parts.join("");
}
