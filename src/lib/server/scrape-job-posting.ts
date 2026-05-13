import * as cheerio from "cheerio";
import { decode } from "he";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 12_000;
const MIN_DESCRIPTION_CHARS = 20;
const MAX_DESCRIPTION_CHARS = 50_000;

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; TailorResumeBot/1.0; +https://example.invalid/bot)",
  Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
} as const;

/** Tags whose boundaries should become line breaks when flattening HTML to text. */
const BLOCK_TAGS_FOR_BREAK = [
  "address",
  "article",
  "aside",
  "blockquote",
  "div",
  "dl",
  "dt",
  "dd",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "table",
  "tbody",
  "tfoot",
  "thead",
  "tr",
  "td",
  "th",
  "ul",
];

function finalizeJobDescriptionText(raw: string): string {
  let s = decode(raw.trim());
  s = s.replace(/\u00A0/g, " ").replace(/&nbsp;/gi, " ");
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n");
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  return s.slice(0, MAX_DESCRIPTION_CHARS);
}

function extractStructuredPlainText($: cheerio.CheerioAPI, selector: string): string {
  const root = $(selector).first();
  if (!root.length) return "";

  root.find("br").replaceWith("\n");

  for (const tag of BLOCK_TAGS_FOR_BREAK) {
    root.find(tag).each((_, el) => {
      $(el).append("\n");
    });
  }

  return root.text();
}

/** Block obvious SSRF targets (localhost, private IPv4, common non-public IPv6). */
export function isBlockedFetchHost(hostname: string): boolean {
  const h = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "0.0.0.0") return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 127) return true;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
  }

  if (h === "::1") return true;
  if (h.startsWith("fe80:")) return true;
  if (/^f[cd][0-9a-f]:/i.test(h)) return true;

  return false;
}

export function assertPublicHttpUrl(urlString: string): URL {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed");
  }
  if (url.username || url.password) {
    throw new Error("URLs with credentials are not allowed");
  }
  if (isBlockedFetchHost(url.hostname)) {
    throw new Error("This URL cannot be fetched");
  }
  return url;
}

async function readResponseBodyLimited(
  res: Response,
  maxBytes: number,
): Promise<ArrayBuffer> {
  const reader = res.body?.getReader();
  if (!reader) {
    const buf = await res.arrayBuffer();
    if (buf.byteLength > maxBytes) {
      throw new Error("Page is too large to fetch");
    }
    return buf;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value.byteLength) {
      total += value.byteLength;
      if (total > maxBytes) {
        reader.releaseLock();
        throw new Error("Page is too large to fetch");
      }
      chunks.push(value);
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out.buffer;
}

function htmlToPlainText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, iframe").remove();

  const ogDesc = $('meta[property="og:description"]').attr("content") ?? "";
  const ogFinal = finalizeJobDescriptionText(ogDesc);
  if (ogFinal.length >= MIN_DESCRIPTION_CHARS) return ogFinal;

  const metaDesc = $('meta[name="description"]').attr("content") ?? "";
  const metaFinal = finalizeJobDescriptionText(metaDesc);
  if (metaFinal.length >= MIN_DESCRIPTION_CHARS) return metaFinal;

  const articleFinal = finalizeJobDescriptionText(extractStructuredPlainText($, "article"));
  if (articleFinal.length >= MIN_DESCRIPTION_CHARS) return articleFinal;

  const mainFinal = finalizeJobDescriptionText(extractStructuredPlainText($, "main"));
  if (mainFinal.length >= MIN_DESCRIPTION_CHARS) return mainFinal;

  return finalizeJobDescriptionText(extractStructuredPlainText($, "body"));
}

export type ScrapeJobOk = { ok: true; job_description: string };
export type ScrapeJobErr = { ok: false; message: string };
export type ScrapeJobResult = ScrapeJobOk | ScrapeJobErr;

export async function scrapeJobPostingFromUrl(urlString: string): Promise<ScrapeJobResult> {
  let url: URL;
  try {
    url = assertPublicHttpUrl(urlString);
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Invalid URL",
    };
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);

  try {
    const html = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      headers: { ...FETCH_HEADERS },
      signal: ac.signal,
    }).then(async (res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const buf = await readResponseBodyLimited(res, MAX_BODY_BYTES);
      return new TextDecoder("utf-8", { fatal: false }).decode(buf);
    });

    const text = htmlToPlainText(html);
    if (text.length < MIN_DESCRIPTION_CHARS) {
      return {
        ok: false,
        message:
          "Could not extract enough text from this page. Paste the job description manually.",
      };
    }
    return { ok: true, job_description: text };
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.name === "AbortError"
          ? "Request timed out."
          : e.message
        : "Failed to fetch job page.";
    return {
      ok: false,
      message:
        msg.length > 200
          ? `${msg.slice(0, 200)}…`
          : `${msg} Paste the job description manually if this keeps failing.`,
    };
  } finally {
    clearTimeout(timer);
  }
}
