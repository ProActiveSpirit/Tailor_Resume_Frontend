import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { GENERATION_LOG_PLACEHOLDER_TARGET_ROLE } from "@/lib/generation-log";
import { createClient } from "@/lib/supabase/server";
import { generateResumeRequestSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";

const generationMetaSchema = z
  .object({
    resolved_model: z.string().min(1).max(200),
    max_tokens: z.number().int().min(0).max(100_000),
    input_tokens: z.number().int().min(0).nullable(),
    output_tokens: z.number().int().min(0).nullable(),
    cache_creation_input_tokens: z.number().int().min(0).nullable(),
    cache_read_input_tokens: z.number().int().min(0).nullable(),
    estimated_cost_usd: z.number().min(0).nullable(),
    api_key_source: z.string().min(1).max(200),
  })
  .strict();

const generationRecordRequestSchema = z
  .object({
    generation: generateResumeRequestSchema,
    generation_meta: generationMetaSchema,
    persist_profile: z.boolean().optional().default(true),
  })
  .strict();

export async function POST(request: Request): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  let body: z.output<typeof generationRecordRequestSchema>;
  try {
    body = generationRecordRequestSchema.parse(json);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ detail: e.message }, { status: 422 });
    }
    throw e;
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json(
      { detail: "Your session expired. Please sign in again." },
      { status: 401 },
    );
  }

  const { generation, generation_meta: meta } = body;

  if (body.persist_profile) {
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({
        display_name: generation.display_name,
        email: generation.email,
        phone: generation.phone ?? null,
        address: generation.address ?? null,
        linkedin: generation.linkedin ?? null,
        system_prompt: generation.system_prompt.trim(),
        source_resume: generation.source_resume.trim(),
        llm_provider: generation.llm_provider ?? null,
        llm_model: generation.llm_model ?? null,
        anthropic_max_tokens: generation.anthropic_max_tokens ?? null,
        claude_output_effort: generation.claude_output_effort ?? null,
        pdf_template: generation.pdf_template,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileErr) {
      return NextResponse.json({ detail: profileErr.message }, { status: 500 });
    }
  }

  const { error: logErr } = await supabase.from("generation_logs").insert({
    user_id: user.id,
    user_email: user.email ?? null,
    system_prompt: generation.system_prompt,
    job_description: generation.job_description,
    source_resume: generation.source_resume,
    display_name: generation.display_name,
    target_role: GENERATION_LOG_PLACEHOLDER_TARGET_ROLE,
    phone: generation.phone ?? null,
    pdf_template: generation.pdf_template,
    anthropic_model: meta.resolved_model,
    anthropic_max_tokens: meta.max_tokens,
    claude_output_effort: null,
    input_tokens: meta.input_tokens,
    output_tokens: meta.output_tokens,
    cache_creation_input_tokens: meta.cache_creation_input_tokens,
    cache_read_input_tokens: meta.cache_read_input_tokens,
    estimated_cost_usd: meta.estimated_cost_usd,
    api_key_source: meta.api_key_source,
  });

  if (logErr) {
    return NextResponse.json({ detail: logErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true as const });
}
