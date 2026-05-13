import JSZip from "jszip";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { coverLetterToDocxBuffer, resumeToDocxBuffer } from "@/lib/server/docx-builder";
import { slugifyForFilenameSegment } from "@/lib/server/filename-slug";
import { resumeToPdfBytes } from "@/lib/server/pdf-builder";
import { downloadZipBodySchema } from "@/lib/server/schemas";

export const runtime = "nodejs";
export const maxDuration = 120;

const DEFAULT_MAX_BODY_BYTES = 78643200;

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

  let body;
  try {
    body = downloadZipBodySchema.parse(json);
  } catch (e) {
    if (e instanceof ZodError) {
      return NextResponse.json({ detail: e.message }, { status: 422 });
    }
    throw e;
  }

  try {
    const pdfBuf = await resumeToPdfBytes(body.resume, body.pdf_template);
    const docxBuf = await resumeToDocxBuffer(body.resume);
    const zip = new JSZip();
    zip.file("resume.pdf", pdfBuf);
    zip.file("resume.docx", docxBuf);
    const letter = body.cover_letter_body;
    if (letter?.trim()) {
      zip.file(
        "cover-letter.docx",
        await coverLetterToDocxBuffer(letter),
      );
    }

    const out = await zip.generateAsync({ type: "nodebuffer" });

    const cn = body.company_name;
    const jt = body.job_title;
    const companySegment =
      typeof cn === "string" && cn.trim() !== ""
        ? cn.trim()
        : "company-unknown";
    const jobTitleSegment =
      typeof jt === "string" && jt.trim() !== "" ? jt.trim() : "role-unknown";
    const baseName = `${body.export_date}-${slugifyForFilenameSegment(companySegment)}-${slugifyForFilenameSegment(jobTitleSegment)}-${slugifyForFilenameSegment(body.resume.contact.name)}`;
    const filename = `${baseName}.zip`;

    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("download-zip error", err);
    const detail =
      err instanceof Error && err.message.trim()
        ? err.message.trim().slice(0, 800)
        : "Failed to build ZIP export.";
    return NextResponse.json({ detail }, { status: 500 });
  }
}
