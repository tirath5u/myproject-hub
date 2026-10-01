// Owner-only AI explanation (pure helpers, no `@/` imports, no network) — unit-tested.
// The model may only restate the sources Ask Regs already cited; every point must cite a source id,
// and the reply is rejected if it cites an unknown source or states a dollar amount the sources don't show
// outside fictional examples.

export type ExplainSource = { id: string; citation_id: string; label: string; kind: "answer" | "related" | "definition"; text: string; fictional: boolean };

type LookupLike = {
  mode?: string; refuse?: boolean; citation_id?: string; title?: string; text?: string | null;
  handbook_passages?: { citation_id: string; heading: string; label?: string; passage: string; role?: string; fictional_amounts?: boolean }[];
  definitions?: { citation_id: string; term: string; text: string }[];
  coverage?: { notes?: string[] } | null;
};

const MAX_SOURCE_CHARS = 6000;

/** Sources the explanation may use, in the order the page shows them. Amount questions drop fictional-amount passages. */
export function explainSources(r: LookupLike, amountQuestion: boolean): ExplainSource[] {
  if (r.refuse) return [];
  const out: ExplainSource[] = [];
  const seen = new Set<string>();
  const add = (s: Omit<ExplainSource, "id">) => {
    if (!s.text.trim() || seen.has(s.citation_id) || (amountQuestion && s.fictional)) return;
    seen.add(s.citation_id);
    out.push({ ...s, text: s.text.slice(0, MAX_SOURCE_CHARS), id: `S${out.length + 1}` });
  };
  const passages = r.handbook_passages ?? [];
  const answerPassage = passages.find((p) => p.citation_id === r.citation_id);
  const answered = r.mode && !["no-confident-cite", "definition-only", "refuse", "source-unavailable"].includes(r.mode);
  if (answered && r.citation_id && r.text)
    add({ citation_id: r.citation_id, label: r.title ?? r.citation_id, kind: "answer", text: r.text, fictional: !!answerPassage?.fictional_amounts });
  for (const p of passages)
    add({ citation_id: p.citation_id, label: p.label || p.heading, kind: p.citation_id === r.citation_id ? "answer" : "related", text: p.passage, fictional: !!p.fictional_amounts });
  for (const d of r.definitions ?? []) add({ citation_id: d.citation_id, label: `Definition of "${d.term}" (${d.citation_id})`, kind: "definition", text: d.text, fictional: false });
  return out;
}

export function explainMessages(q: string, sources: ExplainSource[], coverageNotes: string[] = []) {
  const system = [
    "You explain U.S. federal student aid rules in plain English for a financial aid professional.",
    "Use ONLY the numbered sources provided. Do not add facts, numbers, dates, or rules from memory.",
    "Write 3 to 7 short bullet points and nothing else: no title, no introduction, no summary sentence. Start directly with the first bullet.",
    "End every bullet with the source ids it relies on, like [S1] or [S1][S3].",
    "If the sources do not fully answer the question, add one final line starting with \"Not covered:\" saying what is missing (no citation needed on that line).",
    "Sources marked FICTIONAL use made-up example amounts: never present those amounts as real figures.",
    "Never give advice about a specific student, and never state an official maximum or minimum award amount unless a non-fictional source states it.",
    "Sources labelled related or definition may only partly apply; say so when you rely on them.",
  ].join("\n");
  const body = sources.map((s) => `[${s.id}] ${s.label} (${s.kind}${s.fictional ? ", FICTIONAL example amounts" : ""})\n${s.text}`).join("\n\n");
  const notes = coverageNotes.length ? `\n\nKnown gaps from the lookup: ${coverageNotes.join(" ")}` : "";
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: `Question: ${q}\n\nSources:\n\n${body}${notes}` },
  ];
}

const AMOUNT = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\$\s?\d+(?:\.\d{2})?/g;
const norm = (a: string) => a.replace(/\s/g, "");

