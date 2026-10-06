// Server-only lookup logic for Ask Regs (ED Source Desk). Ported from cite.py contract.
import {
  FICTIONAL_WARNING, OFFICIAL_AMOUNT_NOTICE, asksPellAmount, chapterOf, coverageText, chapterTitleWords, headingIsExample, isTopicTerm, lookNext, numberedVariants, offProgram, programsIn, sectionKey, textHasFictionalNote, wordAssistedNote,
} from "@/lib/handbook-lookup";
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
let titlesInFlight: Promise<{ titles: { number: number; latest_issue_date: string }[] }> | null = null;
async function ecfrTitles(log?: AttemptLog) {
  if (titlesCache && Date.now() - titlesCache.at < 60 * 60 * 1000) return titlesCache.data;
  if (titlesInFlight) { log?.push({ host: "www.ecfr.gov", attempt: 0, status: "shared", waited_ms: 0, at: now() }); return titlesInFlight; }
  titlesInFlight = get("https://www.ecfr.gov/api/versioner/v1/titles.json", {}, log)
    .then(async (r) => (await r.json()) as { titles: { number: number; latest_issue_date: string }[] });
  try {
    const data = await titlesInFlight;
    titlesCache = { at: Date.now(), data };
    return data;
  } finally { titlesInFlight = null; }
}
// Section text for a given issue date never changes; cache it (and share in-flight fetches).
const sectionCache = new Map<string, Promise<{ xml: string; status: number }>>();

const REFUSE_RULES: { reason: string; re: RegExp }[] = [
  // A personal identifier or a pasted record, whatever else is asked (live probes A11-A13, 2026-10-04):
  // an SSN-shaped number, "SSN"/"social security" next to digits, or "this/attached ISIR…" and "ISIR:" with data.
  // Questions *about* ISIRs ("what does this ISIR comment code mean") stay answerable.
  {
    reason: "student-specific",
    re: /\b\d{3}-\d{2}-\d{4}\b|\b\d{9}\b|\b(ssn|social security( number)?)\b[^?.]{0,25}\d{4}|\b(this|the following|attached|below|pasted)\s+(student'?s\s+)?(isir|fafsa|record|transcript)\b(?!\s+(comment|code|field|flag|transaction|layout|processing|correction)s?\b)|\bhere\s+(is|are)\b[^?]{0,30}\b(isir|fafsa|record|transcript)s?\b|\b(isir|fafsa|record)\s*:\s*\S/i,
  },
  // Named individuals (case-sensitive on purpose: needs capitalised names).
  {
    reason: "student-specific",
    re: /\bis\s+(student\s+)?[A-Z][a-z]+(\s+[A-Z][a-z]+)?\s+eligible\b|\bstudent\s+[A-Z][a-z]+\s+[A-Z][a-z]+|\bwill\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s+(get|receive|qualify)\b/,
  },
  // Tax advice before the personal-situation rule: "my 1040 ... my son" is a tax question first (probe A04).
  { reason: "non-ed-tax-advice", re: /\b(irs|tax return|deduct|1040|w-?2|tax credit|file my taxes)\b/i },
  // A specific person's record or situation, in any capitalisation (red-team probes A01-A03, A10).
  {
    reason: "student-specific",
    re: /\b(my|his|her|their|our)\s+(isir|sai|efc|fafsa|pell|aid|loan|eligibility)\b|\bam i eligible\b|\bwill i (get|qualify|receive)\b|\bcan i (get|receive|qualify)\b|\bi'?m\s+(incarcerated|eligible)\b|\b(my|our)\s+(daughter|son|child|kid|wife|husband|spouse|dependent)\b|\b(my|our)\s+student(?!s\b|\s+(aid|financial|loan|account|information|record)s?\b)/i,
  },
  { reason: "private-member-content", re: /\bnasfaa\b.*\b(member|tip|private|autopilot|ask regs)\b/i },
  // Vendor or internal setup, in either word order (probe A09).
  { reason: "vendor-internal-config", re: /\b(anthology|campusnexus|vendor|internal)\b.*\b(config\w*|setup|setting\w*|help|knowledge)\b|\b(config\w*|setup|setting\w*)\b.*\b(anthology|campusnexus|vendor)\b/i },
];

// Words that can sit where a name would ("will independent students qualify", "Student Aid Index"), so a
// two-word "name" made of them is not a person. Names typed in lowercase are caught only in the strongly
// personal frames "is/will/can/does X Y (be) eligible/get/receive/qualify" (live probe A14).
const NOT_A_NAME = new Set((
  "the a an my your our their his her its this that these those each every any all some such no one two both either neither " +
  "part full half less more most first second third new returning continuing current former prospective transfer summer " +
  "independent dependent graduate undergraduate professional incarcerated eligible ineligible enrolled admitted international " +
  "student students borrower borrowers parent parents school schools institution institutions applicant applicants recipient recipients " +
  "people person they we you he she it someone anyone everyone nobody aid financial federal pell grant grants loan loans direct plus " +
  "teach fseog work study index information record records office services service account accounts status level year years award awards " +
  "eligibility enrollment verification identification number id isir sai fafsa cost attendance program programs department education " +
  "title iv still also then there here now ever just really actually automatically always never"
).split(" "));
const realName = (a: string, b: string) => !NOT_A_NAME.has(a.toLowerCase()) && !NOT_A_NAME.has(b.toLowerCase());
function namesPerson(q: string) {
  const frame = q.match(/\b(?:is|will|can|does|did)\s+([a-z]+)\s+([a-z]+)\s+(?:be\s+)?(?:eligible|get|receive|qualify)\b/i);
  if (frame && realName(frame[1], frame[2])) return true;
  // "Student Maria Lopez …" at the start of a sentence (capital S); both name words capitalised.
  const labelled = q.match(/\b[Ss]tudent\s+([A-Z][a-z]+)\s+([A-Z][a-z]+)\b/);
  return !!labelled && realName(labelled[1], labelled[2]);
}

export function detectRefuse(q: string): string | null {
  for (const r of REFUSE_RULES) if (r.re.test(q)) return r.reason;
  if (namesPerson(q)) return "student-specific";
  return null;
}

/** Free-text feedback comments get the same privacy screen as questions: anything the refusal rules would refuse is not stored. */
export const COMMENT_REMOVED = "[removed: may contain student details]";
export const screenComment = (c: string | null | undefined) => (!c ? null : detectRefuse(c) ? COMMENT_REMOVED : c);

const KEYWORD_SECTIONS: [RegExp, string][] = [
  [/satisfactory academic progress|\bsap\b/i, "668.34"],
  [/return of title iv|\br2t4\b|withdraw/i, "668.22"],
  [/cost of attendance|\bcoa\b/i, "668.2"],
  [/verification/i, "668.53"],
  [/credit balance|disbursement/i, "668.164"],
  // Any "loan limit(s)" wording, not just the exact phrase "annual loan limit": "annual Direct Subsidized Loan limits"
  // and "aggregate loan limits" never reached 685.203 (retrieval scorecard 2026-10-06, AG40/AG47; day-1 pilot misses).
  [/schedule of reductions|less-than-full-time|\bloans?\s+limits?\b/i, "685.203"],
  [/professional judgment/i, "690.75"],
  [/pell grant/i, "690.62"],
  [/student eligibility|eligible student/i, "668.32"],
  [/clock hour|credit hour/i, "600.2"],
];

export function route(q: string): LookupInput {
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
    full_text: stripXml(xml), // used only for the word check; never returned to the browser
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
  "a an the of to in on for and or is are was be been what how does do did when who which why with under by from about this that these those it its i my me we our you your can could should would will may might must not no yes any all each every one two three four more than then there here if as at into also only just same such other both either between whether without within including anyway please give tell show explain walk through look find lookup recent correct right true wrong really actually exact exactly current currently today now new cover covers covered mean means say says statement determine determines determining affect affects difference differ happen happens step steps need needs rely item items documents inputs input factors doc docs thing things way ways matter matters might they them has have had having check checks checked checking start starts started starting begin begins beginning versus vs role roles similar like etc using whose where while before after during"
).split(" "));
const GENERIC = new Set((
  "title iv federal ed education department cfr section regulation regulations rule rules regulatory notice register document proposed final school schools institution institutions student students program programs aid financial award awards year years applicable apply applies eligible eligibility requirement requirements general definition definitions defined define use used uses based case cases amount amounts part subpart paragraph official source handbook fsa staff member question rule"
).split(" "));

