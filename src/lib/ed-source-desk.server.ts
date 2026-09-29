// Server-only lookup logic for Ask Regs (ED Source Desk). Ported from cite.py contract.
const MAX_TEXT = 30_000;
const UA = "myproduct.life ED Source Desk (+https://myproduct.life/ask-regs)";

export type LookupInput =
  | { q: string }
  | { mode: "ecfr-section"; title?: string; section: string }
  | { mode: "fr-doc"; document_number: string }
  | { mode: "reggov-doc"; document_id: string }
  | { mode: "fr-search"; q: string; per_page?: number };

const now = () => new Date().toISOString();

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

class UpstreamError extends Error {
  constructor(public status: number, msg: string, public unavailable = false) {
    super(msg);
  }
}

// Per-request log of upstream attempts (first try, retries, final status) — returned for review.
export type AttemptLog = { host: string; attempt: number; status: number | string; waited_ms: number; at: string }[];

// Bounded upstream access: at most ECFR_MAX_CONCURRENT eCFR requests at once (per server
// instance), a minimum gap between eCFR request starts, and 429/503 responses retried with
// backoff (honouring Retry-After). If the source is still rate-limiting after the retry budget,
// the lookup reports "source temporarily unavailable" instead of any other answer.
const ECFR_MAX_CONCURRENT = 2;
const ECFR_MIN_GAP_MS = 350;
const MAX_RETRIES = 5;
const RETRY_BUDGET_MS = 20_000;
let ecfrActive = 0;
let ecfrLastStart = 0;
const ecfrQueue: (() => void)[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function ecfrSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (ecfrActive >= ECFR_MAX_CONCURRENT) await new Promise<void>((r) => ecfrQueue.push(r));
  ecfrActive++;
  try {
    const gap = ecfrLastStart + ECFR_MIN_GAP_MS - Date.now();
    ecfrLastStart = Math.max(Date.now(), ecfrLastStart + ECFR_MIN_GAP_MS);
    if (gap > 0) await sleep(gap);
    return await fn();
  } finally {
    ecfrActive--;
    ecfrQueue.shift()?.();
  }
}

async function get(url: string, headers: Record<string, string> = {}, log?: AttemptLog) {
  const host = new URL(url).host;
  const once = () => fetch(url, { headers: { "User-Agent": UA, ...headers } });
  const started = Date.now();
  let waited = 0;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await (host === "www.ecfr.gov" ? ecfrSlot(once) : once());
    } catch (e) {
      log?.push({ host, attempt, status: "network-error", waited_ms: waited, at: now() });
      if (attempt < MAX_RETRIES && Date.now() - started < RETRY_BUDGET_MS) { waited = 1000 * 2 ** attempt; await sleep(waited); continue; }
      throw new UpstreamError(503, `${host} could not be reached`, true);
    }
    log?.push({ host, attempt, status: res.status, waited_ms: waited, at: now() });
    if (res.ok) return res;
    const retryable = res.status === 429 || res.status === 503 || res.status === 502 || res.status === 504;
    const ra = Number(res.headers.get("retry-after"));
    const wait = Math.min(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1200 * 2 ** attempt + Math.random() * 400, 8000);
    if (retryable && attempt < MAX_RETRIES && Date.now() - started + wait < RETRY_BUDGET_MS) {
      await res.body?.cancel();
      waited = Math.round(wait);
      await sleep(wait);
      continue;
    }
    const body = (await res.text()).slice(0, 300);
    throw new UpstreamError(res.status, `Upstream ${host} returned ${res.status}${retryable ? ` after ${attempt + 1} attempts` : ""}: ${body}`, retryable);
  }
}

// eCFR's latest issue date changes at most daily; cache it to halve eCFR calls.
let titlesCache: { at: number; data: { titles: { number: number; latest_issue_date: string }[] } } | null = null;
async function ecfrTitles(log?: AttemptLog) {
  if (titlesCache && Date.now() - titlesCache.at < 60 * 60 * 1000) return titlesCache.data;
  const data = (await (await get("https://www.ecfr.gov/api/versioner/v1/titles.json", {}, log)).json()) as { titles: { number: number; latest_issue_date: string }[] };
  titlesCache = { at: Date.now(), data };
  return data;
}
// Section text for a given issue date never changes; cache it (and share in-flight fetches).
const sectionCache = new Map<string, Promise<{ xml: string; status: number }>>();

