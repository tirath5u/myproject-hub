import { describe, expect, test } from "bun:test";
import { asksPellAmount, chapterOf, coverageText, isPreviewHost, lookNext, sectionKey, textHasFictionalNote } from "../../src/lib/handbook-lookup";

describe("section keys", () => {
  test("same heading in two chapters stays separate", () => {
    const a = sectionKey({ document_version_key: "fsa-handbook:2026-27:vol3:ch1:2026-01-01:aaaaaaaaaaaa", heading: "Introduction" });
    const b = sectionKey({ document_version_key: "fsa-handbook:2026-27:vol7:ch2:2026-08-21:bbbbbbbbbbbb", heading: "Introduction" });
    expect(a).not.toBe(b);
  });
});

describe("chapterOf", () => {
  test("from key, URL, or title", () => {
    expect(chapterOf({ document_version_key: "fsa-handbook:2026-27:vol7:ch2:2026-08-21:abc" })).toEqual({ volume: 7, chapter: 2 });
    expect(chapterOf({ document_version_key: "x", official_url: "https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol3/ch1-academic-calendars" })).toEqual({ volume: 3, chapter: 1 });
    expect(chapterOf({ title: "2026-27 FSA Handbook, Volume 3, Chapter 1" })).toEqual({ volume: 3, chapter: 1 });
    expect(chapterOf({ title: "Something else" })).toBeNull();
  });
});

describe("lookNext", () => {
  const imported = new Map([["3:1", "https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol3/ch1-x"]]);
  test("skips the passage's own chapter and understands 'of this volume'", () => {
    const text = "See Volume 7, Chapter 2 and Chapter 3 of this volume, and Chapter 8 of this volume. Also Volume 7, Chapter 2, Example 1.";
    expect(lookNext(text, "2026-27", { volume: 7, chapter: 2 }).map((l) => l.label)).toEqual(["Volume 7, Chapter 3", "Volume 7, Chapter 8"]);
  });
  test("imported chapters are passages here, not volume index links", () => {
    const out = lookNext("See Chapter 1 of Volume 3 and Volume 1, Chapter 1.", "2026-27", { volume: 7, chapter: 2 }, imported);
    expect(out).toEqual([
      { label: "Volume 3, Chapter 1", url: "https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol3/ch1-x", imported: true },
      { label: "Volume 1, Chapter 1", url: "https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol1", imported: false },
    ]);
  });
  test("Volume 3 Chapter 1 passages still skip themselves", () => {
    expect(lookNext("Volume 3, Chapter 1 and Volume 8.", "2026-27", { volume: 3, chapter: 1 }).map((l) => l.label)).toEqual(["Volume 8"]);
  });
});

describe("fictional amounts", () => {
  test("amount questions vs eligibility questions", () => {
    expect(asksPellAmount("What is the maximum Pell Grant amount for the 2026-27 award year?")).toBe(true);
    expect(asksPellAmount("How much is the minimum Pell Grant?")).toBe(true);
    expect(asksPellAmount("Does a low Student Aid Index by itself establish eligibility for the maximum Pell Grant?")).toBe(false);
    expect(asksPellAmount("What is the maximum Direct Loan amount?")).toBe(false);
  });
  test("note detection", () => {
    expect(textHasFictionalNote("Examples use a fictional maximum ($9,999) and minimum ($999).")).toBe(true);
    expect(textHasFictionalNote("The maximum award is published annually.")).toBe(false);
  });
});

describe("coverage and preview hosts", () => {
  test("coverage lists the chapters searched", () => {
    expect(coverageText("2026-27", [
      { chapter: { volume: 7, chapter: 2 }, staged: true }, { chapter: { volume: 3, chapter: 1 }, staged: false }, { chapter: null, staged: false },
    ])).toBe("2026-27 FSA Handbook Vol 3 Ch 1, Vol 7 Ch 2 (staged, preview only); prior award years are stored but excluded");
    expect(coverageText("2026-27", [])).toBe("none for 2026-27 yet");
  });
  test("staged rows only on preview hosts", () => {
    expect(isPreviewHost("id-preview--0f1e2d3c.lovable.app")).toBe(true);
    expect(isPreviewHost("preview--myproject.lovable.app")).toBe(true);
    expect(isPreviewHost("0f1e2d3c.lovableproject.com")).toBe(true);
    expect(isPreviewHost("localhost")).toBe(true);
    expect(isPreviewHost("myproduct.life")).toBe(false);
    expect(isPreviewHost("myproject.lovable.app")).toBe(false);
    expect(isPreviewHost("preview--x.lovable.app.evil.com")).toBe(false);
  });
});

describe("word-assisted answers", () => {
  test("are labelled partial; meaning-only answers are not", async () => {
    const { wordAssistedNote } = await import("../../src/lib/handbook-lookup");
    expect(wordAssistedNote(["meaning", "words"])).toMatch(/partial answer/);
    expect(wordAssistedNote(["meaning"])).toBeNull();
  });
});

describe("includeStagedFor", () => {
  test("development builds include staged rows on any address; production only on known preview hosts", async () => {
    const { includeStagedFor } = await import("../../src/lib/handbook-lookup");
    expect(includeStagedFor("development", "some-new-preview-address.example.dev")).toBe(true);
    expect(includeStagedFor("production", "myproduct.life")).toBe(false);
    expect(includeStagedFor("production", "myproject.lovable.app")).toBe(false);
    expect(includeStagedFor("production", "id-preview--0f1e2d3c.lovable.app")).toBe(true);
    expect(includeStagedFor(undefined, "myproduct.life")).toBe(false);
  });
});
