// Reproduce PORTFOLIO-PLAN.md item 1.1 from the committed grading CSV.
// Usage: node tests/evals/judge-calibration.mjs
// No packages, network calls, model calls, or regrading.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(here, "../../docs/ed-source-desk/model-compare-grading.csv");
const measures = ["faithfulness", "completeness", "clarity"];
const scores = [1, 2, 3, 4, 5];

function parseCsv(input) {
  const records = [];
  let record = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { record.push(field); field = ""; }
    else if (ch === "\n") { record.push(field); records.push(record); record = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (quoted) throw new Error("Unclosed quoted CSV field");
  if (field || record.length) { record.push(field); records.push(record); }
  const [header, ...body] = records;
  return body.filter((r) => r.length > 1).map((r) => {
    if (r.length !== header.length) throw new Error(`Expected ${header.length} CSV fields, found ${r.length}`);
    return Object.fromEntries(header.map((name, i) => [name, r[i]]));
  });
}

function kappa(pairs, power) {
  const n = pairs.length;
  const judge = new Map(scores.map((score) => [score, pairs.filter(([j]) => j === score).length]));
  const owner = new Map(scores.map((score) => [score, pairs.filter(([, h]) => h === score).length]));
  const weight = (j, h) => (Math.abs(j - h) / 4) ** power;
  const observed = pairs.reduce((sum, [j, h]) => sum + weight(j, h), 0) / n;
  const expected = scores.reduce((sum, j) =>
    sum + scores.reduce((subtotal, h) => subtotal + weight(j, h) * judge.get(j) * owner.get(h), 0), 0) / (n * n);
  return expected === 0 ? null : 1 - observed / expected;
}

const rows = parseCsv(fs.readFileSync(source, "utf8").replace(/^\uFEFF/, ""));
const result = { source: path.relative(path.resolve(here, "../.."), source).replaceAll("\\", "/"), rows: rows.length, measures: {} };
for (const measure of measures) {
  const pairs = rows.flatMap((r) => {
    const judge = r[`judge_${measure}`]?.trim();
    const owner = r[`your_${measure}`]?.trim();
    if (!judge || !owner) return [];
    const j = Number(judge), h = Number(owner);
    if (!scores.includes(j) || !scores.includes(h)) throw new Error(`Invalid ${measure} score for ${r.id} / ${r.model}`);
    return [[j, h]];
  });
  const n = pairs.length;
  const exact = pairs.filter(([j, h]) => j === h).length;
  const withinOne = pairs.filter(([j, h]) => Math.abs(j - h) <= 1).length;
  result.measures[measure] = {
    scored_pairs: n,
    missing_owner_pairs: rows.length - n,
    exact,
    within_one: withinOne,
    exact_pct: Number((100 * exact / n).toFixed(1)),
    within_one_pct: Number((100 * withinOne / n).toFixed(1)),
    linear_weighted_kappa: Number(kappa(pairs, 1).toFixed(4)),
    quadratic_weighted_kappa: Number(kappa(pairs, 2).toFixed(4)),
    mean_judge_minus_owner: Number((pairs.reduce((sum, [j, h]) => sum + j - h, 0) / n).toFixed(3)),
    judge_score_counts: Object.fromEntries(scores.map((score) => [score, pairs.filter(([j]) => j === score).length])),
    owner_score_counts: Object.fromEntries(scores.map((score) => [score, pairs.filter(([, h]) => h === score).length])),
  };
}
console.log(JSON.stringify(result, null, 2));
