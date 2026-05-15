import type { Resume } from "@/lib/types";

export type ATSSuggestionCategory =
  | "requirements"
  | "keywords"
  | "contact"
  | "bullets"
  | "sections"
  | "skills"
  | "parser"
  | "alignment"
  | "polish";

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
  requirements: { score: number; max: number };
  exactKeywords: { score: number; max: number };
  titleSummary: { score: number; max: number };
  parserSafety: { score: number; max: number };
  evidence: { score: number; max: number };
  impact: { score: number; max: number };
  /** Backward-compatible aliases for older UI references. */
  keywords: { score: number; max: number };
  sections: { score: number; max: number };
  contact: { score: number; max: number };
  bullets: { score: number; max: number };
  skillsDensity: { score: number; max: number };
};

export type ATSStrictness = "standard" | "strict" | "very_strict";

export type ATSPlatform = {
  id:
    | "workday"
    | "taleo"
    | "successfactors"
    | "icims"
    | "greenhouse"
    | "lever"
    | "ashby"
    | "smartrecruiters"
    | "adp"
    | "ukg"
    | "enterprise_generic";
  label: string;
  confidence: "high" | "medium" | "low";
  strictness: ATSStrictness;
  note: string;
};

export type ATSRequirementGroup = {
  id: "mustHave" | "preferred" | "responsibility" | "domain" | "softSkill";
  label: string;
  matched: string[];
  missing: string[];
  total: number;
};

export type ATSResult = {
  score: number;
  breakdown: ATSBreakdown;
  suggestions: ATSSuggestion[];
  platform: ATSPlatform;
  requirementGroups: ATSRequirementGroup[];
  matchedKeywords: string[];
  missingKeywords: string[];
  topReasons: string[];
};

const WEIGHT_REQUIREMENTS = 35;
const WEIGHT_EXACT_KEYWORDS = 15;
const WEIGHT_TITLE_SUMMARY = 15;
const WEIGHT_PARSER_SAFETY = 15;
const WEIGHT_EVIDENCE = 10;
const WEIGHT_IMPACT = 10;
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
    "need",
    "needs",
    "needed",
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

type RequirementBucket = ATSRequirementGroup["id"];

type RequirementTerm = {
  term: string;
  bucket: RequirementBucket;
  weight: number;
};

type MatchDetail = {
  term: string;
  matched: boolean;
  exact: boolean;
  bucket: RequirementBucket;
};

type ComputeATSOptions = {
  jobUrl?: string;
  sourceResume?: string;
};

const PLATFORM_PROFILES: Record<ATSPlatform["id"], Omit<ATSPlatform, "confidence">> = {
  workday: {
    id: "workday",
    label: "Workday",
    strictness: "strict",
    note: "Large-company parser that rewards clean dates, standard sections, and explicit role keywords.",
  },
  taleo: {
    id: "taleo",
    label: "Oracle Taleo",
    strictness: "very_strict",
    note: "Legacy enterprise ATS. Exact keywords, simple headings, and consistent chronology matter most.",
  },
  successfactors: {
    id: "successfactors",
    label: "SAP SuccessFactors",
    strictness: "very_strict",
    note: "Strict enterprise parser. Keep layout simple and mirror must-have requirements exactly when truthful.",
  },
  icims: {
    id: "icims",
    label: "iCIMS",
    strictness: "very_strict",
    note: "Enterprise parser/search stack. Exact searchable skills and clear section structure are important.",
  },
  greenhouse: {
    id: "greenhouse",
    label: "Greenhouse",
    strictness: "standard",
    note: "Modern ATS with more human review, but explicit skills and concise evidence still help.",
  },
  lever: {
    id: "lever",
    label: "Lever",
    strictness: "standard",
    note: "Modern ATS. Prioritize recruiter readability plus clear matching terminology.",
  },
  ashby: {
    id: "ashby",
    label: "Ashby",
    strictness: "standard",
    note: "Modern ATS. Clear evidence and concise keyword alignment are usually enough.",
  },
  smartrecruiters: {
    id: "smartrecruiters",
    label: "SmartRecruiters",
    strictness: "strict",
    note: "Enterprise ATS. Searchable skills, contact data, and standard section labels matter.",
  },
  adp: {
    id: "adp",
    label: "ADP Recruiting",
    strictness: "strict",
    note: "Enterprise HR suite. Use conservative formatting, standard dates, and exact job language.",
  },
  ukg: {
    id: "ukg",
    label: "UKG Recruiting",
    strictness: "strict",
    note: "Enterprise HR suite. Keep headings conventional and requirements easy to parse.",
  },
  enterprise_generic: {
    id: "enterprise_generic",
    label: "Enterprise ATS",
    strictness: "strict",
    note: "Unknown platform. Optimizing for strict enterprise parsers is the safest default.",
  },
};

