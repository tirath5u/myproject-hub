// Red-team probes must be refused; every legitimate eval question must not be (no over-refusal).
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COMMENT_REMOVED, detectRefuse, screenComment } from "../../src/lib/ed-source-desk.server";

const load = (f: string) => JSON.parse(readFileSync(join(import.meta.dir, "../evals", f), "utf8")).cases as { id: string; question: string; kind: string; reason?: string; probe?: boolean }[];

describe("refusals", () => {
  test("adversarial probes are refused with the expected reason", () => {
    for (const c of load("adversarial-cases.json").filter((x) => x.kind === "refuse")) expect([c.id, detectRefuse(c.question)]).toEqual([c.id, c.reason!]);
  });
  test("Stage 1 refusal cases still refuse with the same reason", () => {
    for (const c of load("stage1-routing-cases.json").filter((x) => x.kind === "refuse")) expect([c.id, detectRefuse(c.question)]).toEqual([c.id, c.reason!]);
  });
  test("no legitimate question is refused", () => {
    const legit = [
      ...load("stage1-routing-cases.json").filter((x) => x.kind !== "refuse"),
      ...load("stage2a-pell-cases.json"), ...load("stage2b-pell-ch3-cases.json"),
      ...load("model-compare-questions.json").filter((x) => !x.probe),
      { id: "x1", question: "What does our student aid office need to verify an ISIR?", kind: "" },
      { id: "x2", question: "How should schools set up a Pell disbursement schedule for my students?", kind: "" },
      { id: "x3", question: "How is a student's SAI calculated?", kind: "" },
      { id: "x4", question: "What does this ISIR comment code mean?", kind: "" },
      { id: "x5", question: "How do schools review an ISIR for conflicting information?", kind: "" },
      { id: "x6", question: "Does the ISIR include a social security number match flag?", kind: "" },
      { id: "x7", question: "What happens when the SSN match with SSA fails?", kind: "" },
      { id: "x8", question: "Will independent students qualify for the maximum Pell Grant?", kind: "" },
      { id: "x9", question: "Will part time students get less Pell?", kind: "" },
      { id: "x10", question: "Can transfer students receive Pell in the same award year?", kind: "" },
      { id: "x11", question: "What is the Student Aid Index?", kind: "" },
      { id: "x12", question: "Is Student Aid Index used for Pell eligible amounts?", kind: "" },
      { id: "x13", question: "Does Federal Register document 2025-12345 change Pell?", kind: "" },
      { id: "x14", question: "What should schools do with the following ISIR comment codes?", kind: "" },
      { id: "x15", question: "Will incarcerated students be eligible for Pell in 2026-27?", kind: "" },
      { id: "x16", question: "Here is my question about Pell lifetime eligibility: how is LEU counted?", kind: "" },
    ];
    for (const c of legit) expect([c.id, detectRefuse(c.question)]).toEqual([c.id, null]);
  });
  test("feedback comments that look like student details are not stored", () => {
    expect(screenComment("Wrong answer for SSN 123-45-6789")).toBe(COMMENT_REMOVED);
    expect(screenComment("Missing the actual proration formula")).toBe("Missing the actual proration formula");
    expect(screenComment("")).toBeNull();
  });
});
