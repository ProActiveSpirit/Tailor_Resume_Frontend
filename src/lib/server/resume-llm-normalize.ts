/**
 * Coerce common LLM JSON drift into shapes compatible with resumeSchema.
 */

const ROOT_STRIP_KEYS = new Set(["ats_keywords", "tailoring_notes"]);

const EDUCATION_STRIP_KEYS = new Set(["graduation_year"]);

function coerceSkillEntry(entry: unknown): string | undefined {
  if (typeof entry === "string") {
    const t = entry.trim();
    return t === "" ? undefined : t;
  }
  if (entry && typeof entry === "object" && !Array.isArray(entry)) {
    const o = entry as Record<string, unknown>;
    for (const key of ["name", "skill", "label", "technology", "title"] as const) {
      const v = o[key];
      if (typeof v === "string") {
        const t = v.trim();
        if (t !== "") return t;
      }
    }
  }
  return undefined;
}

function normalizeBulletArray(raw: unknown, maxItems: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const b of raw) {
    if (typeof b === "string") {
      const t = b.trim();
      if (t !== "") out.push(t);
    }
    if (out.length >= maxItems) break;
  }
  return out;
}

function normalizeExperienceItem(item: unknown): unknown {
  if (!item || typeof item !== "object" || Array.isArray(item)) return item;
  const e = { ...(item as Record<string, unknown>) };

  const datesStr = typeof e.dates === "string" ? e.dates.trim() : "";
  const dr = e.date_range;
  if (!datesStr && typeof dr === "string" && dr.trim() !== "") {
    e.dates = dr.trim();
  }
  delete e.date_range;

  e.bullets = normalizeBulletArray(e.bullets, 12);

  const dOut =
    typeof e.dates === "string"
      ? e.dates.trim()
      : e.dates != null && typeof e.dates !== "string"
        ? String(e.dates).trim().slice(0, 80)
        : "";
  if (!dOut) e.dates = "—";
  else e.dates = dOut.slice(0, 80);

  return e;
}

function normalizeProjectItem(item: unknown): unknown {
  if (!item || typeof item !== "object" || Array.isArray(item)) return item;
  const p = { ...(item as Record<string, unknown>) };
  p.bullets = normalizeBulletArray(p.bullets, 8);
  return p;
}

function stringOrNullMax(v: unknown, maxLen: number): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return String(v).slice(0, maxLen);
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (t === "") return null;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

function normalizeEducationItem(item: unknown): unknown {
  if (!item || typeof item !== "object" || Array.isArray(item)) return item;
  const ed = { ...(item as Record<string, unknown>) };

  const gyRaw = ed.graduation_year;
  let dates = stringOrNullMax(ed.dates, 80);
  if (dates === null && gyRaw !== undefined && gyRaw !== null && gyRaw !== "") {
    dates = stringOrNullMax(gyRaw, 80);
  }

  for (const k of EDUCATION_STRIP_KEYS) {
    delete ed[k];
  }

  ed.dates = dates;
  ed.details = stringOrNullMax(ed.details, 500);

  return ed;
}

function resolveExperienceArray(root: Record<string, unknown>): unknown[] | undefined {
  if (Array.isArray(root.experience)) return root.experience;
  if (Array.isArray(root.professional_experience)) return root.professional_experience;
  if (Array.isArray(root.work_experience)) return root.work_experience;
  if (Array.isArray(root.employment_history)) return root.employment_history;
  if (Array.isArray(root.positions)) return root.positions;
  return undefined;
}

export function normalizeLlmResumeJson(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const root = { ...(input as Record<string, unknown>) };

  for (const k of ROOT_STRIP_KEYS) {
    delete root[k];
  }

  const expArr = resolveExperienceArray(root);
  delete root.professional_experience;
  delete root.work_experience;
  delete root.employment_history;
  delete root.positions;
  if (expArr !== undefined) {
    root.experience = expArr.map((item) => normalizeExperienceItem(item));
  }

  if (!Array.isArray(root.projects)) {
    root.projects = [];
  } else {
    root.projects = root.projects.map((item) => normalizeProjectItem(item));
  }

  if (!Array.isArray(root.education)) {
    root.education = [];
  } else {
    root.education = root.education.map((item) => normalizeEducationItem(item));
  }

  if (Array.isArray(root.skills)) {
    const out: string[] = [];
    for (const s of root.skills) {
      const coerced = coerceSkillEntry(s);
      if (coerced !== undefined) out.push(coerced);
    }
    root.skills = out;
  }

  return root;
}
