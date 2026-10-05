# Ask Regs small-sample statistics, item 1.6

Status: proposed primer. The day-one helpful-rate interval is pending an exact export of Yes and No votes.

## What the pilot can say now

The [pilot handoff](PILOT-HANDOFF.md) and [user feedback log](USER-FEEDBACK-LOG.md) report at least 24 day-one lookups and at least 15 Yes/No votes. They do not provide an exact vote denominator or Yes count. The feedback log names positive and negative topics but is not a one-row-per-vote export. No day-one helpful percentage or Wilson interval should be printed from it. The owner-only stats export will provide the counts. A vote is a response from a self-selected visitor, not a random sample of all aid staff or all questions.

## Wilson interval in plain words

For x helpful votes out of n votes, the observed share is p = x/n. A 95% Wilson score interval uses z = 1.96:

- center = (p + z²/(2n)) / (1 + z²/n)
- half-width = z × sqrt[p(1-p)/n + z²/(4n²)] / (1 + z²/n)
- interval = center minus half-width to center plus half-width

Wilson behaves better than the simple p plus or minus 1.96 standard errors when n is small or a share is near zero or one. It still assumes the votes being modeled are independent observations from a defined process. Multiple votes from one colleague, repeated questions or selection by who chose to click make a population interpretation weaker. The interval is a description of uncertainty under that model, not a guarantee that the product works for everyone.

## Worked arithmetic, explicitly illustrative

Suppose a future export contains exactly 3 Yes and 3 No votes from 6 distinct interactions. Then x = 3, n = 6, p = 0.50, denominator 1 + 1.96²/6 = 1.6403, center = 0.50, half-width = 0.3124, and the 95% Wilson interval is about 0.188 to 0.812. Report it as "3 of 6 helpful votes (50%; 95% Wilson interval about 19% to 81%)" only if those are the actual exported counts and the unit is explained. These numbers are an arithmetic demonstration, not Ask Regs day-one results. The six topics listed in USER-FEEDBACK-LOG.md must not be mistaken for six unique votes.

A sentence **not** to say: "Half of financial-aid staff find Ask Regs helpful." Even if a six-vote export gave 3 Yes, the interval would be very wide and the voters would not represent the profession. A defensible sentence would identify the pilot, window, count, repeated-user caveat and observed tasks, then pair the vote with citation quality and refusal regressions.

## Day-seven calculation protocol

Export the exact window, Yes count, No count, unique voter estimate if privacy-safe, lookup count, and whether automated sessions or owner tests are included. Separate colleague and automated traffic. Compute x/n and the 95% Wilson interval from the actual vote count. Do not infer task success from a Yes button; read the negative comments and observe whether a colleague found and verified the rule they needed. Compare week 2 only after naming which users and questions entered each window.

The PM decision this supports is whether the pilot provides enough evidence for the next change. A small interval and a high vote share cannot replace expert review of wrong citations or a missed refusal. Tirath reviews the exported counts and approves any public number.