// "full time" / "full-time" (and half/less-than-full) are the same idea.
export const normalizeText = (s: string) => s.replace(/\b(full|half|part|less[- ]than[- ]full)[\s-]+time\b/gi, (_m, a: string) => `${a.replace(/\s+/g, "-")}-time`);
// Abbreviations written in capitals count as terms even when the lowercase word is common (SAY).
const ABBREV_TERMS = ["ISIR", "SAI", "COA", "BBAY", "SAY", "LEU", "R2T4", "EFC", "MPN", "LOA", "NSLDS", "COD", "FAFSA", "SAP", "OBBBA"];
// A law's nickname names the statute, not the rule: regulation and handbook text never use it, so it is never a
// required term (a question saying "under OBBBA" failed the word check on a section that has the rule).
export const LAW_NICKNAMES = /\bone big beautiful bill(?:\s+act)?\b|\bOBBBA?\b|\bH\.?\s?R\.?\s?1\b(?!\d)/gi;
export function distinctiveTerms(q: string) {
  q = q.replace(LAW_NICKNAMES, " ");
  const cleaned = normalizeText(q).toLowerCase().replace(/§\s*/g, " ").replace(/\br2t4\b/g, " r2t4x ").replace(/\b\d+(\.\d+)*[a-z]?\b/g, " ").replace(/\br2t4x\b/g, "r2t4");
  const terms = cleaned.match(/[a-z][a-z0-9-]{2,}/g) ?? [];
  const abbrevs = ABBREV_TERMS.filter((a) => new RegExp(`\\b${a}\\b`).test(q)).map((a) => a.toLowerCase());
  return [...new Set([...terms.filter((t) => !STOP.has(t) && !GENERIC.has(t)), ...abbrevs])];
}

const SYNONYMS: Record<string, string[]> = {
  r2t4: ["return of title iv", "withdraw"], sap: ["satisfactory academic progress"], isir: ["institutional student information record", "isir"],
  sai: ["student aid index"], efc: ["expected family contribution"], coa: ["cost of attendance"], mpn: ["master promissory note"],
  loa: ["leave of absence"], nslds: ["national student loan data system"], cod: ["common origination and disbursement"],
  fafsa: ["free application for federal student aid"], leu: ["lifetime eligibility used"], bbay: ["borrower-based academic year"],
  say: ["scheduled academic year"], obbba: ["one big beautiful bill"],
};

