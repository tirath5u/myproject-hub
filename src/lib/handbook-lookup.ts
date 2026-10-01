// Pure helpers for handbook passages in Ask Regs (no `@/` imports, no network) — unit-tested.

/** Sections are identified by document version + heading, never heading alone ("Introduction" exists in several chapters). */
export const sectionKey = (r: { document_version_key: string; heading: string }) => `${r.document_version_key}\u0000${r.heading}`;

export type ChapterId = { volume: number; chapter: number };
/** Volume/chapter of a stored handbook document, from its key, then its URL, then its title. */
export function chapterOf(r: { document_version_key?: string | null; official_url?: string | null; title?: string | null }): ChapterId | null {
  const m = r.document_version_key?.match(/:vol(\d+):ch(\d+):/i)
    ?? r.official_url?.match(/\/vol(\d+)\/ch(\d+)(?:-|$|\/)/i)
    ?? r.title?.match(/\bVol(?:ume|\.)?\s*(\d+),?\s*(?:Chapter|Ch\.?)\s*(\d+)/i);
  return m ? { volume: Number(m[1]), chapter: Number(m[2]) } : null;
}
export const chapterLabel = (c: ChapterId) => `Vol ${c.volume} Ch ${c.chapter}`;

const EXAMPLE_HEADING = /\bExample \d+/;
export const headingIsExample = (heading: string) => EXAMPLE_HEADING.test(heading);
/** Fallback when the flag columns are missing (v1 lookup): text carrying the fictional-amount note. */
export const textHasFictionalNote = (text: string) => /\bfictional\b[^.]*\b(maximum|minimum)\b/i.test(text);

export const FICTIONAL_WARNING =
  "Fictional amounts: handbook examples use made-up maximum and minimum Pell Grant amounts for illustration. Don't use them for packaging; the official amounts for the award year are published separately.";
export const OFFICIAL_AMOUNT_NOTICE =
  "Ask Regs doesn't state the official maximum or minimum Pell Grant amount. Official amounts are published separately by the Department of Education for each award year (for example, in its Pell payment and disbursement schedules). The handbook's worked examples use made-up amounts, so they are never shown as the answer.";

/** Questions asking for the actual maximum or minimum Pell amount (not eligibility for it). */
export function asksPellAmount(q: string) {
  if (!/\bpell\b/i.test(q) || !/\b(maximum|minimum|max|min|largest|smallest)\b/i.test(q)) return false;
  return /\bamounts?\b|\bhow much\b|\bdollars?\b|\$|\bvalue\b/i.test(q);
}

export type LookNextLink = { label: string; url: string; imported: boolean };
/**
 * "Where to look next": cross-references to other handbook chapters. The passage's own chapter is skipped;
 * chapters already imported are marked `imported` (ask about them here) and link to the chapter page when known.
 */
export function lookNext(
  text: string, awardYear: string, own: ChapterId | null,
  imported: Map<string, string> = new Map(), // "7:3" → official chapter URL
) {
  const yr = awardYear.replace(/^(\d{4})-(\d{2})$/, (_m, a: string, b: string) => `${a}-20${b}`);
  const refs: { v: number; c: number | null; at: number }[] = [];
  const spans: [number, number][] = [];
  // "Chapter 1 of Volume 3" / "Chapter 3 of this volume"
  for (const m of text.matchAll(/\bChapter\s*(\d{1,2})\s+of\s+(?:(this volume)|(?:Volume|Vol\.)\s*(\d{1,2}))/gi)) {
    spans.push([m.index, m.index + m[0].length]);
    const v = m[2] ? own?.volume : Number(m[3]);
    if (v) refs.push({ v, c: Number(m[1]), at: m.index });
  }
  // "Volume 3, Chapter 1" / "Vol. 3" (not "Volume 7, Chapter 2, Example 1", nor the volume inside "Chapter 1 of Volume 3")
  for (const m of text.matchAll(/\b(?:Volume|Vol\.)\s*(\d{1,2})(?:,?\s*(?:Chapter|Ch\.)\s*(\d{1,2}))?(?!,?\s*(?:Chapter\s*\d+,\s*)?Example)/g))
    if (!spans.some(([a, b]) => m.index >= a && m.index < b)) refs.push({ v: Number(m[1]), c: m[2] ? Number(m[2]) : null, at: m.index });
  refs.sort((a, b) => a.at - b.at);
  const seen = new Set<string>();
  const out: LookNextLink[] = [];
  for (const { v, c } of refs) {
    if (own && v === own.volume && (c === own.chapter || c === null)) continue; // this chapter / this volume itself
    const label = `Volume ${v}${c ? `, Chapter ${c}` : ""}`;
    if (seen.has(label)) continue;
    seen.add(label);
    const importedUrl = c ? imported.get(`${v}:${c}`) : undefined;
    out.push({ label, url: importedUrl ?? `https://fsapartners.ed.gov/knowledge-center/fsa-handbook/${yr}/vol${v}`, imported: !!importedUrl });
  }
  return out.slice(0, 4);
}

/** Coverage line built from the documents a lookup actually searched. */
export function coverageText(awardYear: string, docs: { chapter: ChapterId | null; staged: boolean }[]) {
  const uniq = new Map<string, { chapter: ChapterId; staged: boolean }>();
  for (const d of docs) if (d.chapter) uniq.set(chapterLabel(d.chapter), { chapter: d.chapter, staged: d.staged });
  const list = [...uniq.values()].sort((a, b) => a.chapter.volume - b.chapter.volume || a.chapter.chapter - b.chapter.chapter)
    .map((d) => `${chapterLabel(d.chapter)}${d.staged ? " (staged, preview only)" : ""}`);
  return list.length ? `${awardYear} FSA Handbook ${list.join(", ")}; prior award years are stored but excluded` : `none for ${awardYear} yet`;
}

