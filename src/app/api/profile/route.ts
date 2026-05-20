import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  isValidEmailAddress,
  isValidOptionalHttpUrl,
} from "@/lib/auth-validation";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SESSION_EXPIRED_DETAIL =
  "Your session expired. Please sign in again.";

const profilePatchSchema = z
  .object({
    display_name: z.string().min(1).max(200).optional(),
    email: z.string().min(1).max(320).optional(),
    phone: z.string().max(80).nullable().optional(),
    address: z.string().max(500).nullable().optional(),
    linkedin: z.string().max(500).nullable().optional(),
    source_resume: z.string().min(20).max(100_000).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one profile field is required.",
      });
    }
    if (data.email !== undefined && !isValidEmailAddress(data.email)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "Enter a valid email for your resume header.",
      });
    }
    if (
      data.linkedin !== undefined &&
      data.linkedin !== null &&
      data.linkedin.trim() &&
      !isValidOptionalHttpUrl(data.linkedin)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["linkedin"],
        message: "LinkedIn must be a valid http(s) URL.",
      });
    }
  });

type ProfilePatch = z.output<typeof profilePatchSchema>;

function buildProfileUpdate(
  body: ProfilePatch,
): Record<string, string | null> {
  const update: Record<string, string | null> = {
    updated_at: new Date().toISOString(),
  };

  if (body.display_name !== undefined) {
    update.display_name = body.display_name.trim();
  }
  if (body.email !== undefined) {
    update.email = body.email.trim();
  }
  if (body.phone !== undefined) {
    update.phone = body.phone?.trim() || null;
  }
  if (body.address !== undefined) {
    update.address = body.address?.trim() || null;
  }
  if (body.linkedin !== undefined) {
    update.linkedin = body.linkedin?.trim() || null;
  }
  if (body.source_resume !== undefined) {
    update.source_resume = body.source_resume.trim();
  }

  return update;
}

export async function PATCH(request: Request): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  let body: ProfilePatch;
  try {
    body = profilePatchSchema.parse(json);
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
    return NextResponse.json({ detail: SESSION_EXPIRED_DETAIL }, { status: 401 });
  }

  const update = buildProfileUpdate(body);
  const { data: savedRows, error: profileErr } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id)
    .select("id");

  if (profileErr) {
    return NextResponse.json({ detail: profileErr.message }, { status: 500 });
  }

  if (!savedRows?.length) {
    return NextResponse.json(
      {
        detail:
          "Could not save profile (no profile row updated). Sign in again or contact support.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true as const });
}
