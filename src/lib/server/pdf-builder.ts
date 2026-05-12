import type { Readable } from "stream";
import PDFDocument from "pdfkit";
import type { PdfTemplate, Resume } from "@/lib/types";

const LETTER_W = 612;
const LETTER_H = 792;

const I = 72;

/** Built-in PDF fonts (fallback when custom TTFs are not bundled). */
const SANS = {
  normal: "Helvetica",
  bold: "Helvetica-Bold",
  italic: "Helvetica-Oblique",
} as const;

const SERIF = {
  normal: "Times-Roman",
  bold: "Times-Bold",
  italic: "Times-Italic",
} as const;

type FontSet = typeof SANS | typeof SERIF;

interface Theme {
  f: FontSet;
  ink: string;
  muted: string;
  accent: string;
  left: number;
  right: number;
  top: number;
  bottom: number;
  nameSize: number;
  nameLeading: number;
  nameGap: number;
  titleSize: number;
  titleLeading: number;
  titleGap: number;
  sectionSize: number;
  sectionLeading: number;
  sectionBefore: number;
  sectionAfter: number;
  bodySize: number;
  bodyLeading: number;
  bodyGap: number;
  bulletSize: number;
  bulletLeading: number;
  bulletIndent: number;
  bulletGap: number;
  roleSize: number;
  roleLeading: number;
  companySize: number;
  companyLeading: number;
  dateSize: number;
  dateLeading: number;
  dateBold: boolean;
  dateItalic: boolean;
  sectionTitleColor: string;
  titleBold: boolean;
  sectionRuleAfterHeader: boolean;
  ruleAfterHeaderThickness: number;
  ruleAfterContent: number;
  topAccentRule: boolean;
  topAccentThickness: number;
  topAccentGap: number;
  expFirstGap: number;
  expRestGap: number;
  contactMetaGap: number;
}

function stripBulletPrefix(line: string): string {
  return line.trim().replace(/^[•\-\*]\s*/, "");
}

function contentWidth(t: Theme): number {
  return LETTER_W - t.left - t.right;
}

function resolveTemplate(t: PdfTemplate | string): PdfTemplate {
  if (t === "classic" || t === "minimal" || t === "structured" || t === "editorial")
    return t;
  return "classic";
}

