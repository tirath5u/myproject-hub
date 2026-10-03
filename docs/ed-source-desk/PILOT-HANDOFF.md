# Ask Regs: pilot handoff and day-7 playbook

**Start with `PORTFOLIO-PLAN.md`** (the single plan, status tracker and fact corrections), then this file. **Read this first** if you are an AI assistant (Claude Code, Lovable, ChatGPT, Gemini…) picking up this project. Then read `AGENTS.md` (rules) and `AI-EVIDENCE-LOG.md` (what was built, who decided what, measured results, open gaps).

Owner: Tirath, a product manager in U.S. federal student aid software. The project is **proof of AI product work**: finding a real problem, solving it with AI, and measuring, evaluating and governing the result. Tirath directs AI coding agents and makes the product decisions. **Never write that Tirath hand-coded anything.**

## 1. Where we are (as of 2026-10-03)

- **Ask Regs** is live at myproduct.life/ask-regs. It answers federal student aid questions only with verbatim, cited official sources: eCFR, Federal Register, Regulations.gov, and the 2026-27 FSA Handbook, Vol 7 (Pell, all six chapters). It refuses student-specific, tax, private and vendor questions.
- **Built and measured:** see `AI-EVIDENCE-LOG.md` sections 3 to 5.
  - RAG with hybrid search and heading-aware ranking.
  - Grounding checks and a fictional-amount guard.
  - 26 live eval cases with 201 checks, 76 unit tests, and CI.
  - Staged releases with a human approval gate.
  - Owner-only AI explanation with citation enforcement.
  - Red-teaming: 10 of 10 probes refused.
  - Model comparison with an LLM judge, validated against Tirath's own grading. The judge-bias finding led to decision D12: keep Gemini 2.5 Flash and improve its instructions.
  - Monitoring, daily cost caps, and a public feedback button.
- **Pilot running since 2026-10-02.** Financial aid colleagues use the live tool as normal visitors (no owner token), several times a day. They click Yes/No, write comments, and also give feedback directly to Tirath.
- **Day-1 snapshot** (reported by Lovable from the live logs, 2026-10-02): see `USER-FEEDBACK-LOG.md`.
  - 24+ lookups, all under about 1.2 s; 15+ Yes/No votes with detailed comments.
  - Praised: the R2T4 order-of-return answer, a state-scholarship scope call, and a student-specific refusal.
  - Misses:
    - the §668.34 maximum-timeframe answer was truncated;
    - an "R2T4 modules" question got Pell passages instead of §668.22;
    - several One Big Beautiful Bill Act (OBBBA) loan-limit questions got "no confident citation".
  - Testers also flagged a large share of "no confident citation" results as too cautious.

## 2. Where the data lives

| Data | Where | Notes |
|---|---|---|
| Every lookup, explanation and comparison | `ed_usage_log` table (server-only) | Question text is kept up to 300 characters. Refused questions are never stored (only that a refusal happened). Includes mode, latency, tokens, and a `staged` flag (true = preview traffic). |
| In-tool feedback | `ed_feedback` table (server-only) | helpful yes/no, question, lookup mode, cited source, comment |
| Weekly summary | `GET /api/ed-source-desk/admin/stats?days=7` (owner token) | Counts, no-answer rate, latency, tokens, top 10 unanswered questions, latest 10 "No" comments |
| Feedback given outside the tool | `docs/ed-source-desk/USER-FEEDBACK-LOG.md` | Tirath adds rows: User A/B, no student details |

Preview and the live site share one database. Filter out `staged = true` rows and Tirath's own test questions from 2026-10-01 when reporting pilot numbers.

## 3. Day-7 playbook (run on or after 2026-10-09)

The goal is to turn a week of real use into **measured improvements and truthful evidence**, not just a stats screenshot. Run every step. Steps marked *(Tirath)* need his judgment and must not be decided by an AI.

### Step 1: Export (Lovable)
Export all `ed_usage_log` rows (kind = lookup, staged = false) and all `ed_feedback` rows from 2026-10-02 onward. Save them as CSV files:
- `docs/ed-source-desk/pilot/week1-lookups.csv`
- `docs/ed-source-desk/pilot/week1-feedback.csv`

Also save the stats summary JSON as `docs/ed-source-desk/pilot/week1-stats.json`. Don't include any token or secret.

### Step 2: Baseline numbers (Claude Code)
From the CSVs, write `docs/ed-source-desk/pilot/WEEK1-REPORT.md` with:
- **Volume:** distinct days with use, lookups per day, and testers. The tester count comes from Tirath; the logs are anonymous.
- **Outcome mix:** answered from eCFR, Federal Register or handbook; no confident citation; refused; errors.
- **Quality:** helpful rate overall and by mode, and median and p95 latency.
- **Cost:** tokens per day versus the caps.

### Step 3: Classify every miss (Claude Code drafts, *Tirath confirms*)
Take every lookup with mode `no-confident-cite` or `definition-only`, every "No" vote, and every outside-the-tool complaint. Give each one exactly one root cause:

| Code | Root cause | Typical fix |
|---|---|---|
| C1 | **Coverage gap:** the right source isn't in the library (e.g. OBBBA loan limits, Direct Loan volume not imported) | Import the chapter (staged → review → promote), or add a "not covered yet" message |
| C2 | **Retrieval miss:** the right source exists but ranking picked the wrong one (e.g. R2T4 modules → Pell instead of §668.22) | General ranking or routing rule, plus an eval case |
| C3 | **Too cautious:** the right passage was found but rejected by the fit or similarity threshold | Tune with evidence; must not break existing evals |
| C4 | **Display problem:** truncation, formatting (e.g. §668.34 cut off) | UI or excerpt fix |
| C5 | **Correct behavior the user disliked:** a refusal or a no-cite that was right | Better wording, no logic change |
| C6 | **Wrong answer:** confidently cited the wrong rule | Highest priority; add a regression eval |

Write a table in `WEEK1-REPORT.md` with question (paraphrased if needed), code, evidence, and proposed fix. Count by code.

### Step 4: Turn real questions into an eval suite (*Tirath reviews*)
Create `tests/evals/pilot-week1-cases.json` from the misses plus a sample of the praised answers (aim for 15 to 25 cases). Use the same format as the Stage 2A suites, starting as `candidate-unreviewed`. Tirath marks each expected outcome as `reviewed`. This is the "evals built from production traffic" evidence.

**Rules:**
- Never write an expected answer Tirath hasn't confirmed.
- Never use `tests/evals/model-compare-questions.json` to tune retrieval.

### Step 5: Fix by impact, measure before and after
Pick the 2 or 3 root causes that cover the most misses, and fix them with **general rules** (see `AGENTS.md`), not per-question patches.
- Run the pilot suite **before** the fix (baseline) and **after** it, on preview.
- Also run all existing suites: zero regressions is required.
- C1 imports go through the staged import, Tirath's preview review, then promote.

**Record:** "pilot no-answer rate on real questions went from X% to Y%", "N of M pilot cases now pass", and "0 regressions across 201 existing checks". Use only measured numbers.

### Step 6: Close the loop with users
Publish, tell testers what changed (Tirath), and run week 2. Compare week 2 with week 1: helpful rate, no-answer rate, and repeat use. Add a row for each change to `USER-FEEDBACK-LOG.md` under "Action taken (and PR)".

### Step 7: Update the evidence
- **`AI-EVIDENCE-LOG.md`:** new decision rows (who proposed, who chose), pilot results in section 5, gap table rows for production monitoring, users and outcomes, and cost governance updated with real numbers, and resume bullets updated.
- **Website case study:** see section 4.

## 4. Showing it on the website (proof of work)

**Goal:** a case-study page, e.g. `/ai-work/ask-regs` linked from the home page's "AI Work" section. It tells the story the way hiring teams evaluate AI product work. Every number on the page must come from a committed artifact (evidence log, pilot report, eval results). **No client-side-computed percentages, no estimates.**

Suggested sections:
1. **Problem:** financial aid staff need fast, citable answers. General chatbots guess and can't be audited.
2. **Approach:** retrieval of official sources only, verbatim with citations; refusals for student-specific questions; AI explanation kept owner-only until proven.
3. **How quality is measured:** eval suites and checks, the human review layer, staged releases, red-team results.
4. **AI model decision:** the judge-vs-human finding (52% agreement, ranking reversed) and the cost/speed/quality trade-off behind choosing Flash.
5. **Real users:** pilot numbers, what users found, what changed, and before/after numbers.
6. **Governance:** monitoring, cost caps, privacy choices (refused questions never stored), and owner-only AI.
7. **What I'd do next and what this isn't:** not hand-coded, no fine-tuning, the AI explanation isn't public.

Map each section to the AI PM skills it proves:
- evaluation design;
- LLM-as-judge and its validation;
- RAG and grounding;
- responsible AI;
- human-in-the-loop releases;
- monitoring and cost;
- user research and iteration;
- directing AI agents.

## 5. Gap map (what this project is designed to prove)

| AI PM skill | Evidence today | After the pilot |
|---|---|---|
| Evaluation design | 26 cases, 201 checks, expected changes vs regressions | + suite built from real user questions |
| LLM-as-judge | Judge validated against owner grading; bias found | (unchanged) |
| Model selection and trade-offs | D12: Flash for cost and speed, quality via instructions | (unchanged) |
| RAG and grounding | Hybrid retrieval, fit check, citation enforcement | + fixes driven by real misses |
| Red-teaming and safety | 10 of 10 probes; over-refusal guard on 41 questions | + real refusals observed in the pilot |
| Human-in-the-loop release | Staged → review → promote, zero live regressions | + pilot-driven releases |
| Production monitoring | Logging and owner stats built | + one week of real data and fixes driven by it |
| Cost governance | Token logging, daily caps | + actual cost per day vs caps |
| Users and outcomes | Pilot running | + helpful rate, before/after, a week-2 comparison |
| Directing AI agents | Handoffs, rules file, reviewed PRs, decision log | (unchanged) |

**Still not covered (don't claim):** hand-coding, fine-tuning or training, business or revenue impact, agentic tool use, a public AI feature, A/B testing, multi-turn chat, managing people on this project.
