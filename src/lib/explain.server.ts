// Server-only: owner-only AI explanation of what Ask Regs cited. Runs the normal lookup, then asks a model
// (Lovable AI gateway) to explain ONLY those sources, and returns the explanation only if it passes
// checkExplanation(). One retry with the problems listed; otherwise nothing is shown.
import { lookup } from "@/lib/ed-source-desk.server";
import { checkExplanation, explainMessages, explainSources } from "@/lib/explain";
import { asksPellAmount } from "@/lib/handbook-lookup";

const DEFAULT_MODEL = "google/gemini-2.5-flash";

type Usage = { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };

async function chat(messages: { role: "system" | "user" | "assistant"; content: string }[], model: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, temperature: 0 }),
  });
  if (!res.ok) throw new Error(`AI gateway returned HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: Usage };
  return { text: j.choices?.[0]?.message?.content?.trim() ?? "", usage: j.usage ?? null };
}

export async function runExplain(q: string, includeStaged: boolean) {
  const started = Date.now();
  const r = (await lookup({ q }, { includeStaged })) as Record<string, unknown> & Parameters<typeof explainSources>[0] & { ok: boolean };
  if (!r.ok) return { ok: false, status: 502, error: "The lookup failed, so there is nothing to explain.", lookup_mode: r.mode ?? null };
  if (r.refuse) return { ok: true, status: 200, explanation: null, reason: "This question is one Ask Regs refuses, so it is not explained.", lookup_mode: r.mode };
  const amountQuestion = asksPellAmount(q);
  const sources = explainSources(r, amountQuestion);
  if (!sources.length) return { ok: true, status: 200, explanation: null, reason: "Nothing was cited, so there is nothing to explain.", lookup_mode: r.mode };
  const model = process.env["ED_SOURCE_DESK_EXPLAIN_MODEL"] || DEFAULT_MODEL;
  const messages = explainMessages(q, sources, r.coverage?.notes ?? []);
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
  const tokens = usages.every((u) => u?.total_tokens !== undefined) ? usages.reduce((a, u) => a + (u!.total_tokens ?? 0), 0) : "unavailable";
  return {
    ok: true, status: 200,
    explanation: check.ok ? reply.text : null,
    reason: check.ok ? null : `The AI's explanation failed the source check (${check.problems.join("; ")}), so it is not shown.`,
    checks: check, attempts: usages.length, model, tokens, latency_ms: Date.now() - started,
    sources: sources.map(({ id, citation_id, label, kind, fictional }) => ({ id, citation_id, label, kind, fictional })),
    lookup_mode: r.mode,
  };
}
