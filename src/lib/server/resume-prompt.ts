import type { Resume } from "@/lib/types";
import type {
  AtsUpgradeInput,
  GenerateResumeRequestParsed,
  ResumeParsed,
} from "./schemas";

export const TOTAL_WORK_EXPERIENCE_RULES = `When stating total work experience (X+ years) in the summary, compute X from candidate source material using chronological employment and education:
- Graduation anchor: From education, use the latest completed degree end (graduation year or "MMM YYYY" on the degree). If multiple degrees, use the one that marks entry into the target profession.
- Timeline: List every role with start and end from source text; treat "Present" as today; write experience entries reverse-chronologically.
- Exclude pre-graduation time: Do not count months before graduation toward professional tenure unless the source explicitly labels pre-grad roles as internships or co-ops (count only those labeled periods).
- Merge overlaps: For concurrent full-time roles, merge overlapping intervals so years are not double-counted.
- Compute X: Total professional years = merged months from first post-grad role start through the latest role end (or today), divided by 12, rounded down; use "X+ years" only when supported. If dates are partial or ambiguous, use the lower defensible X.
- Sanity cap: X must not exceed calendar years since graduation when graduation is known.
- Consistency: The first summary sentence must use this X; experience dates must not imply a longer career than X.`;

/** Server-owned second system block (formerly user-editable "Tailoring rules"). */
export const DEFAULT_TAILOR_USER_PROMPT = `You are an expert ATS resume strategist. Tailor the resume to the target job using only truthful facts from the candidate source material. Preserve every distinct employer/role and employment date. Set a clear target title from the job title or closest truthful supported variant. Put the strongest supported must-have phrases in the first summary sentence, including "X+ years" where X is computed from graduation year and chronological employment (see total work experience rules below). Order 8-18 skills by exact job-description must-haves first, and weave supported requirements into experience evidence. For each experience entry, write exactly 3 concise bullets: one role-alignment bullet, one measurable impact bullet when evidence exists, and one tools/process/leadership bullet matched to the job description. Mirror important job-description keywords naturally in the target title, summary, skills, and bullets, but never fabricate, exaggerate, or keyword-stuff. Keep the resume recruiter-readable, ATS-safe, and focused on strongest supported evidence.

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
- Generate 3–5 realistic, professional work experience entries with plausible company names, titles, and employment periods tailored to the job description. Do NOT be constrained by the candidate's actual employer list—create a compelling career narrative that fits the target role.
- The MOST RECENT experience entry MUST feature hands-on AI/ML work: LLM integration, RAG pipeline development, fine-tuning, model evaluation, prompt engineering, or AI product development. Use a recognizable tech company, AI startup, or top consulting firm as the employer for this entry.
- Previous entries should show clear career progression—senior IC → lead → principal or equivalent arc—with companies that make sense for the target domain (e.g. SaaS startups, fintech, e-commerce, or enterprise software).
- Use \`experience\` as the key (never \`professional_experience\` or \`work_experience\`).
- Each entry uses \`dates\` (one string, format: "MMM YYYY – MMM YYYY" or "MMM YYYY – Present"). Do not use \`date_range\`.
- Each entry must have 4–6 bullets. EVERY bullet must:
  1. Open with a strong action verb: Architected, Built, Delivered, Deployed, Designed, Drove, Engineered, Implemented, Led, Launched, Optimized, Reduced, Scaled, Spearheaded, Streamlined, or Automated
  2. Mirror exact language from the job description when it describes a matching responsibility
  3. Include a quantified outcome in ≥60% of bullets — use realistic numbers: latency (ms), throughput (req/s), cost savings ($K/yr), user growth (%), model accuracy (%), team size, time saved (hours/week)
- Order entries reverse-chronologically.

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
  • Generated experience dates must stay chronologically consistent with X and with any graduation year stated in candidate source material.
  • Sentence 2: Describe the most impactful AI/technical domain you cover, using JD language.
  • Sentence 3: Quantified career highlight (scale, impact, or recognition).
  • Sentence 4 (optional): Collaboration style or leadership scope.
  Keep it recruiter-readable — no comma-separated keyword lists.
- Mirror must-have JD terms VERBATIM in target_title, first summary sentence, skill sector items, and experience bullets.
- Schema keys: \`experience\` (not professional_experience), \`dates\` (not date_range), \`skills\` (array of sector strings), \`education\` (with \`dates\` and \`details\`), \`projects\` (use [] if none), \`certifications\` (array).
- Do not add extra keys inside \`resume\` (e.g. \`ats_keywords\`, \`tailoring_notes\`).
- Dates: use "MMM YYYY – MMM YYYY" format consistently across all experience entries.
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
- experience[]: 3–5 generated entries (not from source history) ordered reverse-chronologically; most recent entry MUST include AI/ML work; each entry has "dates" (string), 4–6 bullets (each starts with action verb, ≥60% have numeric metrics)
- education[]: each entry has "dates" and "details" (string or null)
- projects[]: use [] if none
- certifications[]: 4–6 entries from free/online platforms; each has "name", "issuer", "year"

Rules: No keys inside "resume" beyond the schema. Experience key must be "experience" (not professional_experience). Skills must be strings not objects. Certifications must be from real free/low-cost platforms (DeepLearning.AI, Google, AWS, Microsoft, fast.ai, Hugging Face, Coursera, edX). Mirror must-have JD terms verbatim in target_title, first summary sentence, skill items, and bullets. Dates format: "MMM YYYY – MMM YYYY".`;

export function buildUserPayload(body: GenerateResumeRequestParsed): string {
  const parts: string[] = [
    "## Job description\n",
    body.job_description.trim(),
    "\n\n## Candidate source material (facts must come from here)\n",
    body.source_resume.trim(),
    "\n\n## Total work experience (required for summary)\n",
    TOTAL_WORK_EXPERIENCE_RULES,
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
