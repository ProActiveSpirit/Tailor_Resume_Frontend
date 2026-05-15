import type { Readable } from "stream";
import PDFDocument from "pdfkit";
import { formatResumeDateRange } from "@/lib/resume-date-format";
import { contactLines } from "@/lib/resume-contact-lines";
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
  ink: "#17202a",
  body: "#263442",
  muted: "#657386",
  accent: "#225e66",
  accentDark: "#153e46",
  divider: "#d4dde4",
  sidebarBg: "#f4f8f9",
  sidebarInk: "#25323f",
  sidebarMuted: "#667583",
} as const;

const PAGE = {
  marginX: 0.48 * INCH,
  top: 0.5 * INCH,
  bottom: 0.5 * INCH,
  sidebarW: 188,
  gutter: 26,
} as const;

function stripBulletPrefix(line: string): string {
  return line.trim().replace(/^[•\-\*]\s*/, "");
}

function bottomY(): number {
  return LETTER_H - PAGE.bottom;
}

function mainX(): number {
  return PAGE.marginX + PAGE.sidebarW + PAGE.gutter;
}

function mainWidth(): number {
  return LETTER_W - mainX() - PAGE.marginX;
}

function drawPageFrame(doc: PDFKit.PDFDocument): void {
  doc
    .save()
    .rect(0, 0, PAGE.marginX + PAGE.sidebarW + 14, LETTER_H)
    .fill(STYLE.sidebarBg)
    .restore();

  doc
    .save()
    .strokeColor(STYLE.divider)
    .lineWidth(0.8)
    .moveTo(PAGE.marginX + PAGE.sidebarW + 14, PAGE.top)
    .lineTo(PAGE.marginX + PAGE.sidebarW + 14, bottomY())
    .stroke()
    .restore();
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

function newMainPage(doc: PDFKit.PDFDocument): number {
  doc.addPage({ size: "LETTER", margin: 0 });
  drawPageFrame(doc);
  return PAGE.top;
}

function guardMainY(
  doc: PDFKit.PDFDocument,
  y: number,
  neededHeight: number,
): number {
  if (y + neededHeight > bottomY()) return newMainPage(doc);
  return y;
}

function drawSectionTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  x: number,
  y: number,
  width: number,
  variant: "sidebar" | "main",
): number {
  const isSidebar = variant === "sidebar";
  const size = isSidebar ? 8.5 : 10;
  const color = isSidebar ? STYLE.accentDark : STYLE.accent;
  const ruleY = y + size + 7;

  doc
    .font(FONT.bold)
    .fontSize(size)
    .fillColor(color)
    .text(title.toUpperCase(), x, y, {
      width,
      characterSpacing: 0.7,
    });

  doc
    .strokeColor(isSidebar ? "#cbd8dd" : STYLE.accent)
    .lineWidth(isSidebar ? 0.5 : 0.8)
    .moveTo(x, ruleY)
    .lineTo(x + width, ruleY)
    .stroke();

  return ruleY + (isSidebar ? 10 : 12);
}

function writeSidebarBlock(
  doc: PDFKit.PDFDocument,
  title: string,
  y: number,
  writer: (y: number) => number,
): number {
  const x = PAGE.marginX;
  const width = PAGE.sidebarW;
  y = drawSectionTitle(doc, title, x, y, width, "sidebar");
  return writer(y) + 13;
}

function writeMainSectionTitle(
  doc: PDFKit.PDFDocument,
  title: string,
  y: number,
): number {
  y = guardMainY(doc, y, 30);
  return drawSectionTitle(doc, title, mainX(), y, mainWidth(), "main");
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
  const yy = options.guard === false ? y : guardMainY(doc, y, height + after);

  doc.font(FONT.bold).fontSize(size).fillColor(STYLE.accent).text("•", x, yy, {
    width: bulletW,
  });
  doc.font(FONT.normal).fontSize(size).fillColor(color).text(clean, x + bulletW, yy, {
    width: bodyW,
    lineGap: 1.2,
  });

  return yy + height + after;
}