function buildTheme(template: PdfTemplate): Theme {
  if (template === "classic") {
    return {
      f: SANS,
      ink: "#1c1f26",
      muted: "#5a6678",
      accent: "#2f5f62",
      left: 0.72 * I,
      right: 0.72 * I,
      top: 0.62 * I,
      bottom: 0.62 * I,
      nameSize: 21,
      nameLeading: 26,
      nameGap: 3,
      titleSize: 11.5,
      titleLeading: 14.5,
      titleGap: 8,
      sectionSize: 10.5,
      sectionLeading: 13,
      sectionBefore: 11,
      sectionAfter: 5,
      bodySize: 10.25,
      bodyLeading: 14,
      bodyGap: 8,
      bulletSize: 10.25,
      bulletLeading: 14,
      bulletIndent: 15,
      bulletGap: 4,
      roleSize: 10.75,
      roleLeading: 13,
      companySize: 10,
      companyLeading: 13,
      dateSize: 9.25,
      dateLeading: 12,
      dateBold: false,
      dateItalic: false,
      sectionTitleColor: "#2f5f62",
      titleBold: true,
      sectionRuleAfterHeader: false,
      ruleAfterHeaderThickness: 0,
      ruleAfterContent: 0,
      topAccentRule: false,
      topAccentThickness: 0,
      topAccentGap: 0,
      expFirstGap: 0.12 * I,
      expRestGap: 0.08 * I,
      contactMetaGap: 0.09 * I,
    };
  }
  if (template === "minimal") {
    return {
      f: SANS,
      ink: "#22262e",
      muted: "#6b7280",
      accent: "#4b5563",
      left: 0.82 * I,
      right: 0.82 * I,
      top: 0.72 * I,
      bottom: 0.72 * I,
      nameSize: 20,
      nameLeading: 25,
      nameGap: 4,
      titleSize: 11,
      titleLeading: 14,
      titleGap: 10,
      sectionSize: 9.5,
      sectionLeading: 12,
      sectionBefore: 13,
      sectionAfter: 6,
      bodySize: 10.25,
      bodyLeading: 14.25,
      bodyGap: 9,
      bulletSize: 10.25,
      bulletLeading: 14.25,
      bulletIndent: 16,
      bulletGap: 4,
      roleSize: 10.5,
      roleLeading: 13,
      companySize: 10,
      companyLeading: 13,
      dateSize: 9.25,
      dateLeading: 12,
      dateBold: false,
      dateItalic: false,
      sectionTitleColor: "#4b5563",
      titleBold: false,
      sectionRuleAfterHeader: false,
      ruleAfterHeaderThickness: 0,
      ruleAfterContent: 0,
      topAccentRule: false,
      topAccentThickness: 0,
      topAccentGap: 0,
      expFirstGap: 0.12 * I,
      expRestGap: 0.08 * I,
      contactMetaGap: 0.09 * I,
    };
  }
  if (template === "structured") {
    return {
      f: SANS,
      ink: "#0f1419",
      muted: "#566173",
      accent: "#1e3a5f",
      left: 0.68 * I,
      right: 0.68 * I,
      top: 0.58 * I,
      bottom: 0.58 * I,
      nameSize: 22,
      nameLeading: 27,
      nameGap: 2,
      titleSize: 11.5,
      titleLeading: 14.5,
      titleGap: 8,
      sectionSize: 10.5,
      sectionLeading: 13,
      sectionBefore: 12,
      sectionAfter: 4,
      bodySize: 10.25,
      bodyLeading: 14,
      bodyGap: 7,
      bulletSize: 10.25,
      bulletLeading: 14,
      bulletIndent: 15,
      bulletGap: 4,
      roleSize: 10.75,
      roleLeading: 13,
      companySize: 10,
      companyLeading: 13,
      dateSize: 9.5,
      dateLeading: 12,
      dateBold: true,
      dateItalic: false,
      sectionTitleColor: "#0f1419",
      titleBold: true,
      sectionRuleAfterHeader: true,
      ruleAfterHeaderThickness: 0.55,
      ruleAfterContent: 0.07 * I,
      topAccentRule: true,
      topAccentThickness: 0.75,
      topAccentGap: 0.11 * I,
      expFirstGap: 0.12 * I,
      expRestGap: 0.08 * I,
      contactMetaGap: 0.09 * I,
    };
  }
  return {
    f: SERIF,
    ink: "#1c1917",
    muted: "#78716c",
    accent: "#57534e",
    left: 0.78 * I,
    right: 0.78 * I,
    top: 0.68 * I,
    bottom: 0.68 * I,
    nameSize: 22,
    nameLeading: 27,
    nameGap: 4,
    titleSize: 11.5,
    titleLeading: 14.5,
    titleGap: 8,
    sectionSize: 11,
    sectionLeading: 13.5,
    sectionBefore: 11,
    sectionAfter: 6,
    bodySize: 10.5,
    bodyLeading: 14.25,
    bodyGap: 8,
    bulletSize: 10.5,
    bulletLeading: 14.25,
    bulletIndent: 18,
    bulletGap: 4,
    roleSize: 11,
    roleLeading: 13.5,
    companySize: 10.25,
    companyLeading: 13.5,
    dateSize: 10,
    dateLeading: 13,
    dateBold: false,
    dateItalic: true,
    sectionTitleColor: "#57534e",
    titleBold: true,
    sectionRuleAfterHeader: false,
    ruleAfterHeaderThickness: 0,
    ruleAfterContent: 0,
    topAccentRule: false,
    topAccentThickness: 0,
    topAccentGap: 0,
    expFirstGap: 0.12 * I,
    expRestGap: 0.08 * I,
    contactMetaGap: 0.09 * I,
  };
}

function bodyInk(theme: Theme): string {
  return theme.f === SERIF ? "#292524" : theme.ink;
}

function newPageY(doc: PDFKit.PDFDocument, theme: Theme): number {
  doc.addPage({ size: "LETTER", margin: 0 });
  return theme.top;
}

/** If block at `y` needs `delta` points, move to new page when it would cross bottom margin. */
function guardY(
  doc: PDFKit.PDFDocument,
  y: number,
  delta: number,
  theme: Theme,
): number {
  if (y + delta > LETTER_H - theme.bottom) return newPageY(doc, theme);
  return y;
}

function drawHr(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  thickness: number,
  color: string,
): number {
  doc
    .strokeColor(color)
    .lineWidth(thickness)
    .moveTo(x, y)
    .lineTo(x + width, y)
    .stroke();
  return y;
}

