/** Snapshot of `profiles` columns used to hydrate the tailor page (server + client). */
export type TailorInitialProfile = {
  display_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  linkedin: string | null;
  system_prompt: string | null;
  source_resume: string | null;
  pdf_template: string | null;
  llm_provider: string | null;
  llm_model: string | null;
};

export const TAILOR_PROFILE_DB_COLUMNS =
  "display_name, email, phone, address, linkedin, system_prompt, source_resume, pdf_template, llm_provider, llm_model" as const;
