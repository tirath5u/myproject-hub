# Ask Regs: skill and gap proof map

This file explains **what each skill means**, **what an interviewer will ask about it**, and **where Ask Regs proves it**: the plan item that produces the proof, the committed file that holds it, the website section that shows it, and the resume bank proposal that claims it. It is the bridge between `PORTFOLIO-PLAN.md` (the work), the website (the showing) and `D:/career/bank-proposals.md` (the claims).

**Sources for the definitions:** Tirath's NotebookLM notebooks, queried 2026-10-04: *AI and LLM Fundamentals for PM* (`a3c21af1…`) and *Product Manager Book* (`85f05267…`). Also Teresa Torres, ["AI Evals: A Hands-On Guide for Product Teams"](https://www.producttalk.org/ai-evals/). The definitions below are rewritten in plain language. **Only concepts were taken from the notebooks.** Their example targets (for example "kappa of at least 80%", "200+ failed queries", "75-80% faster first token") are not Ask Regs facts and are never used.

**Status key:**
- **Proven:** a committed artifact exists now.
- **Partial:** some proof exists, and the plan item finishes it.
- **Planned:** no proof yet.
- **Declined:** out of scope on purpose, with the reason.

**How to keep this current (any assistant):** when a plan item lands, change its row's status, link the artifact, and add or update the bank ID. Never mark a row Proven without a committed file.

---

## A. AI product skills

