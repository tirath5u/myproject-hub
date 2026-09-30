// Server-only admin importer for FSA Handbook chapters (Stage 2A).
// dry-run: fetch + parse + check, returns counts and hashes only (no text, no writes, no embedding).
// import:  same checks, then embed (reusing unchanged chunk embeddings) and write the document as
//          'staged' with its chunks replaced. Staged rows never reach the published lookup (v1).
// promote: staged → in_force for one named document version, after Tirath approves publishing.
import type { HandbookSource } from "@/data/ed-source-desk/handbook-sources";
import {
  chapterContentHash, chapterKeyPrefix, checkChapter, citationRef, documentVersionKey, findLink, parseChapter, sha256Hex,
} from "@/lib/handbook-parse";

const UA = "myproduct.life ED Source Desk (+https://myproduct.life/ask-regs)";
const EMBED_MODEL = "google/gemini-embedding-2";
const EMBED_DIMS = 3072;
const EMBED_BATCH = 16;

export type ImportAction = "dry-run" | "import" | "promote";
type Result = { ok: boolean; status: number; [k: string]: unknown };

/** Timing-safe bearer check (same pattern as cron-auth). Returns a Response to send, or null when authorised. */
export async function authenticateAdmin(request: Request): Promise<Response | null> {
  const secret = process.env["ED_SOURCE_DESK_ADMIN_TOKEN"];
  if (!secret) return new Response("Not found", { status: 404 }); // no token configured: the route does not exist
  const token = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return new Response("Unauthorized", { status: 401 });
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();
  if (!timingSafeEqual(digest(token), digest(secret))) return new Response("Unauthorized", { status: 401 });
  return null;
}

/**
 * The chapter page URL: fixed in the registry, or found from a link on another page. Discovery pages are tried
 * in order; "source:<id>" resolves that source first (depth-limited), so later chapters can follow earlier ones.
 */
async function resolveUrl(source: HandbookSource, depth = 0): Promise<{ url: string } | { error: string }> {
  if (source.url) return { url: source.url };
  if (!source.discover) return { error: "source has neither url nor discover" };
  if (depth > 4) return { error: "discovery chain too deep" };
  const tried: string[] = [];
  for (const from of [source.discover.from].flat()) {
    let page = from;
    if (from.startsWith("source:")) {
      const { findHandbookSource } = await import("@/data/ed-source-desk/handbook-sources");
      const dep = findHandbookSource(from.slice(7));
      const r = dep ? await resolveUrl(dep, depth + 1) : { error: `unknown ${from}` };
      if ("error" in r) { tried.push(`${from}: ${r.error}`); continue; }
      page = r.url;
    }
    const res = await fetch(page, { headers: { "User-Agent": UA, Accept: "text/html" } });
    if (!res.ok) { tried.push(`${page}: HTTP ${res.status}`); continue; }
    const url = findLink(await res.text(), page, source.discover.path_pattern);
    if (url) return { url };
    tried.push(`${page}: link not found`);
  }
  return { error: `chapter link not found (${tried.join("; ")})` };
}

async function fetchAndParse(source: HandbookSource) {
  const resolved = await resolveUrl(source);
  if ("error" in resolved) return { error: resolved.error, http_status: 0 } as const;
  const url = resolved.url;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } });
  if (!res.ok) return { error: `fetch returned HTTP ${res.status}`, http_status: res.status } as const;
  const html = await res.text();
  const parsed = parseChapter(html);
  const checks = checkChapter(parsed, source.expected);
  const content_hash = await chapterContentHash(parsed);
  const chunks = await Promise.all(parsed.chunks.map(async (c) => ({ ...c, text_hash: await sha256Hex(c.text) })));
  const key = parsed.last_modified ? documentVersionKey(source.award_year, source.volume, source.chapter, parsed.last_modified, content_hash) : null;
  return { url, html_bytes: html.length, raw_sha256: await sha256Hex(html), http_status: res.status, parsed, checks, content_hash, chunks, key } as const;
}