const REFUSE_RULES: { reason: string; re: RegExp }[] = [
  {
    reason: "student-specific",
    re: /\b(my|his|her|their)\s+(isir|sai|efc|fafsa|pell|aid|loan|eligibility)\b|\bis\s+(student\s+)?[A-Z][a-z]+(\s+[A-Z][a-z]+)?\s+eligible\b|\bam i eligible\b|\bwill i (get|qualify)\b|\bcan i get\b|\bstudent\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,
  },
  { reason: "private-member-content", re: /\bnasfaa\b.*\b(member|tip|private|autopilot|ask regs)\b/i },
  { reason: "vendor-internal-config", re: /\b(anthology|campusnexus|vendor|internal)\b.*\b(config|configuration|setup|setting|help|knowledge)\b/i },
  { reason: "non-ed-tax-advice", re: /\b(irs|tax return|deduct|1040|w-?2|tax credit|file my taxes)\b/i },
];

export function detectRefuse(q: string): string | null {
  for (const r of REFUSE_RULES) if (r.re.test(q)) return r.reason;
  return null;
}

const KEYWORD_SECTIONS: [RegExp, string][] = [
  [/satisfactory academic progress|\bsap\b/i, "668.34"],
  [/return of title iv|\br2t4\b|withdraw/i, "668.22"],
  [/cost of attendance|\bcoa\b/i, "668.2"],
  [/verification/i, "668.53"],
  [/credit balance|disbursement/i, "668.164"],
  [/schedule of reductions|less-than-full-time|annual loan limit/i, "685.203"],
  [/professional judgment/i, "690.75"],
  [/pell grant/i, "690.62"],
  [/student eligibility|eligible student/i, "668.32"],
  [/clock hour|credit hour/i, "600.2"],
];

function route(q: string): LookupInput {
  const sec = q.match(/(?:§\s*)?\b(\d{3})\.(\d{1,4}[a-z]?)\b/);
  if (sec) return { mode: "ecfr-section", title: "34", section: `${sec[1]}.${sec[2]}` };
  const reg = q.match(/\bED-\d{4}-[A-Z]+-\d{4}-\d{4}\b/i);
  if (reg) return { mode: "reggov-doc", document_id: reg[0].toUpperCase() };
  const fr = q.match(/\b(19|20)\d{2}-\d{4,5}\b/);
  if (fr) return { mode: "fr-doc", document_number: fr[0] };
  for (const [re, s] of KEYWORD_SECTIONS) if (re.test(q)) return { mode: "ecfr-section", title: "34", section: s };
  return { mode: "fr-search", q, per_page: 3 };
}

