// Local-only (never in CI): fetch a registered handbook page once, parse it, and print counts and hashes.
// Prints no handbook text. Usage: bun scripts/handbook-live-check.ts [source-id]
import { HANDBOOK_SOURCES } from "../src/data/ed-source-desk/handbook-sources";
import { chapterContentHash, checkChapter, documentVersionKey, parseChapter, sha256Hex } from "../src/lib/handbook-parse";

const source = HANDBOOK_SOURCES.find((s) => s.id === (process.argv[2] ?? HANDBOOK_SOURCES[0].id));
if (!source) throw new Error(`unknown source; known: ${HANDBOOK_SOURCES.map((s) => s.id).join(", ")}`);
if (!source.url) throw new Error("this source is found from another chapter's link; use the admin dry-run instead");
const res = await fetch(source.url, { headers: { "User-Agent": "myproduct.life ED Source Desk (+https://myproduct.life/ask-regs)", Accept: "text/html" } });
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const html = await res.text();
const p = parseChapter(html);
const hash = await chapterContentHash(p);
console.log(JSON.stringify({
  source_id: source.id, http_status: res.status, html_bytes: html.length, raw_sha256: await sha256Hex(html),
  last_modified: p.last_modified, page_published: p.page_published,
  document_version_key: p.last_modified ? documentVersionKey(source.award_year, source.volume, source.chapter, p.last_modified, hash) : null,
  content_hash: hash, stats: p.stats, checks: checkChapter(p, source.expected),
  chunks: await Promise.all(p.chunks.map(async (c) => ({ ordinal: c.ordinal, heading: c.heading, chars: c.text.length, sha256: await sha256Hex(c.text), is_example: c.is_example, fictional_amounts: c.fictional_amounts }))),
}, null, 2));
