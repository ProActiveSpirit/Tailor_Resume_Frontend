import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const pdfTemplateZ = z.enum(["classic", "minimal", "structured", "editorial"]);

export const generateResumeRequestSchema = z
  .object({
    system_prompt: z.string().min(10).max(20000),
    job_description: z.string().min(20).max(50000),
    source_resume: z.string().min(20).max(100000),
    display_name: z
      .string()
      .min(1)
      .max(200)
      .transform((s) => s.trim()),
    email: z
      .string()
      .email()
      .max(200)
      .transform((s) => s.trim()),
    phone: z
      .union([z.string().max(80), z.null(), z.literal("")])
      .optional()
      .transform((v) => {
        if (v == null || v === "") return undefined;
        const s = v.trim();
        return s === "" ? undefined : s;
      }),
    address: z
      .union([z.string().max(500), z.null(), z.literal("")])
      .optional()
      .transform((v) => {
        if (v == null || v === "") return undefined;
        const s = v.trim();
        return s === "" ? undefined : s;
      }),
    llm_provider: z
      .union([z.enum(["anthropic", "openai"]), z.null(), z.literal("")])
      .optional()
      .transform((v) => {
        if (v == null || v === "") return undefined;
        return v;
      }),
    llm_model: z
      .union([z.string().max(200), z.null(), z.literal("")])
      .optional()
      .transform((v) => {
        if (v == null || v === "") return undefined;
        return v.trim();
      }),
    anthropic_model: z
      .union([z.string().max(200), z.null(), z.literal("")])
      .optional()
      .transform((v) => {
        if (v == null || v === "") return undefined;
        const s = v.trim();
        return s === "" ? undefined : s;
      }),
    anthropic_max_tokens: z
      .number()
      .int()
      .min(256)
      .max(8192)
      .optional()
      .nullable(),
    claude_output_effort: z
      .union([z.string().max(40), z.null(), z.literal("")])
      .optional()
      .transform((v) => {
        if (v == null || v === "") return undefined;
        const s = v.trim();
        return s === "" ? undefined : s;
      }),
    pdf_template: pdfTemplateZ.optional().default("classic"),
  })
  .strict();

export type GenerateResumeRequestParsed = z.output<
  typeof generateResumeRequestSchema
>;

const contactSchema = z
  .object({
    name: z.string().min(1).max(200),
    email: z.string().max(200).nullable(),
    phone: z.string().max(80).nullable(),
    location: z.string().max(200).nullable(),
    linkedin: z.string().max(300).nullable(),
    website: z.string().max(300).nullable(),
  })
  .strict();

const experienceItemSchema = z
  .object({
    title: z.string().min(1).max(200),
    company: z.string().min(1).max(200),
    location: z.string().max(200).nullable(),
    dates: z.string().min(1).max(80),
    bullets: z.array(z.string()).max(12),
  })
  .strict();

const educationItemSchema = z
  .object({
    degree: z.string().min(1).max(200),
    institution: z.string().min(1).max(200),
    dates: z.string().max(80).nullable(),
    details: z.string().max(500).nullable(),
  })
  .strict();

const projectItemSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(600).nullable(),
    bullets: z.array(z.string()).max(8),
  })
  .strict();

export const resumeSchema = z
  .object({
    target_title: z.string().max(200).nullable(),
    contact: contactSchema,
    summary: z.string().min(1).max(2500),
    skills: z.array(z.string()).min(1).max(40),
    experience: z.array(experienceItemSchema).min(1).max(15),
    education: z.array(educationItemSchema).max(10),
    projects: z.array(projectItemSchema).max(10),
  })
  .strict();

export type ResumeParsed = z.infer<typeof resumeSchema>;

export const downloadResumeBodySchema = z
  .object({
    resume: resumeSchema,
    pdf_template: pdfTemplateZ.optional().default("classic"),
  })
  .strict();

export type DownloadResumeBodyParsed = z.output<
  typeof downloadResumeBodySchema
>;

function forceNoAdditionalProperties(obj: unknown): void {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const d = obj as Record<string, unknown>;
    if (d.type === "object") d.additionalProperties = false;
    for (const v of Object.values(d)) forceNoAdditionalProperties(v);
  } else if (Array.isArray(obj)) {
    for (const item of obj) forceNoAdditionalProperties(item);
  }
}

function schemaDefinesArray(o: Record<string, unknown>): boolean {
  const t = o.type;
  if (t === "array") return true;
  if (Array.isArray(t)) return t.includes("array");
  return false;
}

function stripUnsupportedAnthropicArrayKeywords(obj: unknown): void {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    const d = obj as Record<string, unknown>;
    if (schemaDefinesArray(d)) {
      delete d.maxItems;
      delete d.minItems;
    }
    for (const v of Object.values(d)) stripUnsupportedAnthropicArrayKeywords(v);
  } else if (Array.isArray(obj)) {
    for (const item of obj) stripUnsupportedAnthropicArrayKeywords(item);
  }
}

/** JSON Schema for Claude structured outputs (matches Python resume_json_schema). */
export function resumeJsonSchema(): Record<string, unknown> {
  const raw = zodToJsonSchema(resumeSchema, {
    $refStrategy: "none",
    target: "jsonSchema7",
  }) as Record<string, unknown>;
  delete raw.$schema;
  forceNoAdditionalProperties(raw);
  stripUnsupportedAnthropicArrayKeywords(raw);
  return raw;
}
