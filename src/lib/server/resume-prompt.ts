import type { Resume } from "@/lib/types";
import type {
  GenerateResumeRequestParsed,
  ResumeParsed,
} from "./schemas";

export const STATIC_TAILOR_INSTRUCTIONS = `You are an expert resume writer and career coach.
Your task: produce ONE tailored resume as JSON only (schema enforced by the API).

Rules:
- Use ONLY facts, roles, dates, metrics, and outcomes present in the candidate source material. Do not invent employers, degrees, or achievements.
- JSON shape: \`skills\` must be an array of plain strings (skill names only), not objects.
- Each experience entry must use the field \`dates\` (one string for the employment period). Do not use \`date_range\` or other aliases.
- Do not add top-level fields outside the resume schema (e.g. \`ats_keywords\`, \`tailoring_notes\`). Weave relevant keywords into summary, skills, and experience naturally.
- Align wording with the job description: mirror important keywords naturally in summary, skills, and bullets where truthful.
- Prefer strong action verbs, concise bullets (1–2 lines each), and quantified impact when the source provides numbers.
- Order experience reverse-chronologically where dates allow.
- Skills: deduplicate; prioritize JD-relevant skills that appear in the source; cap meaningfully.
- Summary: 2–4 short sentences, targeted to the role.
- Keep total length appropriate for one to two printed pages when rendered.`;

export function buildUserPayload(body: GenerateResumeRequestParsed): string {
  const parts: string[] = [
    "## Job description\n",
    body.job_description.trim(),
    "\n\n## Candidate source material (facts must come from here)\n",
    body.source_resume.trim(),
    "\n\n## Display overrides (use these exact values in output.contact)\n",
    `- Name for contact.name: ${body.display_name}\n`,
    `- Email for contact.email: ${body.email}\n`,
  ];
  if (body.phone) parts.push(`- Phone for contact.phone: ${body.phone}\n`);
  if (body.address)
    parts.push(`- Location / address for contact.location: ${body.address}\n`);
  return parts.join("");
}

export function applyRequestOverrides(
  parsed: ResumeParsed,
  body: GenerateResumeRequestParsed,
): Resume {
  return {
    ...parsed,
    target_title: null,
    contact: {
      ...parsed.contact,
      name: body.display_name,
      email: body.email,
      ...(body.phone ? { phone: body.phone } : {}),
      ...(body.address ? { location: body.address } : {}),
    },
  };
}
