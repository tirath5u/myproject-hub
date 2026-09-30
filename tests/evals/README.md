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
```

Each run writes `<run>.json` (summary + every assertion), `<run>.csv` (one row per case: pass, latency, embedding tokens or "unavailable") and `<run>.assertions.csv` (one row per assertion). `--expected-changes` reads a suite's `stage1_expected_changes` and reports those cases as `EXPECTED-CHANGE` instead of regressions.

- Cases run one at a time with a pause (default 750 ms) so eCFR, the Federal Register, and Regulations.gov are never burst.
- The runner never runs automatically in CI. Pull-request checks validate fixtures and pure logic only.
- Output goes to `tests/evals/runs/`, which is git-ignored because it holds full source responses. Share results as a summary, never as committed raw archives.

## Suites

| File | Status | What it covers |
|---|---|---|
| `stage1-routing-cases.json` | Reviewed, Stage 1 release evidence | 18 public routing and refusal checks. First independent live run 2026-09-30: 18 of 18. Not an answer-accuracy score. |

| `stage2a-pell-cases.json` | Reviewed by Tirath 2026-09-30 | Volume 7, Chapter 2 passage roles (U09, U08, U26, U10, U21) and the fictional-amount guard (NEG), checked by hand on the preview. U09 intentionally changes from Stage 1's definition-only expectation; U10 accepts a partial answer. Last preview run: 6 of 6 (58 of 58 checks). Run on a preview or, after promote, on the live site. |
| `stage2b-pell-ch3-cases.json` | **candidate-unreviewed** | Volume 7, Chapter 3 presence (U10-B) and a minimum-amount guard (NEG-B). Its `expected_changes` lets the Stage 2A suite record U10 becoming a complete answer as expected, via `--expected-changes`. |

## Rules

- No student records, private client or employer material, or API keys in any fixture.
- Keep locked held-out questions out of this repository. They live privately and are run only on finished builds.
- HTTP 200 is never counted as passage correctness.

Moved from `D:/career/projects/ed-source-desk-evals` on 2026-09-30.
