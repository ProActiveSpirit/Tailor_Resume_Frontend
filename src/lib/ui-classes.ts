import type { CSSProperties } from "react";

export const displayTitleStyle: CSSProperties = {
  fontFamily: "var(--font-display), ui-serif, Georgia, serif",
};

/** Preview chrome, editor drawer title, ATS panel title */
export const uiPanelTitle =
  "text-base font-semibold tracking-tight text-stone-900 sm:text-lg";

/** Primary field labels */
export const uiFieldLabel =
  "block text-sm font-semibold text-stone-800";

/** Helper lines under fields and panel subtitles */
export const uiFieldHint =
  "text-xs leading-relaxed text-stone-500";

/** Uppercase section labels (e.g. Model & editors, ATS breakdown) */
export const uiSectionEyebrow =
  "text-xs font-semibold uppercase tracking-wider text-stone-600";

/** Compact controls (e.g. checkbox label row) */
export const uiCompactLabel =
  "text-xs font-medium text-stone-600";

/** Emphasis inside hint paragraphs */
export const uiHintEmphasis = "font-semibold text-stone-700";

/** Resume preview section headings */
export const uiResumePreviewSectionTitle =
  "mb-2 text-xs font-semibold uppercase tracking-wider text-stone-600";

/** Contact/meta line under name in resume preview */
export const uiResumeContactMeta =
  "text-sm leading-relaxed text-stone-500";

/** Card form intro under an h2 */
export const uiFormDescription =
  "mt-1 max-w-xl text-sm leading-relaxed text-stone-600";

/** Page subtitle under display h1 */
export const uiPageSubtitle =
  "mt-2 max-w-xl text-sm leading-relaxed text-stone-600";
