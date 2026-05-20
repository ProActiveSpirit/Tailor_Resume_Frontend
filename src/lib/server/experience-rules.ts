import type { Resume } from "@/lib/types";
import {
  getPreviousCalendarMonthLabel,
  MOST_RECENT_EMPLOYER,
} from "./resume-prompt";

const OPEN_END_RE = /\b(?:present|current|now)\b/i;
const RANGE_SEP_RE = /\s*[–—-]\s*/;
const MONTH_YEAR_RE =
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})$/i;

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

function parseMonthYear(s: string): { year: number; month: number } | null {
  const m = MONTH_YEAR_RE.exec(s.trim());
  if (!m) return null;
  const month = MONTH_LABELS.findIndex(
    (label) => label.toLowerCase() === m[1].toLowerCase(),
  );
  if (month < 0) return null;
  return { year: Number(m[2]), month };
}

function formatMonthYear(year: number, month: number): string {
  return `${MONTH_LABELS[month]} ${year}`;
}

function subtractMonths(
  year: number,
  month: number,
  count: number,
): { year: number; month: number } {
  let y = year;
  let m = month - count;
  while (m < 0) {
    m += 12;
    y -= 1;
  }
  return { year: y, month: m };
}

function splitDateRange(dates: string): { start: string; end: string } | null {
  const parts = dates.split(RANGE_SEP_RE);
  if (parts.length < 2) return null;
  const start = parts[0]?.trim();
  const end = parts.slice(1).join(" – ").trim();
  if (!start || !end) return null;
  return { start, end };
}

function defaultMostRecentStart(lastMonthLabel: string): string {
  const end = parseMonthYear(lastMonthLabel);
  if (!end) return `Jan 2024 – ${lastMonthLabel}`;
  const start = subtractMonths(end.year, end.month, 23);
  return `${formatMonthYear(start.year, start.month)} – ${lastMonthLabel}`;
}

function fixMostRecentDates(
  dates: string,
  lastMonthLabel: string,
): string {
  const trimmed = dates.trim();
  const split = splitDateRange(trimmed);

  if (!split) {
    return defaultMostRecentStart(lastMonthLabel);
  }

  const start = split.start;
  let end = split.end;

  if (OPEN_END_RE.test(end)) {
    end = lastMonthLabel;
  } else {
    const endParsed = parseMonthYear(end);
    if (!endParsed) {
      end = lastMonthLabel;
    }
  }

  return `${start} – ${end}`;
}

function closeOpenEndedDates(
  dates: string,
  fallbackEnd: string,
  newerRoleStart?: string,
): string {
  const trimmed = dates.trim();
  const split = splitDateRange(trimmed);
  if (!split) return trimmed;

  if (!OPEN_END_RE.test(split.end)) return trimmed;

  let end = fallbackEnd;
  if (newerRoleStart) {
    const startParsed = parseMonthYear(newerRoleStart);
    if (startParsed) {
      const before = subtractMonths(startParsed.year, startParsed.month, 1);
      end = formatMonthYear(before.year, before.month);
    }
  }

  return `${split.start} – ${end}`;
}

/** Enforce Beejern + last-month end on generated experience (all LLM paths). */
export function enforceGeneratedExperienceRules(
  resume: Resume,
  referenceDate: Date = new Date(),
): Resume {
  if (resume.experience.length === 0) return resume;

  const lastMonthLabel = getPreviousCalendarMonthLabel(referenceDate);

  const experience = resume.experience.map((exp, index) => {
    if (index === 0) {
      return {
        ...exp,
        company: MOST_RECENT_EMPLOYER,
        dates: fixMostRecentDates(exp.dates, lastMonthLabel),
      };
    }

    const newer = resume.experience[index - 1];
    const newerSplit = splitDateRange(newer.dates);
    const newerStart = newerSplit?.start;

    return {
      ...exp,
      dates: closeOpenEndedDates(exp.dates, lastMonthLabel, newerStart),
    };
  });

  return { ...resume, experience };
}
