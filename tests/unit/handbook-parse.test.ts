// Parser tests use a small synthetic page in the FSA Handbook markup (tests/fixtures/handbook-synthetic.html).
// The fixture's wording is invented; no handbook text is stored in this repository.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  chapterContentHash, checkChapter, citationRef, documentVersionKey, parseChapter, textFragmentUrl, type ExpectedChecks,
} from "../../src/lib/handbook-parse";
import { HANDBOOK_SOURCES } from "../../src/data/ed-source-desk/handbook-sources";

const html = readFileSync(join(import.meta.dir, "../fixtures/handbook-synthetic.html"), "utf8");
const p = parseChapter(html);

const SYNTHETIC_EXPECTED: ExpectedChecks = {
  sections: 5,
  tables: 2,
  table_rows_by_section: { "Maximum Widget Criteria": 5 },
  examples: 2,
  fictional_note: true,
  step_labels: ["Step 1", "Step 2"],
};

describe("parseChapter (synthetic page)", () => {
  test("reads only the chapter body and splits at h2/h3", () => {
    expect(p.stats.headings).toEqual([
      "Introduction", "Scheduled Widget Award", "Maximum Widget Criteria", "Calculated Widget Grant (Based on Index and Cost)", "Widget Formulas",
    ]);
    const all = p.chunks.map((c) => c.text).join("\n");
    expect(all).not.toContain("Chrome Heading");
    expect(all).not.toContain("Footer text");
    expect(all).not.toContain("Table of contents");
    expect(all).not.toContain("field--name-field-chapter-content"); // script content skipped
  });

  test("dates: last modified vs FSA page first published are kept apart", () => {
    expect(p.last_modified).toBe("2026-08-21");
    expect(p.page_published).toBe("2023-08-25");
  });

  test("introduction is the text before the first header", () => {
    expect(p.chunks[0].heading).toBe("Introduction");
    expect(p.chunks[0].text.startsWith("Introduction\nThis chapter explains")).toBe(true);
  });

  test("h4 stays inline as a sub-heading line in its h3 section", () => {
    const c = p.chunks.find((x) => x.heading === "Maximum Widget Criteria")!;
    expect(c.text.split("\n")).toContain("Dependent Widget Owner");
    expect(c.text.split("\n")).toContain("Independent Widget Owner");
    expect(p.stats.h4_subheadings).toBe(2);
  });

  test("tables: body rows counted per section, rendered row by row", () => {
    expect(p.stats.tables).toBe(2);
    expect(p.stats.table_rows_by_section).toEqual({ "Maximum Widget Criteria": [3, 2] });
    const c = p.chunks.find((x) => x.heading === "Maximum Widget Criteria")!;
    expect(c.text).toContain("Income & limits | No");
  });

  test("lists flatten nested field divs to one line per item", () => {
    const c = p.chunks.find((x) => x.heading === "Scheduled Widget Award")!;
    expect(c.text).toContain("\n- the widget index;\n- the cost of widgets; and\n  - a nested detail line\n- full-time enrollment.");
  });

  test("margin notes use the Volume 3 format", () => {
    const c = p.chunks.find((x) => x.heading === "Maximum Widget Criteria")!;
    expect(c.text).toContain("Margin note: Maximum widget eligibility\nSynthetic Act Sec. 9(z)(1)");
    expect(p.stats.margin_notes).toBe(1);
  });

  test("Step labels stay on one line with their text", () => {
    const c = p.chunks.find((x) => x.heading.startsWith("Calculated") && x.piece === 0)!;
    expect(c.text).toContain("\nStep 1: Subtract the index from the maximum.");
    expect(c.text).toContain("\nStep 2: Compare the result with the cost of widgets.");
    expect(p.stats.step_labels).toEqual(["Step 1", "Step 2"]);
  });

  test("each example is its own chunk; rule text around it stays with the section", () => {
    const calc = p.chunks.filter((c) => c.section_heading.startsWith("Calculated"));
    expect(calc.map((c) => [c.heading.replace(/^Calculated.*/, "RULE"), c.is_example])).toEqual([
      ["RULE", false],
      ["Volume 9, Chapter 4, Example 1: Low Index Owner", true],
      ["RULE", false],
      ["Volume 9, Chapter 4, Example 2: Minimum Award", true],
      ["RULE", false],
    ]);
    const ex = calc[1];
    expect(ex.text.startsWith("Volume 9, Chapter 4, Example 1: Low Index Owner\n")).toBe(true);
    expect(/\bExample \d+/.test(ex.heading)).toBe(true);
    // Continuation pieces don't repeat the heading.
    expect(calc[2].text.startsWith("After the steps")).toBe(true);
    expect(p.stats.examples).toEqual([1, 2]);
  });

  test("fictional amounts: examples, the note's section, and chunks quoting a noted amount; never prefixed into text", () => {
    const flags = Object.fromEntries(p.chunks.map((c) => [`${c.ordinal}:${c.heading.slice(0, 20)}`, c.fictional_amounts]));
    expect(flags).toEqual({
      "1:Introduction": false,
      "2:Scheduled Widget Awa": true,
      "3:Maximum Widget Crite": false,
      "4:Calculated Widget Gr": false,
      "5:Volume 9, Chapter 4,": true,
      "6:Calculated Widget Gr": false,
      "7:Volume 9, Chapter 4,": true,
      "8:Calculated Widget Gr": false,
      "9:Widget Formulas": false,
    });
    expect(p.stats.fictional_note).toBe(true);
    expect(p.stats.fictional_amounts).toEqual(["$9,999", "$999"]);
    for (const c of p.chunks) expect(c.text.startsWith("Fictional")).toBe(false);
    for (const c of p.chunks.filter((x) => /\$9,999|\$999\b/.test(x.text))) expect(c.fictional_amounts).toBe(true);
  });

  test("ordinals are sequential from 1", () => {
    expect(p.chunks.map((c) => c.ordinal)).toEqual(p.chunks.map((_, i) => i + 1));
  });
});