function stripXml(xml: string) {
  return xml
    .replace(/<\/(P|HEAD|FP|HD)>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x2019;|&#8217;/g, "’").replace(/&#xA7;|&#167;/g, "§").replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*\n+/g, "\n\n").trim();
}

async function cap(text: string) {
  const truncated = text.length > MAX_TEXT;
  const t = truncated ? text.slice(0, MAX_TEXT) : text;
  return { text: t, truncated, content_hash: await sha256(text) };
}

async function ecfr(title: string, section: string, log?: AttemptLog) {
  const titles = await ecfrTitles(log);
  const date = titles.titles.find((t) => String(t.number) === title)?.latest_issue_date;
  if (!date) throw new UpstreamError(404, `Title ${title} not found in eCFR`);
  const key = `${date}|${title}|${section}`;
  let p = sectionCache.get(key);
  const cached = !!p;
  if (!p) {
    p = get(`https://www.ecfr.gov/api/versioner/v1/full/${date}/title-${title}.xml?section=${encodeURIComponent(section)}`, { Accept: "application/xml" }, log)
      .then(async (r) => ({ xml: await r.text(), status: r.status }));
    sectionCache.set(key, p);
    p.catch(() => sectionCache.delete(key));
    if (sectionCache.size > 200) sectionCache.delete(sectionCache.keys().next().value!);
  }
  if (cached) log?.push({ host: "www.ecfr.gov", attempt: 0, status: "cache", waited_ms: 0, at: now() });
  const { xml, status } = await p;
  const res = { status };
  const head = xml.match(/<HEAD>([\s\S]*?)<\/HEAD>/i)?.[1];
  const [pt] = section.split(".");
  return {
    ok: true,
    mode: "ecfr-section",
    citation_id: `ecfr:${title}-${section}`,
    title: head ? stripXml(head) : `§ ${section}`,
    hierarchy: { title, part: pt, section },
    source_url: `https://www.ecfr.gov/current/title-${title}/section-${section}`,
    ...(await cap(stripXml(xml))),
    fetched_at: now(),
    http_status: res.status,
    as_of_date: date,
    authority_rank: 1,
    authority_label: "eCFR regulation text (highest authority)",
    refuse: false,
  };
}

// FAIS authority rank (lower number = higher authority).
export function frAuthority(type?: string) {
  if (type === "Rule") return { authority_rank: 2, authority_label: "Federal Register final rule" };
  if (type === "Proposed Rule") return { authority_rank: 3, authority_label: "Federal Register PROPOSED rule — not in effect" };
  return { authority_rank: 7, authority_label: "Federal Register notice (lowest authority)" };
}

async function frDoc(n: string, log?: AttemptLog) {
  const res = await get(`https://www.federalregister.gov/api/v1/documents/${encodeURIComponent(n)}.json`, {}, log);
  const d = (await res.json()) as Record<string, string>;
  const body = [d.abstract, d.action && `Action: ${d.action}`, d.dates && `Dates: ${d.dates}`, d.publication_date && `Published: ${d.publication_date}`]
    .filter(Boolean).join("\n\n");
  return {
    ok: true, mode: "fr-doc", citation_id: `fr:${n}`, title: d.title, source_url: d.html_url, ...frAuthority(d.type),
    ...(await cap(body || "(No abstract provided.)")), fetched_at: now(), http_status: res.status, refuse: false,
  };
}

async function reggovDoc(id: string, log?: AttemptLog) {
  const key = process.env["DATA_GOV_API_KEY"];
  if (!key) throw new UpstreamError(503, "Regulations.gov lookups are not configured yet.");
  const res = await get(`https://api.regulations.gov/v4/documents/${encodeURIComponent(id)}?api_key=${key}`, {}, log);
  const j = (await res.json()) as { data: { attributes: Record<string, string> } };
  const a = j.data.attributes;
  const body = [a.title, a.documentType && `Type: ${a.documentType}`, a.postedDate && `Posted: ${a.postedDate}`, a.docketId && `Docket: ${a.docketId}`, a.summary]
    .filter(Boolean).join("\n\n");
  return {
    ok: true, mode: "reggov-doc", citation_id: `reggov:${id}`, title: a.title,
    source_url: `https://www.regulations.gov/document/${id}`,
    ...frAuthority(a.documentType === "Rule" ? "Rule" : a.documentType === "Proposed Rule" ? "Proposed Rule" : undefined),
    ...(await cap(body)), fetched_at: now(), http_status: res.status, refuse: false,
  };
}

// ---- Topical-fit check -------------------------------------------------------
// A citation is only kept if the question's *distinctive* words appear in the cited
// text. Section numbers and broad trigger words (pell, loan, disbursement…) never count,
// so an explicit "34 CFR 668.34" or a keyword hit cannot validate an unrelated question.
const STOP = new Set((
  "a an the of to in on for and or is are was be been what how does do did when who which why with under by from about this that these those it its i my me we our you your can could should would will may might must not no yes any all each every one two three four more than then there here if as at into also only just same such other both either between whether without within including anyway please give tell show explain walk through look find lookup recent correct right true wrong really actually exact exactly current currently today now new cover covers covered mean means say says statement determine determines determining affect affects difference differ happen happens step steps need needs rely item items documents inputs input factors doc docs thing things way ways matter matters might"
).split(" "));
const GENERIC = new Set((
  "title iv federal ed education department cfr section regulation regulations rule rules regulatory notice register document proposed final school schools institution institutions student students program programs aid financial award awards year years applicable apply applies eligible eligibility requirement requirements general definition definitions defined define use used uses based case cases amount amounts part subpart paragraph official source handbook fsa staff member question rule"
).split(" "));

export function distinctiveTerms(q: string) {
  const cleaned = q.toLowerCase().replace(/§\s*/g, " ").replace(/\b\d+(\.\d+)*[a-z]?\b/g, " ");
  const terms = cleaned.match(/[a-z][a-z0-9-]{2,}/g) ?? [];
  return [...new Set(terms.filter((t) => !STOP.has(t) && !GENERIC.has(t)))];
}

const SYNONYMS: Record<string, string[]> = {
  r2t4: ["return of title iv", "withdraw"], sap: ["satisfactory academic progress"], isir: ["institutional student information record"],
  sai: ["student aid index"], efc: ["expected family contribution"], coa: ["cost of attendance"], mpn: ["master promissory note"],
  loa: ["leave of absence"], nslds: ["national student loan data system"], cod: ["common origination and disbursement"],
  fafsa: ["free application for federal student aid"], leu: ["lifetime eligibility used"], bbay: ["borrower-based academic year"],
  say: ["scheduled academic year"], obbba: ["one big beautiful bill"],
};

function stemHit(term: string, hay: string) {
  if (SYNONYMS[term]?.some((p) => hay.toLowerCase().includes(p))) return true;
  const stem = term.length > 6 ? term.slice(0, Math.max(5, term.length - 3)) : term.replace(/s$/, "");
  return new RegExp(`\\b${stem.replace(/[-]/g, "[- ]?")}`, "i").test(hay);
}

export function topicalFit(q: string, hay: string) {
  const terms = distinctiveTerms(q);
  if (!terms.length) return { score: 1, terms, missing: [] as string[] };
  const missing = terms.filter((t) => !stemHit(t, hay));
  return { score: (terms.length - missing.length) / terms.length, terms, missing };
}
const FIT_MIN = 0.6; // explicit section / document number named by the user
const FIT_MIN_KEYWORD = 0.8; // section guessed from a broad keyword trigger — stricter

function relevance(q: string, hay: string) {
  return topicalFit(q, hay).score;
}
const RELEVANCE_MIN = FIT_MIN;

// A Federal Register search hit is only an *answer* when the question asks for FR documents.
// Otherwise a notice (e.g. an annual rate notice) or a proposed rule is not an answer to a
// "what determines / what happens" question — it's listed as related, never cited as the answer.
const FR_INTENT = /federal register|\bfr\b|\bnotices?\b|proposed|\bnprm\b|rulemaking|\brecent\b|\blatest\b|announce/i;
const PROPOSED_INTENT = /proposed|\bnprm\b|rulemaking/i;
const RECENT_INTENT = /\brecent\b|\blatest\b|\bnewest\b/i;

async function frSearch(q: string, perPage = 3, log?: AttemptLog) {
  const u = new URL("https://www.federalregister.gov/api/v1/documents.json");
  u.searchParams.set("conditions[term]", distinctiveTerms(q).join(" ") || q); // search on key terms, not filler words
  u.searchParams.append("conditions[agencies][]", "education-department");
  u.searchParams.set("per_page", "10");
  const recent = RECENT_INTENT.test(q);
  u.searchParams.set("order", recent ? "newest" : "relevance");
  const res = await get(u.toString(), {}, log);
  const j = (await res.json()) as { results?: { document_number: string; title: string; html_url: string; abstract?: string; publication_date: string; type?: string }[] };
  const scored = (j.results ?? []).map((r) => ({
    citation_id: `fr:${r.document_number}`, title: r.title, source_url: r.html_url,
    publication_date: r.publication_date, abstract: r.abstract ?? null,
    ...frAuthority(r.type), score: relevance(q, `${r.title} ${r.abstract ?? ""}`),
  }));
  // Relevance gate, then rank by authority (lower rank wins), then relevance.
  const relevant = scored.filter((r) => r.score >= RELEVANCE_MIN);
  const results = relevant
    .filter((r) => r.authority_rank !== 3 || PROPOSED_INTENT.test(q)) // proposed rules are not in effect
    .sort((a, b) => (recent ? b.publication_date.localeCompare(a.publication_date) : a.authority_rank - b.authority_rank || b.score - a.score))
    .slice(0, Math.min(Math.max(perPage, 1), 10));
  if (!FR_INTENT.test(q) && relevant.length) {
    return {
      ok: true, mode: "no-confident-cite", refuse: false, citation_ids: [], results: [], text: null, query: q, fetched_at: now(),
      no_match: true, no_confident_cite: true,
      related_documents: relevant.slice(0, 3).map(({ citation_id, title, source_url, publication_date, authority_label }) => ({ citation_id, title, source_url, publication_date, authority_label })),
      message: "No confident citation. Related Federal Register documents were found, but a notice or proposed rule does not answer this question.",
    };
  }
  if (!results.length) {
    return {
      ok: true, mode: "no-confident-cite", refuse: false, citation_ids: [], results: [], text: null, query: q, fetched_at: now(),
      no_match: true, no_confident_cite: true,
      message: "No confident citation. Include a CFR section (e.g. 34 CFR 668.34) or rephrase.",
    };
  }
  const top = results[0];
  return {
    ok: true, mode: "fr-search", citation_id: top.citation_id, title: top.title, source_url: top.source_url,
    authority_rank: top.authority_rank, authority_label: top.authority_label,
    ...(await cap(top.abstract ?? "(No abstract provided.)")),
    citation_ids: results.map((r) => r.citation_id), results, query: q, fetched_at: now(), http_status: res.status, refuse: false,
  };
}

// ---- Imported handbook passages (Phase 2 pilot, read-only, exact vector search) ----
const HANDBOOK_SIM_MIN = 0.74;
// Concept matches used ONLY for current-year handbook passages, added for specific reviewed cases.
// Deliberately absent: summer/winter -> intersession (a summer or winter session is not automatically one).
const HANDBOOK_CONCEPTS: Record<string, RegExp> = {
  assigned: /\bcombin(e|ed|ing)\b[^.]*\b(with|term)\b|treated? as a single/i,
  assignment: /\bcombin(e|ed|ing)\b[^.]*\b(with|term)\b|treated? as a single/i,
  consequences: /\bthis means\b|\bmust count toward\b|\bmust be included\b|\bwould use formula\b|\beffect on\b/i,
};
// Multi-word ideas that must be matched as a phrase (their words are otherwise "generic").
const PHRASE_TERMS: [RegExp, RegExp, string][] = [[/\baward years?\b/i, /\baward years?\b/i, "award year"]];

// Heading-aware fit for verified 2026-27 section headings: a term that appears in the heading
// counts double, so a passage whose verified title names the concept is recognised even when
// the body uses different wording. The global threshold (FIT_MIN) is unchanged.
function handbookFit(q: string, heading: string, text: string) {
  const terms = distinctiveTerms(q);
  const phrases = PHRASE_TERMS.filter(([qre]) => qre.test(q));
  const hay = `${heading} ${text}`;
  let got = 0, total = 0;
  const missing: string[] = [];
  let headingHits = 0;
  for (const t of terms) {
    const inHead = stemHit(t, heading);
    const hit = inHead || stemHit(t, hay) || !!HANDBOOK_CONCEPTS[t]?.test(text);
    const w = inHead ? 2 : 1;
    total += w; if (hit) got += w; else missing.push(t);
    if (inHead) headingHits++;
  }
  for (const [, hre, label] of phrases) { total += 1; if (hre.test(hay)) got += 1; else missing.push(label); }
  return { score: total ? got / total : 1, missing, headingHits };
}

const WHY_INTENT = /\bwhy\b/i;
const WHY_ANSWERED = /\bbecause\b|\breasons?\b|\bpurpose\b|\bin order to\b|\bso that\b|\bto allow\b|\bflexib/i;
const PRESCRIPTIVE = /\bhow (should|must|is|are)\b[^?]*\b(assign|treat|combin)/i;
const CONDITIONAL_TEXT = /\bif you choose\b|\bcould also choose\b|\bin certain limited cases\b|\bmay combine\b|\beither the\b/i;
export const CURRENT_AWARD_YEAR = "2026-27"; // public results show current-year guidance only; prior years stay in storage
async function handbookSearch(q: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { passages: [], error: "handbook search not configured" };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-embedding-2", input: [q] }),
    });
    if (!res.ok) throw new Error(`embeddings ${res.status}`);
    const emb = ((await res.json()) as { data: { embedding: number[] }[] }).data[0].embedding;
    if (emb.length !== 3072) throw new Error(`unexpected dimension ${emb.length}`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("match_chunks" as never, { query_embedding: JSON.stringify(emb), match_count: 10 } as never);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as {
      heading: string; text: string; citation_ref: string; ordinal: number; similarity: number; official_url: string; title: string;
      award_year: string | null; source_class: string; source_status: string; publication_date: string | null; last_modified_date: string | null;
      retrieved_at: string; content_hash: string; document_version_key: string;
    }[];
    const priorYearExcluded = rows.filter((r) => r.award_year !== CURRENT_AWARD_YEAR).length;
    const passages = rows
      .filter((r) => r.award_year === CURRENT_AWARD_YEAR)
      .map((r) => ({ ...r, fit: handbookFit(q, r.heading, r.text) }))
      .filter((r) => r.similarity >= HANDBOOK_SIM_MIN && r.fit.score >= FIT_MIN)
      // Rank: sections whose verified heading names more of the question's terms first; on a tie,
      // rule sections before worked examples; then by similarity.
      .sort((a, b) => b.fit.headingHits - a.fit.headingHits
        || Number(/\bExample \d+/.test(a.heading)) - Number(/\bExample \d+/.test(b.heading))
        || b.similarity - a.similarity)
      .slice(0, 3)
      .map((r) => {
        const locator = r.citation_ref.match(/https?:\/\/\S+/)?.[0] ?? r.official_url;
        return {
          citation_id: `fsa-hb:${r.award_year ?? "unknown"}:${r.document_version_key}#${r.ordinal}`,
          label: r.citation_ref.replace(/\s*https?:\/\/\S+/, "").replace(/[—–-]\s*$/, "").trim(),
          heading: r.heading, passage: r.text, source_url: locator, official_url: r.official_url, document_title: r.title,
          award_year: r.award_year, source_status: r.source_status, publication_date: r.publication_date,
          last_modified_date: r.last_modified_date, retrieved_at: r.retrieved_at, content_hash: r.content_hash,
          similarity: Math.round(r.similarity * 1000) / 1000, fit: Math.round(r.fit.score * 100) / 100, missing_terms: r.fit.missing, heading_hits: r.fit.headingHits,
          authority_rank: 4, authority_label: `FSA Handbook ${r.award_year ?? ""} (sub-regulatory guidance)`.replace("  ", " "),
        };
      });
    return { passages, prior_year_excluded: priorYearExcluded };
  } catch (e) {
    console.error("handbook search failed", e);
    return { passages: [], prior_year_excluded: 0, error: "Handbook search is temporarily unavailable." };
  }
}

