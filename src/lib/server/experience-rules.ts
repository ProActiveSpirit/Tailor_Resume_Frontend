import type { Resume } from "@/lib/types";
import type { SourceExperienceEntry } from "./parse-source-experience";
import { formatSourceExperienceParseError } from "./parse-source-experience";

function normalizeDateSeparator(dates: string): string {
  return dates.replace(/\s*[–—-]\s*/g, " – ").trim();
}

/**
 * Apply company, location, and dates from parsed source onto LLM-generated experience.
 * Preserves LLM title and bullets per entry.
 */
export function mergeSourceExperienceMetadata(
  resume: Resume,
  sourceEntries: SourceExperienceEntry[],
): Resume {
  if (sourceEntries.length === 0) {
    throw new Error(formatSourceExperienceParseError());
  }

  if (resume.experience.length !== sourceEntries.length) {
    throw new Error(
      `Experience entry count mismatch: resume has ${resume.experience.length} role(s) but Your experience has ${sourceEntries.length}. Regenerate after fixing the source or model output.`,
    );
  }

  const experience = resume.experience.map((exp, i) => {
    const src = sourceEntries[i]!;
    return {
      ...exp,
      company: src.company,
      location: src.location,
      dates: normalizeDateSeparator(src.dates),
    };
  });

  return { ...resume, experience };
}
