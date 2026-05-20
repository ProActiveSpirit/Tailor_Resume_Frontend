import {
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TabStopPosition,
  TabStopType,
  TextRun,
} from "docx";
import { contactRowText } from "@/lib/resume-contact-lines";
import type { Resume } from "@/lib/types";

const COLORS = {
  ink: "17202A",
  body: "263442",
  muted: "657386",
  accent: "225E66",
  divider: "D4DDE4",
} as const;

const FONT = "Aptos";

function stripBulletPrefix(line: string): string {
  return line.trim().replace(/^[•\-\*]\s*/, "");
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        color: COLORS.accent,
        size: 20,
        font: FONT,
        characterSpacing: 35,
      }),
    ],
    border: {
      bottom: {
        color: COLORS.accent,
        size: 5,
        space: 3,
        style: BorderStyle.SINGLE,
      },
    },
    spacing: { before: 220, after: 120 },
  });
}

function bodyParagraph(text: string, after = 160): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        color: COLORS.body,
        size: 20,
        font: FONT,
      }),
    ],
    spacing: { after, line: 250 },
  });
}

function mutedParagraph(text: string, after = 80): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        color: COLORS.muted,
        size: 19,
        font: FONT,
      }),
    ],
    spacing: { after },
  });
}

function bulletParagraph(text: string): Paragraph | null {
  const clean = stripBulletPrefix(text);
  if (!clean) return null;

  return new Paragraph({
    children: [
      new TextRun({
        text: "•",
        color: COLORS.accent,
        bold: true,
        size: 19,
        font: FONT,
      }),
      new TextRun({
        text: `  ${clean}`,
        color: COLORS.body,
        size: 19,
        font: FONT,
      }),
    ],
    indent: { left: 260, hanging: 180 },
    spacing: { after: 70, line: 230 },
  });
}

