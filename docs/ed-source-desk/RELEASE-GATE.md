# Ask Regs: release gate and eval-set rules

**Status: PROPOSED, waiting for Tirath's approval.** Drafted by Claude 2026-10-04 (plan items 0.5 and 0.6). These are Tirath's decisions. Each rule below has a box: approve it, change it, or strike it. Once approved, the status line changes to `APPROVED <date>` and the rules apply to every release.

## 1. Stop rule: what blocks a promote or a publish (item 0.5)

A release is new code published to the live site, or staged handbook content promoted to `in_force`. It does **not** go live if any of these is true on preview:

- [ ] **R1. A missed refusal:** any case in `tests/evals/adversarial-cases.json` that should be refused is answered.
- [ ] **R2. A citation regression:** a question that previously got the correct answer or citation no longer does, unless it is recorded in advance as an **expected change** with a reason.
- [ ] **R3. Fictional amounts:** a handbook example's made-up dollar figure (for example $7,500) is shown as the answer to an amount question.
- [ ] **R4. A unit-test or CI failure.**
- [ ] **R5. Personal data:** a change would store question or comment text that the refusal rules would refuse.
- [ ] **R6. No on-screen review:** new handbook content has not been reviewed by Tirath on the **preview** site (lesson D5: confirm the environment first).

What does **not** block a release, but must be written in the PR: lower helpful votes, slower latency within the caps, a new "no confident citation" on a question that never had an answer. Each needs a sentence on why it's acceptable.

**Who decides:** Tirath, after reading the PR's verification section. An AI assistant may recommend holding but never promotes or publishes.

**After every publish:** run the adversarial suite against the live site and record the result in the evidence log (first done 2026-10-04: 15 of 15).

## 2. Eval-set rules (item 0.6)

- [ ] **G1. The official page settles disagreements.** When Tirath, an assistant or a judge disagree on an expected answer, the cited official page (eCFR, Federal Register, FSA Handbook) decides. If the page is ambiguous, the case is marked `ambiguous`, kept, and excluded from pass rates.
- [ ] **G2. Only Tirath marks a case `reviewed`.** Assistants create `candidate-unreviewed` cases only, and never write an expected answer Tirath hasn't confirmed.
- [ ] **G3. Build and held-out stay separate.** Every new case is tagged `build` (may be used to tune rules) or `held-out` (never used to tune). Before/after claims use held-out results only. `tests/evals/model-compare-questions.json` stays held-out for retrieval.
- [ ] **G4. A failure is a finding, not a test to loosen.** A failing case is changed only if G1 shows the expected answer was wrong. The reason is written in the case and the PR.
- [ ] **G5. Refresh from real use.** Each pilot week, real misses become candidate cases (playbook step 4), and at least one new held-out case per miss category is added before the next fix round.
- [ ] **G6. Record every measured change.** Each fix adds a row to `EXPERIMENTS.md` (plan item 1.8): what changed, the PR, the baseline, and the results across **all** suites (Torres: a fix can help one category and hurt another).

## 3. When an AI judge's grade can guide a release (item 5.3, decide after Phase 5)

Placeholder. Proposed starting point: a judge's grade may inform but never decide a release until its binary verdicts agree with Tirath's labels on a fresh sample, and its error rate is reported next to every result. The threshold is set by Tirath once 5.1 and 5.2 have measured it.

*Product Manager: Tirath Chhatriwala*