/** Counts and hashes only: safe to return and to paste into a report. */
function manifest(source: HandbookSource, f: Exclude<Awaited<ReturnType<typeof fetchAndParse>>, { error: string }>) {
  return {
    source_id: source.id, source_url: f.url, award_year: source.award_year, volume: source.volume, chapter: source.chapter,
    http_status: f.http_status, html_bytes: f.html_bytes, raw_sha256: f.raw_sha256,
    last_modified: f.parsed.last_modified, page_published: f.parsed.page_published,
    document_version_key: f.key, content_hash: f.content_hash,
    stats: f.parsed.stats, checks: f.checks,
    chunks: f.chunks.map((c) => ({ ordinal: c.ordinal, heading: c.heading, piece: c.piece, chars: c.text.length, text_sha256: c.text_hash, is_example: c.is_example, fictional_amounts: c.fictional_amounts })),
  };
}

async function embed(texts: string[]) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
  const out: number[][] = [];
  let tokens: number | null = 0;
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: texts.slice(i, i + EMBED_BATCH) }),
    });
    if (!res.ok) throw new Error(`embeddings ${res.status}`);
    const j = (await res.json()) as { data: { embedding: number[]; index?: number }[]; usage?: { prompt_tokens?: number; total_tokens?: number } };
    const rows = [...j.data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    for (const r of rows) {
      if (r.embedding.length !== EMBED_DIMS) throw new Error(`unexpected dimension ${r.embedding.length}`);
      out.push(r.embedding);
    }
    const t = j.usage?.prompt_tokens ?? j.usage?.total_tokens;
    tokens = tokens === null || t === undefined ? null : tokens + t;
  }
  if (out.length !== texts.length) throw new Error(`embedding count ${out.length} != ${texts.length}`);
  return { vectors: out, tokens };
}

type DocRow = { id: string; document_version_key: string; source_status: string };