const REQUIREMENT_LABELS: Record<RequirementBucket, string> = {
  mustHave: "Must-have requirements",
  preferred: "Preferred qualifications",
  responsibility: "Role responsibilities",
  domain: "Domain and tools",
  softSkill: "Collaboration and soft skills",
};

const SECTION_HINTS: Array<[RegExp, RequirementBucket]> = [
  [/\b(required|requirements|minimum qualifications|basic qualifications|must have|you have|what you bring)\b/i, "mustHave"],
  [/\b(preferred|nice to have|bonus|desired|plus|ideally)\b/i, "preferred"],
  [/\b(responsibilities|what you'll do|what you will do|day to day|duties|about the role)\b/i, "responsibility"],
  [/\b(technology|tools|stack|platforms|systems|environment)\b/i, "domain"],
  [/\b(soft skills|competencies|collaboration|communication|leadership)\b/i, "softSkill"],
];

const MODAL_REQUIREMENT_RE =
  /\b(required|must|need(?:ed)?|minimum|proficient|expertise|hands-on|strong knowledge|demonstrated experience)\b/i;

const PREFERRED_RE = /\b(preferred|nice to have|bonus|plus|desired|familiarity|exposure)\b/i;

const SOFT_SKILL_RE =
  /\b(?:communication|collaboration|stakeholder|leadership|mentoring|cross-functional|problem solving|analytical|ownership|partnership|presentation)\b/i;

const CERTIFICATION_RE =
  /\b(?:cpa|pmp|cissp|cisa|cfa|scrum master|aws certified|azure certified|security\+|splunk|salesforce certified)\b/gi;

const ALIAS_GROUPS: string[][] = [
  ["javascript", "js"],
  ["typescript", "ts"],
  ["react", "react.js", "reactjs"],
  ["node.js", "node", "nodejs"],
  ["postgresql", "postgres"],
  ["amazon web services", "aws"],
  ["google cloud platform", "gcp"],
  ["microsoft azure", "azure"],
  ["kubernetes", "k8s"],
  ["continuous integration", "ci/cd", "cicd"],
  ["machine learning", "ml"],
  ["artificial intelligence", "ai"],
  ["large language models", "llm", "llms"],
  ["user experience", "ux"],
  ["user interface", "ui"],
  ["search engine optimization", "seo"],
  ["customer relationship management", "crm"],
  ["software as a service", "saas"],
];

const REQUIREMENT_ACTION_STARTS = new Set(
  [
    "architect",
    "automate",
    "build",
    "collaborate",
    "convert",
    "create",
    "define",
    "deliver",
    "design",
    "develop",
    "drive",
    "engineer",
    "identify",
    "implement",
    "improve",
    "lead",
    "manage",
    "orchestrate",
    "own",
    "participate",
    "partner",
    "ship",
    "support",
    "translate",
  ].map((w) => w.toLowerCase()),
);

const NOISY_TRAILING_TOKENS = new Set(
  [
    "acute",
    "advanced",
    "clear",
    "complex",
    "current",
    "deep",
    "different",
    "excellent",
    "fast",
    "high",
    "large",
    "many",
    "multiple",
    "new",
    "other",
    "proven",
    "rapid",
    "relevant",
    "several",
    "similar",
    "specific",
    "strong",
    "various",
  ].map((w) => w.toLowerCase()),
);

function clampScore(n: number, max: number): number {
  return Math.max(0, Math.min(max, Math.round(n)));
}

function detectATSPlatform(jobUrl?: string): ATSPlatform {
  const fallback: ATSPlatform = {
    ...PLATFORM_PROFILES.enterprise_generic,
    confidence: "low",
  };
  if (!jobUrl?.trim()) return fallback;

  let haystack = "";
  try {
    const url = new URL(jobUrl);
    haystack = `${url.hostname} ${url.pathname}`.toLowerCase();
  } catch {
    haystack = jobUrl.toLowerCase();
  }

  const checks: Array<[ATSPlatform["id"], RegExp]> = [
    ["workday", /\bmyworkdayjobs\b|workdayjobs|\.wd\d+\.myworkdayjobs|\/workday\b/],
    ["taleo", /\btaleo\b|oraclecloud\.com\/hcmui|\/careersection\//],
    ["successfactors", /\bsuccessfactors\b|jobs\.sap\.com|career\d+\.successfactors/],
    ["icims", /\bicims\b|\.icims\.com|jobs\.[^.]+\.com\/jobs\/.+icims/],
    ["greenhouse", /\bgreenhouse\b|boards\.greenhouse\.io|job-boards\.greenhouse\.io/],
    ["lever", /\blever\.co\b|jobs\.lever\.co/],
    ["ashby", /\bashbyhq\b|jobs\.ashbyhq\.com/],
    ["smartrecruiters", /\bsmartrecruiters\b|jobs\.smartrecruiters\.com/],
    ["adp", /\badp\b|workforcenow\.adp\.com|adpworkforcenow/],
    ["ukg", /\bukg\b|ultipro\b|recruiting\.ultipro\.com/],
  ];

  for (const [id, re] of checks) {
    if (re.test(haystack)) {
      return { ...PLATFORM_PROFILES[id], confidence: "high" };
    }
  }
  return fallback;
}

function currentBucketForLine(line: string, current: RequirementBucket): RequirementBucket {
  for (const [re, bucket] of SECTION_HINTS) {
    if (re.test(line)) return bucket;
  }
  return current;
}

function termWeight(bucket: RequirementBucket, term: string): number {
  const base =
    bucket === "mustHave"
      ? 1.45
      : bucket === "preferred"
        ? 0.85
        : bucket === "responsibility"
          ? 1.05
          : bucket === "domain"
            ? 1
            : 0.55;
  return term.includes(" ") ? base + 0.2 : base;
}

function addTerm(
  map: Map<string, RequirementTerm>,
  rawTerm: string,
  bucket: RequirementBucket,
): void {
  const term = normalizeForMatch(rawTerm);
  if (term.length < 2 || term.length > 52) return;
  if (STOP_WORDS.has(term)) return;
  if (/^\d+$/.test(term)) return;

  const existing = map.get(term);
  const weight = termWeight(bucket, term);
  if (!existing || weight > existing.weight) {
    map.set(term, { term, bucket, weight });
  }
}

function shouldKeepPhrase(tokens: string[]): boolean {
  if (tokens.length <= 2) return true;
  const [first, second, third] = tokens;
  if (!first || !second || !third) return false;
  if (NOISY_TRAILING_TOKENS.has(third)) return false;
  if (new RegExp(TECH_HINTS.source, "i").test(tokens.join(" "))) return true;
  return REQUIREMENT_ACTION_STARTS.has(first);
}

function extractPhraseCandidates(line: string): string[] {
  const norm = normalizeForMatch(line);
  const tokens = norm
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t) && !/^\d+$/.test(t));
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const one = tokens[i];
    if (one.length >= 3) out.push(one);
    if (i < tokens.length - 1) out.push(`${tokens[i]} ${tokens[i + 1]}`);
    if (i < tokens.length - 2) {
      const triTokens = [tokens[i], tokens[i + 1], tokens[i + 2]];
      const tri = triTokens.join(" ");
      if (tri.length <= 52 && shouldKeepPhrase(triTokens)) out.push(tri);
    }
  }
  return out;
}

