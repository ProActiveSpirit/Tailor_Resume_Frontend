import type { Resume } from "@/lib/types";

export type ATSSuggestionCategory =
  | "keywords"
  | "contact"
  | "bullets"
  | "sections"
  | "skills";

export type ATSSuggestionSeverity = "high" | "medium" | "low";

export type ATSSuggestion = {
  id: string;
  category: ATSSuggestionCategory;
  severity: ATSSuggestionSeverity;
  title: string;
  description: string;
  canApply: boolean;
  /** Only when canApply — adds missing JD keyword to skills */
  apply?: (resume: Resume) => Resume;
};

export type ATSBreakdown = {
  keywords: { score: number; max: number };
  sections: { score: number; max: number };
  contact: { score: number; max: number };
  bullets: { score: number; max: number };
  skillsDensity: { score: number; max: number };
};

export type ATSResult = {
  score: number;
  breakdown: ATSBreakdown;
  suggestions: ATSSuggestion[];
};

const WEIGHT_KEYWORDS = 35;
const WEIGHT_SECTIONS = 20;
const WEIGHT_CONTACT = 10;
const WEIGHT_BULLETS = 20;
const WEIGHT_SKILLS = 15;

/** Common English + job-posting noise */
const STOP_WORDS = new Set(
  [
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "have",
    "in",
    "is",
    "it",
    "its",
    "of",
    "on",
    "or",
    "our",
    "the",
    "their",
    "this",
    "to",
    "we",
    "will",
    "with",
    "you",
    "your",
    "all",
    "any",
    "can",
    "may",
    "must",
    "should",
    "would",
    "could",
    "into",
    "about",
    "across",
    "also",
    "among",
    "being",
    "both",
    "each",
    "that",
    "than",
    "then",
    "there",
    "these",
    "those",
    "through",
    "under",
    "until",
    "while",
    "who",
    "whom",
    "work",
    "working",
    "years",
    "year",
    "experience",
    "team",
    "teams",
    "role",
    "position",
    "job",
    "opportunity",
    "looking",
    "seeking",
    "candidate",
    "candidates",
    "applicants",
    "application",
    "apply",
    "responsibilities",
    "requirements",
    "qualifications",
    "preferred",
    "including",
    "include",
    "etc",
    "other",
    "others",
    "various",
    "strong",
    "excellent",
    "ability",
    "skills",
    "based",
    "remote",
    "hybrid",
    "full",
    "time",
    "part",
    "benefits",
    "compensation",
    "salary",
    "equal",
    "employer",
    "disability",
  ].map((w) => w.toLowerCase()),
);

/** Tech / tooling tokens we always keep if they appear in JD */
const TECH_HINTS =
  /\b(?:aws|azure|gcp|api|rest|graphql|sql|nosql|git|ci\/cd|docker|kubernetes|k8s|react|angular|vue|node\.?js|python|java|typescript|javascript|golang|rust|c\+\+|\.net|kotlin|swift|terraform|ansible|jenkins|kafka|rabbitmq|redis|mongodb|postgres|mysql|elasticsearch|snowflake|databricks|tableau|power\s*bi|jira|confluence|scrum|agile|ml|ai|llm|nlp|etl|bi)\b/gi;

const ACTION_VERBS = new Set(
  [
    "led",
    "managed",
    "built",
    "developed",
    "designed",
    "implemented",
    "delivered",
    "owned",
    "drove",
    "created",
    "improved",
    "increased",
    "reduced",
    "launched",
    "scaled",
    "architected",
    "automated",
    "streamlined",
    "mentored",
    "collaborated",
    "partnered",
    "executed",
    "achieved",
    "accelerated",
    "coordinated",
    "established",
    "enhanced",
    "optimized",
    "spearheaded",
    "directed",
    "oversaw",
    "delivered",
  ].map((v) => v.toLowerCase()),
);

