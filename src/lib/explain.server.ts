// Server-only: owner-only AI explanation of what Ask Regs cited. Runs the normal lookup, then asks a model
// (Lovable AI gateway) to explain ONLY those sources, and returns the explanation only if it passes
// checkExplanation(). One retry with the problems listed; otherwise nothing is shown.
import { lookup } from "@/lib/ed-source-desk.server";
import { checkExplanation, explainMessages, explainSources, judgeMessages, parseJudge, type ExplainSource } from "@/lib/explain";
import { OFFICIAL_AMOUNT_NOTICE, asksPellAmount } from "@/lib/handbook-lookup";

const DEFAULT_MODEL = "google/gemini-2.5-flash";

type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };

async function chat(messages: { role: "system" | "user" | "assistant"; content: string }[], model: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
  const send = (withTemperature: boolean) => fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, ...(withTemperature ? { temperature: 0 } : {}) }),
  });
  let res = await send(true);
  // Some models (e.g. openai/gpt-5-mini) only accept their default temperature: resend without it.
  if (res.status === 400) {
    const err = await res.text();
    if (!/temperature/i.test(err)) throw new Error(`AI gateway returned HTTP 400: ${err.slice(0, 200)}`);
    res = await send(false);
  }
  if (!res.ok) throw new Error(`AI gateway returned HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: Usage };
  return { text: j.choices?.[0]?.message?.content?.trim() ?? "", usage: j.usage ?? null };
}

const sumTokens = (usages: (Usage | null)[]) =>
  usages.every((u) => u?.total_tokens !== undefined) ? usages.reduce((a, u) => a + (u!.total_tokens ?? 0), 0) : ("unavailable" as const);

/** One model's explanation of the given sources: first try plus one corrective retry, checked each time. */
async function explainWith(q: string, sources: ExplainSource[], notes: string[], model: string) {
  const started = Date.now();
  const messages = explainMessages(q, sources, notes);
  const usages: (Usage | null)[] = [];
  let reply = await chat(messages, model);
  usages.push(reply.usage);
  let check = checkExplanation(reply.text, sources);
  if (!check.ok) {
    reply = await chat([...messages, { role: "assistant", content: reply.text },
      { role: "user", content: `Your answer broke these rules: ${check.problems.join("; ")}. Rewrite it following every rule, using only the sources.` }], model);
    usages.push(reply.usage);
    check = checkExplanation(reply.text, sources);
  }
  return { text: reply.text, check, attempts: usages.length, tokens: sumTokens(usages), latency_ms: Date.now() - started };
}

type LookupResult = Record<string, unknown> & Parameters<typeof explainSources>[0] & { ok: boolean };
/** Shared preamble: the normal lookup, and the sources an explanation may use (or why there is nothing to explain). */
type Stop = { ok: boolean; status: number; error?: string; explanation?: null; reason?: string; lookup_mode: unknown };
type Prepared = { stop: Stop } | { r: LookupResult; sources: ExplainSource[]; notes: string[] };
async function sourcesFor(q: string, includeStaged: boolean): Promise<Prepared> {
  const r = (await lookup({ q }, { includeStaged })) as LookupResult;
  if (!r.ok) return { stop: { ok: false, status: 502, error: "The lookup failed, so there is nothing to explain.", lookup_mode: r.mode ?? null } };
  if (r.refuse) return { stop: { ok: true, status: 200, explanation: null, reason: "This question is one Ask Regs refuses, so it is not explained.", lookup_mode: r.mode } };
  const amountQuestion = asksPellAmount(q);
  // Amount questions with no cited answer: the official-amount notice says it all; don't spend a model call.
  if (amountQuestion && r.mode === "no-confident-cite")
    return { stop: { ok: true, status: 200, explanation: null, reason: OFFICIAL_AMOUNT_NOTICE, lookup_mode: r.mode } };
  const sources = explainSources(r, amountQuestion);
  if (!sources.length) return { stop: { ok: true, status: 200, explanation: null, reason: "Nothing was cited, so there is nothing to explain.", lookup_mode: r.mode } };
  return { r, sources, notes: r.coverage?.notes ?? [] };
}

export async function runExplain(q: string, includeStaged: boolean) {
  const pre = await sourcesFor(q, includeStaged);
  if ("stop" in pre) return pre.stop;
  const model = process.env["ED_SOURCE_DESK_EXPLAIN_MODEL"] || DEFAULT_MODEL;
  const e = await explainWith(q, pre.sources, pre.notes, model);
  return {
    ok: true, status: 200,
    explanation: e.check.ok ? e.text : null,
    reason: e.check.ok ? null : `The AI's explanation failed the source check (${e.check.problems.join("; ")}), so it is not shown.`,
    checks: e.check, attempts: e.attempts, model, tokens: e.tokens, latency_ms: e.latency_ms,
    sources: pre.sources.map(({ id, citation_id, label, kind, fictional }) => ({ id, citation_id, label, kind, fictional })),
    lookup_mode: pre.r.mode,
  };
}

export const COMPARE_DEFAULT_MODELS = ["google/gemini-2.5-flash", "openai/gpt-5-mini"];
export const COMPARE_DEFAULT_JUDGE = "google/gemini-2.5-pro";

/**
 * Owner-only model comparison: one lookup, the same sources explained by each model, every reply checked by the
 * same source check and graded against the rubric by a separate judge model. Failed-check drafts are graded too
 * (so the comparison sees them) but are never shown on the site.
 */
export async function runCompare(q: string, includeStaged: boolean, models = COMPARE_DEFAULT_MODELS, judge = COMPARE_DEFAULT_JUDGE) {
  const pre = await sourcesFor(q, includeStaged);
  if ("stop" in pre) return { ...pre.stop, question: q, models: [] };
  const results = [];
  for (const model of models) {
    try {
      const e = await explainWith(q, pre.sources, pre.notes, model);
      const g = await chat(judgeMessages(q, pre.sources, e.text), judge).catch((err: Error) => ({ text: "", usage: null, err }));
      const grade = parseJudge(g.text);
      results.push({ model, passed_check: e.check.ok, problems: e.check.problems, attempts: e.attempts, tokens: e.tokens, latency_ms: e.latency_ms,
        grade, judge_tokens: g.usage?.total_tokens ?? "unavailable", explanation: e.text });
    } catch (err) {
      results.push({ model, error: err instanceof Error ? err.message : "model call failed" });
    }
  }
  return { ok: true, status: 200, question: q, lookup_mode: pre.r.mode, judge, sources: pre.sources.map(({ id, citation_id, label, kind, fictional }) => ({ id, citation_id, label, kind, fictional })), models: results };
}