/** Lovable preview hosts (id-preview--….lovable.app, preview--….lovable.app, ….lovableproject.com) and local dev. Published hosts are never preview. */
export const isPreviewHost = (hostname: string) => /(^|[.-])preview--[^.]*\.lovable\.app$|\.lovableproject\.com$|^localhost$|^127\.0\.0\.1$/i.test(hostname);

/**
 * A chapter's topic word appears in more than half of its section headings (e.g. "Pell" in Vol 7 Ch 2).
 * Such a word says nothing about which section answers a question. Needs at least 4 headings to judge.
 */
export function isTopicTerm(term: string, sectionHeadings: string[], hit: (term: string, heading: string) => boolean, minItems = 4) {
  if (sectionHeadings.length < minItems) return false;
  return sectionHeadings.filter((h) => hit(term, h)).length / sectionHeadings.length > 0.5;
}

/** A chapter's title words from its official URL (".../vol7/ch1-student-eligibility-pell-grants" → "student eligibility pell grants"). */
export const chapterTitleWords = (officialUrl: string | null | undefined) =>
  (officialUrl?.split(/[?#]/)[0].split("/").filter(Boolean).pop() ?? "").replace(/^ch\d+-/i, "").replace(/-/g, " ");

/** Numbers a text attaches to "Formula(s)" or "BBAY(s)", including lists and ranges: "Formulas 1, 2, and 4", "Formula 1 through 4". */
export function numberedMentions(text: string, kind: "Formula" | "BBAY") {
  const out = new Set<string>();
  const word = kind === "BBAY" ? "BBAYs?" : "Formulas?";
  const re = new RegExp(`\\b${word}\\s*(\\d+[AB]?)((?:\\s*(?:,\\s*(?:or\\s+|and\\s+)?|or\\s+|and\\s+|&\\s*|through\\s+|to\\s+|[-–]\\s*)\\d+[AB]?\\b)*)`, "gi");
  for (const m of text.matchAll(re)) {
    const tokens = [m[1], ...(m[2].match(/(?:through|to|[-–])\s*\d+[AB]?|\d+[AB]?/gi) ?? [])];
    let prev: number | null = null;
    for (const t of tokens) {
      const n = t.match(/\d+[AB]?/i)![0].toUpperCase();
      if (/^(through|to|[-–])/i.test(t) && prev !== null && /^\d+$/.test(n)) for (let i = prev + 1; i <= Number(n) && i - prev <= 10; i++) out.add(String(i));
      out.add(n);
      prev = /^\d+$/.test(n) ? Number(n) : null;
    }
  }
  if (kind === "BBAY") for (const m of text.matchAll(/Borrower-Based Academic Year (\d+)/gi)) out.add(m[1]);
  return out;
}

/**
 * Numbered variants the question names, each a distinct concept that must be covered on its own:
 * "BBAY 1, BBAY 2, or BBAY 3", "Pell Formula 1, 2, 3, or 4", "Formula 5A". A passage covers a variant when it
 * mentions that number for the same kind, also in list or range form ("Formulas 1 through 4").
 */
export function numberedVariants(q: string) {
  const out: { label: string; test: (text: string) => boolean }[] = [];
  for (const kind of ["BBAY", "Formula"] as const)
    for (const n of numberedMentions(q, kind)) out.push({ label: `${kind} ${n}`, test: (text: string) => numberedMentions(text, kind).has(n) });
  return out;
}

/** Aid programs a question or a chapter can be about. */
const PROGRAMS: [string, RegExp][] = [
  ["pell", /\bpell\b/i],
  ["direct-loan", /\bdirect (?:subsidized |unsubsidized |plus )?loans?\b|\bplus loans?\b|\bdirect loan program\b/i],
  ["teach", /\bteach grants?\b/i],
  ["fseog", /\bfseog\b|\bsupplemental educational opportunity grants?\b/i],
  ["work-study", /\bwork[- ]study\b|\bfws\b/i],
];
export const programsIn = (text: string) => new Set(PROGRAMS.filter(([, re]) => re.test(text)).map(([p]) => p));
/**
 * A passage is off-program when the question names one or more aid programs and the passage's volume is about a
 * different one (e.g. a Direct Loan question and a Pell chapter). Passages from volumes with no program stay in.
 */
export function offProgram(questionPrograms: Set<string>, volumePrograms: Set<string>) {
  if (!questionPrograms.size || !volumePrograms.size) return false;
  return ![...questionPrograms].some((p) => volumePrograms.has(p));
}

/** An answer passage that word search helped find is shown as partial: it matched every term, but that is not proof it answers the whole question. */
export const WORD_ASSISTED_NOTE =
  "Word search helped find this passage, so it is shown as a partial answer: it contains every term in the question but may not answer all of it.";
export const wordAssistedNote = (foundBy: string[]) => (foundBy.includes("words") ? WORD_ASSISTED_NOTE : null);

/**
 * Staged (unreviewed) passages are shown on previews only. Lovable builds previews in "development" mode
 * (dev server or `vite build --mode development`) and the published site in "production" mode, so the build
 * mode is the primary signal; the preview-host check covers previews whose address we recognise.
 */
export const includeStagedFor = (buildMode: string | undefined, hostname: string) => buildMode === "development" || isPreviewHost(hostname);