type AnyResult = Record<string, unknown> & { ok: boolean; mode?: string; title?: string; text?: string | null; citation_id?: string };

async function routedLookup(routed: Extract<LookupInput, { mode: string }>, log?: AttemptLog): Promise<AnyResult> {
  switch (routed.mode) {
    case "ecfr-section": return await ecfr(routed.title ?? "34", routed.section, log);
    case "fr-doc": return await frDoc(routed.document_number, log);
    case "reggov-doc": return await reggovDoc(routed.document_id, log);
    case "fr-search": return await frSearch(routed.q, routed.per_page, log);
  }
}

export async function lookup(input: LookupInput) {
  const log: AttemptLog = [];
  try {
    if ("mode" in input) return await routedLookup(input, log);
    const q = input.q;
    const reason = detectRefuse(q);
    if (reason) {
      return { ok: true, mode: "refuse", refuse: true, refuse_reason: reason, citation_ids: [], text: null, query: q, fetched_at: now() };
    }
    const routed = route(q) as Extract<LookupInput, { mode: string }>;
    const [primary, hb] = await Promise.all([routedLookup(routed, log), handbookSearch(q)]);
    let result: AnyResult = primary;
    // Topical-fit gate: explicit numbers and keyword triggers can't validate unrelated questions.
    if (primary.ok && primary.mode !== "no-confident-cite" && primary.mode !== "fr-search") {
      const fit = topicalFit(q, `${primary.title ?? ""} ${primary.text ?? ""}`);
      const explicit = /(?:§\s*)?\b\d{3}\.\d{1,4}[a-z]?\b|\bED-\d{4}-|\b(19|20)\d{2}-\d{4,5}\b/i.test(q);
      if (fit.score < (explicit ? FIT_MIN : FIT_MIN_KEYWORD)) {
        result = {
          ok: true, mode: "no-confident-cite", refuse: false, no_match: true, no_confident_cite: true, citation_ids: [], text: null, query: q, fetched_at: now(),
          rejected_candidate: { citation_id: primary.citation_id, title: primary.title, reason: "cited text does not contain the question's key terms", missing_terms: fit.missing, fit: Math.round(fit.score * 100) / 100 },
          message: "No confident citation — the section that matched your wording doesn't address the rest of your question.",
        };
      } else result = { ...primary, fit: Math.round(fit.score * 100) / 100 };
    }
    const handbook = hb.passages;
    if (result.mode === "no-confident-cite" && handbook.length) {
      const top = handbook[0];
      result = {
        ...result, ok: true, mode: "handbook-passage", no_match: false, no_confident_cite: false,
        citation_id: top.citation_id, title: `${top.document_title ?? "FSA Handbook"} — ${top.heading}`, source_url: top.source_url,
        text: top.passage, authority_rank: top.authority_rank, authority_label: top.authority_label, award_year: top.award_year,
      };
    }
    let coverage: { status: "full" | "partial"; missing_terms: string[]; notes: string[] } | null = null;
    let conditional: string | null = null;
    if (result.mode === "handbook-passage") {
      const shown = handbook.map((p) => `${p.heading} ${p.passage}`).join(" ");
      const missing = handbook.length ? handbook.reduce<string[]>((acc, p) => acc.filter((t) => p.missing_terms.includes(t)), handbook[0].missing_terms) : [];
      const notes: string[] = [];
      if (missing.length) notes.push(`The passages shown don't cover: ${missing.map((t) => `"${t}"`).join(", ")}.`);
      if (WHY_INTENT.test(q) && !WHY_ANSWERED.test(shown)) notes.push("The passages describe the rule and its effects but don't explain why a school would choose it.");
      coverage = { status: notes.length ? "partial" : "full", missing_terms: missing, notes };
      if (PRESCRIPTIVE.test(q) && CONDITIONAL_TEXT.test(shown))
        conditional = "Conditional: the handbook describes options that depend on how the program's calendar is set up — not one assignment that applies to every program.";
    }
    return { ...result, coverage, conditional, upstream_attempts: log, handbook_passages: handbook, handbook_error: hb.error ?? null, handbook_prior_year_excluded: hb.prior_year_excluded,
      handbook_coverage: `${CURRENT_AWARD_YEAR} FSA Handbook Vol 3 Ch 1 only (2025-26 Vol 5 Ch 1 is stored but excluded)` };
  } catch (e) {
    const status = e instanceof UpstreamError ? e.status : 500;
    console.error("ed-source-desk lookup failed", e);
    if (e instanceof UpstreamError && e.unavailable) {
      return { ok: false, mode: "source-unavailable", source_unavailable: true, error: "Source temporarily unavailable — the official site is busy. Please try again in a minute.",
        http_status: 503, upstream_attempts: log, fetched_at: now() };
    }
    return { upstream_attempts: log, ok: false, error: e instanceof Error ? e.message : "Lookup failed", http_status: status, fetched_at: now() };
  }
}