/** Checks a model reply. Only a reply with `ok: true` may be shown. */
export function checkExplanation(text: string, sources: ExplainSource[]) {
  const ids = new Set(sources.map((s) => s.id));
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const cited = [...text.matchAll(/\[(S\d+)\]/g)].map((m) => m[1]);
  const unknown_citations = [...new Set(cited.filter((c) => !ids.has(c)))];
  // Bullets and markdown are ignored for these rules; a short intro line ending in ":" states no fact.
  const plain = (l: string) => l.replace(/^[\s>*_#•\-–—]+/, "").replace(/^[*_]+|[*_]+$/g, "").trim();
  // A lead-in ending in ":" is allowed when the line right after it cites a source (the points carry the facts).
  const isCited = (l: string | undefined) => !!l && /\[S\d+\]/.test(l);
  const exempt = (l: string, i: number) =>
    /^not covered\b/i.test(plain(l)) || (plain(l).endsWith(":") && (plain(l).length <= 80 || (plain(l).length <= 200 && isCited(lines[i + 1]))));
  const uncited = lines.filter((l, i) => !exempt(l, i) && !isCited(l));
  const uncited_lines = uncited.length;
  const realText = sources.filter((s) => !s.fictional).map((s) => s.text).join("\n");
  const amounts_not_in_sources = [...new Set((text.match(AMOUNT) ?? []).map(norm))].filter((a) => !(realText.match(AMOUNT) ?? []).map(norm).includes(a));
  const problems = [
    ...(cited.length ? [] : ["no source cited"]),
    ...unknown_citations.map((c) => `cites unknown source ${c}`),
    ...(uncited_lines ? [`${uncited_lines} line(s) without a source (first: "${plain(uncited[0]).slice(0, 80)}")`] : []),
    ...amounts_not_in_sources.map((a) => `amount ${a} is not in a non-fictional source`),
  ];
  return { ok: problems.length === 0, problems, cited_sources: [...new Set(cited)].filter((c) => ids.has(c)) };
}

// ---- Model comparison: rubric grading by a separate judge model ------------------------------------------
export const RUBRIC = {
  faithfulness: "5 = every statement is directly supported by the cited source text; 3 = mostly supported with minor overreach; 1 = contains claims the sources do not support.",
  completeness: "5 = covers everything in the sources that answers the question; 3 = covers the main point but misses relevant detail; 1 = misses the main point.",
  clarity: "5 = plain English a financial aid professional can act on, well organized; 3 = understandable but wordy or jargon-heavy; 1 = confusing.",
} as const;
export type JudgeScores = { faithfulness: number; completeness: number; clarity: number; unsupported_claims: string[]; ok: boolean; error?: string };

export function judgeMessages(q: string, sources: ExplainSource[], explanation: string) {
  const system = [
    "You grade an AI explanation of U.S. federal student aid sources. Judge ONLY against the numbered sources given; do not use outside knowledge.",
    `Score each 1-5. Faithfulness: ${RUBRIC.faithfulness} Completeness: ${RUBRIC.completeness} Clarity: ${RUBRIC.clarity}`,
    "List every statement in the explanation that the sources do not support (quote it briefly).",
    'Reply with JSON only: {"faithfulness":n,"completeness":n,"clarity":n,"unsupported_claims":["..."]}',
  ].join("\n");
  const body = sources.map((s) => `[${s.id}] ${s.label}${s.fictional ? " (FICTIONAL example amounts)" : ""}\n${s.text}`).join("\n\n");
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: `Question: ${q}\n\nSources:\n\n${body}\n\nExplanation to grade:\n${explanation}` },
  ];
}

/** Parses the judge's JSON reply (tolerates code fences or surrounding prose); scores are clamped to 1-5. */
export function parseJudge(text: string): JudgeScores {
  const m = text.match(/\{[\s\S]*\}/);
  try {
    const j = JSON.parse(m ? m[0] : text) as Record<string, unknown>;
    const score = (k: string) => { const n = Math.round(Number(j[k])); if (!Number.isFinite(n)) throw new Error(`missing ${k}`); return Math.min(5, Math.max(1, n)); };
    const claims = Array.isArray(j.unsupported_claims) ? j.unsupported_claims.map(String).filter(Boolean) : [];
    return { faithfulness: score("faithfulness"), completeness: score("completeness"), clarity: score("clarity"), unsupported_claims: claims, ok: true };
  } catch (e) {
    return { faithfulness: 0, completeness: 0, clarity: 0, unsupported_claims: [], ok: false, error: e instanceof Error ? e.message : "unparseable judge reply" };
  }
}
