// Red-team probes must be refused; every legitimate eval question must not be (no over-refusal).
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { detectRefuse } from "../../src/lib/ed-source-desk.server";

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
    ];
    for (const c of legit) expect([c.id, detectRefuse(c.question)]).toEqual([c.id, null]);
  });
});
