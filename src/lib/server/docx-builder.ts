import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import type { Resume } from "@/lib/types";

function contactLine(resume: Resume): string {
  return [
    resume.contact.email,
    resume.contact.phone,
    resume.contact.location,
    resume.contact.linkedin,
    resume.contact.website,
  ]
    .filter((s): s is string => Boolean(s && String(s).trim()))
    .join(" · ");
}

/** Build a Word document matching the resume preview structure (simple layout). */
export async function resumeToDocxBuffer(resume: Resume): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      text: resume.contact.name,
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 },
    }),
  );

  if (resume.target_title?.trim()) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: resume.target_title.trim(),
            italics: true,
          }),
        ],
        spacing: { after: 120 },
      }),
    );
  }

  const line = contactLine(resume);
  if (line) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: line, size: 22, color: "666666" })],
        spacing: { after: 240 },
      }),
    );
  }

  children.push(
    new Paragraph({
      text: "Summary",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 120, after: 120 },
    }),
    new Paragraph({
      text: resume.summary,
      spacing: { after: 240 },
    }),
  );

  children.push(
    new Paragraph({
      text: "Skills",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 120, after: 120 },
    }),
    new Paragraph({
      text: resume.skills.join(" · "),
      spacing: { after: 240 },
    }),
  );

  children.push(
    new Paragraph({
      text: "Experience",
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 120, after: 120 },
    }),
  );

  for (const exp of resume.experience) {
    const place = exp.location
      ? `${exp.title} — ${exp.company} (${exp.location})`
      : `${exp.title} — ${exp.company}`;
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: place, bold: true }),
          new TextRun({ text: `\t${exp.dates}`, italics: true }),
        ],
        spacing: { after: 80 },
      }),
    );
    for (const b of exp.bullets) {
      children.push(
        new Paragraph({
          text: `• ${b}`,
          spacing: { after: 60 },
        }),
      );
    }
    children.push(new Paragraph({ text: "", spacing: { after: 120 } }));
  }

  if (resume.education.length) {
    children.push(
      new Paragraph({
        text: "Education",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 120 },
      }),
    );
    for (const ed of resume.education) {
      const meta = [ed.dates, ed.details].filter(Boolean).join(" · ");
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${ed.degree} — ${ed.institution}`,
              bold: true,
            }),
          ],
          spacing: { after: 40 },
        }),
      );
      if (meta) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: meta, size: 22, color: "666666" })],
            spacing: { after: 120 },
          }),
        );
      }
    }
  }

  if (resume.projects.length) {
    children.push(
      new Paragraph({
        text: "Projects",
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 120, after: 120 },
      }),
    );
    for (const p of resume.projects) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: p.name, bold: true })],
          spacing: { after: 60 },
        }),
      );
      if (p.description) {
        children.push(
          new Paragraph({
            text: p.description,
            spacing: { after: 60 },
          }),
        );
      }
      for (const b of p.bullets) {
        children.push(
          new Paragraph({
            text: `• ${b}`,
            spacing: { after: 60 },
          }),
        );
      }
      children.push(new Paragraph({ text: "", spacing: { after: 120 } }));
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const buf = await Packer.toBuffer(doc);
  return Buffer.from(buf);
}
