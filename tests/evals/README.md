# Ask Regs evaluation runner

A dependency-free Node.js runner that posts questions to an Ask Regs lookup endpoint and checks each response against a reviewed routing or refusal expectation. It checks routing, citations, labels, and refusals. It does **not** grade whether an answer is correct or complete.

## Run

```sh
npm run eval:live                                   # published site, Stage 1 suite
node tests/evals/run-live-evals.mjs --endpoint <url>/api/ed-source-desk/lookup
node tests/evals/run-live-evals.mjs --cases tests/evals/<suite>.json --pause-ms 1500
```

- Cases run one at a time with a pause (default 750 ms) so eCFR, the Federal Register, and Regulations.gov are never burst.
- The runner never runs automatically in CI. Pull-request checks validate fixtures and pure logic only.
- Output goes to `tests/evals/runs/`, which is git-ignored because it holds full source responses. Share results as a summary, never as committed raw archives.

## Suites

| File | Status | What it covers |
|---|---|---|
| `stage1-routing-cases.json` | Reviewed, Stage 1 release evidence | 18 public routing and refusal checks. First independent live run 2026-09-30: 18 of 18. Not an answer-accuracy score. |

Stage 2A adds a Pell suite. Until each expected passage is reviewed by Tirath, its cases are **candidates**, not goldens.

## Rules

- No student records, private client or employer material, or API keys in any fixture.
- Keep locked held-out questions out of this repository. They live privately and are run only on finished builds.
- HTTP 200 is never counted as passage correctness.

Moved from `D:/career/projects/ed-source-desk-evals` on 2026-09-30.
