import type { Resume } from "@/lib/types";

/** Non-empty contact fields in display order (preview, PDF, DOCX). */
export function contactLines(resume: Resume): string[] {
  const raw = [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.linkedin,
    resume.contact.website,
  ];
  return raw
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0);
}
