# Ask Regs Volume 7 batch release record, item 1.3

Status: proposed retrospective. It documents a completed release; it does not promote or publish content.

## The release decision

The 2026-27 FSA Handbook Volume 7 Chapters 1, 4, 5 and 6 were imported as 76 staged passages: 11, 42, 15 and 8 respectively. The batch stayed visible on preview while the live site excluded staged rows. Preview evals then exposed five regressions: U08, U09, U21, U25 and U30. Stage 2A fell to 2 of 6 and Stage 1 to 15 of 18. Tirath held the promote step instead of releasing the batch. That is the actual gate, not a claim that CI blocked a merge.

## Four fix rounds

| Round | Finding and change | Result and remaining question |
|---|---|---|
| [PR #12](https://github.com/tirath5u/myproject-hub/pull/12) | Added volume topic-word handling for Pell/Grant, numbered-variant coverage, aid-program separation, and an on-topic related shortlist. The fixes addressed wrong Pell sections, a false Formula 1-4 complete label, an unrelated Direct Loan result, and U30 crowding. | Unit tests passed. Preview still had U21 and a weak U10 answer. The PR explicitly left U30 confirmation to a full preview rerun. |
| [PR #13](https://github.com/tirath5u/myproject-hub/pull/13) | Added list/range parsing for numbered formulas and extended topic handling to address U10. A separate router type failure from a package update was fixed in CI. | Preview reached Stage 2A 5 of 6 and Stage 1 17 of 18, but U21 still failed. The volume-wide topic rule caused a new U21 ranking problem. |
| [PR #14](https://github.com/tirath5u/myproject-hub/pull/14) | Restored chapter-local topic words, moved U10's fix to answer ordering, and required the selected passage itself to cover the question before marking it complete. | Stage 2A remained 5 of 6 with U21; Stage 1 17 of 18 and Stage 2B 2 of 2. A further diagnostic was needed instead of another ranking guess. |
| [PR #15](https://github.com/tirath5u/myproject-hub/pull/15) | Shortlist diagnostics found Basic Pell Grant Formulas at similarity 0.850 with the only heading hit, but fit 0.56 because it explains formula selection without naming Formulas 1-4. Named formulas now determine completeness without depressing relevance; BBAY 1/2/3 fit behavior stayed unchanged. | The section could qualify as related or partial without falsely becoming a complete answer. The PR's offline tests passed and preview validation remained the release check. |

This sequence shows why the whole suite mattered: one broad fix repaired U10 and broke U21. The team changed a general rule only after inspecting candidate scores and source wording.

## Promote record and evidence boundary

The [evidence log](AI-EVIDENCE-LOG.md) records Tirath's decision to hold the batch, then a single promote for Chapters 1, 4, 5 and 6 after the preview suites were clean. It records three promotions across the broader Volume 7 rollout: Chapter 2, Chapter 3, and this four-chapter batch. The released site had no observed regressions in the cited live suites. This is not a claim that all possible answers were correct, or that the five regressions were caught in CI. Offline unit tests covered rule mechanics; live preview evals caught the content interaction; Tirath controlled the promote.

What would invalidate this account: a missing promote audit entry, a preview run that did not cover the staged batch, or a live regression outside the recorded suites. The precise promote timestamp and operator receipt are not copied into this memo, so link them before using an exact timestamp in public or in an interview.

## Product lesson

The release gate protected existing staff questions while expanding handbook coverage. The senior decision was to delay exposure of new content, identify which general retrieval rule failed, and retest old and new cases together. Tirath set and approved the release boundary; AI agents and engineering tools implemented the changes under his direction. This is evidence of release judgment, not hand-coding or measured user adoption.