const baseOf = (t: string) => {
  const b = t.replace(/(ations|ation|ions|ion|ings|ing|ments|ment|ed|es|s)$/, "");
  return b.length >= 4 ? b : t.replace(/s$/, "");
};
// Regulatory wording for ideas the regulation expresses without the everyday word (reviewed cases only).
const REG_CONCEPTS: Record<string, RegExp> = {
  exempt: /\bnot considered to have withdrawn\b|\bexempt/i,
};
export function stemHit(term: string, hay: string) {
  hay = normalizeText(hay);
  if (SYNONYMS[term]?.some((p) => hay.toLowerCase().includes(p))) return true;
  // Abbreviations: match the capitalised form only (so "say" the verb never counts as SAY).
  const ab = ABBREV_TERMS.find((a) => a.toLowerCase() === term);
  if (ab) return new RegExp(`\\b${ab}\\b`).test(hay);
  if (REG_CONCEPTS[baseOf(term)]?.test(hay)) return true;
  const base = baseOf(term);
  const esc = (x: string) => x.replace(/[-]/g, "[- ]?");
  // Short words must match whole (cents ≠ centralized); longer words match by prefix (withdrawal ~ withdraw).
  if (base.length <= 5) return new RegExp(`\\b${esc(base)}(s|es|ed|ing|ion|ions|al|ly|d)?\\b`, "i").test(hay);
  return new RegExp(`\\b${esc(base.slice(0, Math.max(5, base.length - 2)))}`, "i").test(hay);
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
const HANDBOOK_HEADING_SIM_MIN = 0.70;
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
// Terms after "including …" are secondary; ranking by heading uses the question's primary subject.
const primaryPart = (q: string) => q.split(/\bincluding\b|\bas well as\b/i)[0];
// Topic words (a word in most of a chapter's headings, e.g. "Pell" in Vol 7 Ch 2) name the whole chapter,
// so they never count as heading hits or heading precision. The fit score itself is unchanged.
export function handbookFit(q: string, heading: string, text: string, isTopic: (term: string) => boolean = () => false) {
  const terms = distinctiveTerms(q);
  const primary = new Set(distinctiveTerms(primaryPart(q)));
  const headingTerms: string[] = [];
  const phrases: [unknown, { test: (s: string) => boolean }, string][] = PHRASE_TERMS.filter(([qre]) => qre.test(q));
  // Numbered variants are distinct concepts. BBAY 1/2/3 count toward fit (tuned on reviewed Vol 3 cases).
  // Formula N decides completeness only: a section explaining how formulas are chosen ("Basic Pell Grant Formulas")
  // never names Formula 1-4 but is still the relevant passage (U21). Uncovered ones are listed as missing, not scored.
  const completenessOnly: { test: (s: string) => boolean; label: string }[] = [];
  for (const v of numberedVariants(q)) {
    if (v.label.startsWith("BBAY")) phrases.push([null, v, v.label]);
    else completenessOnly.push(v);
  }
  const hay = `${heading} ${text}`;
  let got = 0, total = 0;
  const missing: string[] = [];
  let headingHits = 0;
  for (const t of terms) {
    const inHead = stemHit(t, heading);
    const hit = inHead || stemHit(t, hay) || !!HANDBOOK_CONCEPTS[t]?.test(text);
    const w = inHead ? 2 : 1;
    total += w; if (hit) got += w; else missing.push(t);
    if (inHead && primary.has(t) && !isTopic(t)) { headingHits++; headingTerms.push(t); }
  }
  for (const [, hre, label] of phrases) { total += 1; if (hre.test(hay)) got += 1; else missing.push(label); }
  for (const v of completenessOnly) if (!v.test(hay)) missing.push(v.label);
  // Heading precision: share of the heading's own distinctive words that the question names,
  // so "Nonstandard Terms" outranks a long heading that only mentions terms in passing.
  // Main heading only (text before any ":" subtitle); examples use their own title.
  const main = heading.replace(/^Volume \d+, Chapter \d+, Example \d+:\s*/i, "").split(":")[0];
  const hw = distinctiveTerms(main).filter((w) => !isTopic(w));
  const headingPrecision = hw.length ? hw.filter((w) => stemHit(w, q)).length / hw.length : 0;
  return { score: total ? got / total : 1, missing, headingHits, headingTerms, headingPrecision };
}

const ACADEMIC_YEAR_DEFINITION = /\bacademic year\b[^?]*\b(defin|mean)|\bdefin\w*\b[^?]*\bacademic year\b/i;
const WHY_INTENT = /\bwhy\b/i;
const WHY_ANSWERED = /\bbecause\b|\breasons?\b|\bpurpose\b|\bin order to\b|\bso that\b|\bto allow\b|\bflexib/i;
const PRESCRIPTIVE = /\bhow (should|must|is|are)\b[^?]*\b(assign|treat|combin)/i;
const CONDITIONAL_TEXT = /\bif you choose\b|\bcould also choose\b|\bin certain limited cases\b|\bmay combine\b|\beither the\b/i;
const EXAMPLE_INTENT = /\bexamples?\b|\bworked\b|\billustrat|\bscenario\b|\bsample calculation/i;
// Plain word search terms: distinctive words (stems/synonyms) plus phrase ideas like "award year" and BBAY 1/2/3.
function keywordTerms(q: string) {
  const out: { label: string; test: (h: string) => boolean }[] = distinctiveTerms(q).map((t) => ({ label: t, test: (h: string) => stemHit(t, h) }));
  for (const [qre, hre, label] of PHRASE_TERMS) if (qre.test(q)) out.push({ label, test: (h) => hre.test(h) });
  if (/scheduled academic year/i.test(q) || /\bSAY\b/.test(q)) out.push({ label: "SAY", test: (h) => /scheduled academic year|\bSAY\b/i.test(h) });
  for (const v of numberedVariants(q)) out.push({ label: v.label, test: v.test });
  return out;
}
// Missing definitions: the question's program definitions section first (690.2 Pell, 685.102 Direct Loans),
// then 34 CFR 668.2 (general) and 600.2 (institutional eligibility).
const DEFINABLE = /\baward year\b|\bpayment period\b|\bacademic year\b|\bfull-time student\b|\bclock hour\b|\bcredit hour\b/gi;
const PROGRAM_TERMS: [RegExp, string][] = [[/\bscheduled\b[^?]*\bpell\b/i, "scheduled federal pell grant"]];
function definitionSources(q: string) {
  const s: string[] = [];
  if (/\bpell\b/i.test(q)) s.push("690.2");
  if (/\bdirect (subsidized |unsubsidized |plus )?loans?\b/i.test(q)) s.push("685.102");
  return [...s, "668.2", "600.2"];
}
async function definitionsFor(q: string, missing: string[], log?: AttemptLog) {
  const general = [...new Set([...(normalizeText(q).match(DEFINABLE) ?? []).map((t) => t.toLowerCase())])].filter((t) => missing.includes(t));
  const program = PROGRAM_TERMS.filter(([re]) => re.test(q)).map(([, t]) => t);
  const wanted = [...new Set([...program, ...general])];
  if (!wanted.length) return [];
  const extract = (full: string, term: string) =>
    full.match(new RegExp(`(?:^|\\n)\\s*${term.replace(/-/g, "[- ]")}\\s*:[^\\n]*`, "i"))?.[0].trim().slice(0, 1500) ?? null;
  const sources = definitionSources(q);
  const cache = new Map<string, AnyResult>();
  const out = [];
  for (const term of wanted) {
    const checked: string[] = [];
    for (const sec of sources) {
      if (!cache.has(sec)) cache.set(sec, await ecfr("34", sec, log));
      const s = cache.get(sec)!;
      checked.push(`34 CFR ${sec}`);
      const def = extract((s.full_text as string) ?? "", term);
      if (def) { out.push({ term, citation_id: `ecfr:34-${sec}`, title: s.title, text: def, source_url: s.source_url, as_of_date: s.as_of_date, authority_rank: 1, checked }); break; }
    }
  }
  return out;
}
const RELATED_BOTH_FIT_MIN = 0.5;
export const CURRENT_AWARD_YEAR = "2026-27"; // public results show current-year guidance only; prior years stay in storage
type HandbookRow = {
  heading: string; text: string; citation_ref: string; ordinal: number; similarity: number; official_url: string; title: string;
  award_year: string | null; source_class: string; source_status: string; publication_date: string | null; last_modified_date: string | null;
  page_published_date: string | null; retrieved_at: string; content_hash: string; document_version_key: string;
  is_example: boolean; fictional_amounts: boolean;
};
// v2 (flags, staged rows on preview, 500-row cap) with a fallback to v1 until the Stage 2A migration is applied.
async function currentChunks(qe: string, includeStaged: boolean) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const v2 = await supabaseAdmin.rpc("match_current_chunks_v2" as never, { query_embedding: qe, award: CURRENT_AWARD_YEAR, match_count: 500, include_staged: includeStaged } as never);
  if (!v2.error) return { rows: (v2.data ?? []) as HandbookRow[], lookup_version: "v2" as const };
  const missing = v2.error.code === "PGRST202" || /could not find the function|does not exist/i.test(v2.error.message);
  if (!missing) throw new Error(v2.error.message);
  const v1 = await supabaseAdmin.rpc("match_current_chunks" as never, { query_embedding: qe, award: CURRENT_AWARD_YEAR, match_count: 500 } as never);
  if (v1.error) throw new Error(v1.error.message);
  // v1 has no flag columns: examples from the heading; fictional amounts for chunks carrying the note and
  // for examples in a document that carries it.
  const raw = (v1.data ?? []) as Omit<HandbookRow, "is_example" | "fictional_amounts" | "page_published_date">[];
  const noted = new Set(raw.filter((r) => textHasFictionalNote(r.text)).map((r) => r.document_version_key));
  const rows = raw.map((r) => {
    const is_example = headingIsExample(r.heading);
    return { ...r, page_published_date: null, is_example, fictional_amounts: textHasFictionalNote(r.text) || (is_example && noted.has(r.document_version_key)) };
  });
  return { rows, lookup_version: "v1" as const };
}