export function resumeToPdfBytes(
  resume: Resume,
  template: PdfTemplate | string = "classic",
): Promise<Buffer> {
  const tpl = resolveTemplate(template);
  const theme = buildTheme(tpl);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "LETTER", margin: 0 });
    const readable = doc as unknown as Readable;
    readable.on("data", (c: Buffer) => chunks.push(c));
    readable.on("error", reject);
    readable.on("end", () => resolve(Buffer.concat(chunks)));

    const cw = contentWidth(theme);
    const x0 = theme.left;
    let y = theme.top;

    const write = (
      text: string,
      font: string,
      size: number,
      color: string,
      x: number,
      yi: number,
      width: number,
      lineGap: number,
      align?: PDFKit.Mixins.TextOptions["align"],
    ): number => {
      doc.font(font).fontSize(size).fillColor(color);
      const h = doc.heightOfString(text, { width, align });
      const yy = guardY(doc, yi, h + lineGap, theme);
      doc.font(font).fontSize(size).fillColor(color);
      doc.text(text, x, yy, { width, align, lineGap: 0 });
      return yy + h + lineGap;
    };

    y = write(
      resume.contact.name,
      theme.f.bold,
      theme.nameSize,
      theme.ink,
      x0,
      y,
      cw,
      theme.nameGap,
    );

    if (resume.target_title) {
      y = write(
        resume.target_title,
        theme.titleBold ? theme.f.bold : theme.f.normal,
        theme.titleSize,
        theme.muted,
        x0,
        y,
        cw,
        theme.titleGap,
      );
    }

    const contactBits: string[] = [];
    if (resume.contact.email) contactBits.push(resume.contact.email);
    if (resume.contact.phone) contactBits.push(resume.contact.phone);
    if (resume.contact.location) contactBits.push(resume.contact.location);
    if (resume.contact.linkedin) contactBits.push(resume.contact.linkedin);
    if (resume.contact.website) contactBits.push(resume.contact.website);
    if (contactBits.length > 0) {
      y = write(
        contactBits.join(" · "),
        theme.f.normal,
        theme.bodySize,
        bodyInk(theme),
        x0,
        y,
        cw,
        theme.contactMetaGap,
      );
    }

    if (theme.topAccentRule) {
      y = guardY(doc, y, theme.topAccentGap + 2, theme);
      drawHr(doc, x0, y, cw, theme.topAccentThickness, theme.accent);
      y += theme.topAccentGap + 2;
    }

    const section = (title: string): void => {
      y = guardY(doc, y, theme.sectionLeading + theme.sectionBefore + 8, theme);
      doc
        .font(theme.f.bold)
        .fontSize(theme.sectionSize)
        .fillColor(theme.sectionTitleColor)
        .text(title, x0, y + theme.sectionBefore, { width: cw });
      y += theme.sectionBefore + theme.sectionLeading;

      if (theme.sectionRuleAfterHeader) {
        y = drawHr(doc, x0, y, cw, theme.ruleAfterHeaderThickness, theme.accent);
        y += theme.ruleAfterContent;
      }
      y += theme.sectionAfter;
    };

    section("Summary");
    y = write(
      resume.summary,
      theme.f.normal,
      theme.bodySize,
      bodyInk(theme),
      x0,
      y,
      cw,
      theme.bodyGap,
    );

    section("Skills");
    {
      const mid = Math.ceil(resume.skills.length / 2);
      const left = resume.skills.slice(0, mid).join(", ");
      const right = resume.skills.slice(mid).join(", ");
      const half = cw * 0.5;
      doc.font(theme.f.normal).fontSize(theme.bodySize).fillColor(bodyInk(theme));
      const h1 = doc.heightOfString(left, { width: half - 10 });
      const h2 = right
        ? doc.heightOfString(right, { width: half })
        : 0;
      const blockH = Math.max(h1, h2) + 2;
      y = guardY(doc, y, blockH, theme);
      doc.font(theme.f.normal).fontSize(theme.bodySize).fillColor(bodyInk(theme));
      doc.text(left, x0, y, { width: half - 10 });
      if (right) doc.text(right, x0 + half, y, { width: half });
      y += blockH;
    }

    section("Experience");
    resume.experience.forEach((exp, i) => {
      const spaceBefore = i === 0 ? theme.expFirstGap : theme.expRestGap;
      y += spaceBefore;

      const leftW = cw * 0.72;
      const rightW = cw * 0.28;
      const dateStr = exp.dates ?? "";

      const titleBlock = exp.title;
      const companyLine =
        exp.company + (exp.location ? ` · ${exp.location}` : "");

      doc.font(theme.f.bold).fontSize(theme.roleSize).fillColor(theme.ink);
      const hTitle = doc.heightOfString(titleBlock, { width: leftW });
      doc.font(theme.f.normal).fontSize(theme.companySize).fillColor(theme.muted);
      const hCo = doc.heightOfString(companyLine, { width: leftW });
      const dateFont = theme.dateItalic
        ? theme.f.italic
        : theme.dateBold
          ? theme.f.bold
          : theme.f.normal;
      doc.font(dateFont).fontSize(theme.dateSize).fillColor(theme.dateBold ? theme.accent : theme.muted);
      const hDate = dateStr
        ? doc.heightOfString(dateStr, { width: rightW, align: "right" })
        : 0;
      const rowH = Math.max(hTitle + hCo, hDate) + 3;
      y = guardY(doc, y, rowH, theme);

      doc.font(theme.f.bold).fontSize(theme.roleSize).fillColor(theme.ink);
      doc.text(titleBlock, x0, y, { width: leftW });
      if (dateStr) {
        doc
          .font(dateFont)
          .fontSize(theme.dateSize)
          .fillColor(theme.dateBold ? theme.accent : theme.muted)
          .text(dateStr, x0 + leftW, y, {
            width: rightW,
            align: "right",
          });
      }
      doc
        .font(theme.f.normal)
        .fontSize(theme.companySize)
        .fillColor(theme.muted)
        .text(companyLine, x0, y + hTitle, { width: leftW });
      y += rowH;

      for (const line of exp.bullets) {
        const t = stripBulletPrefix(line);
        if (!t) continue;
        const bulletText = `• ${t}`;
        const w = cw - theme.bulletIndent;
        doc.font(theme.f.normal).fontSize(theme.bulletSize).fillColor(bodyInk(theme));
        const bh = doc.heightOfString(bulletText, { width: w });
        y = guardY(doc, y, bh + theme.bulletGap, theme);
        doc
          .font(theme.f.normal)
          .fontSize(theme.bulletSize)
          .fillColor(bodyInk(theme))
          .text(bulletText, x0 + theme.bulletIndent, y, { width: w });
        y += bh + theme.bulletGap;
      }
    });

    if (resume.education.length > 0) {
      section("Education");
      resume.education.forEach((edu, j) => {
        const spaceBefore = j === 0 ? theme.expFirstGap : theme.expRestGap;
        y += spaceBefore;
        const leftW = cw * 0.72;
        const rightW = cw * 0.28;
        const dateStr = edu.dates ?? "";
        const titleBlock = edu.degree;
        const inst = edu.institution;

        doc.font(theme.f.bold).fontSize(theme.roleSize).fillColor(theme.ink);
        const hTitle = doc.heightOfString(titleBlock, { width: leftW });
        doc.font(theme.f.normal).fontSize(theme.companySize).fillColor(theme.muted);
        const hCo = doc.heightOfString(inst, { width: leftW });
        const eduDateFont = theme.dateItalic
          ? theme.f.italic
          : theme.dateBold
            ? theme.f.bold
            : theme.f.normal;
        const eduDateColor = theme.dateBold ? theme.accent : theme.muted;
        doc.font(eduDateFont).fontSize(theme.dateSize).fillColor(eduDateColor);
        const hDate = dateStr
          ? doc.heightOfString(dateStr, { width: rightW, align: "right" })
          : 0;
        const rowH = Math.max(hTitle + hCo, hDate) + 3;
        y = guardY(doc, y, rowH, theme);

        doc.font(theme.f.bold).fontSize(theme.roleSize).fillColor(theme.ink);
        doc.text(titleBlock, x0, y, { width: leftW });
        if (dateStr) {
          doc
            .font(eduDateFont)
            .fontSize(theme.dateSize)
            .fillColor(eduDateColor)
            .text(dateStr, x0 + leftW, y, { width: rightW, align: "right" });
        }
        doc
          .font(theme.f.normal)
          .fontSize(theme.companySize)
          .fillColor(theme.muted)
          .text(inst, x0, y + hTitle, { width: leftW });
        y += rowH;

        if (edu.details) {
          y = write(
            edu.details,
            theme.f.normal,
            theme.bodySize,
            bodyInk(theme),
            x0,
            y,
            cw,
            theme.bodyGap,
          );
        }
      });
    }

    if (resume.projects.length > 0) {
      section("Projects");
      for (const proj of resume.projects) {
        y = write(
          proj.name,
          theme.f.bold,
          theme.roleSize,
          theme.ink,
          x0,
          y,
          cw,
          2,
        );
        if (proj.description) {
          y = write(
            proj.description,
            theme.f.normal,
            theme.bodySize,
            bodyInk(theme),
            x0,
            y,
            cw,
            theme.bodyGap,
          );
        }
        for (const line of proj.bullets) {
          const t = stripBulletPrefix(line);
          if (!t) continue;
          const bulletText = `• ${t}`;
          const w = cw - theme.bulletIndent;
          doc.font(theme.f.normal).fontSize(theme.bulletSize).fillColor(bodyInk(theme));
          const bh = doc.heightOfString(bulletText, { width: w });
          y = guardY(doc, y, bh + theme.bulletGap, theme);
          doc
            .font(theme.f.normal)
            .fontSize(theme.bulletSize)
            .fillColor(bodyInk(theme))
            .text(bulletText, x0 + theme.bulletIndent, y, { width: w });
          y += bh + theme.bulletGap;
        }
      }
    }

    doc.end();
  });
}
