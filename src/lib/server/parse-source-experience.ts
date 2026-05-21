/**
 * Parse work experience from "Your experience" (source_resume) text.
 * Format: under "Work Experience:", each role is two lines — dates, then "Company — Location".
 */

export type SourceExperienceEntry = {
  company: string;
  location: string | null;
  dates: string;
};

const SECTION_HEADER_RE = /^[A-Za-z][A-Za-z\s/&-]*:\s*$/;
const WORK_EXPERIENCE_HEADER_RE = /^work\s+experience:?\s*$/i;
const DATE_RANGE_LINE_RE =
  /^([A-Za-z]+)\s+(\d{4})\s*[–—-]\s*([A-Za-z]+)\s+(\d{4})\s*$/;
const COMPANY_LOCATION_SEP = " — ";

function isSectionHeader(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  return SECTION_HEADER_RE.test(t) || WORK_EXPERIENCE_HEADER_RE.test(t);
}

function extractWorkExperienceSection(text: string): string | null {
  const lines = text.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (WORK_EXPERIENCE_HEADER_RE.test(lines[i]?.trim() ?? "")) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) return null;

  const sectionLines: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();
    if (trimmed && isSectionHeader(trimmed) && !WORK_EXPERIENCE_HEADER_RE.test(trimmed)) {
      break;
    }
    sectionLines.push(line);
  }
  return sectionLines.join("\n").trim() || null;
}

function normalizeDateSeparator(dates: string): string {
  return dates.replace(/\s*[–—-]\s*/g, " – ").trim();
}

function isDateRangeLine(line: string): boolean {
  return DATE_RANGE_LINE_RE.test(line.trim());
}

function parseCompanyLocationLine(line: string): {
  company: string;
  location: string | null;
} {
  const trimmed = line.trim();
  const sepIdx = trimmed.indexOf(COMPANY_LOCATION_SEP);
  if (sepIdx === -1) {
    return { company: trimmed, location: null };
  }
  const company = trimmed.slice(0, sepIdx).trim();
  const location = trimmed.slice(sepIdx + COMPANY_LOCATION_SEP.length).trim();
  return {
    company,
    location: location === "" ? null : location,
  };
}

function parseRoleBlock(block: string): SourceExperienceEntry | null {
  const lines = block
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const datesLine = lines.find(isDateRangeLine);
  if (!datesLine) return null;

  const datesIdx = lines.indexOf(datesLine);
  const companyLine = lines.find((l, i) => i !== datesIdx && !isDateRangeLine(l));
  if (!companyLine) return null;

  const { company, location } = parseCompanyLocationLine(companyLine);
  if (!company) return null;

  return {
    company,
    location,
    dates: normalizeDateSeparator(datesLine),
  };
}

/**
 * Parse roles from source_resume Work Experience section.
 * Source order is oldest → newest; returned array is reverse-chronological (newest first).
 */
export function parseSourceExperience(text: string): SourceExperienceEntry[] {
  const section = extractWorkExperienceSection(text);
  if (!section) return [];

  const blocks = section.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const entries: SourceExperienceEntry[] = [];

  for (const block of blocks) {
    const entry = parseRoleBlock(block);
    if (entry) entries.push(entry);
  }

  return entries.reverse();
}

export function formatSourceExperienceParseError(): string {
  return (
    "Could not parse Work Experience from Your experience. " +
    'Use a "Work Experience:" section with two lines per role: (1) date range, e.g. January 2015 – May 2017, ' +
    "(2) Company — Location. Separate roles with a blank line."
  );
}