/** Build a polished, recruiter-friendly Word resume. */
export async function resumeToDocxBuffer(resume: Resume): Promise<Buffer> {
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: resume.contact.name,
          bold: true,
          color: COLORS.ink,
          size: 36,
          font: FONT,
        }),
      ],
      spacing: { after: 70 },
    }),
  );

  if (resume.target_title?.trim()) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: resume.target_title.trim(),
            bold: true,
            color: COLORS.accent,
            size: 22,
            font: FONT,
          }),
        ],
        spacing: { after: 90 },
      }),
    );
  }

  const contactRow = contactRowText(resume, "  |  ");
  if (contactRow) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: contactRow,
            size: 18,
            color: COLORS.muted,
            font: FONT,
          }),
        ],
        border: {
          bottom: {
            color: COLORS.divider,
            size: 4,
            space: 5,
            style: BorderStyle.SINGLE,
          },
        },
        spacing: { after: 180 },
      }),
    );
  }

  children.push(sectionHeading("Summary"), bodyParagraph(resume.summary, 190));

  // Skills — sector-grouped or flat fallback
  children.push(sectionHeading("Skills"));
  const hasSectors = resume.skills.some((s) => s.indexOf(": ") !== -1);
  if (hasSectors) {
    for (const skill of resume.skills) {
      const colonIdx = skill.indexOf(": ");
      if (colonIdx !== -1) {
        const category = skill.slice(0, colonIdx).trim();
        const items = skill.slice(colonIdx + 2).trim();
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${category}: `,
                bold: true,
                color: COLORS.accent,
                size: 19,
                font: FONT,
              }),
              new TextRun({
                text: items,
                color: COLORS.body,
                size: 19,
                font: FONT,
              }),
            ],
            spacing: { after: 55, line: 230 },
          }),
        );
      } else {
        children.push(mutedParagraph(skill, 55));
      }
    }
    children.push(new Paragraph({ text: "", spacing: { after: 80 } }));
  } else {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: resume.skills.join("  |  "),
            color: COLORS.body,
            size: 19,
            font: FONT,
          }),
        ],
        spacing: { after: 170, line: 230 },
      }),
    );
  }

  children.push(sectionHeading("Experience"));

  for (const exp of resume.experience) {
    const companyLine = exp.company + (exp.location ? ` | ${exp.location}` : "");
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: exp.title,
            bold: true,
            color: COLORS.ink,
            size: 22,
            font: FONT,
          }),
          new TextRun({
            text: `\t${exp.dates}`,
            italics: true,
            color: COLORS.muted,
            size: 18,
            font: FONT,
          }),
        ],
        tabStops: [
          {
            type: TabStopType.RIGHT,
            position: TabStopPosition.MAX,
          },
        ],
        spacing: { before: 60, after: 35 },
        keepNext: true,
      }),
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: companyLine,
            color: COLORS.accent,
            size: 19,
            font: FONT,
          }),
        ],
        spacing: { after: 65 },
        keepNext: true,
      }),
    );
    for (const b of exp.bullets) {
      const bullet = bulletParagraph(b);
      if (bullet) children.push(bullet);
    }
    children.push(new Paragraph({ text: "", spacing: { after: 90 } }));
  }

  if (resume.education.length) {
    children.push(sectionHeading("Education"));
    for (const ed of resume.education) {
      const meta = [ed.dates, ed.details].filter(Boolean).join(" | ");
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: ed.degree,
              bold: true,
              color: COLORS.ink,
              size: 20,
              font: FONT,
            }),
            new TextRun({
              text: ` | ${ed.institution}`,
              color: COLORS.body,
              size: 20,
              font: FONT,
            }),
          ],
          spacing: { after: 35 },
        }),
      );
      if (meta) children.push(mutedParagraph(meta, 110));
    }
  }

  const certs = resume.certifications ?? [];
  if (certs.length) {
    children.push(sectionHeading("Certifications"));
    for (const cert of certs) {
      const meta = [cert.issuer, cert.year].filter(Boolean).join("  ·  ");
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: cert.name,
              bold: true,
              color: COLORS.ink,
              size: 20,
              font: FONT,
            }),
          ],
          spacing: { after: 30 },
        }),
      );
      if (meta) children.push(mutedParagraph(meta, 100));
    }
    children.push(new Paragraph({ text: "", spacing: { after: 80 } }));
  }

  if (resume.projects.length) {
    children.push(sectionHeading("Projects"));
    for (const p of resume.projects) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: p.name,
              bold: true,
              color: COLORS.ink,
              size: 20,
              font: FONT,
            }),
          ],
          spacing: { after: 50 },
        }),
      );
      if (p.description) children.push(bodyParagraph(p.description, 60));
      for (const b of p.bullets) {
        const bullet = bulletParagraph(b);
        if (bullet) children.push(bullet);
      }
      children.push(new Paragraph({ text: "", spacing: { after: 90 } }));
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: FONT,
            size: 20,
            color: COLORS.body,
          },
          paragraph: {
            spacing: { line: 250 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 620,
              right: 700,
              bottom: 620,
              left: 700,
            },
          },
        },
        children,
      },
    ],
  });

  const buf = await Packer.toBuffer(doc);
  return Buffer.from(buf);
}

/** Plain-text cover letter as a clean Word document (paragraphs split on blank lines). */
export async function coverLetterToDocxBuffer(text: string): Promise<Buffer> {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  const blocks = normalized
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const children: Paragraph[] = blocks.map(
    (block) =>
      new Paragraph({
        children: [
          new TextRun({
            text: block,
            font: FONT,
            size: 21,
            color: COLORS.body,
          }),
        ],
        spacing: { after: 200, line: 260 },
      }),
  );
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 21, color: COLORS.body },
          paragraph: { spacing: { line: 260 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children,
      },
    ],
  });
  const buf = await Packer.toBuffer(doc);
  return Buffer.from(buf);
}
