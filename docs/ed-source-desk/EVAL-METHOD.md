# Ask Regs evaluation method inventory, item 1.7

Status: proposed inventory for Tirath's review. This classifies existing checks; it does not certify the answers.

## The product question

A staff member needs the right official source for the right award year, and must see when the tool lacks enough evidence. The PM first reads real failure traces, groups errors by cause, then chooses the cheapest valid way to measure each risk. Ask Regs uses four complementary methods. None can replace the others.

| Type | Existing Ask Regs checks and artifact | Why this method fits | What it cannot prove |
|---|---|---|---|
| Code checks | Refusal and no-over-refusal rules in tests/unit/refusals.test.ts; citation-ID and uncited-line checks in tests/unit/explain.test.ts and src/lib/explain.ts; import parsing/ranking tests; gateway source check; data-access and status rules. | Deterministic contracts have a yes/no oracle and run cheaply on every change. They catch a missing refusal pattern, a fabricated source ID or a broken section split. | A cited sentence may still misstate the source. A passing unit test does not establish that retrieval found the right rule. |
| Known-answer sets | Stage 1, Stage 2A and Stage 2B case files in tests/evals; run-live-evals.mjs exports one row per assertion and distinguishes expected source changes from regressions. A reviewed routing case names the expected official section, label or refusal. | The right citation or refusal can be specified before a run and checked repeatedly. This caught five batch regressions on preview before promote. | The suites cover their chosen cases, not every federal aid question. HTTP 200 and a plausible citation are not answer correctness. Retrieval recall at k and a labeled fresh set remain Phase 3 work. |
| AI judge, with expert calibration | Owner-only model comparison uses a separate model to grade faithfulness, completeness and clarity on 1 to 5 scales. Tirath graded 25 outputs himself; JUDGE-CALIBRATION.md reports exact, within-one and weighted kappa. | Some generated claims need interpretation, and a judge can triage candidates after alignment is demonstrated. | The present judge disagrees materially with Tirath and is not a release oracle. It may have same-family bias, but this sample does not prove the cause. Phase 5 needs a blind set, binary claim criteria, cross-family judging and human adjudication. |
| User signals | ed_feedback Yes/No and comments, owner-only usage summary, direct observations in USER-FEEDBACK-LOG.md, and the planned week-one task observation and retry/rephrase signals. | These reveal whether real staff find the source they need and where the interaction fails. | Self-selected votes do not prove source correctness, task completion or population adoption. Rephrasing can signal confusion but needs context. Exact pilot denominators are pending export. |

## Error analysis precedes metric choice

The day-one record has distinct failure causes: a maximum-timeframe definition was below the 6,000-character display cap; an R2T4 modules phrasing missed the relevant eCFR section and surfaced Pell material; OBBBA wording was not routed to a rule already present. These are display, retrieval and routing/fit issues, not one generic "AI accuracy" failure. The source of truth for each diagnosis is the trace, the full official section and the reviewer label. A fix should name its error class before changing a threshold or prompt.

The failure taxonomy in the plan and pilot handoff is the starting hypothesis. Read at least three real traces closely, then classify the remaining misses; if a new class appears, update the taxonomy and re-review nearby cases. Tirath confirms which errors matter most to users and which expected answer is acceptable.

## What the current suite measures

The evidence log records 26 routing/content cases with 201 assertions at one point in the rollout. These are versioned results, not a universal score for the current site. The live adversarial suite later expanded to 15 refusal cases, and legitimate look-alikes were added separately. Keep run timestamp, environment, source version, case-set commit and expected-change list with every published count. A pass badge must use an executed live receipt, not be recomputed in the browser.

A release decision pairs quantity and quality: how many reviewed cases passed, plus whether any missed refusal, wrong citation, fictional amount, unreviewed source or failing test triggers the stop rule in RELEASE-GATE.md. One critical failure blocks promotion even if the aggregate score improves. Automated assertions are a floor. Tirath's review of official text remains the authority for golden labels.

## The next measurement step

Phase 3 labels a fresh set of questions with the exact official passage, award year, acceptable partial result and refusal expectation. The retrieval runner then reports recall at k, first relevant rank and false confident citations. Phase 5 grades generated claims only after the source set is held fixed. Phase 2 adds task success, comments and observed rephrasing with denominators. For every experiment, record baseline, one change, full rerun and regression count in EXPERIMENTS.md once item 1.8 lands. The PM owns the quality bar and release decision; tools produce evidence, not the decision.

Sources: [PORTFOLIO-PLAN.md](PORTFOLIO-PLAN.md) section 4d, [AI-EVIDENCE-LOG.md](AI-EVIDENCE-LOG.md), [RELEASE-GATE.md](RELEASE-GATE.md), [PILOT-HANDOFF.md](PILOT-HANDOFF.md), the named test files and [JUDGE-CALIBRATION.md](JUDGE-CALIBRATION.md).
