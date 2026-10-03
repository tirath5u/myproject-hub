# Ask Regs: judge calibration, item 1.1

Computed 2026-10-04 from [model-compare-grading.csv](model-compare-grading.csv). This is a retrospective analysis of the original Gemini 2.5 Pro judge versus Tirath's scores. It does not regrade an answer, test a new model or change the model decision.

## Method and population

The file contains 28 model outputs from the same 14 answered questions, one output per model per question. The fifteenth comparison question had no explanation because no source was cited. Tirath scored 25 outputs; three Flash outputs have blank owner scores and are excluded without imputation. The 25 paired, ordered scores are on a 1 to 5 scale for each measure. They are output-level pairs, not 25 independent questions.

For every measure, exact agreement counts identical scores. Within-one agreement counts scores that differ by zero or one point. Weighted Cohen's kappa also adjusts for how often the two raters would agree under their observed score distributions, and for the size of each disagreement. Quadratic weighting is the headline measure: a two-point gap gets four times the penalty of a one-point gap. Linear weighting is a sensitivity check: a two-point gap gets twice the penalty. The calculation is 1 minus observed weighted disagreement divided by expected weighted disagreement from the raters' marginal score frequencies. No benchmark threshold or significance claim was set.

| Measure | Exact | Within one | Quadratic weighted kappa | Linear weighted kappa | Mean judge minus Tirath |
|---|---:|---:|---:|---:|---:|
| Faithfulness | 13 of 25 (52%) | 20 of 25 (80%) | -0.111 | -0.073 | -0.32 |
| Completeness | 7 of 25 (28%) | 19 of 25 (76%) | -0.011 | -0.017 | -0.48 |
| Clarity | 9 of 25 (36%) | 18 of 25 (72%) | -0.242 | -0.206 | +0.52 |

Reproduce: run `node tests/evals/judge-calibration.mjs` from the repository root. The script parses the quoted, multiline CSV, excludes blank owner scores, validates the 1 to 5 range, and prints counts and both weighted kappas. Its exact and within-one counts match the independent `node tests/evals/run-model-compare.mjs --agreement docs/ed-source-desk/model-compare-grading.csv` report already in the evidence log.

## What kappa adds

Percent agreement alone makes faithfulness look fairly aligned because 20 of 25 grades are within one point. But both raters frequently choose high scores: on faithfulness, the judge gave 5 to 19 of 25 outputs and Tirath gave 5 to 18. Some matching high scores are expected even if the raters do not distinguish individual answers in the same way. Kappa adjusts for those scoring habits. If the two faithfulness score lists were paired independently, their marginal frequencies alone would yield 54.7% exact matches; the observed exact rate is 52%. Weighted kappa additionally considers the distance between mismatched grades. Here, weighted disagreement is slightly greater than the chance-adjusted expectation under those marginals, yielding values at or below zero.

This does **not** establish that the judge is generally worse than a random person, that either rater is correct, or that same-family bias caused the disagreement. Kappa measures agreement, not truth. The sample is small, score distributions are concentrated near the top, three Flash grades are missing, and two answers to the same question are not independent observations. The signed differences describe this sheet only. Clarity is the clearest scoring-pattern mismatch: the judge gave 5 to 22 of 25 outputs, while Tirath gave 5 to 12.

## PM conclusion and next decision

The existing 52% exact faithfulness figure remains true, but it is not enough to qualify this judge as an automatic release gate. The chance-adjusted result reinforces the current human review boundary. It does not by itself reverse D12, Tirath's choice of Flash for a faster owner-verified workflow. Before using judge scores to approve model or prompt changes, Phase 5 needs a fresh blind question set, a written rubric, Tirath's claim-level grading, and a cross-family judge on the same outputs. Predefine which disagreements trigger human adjudication.

Teach-back for Tirath:
1. Why can 80% within-one agreement coexist with a negative kappa? Within-one is forgiving and ignores the high baseline overlap expected when both raters favor 5.
2. What does a negative kappa prove? Only that this sheet's weighted disagreement exceeds the expectation from these raters' score frequencies; it does not identify a cause.
3. What would change a product decision? A fresh, blind calibration showing whether judge scores correctly separate supported, incomplete and unsupported answers at the release boundary.

Source boundary: the comparison set was later inspected during prompt tuning, so do not use this same set to claim an unbiased improvement from the revised prompt. No public correctness, user outcome, same-family bias or production-scale claim follows from this item.
