const MONTH_ABBREVIATIONS: Record<string, string> = {
  january: "Jan",
  jan: "Jan",
  february: "Feb",
  feb: "Feb",
  march: "Mar",
  mar: "Mar",
  april: "Apr",
  apr: "Apr",
  may: "May",
  june: "Jun",
  jun: "Jun",
  july: "Jul",
  jul: "Jul",
  august: "Aug",
  aug: "Aug",
  september: "Sep",
  sept: "Sep",
  sep: "Sep",
  october: "Oct",
  oct: "Oct",
  november: "Nov",
  nov: "Nov",
  december: "Dec",
  dec: "Dec",
};

const MONTH_PATTERN = new RegExp(
  `\\b(${Object.keys(MONTH_ABBREVIATIONS).join("|")})\\.?\\s+(\\d{4})\\b`,
  "gi",
);

export function formatResumeDateRange(dateRange: string): string {
  return dateRange
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*(?:-|–|—|\bto\b)\s*/gi, " - ")
    .replace(MONTH_PATTERN, (_match, month: string, year: string) => {
      return `${MONTH_ABBREVIATIONS[month.toLowerCase()]} ${year}`;
    });
}
