// Monitoring, daily caps and feedback for Ask Regs (pure helpers, no `@/` imports, no network) — unit-tested.

export type UsageKind = "lookup" | "explain" | "compare";
export type UsageRow = {
  created_at: string; kind: UsageKind; ok: boolean; mode: string | null; refused: boolean; capped: boolean; check_failed: boolean;
  staged: boolean; latency_ms: number | null; embedding_tokens: number | null; ai_tokens: number | null; question: string | null;
};
export type FeedbackRow = { created_at: string; helpful: boolean; lookup_mode: string | null; citation_id: string | null; question: string | null; comment: string | null };

export const QUESTION_MAX = 300;
/** Question text kept for monitoring: trimmed and truncated, and never for refused questions (they may describe a person). */
export const storableQuestion = (q: string | null | undefined, refused: boolean) => (refused || !q ? null : q.trim().slice(0, QUESTION_MAX) || null);

/** Daily limits (UTC day), overridable by env. Lookups are cheap; AI tokens are what costs money. */
export const DEFAULT_CAPS = { lookups: 1000, ai_tokens: 300_000, feedback: 200 } as const;
export type Caps = { lookups: number; ai_tokens: number; feedback: number };
export function capsFrom(env: Record<string, string | undefined>): Caps {
  const n = (v: string | undefined, d: number) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? Math.floor(x) : d; };
  return {
    lookups: n(env["ED_SOURCE_DESK_DAILY_LOOKUP_CAP"], DEFAULT_CAPS.lookups),
    ai_tokens: n(env["ED_SOURCE_DESK_DAILY_AI_TOKEN_CAP"], DEFAULT_CAPS.ai_tokens),
    feedback: n(env["ED_SOURCE_DESK_DAILY_FEEDBACK_CAP"], DEFAULT_CAPS.feedback),
  };
}
export const startOfUtcDay = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();

export const LOOKUP_CAP_MESSAGE = "Ask Regs has reached today's lookup limit. Please try again tomorrow (limits reset at midnight UTC).";
export const AI_CAP_MESSAGE = "Today's AI token budget is used up, so no explanation was written. It resets at midnight UTC.";

const median = (xs: number[]) => percentile(xs, 0.5);
function percentile(xs: number[], p: number) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)];
}
const rate = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);

const NO_ANSWER_MODES = new Set(["no-confident-cite", "definition-only"]);

/** Weekly (or any window) quality and cost summary from the usage log and feedback. */
export function summarizeUsage(rows: UsageRow[], feedback: FeedbackRow[], days: number) {
  const lookups = rows.filter((r) => r.kind === "lookup" && !r.capped);
  const answered = lookups.filter((r) => r.ok && !r.refused);
  const ai = rows.filter((r) => r.kind !== "lookup" && !r.capped);
  const explains = rows.filter((r) => r.kind === "explain" && !r.capped && r.ok && r.ai_tokens !== null);
  const byMode: Record<string, number> = {};
  for (const r of lookups) byMode[r.mode ?? (r.ok ? "unknown" : "error")] = (byMode[r.mode ?? (r.ok ? "unknown" : "error")] ?? 0) + 1;
  const unanswered = new Map<string, number>();
  for (const r of answered) if (r.mode && NO_ANSWER_MODES.has(r.mode) && r.question) unanswered.set(r.question, (unanswered.get(r.question) ?? 0) + 1);
  const latencies = lookups.map((r) => r.latency_ms).filter((x): x is number => typeof x === "number");
  const sum = (xs: (number | null)[]) => xs.reduce<number>((a, x) => a + (x ?? 0), 0);
  const helpful = feedback.filter((f) => f.helpful).length;
  return {
    window_days: days,
    lookups: {
      total: lookups.length,
      capped: rows.filter((r) => r.kind === "lookup" && r.capped).length,
      errors: lookups.filter((r) => !r.ok).length,
      source_unavailable: lookups.filter((r) => r.mode === "source-unavailable").length,
      refused: lookups.filter((r) => r.refused).length,
      no_answer_rate_pct: rate(answered.filter((r) => r.mode && NO_ANSWER_MODES.has(r.mode)).length, answered.length),
      by_mode: byMode,
      median_latency_ms: median(latencies),
      p95_latency_ms: percentile(latencies, 0.95),
      embedding_tokens: sum(lookups.map((r) => r.embedding_tokens)),
      top_unanswered: [...unanswered.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([question, count]) => ({ question, count })),
    },
    ai: {
      explain_calls: rows.filter((r) => r.kind === "explain" && !r.capped).length,
      compare_calls: rows.filter((r) => r.kind === "compare" && !r.capped).length,
      capped: rows.filter((r) => r.kind !== "lookup" && r.capped).length,
      errors: ai.filter((r) => !r.ok).length,
      check_failed: explains.filter((r) => r.check_failed).length,
      check_fail_rate_pct: rate(explains.filter((r) => r.check_failed).length, explains.length),
      tokens: sum(ai.map((r) => r.ai_tokens)),
    },
    feedback: {
      total: feedback.length,
      helpful,
      not_helpful: feedback.length - helpful,
      helpful_rate_pct: rate(helpful, feedback.length),
      recent_not_helpful: feedback.filter((f) => !f.helpful).slice(0, 10)
        .map(({ created_at, question, lookup_mode, citation_id, comment }) => ({ created_at, question, lookup_mode, citation_id, comment })),
    },
  };
}

/** Total AI tokens of a model comparison: every explanation plus every judge call that reported usage. */
export const compareTokens = (models: { tokens?: unknown; judge_tokens?: unknown }[]) =>
  models.reduce<number>((a, m) => a + (typeof m.tokens === "number" ? m.tokens : 0) + (typeof m.judge_tokens === "number" ? m.judge_tokens : 0), 0);