function extractRequirementTerms(jobDescription: string): RequirementTerm[] {
  const map = new Map<string, RequirementTerm>();
  const rawLines = jobDescription
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/^[\s\-*•]+/, "").trim())
    .filter(Boolean);

  let bucket: RequirementBucket = "responsibility";
  for (const line of rawLines) {
    bucket = currentBucketForLine(line, bucket);
    const lineBucket = PREFERRED_RE.test(line)
      ? "preferred"
      : MODAL_REQUIREMENT_RE.test(line)
        ? "mustHave"
        : SOFT_SKILL_RE.test(line)
          ? "softSkill"
          : bucket;

    let m: RegExpExecArray | null;
    const techRe = new RegExp(TECH_HINTS.source, TECH_HINTS.flags);
    while ((m = techRe.exec(line)) !== null) addTerm(map, m[0], lineBucket);
    const certRe = new RegExp(CERTIFICATION_RE.source, CERTIFICATION_RE.flags);
    while ((m = certRe.exec(line)) !== null) addTerm(map, m[0], "mustHave");

    for (const phrase of extractPhraseCandidates(line)) {
      const phraseBucket = new RegExp(TECH_HINTS.source, "i").test(phrase)
        ? "domain"
        : lineBucket;
      addTerm(map, phrase, phraseBucket);
    }
  }

  return [...map.values()]
    .sort((a, b) => b.weight - a.weight || b.term.length - a.term.length)
    .slice(0, 90);
}

