// Pure parser for an FSA Handbook chapter page (fsapartners.ed.gov, Drupal markup).
// No `@/` imports and no network: the importer fetches, this module only turns HTML into
// sections, chunks, and the counts the source registry checks before anything is written.

// ---- Minimal HTML tree -------------------------------------------------------
export type HtmlNode = { tag: string; attrs: Record<string, string>; children: (HtmlNode | string)[]; parent: HtmlNode | null };

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW = new Set(["script", "style", "noscript", "template", "svg"]);
// Opening one of these closes an open element of the listed tags first (enough for this markup).
const AUTO_CLOSE: Record<string, string[]> = { li: ["li"], p: ["p"], tr: ["tr", "td", "th"], td: ["td", "th"], th: ["td", "th"] };

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
  ndash: "–", mdash: "—", hellip: "…", bull: "•", sect: "§", dollar: "$", middot: "·", shy: "", zwnj: "", zwj: "",
};
export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cp = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 ? String.fromCodePoint(cp) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function parseHtml(html: string): HtmlNode {
  const root: HtmlNode = { tag: "#root", attrs: {}, children: [], parent: null };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<![^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|[^<]+|</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const [tok, close, open, attrStr, selfClose] = m;
    if (tok.startsWith("<!")) continue;
    if (close) {
      const tag = close.toLowerCase();
      let n: HtmlNode | null = cur;
      while (n && n.tag !== tag) n = n.parent;
      if (n && n.parent) cur = n.parent; // unmatched closing tags are ignored
      continue;
    }
    if (open) {
      const tag = open.toLowerCase();
      const attrs: Record<string, string> = {};
      for (const a of (attrStr ?? "").matchAll(/([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))
        attrs[a[1].toLowerCase()] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? "");
      const closes = AUTO_CLOSE[tag];
      if (closes && closes.includes(cur.tag) && cur.parent) cur = cur.parent;
      const node: HtmlNode = { tag, attrs, children: [], parent: cur };
      cur.children.push(node);
      if (RAW.has(tag)) {
        const end = html.toLowerCase().indexOf(`</${tag}`, re.lastIndex);
        const stop = end < 0 ? html.length : end;
        re.lastIndex = html.indexOf(">", stop) < 0 ? html.length : html.indexOf(">", stop) + 1;
        continue;
      }
      if (!VOID.has(tag) && !selfClose) cur = node;
      continue;
    }
    cur.children.push(decodeEntities(tok));
  }
  return root;
}

const isEl = (n: HtmlNode | string): n is HtmlNode => typeof n !== "string";
export const classes = (n: HtmlNode) => (n.attrs["class"] ?? "").split(/\s+/).filter(Boolean);
export const hasClass = (n: HtmlNode, c: string) => classes(n).includes(c);
export function findAll(n: HtmlNode, pred: (x: HtmlNode) => boolean, out: HtmlNode[] = []) {
  for (const c of n.children) if (isEl(c)) { if (pred(c)) out.push(c); findAll(c, pred, out); }
  return out;
}
export const findFirst = (n: HtmlNode, pred: (x: HtmlNode) => boolean) => findAll(n, pred)[0] ?? null;
const clean = (s: string) => s.replace(/[\s ]+/g, " ").trim();
/** All text on one line. */
export function flatText(n: HtmlNode | string, skip?: (x: HtmlNode) => boolean): string {
  if (!isEl(n)) return n;
  if (skip?.(n)) return "";
  return n.children.map((c) => (isEl(c) && (c.tag === "br" || /^(p|div|li|tr|h[1-6])$/.test(c.tag)) ? ` ${flatText(c, skip)} ` : flatText(c, skip))).join("");
}

// ---- Block text rendering ----------------------------------------------------
const BLOCK = /^(p|div|section|article|header|footer|h[1-6]|blockquote|dl|dt|dd|figure|figcaption|thead|tbody|tfoot)$/;
function renderLines(n: HtmlNode, out: string[], indent = ""): void {
  let buf = "";
  const flush = () => { const t = clean(buf); if (t) out.push(indent + t); buf = ""; };
  for (const c of n.children) {
    if (!isEl(c)) { buf += c; continue; }
    if (c.tag === "br") { flush(); continue; }
    if (c.tag === "ul" || c.tag === "ol") {
      flush();
      for (const li of c.children.filter(isEl).filter((x) => x.tag === "li")) {
        const own = clean(flatText(li, (x) => x.tag === "ul" || x.tag === "ol"));
        if (own) out.push(`${indent}- ${own}`);
        for (const sub of findAll(li, (x) => (x.tag === "ul" || x.tag === "ol") && closestList(x) === li)) renderLines({ ...sub, tag: "div", children: [sub] }, out, `${indent}  `);
      }
      continue;
    }
    if (c.tag === "table") { flush(); out.push(...tableLines(c).map((l) => indent + l)); continue; }
    // Two-column "Step N:" layouts keep the label and its text on one line.
    if (classes(c).some((x) => x.endsWith("5-75-container"))) { flush(); const t = clean(flatText(c)); if (t) out.push(indent + t); continue; }
    if (BLOCK.test(c.tag)) { flush(); renderLines(c, out, indent); continue; }
    buf += flatText(c);
  }
  flush();
}
function closestList(n: HtmlNode) {
  let p = n.parent;
  while (p && p.tag !== "li") p = p.parent;
  return p;
}
function tableRows(t: HtmlNode) {
  return findAll(t, (x) => x.tag === "tr").filter((tr) => { let p = tr.parent; while (p && p.tag !== "table") p = p.parent; return p === t; });
}
function tableLines(t: HtmlNode) {
  return tableRows(t).map((tr) => tr.children.filter(isEl).filter((x) => x.tag === "td" || x.tag === "th").map((td) => clean(flatText(td))).join(" | ")).filter(Boolean);
}
/** Body rows: rows outside <thead> (header rows are not counted). */
export function tableBodyRows(t: HtmlNode) {
  return tableRows(t).filter((tr) => { let p = tr.parent; while (p && p !== t) { if (p.tag === "thead") return false; p = p.parent; } return true; }).length;
}
export function blockText(n: HtmlNode) {
  const out: string[] = [];
  renderLines(n, out);
  return out;
}

// ---- Chapter model -----------------------------------------------------------
export type Piece = { kind: "rule" | "example"; lines: string[]; title?: string };
export type Section = { heading: string; level: 1 | 2 | 3; pieces: Piece[]; tables: { body_rows: number; total_rows: number }[]; margin_notes: number };
export type ParsedChunk = {
  ordinal: number; heading: string; text: string; section_index: number; section_heading: string;
  piece: number; is_example: boolean; fictional_amounts: boolean;
};
export type ParsedChapter = {
  page_title: string | null;
  last_modified: string | null; // YYYY-MM-DD
  page_published: string | null; // FSA page first-published date, NOT the award-year release
  sections: Section[];
  chunks: ParsedChunk[];
  stats: {
    sections: number; headings: string[]; tables: number; table_rows_by_section: Record<string, number[]>;
    examples: number[]; fictional_note: boolean; fictional_amounts: string[]; step_labels: string[]; margin_notes: number; h4_subheadings: number;
  };
};

export const INTRO_HEADING = "Introduction";
const EXAMPLE_TITLE = /\bExample \d+\b/;
const FICTIONAL_NOTE = /\bfictional\b[^.]*\b(maximum|minimum)\b/i;

function paragraphType(n: HtmlNode) {
  for (const c of classes(n)) { const m = c.match(/^paragraph--type--(.+)$/); if (m) return m[1]; }
  return null;
}
function usDate(s: string | undefined) {
  const m = s?.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}

export function parseChapter(html: string): ParsedChapter {
  const root = parseHtml(html);
  const content = findFirst(root, (n) => hasClass(n, "field--name-field-chapter-content"));
  if (!content) throw new Error("chapter content block (field--name-field-chapter-content) not found");
  const pageText = clean(flatText(root));
  const h1 = findFirst(root, (n) => n.tag === "h1");

  // Top-level paragraph blocks only (callouts and two-column layouts nest their own paragraphs).
  const blocks = findAll(content, (n) => {
    if (!paragraphType(n)) return false;
    for (let p = n.parent; p && p !== content; p = p.parent) if (paragraphType(p)) return false;
    return true;
  });

  const sections: Section[] = [{ heading: INTRO_HEADING, level: 1, pieces: [], tables: [], margin_notes: 0 }];
  const cur = () => sections[sections.length - 1];
  const addRule = (lines: string[]) => {
    if (!lines.length) return;
    const s = cur();
    const last = s.pieces[s.pieces.length - 1];
    if (last?.kind === "rule") last.lines.push(...lines);
    else s.pieces.push({ kind: "rule", lines: [...lines] });
  };
  let h4 = 0;
  const fictional = new Set<string>();
  let fictionalNote = false;

  for (const b of blocks) {
    const type = paragraphType(b)!;
    for (const t of findAll(b, (x) => x.tag === "table")) cur().tables.push({ body_rows: tableBodyRows(t), total_rows: tableRows(t).length });
    if (type === "header") {
      const span = findFirst(b, (x) => classes(x).some((c) => /^fsa-header-if-h[2-6]$/.test(c)));
      const hTag = span ? null : findFirst(b, (x) => /^h[2-6]$/.test(x.tag));
      const level = span ? Number(classes(span).find((c) => /^fsa-header-if-h[2-6]$/.test(c))!.slice(-1)) : hTag ? Number(hTag.tag[1]) : 4;
      const text = clean(flatText(span ?? hTag ?? b));
      if (!text) continue;
      if (level <= 3) sections.push({ heading: text, level: level as 2 | 3, pieces: [], tables: [], margin_notes: 0 });
      else { h4++; addRule([text]); } // h4 and below stay inside their section as a sub-heading line
      continue;
    }
    if (type === "accordion") {
      const titleEl = findFirst(b, (x) => x.tag === "h3" && hasClass(x, "mb-0")) ?? findFirst(b, (x) => /^h[2-6]$/.test(x.tag));
      const title = titleEl ? clean(flatText(titleEl)) : "";
      const body = clean(flatText(b, (x) => x === titleEl));
      addRule([`Margin note: ${title}`.trim(), ...(body ? [body] : [])]);
      cur().margin_notes++;
      continue;
    }
    if (type.includes("5-75-container")) {
      const line = clean(flatText(b));
      if (line) addRule([line]);
      continue;
    }
    const lines = blockText(b);
    if (type === "callout" && findFirst({ ...b, children: [b] }, (x) => hasClass(x, "information-callout"))) {
      const strong = findFirst(b, (x) => (x.tag === "strong" || x.tag === "b") && EXAMPLE_TITLE.test(flatText(x)));
      const title = strong ? clean(flatText(strong)).replace(/:$/, "") : null;
      if (title) {
        const body = lines[0] && clean(lines[0]).startsWith(title) ? lines : [title, ...lines];
        cur().pieces.push({ kind: "example", title, lines: body });
        continue;
      }
    }
    const text = lines.join(" ");
    if (FICTIONAL_NOTE.test(text)) {
      fictionalNote = true;
      for (const a of text.match(/\$\d{1,3}(,\d{3})*(\.\d{2})?/g) ?? []) fictional.add(a);
    }
    addRule(lines);
  }

  // Chunks: one per section; each worked example is its own chunk titled by the example.
  const chunks: ParsedChunk[] = [];
  let ordinal = 0;
  sections.forEach((s, si) => {
    let piece = 0;
    for (const p of s.pieces) {
      if (!p.lines.length) continue;
      const isEx = p.kind === "example";
      const heading = isEx ? p.title! : s.heading;
      const text = isEx || piece === 0 ? [heading, ...(isEx ? p.lines.slice(1) : p.lines)].join("\n") : p.lines.join("\n");
      chunks.push({ ordinal: ++ordinal, heading, text, section_index: si, section_heading: s.heading, piece: piece++, is_example: isEx, fictional_amounts: false });
    }
  });
  // Fictional amounts: every example, every piece of the section holding the note, and any chunk quoting a noted amount.
  const noteSections = new Set(chunks.filter((c) => !c.is_example && FICTIONAL_NOTE.test(c.text)).map((c) => c.section_index));
  for (const c of chunks)
    c.fictional_amounts = c.is_example || noteSections.has(c.section_index) || [...fictional].some((a) => new RegExp(`${a.replace(/[$.]/g, "\\$&")}(?![\\d,])`).test(c.text));

  const bySection: Record<string, number[]> = {};
  for (const s of sections) if (s.tables.length) bySection[s.heading] = s.tables.map((t) => t.body_rows);
  const nonEmpty = sections.filter((s, i) => i > 0 || s.pieces.length);
  return {
    page_title: h1 ? clean(flatText(h1)) : null,
    last_modified: usDate(pageText.match(/Last Modified:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1]),
    page_published: usDate(pageText.match(/\bPublished:\s*(\d{2}\/\d{2}\/\d{4})/i)?.[1]),
    sections: nonEmpty,
    chunks,
    stats: {
      sections: nonEmpty.length,
      headings: nonEmpty.map((s) => s.heading),
      tables: sections.reduce((a, s) => a + s.tables.length, 0),
      table_rows_by_section: bySection,
      examples: chunks.filter((c) => c.is_example).map((c) => Number(c.heading.match(/Example (\d+)/)![1])),
      fictional_note: fictionalNote,
      fictional_amounts: [...fictional],
      step_labels: [...new Set(chunks.flatMap((c) => c.text.split("\n").map((l) => l.match(/^Step (\d+):/)?.[0].slice(0, -1)).filter((x): x is string => !!x)))],
      margin_notes: sections.reduce((a, s) => a + s.margin_notes, 0),
      h4_subheadings: h4,
    },
  };
}

// ---- Expected checks (the importer refuses to write when any fails) ----------
export type ExpectedChecks = {
  sections: number;
  tables: number;
  /** Heading → body-row count summed over that section's tables. */
  table_rows_by_section: Record<string, number>;
  examples: number;
  fictional_note: boolean;
  step_labels: string[];
};
/**
 * For a chapter with no reviewed manifest yet: structural sanity only. The importer then also requires the
 * caller to confirm the dry-run's content hash, and the owner reviews the staged chapter before promote.
 */
export type MinimalChecks = { min_sections: number; min_chunks: number };
export const isMinimalChecks = (e: ExpectedChecks | MinimalChecks): e is MinimalChecks => "min_sections" in e;

export function checkChapter(p: ParsedChapter, e: ExpectedChecks | MinimalChecks) {
  const failures: string[] = [];
  const s = p.stats;
  if (isMinimalChecks(e)) {
    if (s.sections < e.min_sections) failures.push(`sections: expected at least ${e.min_sections}, got ${s.sections}`);
    if (p.chunks.length < e.min_chunks) failures.push(`chunks: expected at least ${e.min_chunks}, got ${p.chunks.length}`);
    if (!p.last_modified) failures.push("Last Modified date not found");
    if (p.chunks.some((c) => !c.text.trim())) failures.push("empty chunk");
    return { pass: failures.length === 0, failures };
  }
  if (s.sections !== e.sections) failures.push(`sections: expected ${e.sections}, got ${s.sections}`);
  if (s.tables !== e.tables) failures.push(`tables: expected ${e.tables}, got ${s.tables}`);
  for (const [h, rows] of Object.entries(e.table_rows_by_section)) {
    const got = s.table_rows_by_section[h];
    const sum = got ? got.reduce((a, b) => a + b, 0) : null;
    if (sum !== rows) failures.push(`table rows in "${h}": expected ${rows}, got ${sum ?? "no table"}`);
  }
  const want = Array.from({ length: e.examples }, (_, i) => i + 1).join(",");
  if (s.examples.join(",") !== want) failures.push(`examples: expected ${want || "none"}, got ${s.examples.join(",") || "none"}`);
  if (e.fictional_note && !s.fictional_note) failures.push("fictional-amount note not found");
  for (const l of e.step_labels) if (!s.step_labels.includes(l)) failures.push(`missing label "${l}"`);
  if (!p.last_modified) failures.push("Last Modified date not found");
  if (p.chunks.some((c) => !c.text.trim())) failures.push("empty chunk");
  return { pass: failures.length === 0, failures };
}

/** Absolute URL of the first link whose path matches `pattern` (e.g. the "Next" chapter link), or null. */
export function findLink(html: string, baseUrl: string, pattern: RegExp) {
  for (const a of findAll(parseHtml(html), (n) => n.tag === "a" && !!n.attrs["href"])) {
    const href = a.attrs["href"];
    let abs: URL;
    try { abs = new URL(href, baseUrl); } catch { continue; }
    if (pattern.test(abs.pathname)) { abs.hash = ""; abs.search = ""; return abs.toString(); }
  }
  return null;
}

// ---- Keys, locators, hashes ---------------------------------------------------
export async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
/** Hash of the chunk texts as they will be stored (what the key and idempotency depend on). */
export const chapterContentHash = (p: ParsedChapter) => sha256Hex(p.chunks.map((c) => c.text).join("\n\n"));
export function documentVersionKey(awardYear: string, volume: number, chapter: number, lastModified: string, contentHash: string) {
  return `fsa-handbook:${awardYear}:vol${volume}:ch${chapter}:${lastModified}:${contentHash.slice(0, 12)}`;
}
export const chapterKeyPrefix = (awardYear: string, volume: number, chapter: number) => `fsa-handbook:${awardYear}:vol${volume}:ch${chapter}:`;
/** Official URL with a `#:~:text=` fragment; commas and hyphens are percent-encoded as the spec requires. */
export function textFragmentUrl(url: string, text: string) {
  const enc = encodeURIComponent(text).replace(/-/g, "%2D").replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${url.split("#")[0]}#:~:text=${enc}`;
}
export const CITATION_SEPARATOR = " — ";
export function citationRef(label: string, url: string, heading: string) {
  return `${label}${CITATION_SEPARATOR}${textFragmentUrl(url, heading)}`;
}
