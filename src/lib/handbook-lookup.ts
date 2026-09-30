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
  "Official maximum and minimum Pell Grant amounts are published separately by the Department of Education (for example, in the award year's Pell payment and disbursement schedules). They are not taken from handbook examples.";

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
