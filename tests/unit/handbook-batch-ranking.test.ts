// Replays the Volume 7 batch failures (preview 2026-09-30) with the real chapter titles and section headings.
import { describe, expect, test } from "bun:test";
import { handbookFit, stemHit } from "../../src/lib/ed-source-desk.server";
import { chapterTitleWords, isTopicTerm, numberedVariants, offProgram, programsIn } from "../../src/lib/handbook-lookup";

const base = "https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol7/";
const VOL7_TITLES = [
  "ch1-student-eligibility-pell-grants", "ch2-calculating-pell-grants", "ch3-pell-grant-enrollment-intensity-and-cost-attendance",
  "ch4-calculating-annual-awards-using-pell-grant-formulas", "ch5-summer-terms-crossover-payment-periods-and-year-round-pell",
  "ch6-transfer-students-and-remaining-eligibility",
].map((s) => chapterTitleWords(base + s));
const volTopic = (t: string) => isTopicTerm(t, VOL7_TITLES, stemHit, 3);

describe("volume topic words", () => {
  test("Pell and Grant name most Volume 7 chapters; eligibility and formula do not", () => {
    expect(VOL7_TITLES[0]).toBe("student eligibility pell grants");
    expect(volTopic("pell")).toBe(true);
    expect(volTopic("grant")).toBe(true);
    expect(volTopic("eligibility")).toBe(false);
    expect(volTopic("formula")).toBe(false);
    expect(isTopicTerm("pell", VOL7_TITLES.slice(0, 2), stemHit, 3)).toBe(false); // needs 3+ chapters
  });

  test("U08: the servicemembers section no longer outranks Maximum Pell Grant Eligibility Criteria", () => {
    const q = "Does a low Student Aid Index by itself establish eligibility for the maximum Pell Grant?";
    const svc = handbookFit(q, "Maximum Pell Grant Eligibility for Children of Certain Deceased Servicemembers and Public Safety Officers", "", volTopic);
    const crit = handbookFit(q, "Maximum Pell Grant Eligibility Criteria", "", volTopic);
    expect(svc.headingHits).toBe(1);
    expect(crit.headingHits).toBe(1);
    expect(crit.headingPrecision).toBeGreaterThan(svc.headingPrecision);
  });

  test("U09: Chapter 1's general eligibility heading no longer gets two heading hits", () => {
    const q = "What inputs determine a student's scheduled full-time Pell Grant award?";
    expect(handbookFit(q, "General Eligibility Requirements for Federal Pell Grants", "", volTopic).headingHits).toBe(0);
    expect(handbookFit(q, "Scheduled Award, Award Year, and Annual Award", "", volTopic).headingHits).toBe(1);
  });
});

describe("numbered variants", () => {
  test("U21: a Formula 1 section misses Formulas 2-4", () => {
    const q = "How does a school select Pell Formula 1, 2, 3, or 4 for a program?";
    expect(numberedVariants(q).map((v) => v.label)).toEqual(["Formula 1", "Formula 2", "Formula 3", "Formula 4"]);
    const f = handbookFit(q, "Pell Formula 1", "Pell Formula 1 is used for programs with standard terms.", volTopic);
    expect(f.missing).toEqual(expect.arrayContaining(["Formula 2", "Formula 3", "Formula 4"]));
    const all = handbookFit(q, "Basic Pell Grant Formulas", "Schools select Formula 1, Formula 2, Formula 3 or Formula 4 by program.", volTopic);
    expect(all.missing).not.toContain("Formula 2");
  });
  test("BBAY lists behave as before", () => {
    expect(numberedVariants("Explain when a school uses a Scheduled Academic Year, BBAY 1, BBAY 2, or BBAY 3.").map((v) => v.label)).toEqual(["BBAY 1", "BBAY 2", "BBAY 3"]);
  });
});

describe("programs", () => {
  test("U25: a Direct Loan question excludes a Pell volume; general volumes stay", () => {
    const q = programsIn("When a school reports a Direct Loan disbursement, which amounts use dollars and cents versus whole dollars?");
    expect([...q]).toEqual(["direct-loan"]);
    expect(offProgram(q, new Set(["pell"]))).toBe(true);
    expect(offProgram(q, new Set())).toBe(false);
    expect(offProgram(programsIn("maximum Pell Grant"), new Set(["pell"]))).toBe(false);
    expect(offProgram(new Set(), new Set(["pell"]))).toBe(false);
  });
});