| Skill | What it means, plainly | What an interviewer asks | Ask Regs proof (plan item → artifact) | Website section | Status | Bank ID |
|---|---|---|---|---|---|---|
| **Eval design and error analysis** | Look at real failures first, sort them into causes, and only then build tests that measure the causes users care about. | "How did you decide what to measure? Show me your failure categories." | 26 cases / 201 checks, expected changes kept apart from regressions (live); day-1 diagnosis C1-C6 (`PORTFOLIO-PLAN.md` 4c); 2.4 miss taxonomy → `pilot/WEEK1-REPORT.md` | 4, 7 | Partial | P-ASK-03; P-ASK-07 after 2.4 |
| **The four eval types** (Torres) | Code checks first, then known-answer sets, then an AI judge only where judgment is needed, plus user signals. | "Why did you use a rule here and a judge there?" | Code checks: fit check, refusal rules, citation enforcement (live). Known-answer: goldens, 3.1 retrieval labels. Judge: 5.2. User signals: votes + 2.6 behavior signals. Inventory in `EVAL-METHOD.md` (1.7). | 4 | Partial | (after 1.7) |
| **Retrieval versus generation** | Did the search find the right passage (recall@k, MRR), and separately, did the written answer stick to it (faithfulness, completeness)? | "Your answer was wrong: was it search or writing?" | Phase 3 → `RETRIEVAL-EVAL.md`; 5.1 → `CLAIM-SUPPORT.md` | 4 | Planned | P-ASK-02 (blocked until Phase 3) |
| **LLM judge and human alignment** | An AI grader is only useful once you've checked it against expert human grades and know where it's wrong. | "How do you know your judge is right? What biases did you check?" | 52% exact faithfulness agreement on 25 replies (`model-compare-grading.csv`, evidence log D12); 1.1 kappa → `JUDGE-CALIBRATION.md`; 5.2 binary-criteria judge re-run | 6 | Partial | P-ASK-06 |
| **Guardrails: missed refusals vs over-refusal** | Track both errors: risky questions that slip through, and safe questions refused for no reason. | "How do you trade safety against usefulness? Show both numbers." | 5/7 bypasses found → 10/10; live gaps found and fixed same day, live suite 15 of 15, 14 look-alike guards, 2 stored rows purged (PRs #24, #25); over-caution fixes 4.3 | 4, 8 | Partial | P-ASK-05, P-ASK-08 |
| **Production monitoring** | Log every real interaction (a "trace") so you can review it, count failures and spot trends. | "What do you log? What did the logs make you change?" | Usage log, caps, owner stats (live); 2.2 week-1 report | 7, 8 | Planned | (after 2.2) |
| **Cost economics** | Know the cost of one useful answer, what drives it, and when caching or a cheaper model is worth it. | "What does one good answer cost? Why this model?" | 1.4 → `COST-ECONOMICS.md`; 1.5 → `CONTEXT-VS-RAG.md`; D12 trade; 1.2 proposed model memo MODEL-DECISION.md | 6 | Planned | (after 1.4) |
| **Experiment discipline** (Torres) | Baseline first, change one thing, re-run **all** evals, keep a record of each variant so you can roll back. | "How do you know the fix didn't break something else?" | Held release: 5 regressions, 4 fix rounds (evidence log); 1.8 experiment registry → `EXPERIMENTS.md`; 4.2-4.4 | 5 | Partial | P-ASK-04 |
| **Agent design** | An AI that chooses tools, within a budget, with a visible trace and a clear rule for when to stop. | "How do you stop it looping? How did you evaluate it against something simpler?" | Phase 6 → `AGENT-EXPERIMENT.md` | 9 | Planned | (after Phase 6) |
| **Source freshness and drift** | Notice when the source changes, find which answers it affects, re-test them. | "What happens when the regulation changes?" | Phase 7 → `FRESHNESS.md` (worked example: §685.203) | 8 | Planned | (after Phase 7) |
| **Governance and model card** | Write down what the system uses, stores, refuses and can't do, and who approves releases. | "What do you not store? Who can see the AI output?" | D13 logging choices, owner-only AI (live); 0.5/0.6 → `RELEASE-GATE.md`; model card (Phase 8) | 8 | Partial | (after 0.5) |
| **Fine-tuning** | Training a model on your own data. | "Why didn't you fine-tune?" | **Declined:** grounding and verbatim citation matter more than style here, and retrieval keeps every answer traceable. This decision *is* the answer. | 11 | Declined | n/a |
| **A/B testing** | Splitting live traffic between versions. | "Did you A/B test?" | **Declined:** a handful of testers can't support it. We use before/after on held-out questions instead, and say why (1.6). | 11 | Declined | n/a |

## B. Product leadership skills

| Skill | What it means, plainly | What an interviewer asks | Ask Regs proof | Website section | Status | Bank ID |
|---|---|---|---|---|---|---|
| **Strategy and the first slice** | Pick the thinnest release that does the whole job end to end, and decide what to defer. | "What did you not build first, and why?" | Public citation lookup first, AI explanation owner-only (D1, D7) | 2 | Proven | P-ASK-01 |
| **The four risks** (Cagan) | Value, usability, feasibility, and viability/trust: retire each risk before scaling. | "Which risk worried you most?" | Refusals, staged imports, owner-only AI, pilot; table in Phase 8 section 2 | 2 | Partial | (with website) |
| **Continuous discovery** (Torres) | Talk to users and watch them work, regularly, and let that change the plan. | "What did users change about your plan?" | Pilot feedback (USER-FEEDBACK-LOG); 2.5 task observations; 4.5 tester release notes | 7 | Partial | (after 2.5) |
| **Outcomes over outputs** | Measure what users can now do (verified a rule, faster), paired with a quality guardrail, not features shipped. | "What changed for users, and what kept quality from slipping?" | 2.5 observed tasks (verified source, time); paired with refusal and retrieval numbers | 7 | Planned | (after week 2) |
| **What a small pilot can prove** | Usability, feasibility and real failure modes, yes. Retention or business impact, no. | "Aren't you over-claiming from a few users?" | Honesty rules (plan section 10); `x of n` with intervals (1.6) | 7, 11 | Partial | n/a |
| **Prioritization by impact** | Fix the causes that cover the most real misses; say what you won't do. | "Why these fixes and not others?" | Phase 4 picks top 2-3 causes by count; declined A/B, fine-tuning, jury (plan section 3) | 7 | Partial | (after Phase 4) |
| **Directing builders without authority** | Set the rules and context so builders (here, AI coding agents) make the right calls; review everything. | "How did you work with the agents? What did you catch?" | `AGENTS.md` rules, handoffs, 25 reviewed PRs, decision log with who proposed and who chose | 10 | Proven | (none yet; claim boundary only) |
| **Decisions under trade-offs** | Choose with incomplete facts, write down why and what would reverse it. | "Defend a decision you'd make differently now." | Decision log D1-D13; model choice D12; proposed MODEL-DECISION.md (1.2); held release | 5, 6 | Proven | P-ASK-04, P-ASK-06 |
| **Show, don't tell** | Open a real artifact in the interview and walk through it. | "Show me." | The case-study page, built from committed files (Phase 8) | all | Planned | n/a |

## C. Resume bullet rules (settled 2026-10-04)

- **Shape (PM notebook):** problem or tension → what Tirath did and the method → result with a number, plus the quality guardrail.
- **Verbs:** Tirath's career protocol wins over the notebook. Plain verbs (built, held, chose, found, cut, fixed, decided). **Not** "architected, orchestrated, spearheaded, leveraged". 22 to 28 words. A real number, or an honest non-numeric result.
- **Credit:** Tirath directed AI agents. Never claim he wrote the code.

*Product Manager: Tirath Chhatriwala*
