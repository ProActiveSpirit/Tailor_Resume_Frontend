import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { downloadResumeBodySchema } from "@/lib/server/schemas";
import { resumeToPdfBytes } from "@/lib/server/pdf-builder";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown;
    const parsed = downloadResumeBodySchema.parse(body);
    const buf = await resumeToPdfBytes(parsed.resume, parsed.pdf_template);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="resume.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { detail: "Invalid resume payload for PDF export." },
        { status: 400 },
      );
    }
    console.error("download-pdf:", err);
    return NextResponse.json(
      { detail: "Failed to build PDF." },
      { status: 500 },
    );
  }
}
