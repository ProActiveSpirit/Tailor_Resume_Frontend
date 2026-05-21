import type { Resume } from "@/lib/types";
import { mergeSourceExperienceMetadata } from "./experience-rules";
import { parseSourceExperience } from "./parse-source-experience";
import { applyRequestOverrides } from "./resume-prompt";
import { normalizeLlmResumeJson } from "./resume-llm-normalize";
import {
  type GenerateResumeRequestParsed,
  tailoredGenerationSchema,
  resumeSchema,
} from "./schemas";

function seedContactFromRequest(
  normalized: unknown,
  body: GenerateResumeRequestParsed,
): void {
  if (!normalized || typeof normalized !== "object" || Array.isArray(normalized))
    return;
  const r = normalized as Record<string, unknown>;
  const c = r.contact;
  if (!c || typeof c !== "object" || Array.isArray(c)) {
    r.contact = {
      name: body.display_name,
      email: body.email,
      phone: null,
      location: null,
    };
    return;
  }
  const co = c as Record<string, unknown>;
  if (typeof co.name !== "string" || !co.name.trim()) {
    co.name = body.display_name;
  }
  if (
    co.email === undefined ||
    co.email === "" ||
    (typeof co.email === "string" && !co.email.trim())
  ) {
    co.email = body.email;
  }
}

/**
 * Parse LLM JSON: either { company_name, job_title, resume } or legacy flat resume.
 */
export function parseTailoredGenerationFromLlm(
  data: unknown,
  body: GenerateResumeRequestParsed,
): { company_name: string | null; job_title: string | null; resume: Resume } {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Model returned invalid JSON");
  }
  const root = data as Record<string, unknown>;

  let companyRaw: unknown = null;
  let jobTitleRaw: unknown = null;
  let resumeJson: unknown;

  const nestedResume = root.resume;
  if (
    nestedResume &&
    typeof nestedResume === "object" &&
    !Array.isArray(nestedResume)
  ) {
    resumeJson = nestedResume;
    companyRaw = root.company_name;
    jobTitleRaw = root.job_title;
  } else if ("contact" in root && "experience" in root) {
    resumeJson = root;
    companyRaw = null;
    jobTitleRaw = null;
  } else {
    throw new Error("Model JSON did not match the tailored output shape");
  }

  const normalizedResume = normalizeLlmResumeJson(resumeJson);
  seedContactFromRequest(normalizedResume, body);
  const resumeOnly = resumeSchema.parse(normalizedResume);

  const wrapper = tailoredGenerationSchema.parse({
    company_name: companyRaw,
    job_title: jobTitleRaw,
    resume: resumeOnly,
  });

  const sourceEntries = parseSourceExperience(body.source_resume);
  const resume = mergeSourceExperienceMetadata(
    applyRequestOverrides(wrapper.resume, body, wrapper.job_title),
    sourceEntries,
  );

  return {
    company_name: wrapper.company_name,
    job_title: wrapper.job_title,
    resume,
  };
}
