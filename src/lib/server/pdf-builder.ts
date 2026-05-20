import type { Readable } from "stream";
import PDFDocument from "pdfkit";
import { formatResumeDateRange } from "@/lib/resume-date-format";
import { contactRowText } from "@/lib/resume-contact-lines";
import type { PdfTemplate, Resume } from "@/lib/types";

const LETTER_W = 612;
const LETTER_H = 792;
const INCH = 72;

const FONT = {
  normal: "Helvetica",
  bold: "Helvetica-Bold",
  italic: "Helvetica-Oblique",
} as const;

const STYLE = {
  ink: "#1a2332",
  body: "#4a5568",
  muted: "#718096",
  accent: "#2563eb",
  divider: "#e2e8f0",
} as const;

const PAGE = {
  marginX: 0.55 * INCH,
  top: 0.5 * INCH,
  bottom: 0.5 * INCH,
} as const;

function stripBulletPrefix(line: string): string {
  return line.trim().replace(/^[•\-\*]\s*/, "");
}

function bottomY(): number {
  return LETTER_H - PAGE.bottom;
}

function contentX(): number {
  return PAGE.marginX;
}

function contentWidth(): number {
  return LETTER_W - PAGE.marginX * 2;
}

function textHeight(
  doc: PDFKit.PDFDocument,
  text: string,
  font: string,
  size: number,
  width: number,
  options: PDFKit.Mixins.TextOptions = {},
): number {
  doc.font(font).fontSize(size);
  return doc.heightOfString(text, { width, ...options });
}

function writeText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  options: {
    font?: string;
    size?: number;
    color?: string;
    after?: number;
    align?: PDFKit.Mixins.TextOptions["align"];
    continued?: boolean;
  } = {},
): number {
  const font = options.font ?? FONT.normal;
  const size = options.size ?? 9.5;
  const color = options.color ?? STYLE.body;
  const after = options.after ?? 0;

  doc.font(font).fontSize(size).fillColor(color);
  const height = doc.heightOfString(text, {
    width,
    align: options.align,
    continued: options.continued,
  });
  doc.text(text, x, y, {
    width,
    align: options.align,
    continued: options.continued,
    lineGap: 1.2,
  });
  return y + height + after;
}

function newPage(doc: PDFKit.PDFDocument): number {
  doc.addPage({ size: "LETTER", margin: 0 });
  return PAGE.top;
}

function guardY(
  doc: PDFKit.PDFDocument,
  y: number,
  neededHeight: number,
): number {
  if (y + neededHeight > bottomY()) return newPage(doc);
  return y;
}

function drawSectionTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  y: number,
): number {
  const x = contentX();
  const width = contentWidth();
  const size = 9.5;
  const ruleY = y + size + 6;

  doc
    .font(FONT.bold)
    .fontSize(size)
    .fillColor(STYLE.accent)
    .text(title.toUpperCase(), x, y, {
      width,
      characterSpacing: 0.8,
    });

  doc
    .strokeColor(STYLE.divider)
    .lineWidth(0.6)
    .moveTo(x, ruleY)
    .lineTo(x + width, ruleY)
    .stroke();

  return ruleY + 11;
}

function writeSectionTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  y: number,
): number {
  y = guardY(doc, y, 28);
  return drawSectionTitle(doc, title, y);
}

function writeBullet(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  options: {
    size?: number;
    color?: string;
    after?: number;
    guard?: boolean;
  } = {},
): number {
  const clean = stripBulletPrefix(text);
  if (!clean) return y;

  const size = options.size ?? 9.15;
  const color = options.color ?? STYLE.body;
  const after = options.after ?? 4;
  const bulletW = 11;
  const bodyW = width - bulletW;
  const height = textHeight(doc, clean, FONT.normal, size, bodyW, {
    lineGap: 1.2,
  });
  const yy = options.guard === false ? y : guardY(doc, y, height + after);

  doc.font(FONT.bold).fontSize(size).fillColor(STYLE.accent).text("•", x, yy, {
    width: bulletW,
  });
  doc.font(FONT.normal).fontSize(size).fillColor(color).text(clean, x + bulletW, yy, {
    width: bodyW,
    lineGap: 1.2,
  });

  return yy + height + after;
}