function writeSidebar(doc: PDFKit.PDFDocument, resume: Resume): void {
  const x = PAGE.marginX;
  const width = PAGE.sidebarW;
  let y = PAGE.top + 2;

  y = writeText(doc, resume.contact.name, x, y, width, {
    font: FONT.bold,
    size: 22,
    color: STYLE.ink,
    after: 4,
  });

  if (resume.target_title?.trim()) {
    y = writeText(doc, resume.target_title.trim(), x, y, width, {
      font: FONT.bold,
      size: 10.5,
      color: STYLE.accent,
      after: 14,
    });
  } else {
    y += 8;
  }

  const lines = contactLines(resume);
  if (lines.length) {
    y = writeSidebarBlock(doc, "Contact", y, (blockY) => {
      let nextY = blockY;
      for (const line of lines) {
        nextY = writeText(doc, line, x, nextY, width, {
          size: 8.6,
          color: STYLE.sidebarMuted,
          after: 5,
        });
      }
      return nextY;
    });
  }

  if (resume.summary.trim()) {
    y = writeSidebarBlock(doc, "Summary", y, (blockY) =>
      writeText(doc, resume.summary.trim(), x, blockY, width, {
        size: 8.7,
        color: STYLE.sidebarInk,
        after: 0,
      }),
    );
  }

  if (resume.skills.length) {
    y += resume.summary.trim() ? 5 : 0;
    y = writeSidebarBlock(doc, "Skills", y, (blockY) => {
      let nextY = blockY;
      for (const skill of resume.skills) {
        nextY = writeBullet(doc, skill, x, nextY, width, {
          size: 8.45,
          color: STYLE.sidebarInk,
          after: 2.5,
          guard: false,
        });
      }
      return nextY;
    });
  }

  if (resume.education.length) {
    writeSidebarBlock(doc, "Education", y, (blockY) => {
      let nextY = blockY;
      for (const edu of resume.education) {
        nextY = writeText(doc, edu.degree, x, nextY, width, {
          font: FONT.bold,
          size: 8.8,
          color: STYLE.sidebarInk,
          after: 2,
        });
        nextY = writeText(doc, edu.institution, x, nextY, width, {
          size: 8.4,
          color: STYLE.sidebarMuted,
          after: 2,
        });
        const meta = [edu.dates, edu.details].filter(Boolean).join(" | ");
        if (meta) {
          nextY = writeText(doc, meta, x, nextY, width, {
            size: 8.2,
            color: STYLE.sidebarMuted,
            after: 8,
          });
        } else {
          nextY += 6;
        }
      }
      return nextY;
    });
  }
}

function writeExperience(doc: PDFKit.PDFDocument, resume: Resume, startY: number): number {
  let y = writeMainSectionTitle(doc, "Experience", startY);

  for (const exp of resume.experience) {
    const companyLine = exp.company + (exp.location ? ` | ${exp.location}` : "");
    const dateText = formatResumeDateRange(exp.dates ?? "");
    const roleW = mainWidth() * 0.62;
    const dateGap = 14;
    const dateW = mainWidth() - roleW - dateGap;
    const titleH = textHeight(doc, exp.title, FONT.bold, 11.25, roleW);
    const companyH = textHeight(doc, companyLine, FONT.normal, 9.3, roleW);
    const dateH = dateText
      ? textHeight(doc, dateText, FONT.italic, 8.8, dateW, { align: "right" })
      : 0;
    const headerH = Math.max(titleH + companyH + 4, dateH) + 4;

    y = guardMainY(doc, y + 3, headerH + 18);

    doc.font(FONT.bold).fontSize(11.25).fillColor(STYLE.ink).text(exp.title, mainX(), y, {
      width: roleW,
      lineGap: 0.5,
    });

    if (dateText) {
      doc
        .font(FONT.italic)
        .fontSize(8.8)
        .fillColor(STYLE.muted)
        .text(dateText, mainX() + roleW + dateGap, y + 1, {
          width: dateW,
          align: "right",
        });
    }

    doc
      .font(FONT.normal)
      .fontSize(9.3)
      .fillColor(STYLE.accent)
      .text(companyLine, mainX(), y + titleH + 1, {
        width: roleW,
      });

    y += headerH;

    for (const line of exp.bullets) {
      y = writeBullet(doc, line, mainX(), y, mainWidth(), {
        size: 9.15,
        after: 3.4,
      });
    }

    y += 6;
  }

  return y;
}

function writeProjects(doc: PDFKit.PDFDocument, resume: Resume, startY: number): number {
  if (!resume.projects.length) return startY;

  let y = writeMainSectionTitle(doc, "Projects", startY + 5);

  for (const project of resume.projects) {
    y = guardMainY(doc, y + 2, 34);
    y = writeText(doc, project.name, mainX(), y, mainWidth(), {
      font: FONT.bold,
      size: 10.5,
      color: STYLE.ink,
      after: 2,
    });

    if (project.description?.trim()) {
      y = writeText(doc, project.description.trim(), mainX(), y, mainWidth(), {
        size: 9.15,
        color: STYLE.body,
        after: 3,
      });
    }

    for (const line of project.bullets) {
      y = writeBullet(doc, line, mainX(), y, mainWidth(), {
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

    drawPageFrame(doc);
    writeSidebar(doc, resume);

    let y = PAGE.top + 3;
    y = writeExperience(doc, resume, y);
    writeProjects(doc, resume, y);

    doc.end();
  });
}