async function handbookSearch(q: string, includeStaged = false) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { passages: [], error: "handbook search not configured" };
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-embedding-2", input: [q] }),
    });
    if (!res.ok) throw new Error(`embeddings ${res.status}`);
    const ej = (await res.json()) as { data: { embedding: number[] }[]; usage?: { prompt_tokens?: number; total_tokens?: number } };
    const emb = ej.data[0].embedding;
    const embeddingTokens = ej.usage?.prompt_tokens ?? ej.usage?.total_tokens ?? null;
    if (emb.length !== 3072) throw new Error(`unexpected dimension ${emb.length}`);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const qe = JSON.stringify(emb);
    const [all, cur]: [{ data: unknown; error: { message: string } | null }, Awaited<ReturnType<typeof currentChunks>>] = await Promise.all([
      supabaseAdmin.rpc("match_chunks" as never, { query_embedding: qe, match_count: 10 } as never),
      currentChunks(qe, includeStaged),
    ]);
    if (all.error) throw new Error(all.error.message);
    const priorYearExcluded = ((all.data ?? []) as { award_year: string | null }[]).filter((r) => r.award_year !== CURRENT_AWARD_YEAR).length;
    const allRows: HandbookRow[] = cur.rows;
    // Each volume's chapter titles (from official URLs), for volume-level topic words and programs.
    const volKey = (r: HandbookRow) => { const c = chapterOf(r); return c ? `${r.award_year}:vol${c.volume}` : `doc:${r.document_version_key}`; };
    const volTitles = new Map<string, Map<string, string>>();
    for (const r of allRows) volTitles.set(volKey(r), (volTitles.get(volKey(r)) ?? new Map()).set(r.document_version_key, chapterTitleWords(r.official_url)));
    const docVol = new Map(allRows.map((r) => [r.document_version_key, volKey(r)]));
    const volumePrograms = new Map<string, Set<string>>();
    for (const [v, titles] of volTitles) {
      const list = [...titles.values()];
      const each = list.map(programsIn);
      // With 3+ chapters, a volume is "about" the programs most of its chapter titles name; otherwise any title's.
      const progs = list.length >= 3 ? [...new Set(each.flatMap((x) => [...x]))].filter((p) => each.filter((x) => x.has(p)).length / list.length > 0.5) : each.flatMap((x) => [...x]);
      volumePrograms.set(v, new Set(progs));
    }
    // A question naming an aid program never gets passages from a volume about a different program.
    const qPrograms = programsIn(q);
    const rows = allRows.filter((r) => !offProgram(qPrograms, volumePrograms.get(volKey(r)) ?? new Set()));
    const key = sectionKey;
    // Full text of each section (document version + heading), in reading order.
    const sectionText = new Map<string, string>();
    for (const r of [...rows].sort((x, y) => x.document_version_key.localeCompare(y.document_version_key) || x.ordinal - y.ordinal))
      sectionText.set(key(r), `${sectionText.get(key(r)) ?? ""} ${r.text}`);
    const fullText = (r: HandbookRow) => sectionText.get(key(r)) ?? r.text;
    const headingOf = new Map(rows.map((r) => [key(r), r.heading]));
    // Each document's section headings (examples excluded), for topic-word detection.
    const docHeadings = new Map<string, Set<string>>();
    for (const r of rows) if (!r.is_example) docHeadings.set(r.document_version_key, (docHeadings.get(r.document_version_key) ?? new Set()).add(r.heading));
    const topicCache = new Map<string, boolean>();
    const isTopic = (doc: string) => (term: string) => {
      const ck = `${doc}\u0000${term}`;
      if (!topicCache.has(ck)) {
        // Topic word of the chapter (most of its section headings) or of its volume (most of its chapter titles, 3+ chapters).
        const vol = docVol.get(doc) ?? "";
        // Chapter topic words stay per chapter: spreading them across the volume made "Formula" (most Ch 4 headings)
        // erase Ch 2's "Basic Pell Grant Formulas" heading hit (U21). Answer choice handles U10 instead.
        topicCache.set(ck, isTopicTerm(term, [...(docHeadings.get(doc) ?? [])], stemHit) || isTopicTerm(term, [...(volTitles.get(vol)?.values() ?? [])], stemHit, 3));
      }
      return topicCache.get(ck)!;
    };
    const fitOf = (r: HandbookRow, text = fullText(r)) => handbookFit(q, r.heading, text, isTopic(r.document_version_key));
    // Chapters in the searched library: cross-references to these are passages here, not "not imported yet".
    const imported = new Map<string, string>();
    for (const r of allRows) { const c = chapterOf(r); if (c) imported.set(`${c.volume}:${c.chapter}`, r.official_url); }
    // Plain word search over every current-year section (full section text, rarer words weigh more).
    const sections = [...sectionText.entries()];
    const kwTerms = keywordTerms(q);
    const df = new Map(kwTerms.map((t) => [t.label, sections.filter(([k, tx]) => t.test(`${headingOf.get(k)} ${tx}`)).length]));
    const keyword = sections.map(([k, tx]) => {
      const heading = headingOf.get(k)!;
      const hay = `${heading} ${tx}`;
      const hits = kwTerms.filter((t) => t.test(hay));
      const idf = (t: { label: string }) => Math.log(1 + sections.length / Math.max(1, df.get(t.label) ?? 1));
      const total = kwTerms.reduce((a, t) => a + idf(t), 0) || 1;
      return { key: k, heading, score: Math.round((hits.reduce((a, t) => a + idf(t), 0) / total) * 100) / 100, matched: hits.map((t) => t.label) };
    }).filter((k) => k.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
    const keywordTop = new Set(keyword.filter((k) => k.score >= 0.5).slice(0, 4).map((k) => k.key));
    const ranked = rows
      .filter((r) => r.award_year === CURRENT_AWARD_YEAR)
      // A section split into several chunks is judged as one section (same document and verified heading).
      .map((r) => ({ ...r, fit: fitOf(r), via: [] as string[] }))
      .map((r) => {
        if (r.similarity >= HANDBOOK_SIM_MIN || (r.fit.headingHits >= 2 && r.similarity >= HANDBOOK_HEADING_SIM_MIN)) r.via.push("meaning");
        // Word-search hits qualify with a stricter fit (0.8) and the existing 0.70 heading floor.
        if (keywordTop.has(key(r)) && r.fit.score >= FIT_MIN_KEYWORD && r.similarity >= HANDBOOK_HEADING_SIM_MIN) r.via.push("words");
        return r;
      })
      // Similarity floor 0.74; a passage whose verified heading names ≥2 of the question's primary
      // terms may qualify from HANDBOOK_HEADING_SIM_MIN. Topical fit (FIT_MIN) applies to both.
      .filter((r) => r.via.length > 0 && r.fit.score >= FIT_MIN)
      // Rank: sections whose verified heading names more of the question's terms first; on a tie,
      // rule sections before worked examples; then by similarity.
      .sort((a, b) => Number(b.fit.headingHits >= 2) - Number(a.fit.headingHits >= 2)
        || Number(a.is_example) - Number(b.is_example)
        || b.fit.headingPrecision - a.fit.headingPrecision
        || b.similarity - a.similarity);
    // Pick up to 3, preferring passages whose heading covers primary terms not yet covered.
    const picked: typeof ranked = [];
    const covered = new Set<string>();
    const uniq = ranked.filter((r, i) => ranked.findIndex((x) => key(x) === key(r)) === i);
    ranked.splice(0, ranked.length, ...uniq);
    const maxPick = EXAMPLE_INTENT.test(q) ? 4 : 3;
    while (picked.length < maxPick && picked.length < ranked.length) {
      const rest = ranked.filter((r) => !picked.includes(r));
      const best = rest.find((r) => r.fit.headingTerms.some((t) => !covered.has(t))) ?? rest[0];
      picked.push(best); best.fit.headingTerms.forEach((t) => covered.add(t));
    }
    // "How is an academic year defined" → both definitional minimums ("… in an Academic Year":
    // weeks of instructional time and credit/clock hours) are shown together, first.
    if (ACADEMIC_YEAR_DEFINITION.test(q)) {
      const defs = rows.filter((r) => / in an Academic Year$/i.test(r.heading) && r.similarity >= HANDBOOK_HEADING_SIM_MIN)
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((r) => ({ ...r, fit: fitOf(r), via: ["definition"] }))
        .filter((r, i, arr) => arr.findIndex((x) => key(x) === key(r)) === i);
      if (defs.length >= 2) {
        const rest = picked.filter((r) => !defs.some((d) => key(d) === key(r)));
        picked.splice(0, picked.length, ...defs, ...rest);
        picked.length = Math.min(picked.length, 3);
      }
    }
    // Found by both searches (in the meaning top 8 AND the word-search top 8): shown as a related
    // passage; answerEligible() decides whether word search only confirmed a meaning match.
    const meaningTop = new Set(rows.slice(0, 8).map(key));
    const wordsTop = new Set(keyword.map((k) => k.key));
    const inBoth = (k: string) => meaningTop.has(k) && wordsTop.has(k);
    for (const p of picked) if (inBoth(key(p))) p.via = [...new Set([...p.via, "meaning", "words"])];
    // The related-only shortlist ranks meaning among on-topic passages (fit >= 0.5), so off-topic chapters can't crowd it.
    const topicalMeaningTop = new Set([...new Set(rows.filter((r) => fitOf(r).score >= RELATED_BOTH_FIT_MIN).map(key))].slice(0, 8));
    const extras = rows
      .filter((r) => topicalMeaningTop.has(key(r)) && wordsTop.has(key(r)) && r.similarity >= HANDBOOK_HEADING_SIM_MIN && !picked.some((p) => key(p) === key(r)))
      .filter((r, i, arr) => arr.findIndex((x) => key(x) === key(r)) === i)
      .map((r) => ({ ...r, fit: fitOf(r), via: ["meaning", "words"] }))
      .filter((r) => r.fit.score >= RELATED_BOTH_FIT_MIN) // related-only tier; answer thresholds unchanged
      .slice(0, 2);
    picked.push(...extras);
    // A section split into several pieces is shown from its first (defining) piece.
    for (let i = 0; i < picked.length; i++) {
      const first = rows.filter((r) => key(r) === key(picked[i])).sort((a, b) => a.ordinal - b.ordinal)[0];
      if (first && first.ordinal < picked[i].ordinal) picked[i] = { ...first, fit: picked[i].fit, via: picked[i].via };
    }
    // Specific things the question names (e.g. "BBAY 3") — an example must contain them to count as the answer.
    const specifics = kwTerms.filter((t) => /^BBAY \d+$|^Formula \d+[AB]?$|^SAY$|^award year$/.test(t.label));
    const seen = new Set<string>();
    const passages = picked.filter((r) => !seen.has(key(r)) && !!seen.add(key(r)))
      .map((r) => {
        const locator = r.citation_ref.match(/https?:\/\/\S+/)?.[0] ?? r.official_url;
        const fictional = r.fictional_amounts;
        return {
          citation_id: `fsa-hb:${r.award_year ?? "unknown"}:${r.document_version_key}#${r.ordinal}`,
          label: r.citation_ref.replace(/\s*https?:\/\/\S+/, "").replace(/[—–-]\s*$/, "").trim(),
          heading: r.heading, passage: r.text, source_url: locator, official_url: r.official_url, document_title: r.title,
          award_year: r.award_year, source_status: r.source_status, publication_date: r.publication_date,
          last_modified_date: r.last_modified_date, page_published_date: r.page_published_date, retrieved_at: r.retrieved_at, content_hash: r.content_hash,
          is_example: r.is_example || headingIsExample(r.heading), fictional_amounts: fictional, warning: fictional ? FICTIONAL_WARNING : null,
          similarity: Math.round(r.similarity * 1000) / 1000, fit: Math.round(r.fit.score * 100) / 100, missing_terms: r.fit.missing, heading_hits: r.fit.headingHits, found_by: r.via,
          // Would qualify on meaning alone (0.74 floor, not the 0.70 heading route), whatever word search found.
          meaning_qualified: r.similarity >= HANDBOOK_SIM_MIN,
          contains_named: r.fit.missing.length === 0 && specifics.every((t) => t.test(`${r.heading} ${fullText(r)}`)),
          look_next: lookNext(fullText(r), r.award_year ?? CURRENT_AWARD_YEAR, chapterOf(r), imported),
          authority_rank: 4, authority_label: `FSA Handbook ${r.award_year ?? ""} (sub-regulatory guidance)`.replace("  ", " "),
        };
      });
    const candidates = rows.slice(0, 12).map((r) => { const f = fitOf(r, r.text); return { ordinal: r.ordinal, heading: r.heading, similarity: Math.round(r.similarity * 1000) / 1000, fit: Math.round(f.score * 100) / 100, heading_hits: f.headingHits, heading_precision: Math.round(f.headingPrecision * 100) / 100 }; });
    const meaning = rows.slice(0, 8).map((r) => ({ heading: r.heading, similarity: Math.round(r.similarity * 1000) / 1000 }));
    const docs = [...new Map(allRows.map((r) => [r.document_version_key, { chapter: chapterOf(r), staged: r.source_status === "staged" }])).values()];
    return {
      passages, prior_year_excluded: priorYearExcluded, candidates, search_report: { meaning_top: meaning, words_top: keyword.map(({ key: _k, ...k }) => k) },
      coverage: coverageText(CURRENT_AWARD_YEAR, docs), lookup_version: cur.lookup_version, staged_included: includeStaged && cur.lookup_version === "v2",
      embedding_tokens: embeddingTokens,
    };
  } catch (e) {
    console.error("handbook search failed", e);
    return { passages: [], prior_year_excluded: 0, error: "Handbook search is temporarily unavailable." };
  }
}