function writeHeader(doc: PDFKit.PDFDocument, resume: Resume): number {
  const x = contentX();
  const width = contentWidth();
  let y = PAGE.top;

  y = writeText(doc, resume.contact.name, x, y, width, {
    font: FONT.bold,
    size: 24,
    color: STYLE.accent,
    after: 3,
  });

  if (resume.target_title?.trim()) {
    y = writeText(doc, resume.target_title.trim(), x, y, width, {
      font: FONT.normal,
      size: 11,
      color: STYLE.muted,
      after: 6,
    });
  }

  const contactRow = contactRowText(resume, " · ");
  if (contactRow) {
    y = writeText(doc, contactRow, x, y, width, {
      size: 8.5,
      color: STYLE.muted,
      after: 10,
    });
  }

  if (resume.summary.trim()) {
    y = writeText(doc, resume.summary.trim(), x, y, width, {
      size: 9.25,
      color: STYLE.body,
      after: 14,
    });
  }

  return y;
}

function writeExperience(doc: PDFKit.PDFDocument, resume: Resume, startY: number): number {
  if (!resume.experience.length) return startY;

  let y = writeSectionTitle(doc, "Work Experience", startY);
  const x = contentX();
  const width = contentWidth();

  for (const exp of resume.experience) {
    const companyLine = exp.company + (exp.location ? ` — ${exp.location}` : "");
    const dateText = formatResumeDateRange(exp.dates ?? "");
    const roleW = width * 0.65;
    const dateGap = 12;
    const dateW = width - roleW - dateGap;
    const titleH = textHeight(doc, exp.title, FONT.bold, 10.5, roleW);
    const companyH = textHeight(doc, companyLine, FONT.normal, 9.2, width);
    const dateH = dateText
      ? textHeight(doc, dateText, FONT.bold, 9, dateW, { align: "right" })
      : 0;
    const headerH = Math.max(titleH, dateH) + companyH + 6;

    y = guardY(doc, y + 4, headerH + 16);

    doc.font(FONT.bold).fontSize(10.5).fillColor(STYLE.ink).text(exp.title, x, y, {
      width: roleW,
      lineGap: 0.5,
    });

    if (dateText) {
      doc
        .font(FONT.bold)
        .fontSize(9)
        .fillColor(STYLE.ink)
        .text(dateText, x + roleW + dateGap, y, {
          width: dateW,
          align: "right",
        });
    }

    doc
      .font(FONT.normal)
      .fontSize(9.2)
      .fillColor(STYLE.muted)
      .text(companyLine, x, y + titleH + 2, {
        width,
      });

    y += headerH;

    for (const line of exp.bullets) {
      y = writeBullet(doc, line, x, y, width, {
        size: 9.15,
        after: 3.4,
      });
    }

    y += 6;
  }

  return y;
}

function writeEducation(doc: PDFKit.PDFDocument, resume: Resume, startY: number): number {
  if (!resume.education.length) return startY;

  let y = writeSectionTitle(doc, "Education", startY + 2);
  const x = contentX();
  const width = contentWidth();

  for (const edu of resume.education) {
    const institutionLine =
      edu.institution + (edu.dates ? ` — ${edu.dates}` : "");
    const instH = textHeight(doc, institutionLine, FONT.bold, 10, width);
    const degreeH = textHeight(doc, edu.degree, FONT.normal, 9.2, width);
    const detailsH = edu.details
      ? textHeight(doc, edu.details, FONT.normal, 8.8, width)
      : 0;
    const blockH = instH + degreeH + detailsH + 10;

    y = guardY(doc, y + 2, blockH);

    y = writeText(doc, institutionLine, x, y, width, {
      font: FONT.bold,
      size: 10,
      color: STYLE.ink,
      after: 2,
    });

    y = writeText(doc, edu.degree, x, y, width, {
      size: 9.2,
      color: STYLE.body,
      after: edu.details ? 2 : 8,
    });

    if (edu.details) {
      y = writeText(doc, edu.details, x, y, width, {
        size: 8.8,
        color: STYLE.muted,
        after: 8,
      });
    }
  }

  return y;
}

function isSectorGrouped(skill: string): boolean {
  return skill.indexOf(": ") !== -1;
}