function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u2013\u2014\-]/g, " ")
    .replace(/[^\p{L}\p{N}\s+#.\/]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resumeToPlainText(resume: Resume): string {
  const parts: string[] = [];
  if (resume.target_title) parts.push(resume.target_title);
  parts.push(resume.summary);
  parts.push(...resume.skills);
  for (const e of resume.experience) {
    parts.push(e.title, e.company, e.dates, ...(e.location ? [e.location] : []));
    parts.push(...e.bullets);
  }
  for (const ed of resume.education) {
    parts.push(ed.degree, ed.institution, ed.dates ?? "", ed.details ?? "");
  }
  for (const p of resume.projects) {
    parts.push(p.name, p.description ?? "", ...p.bullets);
  }
  parts.push(
    resume.contact.name,
    resume.contact.email ?? "",
    resume.contact.phone ?? "",
    resume.contact.location ?? "",
    resume.contact.linkedin ?? "",
    resume.contact.website ?? "",
  );
  return normalizeForMatch(parts.filter(Boolean).join(" "));
}

function extractJdKeywords(jobDescription: string): string[] {
  const raw = jobDescription.trim();
  if (!raw) return [];

  const found = new Set<string>();
  let m: RegExpExecArray | null;
  const techRe = new RegExp(TECH_HINTS.source, TECH_HINTS.flags);
  while ((m = techRe.exec(raw)) !== null) {
    const t = m[0].toLowerCase().replace(/\s+/g, " ").trim();
    if (t.length >= 2) found.add(t);
  }

  const norm = normalizeForMatch(raw);
  const tokens = norm.split(/\s+/).filter((t) => t.length > 0);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.length < 3) continue;
    if (STOP_WORDS.has(t)) continue;
    if (/^\d+$/.test(t)) continue;
    found.add(t);

    if (i < tokens.length - 1) {
      const pair = `${t} ${tokens[i + 1]}`;
      if (
        tokens[i + 1].length >= 2 &&
        !STOP_WORDS.has(tokens[i + 1]) &&
        pair.length <= 40
      ) {
        found.add(pair);
        i++;
      }
    }
  }

  return [...found].slice(0, 80);
}

function keywordPresentInResume(
  resumeNorm: string,
  keyword: string,
): boolean {
  const k = keyword.toLowerCase().trim();
  if (!k) return false;
  if (resumeNorm.includes(k)) return true;
  const kCompact = k.replace(/\s+/g, "");
  const resumeCompact = resumeNorm.replace(/\s+/g, "");
  return resumeCompact.includes(kCompact);
}

function collectAllBullets(resume: Resume): string[] {
  const out: string[] = [];
  for (const e of resume.experience) out.push(...e.bullets);
  for (const p of resume.projects) out.push(...p.bullets);
  return out;
}

function firstWordOfBullet(bullet: string): string {
  const t = bullet.trim();
  if (!t) return "";
  const word = t.split(/[\s:]/)[0]?.replace(/[^a-zA-Z]/g, "").toLowerCase() ?? "";
  return word;
}

function hasNumericMetric(bullet: string): boolean {
  return /\d/.test(bullet) || /\b(?:\d+k|\d+m|\d+%)\b/i.test(bullet);
}

