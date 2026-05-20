import type { Resume } from "@/lib/types";

function trimContactField(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Non-empty contact fields in display order (preview, PDF, DOCX). */
export function contactLines(resume: Resume): string[] {
  const raw = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.linkedin,
    resume.contact.website,
  ];
  return raw.map(trimContactField).filter((s) => s.length > 0);
}

/** Single inline contact row for PDF/DOCX export (email · phone · address · …). */
export function contactRowText(resume: Resume, separator: string): string {
  return contactLines(resume).join(separator);
}