function writeSkills(doc: PDFKit.PDFDocument, resume: Resume, startY: number): number {
  if (!resume.skills.length) return startY;

  let y = writeSectionTitle(doc, "Skills", startY + 2);
  const x = contentX();
  const width = contentWidth();

  const hasSectors = resume.skills.some(isSectorGrouped);

  if (hasSectors) {
    // Render each skill as "Category  item1, item2, item3"
    for (const skill of resume.skills) {
      const colonIdx = skill.indexOf(": ");
      if (colonIdx !== -1) {
        const category = skill.slice(0, colonIdx).trim();
        const items = skill.slice(colonIdx + 2).trim();

        const categoryW = 120;
        const itemsW = width - categoryW;
        const lineH = Math.max(
          textHeight(doc, category, FONT.bold, 9, categoryW),
          textHeight(doc, items, FONT.normal, 9, itemsW),
        );

        y = guardY(doc, y, lineH + 5);

        doc.font(FONT.bold).fontSize(9).fillColor(STYLE.accent).text(category, x, y, {
          width: categoryW,
          lineGap: 1,
        });
        doc.font(FONT.normal).fontSize(9).fillColor(STYLE.body).text(items, x + categoryW, y, {
          width: itemsW,
          lineGap: 1,
        });

        y += lineH + 5;
      } else {
        const h = textHeight(doc, skill, FONT.normal, 9, width);
        y = guardY(doc, y, h + 4);
        y = writeText(doc, skill, x, y, width, { size: 9, color: STYLE.body, after: 4 });
      }
    }
    return y + 6;
  }

  // Fallback: flat comma-separated list
  const text = resume.skills.join(", ");
  y = guardY(doc, y, textHeight(doc, text, FONT.normal, 9.2, width) + 4);
  return writeText(doc, text, x, y, width, {
    size: 9.2,
    color: STYLE.body,
    after: 10,
  });
}

function writeCertifications(doc: PDFKit.PDFDocument, resume: Resume, startY: number): number {
  const certs = resume.certifications ?? [];
  if (!certs.length) return startY;

  let y = writeSectionTitle(doc, "Certifications", startY + 2);
  const x = contentX();
  const width = contentWidth();

  for (const cert of certs) {
    const line = [cert.issuer, cert.year].filter(Boolean).join(" · ");
    const nameH = textHeight(doc, cert.name, FONT.bold, 9.5, width);
    const metaH = line ? textHeight(doc, line, FONT.normal, 8.8, width) : 0;
    const blockH = nameH + metaH + 6;

    y = guardY(doc, y + 2, blockH);

    y = writeText(doc, cert.name, x, y, width, {
      font: FONT.bold,
      size: 9.5,
      color: STYLE.ink,
      after: line ? 1 : 6,
    });

    if (line) {
      y = writeText(doc, line, x, y, width, {
        size: 8.8,
        color: STYLE.muted,
        after: 6,
      });
    }
  }

  return y;
}

function writeProjects(doc: PDFKit.PDFDocument, resume: Resume, startY: number): number {
  if (!resume.projects.length) return startY;

  let y = writeSectionTitle(doc, "Projects", startY + 2);
  const x = contentX();
  const width = contentWidth();

  for (const project of resume.projects) {
    y = guardY(doc, y + 2, 34);
    y = writeText(doc, project.name, x, y, width, {
      font: FONT.bold,
      size: 10.5,
      color: STYLE.ink,
      after: 2,
    });

    if (project.description?.trim()) {
      y = writeText(doc, project.description.trim(), x, y, width, {
        size: 9.15,
        color: STYLE.body,
        after: 3,
      });
    }

    for (const line of project.bullets) {
      y = writeBullet(doc, line, x, y, width, {
        size: 9.05,
        after: 3,
      });
    }

    y += 5;
  }

  return y;
}

export function resumeToPdfBytes(
  resume: Resume,
  template: PdfTemplate | string = "classic",
): Promise<Buffer> {
  void template;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "LETTER", margin: 0 });
    const readable = doc as unknown as Readable;
    readable.on("data", (c: Buffer) => chunks.push(c));
    readable.on("error", reject);
    readable.on("end", () => resolve(Buffer.concat(chunks)));

    let y = writeHeader(doc, resume);
    y = writeSkills(doc, resume, y);
    y = writeExperience(doc, resume, y);
    y = writeEducation(doc, resume, y);
    y = writeCertifications(doc, resume, y);
    writeProjects(doc, resume, y);

    doc.end();
  });
}
