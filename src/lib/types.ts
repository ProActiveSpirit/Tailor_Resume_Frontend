export type Contact = {
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin: string | null;
  website: string | null;
};

export type ExperienceItem = {
  title: string;
  company: string;
  location: string | null;
  dates: string;
  bullets: string[];
};

export type EducationItem = {
  degree: string;
  institution: string;
  dates: string | null;
  details: string | null;
};

export type ProjectItem = {
  name: string;
  description: string | null;
  bullets: string[];
};

export type Resume = {
  target_title: string | null;
  contact: Contact;
  summary: string;
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
};

export type PdfTemplate = "classic" | "minimal" | "structured" | "editorial";

export type GenerationMeta = {
  resolved_model: string;
  max_tokens: number;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
  estimated_cost_usd: number | null;
  api_key_source: string;
};

export type GenerateResumeResponse = {
  resume: Resume;
  pdf_base64: string;
  generation_meta: GenerationMeta;
};
