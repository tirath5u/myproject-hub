// Keyword routing and required terms (Phase 4 fix E47: loan-limit wording and law nicknames).
import { describe, expect, test } from "bun:test";
import { distinctiveTerms, route, topicalFit } from "../../src/lib/ed-source-desk.server";

const sectionOf = (q: string) => { const r = route(q) as { mode: string; section?: string }; return r.mode === "ecfr-section" ? r.section : r.mode; };

describe("loan-limit wording routes to 685.203", () => {
  test.each([
    "What are the annual Direct Subsidized Loan limits for a dependent first-year student?",
    "What are the aggregate loan limits for an independent undergraduate student?",
    "What is the annual loan limit for a graduate student?",
    "How does the schedule of reductions work?",
  ])("%s", (q) => expect(sectionOf(q)).toBe("685.203"));
});

describe("other routes unchanged", () => {
  test.each([
    ["When must an institution return unearned funds for an R2T4 calculation?", "668.22"],
    ["Under SAP rules, what is the maximum timeframe for an undergraduate program?", "668.34"],
    ["Can a school make a late disbursement after the student leaves?", "668.164"],
    ["How is a Pell Grant calculated for a part-time student?", "690.62"],
    ["Look up 668.22(i) regarding the order of return.", "668.22"],
  ])("%s", (q, s) => expect(sectionOf(q)).toBe(s));
  test("a question with no keyword still goes to Federal Register search", () =>
    expect(sectionOf("What did ED announce about FAFSA deadlines recently?")).toBe("fr-search"));
});

describe("law nicknames are never required terms", () => {
  test("OBBBA, One Big Beautiful Bill Act and H.R. 1 are dropped; the rule's own words stay", () => {
    for (const q of [
      "Under OBBBA, what are the annual loan limits for graduate students?",
      "Under the One Big Beautiful Bill Act, what are the annual loan limits for graduate students?",
      "Under H.R. 1, what are the annual loan limits for graduate students?",
    ]) {
      const t = distinctiveTerms(q);
      expect(t).toContain("graduate");
      expect(t).toContain("limits");
      for (const w of ["obbba", "big", "beautiful", "bill", "act"]) expect(t).not.toContain(w);
    }
  });
  test("a section with the rule is no longer rejected because it never says OBBBA", () => {
    const text = "The annual loan limits for a graduate or professional student are set out in this section.";
    expect(topicalFit("Under OBBBA, what are the annual loan limits for graduate students?", text).missing).toEqual([]);
  });
  test("an unrelated HR number is not treated as the nickname", () =>
    expect(distinctiveTerms("What does the HR 1098-T form report?")).toContain("form"));
});
