import { describe, expect, test } from "bun:test";
// Plain .mjs module shared with the Node runner.
import { matches, parseAccept, scoreCase, shownList, summarize } from "../evals/retrieval-score.mjs";

const hb = (doc: string, ord: number, heading: string, role = "related", award_year = "2026-27") =>
  ({ citation_id: `fsa-hb:2026-27:${doc}:v1#${ord}`, heading, role, award_year });

describe("parseAccept and matches", () => {
  test("ids match exactly; headings match by prefix, case-insensitive", () => {
    expect(matches({ id: "ecfr:34-668.22" }, parseAccept("ecfr:34-668.22"))).toBe(true);
    expect(matches({ id: "ecfr:34-668.2" }, parseAccept("ecfr:34-668.22"))).toBe(false);
    expect(matches({ heading: "Basic Pell Grant Formulas" }, parseAccept("hb:basic pell grant"))).toBe(true);
    expect(matches({ heading: "Pell Formulas" }, parseAccept("hb:Basic Pell"))).toBe(false);
  });
  test("a document-limited heading rejects another document but accepts an item with no document (raw candidates)", () => {
    const a = parseAccept("hb:vol7:ch2|Introduction");
    expect(matches({ heading: "Introduction", document: "vol7:ch2:v1" }, a)).toBe(true);
    expect(matches({ heading: "Introduction", document: "vol3:ch1:v1" }, a)).toBe(false);
    expect(matches({ heading: "Introduction", document: null }, a)).toBe(true);
  });
});

describe("shownList", () => {
  test("cited source first, then passages, then definitions, without duplicates", () => {
    const r = { mode: "handbook-passage", citation_id: hb("vol7:ch2", 4, "A").citation_id,
      handbook_passages: [hb("vol7:ch2", 4, "A", "answer"), hb("vol7:ch2", 9, "B")], definitions: [{ citation_id: "ecfr:34-690.2", term: "Scheduled award" }] };
    expect(shownList(r).map((x: { id: string }) => x.id)).toEqual([r.citation_id, hb("vol7:ch2", 9, "B").citation_id, "ecfr:34-690.2"]);
  });
  test("a no-confident-cite result shows only its related passages", () => {
    expect(shownList({ mode: "no-confident-cite", citation_id: "ecfr:34-1.1", handbook_passages: [hb("vol7:ch2", 1, "X")] }).length).toBe(1);
  });
});

describe("scoreCase", () => {
  const label = { id: "T1", expect: "answer", accept: ["hb:Basic Pell Grant Formulas"], in_library: true };
  test("top-1 hit with a correct confident answer", () => {
    const r = { mode: "handbook-passage", citation_id: hb("vol7:ch2", 3, "Basic Pell Grant Formulas").citation_id, handbook_passages: [hb("vol7:ch2", 3, "Basic Pell Grant Formulas", "answer")] };
    const s = scoreCase(label, r);
    expect([s.rank, s.top1, s.reciprocal_rank, s.answer_correct, s.irrelevant_top_result, s.miss]).toEqual([1, true, 1, true, false, null]);
  });
  test("rank 2 counts in top 5 with reciprocal rank 0.5 and an irrelevant top result", () => {
    const r = { mode: "no-confident-cite", related_passages: true, handbook_passages: [hb("vol7:ch4", 1, "Formula 1"), hb("vol7:ch2", 3, "Basic Pell Grant Formulas")] };
    const s = scoreCase(label, r);
    expect([s.rank, s.top1, s.top_k, s.reciprocal_rank, s.confident, s.irrelevant_top_result]).toEqual([2, false, true, 0.5, false, true]);
  });
  test("a miss found in the raw candidates is ranking or filters; one absent is outside the top 12", () => {
    const shown = { mode: "no-confident-cite", handbook_passages: [] };
    expect(scoreCase(label, { ...shown, handbook_candidates: [{ heading: "Basic Pell Grant Formulas", similarity: 0.85 }] }).miss).toBe("in library, retrieved but not shown (ranking or filters)");
    expect(scoreCase(label, { ...shown, handbook_candidates: [] }).miss).toBe("in library, not in the top 12 search candidates");
    expect(scoreCase({ ...label, in_library: false }, shown).miss).toBe("not in library");
  });
  test("eCFR label routed elsewhere; wrong award year flagged", () => {
    const s = scoreCase({ id: "T2", expect: "answer", accept: ["ecfr:34-668.22"] }, { mode: "ecfr-section", citation_id: "ecfr:34-690.2", handbook_passages: [hb("vol7:ch2", 1, "Old", "related", "2025-26")] });
    expect([s.miss, s.answer_correct, s.wrong_award_year]).toEqual(["routed to a different source", false, true]);
  });
  test("not-in-library is correct only without a confident answer", () => {
    const nil = { id: "T3", expect: "not-in-library", accept: [] };
    expect(scoreCase(nil, { mode: "no-confident-cite", related_passages: true, handbook_passages: [hb("vol7:ch2", 1, "X")] }).correct).toBe(true);
    const wrong = scoreCase(nil, { mode: "ecfr-section", citation_id: "ecfr:34-685.203" });
    expect([wrong.correct, wrong.false_confident_citation]).toEqual([false, true]);
  });
  test("needs-label questions are recorded but not scored", () => expect(scoreCase({ id: "T4", expect: "needs-label", accept: [] }, { mode: "no-confident-cite" }).scored).toBe(false));
});

describe("summarize", () => {
  test("reports x of n and MRR", () => {
    const rows = [
      { expect: "answer", scored: true, top1: true, top_k: true, reciprocal_rank: 1, confident: true, answer_correct: true, irrelevant_top_result: false, miss: null, wrong_award_year: false },
      { expect: "answer", scored: true, top1: false, top_k: false, reciprocal_rank: 0, confident: false, answer_correct: null, irrelevant_top_result: true, miss: "not in library", wrong_award_year: false },
      { expect: "not-in-library", correct: true, false_confident_citation: false, wrong_award_year: false },
    ];
    const s = summarize(rows);
    expect(s.answerable.top1).toBe("1 of 2");
    expect(s.answerable.top5).toBe("1 of 2");
    expect(s.answerable.mrr).toBe(0.5);
    expect(s.answerable.confident_answer_correct).toBe("1 of 1");
    expect(s.answerable.misses).toEqual({ "not in library": 1 });
    expect(s.not_in_library.correctly_no_confident_answer).toBe("1 of 1");
  });
});
