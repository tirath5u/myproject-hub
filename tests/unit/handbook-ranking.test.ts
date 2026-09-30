// Ranking and answer rules that decide U09. Headings are the chapter's section titles; no passage text.
import { describe, expect, test } from "bun:test";
import { answerEligible, handbookFit, stemHit, type AnswerCandidate } from "../../src/lib/ed-source-desk.server";
import { isTopicTerm } from "../../src/lib/handbook-lookup";

const VOL7_CH2_HEADINGS = [
  "Introduction", "Scheduled Award, Award Year, and Annual Award", "Published Maximum and Minimum Pell Grant Award Amounts",
  "Pell Grant Eligibility Criteria", "Maximum Pell Grant Eligibility Criteria", "Minimum Pell Grant Eligibility Criteria",
  "Calculated Pell Grant (Eligibility Based on SAI and COA)", "Determining the Award Year for Crossover Pell Awards",
  "Basic Pell Grant Formulas", "Pell Grant Payments by Payment Period",
];
const U09 = "What inputs determine a student's scheduled full-time Pell Grant award?";
const hit = stemHit;
const topic = (t: string) => isTopicTerm(t, VOL7_CH2_HEADINGS, hit);

describe("topic words", () => {
  test("Pell and Grant are Vol 7 Ch 2 topic words; scheduled is not", () => {
    expect(topic("pell")).toBe(true);
    expect(topic("grant")).toBe(true);
    expect(topic("scheduled")).toBe(false);
    expect(isTopicTerm("pell", VOL7_CH2_HEADINGS.slice(0, 3), hit)).toBe(false); // too few headings to judge
  });

  test("topic words no longer make 'Pell Grant Eligibility Criteria' a two-hit heading", () => {
    const before = handbookFit(U09, "Pell Grant Eligibility Criteria", "");
    const after = handbookFit(U09, "Pell Grant Eligibility Criteria", "", topic);
    expect(before.headingHits).toBe(2);
    expect(after.headingHits).toBe(0);
    expect(after.headingPrecision).toBe(0);
    expect(after.score).toBe(before.score); // fit itself is unchanged
    const scheduled = handbookFit(U09, "Scheduled Award, Award Year, and Annual Award", "", topic);
    expect(scheduled.headingHits).toBe(1);
    expect(scheduled.headingPrecision).toBeGreaterThan(after.headingPrecision);
  });
});

describe("answerEligible", () => {
  const base: AnswerCandidate = { found_by: ["meaning"], meaning_qualified: true, missing_terms: [], heading_hits: 1, is_example: false, contains_named: false, fictional_amounts: false };
  test("meaning-only rule sections may answer", () => expect(answerEligible(U09, base)).toBe(true));
  test("both searches: a complete meaning match whose heading names the subject may answer", () =>
    expect(answerEligible(U09, { ...base, found_by: ["meaning", "words"] })).toBe(true));
  test("both searches stay related when any term is missing, the heading doesn't name the subject, or only the 0.70 route qualified", () => {
    expect(answerEligible(U09, { ...base, found_by: ["meaning", "words"], missing_terms: ["full-time"] })).toBe(false);
    expect(answerEligible(U09, { ...base, found_by: ["meaning", "words"], heading_hits: 0 })).toBe(false);
    expect(answerEligible(U09, { ...base, found_by: ["meaning", "words"], meaning_qualified: false })).toBe(false);
    expect(answerEligible(U09, { ...base, found_by: ["words"], meaning_qualified: false })).toBe(false);
  });
  test("examples found with word search's help never answer, even with example intent", () =>
    expect(answerEligible("Show me an example of a BBAY 3 calculation.", { ...base, found_by: ["meaning", "words"], is_example: true, contains_named: true })).toBe(false));
  test("amount questions: fictional-amount passages and examples never answer", () => {
    const q = "What is the maximum Pell Grant amount for the 2026-27 award year?";
    expect(answerEligible(q, { ...base, fictional_amounts: true })).toBe(false);
    expect(answerEligible(q, base)).toBe(true);
  });
});