function variantsForTerm(term: string): string[] {
  const norm = normalizeForMatch(term);
  const variants = new Set([norm]);
  for (const group of ALIAS_GROUPS) {
    const normalizedGroup = group.map(normalizeForMatch);
    if (normalizedGroup.includes(norm)) {
      for (const alias of normalizedGroup) variants.add(alias);
    }
  }
  return [...variants];
}

function includesWholePhrase(textNorm: string, phrase: string): boolean {
  if (!phrase) return false;
  if (phrase.includes("+") || phrase.includes("#") || phrase.includes("/") || phrase.includes(".")) {
    return textNorm.includes(phrase);
  }
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}(?=\\s|$)`).test(textNorm);
}

function matchRequirement(resumeNorm: string, term: RequirementTerm): MatchDetail {
  const variants = variantsForTerm(term.term);
  const exact = includesWholePhrase(resumeNorm, term.term);
  return {
    term: term.term,
    bucket: term.bucket,
    exact,
    matched: exact || variants.some((v) => includesWholePhrase(resumeNorm, v)),
  };
}

function buildRequirementGroups(details: MatchDetail[]): ATSRequirementGroup[] {
  return (Object.keys(REQUIREMENT_LABELS) as RequirementBucket[]).map((id) => {
    const items = details.filter((d) => d.bucket === id);
    return {
      id,
      label: REQUIREMENT_LABELS[id],
      matched: items.filter((d) => d.matched).map((d) => titleCaseSkill(d.term)),
      missing: items.filter((d) => !d.matched).map((d) => titleCaseSkill(d.term)),
      total: items.length,
    };
  }).filter((group) => group.total > 0);
}

function weightedRatio(terms: RequirementTerm[], details: MatchDetail[]): number {
  let total = 0;
  let matched = 0;
  for (const term of terms) {
    total += term.weight;
    const detail = details.find((d) => d.term === term.term);
    if (detail?.matched) matched += term.weight;
  }
  return total > 0 ? matched / total : 0.5;
}

function ratioFromCount(hitCount: number, total: number): number {
  return total > 0 ? Math.min(1, hitCount / total) : 0;
}

function hasStandardDate(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return (
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{4}\b/i.test(v) ||
    /\b\d{1,2}\/\d{4}\b/.test(v) ||
    /\b\d{4}\b/.test(v) ||
    /\bpresent\b/i.test(v)
  );
}

function hasKeywordStuffing(resume: Resume): boolean {
  const skills = resume.skills.map(normalizeForMatch).filter(Boolean);
  const unique = new Set(skills);
  if (resume.skills.length > 32) return true;
  if (skills.length && unique.size / skills.length < 0.82) return true;
  return resume.summary.split(/[,;|]/).length > 10;
}

function topMissing(details: MatchDetail[], bucket: RequirementBucket, limit: number): string[] {
  return details
    .filter((d) => d.bucket === bucket && !d.matched)
    .map((d) => d.term)
    .slice(0, limit);
}

/**
 * Enterprise ATS-style score (deterministic, no external APIs).
 */
export function computeATS(
  resume: Resume,
  jobDescription: string,
  options: ComputeATSOptions = {},
): ATSResult {
  const resumeNorm = resumeToPlainText(resume);
  const sourceNorm = normalizeForMatch(options.sourceResume ?? "");
  const jdTrim = jobDescription.trim();
  const platform = detectATSPlatform(options.jobUrl);
  const terms = extractRequirementTerms(jobDescription);
  const details = terms.map((term) => matchRequirement(resumeNorm, term));
  const requirementGroups = buildRequirementGroups(details);

  const requirementRatio = jdTrim.length < 20 ? 0 : weightedRatio(terms, details);
  const exactRatio =
    details.length > 0
      ? details.filter((d) => d.exact).length / details.length
      : jdTrim.length < 20
        ? 0
        : 0.5;
  const strictExactMultiplier =
    platform.strictness === "very_strict"
      ? 1
      : platform.strictness === "strict"
        ? 0.88
        : 0.72;
  const exactKeywordScore = clampScore(
    (exactRatio * strictExactMultiplier +
      requirementRatio * (1 - strictExactMultiplier)) *
      WEIGHT_EXACT_KEYWORDS,
    WEIGHT_EXACT_KEYWORDS,
  );

  const titleTerms = terms
    .filter((t) => t.bucket === "mustHave" || t.bucket === "domain")
    .slice(0, 8);
  const titleSummaryText = normalizeForMatch(
    `${resume.target_title ?? ""} ${resume.summary}`,
  );
  const titleSummaryHits = titleTerms.filter((t) =>
    matchRequirement(titleSummaryText, t).matched,
  ).length;
  const titleSummaryScore = clampScore(
    (ratioFromCount(titleSummaryHits, titleTerms.length) * 0.75 +
      (resume.summary.trim().length >= 90 ? 0.25 : 0.05)) *
      WEIGHT_TITLE_SUMMARY,
    WEIGHT_TITLE_SUMMARY,
  );

  const bullets = collectAllBullets(resume);
  const actionHits = bullets.filter((b) =>
    ACTION_VERBS.has(firstWordOfBullet(b)),
  ).length;
  const metricHits = bullets.filter(hasNumericMetric).length;
  const evidenceHits = details.filter((d) => {
    if (!d.matched) return false;
    const term = normalizeForMatch(d.term);
    return resume.experience.some((exp) =>
      exp.bullets.some((b) => normalizeForMatch(b).includes(term)),
    );
  }).length;
  const evidenceScore = clampScore(
    (ratioFromCount(evidenceHits, Math.min(details.length, 24)) * 0.7 +
      ratioFromCount(
        bullets.length,
        Math.max(resume.experience.length * 2, 1),
      ) *
        0.3) *
      WEIGHT_EVIDENCE,
    WEIGHT_EVIDENCE,
  );
  const impactScore = clampScore(
    (ratioFromCount(actionHits, bullets.length) * 0.4 +
      ratioFromCount(metricHits, bullets.length) * 0.6) *
      WEIGHT_IMPACT,
    WEIGHT_IMPACT,
  );

  let parserSafetyPoints = 0;
  if (resume.contact.name?.trim()) parserSafetyPoints += 1;
  if (resume.contact.email?.trim()) parserSafetyPoints += 1;
  if (resume.contact.phone?.trim()) parserSafetyPoints += 0.75;
  if (resume.contact.location?.trim()) parserSafetyPoints += 0.75;
  if (resume.summary.trim().length >= 60) parserSafetyPoints += 1;
  if (resume.skills.length >= 6 && resume.skills.length <= 28)
    parserSafetyPoints += 1.25;
  if (resume.experience.length >= 1) parserSafetyPoints += 1.25;
  if (resume.experience.every((e) => hasStandardDate(e.dates)))
    parserSafetyPoints += 1.25;
  if (resume.education.length >= 1) parserSafetyPoints += 0.75;
  if (!hasKeywordStuffing(resume)) parserSafetyPoints += 1.75;
  const parserSafetyScore = clampScore(
    (parserSafetyPoints / 10) * WEIGHT_PARSER_SAFETY,
    WEIGHT_PARSER_SAFETY,
  );

  const requirementsScore = clampScore(
    requirementRatio * WEIGHT_REQUIREMENTS,
    WEIGHT_REQUIREMENTS,
  );
  const score = Math.min(
    100,
    requirementsScore +
      exactKeywordScore +
      titleSummaryScore +
      parserSafetyScore +
      evidenceScore +
      impactScore,
  );

  const matchedKeywords = details
    .filter((d) => d.matched)
    .map((d) => titleCaseSkill(d.term))
    .slice(0, 40);
  const missingKeywords = details
    .filter((d) => !d.matched)
    .map((d) => titleCaseSkill(d.term))
    .slice(0, 40);

  const suggestions: ATSSuggestion[] = [];
  if (jdTrim.length < 20) {
    suggestions.push({
      id: "jd:short",
      category: "requirements",
      severity: "high",
      title: "Add the full job description",
      description:
        "Enterprise ATS matching depends on the complete requirements, preferred qualifications, and responsibilities.",
      canApply: false,
    });
  }

  for (const phrase of topMissing(details, "mustHave", 8)) {
    const label = titleCaseSkill(phrase);
    const sourceHasEvidence = sourceNorm
      ? includesWholePhrase(sourceNorm, normalizeForMatch(phrase))
      : false;
    suggestions.push({
      id: `req:${phrase.toLowerCase()}`,
      category: "requirements",
      severity: "high",
      title: `Show must-have requirement: ${label}`,
      description: sourceHasEvidence
        ? "This appears in your source material but not in the tailored resume. Add it where it is truthful, ideally in Skills or an experience bullet."
        : "This is a must-have from the posting. Add it only if it is true, and support it with experience evidence rather than keyword stuffing.",
      canApply: sourceHasEvidence,
      apply: sourceHasEvidence
        ? (r: Resume) => {
            const skill = titleCaseSkill(phrase);
            const target = normalizeForMatch(skill);
            if (r.skills.some((s) => normalizeForMatch(s) === target)) return r;
            if (r.skills.length >= 40) return r;
            return { ...r, skills: [...r.skills, skill] };
          }
        : undefined,
    });
  }

  for (const phrase of topMissing(details, "preferred", 4)) {
    suggestions.push({
      id: `pref:${phrase.toLowerCase()}`,
      category: "keywords",
      severity: "medium",
      title: `Preferred keyword gap: ${titleCaseSkill(phrase)}`,
      description:
        "Preferred qualifications are lower priority than must-haves. Include this only when your source experience supports it.",
      canApply: false,
    });
  }

  if (titleSummaryScore < WEIGHT_TITLE_SUMMARY * 0.65) {
    suggestions.push({
      id: "align:title-summary",
      category: "alignment",
      severity: "high",
      title: "Tighten title and summary alignment",
      description:
        "Use the target role title and the strongest truthful must-have terms in the first few lines so recruiter search and ATS ranking see the match quickly.",
      canApply: false,
    });
  }

  if (!resume.target_title?.trim()) {
    suggestions.push({
      id: "align:target-title",
      category: "alignment",
      severity: "medium",
      title: "Add a target title",
      description:
        "A clear target title near the top improves role alignment in Workday, Taleo, iCIMS, and recruiter review.",
      canApply: false,
    });
  }

  if (!resume.contact.phone?.trim() || !resume.contact.location?.trim()) {
    suggestions.push({
      id: "parser:contact",
      category: "parser",
      severity: "medium",
      title: "Complete contact fields",
      description:
        "Name, email, phone, and city/state or remote location help enterprise parsers build a complete candidate profile.",
      canApply: false,
    });
  }

  if (!resume.experience.every((e) => hasStandardDate(e.dates))) {
    suggestions.push({
      id: "parser:dates",
      category: "parser",
      severity: "high",
      title: "Standardize experience dates",
      description:
        "Use consistent formats such as MM/YYYY - Present or Month YYYY - Month YYYY. Date parsing is a common ATS failure point.",
      canApply: false,
    });
  }

  if (hasKeywordStuffing(resume)) {
    suggestions.push({
      id: "parser:stuffing",
      category: "parser",
      severity: "high",
      title: "Reduce keyword stuffing risk",
      description:
        "Keep skills concise and deduplicated. Enterprise systems and recruiters prefer supported, readable evidence over long keyword lists.",
      canApply: false,
    });
  }

  if (resume.skills.length < 8) {
    suggestions.push({
      id: "skills:coverage",
      category: "skills",
      severity: "medium",
      title: "Increase verified skills coverage",
      description:
        "Aim for 8-18 concise, truthful skills that map to the posting's must-have tools and responsibilities.",
      canApply: false,
    });
  }

  let bulletIdx = 0;
  for (const exp of resume.experience) {
    for (const b of exp.bullets) {
      const w = firstWordOfBullet(b);
      if (!ACTION_VERBS.has(w)) {
        suggestions.push({
          id: `bullet:verb:${bulletIdx}`,
          category: "polish",
          severity: "medium",
          title: "Lead bullet with a stronger action verb",
          description: `"${b.slice(0, 120)}${b.length > 120 ? "..." : ""}" - start with verbs like Led, Built, Drove, Reduced, Optimized, or Delivered.`,
          canApply: false,
        });
      }
      if (!hasNumericMetric(b)) {
        suggestions.push({
          id: `bullet:metric:${bulletIdx}`,
          category: "bullets",
          severity: "low",
          title: "Add a measurable outcome",
          description: `"${b.slice(0, 120)}${b.length > 120 ? "..." : ""}" - include truthful numbers, percentages, dollars, volume, or time saved when available.`,
          canApply: false,
        });
      }
      bulletIdx++;
    }
  }

  const topReasons = [
    `${platform.label} profile detected (${platform.strictness.replace("_", " ")} parsing).`,
    `${Math.round(requirementRatio * 100)}% weighted requirement coverage.`,
    `${Math.round(exactRatio * 100)}% exact keyword coverage for stricter ATS search.`,
  ];
  if (metricHits < Math.ceil(bullets.length * 0.35)) {
    topReasons.push(
      "Impact evidence is light; quantified bullets would improve recruiter confidence.",
    );
  }
  if (topMissing(details, "mustHave", 1).length) {
    topReasons.push(
      "One or more must-have requirements are not visible in the resume.",
    );
  }

  suggestions.sort((a, b) => {
    const sev = { high: 0, medium: 1, low: 2 };
    return sev[a.severity] - sev[b.severity] || a.title.localeCompare(b.title);
  });

  return {
    score,
    platform,
    requirementGroups,
    matchedKeywords,
    missingKeywords,
    topReasons: topReasons.slice(0, 5),
    breakdown: {
      requirements: { score: requirementsScore, max: WEIGHT_REQUIREMENTS },
      exactKeywords: { score: exactKeywordScore, max: WEIGHT_EXACT_KEYWORDS },
      titleSummary: { score: titleSummaryScore, max: WEIGHT_TITLE_SUMMARY },
      parserSafety: { score: parserSafetyScore, max: WEIGHT_PARSER_SAFETY },
      evidence: { score: evidenceScore, max: WEIGHT_EVIDENCE },
      impact: { score: impactScore, max: WEIGHT_IMPACT },
      keywords: {
        score: requirementsScore + exactKeywordScore,
        max: WEIGHT_REQUIREMENTS + WEIGHT_EXACT_KEYWORDS,
      },
      sections: { score: parserSafetyScore, max: WEIGHT_PARSER_SAFETY },
      contact: { score: Math.min(parserSafetyScore, 10), max: 10 },
      bullets: { score: impactScore, max: WEIGHT_IMPACT },
      skillsDensity: {
        score: Math.min(10, Math.round((resume.skills.length / 18) * 10)),
        max: 10,
      },
    },
    suggestions: suggestions.slice(0, 44),
  };
}

/**
 * Pure ATS-style heuristic score (no external APIs).
 */
export function computeATSLegacy(resume: Resume, jobDescription: string): unknown {
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
