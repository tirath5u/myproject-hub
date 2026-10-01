import { describe, expect, test } from "bun:test";
import { DEFAULT_CAPS, capsFrom, compareTokens, startOfUtcDay, storableQuestion, summarizeUsage, type FeedbackRow, type UsageRow } from "../../src/lib/usage";

const row = (o: Partial<UsageRow>): UsageRow => ({
  created_at: "2026-10-01T10:00:00Z", kind: "lookup", ok: true, mode: "handbook-passage", refused: false, capped: false, check_failed: false,
  staged: false, latency_ms: 500, embedding_tokens: 20, ai_tokens: null, question: "q", ...o,
});

describe("storableQuestion", () => {
  test("never stores refused questions; trims and truncates", () => {
    expect(storableQuestion("Can I get Pell with my ISIR?", true)).toBeNull();
    expect(storableQuestion("  What is a BBAY?  ", false)).toBe("What is a BBAY?");
    expect(storableQuestion("x".repeat(400), false)!.length).toBe(300);
    expect(storableQuestion("", false)).toBeNull();
  });
});

describe("caps", () => {
  test("defaults, env overrides, invalid values ignored", () => {
    expect(capsFrom({})).toEqual({ ...DEFAULT_CAPS });
    expect(capsFrom({ ED_SOURCE_DESK_DAILY_LOOKUP_CAP: "50", ED_SOURCE_DESK_DAILY_AI_TOKEN_CAP: "abc", ED_SOURCE_DESK_DAILY_FEEDBACK_CAP: "-1" }))
      .toEqual({ lookups: 50, ai_tokens: DEFAULT_CAPS.ai_tokens, feedback: DEFAULT_CAPS.feedback });
  });
  test("UTC day start", () => expect(startOfUtcDay(new Date("2026-10-01T23:59:00-05:00"))).toBe("2026-10-02T00:00:00.000Z"));
  test("comparison tokens sum explanations and judge calls that reported usage", () =>
    expect(compareTokens([{ tokens: 100, judge_tokens: 50 }, { tokens: "unavailable", judge_tokens: 30 }, {}])).toBe(180));
});

describe("summarizeUsage", () => {
  const rows = [
    row({ latency_ms: 100 }), row({ latency_ms: 300 }),
    row({ mode: "no-confident-cite", question: "What is X?", latency_ms: 900 }), row({ mode: "no-confident-cite", question: "What is X?" }),
    row({ mode: "refuse", refused: true, question: null }),
    row({ ok: false, mode: "source-unavailable" }),
    row({ capped: true, ok: false, mode: null, latency_ms: null }),
    row({ kind: "explain", ai_tokens: 2000, check_failed: true, embedding_tokens: null }),
    row({ kind: "explain", ai_tokens: 1000, embedding_tokens: null }),
    row({ kind: "compare", ai_tokens: 9000, embedding_tokens: null }),
  ];
  const fb: FeedbackRow[] = [
    { created_at: "2026-10-01T11:00:00Z", helpful: true, lookup_mode: "handbook-passage", citation_id: "a", question: "q", comment: null },
    { created_at: "2026-10-01T10:00:00Z", helpful: false, lookup_mode: "no-confident-cite", citation_id: null, question: "What is X?", comment: "missing" },
  ];
  const s = summarizeUsage(rows, fb, 7);
  test("lookups: capped excluded from totals, no-answer rate over answered (non-refused, ok) lookups", () => {
    expect(s.lookups.total).toBe(6);
    expect(s.lookups.capped).toBe(1);
    expect(s.lookups.refused).toBe(1);
    expect(s.lookups.errors).toBe(1);
    expect(s.lookups.source_unavailable).toBe(1);
    expect(s.lookups.no_answer_rate_pct).toBe(50);
    expect(s.lookups.top_unanswered).toEqual([{ question: "What is X?", count: 2 }]);
    expect(s.lookups.embedding_tokens).toBe(120);
    expect(s.lookups.median_latency_ms).toBe(500);
  });
  test("AI: tokens, check failure rate over explanations", () => {
    expect(s.ai.explain_calls).toBe(2);
    expect(s.ai.compare_calls).toBe(1);
    expect(s.ai.tokens).toBe(12000);
    expect(s.ai.check_fail_rate_pct).toBe(50);
  });
  test("feedback", () => {
    expect(s.feedback).toMatchObject({ total: 2, helpful: 1, not_helpful: 1, helpful_rate_pct: 50 });
    expect(s.feedback.recent_not_helpful[0].comment).toBe("missing");
  });
});
