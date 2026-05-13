import type { Resume } from "@/lib/types";
import type {
  GenerateResumeRequestParsed,
  ResumeParsed,
} from "./schemas";

export const STATIC_TAILOR_INSTRUCTIONS = `You are an expert resume writer and career coach.
Your task: produce JSON only (schema enforced by the API) with three top-level keys: \`company_name\`, \`job_title\`, and \`resume\`.

Top level:
- \`company_name\`: string or null. The hiring organization's name as stated or clearly implied in the job description only—not from the candidate's résumé. Use null if unclear.
- \`job_title\`: string or null. The role or job title being hired for, as stated or clearly implied in the job description only—not from the candidate's résumé. Use null if unclear.
- \`resume\`: the full tailored resume object (all rules below apply inside \`resume\` only).

Rules (inside \`resume\`):
- Use ONLY facts, roles, dates, metrics, and outcomes present in the candidate source material. Do not invent employers, degrees, or achievements.
- Work history must use the key \`experience\` (an array). Do not use \`professional_experience\`, \`work_experience\`, or other aliases at the root of \`resume\`.
- Include a \`projects\` array at the root of \`resume\` (use \`[]\` if the candidate has no projects).
- Each \`education\` entry must include \`dates\` and \`details\` as strings or \`null\` if not applicable. Do not use \`graduation_year\` or other aliases—put timing in \`dates\` or supporting text in \`details\`.
- JSON shape: \`skills\` must be an array of plain strings (skill names only), not objects.
- Each experience entry must use the field \`dates\` (one string for the employment period). Do not use \`date_range\` or other aliases.
- Do not add extra keys inside \`resume\` outside the schema (e.g. \`ats_keywords\`, \`tailoring_notes\`). Weave relevant keywords into summary, skills, and experience naturally.
- Optimize for enterprise ATS systems used by large companies (Workday, Taleo, SuccessFactors, iCIMS, Greenhouse, Lever): use standard section content, searchable plain-text terminology, consistent dates, and no decorative or keyword-stuffed phrasing.
- Align wording with the job description: mirror exact must-have tools, certifications, methodologies, and role title language naturally in summary, skills, and bullets where truthful.
- Put the strongest truthful role match in \`target_title\` and the first sentence of \`summary\`; do not leave \`target_title\` null when the job title is clear.
- Prefer strong action verbs, concise bullets (1-2 lines each), and quantified impact when the source provides numbers.
- Skills: prioritize exact JD must-have terms first, then related truthful tools; keep the list concise and deduplicated. Never add a skill just because it appears in the job description.
- Include one \`experience\` entry for each distinct employer and employment period described in the candidate source material. Do not merge separate jobs into one entry and do not drop entire roles.
- Order experience reverse-chronologically where dates allow, without omitting roles to do so.
- If you need a shorter resume, shorten the summary, use fewer bullets per role, or trim skills—never omit an employer/role that appears in the source.
- Summary: 2-4 short sentences, targeted to the role, readable by a recruiter in a few seconds.
- Aim for one to two printed pages when rendered, without sacrificing completeness of work history from the source.`;

/** OpenAI JSON mode + browser Puter path: same shape instructions as server OpenAI. */
export const JSON_OBJECT_ONLY_FOOTER = `

Output format: respond with a single JSON object only (no markdown code fences, no prose before or after).
Required top-level keys: "company_name" (string or null — hiring employer from the job description only, null if unclear), "job_title" (string or null — open role title from the job description only, null if unclear), and "resume" (the resume object).

The "resume" object must have: target_title, contact (name, email, phone, location, linkedin, website),
summary, skills (array of strings only), experience[] (not professional_experience), education[] (each entry has dates and details, string or null), projects[] (use [] if none).
Each experience item must include "dates" (string period); skills must not be objects. No keys inside "resume" beyond the schema.
Include every distinct employer/role from the candidate source material as its own experience[] entry; shorten bullets or summary instead of dropping roles.
Enterprise ATS optimization: use exact job-description terminology only when supported by candidate facts, keep skills concise and deduplicated, set target_title when the job title is clear, and avoid keyword stuffing.`;

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
  if (body.linkedin)
    parts.push(`- LinkedIn URL for contact.linkedin: ${body.linkedin}\n`);
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
      ...(body.linkedin ? { linkedin: body.linkedin } : {}),
    },
  };
}
