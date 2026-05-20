import type { Resume } from "@/lib/types";
import type {
  AtsUpgradeInput,
  GenerateResumeRequestParsed,
  ResumeParsed,
} from "./schemas";

export const MOST_RECENT_EMPLOYER = "Beejern";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Previous calendar month as "MMM YYYY" (e.g. Apr 2026 when reference is May 2026). */
export function getPreviousCalendarMonthLabel(
  referenceDate: Date = new Date(),
): string {
  const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  d.setMonth(d.getMonth() - 1);
  return `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
}

export const EXPERIENCE_EMPLOYER_AND_TIMELINE_RULES = `- Generate 3–5 realistic, professional work experience entries tailored to the job description. Do NOT copy employer names from candidate source material—build a compelling career narrative that fits the target role.
- Employers (all roles except the most recent): use little-known private companies or early-stage startups only. Invent plausible obscure names (e.g. "Nexfold Systems", "Parcelion Labs", "Kestrel Metrics"). Never use FAANG, Fortune 500 household names, Big Four consulting, or other widely recognizable brands as employers.
- Founding-year constraint: For each invented employer, assign an implicit founding year (typically 2–8 years before that employer's last role on the resume). No role may start before that company's founding year. Keep the full timeline reverse-chronological with no overlaps unless merged per total work experience rules.
- Most recent entry (first in the list): \`company\` MUST be exactly "${MOST_RECENT_EMPLOYER}" (exact spelling). Title and bullets are generated for the job description and MUST feature hands-on AI/ML work (LLM integration, RAG, fine-tuning, model evaluation, prompt engineering, or AI product development). End date MUST be the mandatory last-month end from the user payload (never Present, Current, or Now).
- Older entries: show career progression (e.g. senior IC → lead → principal). Use closed date ranges only.
- Use \`experience\` as the key (never \`professional_experience\` or \`work_experience\`).
- Each entry uses \`dates\` as one string: "MMM YYYY – MMM YYYY" only. Never use Present, Current, Now, or open-ended ranges on any experience line. Do not use \`date_range\`.
- Each entry must have 4–6 bullets. EVERY bullet must:
  1. Open with a strong action verb: Architected, Built, Delivered, Deployed, Designed, Drove, Engineered, Implemented, Led, Launched, Optimized, Reduced, Scaled, Spearheaded, Streamlined, or Automated
  2. Mirror exact language from the job description when it describes a matching responsibility
  3. Include a quantified outcome in ≥60% of bullets — use realistic numbers: latency (ms), throughput (req/s), cost savings ($K/yr), user growth (%), model accuracy (%), team size, time saved (hours/week)
- Order entries reverse-chronologically.`;

export const TOTAL_WORK_EXPERIENCE_RULES = `When stating total work experience (X+ years) in the summary, compute X from candidate source material using chronological employment and education:
- Graduation anchor: From education, use the latest completed degree end (graduation year or "MMM YYYY" on the degree). If multiple degrees, use the one that marks entry into the target profession.
- Timeline: For generated experience entries, use the dates you output (reverse-chronological). For source material, list every role with start and end; treat "Present" in source as today only when inferring facts—not in generated output.
- Generated resume anchor: Treat the most recent generated role end as the mandatory last-month end from the user payload (not Present and not today's date) when computing X and ensuring chronological consistency.
- Exclude pre-graduation time: Do not count months before graduation toward professional tenure unless the source explicitly labels pre-grad roles as internships or co-ops (count only those labeled periods).
- Merge overlaps: For concurrent full-time roles, merge overlapping intervals so years are not double-counted.
- Compute X: Total professional years = merged months from first post-grad role start through the latest generated role end (mandatory last-month end for the ${MOST_RECENT_EMPLOYER} role), divided by 12, rounded down; use "X+ years" only when supported. If dates are partial or ambiguous, use the lower defensible X.
- Sanity cap: X must not exceed calendar years since graduation when graduation is known.
- Consistency: The first summary sentence must use this X; generated experience dates must not imply a longer career than X.`;

/** Server-owned second system block (formerly user-editable "Tailoring rules"). */
export const DEFAULT_TAILOR_USER_PROMPT = `You are an expert ATS resume strategist. Tailor the resume to the target job using truthful facts from the candidate source material for education, graduation timing, and defensible scope—but generated \`experience\` employers and dates follow the STATIC experience rules (little-known startups; most recent employer fixed to ${MOST_RECENT_EMPLOYER} ending last calendar month; never Present). Do not copy source employer names into generated experience except the ${MOST_RECENT_EMPLOYER} anchor. Set a clear target title from the job title or closest truthful supported variant. Put the strongest supported must-have phrases in the first summary sentence, including "X+ years" where X is computed from graduation year and chronological employment (see total work experience rules below). Weave supported requirements into experience evidence. Mirror important job-description keywords naturally in the target title, summary, skills, and bullets, but never fabricate unsupported claims, exaggerate, or keyword-stuff. Keep the resume recruiter-readable, ATS-safe, and focused on strongest supported evidence.

${TOTAL_WORK_EXPERIENCE_RULES}`;

export function buildAtsUpgradeSystemPrompt(
  basePrompt: string,
  ats: AtsUpgradeInput,
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
- Rewrite the first summary sentence to include the target role and the strongest supported must-have phrases; recompute X+ years using the total work experience rules from candidate source material and do not increase X beyond what employment and graduation dates support.
- Reorder skills to 8-18 concise items, placing exact supported must-have terms first.
- Rewrite experience bullets so supported must-have requirements appear as evidence inside bullets, not only as skills.
- Use strong action verbs and truthful metrics when present in the source; if no numbers exist, use truthful scope without inventing metrics.

Apply these findings by improving the target title, summary, skills, and experience bullets where the candidate source material supports it. Do not invent claims, do not add unsupported skills, and do not keyword-stuff. Use exact job-description terminology only when it is truthful and supported by the candidate facts.`;
}

export function resolveTailorUserPrompt(atsUpgrade?: AtsUpgradeInput): string {
  if (!atsUpgrade) return DEFAULT_TAILOR_USER_PROMPT;
  return buildAtsUpgradeSystemPrompt(DEFAULT_TAILOR_USER_PROMPT, atsUpgrade);
}

export const STATIC_TAILOR_INSTRUCTIONS = `You are a senior resume strategist and career architect who builds high-converting, ATS-optimized resumes.
Your task: produce JSON only (schema enforced by the API) with three top-level keys: \`company_name\`, \`job_title\`, and \`resume\`.

Top level:
- \`company_name\`: string or null. The hiring organization's name as stated or clearly implied in the job description only. Use null if unclear.
- \`job_title\`: string or null. The role or job title being hired for, as stated or clearly implied in the job description only. Use null if unclear.
- \`resume\`: the full resume object (all rules below apply inside \`resume\` only).

═══════════════════════════════════════════════════════
EXPERIENCE — GENERATE COMPELLING WORK HISTORY
═══════════════════════════════════════════════════════
${EXPERIENCE_EMPLOYER_AND_TIMELINE_RULES}

═══════════════════════════════════════════════════════
SKILLS — SECTOR-GROUPED FORMAT (25+ INDIVIDUAL SKILLS)
═══════════════════════════════════════════════════════
- Output skills as an array of 7–8 sector-grouped strings using EXACTLY this pattern: "Sector Label: Skill1, Skill2, Skill3"
- Cover these sectors (adapt labels to fit the role, always include AI & ML):
  • "AI & ML: ..." — LLMs, RAG, fine-tuning, vector DBs, frameworks (LangChain, LlamaIndex, Hugging Face, PyTorch), OpenAI/Anthropic APIs, prompt engineering, embeddings
  • "Languages: ..." — Python, TypeScript, JavaScript, Go, SQL, and any JD-relevant languages
  • "Cloud & Infrastructure: ..." — AWS, GCP, Azure, Docker, Kubernetes, Terraform, serverless
  • "Databases: ..." — PostgreSQL, Redis, MongoDB, Pinecone, Weaviate, Snowflake (match JD)
  • "Frameworks & APIs: ..." — FastAPI, Next.js, React, GraphQL, REST APIs (match JD)
  • "DevOps & Observability: ..." — GitHub Actions, CI/CD, Prometheus, Datadog, OpenTelemetry
  • "Data & Analytics: ..." — Spark, Kafka, dbt, Airflow, Pandas (include if relevant to JD)
  • "Methodologies: ..." — Agile, Scrum, System Design, Technical Leadership, Code Review
- Each sector string must contain 3–6 individual skill names. Total across all sectors: minimum 25 individual skills.
- Skills array length should be 7–8 strings (not individual items). This is intentional for ATS parser safety.
- Mirror exact JD technology names character-for-character (e.g. "Next.js" not "NextJS").

═══════════════════════════════════════════════════════
CERTIFICATIONS — FREE / LOW-COST ONLINE CREDENTIALS
═══════════════════════════════════════════════════════
- Generate 4–6 certifications in the \`certifications\` array. Each has \`name\`, \`issuer\`, and \`year\`.
- Choose ONLY from free or affordable online platforms: DeepLearning.AI (Coursera), Google (Coursera / Google Cloud), AWS (AWS Skill Builder free tier), Microsoft Learn, fast.ai, Hugging Face, Meta (Coursera), IBM (Coursera/edX), Stanford Online, or similar.
- Certifications must directly align with the generated skills and the job description domain.
- Example certifications (adapt based on JD):
  • "Machine Learning Specialization" / DeepLearning.AI · Coursera / 2024
  • "LangChain for LLM Application Development" / DeepLearning.AI / 2024
  • "AWS Cloud Practitioner Essentials" / Amazon Web Services / 2023
  • "Google IT Automation with Python" / Google / 2023
  • "Deep Learning Specialization" / DeepLearning.AI · Coursera / 2023
  • "Generative AI with Large Language Models" / DeepLearning.AI · AWS / 2024
- Year range: 2022–2025.

═══════════════════════════════════════════════════════
ATS OPTIMIZATION — MAXIMIZE ENTERPRISE PARSER SCORE
═══════════════════════════════════════════════════════
- \`target_title\`: set to the exact job title from the posting (or closest industry-standard variant). Never null when the title is clear.
- Summary: 3–4 tight sentences.
  • Sentence 1: "[Target Title] with X+ years of experience in [must-have-1] and [must-have-2]." Compute X using the total work experience rules in the user payload (graduation year + chronological employment); do not inflate X.
  • Generated experience dates must stay chronologically consistent with X, the mandatory last-month end for ${MOST_RECENT_EMPLOYER}, startup founding years, and any graduation year stated in candidate source material.
  • Sentence 2: Describe the most impactful AI/technical domain you cover, using JD language.
  • Sentence 3: Quantified career highlight (scale, impact, or recognition).
  • Sentence 4 (optional): Collaboration style or leadership scope.
  Keep it recruiter-readable — no comma-separated keyword lists.
- Mirror must-have JD terms VERBATIM in target_title, first summary sentence, skill sector items, and experience bullets.
- Schema keys: \`experience\` (not professional_experience), \`dates\` (not date_range), \`skills\` (array of sector strings), \`education\` (with \`dates\` and \`details\`), \`projects\` (use [] if none), \`certifications\` (array).
- Do not add extra keys inside \`resume\` (e.g. \`ats_keywords\`, \`tailoring_notes\`).
- Dates: use "MMM YYYY – MMM YYYY" format consistently across all experience entries; never Present, Current, or Now.
- Education: include \`dates\` and \`details\` as strings or null.
- Aim for content equivalent to 1–2 printed pages.`;

/** OpenAI JSON mode + browser Puter path: same shape instructions as server OpenAI. */
export const JSON_OBJECT_ONLY_FOOTER = `

Output format: respond with a single JSON object only (no markdown code fences, no prose before or after).
Required top-level keys: "company_name" (string or null — hiring employer from the job description only, null if unclear), "job_title" (string or null — open role title from the job description only, null if unclear), and "resume" (the resume object).

The "resume" object must have:
- target_title: exact job title from the posting (string or null)
- contact: { name, email, phone, location, linkedin, website }
- summary: 3–4 sentences; sentence 1 = "[Title] with X+ years in [must-have-1] and [must-have-2]" where X is computed per total work experience rules (graduation + merged employment timeline; round down; conservative if ambiguous)
- skills: array of 7–8 sector-grouped strings (pattern "Sector: Skill1, Skill2, Skill3"); 25+ individual skills total across all sectors; AI & ML sector is required
- experience[]: 3–5 generated entries ordered reverse-chronologically; older employers = little-known startups only (no famous brands); most recent company must be "${MOST_RECENT_EMPLOYER}" with AI/ML bullets; most recent end = mandatory last-month from user payload (never Present); all dates "MMM YYYY – MMM YYYY"; 4–6 bullets per entry (action verb, ≥60% with metrics)
- education[]: each entry has "dates" and "details" (string or null)
- projects[]: use [] if none
- certifications[]: 4–6 entries from free/online platforms; each has "name", "issuer", "year"

Rules: No keys inside "resume" beyond the schema. Experience key must be "experience" (not professional_experience). Skills must be strings not objects. Certifications must be from real free/low-cost platforms (DeepLearning.AI, Google, AWS, Microsoft, fast.ai, Hugging Face, Coursera, edX). Mirror must-have JD terms verbatim in target_title, first summary sentence, skill items, and bullets. Dates format: "MMM YYYY – MMM YYYY" only (no Present).`;

export function buildEmploymentFormattingSection(
  referenceDate: Date = new Date(),
): string {
  const lastMonth = getPreviousCalendarMonthLabel(referenceDate);
  return `## Employment formatting (mandatory)
- Most recent experience company: ${MOST_RECENT_EMPLOYER} (exact spelling).
- Most recent experience end month: ${lastMonth} (use in dates as "MMM YYYY – ${lastMonth}"; do not use Present, Current, or Now on any experience line).
- Older experience employers: little-known private companies or startups only; align each role's start year with that company's implicit founding year.`;
}

export function buildUserPayload(body: GenerateResumeRequestParsed): string {
  const parts: string[] = [
    "## Job description\n",
    body.job_description.trim(),
    "\n\n## Candidate source material (facts must come from here)\n",
    body.source_resume.trim(),
    "\n\n## Total work experience (required for summary)\n",
    TOTAL_WORK_EXPERIENCE_RULES,
    "\n\n",
    buildEmploymentFormattingSection(),
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
  fallbackTargetTitle?: string | null,
): Resume {
  const targetTitle =
    parsed.target_title?.trim() ||
    (typeof fallbackTargetTitle === "string" ? fallbackTargetTitle.trim() : "") ||
    null;

  return {
    ...parsed,
    target_title: targetTitle,
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
