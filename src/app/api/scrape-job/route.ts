import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { scrapeJobPostingFromUrl } from "@/lib/server/scrape-job-posting";
import { scrapeJobRequestSchema } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const maxDuration = 30;

const DEFAULT_MAX_BODY_BYTES = 4096;

export async function POST(request: Request): Promise<NextResponse> {
  const maxBody = Number(
    process.env.MAX_BODY_BYTES ?? String(DEFAULT_MAX_BODY_BYTES),
  );
  const cl = request.headers.get("content-length");
  if (cl && /^\d+$/.test(cl) && Number(cl) > maxBody) {
    return NextResponse.json({ detail: "Request body too large" }, { status: 413 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 });
  }

  let body: { url: string };
  try {
    body = scrapeJobRequestSchema.parse(json);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ detail: e.message }, { status: 422 });
    }
    throw e;
  }

  const result = await scrapeJobPostingFromUrl(body.url);
  return NextResponse.json(result);
}
