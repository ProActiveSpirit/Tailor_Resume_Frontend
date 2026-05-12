/**
 * Coerce common LLM JSON drift into shapes compatible with resumeSchema (strict).
 */

const ROOT_STRIP_KEYS = new Set(["ats_keywords", "tailoring_notes"]);

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

function normalizeExperienceItem(item: unknown): unknown {
  if (!item || typeof item !== "object" || Array.isArray(item)) return item;
  const e = { ...(item as Record<string, unknown>) };

  const datesStr = typeof e.dates === "string" ? e.dates.trim() : "";
  const dr = e.date_range;
  if (!datesStr && typeof dr === "string" && dr.trim() !== "") {
    e.dates = dr.trim();
  }
  delete e.date_range;

  return e;
}

export function normalizeLlmResumeJson(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return input;
  }

  const root = { ...(input as Record<string, unknown>) };

  for (const k of ROOT_STRIP_KEYS) {
    delete root[k];
  }

  if (Array.isArray(root.skills)) {
    const out: string[] = [];
    for (const s of root.skills) {
      const coerced = coerceSkillEntry(s);
      if (coerced !== undefined) out.push(coerced);
    }
    root.skills = out;
  }

  if (Array.isArray(root.experience)) {
    root.experience = root.experience.map((item) => normalizeExperienceItem(item));
  }

  return root;
}
