# Ask Regs model decision, item 1.2

Status: proposed analysis for Tirath's review. This records decision D12; it does not approve a new model release.

## Decision

Tirath chose Gemini 2.5 Flash for the owner-only, source-checked explanation. GPT-5 mini was the stronger answer in Tirath's own grading. Flash was faster and used fewer tokens in this preview comparison, and the owner verifies each explanation against the quoted source. This trade needs reconsideration before making generated explanations public or removing human review.

## What was compared

The 2026-10-01 preview run used 15 held-out questions with the same retrieval and cited sources for both models. Fourteen questions produced an explanation per model; one produced none because no source was cited. Both models passed the mechanical source check on all 14 answered questions on the first try. A Gemini 2.5 Pro judge scored faithfulness, completeness and clarity on a 1 to 5 rubric. Tirath independently scored 25 of the 28 outputs, leaving three Flash grades blank.

| Measure | Gemini 2.5 Flash | GPT-5 mini | Reading |
|---|---:|---:|---|
| Judge faithfulness / completeness / clarity | 5.00 / 3.71 / 5.00 | 3.93 / 4.07 / 4.64 | Judge favored Flash on faithfulness and clarity, GPT on completeness. |
| Tirath faithfulness / completeness / clarity | 4.45 / 3.91 / 3.64 | 4.93 / 4.79 / 4.79 | Tirath favored GPT on all three; Flash means exclude three ungraded replies. |
| Mean tokens per answered comparison | 2,209 | 3,948 | GPT used about 1.79 times as many tokens in this run. |
| Median explanation latency | 2.1 seconds | 21.9 seconds | GPT took about 10.4 times as long in this preview run. |
| Judge-flagged unsupported claims | 0 | 10 | Judge labels, not an independent count of true hallucinations. |
| Source check | 14 of 14 | 14 of 14 | Checks known source IDs and cited lines, not substantive correctness. |

The token totals do not establish a dollar-cost ratio: model input and output prices differ, and gateway billing may differ from public list prices. Item 1.4 prices the measured usage separately.

## Quality accepted and the human gate

Tirath accepted lower human-rated completeness and clarity from Flash for this owner-only workflow. The observed owner-score gaps were 0.88 for completeness and 1.15 for clarity on a five-point scale. This is a visible quality concession, not a claim of parity. The product continues to show official quotations, requires a source ID on every generated point, discards failed checks after one retry, and keeps explanation access owner-only. Those controls reduce exposure but do not prove the remaining explanation is accurate. Tirath still checks the official text. A public explanation would require a new decision and fresh evidence.

## Why the judge did not settle it

[JUDGE-CALIBRATION.md](JUDGE-CALIBRATION.md) reproduces only 13 of 25 exact matches on faithfulness, 7 of 25 on completeness and 9 of 25 on clarity. Quadratic weighted kappa is -0.111, -0.011 and -0.242 respectively. Tirath's October 6 teach-back applied the operational lesson: compare judge scores with expert grading before allowing the judge to drive automated release. His study-note suggestion of 200 to 300 queries and a 0.80 kappa threshold was not this project's prespecified target and does not convert the 25 dependent output pairs into a validated release sample. Disagreement is measured; same-family bias is a hypothesis, not a proven cause.

## Prompt revision and reversal conditions

After seeing the first outputs, the instructions asked Flash for a direct answer, grouped facts, conditions, thresholds, timing and ordered calculation steps. On the same 14 answered questions, the original judge scored completeness 3.93 rather than 3.71, faithfulness 4.71 rather than 5.00, and flagged two unsupported claims rather than zero. A GPT-5 cross-family judge scored the revision 4.50 / 4.71 / 4.93 and flagged nine unsupported claims. These judge results do not establish that the human-rated gap closed. The comparison set informed the rewrite, so it is no longer untouched validation data.

Reopen D12 if a fresh blind, expert-graded set shows Flash misses material conditions, if citation checks let unsupported claims through, if public access is proposed, or if measured price and latency change the trade. Phase 5 should use a written claim-level rubric, a new blind set, a cross-family judge and human adjudication of consequential disagreements.

## Evidence and ownership

Sources: [AI-EVIDENCE-LOG.md](AI-EVIDENCE-LOG.md) D12 and evaluation entries; [model-compare-grading.csv](model-compare-grading.csv); [JUDGE-CALIBRATION.md](JUDGE-CALIBRATION.md). Claude laid out options and AI coding agents implemented the comparison. Tirath graded outputs and chose the model. This memo is a proposed explanation of that recorded choice, not a new approval.
