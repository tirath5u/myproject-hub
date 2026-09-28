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
  constructor(public status: number, msg: string) {
    super(msg);
  }
}

async function get(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, { headers: { "User-Agent": UA, ...headers } });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    throw new UpstreamError(res.status, `Upstream ${new URL(url).host} returned ${res.status}: ${body}`);
  }
  return res;
}

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

async function ecfr(title: string, section: string) {
  const titles = (await (await get("https://www.ecfr.gov/api/versioner/v1/titles.json")).json()) as {
    titles: { number: number; latest_issue_date: string }[];
  };
  const date = titles.titles.find((t) => String(t.number) === title)?.latest_issue_date;
  if (!date) throw new UpstreamError(404, `Title ${title} not found in eCFR`);
  const res = await get(
    `https://www.ecfr.gov/api/versioner/v1/full/${date}/title-${title}.xml?section=${encodeURIComponent(section)}`,
    { Accept: "application/xml" },
  );
  const xml = await res.text();
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

async function frDoc(n: string) {
  const res = await get(`https://www.federalregister.gov/api/v1/documents/${encodeURIComponent(n)}.json`);
  const d = (await res.json()) as Record<string, string>;
  const body = [d.abstract, d.action && `Action: ${d.action}`, d.dates && `Dates: ${d.dates}`, d.publication_date && `Published: ${d.publication_date}`]
    .filter(Boolean).join("\n\n");
  return {
    ok: true, mode: "fr-doc", citation_id: `fr:${n}`, title: d.title, source_url: d.html_url, ...frAuthority(d.type),
    ...(await cap(body || "(No abstract provided.)")), fetched_at: now(), http_status: res.status, refuse: false,
  };
}

async function reggovDoc(id: string) {
  const key = process.env["DATA_GOV_API_KEY"];
  if (!key) throw new UpstreamError(503, "Regulations.gov lookups are not configured yet.");
  const res = await get(`https://api.regulations.gov/v4/documents/${encodeURIComponent(id)}?api_key=${key}`);
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
  "a an the of to in on for and or is are was be been what how does do did when who which why with under by from about this that these those it its i my me we our you your can could should would will may might must not no yes any all each every one two three four more than then there here if as at into also only just same such other both either between whether without within including anyway please give tell show explain walk through look find lookup recent correct right true wrong really actually exact exactly current currently today now new cover covers covered mean means say says statement"
).split(" "));
const GENERIC = new Set((
  "title iv federal ed education department cfr section regulation regulations rule rules regulatory notice register document proposed final school schools institution institutions student students program programs aid financial award awards year years applicable apply applies eligible eligibility requirement requirements general definition definitions defined define use used uses based case cases amount amounts part subpart paragraph official source handbook fsa staff member question rule"
).split(" "));

export function distinctiveTerms(q: string) {
  const cleaned = q.toLowerCase().replace(/§\s*/g, " ").replace(/\b\d+(\.\d+)*[a-z]?\b/g, " ");
  const terms = cleaned.match(/[a-z][a-z0-9-]{2,}/g) ?? [];
  return [...new Set(terms.filter((t) => !STOP.has(t) && !GENERIC.has(t)))];
}

function stemHit(term: string, hay: string) {
  const stem = term.length > 6 ? term.slice(0, Math.max(5, term.length - 3)) : term.replace(/s$/, "");
  return new RegExp(`\\b${stem.replace(/[-]/g, "[- ]?")}`, "i").test(hay);
}

export function topicalFit(q: string, hay: string) {
  const terms = distinctiveTerms(q);
  if (!terms.length) return { score: 1, terms, missing: [] as string[] };
  const missing = terms.filter((t) => !stemHit(t, hay));
  return { score: (terms.length - missing.length) / terms.length, terms, missing };
}
const FIT_MIN = 0.6;

function relevance(q: string, hay: string) {
  return topicalFit(q, hay).score;
}
const RELEVANCE_MIN = FIT_MIN;

async function frSearch(q: string, perPage = 3) {
  const u = new URL("https://www.federalregister.gov/api/v1/documents.json");
  u.searchParams.set("conditions[term]", q);
  u.searchParams.append("conditions[agencies][]", "education-department");
  u.searchParams.set("per_page", "10");
  u.searchParams.set("order", "relevance");
  const res = await get(u.toString());
  const j = (await res.json()) as { results?: { document_number: string; title: string; html_url: string; abstract?: string; publication_date: string; type?: string }[] };
  const scored = (j.results ?? []).map((r) => ({
    citation_id: `fr:${r.document_number}`, title: r.title, source_url: r.html_url,
    publication_date: r.publication_date, abstract: r.abstract ?? null,
    ...frAuthority(r.type), score: relevance(q, `${r.title} ${r.abstract ?? ""}`),
  }));
  // Relevance gate, then rank by authority (lower rank wins), then relevance.
  const results = scored
    .filter((r) => r.score >= RELEVANCE_MIN)
    .sort((a, b) => a.authority_rank - b.authority_rank || b.score - a.score)
    .slice(0, Math.min(Math.max(perPage, 1), 10));
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

export async function lookup(input: LookupInput) {
  try {
    let routed = input;
    if (!("mode" in input)) {
      const reason = detectRefuse(input.q);
      if (reason) {
        return { ok: true, mode: "refuse", refuse: true, refuse_reason: reason, citation_ids: [], text: null, query: input.q, fetched_at: now() };
      }
      routed = route(input.q);
    }
    if (!("mode" in routed)) throw new Error("unreachable");
    switch (routed.mode) {
      case "ecfr-section": return await ecfr(routed.title ?? "34", routed.section);
      case "fr-doc": return await frDoc(routed.document_number);
      case "reggov-doc": return await reggovDoc(routed.document_id);
      case "fr-search": return await frSearch(routed.q, routed.per_page);
    }
  } catch (e) {
    const status = e instanceof UpstreamError ? e.status : 500;
    console.error("ed-source-desk lookup failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "Lookup failed", http_status: status, fetched_at: now() };
  }
}