export async function runHandbookImport(source: HandbookSource, action: ImportAction, documentKey?: string, confirmContentHash?: string): Promise<Result> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as { from: (t: string) => any }; // new columns are not in the generated types yet
  const prefix = chapterKeyPrefix(source.award_year, source.volume, source.chapter);

  if (action === "promote") {
    if (!documentKey?.startsWith(prefix)) return { ok: false, status: 400, error: `document_version_key must name a version of ${source.id}` };
    const { data: doc, error } = await db.from("documents").select("id, document_version_key, source_status").eq("document_version_key", documentKey).maybeSingle();
    if (error) return { ok: false, status: 500, error: error.message };
    if (!doc) return { ok: false, status: 404, error: "document version not found" };
    if ((doc as DocRow).source_status !== "staged") return { ok: false, status: 409, error: `document is ${(doc as DocRow).source_status}, not staged` };
    const sup = await db.from("documents").update({ source_status: "superseded" }).like("document_version_key", `${prefix}%`).eq("source_status", "in_force").neq("id", (doc as DocRow).id).select("document_version_key");
    if (sup.error) return { ok: false, status: 500, error: sup.error.message };
    const up = await db.from("documents").update({ source_status: "in_force" }).eq("id", (doc as DocRow).id).eq("source_status", "staged");
    if (up.error) return { ok: false, status: 500, error: up.error.message };
    return { ok: true, status: 200, action, document_version_key: documentKey, source_status: "in_force", superseded: ((sup.data ?? []) as DocRow[]).map((d) => d.document_version_key) };
  }

  const f = await fetchAndParse(source);
  if ("error" in f) return { ok: false, status: 502, action, error: f.error };
  const m = manifest(source, f);
  if (!f.checks.pass || !f.key) return { ok: false, status: 422, action, refused: "expected checks failed; nothing was written", manifest: m };
  if (action === "dry-run") return { ok: true, status: 200, action, writes: 0, embeddings: 0, manifest: m };
  // Chapters without a reviewed manifest import only the exact content a dry-run reported.
  if (source.require_confirmed_hash && confirmContentHash !== f.content_hash)
    return { ok: false, status: 409, action, refused: "confirm_content_hash must equal the dry-run's content_hash; nothing was written", manifest: m };

  // import
  const { data: existing, error: exErr } = await db.from("documents").select("id, document_version_key, source_status").like("document_version_key", `${prefix}%`);
  if (exErr) return { ok: false, status: 500, error: exErr.message };
  const versions = (existing ?? []) as DocRow[];
  const same = versions.find((d) => d.document_version_key === f.key);
  if (same && same.source_status !== "staged") {
    // Same content already reviewed and live (or retired): never re-stage it or touch its chunks.
    return { ok: true, status: 200, action, unchanged: true, source_status: same.source_status, writes: 0, embeddings: 0, manifest: m };
  }

  // Reuse embeddings of identical chunk text from any stored version of this chapter.
  const reuse = new Map<string, string>();
  if (versions.length) {
    const { data: old, error } = await db.from("chunks").select("text, embedding, embedding_model").in("document_version_id", versions.map((d) => d.id));
    if (error) return { ok: false, status: 500, error: error.message };
    for (const c of (old ?? []) as { text: string; embedding: string | null; embedding_model: string | null }[])
      if (c.embedding && c.embedding_model === EMBED_MODEL) reuse.set(await sha256Hex(c.text), c.embedding);
  }
  const todo = f.chunks.filter((c) => !reuse.has(c.text_hash));
  const { vectors, tokens } = todo.length ? await embed(todo.map((c) => c.text)) : { vectors: [], tokens: 0 };
  todo.forEach((c, i) => reuse.set(c.text_hash, JSON.stringify(vectors[i])));

  const docRow = {
    document_version_key: f.key, official_url: f.url, title: f.parsed.page_title ?? source.title, source_class: "fsa_handbook",
    source_status: "staged", publication_date: null, last_modified_date: f.parsed.last_modified, page_published_date: f.parsed.page_published,
    retrieved_at: new Date().toISOString(), content_hash: f.content_hash, award_year: source.award_year,
  };
  const { data: doc, error: docErr } = await db.from("documents").upsert(docRow, { onConflict: "document_version_key" }).select("id").single();
  if (docErr) return { ok: false, status: 500, error: docErr.message };
  const docId = (doc as { id: string }).id;
  const del = await db.from("chunks").delete().eq("document_version_id", docId);
  if (del.error) return { ok: false, status: 500, error: del.error.message };
  const rows = f.chunks.map((c) => ({
    document_version_id: docId, ordinal: c.ordinal, heading: c.heading, text: c.text,
    citation_ref: citationRef(`${source.label}: ${c.heading}`, f.url, c.heading),
    embedding: reuse.get(c.text_hash), embedding_model: EMBED_MODEL, is_example: c.is_example, fictional_amounts: c.fictional_amounts,
  }));
  const ins = await db.from("chunks").insert(rows);
  if (ins.error) return { ok: false, status: 500, error: ins.error.message };
  // Older staged versions of this chapter were never reviewed; retire them so only one is staged.
  const older = versions.filter((d) => d.source_status === "staged" && d.document_version_key !== f.key).map((d) => d.document_version_key);
  if (older.length) {
    const r = await db.from("documents").update({ source_status: "superseded" }).in("document_version_key", older);
    if (r.error) return { ok: false, status: 500, error: r.error.message };
  }
  return {
    ok: true, status: 200, action, document_version_key: f.key, source_status: "staged", chunks_written: rows.length,
    embeddings_created: todo.length, embeddings_reused: rows.length - todo.length, embedding_tokens: tokens ?? "unavailable",
    superseded_staged: older, manifest: m,
  };
}
