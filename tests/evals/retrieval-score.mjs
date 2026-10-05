// Pure scoring for the retrieval-only eval (plan item 3.3). No network, no AI: unit-tested offline.
//
// A label's `accept` list names the sources that answer the question:
//   "ecfr:34-668.22"                         an eCFR section (exact citation id; FR and Regulations.gov ids work the same way)
//   "hb:Basic Pell Grant Formulas"           a handbook section, matched on its heading (prefix)
//   "hb:vol7:ch2|Basic Pell Grant Formulas"  the same, limited to one document (vol7:ch2)
// Raw search candidates carry a heading but no document, so candidate matching uses the heading only.

export const CURRENT_AWARD_YEAR = '2026-27';
export const TOP_K = 5;
const CONFIDENT_MODES = new Set(['ecfr-section', 'fr-doc', 'reggov-doc', 'handbook-passage']);

export function parseAccept(s) {
  if (typeof s !== 'string' || !s.trim()) throw new Error(`invalid accept entry ${JSON.stringify(s)}`);
  if (!s.startsWith('hb:')) return { type: 'id', id: s };
  const rest = s.slice(3);
  const bar = rest.indexOf('|');
  return bar >= 0
    ? { type: 'heading', document: rest.slice(0, bar), heading: rest.slice(bar + 1) }
    : { type: 'heading', document: null, heading: rest };
}

const norm = (s) => String(s ?? '').trim().toLowerCase();

/** Does one shown or candidate item satisfy one accept entry? */
export function matches(item, accept) {
  if (accept.type === 'id') return !!item.id && item.id === accept.id;
  if (!item.heading || !norm(item.heading).startsWith(norm(accept.heading))) return false;
  if (!accept.document) return true;
  return item.document == null ? true : String(item.document).includes(accept.document);
}

const isAccepted = (item, accepts) => accepts.some((a) => matches(item, a));
const docOf = (citationId) => (String(citationId ?? '').match(/^fsa-hb:[^:]+:(.+)#\d+$/) ?? [])[1] ?? null;

/** What the user saw, in order: the cited source first, then handbook passages, then added definitions. */
export function shownList(response) {
  const items = [];
  const seen = new Set();
  const push = (item) => { if (item.id && seen.has(item.id)) return; if (item.id) seen.add(item.id); items.push(item); };
  const passages = response?.handbook_passages ?? [];
  if (response?.citation_id && CONFIDENT_MODES.has(response.mode)) {
    const hb = passages.find((p) => p.citation_id === response.citation_id);
    push({ id: response.citation_id, heading: hb?.heading ?? null, document: docOf(response.citation_id), role: 'answer', award_year: hb?.award_year ?? null });
  }
  for (const p of passages) push({ id: p.citation_id, heading: p.heading, document: docOf(p.citation_id), role: p.role ?? 'related', award_year: p.award_year ?? null });
  for (const d of response?.definitions ?? []) push({ id: d.citation_id, heading: d.term ?? null, document: null, role: 'definition', award_year: null });
  return items;
}

/** The raw meaning-search shortlist (top 12 by similarity, before thresholds and filters). */
export const candidateList = (response) =>
  (response?.handbook_candidates ?? []).map((c) => ({ id: null, heading: c.heading, document: null, similarity: c.similarity, fit: c.fit }));

/** True when the response presents a source as the answer (not "related", not "no confident citation"). */
export const isConfident = (response) => !!response?.citation_id && CONFIDENT_MODES.has(response?.mode) && response?.related_passages !== true;

/** Score one labeled question against one lookup response. */
export function scoreCase(label, response) {
  const accepts = (label.accept ?? []).map(parseAccept);
  const shown = shownList(response);
  const candidates = candidateList(response);
  const rank = shown.findIndex((x) => isAccepted(x, accepts)) + 1;
  const candRank = candidates.findIndex((x) => isAccepted(x, accepts)) + 1;
  const wrongYear = (response?.handbook_passages ?? []).some((p) => p.award_year && p.award_year !== CURRENT_AWARD_YEAR);
  const confident = isConfident(response);
  const answerItem = confident ? shown[0] : null;
  const base = {
    id: label.id, expect: label.expect, split: label.split ?? null, status: label.status ?? null,
    mode: response?.mode ?? null, refused: response?.refuse === true, confident,
    shown: shown.map((x) => x.id ?? x.heading), wrong_award_year: wrongYear,
  };
  if (label.expect === 'refuse') return { ...base, correct: response?.refuse === true };
  if (label.expect === 'not-in-library') {
    // Nothing in the library answers it: the right outcome is no confident answer. Related passages are allowed.
    return { ...base, correct: !confident && response?.refuse !== true, false_confident_citation: confident };
  }
  if (label.expect !== 'answer') return { ...base, scored: false };
  const top1 = rank === 1;
  const topK = rank >= 1 && rank <= TOP_K;
  let miss = null;
  if (!topK) {
    const wantsHandbook = accepts.some((a) => a.type === 'heading');
    if (response?.refuse) miss = 'refused';
    else if (label.in_library === false) miss = 'not in library';
    else if (wantsHandbook && candRank > 0) miss = 'in library, retrieved but not shown (ranking or filters)';
    else if (wantsHandbook) miss = 'in library, not in the top 12 search candidates';
    else if (response?.citation_id) miss = 'routed to a different source';
    else miss = 'no source shown';
  }
  return {
    ...base, scored: true, rank: rank || null, top1, top_k: topK, reciprocal_rank: rank ? 1 / rank : 0,
    candidate_rank: candRank || null,
    answer_correct: confident ? isAccepted(answerItem, accepts) : null,
    irrelevant_top_result: shown.length > 0 && !isAccepted(shown[0], accepts),
    miss,
  };
}

const xofn = (x, n) => `${x} of ${n}`;

/** Aggregate scored rows into the scorecard numbers, always as "x of n". */
export function summarize(rows) {
  const answer = rows.filter((r) => r.expect === 'answer' && r.scored);
  const nil = rows.filter((r) => r.expect === 'not-in-library');
  const refuse = rows.filter((r) => r.expect === 'refuse');
  const confident = answer.filter((r) => r.confident);
  const misses = {};
  for (const r of answer) if (r.miss) misses[r.miss] = (misses[r.miss] ?? 0) + 1;
  const mrr = answer.length ? answer.reduce((a, r) => a + r.reciprocal_rank, 0) / answer.length : null;
  return {
    answerable: {
      n: answer.length,
      top1: xofn(answer.filter((r) => r.top1).length, answer.length),
      [`top${TOP_K}`]: xofn(answer.filter((r) => r.top_k).length, answer.length),
      mrr: mrr === null ? null : Math.round(mrr * 1000) / 1000,
      confident_answer_correct: xofn(confident.filter((r) => r.answer_correct).length, confident.length),
      irrelevant_top_result: xofn(answer.filter((r) => r.irrelevant_top_result).length, answer.length),
      misses,
    },
    not_in_library: { n: nil.length, correctly_no_confident_answer: xofn(nil.filter((r) => r.correct).length, nil.length), false_confident_citations: nil.filter((r) => r.false_confident_citation).length },
    refuse: { n: refuse.length, refused: xofn(refuse.filter((r) => r.correct).length, refuse.length) },
    wrong_award_year: xofn(rows.filter((r) => r.wrong_award_year).length, rows.length),
    unscored_needs_label: rows.filter((r) => r.scored === false).length,
  };
}
