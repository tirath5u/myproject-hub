# Ask Regs retrieval evaluation: first reviewed baseline

**Run:** 2026-10-06 against the published lookup. Sources: [results JSON](../../tests/evals/results/retrieval-2026-10-06.json), [AI-EVIDENCE-LOG.md](AI-EVIDENCE-LOG.md) (2026-10-06 scorecard), and [PORTFOLIO-PLAN.md](PORTFOLIO-PLAN.md) item 3.4. This is a retrieval baseline for Phase 4, not a generated-answer or user-outcome score.

## Method and label rules

The retrieval-only runner sent labeled questions to the public lookup without an AI explanation call or owner token. The scorer compares sources shown to visitors, in order, with accepted eCFR, Federal Register, Regulations.gov, or handbook labels. It also checks the raw top-12 handbook meaning-search candidates before display filters. Top-1 and top-5 mean an accepted source was shown in those positions. Mean reciprocal rank (MRR) averages 1 / rank for the first accepted shown source, or zero for a miss. The separate confident-answer check asks whether the source presented as the answer is accepted. A related passage can be a retrieval hit without being a confident answer.

Each label records the expected outcome, acceptable source IDs or heading prefixes, library availability, and split. Build questions may guide fixes; held-out questions are reserved for before-and-after measurement. Tirath approved every scored label, with per-label reviewer and review date. This run scored 59 reviewed labels: 29 build and 30 held-out. The evidence log says results were viewed before the split, so held-out means withheld from tuning, not blind selection. Twelve held-out MC drafts and four eCFR-coverage questions remain unreviewed and were excluded.

## Held-out results

There were 25 answerable held-out questions and five labeled not in the searchable library. The 95% Wilson intervals below are copied from the evidence log and describe the uncertainty of these small observed counts.

| Check | Result | Interpretation |
|---|---|---|
| Accepted source shown first | **16 of 25**, 95% Wilson **45% to 80%** | Top-1 retrieval hit. |
| Accepted source shown in first five | **20 of 25**, 95% Wilson **61% to 91%** | Top-5 retrieval hit. |
| MRR | **0.70** | Rank-weighted result over the 25 answerable questions. |
| Confident answer names an accepted source | **14 of 20**, 95% Wilson **48% to 85%** | Source correctness when a confident answer was presented, not AI explanation accuracy. |
| No confident answer for a not-in-library question | **5 of 5** | No false confident citation in this coverage-gap subset. |
| Wrong-award-year passage shown | **0 of 30** | All reviewed held-out questions in this run. |

The first shown source was irrelevant on **8 of 25** answerable held-out questions. These are one run's results, not proof that every regulatory answer is correct.

## Miss types and four build cases

Across 52 answerable reviewed questions, **7** misses had an accepted handbook heading in the raw search candidates but not among the first five shown sources. The category combines ranking and filter effects; it does not establish which caused each miss. **One** accepted heading was outside the top 12 raw candidates. **Four** build questions had no *accepted* source shown. The scorer calls this category "no source shown", but two responses did show unrelated passages.

| Build ID | Question | Accepted source | Observed response |
|---|---|---|---|
| R-AG40 | Annual Direct Subsidized Loan limits for a dependent first-year student | ecfr:34-685.203 | No confident citation or passage. |
| R-AG47 | Aggregate loan limits for an independent undergraduate | ecfr:34-685.203 | No confident citation or passage. |
| R-AG44 | Regulatory definition of a regular student | ecfr:34-600.2 or ecfr:34-668.2 | No confident citation; one unrelated handbook passage. |
| R-AG48 | Academic attendance in distance education under R2T4 | ecfr:34-668.22 or ecfr:34-600.2 | No confident citation; two unrelated handbook passages. |

Build top-1 was **13 of 27** and top-5 was **20 of 27** answerable questions. Build scores guide diagnosis, not the before-and-after claim. The evidence log excludes this run's **75** automated lookups from pilot-use counts.

## What Phase 4 will fix and test

Item 4.1 adds Tirath-reviewed pilot questions. Item 4.2 runs the pilot, retrieval, and existing suites before a change. Item 4.3 chooses the highest-impact causes and tests general rules, with build misses such as the loan-limit route and ranking or filter effects as candidates. Long-section display and over-strict term matching are also candidates in the plan; this scorecard alone does not prove a fix. Item 4.4 reruns the held-out and existing suites after each change, with zero unexplained regressions. Week-2 notes and comparison follow observed results. No Phase 4 improvement is claimed here.
