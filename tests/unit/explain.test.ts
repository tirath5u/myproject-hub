import { describe, expect, test } from "bun:test";
import { checkExplanation, explainMessages, explainSources } from "../../src/lib/explain";

const lookup = {
  mode: "handbook-passage", citation_id: "fsa-hb:a#2", title: "FSA Handbook — Scheduled Award", text: "Scheduled award text with $1,234.",
  handbook_passages: [
    { citation_id: "fsa-hb:a#2", heading: "Scheduled Award", passage: "Scheduled award text with $1,234.", role: "answer" },
    { citation_id: "fsa-hb:a#7", heading: "Example 1", passage: "Example with $7,500.", role: "related", fictional_amounts: true },
  ],
  definitions: [{ citation_id: "ecfr:34-690.2", term: "scheduled federal pell grant", text: "Scheduled Federal Pell Grant: ..." }],
};

describe("explainSources", () => {
  test("answer first, deduplicated, definitions last", () => {
    const s = explainSources(lookup, false);
    expect(s.map((x) => [x.id, x.citation_id, x.kind, x.fictional])).toEqual([
      ["S1", "fsa-hb:a#2", "answer", false], ["S2", "fsa-hb:a#7", "related", true], ["S3", "ecfr:34-690.2", "definition", false],
    ]);
  });
  test("amount questions drop fictional-amount passages; refusals have no sources", () => {
    expect(explainSources(lookup, true).map((x) => x.citation_id)).toEqual(["fsa-hb:a#2", "ecfr:34-690.2"]);
    expect(explainSources({ ...lookup, refuse: true }, false)).toEqual([]);
  });
  test("no-citation results only use related passages and definitions", () => {
    const s = explainSources({ ...lookup, mode: "no-confident-cite", citation_id: undefined, text: null }, false);
    expect(s.map((x) => x.kind)).toEqual(["related", "related", "definition"]);
  });
});

describe("explainMessages", () => {
  test("lists every source with its id and marks fictional ones", () => {
    const [sys, user] = explainMessages("Q?", explainSources(lookup, false), ["gap note"]);
    expect(sys.content).toContain("Use ONLY the numbered sources");
    expect(user.content).toContain("[S1] FSA Handbook — Scheduled Award (answer)");
    expect(user.content).toContain("[S2] Example 1 (related, FICTIONAL example amounts)");
    expect(user.content).toContain("Known gaps from the lookup: gap note");
  });
});

describe("checkExplanation", () => {
  const sources = explainSources(lookup, false);
  test("accepts cited bullets and a Not covered line", () => {
    const r = checkExplanation("- The award depends on the schedule [S1]\n- Definition applies [S3]\nNot covered: payment periods.", sources);
    expect(r).toEqual({ ok: true, problems: [], cited_sources: ["S1", "S3"] });
  });
  test("rejects unknown sources, uncited lines, and amounts only in fictional examples", () => {
    const r = checkExplanation("- The maximum is $7,500 [S2]\n- Something else\n- See [S9]", sources);
    expect(r.ok).toBe(false);
    expect(r.problems).toEqual(["cites unknown source S9", '1 line(s) without a source (first: "Something else")', "amount $7,500 is not in a non-fictional source"]);
  });
  test("accepts amounts that a real source states", () => {
    expect(checkExplanation("- It is $1,234 [S1]", sources).ok).toBe(true);
  });
  test("rejects a reply with no citations at all", () => {
    expect(checkExplanation("Not covered: everything.", sources).problems).toEqual(["no source cited"]);
  });
});

describe("checkExplanation formatting tolerance", () => {
  const sources = explainSources(lookup, false);
  test("allows a short intro line and a bold or bulleted Not covered line", () => {
    const r = checkExplanation("Here is how it works:\n- The award depends on the schedule [S1]\n- **Not covered:** payment periods.", sources);
    expect(r.ok).toBe(true);
  });
  test("names the first uncited line", () => {
    expect(checkExplanation("- A fact with no source\n- Cited [S1]", sources).problems).toEqual(['1 line(s) without a source (first: "A fact with no source")']);
  });
});