describe("second preview run fixes", () => {
  test("U21: list and range wording covers each named formula", async () => {
    const { numberedMentions } = await import("../../src/lib/handbook-lookup");
    expect([...numberedMentions("Schools use Pell Formulas 1, 2, 3, and 4 for term programs.", "Formula")]).toEqual(["1", "2", "3", "4"]);
    expect([...numberedMentions("Formula 1 through 4 apply; Formula 5 is for correspondence.", "Formula")].sort()).toEqual(["1", "2", "3", "4", "5"]);
    expect([...numberedMentions("Formulas 5A and 5B", "Formula")]).toEqual(["5A", "5B"]);
    const q = "How does a school select Pell Formula 1, 2, 3, or 4 for a program?";
    const basic = handbookFit(q, "Basic Pell Grant Formulas", "A school selects among Pell Formulas 1 through 4 based on its academic calendar for the program.", volTopic);
    expect(basic.missing.filter((m) => m.startsWith("Formula"))).toEqual([]);
    expect(handbookFit(q, "Pell Formula 1", "Formula 1 applies to standard terms.", volTopic).missing).toEqual(expect.arrayContaining(["Formula 2", "Formula 3", "Formula 4"]));
  });

  test("U10: the eligible answer covering every term beats a higher-ranked one missing terms", async () => {
    const { orderAnswers } = await import("../../src/lib/ed-source-desk.server");
    const corr = { heading: "Pell Enrollment Intensity for Correspondence Study Programs", missing_terms: ["payment-period", "affected", "differs"] };
    const pay = { heading: "Pell Grant Payments by Payment Period", missing_terms: [] as string[] };
    expect(orderAnswers([corr, pay])[0]).toBe(pay);
    const a = { heading: "A", missing_terms: [] as string[] }, b = { heading: "B", missing_terms: [] as string[] };
    expect(orderAnswers([a, b])).toEqual([a, b]); // ties keep rank order
  });

  test("U21: 'Formula' stays a heading hit for Chapter 2 even though it names most Chapter 4 headings", () => {
    const q = "How does a school select Pell Formula 1, 2, 3, or 4 for a program?";
    // Chapter 2's own headings: "formula" is in 1 of 10, so not a chapter topic there.
    expect(handbookFit(q, "Basic Pell Grant Formulas", "", volTopic).headingHits).toBe(1);
  });

  test("U21: 'Basic Pell Grant Formulas' keeps its fit without naming Formula 1-4, but is not complete", () => {
    const q = "How does a school select Pell Formula 1, 2, 3, or 4 for a program?";
    // Wording of the stored section (preview 2026-10-01): it explains choosing a formula, never names Formula 1-4.
    const text = "When calculating Pell Grants, you must generally use the same formula for all years in a student's program. In most cases, a program's academic calendar determines the formula that must be used. However, for programs offered in standard terms a school has the option of choosing between different Pell formulas. A school may change from the originally selected formula to a different allowable formula.";
    const f = handbookFit(q, "Basic Pell Grant Formulas", text, volTopic);
    expect(f.score).toBeGreaterThanOrEqual(0.8);
    expect(f.missing).toEqual(expect.arrayContaining(["Formula 1", "Formula 2", "Formula 3", "Formula 4"]));
    expect(f.headingHits).toBe(1);
  });
  test("BBAY variants still count toward fit", () => {
    const q = "Explain when a school uses a Scheduled Academic Year, BBAY 1, BBAY 2, or BBAY 3.";
    const without = handbookFit(q, "Scheduled Academic Year", "A scheduled academic year is used by schools.", volTopic);
    const withAll = handbookFit(q, "Scheduled Academic Year", "A scheduled academic year, BBAY 1, BBAY 2 and BBAY 3 are used by schools.", volTopic);
    expect(withAll.score).toBeGreaterThan(without.score);
  });
});
