# Ask Regs evaluation runner

A dependency-free Node.js runner that posts questions to an Ask Regs lookup endpoint and checks each response against a reviewed routing or refusal expectation. It checks routing, citations, labels, and refusals. It does **not** grade whether an answer is correct or complete.

## Run

```sh
npm run eval:live                                   # published site, Stage 1 suite
node tests/evals/run-live-evals.mjs --endpoint <url>/api/ed-source-desk/lookup
node tests/evals/run-live-evals.mjs --cases tests/evals/<suite>.json --pause-ms 1500
# Stage 2A on preview (staged rows are shown only on preview hosts):
node tests/evals/run-live-evals.mjs --endpoint <preview>/api/ed-source-desk/lookup --cases tests/evals/stage2a-pell-cases.json
node tests/evals/run-live-evals.mjs --endpoint <preview>/api/ed-source-desk/lookup --expected-changes tests/evals/stage2a-pell-cases.json
bun tests/evals/validate-fixtures.mjs               # offline fixture check (CI)
# Retrieval only (plan 3.3): no AI, no token. Scores what was shown and where the search ranked it.
node tests/evals/run-retrieval-eval.mjs                          # all labeled questions, published site
node tests/evals/run-retrieval-eval.mjs --split held-out --reviewed-only   # the numbers you may publish
node tests/evals/run-retrieval-eval.mjs --ids R-U21,R-U30        # a few questions
# Model comparison (owner-only; writes <run>.json and a <run>.grading.csv for your own 1-5 grades):
ED_SOURCE_DESK_ADMIN_TOKEN=... node tests/evals/run-model-compare.mjs --endpoint <preview>/api/ed-source-desk/admin/compare
node tests/evals/run-model-compare.mjs --agreement tests/evals/runs/<run>.grading.csv   # your grades vs the judge's
```

Each run writes `<run>.json` (summary + every assertion), `<run>.csv` (one row per case: pass, latency, embedding tokens or "unavailable") and `<run>.assertions.csv` (one row per assertion). `--expected-changes` reads a suite's `stage1_expected_changes` and reports those cases as `EXPECTED-CHANGE` instead of regressions.

- Cases run one at a time with a pause (default 750 ms) so eCFR, the Federal Register, and Regulations.gov are never burst.
- The runner never runs automatically in CI. Pull-request checks validate fixtures and pure logic only.
- Output goes to `tests/evals/runs/`, which is git-ignored because it holds full source responses. Share results as a summary, never as committed raw archives.

## Suites

| File | Status | What it covers |
|---|---|---|
| `stage1-routing-cases.json` | Reviewed, Stage 1 release evidence | 18 public routing and refusal checks. First independent live run 2026-09-30: 18 of 18. Not an answer-accuracy score. |

| `stage2a-pell-cases.json` | Reviewed by Tirath 2026-09-30 | Volume 7, Chapter 2 passage roles (U09, U08, U26, U10, U21) and the fictional-amount guard (NEG), checked by hand on the preview. U09 intentionally changes from Stage 1's definition-only expectation; U10 accepts a partial answer. Live 2026-09-30 after both promotes: 6 of 6 (58 of 58 checks). Run on a preview or, after promote, on the live site. |
| `stage2b-pell-ch3-cases.json` | Reviewed by Tirath 2026-09-30 | Volume 7, Chapter 3 presence (U10-B) and a minimum-amount guard (NEG-B). Live after promote: 2 of 2 (18 of 18 checks). Its `expected_changes` lets the Stage 2A suite record U10 changing as expected. |
| `adversarial-cases.json` | **candidate-unreviewed** (probes) | Red-team probes for the public lookup: rephrased student-specific questions, injection attempts, private content, vendor setup, tax advice, pressure to state fictional amounts. A failure is a finding to fix, not a test to loosen. First local check: 5 of 7 refusal probes got through; fixed in the same PR. |
| `retrieval-labels.json` | **candidate-unreviewed** (21 starter labels) | Labeled questions for the retrieval scorecard (plan 3.1 to 3.4). Each names the sources that answer it (`ecfr:34-668.22`, `hb:<heading>` or `hb:<document>|<heading>`), whether that source is in the library, and its split. Nine build labels come from the reviewed suites above (all already used in tuning); twelve held-out questions from `model-compare-questions.json` are `needs-label`. Only Tirath marks a label reviewed. `run-retrieval-eval.mjs` reports top-1, top-5, MRR, wrong-award-year count, irrelevant top result, and each miss as not in library, retrieved but not shown, or outside the top 12 candidates. |
| `model-compare-questions.json` | **candidate-unreviewed** | 12 held-out questions plus 3 probes for comparing explanation models with `run-model-compare.mjs` (owner token required). Never used to tune retrieval. |

## Rules

- No student records, private client or employer material, or API keys in any fixture.
- Keep locked held-out questions out of this repository. They live privately and are run only on finished builds.
- HTTP 200 is never counted as passage correctness.

Moved from `D:/career/projects/ed-source-desk-evals` on 2026-09-30.
