import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { resumeSchema } from "@/lib/server/schemas";
import { resumeToDocxBuffer } from "@/lib/server/docx-builder";
import { z } from "zod";

export const runtime = "nodejs";

const downloadDocxBodySchema = z
  .object({
    resume: resumeSchema,
  })
  .strict();

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as unknown;
    const parsed = downloadDocxBodySchema.parse(body);
    const buf = await resumeToDocxBuffer(parsed.resume);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="resume.docx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { detail: "Invalid resume payload for DOCX export." },
        { status: 400 },
      );
    }
    console.error("download-docx:", err);
    return NextResponse.json(
      { detail: "Failed to build DOCX." },
      { status: 500 },
    );
  }
}
