# Ask Regs: release gate and eval-set rules

**Status: APPROVED 2026-10-04 by Tirath ("approve all"): rules R1 to R6 and G1 to G6 apply to every release.** Drafted by Claude (plan items 0.5 and 0.6). Section 3 (the AI judge bar, D15) was set 2026-10-06; Phase 5 measures against it.

## 1. Stop rule: what blocks a promote or a publish (item 0.5)

A release is new code published to the live site, or staged handbook content promoted to `in_force`. It does **not** go live if any of these is true on preview:

- [x] **R1. A missed refusal:** any case in `tests/evals/adversarial-cases.json` that should be refused is answered.
- [x] **R2. A citation regression:** a question that previously got the correct answer or citation no longer does, unless it is recorded in advance as an **expected change** with a reason.
- [x] **R3. Fictional amounts:** a handbook example's made-up dollar figure (for example $7,500) is shown as the answer to an amount question.
- [x] **R4. A unit-test or CI failure.**
- [x] **R5. Personal data:** a change would store question or comment text that the refusal rules would refuse.
- [x] **R6. No on-screen review:** new handbook content has not been reviewed by Tirath on the **preview** site (lesson D5: confirm the environment first).

What does **not** block a release, but must be written in the PR: lower helpful votes, slower latency within the caps, a new "no confident citation" on a question that never had an answer. Each needs a sentence on why it's acceptable.

**Who decides:** Tirath, after reading the PR's verification section. An AI assistant may recommend holding but never promotes or publishes.

**After every publish:** run the adversarial suite against the live site and record the result in the evidence log (first done 2026-10-04: 15 of 15).

## 2. Eval-set rules (item 0.6)

- [x] **G1. The official page settles disagreements.** When Tirath, an assistant or a judge disagree on an expected answer, the cited official page (eCFR, Federal Register, FSA Handbook) decides. If the page is ambiguous, the case is marked `ambiguous`, kept, and excluded from pass rates.
- [x] **G2. Only Tirath marks a case `reviewed`.** Assistants create `candidate-unreviewed` cases only, and never write an expected answer Tirath hasn't confirmed.
- [x] **G3. Build and held-out stay separate.** Every new case is tagged `build` (may be used to tune rules) or `held-out` (never used to tune). Before/after claims use held-out results only. `tests/evals/model-compare-questions.json` stays held-out for retrieval.
- [x] **G4. A failure is a finding, not a test to loosen.** A failing case is changed only if G1 shows the expected answer was wrong. The reason is written in the case and the PR.
- [x] **G5. Refresh from real use.** Each pilot week, real misses become candidate cases (playbook step 4), and at least one new held-out case per miss category is added before the next fix round.
- [x] **G6. Record every measured change.** Each fix adds a row to `EXPERIMENTS.md` (plan item 1.8): what changed, the PR, the baseline, and the results across **all** suites (Torres: a fix can help one category and hurt another).

## 3. When an AI judge's grade can guide a release (item 5.3, D15)

**Set 2026-10-06.** Tirath delegated the choice of bar to Claude ("whatever fits me") after deciding not to use the 0.80 example from his study notes. He can change it at any time.

Until a judge meets every rule below, its grades are advisory only: they are reported, but they never block or approve a release.

- [x] **J1. What is measured.** Each judge question is a yes/no criterion (item 5.1b), for example "every claim is supported by its cited passage." The judge's verdicts are compared with Tirath's blind labels on the same outputs using Cohen's kappa, per criterion.
- [x] **J2. Which sample counts.** Fresh outputs on questions never used to tune prompts, rules or the judge itself (G3), with at least 50 judged items per criterion. The 25 output pairs in `JUDGE-CALIBRATION.md` do not count.
- [x] **J3. The bar: kappa of at least 0.60 on every criterion.**
- [x] **J4. Hard floor: zero unsupported claims passed.** If the judge passes any claim Tirath marked unsupported, the judge does not qualify, whatever its kappa.
- [x] **J5. What qualifying allows.** A qualified judge can **block** a release (a failed criterion holds it, like R1 to R6), and it can screen outputs between human reviews. It never approves a release alone: any change to the explanation model or its instructions still gets a human spot check of at least 10 fresh explanations by Tirath.
- [x] **J6. When to re-check.** Re-measure J3 and J4 whenever the judge model, the judge's instructions, the explanation model or its instructions change. Every reported judge result shows n, kappa, and the count of judge false passes and false flags next to it.

**Why these numbers fit Ask Regs:**
- **0.60, not 0.80.** Agreement from 0.61 up is commonly described as "substantial." With about 50 items, a kappa estimate can be off by roughly 0.2 either way, so a higher bar on a pilot-sized sample would mostly measure noise. A bar the product can honestly test beats a bar it can only quote.
- **The hard floor carries the safety load, not kappa.** In a compliance domain, a judge that passes an unsupported claim is more costly than one that raises a false alarm. That's the same principle as the product: refuse rather than guess.
- **Block, never approve.** A judge that has only earned partial trust gets the cheap power (stopping a release), not the expensive one (letting one through without a person).

*Product Manager: Tirath Chhatriwala*