function titleCaseSkill(phrase: string): string {
  const s = phrase.trim();
  if (!s) return s;
  const lower = s.toLowerCase();
  if (/^[a-zA-Z0-9+#.\/]+$/.test(s) && s === s.toUpperCase()) return s;
  return lower
    .split(/\s+/)
    .map((w) => {
      if (/^(ci\/cd|api|ui|ux|sql|aws|gcp)$/i.test(w)) return w.toUpperCase();
      if (w.length <= 2) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/**
 * Pure ATS-style heuristic score (no external APIs).
 */
export function computeATS(resume: Resume, jobDescription: string): ATSResult {
  const resumeNorm = resumeToPlainText(resume);
  const jdTrim = jobDescription.trim();
  const jdKeywords = extractJdKeywords(jobDescription);

  const matched: string[] = [];
  const missing: string[] = [];
  for (const kw of jdKeywords) {
    if (keywordPresentInResume(resumeNorm, kw)) matched.push(kw);
    else missing.push(kw);
  }

  const keywordRatio =
    jdTrim.length < 20
      ? 0
      : jdKeywords.length === 0
        ? 0.5
        : matched.length / jdKeywords.length;
  const keywordsScore = Math.round(
    Math.min(1, keywordRatio) * WEIGHT_KEYWORDS,
  );

  let sectionsPoints = 0;
  if (resume.summary.trim().length >= 40) sectionsPoints += 5;
  if (resume.skills.length >= 3) sectionsPoints += 5;
  if (resume.experience.length >= 1) sectionsPoints += 5;
  if (resume.education.length >= 1) sectionsPoints += 5;
  const sectionsScore = Math.min(WEIGHT_SECTIONS, sectionsPoints);

  let contactPoints = 0;
  if (resume.contact.name?.trim()) contactPoints += 2.5;
  if (resume.contact.email?.trim()) contactPoints += 2.5;
  if (resume.contact.phone?.trim()) contactPoints += 2.5;
  if (resume.contact.location?.trim()) contactPoints += 2.5;
  const contactScore = Math.min(WEIGHT_CONTACT, Math.round(contactPoints));

  const bullets = collectAllBullets(resume);
  let actionHits = 0;
  let metricHits = 0;
  for (const b of bullets) {
    const w = firstWordOfBullet(b);
    if (w && ACTION_VERBS.has(w)) actionHits++;
    if (hasNumericMetric(b)) metricHits++;
  }
  const nB = Math.max(bullets.length, 1);
  const actionRatio = actionHits / nB;
  const metricRatio = metricHits / nB;
  const bulletsScore = Math.round(
    actionRatio * (WEIGHT_BULLETS / 2) + metricRatio * (WEIGHT_BULLETS / 2),
  );

  const idealSkills = 12;
  const skillCount = resume.skills.length;
  const densityRatio = Math.min(1, skillCount / idealSkills);
  const skillsScore = Math.round(densityRatio * WEIGHT_SKILLS);

  const score = Math.min(
    100,
    keywordsScore +
      sectionsScore +
      contactScore +
      bulletsScore +
      skillsScore,
  );

  const suggestions: ATSSuggestion[] = [];

  if (jdTrim.length < 20) {
    suggestions.push({
      id: "jd:short",
      category: "keywords",
      severity: "high",
      title: "Add a fuller job description",
      description:
        "Paste the full posting (or key sections) in Job description so keyword matching can compare meaningfully.",
      canApply: false,
    });
  }

  const missingForApply = missing
    .filter((m) => m.length >= 2 && m.length <= 48)
    .slice(0, 25);

  for (const phrase of missingForApply.slice(0, 15)) {
    const label = titleCaseSkill(phrase);
    const id = `kw:${phrase.toLowerCase()}`;
    suggestions.push({
      id,
      category: "keywords",
      severity: "high",
      title: `Add job keyword: “${label}”`,
      description:
        "This term appears in the job description but wasn’t found in your resume text. Adding it to Skills can improve keyword match.",
      canApply: true,
      apply: (r: Resume) => {
        const normSkills = r.skills.map((s) => normalizeForMatch(s));
        const target = normalizeForMatch(label);
        if (normSkills.some((s) => s.includes(target) || target.includes(s)))
          return r;
        if (r.skills.length >= 40) return r;
        return { ...r, skills: [...r.skills, label] };
      },
    });
  }

  if (resume.summary.trim().length < 40) {
    suggestions.push({
      id: "sec:summary",
      category: "sections",
      severity: "medium",
      title: "Expand your summary",
      description:
        "Aim for at least a few sentences that mirror role language from the posting.",
      canApply: false,
    });
  }
  if (resume.skills.length < 3) {
    suggestions.push({
      id: "sec:skills-count",
      category: "sections",
      severity: "medium",
      title: "Add more skills",
      description:
        "List at least 3 distinct skills or tools relevant to the role.",
      canApply: false,
    });
  }
  if (!resume.experience.length) {
    suggestions.push({
      id: "sec:experience",
      category: "sections",
      severity: "high",
      title: "Add experience entries",
      description: "Include at least one role with impact bullets.",
      canApply: false,
    });
  }
  if (!resume.education.length) {
    suggestions.push({
      id: "sec:education",
      category: "sections",
      severity: "low",
      title: "Consider an education section",
      description:
        "If applicable, add degree and institution—many parsers expect it.",
      canApply: false,
    });
  }

  if (!resume.contact.phone?.trim()) {
    suggestions.push({
      id: "contact:phone",
      category: "contact",
      severity: "low",
      title: "Add a phone number",
      description:
        "Optional but helps some ATS profiles; add it in Your details.",
      canApply: false,
    });
  }
  if (!resume.contact.location?.trim()) {
    suggestions.push({
      id: "contact:location",
      category: "contact",
      severity: "low",
      title: "Add location",
      description:
        "City/state or “Remote” improves clarity for recruiters and parsers.",
      canApply: false,
    });
  }

  if (skillCount < idealSkills && skillCount < 8) {
    suggestions.push({
      id: "skills:density",
      category: "skills",
      severity: "low",
      title: "Increase skills coverage",
      description: `You have ${skillCount} skills listed; aim for around ${idealSkills} concise items that reflect the posting.`,
      canApply: false,
    });
  }

  let bulletIdx = 0;
  for (const exp of resume.experience) {
    for (let j = 0; j < exp.bullets.length; j++) {
      const b = exp.bullets[j];
      const w = firstWordOfBullet(b);
      if (!ACTION_VERBS.has(w)) {
        suggestions.push({
          id: `bullet:verb:${bulletIdx}`,
          category: "bullets",
          severity: "medium",
          title: "Lead bullet with a strong action verb",
          description: `\u201c${b.slice(0, 120)}${b.length > 120 ? "…" : ""}\u201d — start with verbs like Lead, Built, Drove, Reduced.`,
          canApply: false,
        });
      }
      if (!hasNumericMetric(b)) {
        suggestions.push({
          id: `bullet:metric:${bulletIdx}`,
          category: "bullets",
          severity: "low",
          title: "Add a measurable outcome",
          description: `\u201c${b.slice(0, 120)}${b.length > 120 ? "…" : ""}\u201d — include numbers, %, $, or time saved where truthful.`,
          canApply: false,
        });
      }
      bulletIdx++;
    }
  }
  for (const proj of resume.projects) {
    for (let j = 0; j < proj.bullets.length; j++) {
      const b = proj.bullets[j];
      const w = firstWordOfBullet(b);
      if (!ACTION_VERBS.has(w)) {
        suggestions.push({
          id: `bullet:verb:p:${bulletIdx}`,
          category: "bullets",
          severity: "medium",
          title: "Lead bullet with a strong action verb",
          description: `\u201c${b.slice(0, 120)}${b.length > 120 ? "…" : ""}\u201d`,
          canApply: false,
        });
      }
      if (!hasNumericMetric(b)) {
        suggestions.push({
          id: `bullet:metric:p:${bulletIdx}`,
          category: "bullets",
          severity: "low",
          title: "Add a measurable outcome",
          description: `\u201c${b.slice(0, 120)}${b.length > 120 ? "…" : ""}\u201d`,
          canApply: false,
        });
      }
      bulletIdx++;
    }
  }

  suggestions.sort((a, b) => {
    const sev = { high: 0, medium: 1, low: 2 };
    return sev[a.severity] - sev[b.severity] || a.title.localeCompare(b.title);
  });

  return {
    score,
    breakdown: {
      keywords: { score: keywordsScore, max: WEIGHT_KEYWORDS },
      sections: { score: sectionsScore, max: WEIGHT_SECTIONS },
      contact: { score: contactScore, max: WEIGHT_CONTACT },
      bullets: { score: bulletsScore, max: WEIGHT_BULLETS },
      skillsDensity: { score: skillsScore, max: WEIGHT_SKILLS },
    },
    suggestions: suggestions.slice(0, 40),
  };
}
