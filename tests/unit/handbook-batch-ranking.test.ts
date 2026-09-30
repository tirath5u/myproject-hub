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
