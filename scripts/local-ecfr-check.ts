// Usage: bun scripts/local-ecfr-check.ts [out.json]   (run from the repo root)
// Local before/after check for regulation routing (no handbook: LOVABLE_API_KEY is unset here).
// Runs the real lookup() for every reviewed label whose accepted sources include an eCFR section.
import { readFileSync, writeFileSync } from "node:fs";
import { lookup } from "../src/lib/ed-source-desk.server";

delete process.env.LOVABLE_API_KEY;
const out = process.argv[2];
const labels = JSON.parse(readFileSync("tests/evals/retrieval-labels.json", "utf8")).cases
  .filter((c: { status: string; accept: string[] }) => c.status === "reviewed" && c.accept.some((a) => a.startsWith("ecfr:")));
const rows: Record<string, unknown>[] = [];
for (const l of labels) {
  const r = (await lookup({ q: l.question })) as { mode?: string; citation_id?: string; rejected_candidate?: { citation_id?: string; fit?: number; missing_terms?: string[] } };
  const ecfrAccept = l.accept.filter((a: string) => a.startsWith("ecfr:"));
  const cited = r.mode === "ecfr-section" ? r.citation_id : null;
  rows.push({ id: l.id, split: l.split, accept: ecfrAccept, mode: r.mode, cited, hit: !!cited && ecfrAccept.includes(cited),
    rejected: r.rejected_candidate ? `${r.rejected_candidate.citation_id} fit ${r.rejected_candidate.fit} missing ${r.rejected_candidate.missing_terms?.join(",")}` : null });
  console.log(`${rows.at(-1)!.hit ? "HIT " : "MISS"} ${l.id} ${l.split} mode=${r.mode} cited=${cited ?? "-"}${rows.at(-1)!.rejected ? " rejected=" + rows.at(-1)!.rejected : ""}`);
}
const n = (s?: string) => rows.filter((r) => !s || r.split === s);
console.log(`hits: all ${n().filter((r) => r.hit).length} of ${n().length}; build ${n("build").filter((r) => r.hit).length} of ${n("build").length}; held-out ${n("held-out").filter((r) => r.hit).length} of ${n("held-out").length}`);
if (out) writeFileSync(out, JSON.stringify(rows, null, 2));