describe("checkChapter", () => {
  test("passes when every expected check matches", () => {
    expect(checkChapter(p, SYNTHETIC_EXPECTED)).toEqual({ pass: true, failures: [] });
  });

  test("refuses on any mismatch and names it", () => {
    const r = checkChapter(p, { ...SYNTHETIC_EXPECTED, sections: 10, examples: 3, table_rows_by_section: { "Maximum Widget Criteria": 8, Missing: 7 }, step_labels: ["Step 1", "Step 4"] });
    expect(r.pass).toBe(false);
    expect(r.failures).toEqual([
      "sections: expected 10, got 5",
      'table rows in "Maximum Widget Criteria": expected 8, got 5',
      'table rows in "Missing": expected 7, got no table',
      "examples: expected 1,2,3, got 1,2",
      'missing label "Step 4"',
    ]);
  });

  test("the real registry entry fails on the synthetic page (so a wrong page can't be imported)", () => {
    expect(checkChapter(p, HANDBOOK_SOURCES[0].expected).pass).toBe(false);
  });

  test("a page without the chapter body is rejected", () => {
    expect(() => parseChapter("<html><body><p>nothing</p></body></html>")).toThrow(/chapter content/);
  });
});

describe("keys and locators", () => {
  test("document_version_key matches the existing format", async () => {
    const hash = await chapterContentHash(p);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(documentVersionKey("2026-27", 7, 2, "2026-08-21", hash)).toBe(`fsa-handbook:2026-27:vol7:ch2:2026-08-21:${hash.slice(0, 12)}`);
    expect(await chapterContentHash(parseChapter(html))).toBe(hash); // deterministic
  });

  test("text fragments encode commas and hyphens", () => {
    const u = "https://fsapartners.ed.gov/x/ch2-calculating-pell-grants";
    expect(textFragmentUrl(u, "Scheduled Award, Award Year, and Annual Award")).toBe(`${u}#:~:text=Scheduled%20Award%2C%20Award%20Year%2C%20and%20Annual%20Award`);
    expect(textFragmentUrl(u, "Full-Time (SAI)")).toBe(`${u}#:~:text=Full%2DTime%20%28SAI%29`);
    expect(citationRef("FSA Handbook 2026-27, Vol 7, Ch 2: Intro", u, "Introduction")).toBe(`FSA Handbook 2026-27, Vol 7, Ch 2: Intro — ${u}#:~:text=Introduction`);
  });
});

describe("registry", () => {
  test("Vol 7 Ch 2 carries the reviewed expected checks", () => {
    const s = HANDBOOK_SOURCES.find((x) => x.id === "fsa-hb-2026-27-vol7-ch2")!;
    expect(s.expected).toEqual({
      sections: 10, tables: 4,
      table_rows_by_section: { "Maximum Pell Grant Eligibility Criteria": 8, "Minimum Pell Grant Eligibility Criteria": 7 },
      examples: 3, fictional_note: true, step_labels: ["Step 1", "Step 2", "Step 3", "Step 4"],
    });
    expect(s.award_year).toBe("2026-27");
  });
});

describe("Stage 2B helpers", () => {
  test("findLink finds the next chapter from a chapter page's links", async () => {
    const { findLink } = await import("../../src/lib/handbook-parse");
    const page = `<nav><a href="/knowledge-center/fsa-handbook/2026-2027/vol7/ch2-calculating-pell-grants">Ch 2</a>
      <a href="/knowledge-center/fsa-handbook/2026-2027/vol7/ch3-some-title#top">Next</a></nav>`;
    const base = "https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol7/ch2-calculating-pell-grants";
    const src = HANDBOOK_SOURCES.find((s) => s.id === "fsa-hb-2026-27-vol7-ch3")!;
    expect(findLink(page, base, src.discover!.path_pattern)).toBe("https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol7/ch3-some-title");
    expect(findLink("<a href='/other'>x</a>", base, src.discover!.path_pattern)).toBeNull();
  });

  test("minimal checks: structure only, and the Ch 3 source requires a confirmed hash", () => {
    const src = HANDBOOK_SOURCES.find((s) => s.id === "fsa-hb-2026-27-vol7-ch3")!;
    expect(src.require_confirmed_hash).toBe(true);
    expect(src.url).toBeNull();
    expect(checkChapter(p, src.expected)).toEqual({ pass: true, failures: [] });
    expect(checkChapter(p, { min_sections: 20, min_chunks: 3 }).failures).toEqual(["sections: expected at least 20, got 5"]);
  });
});

describe("Volume 7 batch sources", () => {
  test("each chapter's pattern matches only its own chapter, and source: references exist", () => {
    for (const ch of [1, 4, 5, 6]) {
      const src = HANDBOOK_SOURCES.find((s) => s.id === `fsa-hb-2026-27-vol7-ch${ch}`)!;
      expect(src.require_confirmed_hash).toBe(true);
      expect(src.discover!.path_pattern.test(`/knowledge-center/fsa-handbook/2026-2027/vol7/ch${ch}-some-title`)).toBe(true);
      expect(src.discover!.path_pattern.test(`/knowledge-center/fsa-handbook/2026-2027/vol7/ch${ch + 1}-some-title`)).toBe(false);
      for (const f of [src.discover!.from].flat().filter((x) => x.startsWith("source:")))
        expect(HANDBOOK_SOURCES.some((s) => s.id === f.slice(7))).toBe(true);
    }
  });
});