/** Among passages allowed to be the answer, one covering more of the question's terms comes first; ties keep rank order. */
export function orderAnswers<T extends { missing_terms: string[] }>(eligible: T[]) {
  return eligible.map((p, i) => ({ p, i })).sort((a, b) => a.p.missing_terms.length - b.p.missing_terms.length || a.i - b.i).map((x) => x.p);
}

export type AnswerCandidate = {
  found_by: string[]; meaning_qualified: boolean; missing_terms: string[]; heading_hits: number;
  is_example: boolean; contains_named: boolean; fictional_amounts: boolean;
};
// Which handbook passages may be the answer (the rest are related):
// - a passage word search helped find is related — unless it is a rule section that qualifies on meaning
//   alone (similarity >= 0.74), covers every question term, and its heading names a non-topic question term;
//   then word search only confirmed it and did not upgrade it;
// - a worked example is the answer only when the question asks for an example and it contains the named item;
// - for a question asking the actual maximum/minimum Pell amount, fictional-amount passages and examples never answer.
export function answerEligible(q: string, p: AnswerCandidate) {
  const confirmedByWords = !p.is_example && p.meaning_qualified && p.missing_terms.length === 0 && p.heading_hits >= 1;
  if (p.found_by.includes("words") && !confirmedByWords) return false;
  if (p.is_example && !(EXAMPLE_INTENT.test(q) && p.contains_named)) return false;
  if (asksPellAmount(q) && (p.fictional_amounts || p.is_example)) return false;
  return true;
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

export type LookupOptions = { /** Preview only: include rows imported as 'staged' (not yet approved for the published site). */ includeStaged?: boolean };

export async function lookup(input: LookupInput, opts: LookupOptions = {}) {
  const log: AttemptLog = [];
  try {
    if ("mode" in input) { const r = await routedLookup(input, log); delete (r as Record<string, unknown>).full_text; return r; }
    const q = input.q;
    const reason = detectRefuse(q);
    if (reason) {
      return { ok: true, mode: "refuse", refuse: true, refuse_reason: reason, citation_ids: [], text: null, query: q, fetched_at: now() };
    }
    const routed = route(q) as Extract<LookupInput, { mode: string }>;
    const [primary, hb] = await Promise.all([routedLookup(routed, log), handbookSearch(q, opts.includeStaged === true)]);
    let result: AnyResult = primary;
    // Topical-fit gate: explicit numbers and keyword triggers can't validate unrelated questions.
    if (primary.ok && primary.mode !== "no-confident-cite" && primary.mode !== "fr-search") {
      const fit = topicalFit(q, `${primary.title ?? ""} ${(primary.full_text as string | undefined) ?? primary.text ?? ""}`);
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
    // Which passages may be the answer:
    // - anything word search helped find (words only, or both searches) is related, never the answer;
    // - a worked example is the answer only when the question asks for an example AND the example
    //   contains the specific thing the question names (e.g. "BBAY 3").
    // - for a question asking for the actual maximum/minimum Pell amount, a passage with fictional amounts
    //   is never the answer, and an example is only ever related.
    const amountQuestion = asksPellAmount(q);
    const eligible = (p: (typeof handbook)[number]) => answerEligible(q, p);
    const answers = orderAnswers(handbook.filter(eligible));
    if (result.mode === "no-confident-cite" && answers.length) {
      const top = answers[0];
      result = {
        ...result, ok: true, mode: "handbook-passage", no_match: false, no_confident_cite: false, related_passages: false,
        citation_id: top.citation_id, title: `${top.document_title ?? "FSA Handbook"} — ${top.heading}`, source_url: top.source_url,
        text: top.passage, authority_rank: top.authority_rank, authority_label: top.authority_label, award_year: top.award_year,
      };
    } else if (result.mode === "no-confident-cite" && handbook.length) {
      result = { ...result, no_confident_cite: false, related_passages: true };
    }
    // Once a passage is cited (as answer or related), the "No confident citation" wording is cleared from the data.
    if (handbook.length && (result.mode === "handbook-passage" || result.related_passages)) {
      delete (result as Record<string, unknown>).rejected_candidate;
      result.message = result.related_passages ? "Related handbook passages, not a complete answer." : null;
    }
    const passagesOut = handbook.map((p) => ({ ...p, role: result.mode === "handbook-passage" && p.citation_id === result.citation_id ? "answer" : "related" }));
    let coverage: { status: "retrieved-text" | "partial"; missing_terms: string[]; notes: string[] } | null = null;
    let conditional: string | null = null;
    const defNote = (defs: { term: string; citation_id: string; checked: string[] }[]) =>
      `Definition of ${defs.map((d) => `"${d.term}"`).join(", ")} added from ${[...new Set(defs.map((d) => d.citation_id.replace("ecfr:34-", "34 CFR ")))].join(", ")} (checked in order: ${definitionSources(q).map((s) => `34 CFR ${s}`).join(", ")}).`;
    if (result.mode === "handbook-passage") {
      const shown = handbook.map((p) => `${p.heading} ${p.passage}`).join(" ");
      const missing = handbook.length ? handbook.reduce<string[]>((acc, p) => acc.filter((t) => p.missing_terms.includes(t)), handbook[0].missing_terms) : [];
      const notes: string[] = [];
      if (missing.length) notes.push(`The passages shown don't cover: ${missing.map((t) => `"${t}"`).join(", ")}.`);
      if (WHY_INTENT.test(q) && !WHY_ANSWERED.test(shown)) notes.push("The passages describe the rule and its effects but don't explain why a school would choose it.");
      const defs = await definitionsFor(q, missing, log).catch(() => []);
      if (defs.length) {
        result = { ...result, definitions: defs };
        const found = defs.map((d) => d.term);
        const still = missing.filter((t) => !found.includes(t));
        notes.splice(0, notes.length, ...notes.filter((n) => !n.startsWith("The passages shown")));
        if (still.length) notes.unshift(`The passages shown don't cover: ${still.map((t) => `"${t}"`).join(", ")}.`);
        notes.push(defNote(defs));
      }
      // "Complete" needs the answer itself to cover every question term, not just the related passages beside it.
      const answerOwnGaps = (handbook.find((p) => p.citation_id === result.citation_id)?.missing_terms ?? []).filter((t) => !missing.includes(t));
      if (answerOwnGaps.length) notes.push(`The answer passage itself doesn't cover ${answerOwnGaps.map((t) => `"${t}"`).join(", ")}; the related passages may.`);
      const wordNote = wordAssistedNote(handbook.find((p) => p.citation_id === result.citation_id)?.found_by ?? []);
      if (wordNote) notes.push(wordNote);
      if (amountQuestion) notes.push(OFFICIAL_AMOUNT_NOTICE);
      coverage = { status: notes.some((n) => !n.startsWith("Definition of")) ? "partial" : "retrieved-text", missing_terms: missing, notes };
      if (PRESCRIPTIVE.test(q) && CONDITIONAL_TEXT.test(shown))
        conditional = "Conditional: the handbook describes options that depend on how the program's calendar is set up — not one assignment that applies to every program.";
    } else if (result.mode === "no-confident-cite") {
      // No complete answer, but a named program term can still be defined from its official definitions section.
      const missing = ((result.rejected_candidate as { missing_terms?: string[] } | undefined)?.missing_terms) ?? [];
      const defs = await definitionsFor(q, missing, log).catch(() => []);
      if (defs.length) {
        result = {
          ...result,
          mode: "definition-only",
          definitions: defs,
          no_confident_cite: false,
          message: "Relevant definition found, but this does not fully answer the question.",
        };
        delete (result as Record<string, unknown>).rejected_candidate;
        coverage = { status: "partial", missing_terms: missing, notes: ["No complete answer. " + defNote(defs)] };
      }
    }
    // Amount questions with no answer: lead with the plain explanation, not the "no confident citation" wording.
    if (amountQuestion && result.mode === "no-confident-cite") {
      result.message = OFFICIAL_AMOUNT_NOTICE;
      delete (result as Record<string, unknown>).rejected_candidate;
    }
    delete (result as Record<string, unknown>).full_text;
    const hbx = hb as { coverage?: string; lookup_version?: string; staged_included?: boolean; embedding_tokens?: number | null };
    return { ...result, coverage, conditional, official_amount_notice: amountQuestion ? OFFICIAL_AMOUNT_NOTICE : null, upstream_attempts: log, handbook_search_report: (hb as { search_report?: unknown }).search_report ?? null, handbook_passages: passagesOut, handbook_error: hb.error ?? null, handbook_prior_year_excluded: hb.prior_year_excluded, handbook_candidates: (hb as { candidates?: unknown[] }).candidates ?? [],
      handbook_coverage: hbx.coverage ?? `none for ${CURRENT_AWARD_YEAR} yet`, handbook_lookup_version: hbx.lookup_version ?? null,
      handbook_staged_included: hbx.staged_included ?? false, handbook_embedding_tokens: hbx.embedding_tokens ?? null };
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
