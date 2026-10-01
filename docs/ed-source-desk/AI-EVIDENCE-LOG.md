# Ask Regs: AI evidence log

Owner: Tirath Chhatriwala (product manager and decision-maker). Updated with each phase. Last update: 2026-10-01 (Volume 7 complete).

This log records what was built, the decisions Tirath made, and the measured results, so resume and interview claims can be checked against real artifacts: pull requests, test files, and eval runs. Every number below comes from a recorded run or a commit.

**How the work was done (say this plainly):** Tirath defined the product, wrote or approved the requirements, reviewed results on screen, and made every release decision. AI coding agents wrote the code under his direction: Claude Code (the pull requests on GitHub) and Lovable (hosting, database, deploys). Tirath did not hand-write the code.

---

## 1. What Ask Regs is

Ask Regs is a public tool at myproduct.life/ask-regs. It answers U.S. federal student aid questions with the **official source text, quoted word for word, with a link to the exact passage**. It never generates an answer by itself. It refuses questions it shouldn't answer, such as ones about a specific student, tax advice, or private membership content. It labels every result honestly as an answer, a partial answer, or related reading.

Sources it covers:
- eCFR regulations
- the Federal Register
- Regulations.gov
- the 2026-27 FSA Handbook: Volume 3 Chapter 1, and all of Volume 7, Chapters 1 to 6 (Pell Grants)

On top of this sits an **owner-only AI explanation**. It turns the cited passages into plain English, and it is checked so that every point names its source.

## 2. Timeline

| Date | Phase | What changed |
|---|---|---|
| 2026-09-28 to 29 | Stage 1 (with Lovable) | Regulation lookup and refusals, topical-fit check, first handbook chapter (Vol 3 Ch 1) with meaning + word search, answer/related rules |
| 2026-09-30 | Eval runner and Stage 2A plan | 18-case routing eval (18 of 18 on its first independent live run); handoff document for the next stage |
| 2026-09-30 | Stage 2A (PRs #1 to #7) | Staged import pipeline; Vol 7 Ch 2 imported, reviewed and promoted; fixes found by evals and by manual review |
| 2026-09-30 | Stage 2B + AI (PRs #8 to #10) | Vol 7 Ch 3 imported, reviewed and promoted; owner-only AI explanation with citation enforcement |
| 2026-10-01 | Red-teaming and model comparison (PR #17) | Adversarial suite found 5 of 7 refusal probes getting through; rules fixed and locked by tests. Owner-only model comparison with rubric grading by a judge model. First run (preview): Gemini 2.5 Flash 14/14 source-check passes, all first try; judge scores faithfulness 5.0, completeness 3.71, clarity 5.0; 0 unsupported claims. GPT-5 mini rejected a request setting (temperature) on every call; fixed in PR #18 for the re-run. Adversarial suite 10/10 on preview after the fixes |
| 2026-09-30 to 10-01 | Volume 7 batch (PRs #11 to #15) | Chapters 1, 4, 5, 6 imported as staged (76 passages); preview evals caught 5 regressions before release; general ranking fixes |

## 3. Evidence by skill area

### Retrieval-augmented generation (RAG) and search design
- **Embeddings and search:** passages are embedded with `google/gemini-embedding-2` (3,072 dimensions) and searched exactly by vector, not approximately.
- **Hybrid retrieval:** meaning search is paired with plain word search. Word-search matches can't turn a result into an answer on their own.
- **Ranking:** heading-aware ranking. A chapter's topic words (e.g. "Pell" in 8 of 10 headings) are ignored so sections don't tie on them (PR #2).
- **Section identity:** sections are keyed by document version plus heading, so two chapters' "Introduction" sections never merge.
- **Artifacts:** `src/lib/ed-source-desk.server.ts`, `src/lib/handbook-lookup.ts`, `AGENTS.md`.

### Grounding and hallucination prevention
- **Verbatim display:** passages are shown word for word, with a text-fragment link to the exact spot on the official page.
- **Topical-fit check:** a citation must contain the question's distinctive terms, so a section number alone can't "validate" an unrelated answer.
- **Fictional-amount guard:** the handbook's example amounts ($7,500 / $750) are made up. Passages that contain them are flagged, never given as the answer to an amount question, and always shown with a warning (Stage 2A).
- **AI explanation checks:** every bullet must cite a source ID. A reply that cites an unknown source, leaves a claim uncited, or states a dollar amount found only in fictional examples is discarded after one retry (PR #8; `src/lib/explain.ts`).

### Evaluation
- **Eval suites:** 26 cases and 201 automated checks. Stage 1 routing and refusals: 18 cases, 122 checks. Stage 2A Pell: 6 cases, 61 checks (58 before the Chapter 3 expected-change checks were added). Stage 2B Chapter 3: 2 cases, 18 checks. (Corrected 2026-10-01: earlier versions said 198.)
- **Review workflow:** new cases start as `candidate-unreviewed` and become `reviewed` only after Tirath checks them on screen.
- **Expected changes:** intended behavior changes are recorded as *expected changes*, not hidden (for example, U09 moving from "definition only" to a handbook answer).
- **Per-assertion results:** results are exported per assertion, with latency and embedding-token cost. HTTP 200 never counts as correctness.
- **Offline CI:** unit tests (64 as of PR #15) and fixture validation run on every pull request with no network calls.
- **Artifacts:** `tests/evals/*.json`, `tests/evals/run-live-evals.mjs`, `tests/unit/`, `.github/workflows/ci.yml`.

### Human-in-the-loop release management
- **Staged release:** new content imports as `staged`. It's visible only on preview builds, and it goes live only after a named `promote` (Stage 2A).
- **Safety of the live site:** the published site kept working unchanged while unreviewed content sat in the shared database.
- **Import checks:** an import refuses to write unless structural checks pass. For chapters without a reviewed manifest, it also requires the content fingerprint from the dry-run.
- **Result:** three promotions (Vol 7 Ch 2; Ch 3; Ch 1, 4, 5 and 6 together), with zero regressions on the live site. The batch was held on preview through four fix rounds until every suite was clean.

### Responsible AI and safety
- **Refusals:** student-specific eligibility, individual tax advice, private or vendor-internal content.
- **Owner-only AI:** the AI explanation is owner-only (token checked on the server) and deliberately not public.
- **Secrets:** API keys stay on the server. The admin token was set by the owner, not shown by any tool.

### Working with AI coding agents
- **Handoff:** a written handoff with goals, constraints, and live-safety rules drove each phase.
- **Rules file:** a project rules file (`AGENTS.md`) keeps agents consistent between sessions.
- **Review loop:** each change arrived as a reviewed pull request with a description, tests, and a verification section. Tirath merged, published, and ran the checks through Lovable.

## 4. Decision log (Tirath's calls)

| # | Decision | Options considered | Chosen, and why |
|---|---|---|---|
| D1 | Answer with official text, not AI-written answers ("no AI guessing") | Generative answers vs retrieval with citations | Retrieval with verbatim citations. In financial aid, a wrong confident answer is worse than "no confident citation". |
| D2 | Assume preview and the live site share one database | Verify first vs design for the worst case | Designed for the worst case: a `staged` status, a promote gate, and a live lookup that excludes staged rows. (From the Stage 2A handoff Tirath commissioned and approved; later confirmed true.) |
| D3 | U09 answered by the wrong section | Widen the test to accept it, or fix the search | Fix the search (PR #2). Widening the test would hide a wrong answer. (Recommended by Claude; Tirath approved.) |
| D4 | U10 and U21 over-claimed "complete" | A per-question list of known gaps, loosen the tests, or a general rule | General rule: answers that word search helped find are always "partial" (PR #3). Lovable suggested the per-question list; Tirath chose the general rule (Claude's recommendation) because it scales and keeps test questions out of the product. |
| D5 | Human review before approval | Trust the automated tests vs review on screen | Reviewed on screen. This caught two display issues the automated tests passed (distorted tables; a confusing message for amount questions), and revealed that the first review had been done on the live site instead of the preview (Tirath had published after each merge; the live site correctly hides staged chapters). Claude first misdiagnosed this as the preview address not being recognised (PR #5, harmless extra hardening); the real cause was the review environment. Lesson: confirm which environment you are on before reviewing. |
| D6 | Order of release steps | Promote then publish, or publish then promote | Publish the new code first, then promote content. Old live code would have merged sections incorrectly. |
| D7 | Scope of the AI explanation | Public vs owner-only | Owner-only for now. Public later needs usage limits, cost control, and a quality record. |
| D8 | Model provider for the explanation | New Anthropic key vs Lovable's built-in gateway | Built-in gateway (Gemini 2.5 Flash): no new keys, and it can be switched later. (Claude's default; Tirath accepted.) |
| D9 | How strict the AI check should be | Loosen it vs keep it strict and fix the cause | Kept the strict rule and allowed only lead-in lines followed by cited points (PR #10), after two explanations were rejected. |
| D10 | Next priority | Improve the AI explanation vs more chapters | More chapters and housekeeping first; the evidence log now. |
| D11 | Batch import broke 5 answers on preview (U08, U09, U21, U25, U30) | Promote anyway, drop the new chapters, or fix the search | Held the release and fixed the causes generally: volume-level topic words, numbered variants (Formula 1-4) must each be covered, and off-program volumes excluded (PR #12). (Lovable recommended not promoting; Tirath agreed; Claude wrote the fix.) |

## 5. Measured results (2026-09-30)

- **Live evals after both promotes:** Stage 2A 6 of 6 (58 of 58 checks); Stage 2B 2 of 2 (18 of 18); Stage 1 17 of 18 with 0 regressions (U09 is the one expected change).
- **Content:** Vol 7 Ch 2 has 15 passages (3,656 embedding tokens to import). Vol 7 Ch 3 has 13 sections and 19 passages (4,838 tokens).
- **Lookup speed and cost:** median lookup latency of about 0.5 to 0.7 seconds on preview. About 119 embedding tokens per 6-question eval run.
- **AI explanation:** 1,276 to 3,197 tokens per explanation. The check rejected 2 explanations before PR #10, and none of the tested ones after it.
- **Delivery:** 16 pull requests merged over two days (2026-09-30 to 10-01), each with unit tests and CI passing. (Corrected: earlier versions said 10 or 11 in one day.)
- **Volume 7 complete (live 2026-10-01T04:45Z):** Stage 2A 6 of 6 (61 of 61 checks), Stage 2B 2 of 2 (18 of 18), Stage 1 17 of 18 with 0 regressions (U09 the one expected change); all 12 golden cases pass. Median lookup latency on the live site about 0.66 to 0.73 seconds.
- **Volume 7 batch (preview, staged):** Ch 1 11 passages, Ch 4 42 (13 tables, 13 examples), Ch 5 15, Ch 6 8; 21,506 embedding tokens to import. Before the fix: Stage 2A 2 of 6 and Stage 1 15 of 18 on preview (5 regressions), all caught before release. After PR #12: 1 regression left (U21) plus a weak U10 answer. PR #13 fixed U10 but its volume-wide topic rule caused a new U21 regression on preview; PR #14 rolled that rule back and fixed U10 at answer choice instead (prefer the eligible answer covering more of the question; "complete" only if the answer itself covers every term). Lesson: a fix that helps one case can quietly break another — the eval suite caught it before release. PR #14 still left U21 failing; instead of a third guess, a diagnostic run printed the shortlist scores and the stored section's wording, which showed "Basic Pell Grant Formulas" never names Formula 1-4. PR #15: named formulas now decide completeness, not relevance. (Diagnose with data before fixing — decision by Claude, run by Lovable at Tirath's request.)
- **Published eval badge:** fresh live run 2026-10-01T00:01:35Z, all 12 golden cases passed (12 of 12), now shown on the page.
- **CI caught a dependency break:** a routine package security update (applied through Lovable) changed a router type and failed the typecheck in CI before it could ship; fixed in PR #13.

## 6. Resume bullets you can use truthfully

Edit these to your voice. Each is backed by the sections above.

- Led the build of **Ask Regs**, a retrieval-augmented (RAG) tool that answers federal student aid questions only with verbatim, cited official sources. Directed AI coding agents (Claude Code, Lovable) through 10 reviewed pull requests in one day.
- Designed a **two-layer evaluation program**: 26 automated cases and 201 checks, covering routing, answer labeling and a fictional-amount guard, plus on-screen human review that caught display issues the automated checks passed.
- Introduced a **staged release with a human approval gate** (import, preview review, promote). Shipped all six chapters of the Pell volume in three releases with zero regressions on the live site, holding one release through four rounds of eval-driven fixes.
- Shipped an **owner-only LLM explanation with citation enforcement**: every point must cite a retrieved source, and replies with invented sources, uncited claims or fictional amounts are automatically discarded.
- Made and documented **AI product trade-offs**, for example rejecting a test change that would have hidden a wrong answer, and choosing a general "partial answer" rule over per-question exceptions.

## 7. Don't claim

- **Writing the code by hand.** Say you led, designed, specified, reviewed, or directed.
- **Answer correctness proven by the evals.** The automated checks verify sources and labels; correctness came from your on-screen review.
- **Real users, adoption, or business impact.** There is no usage data yet.
- **Training, fine-tuning, or building models.** The project uses existing models through APIs.

## 8. Evidence gaps still open, and what would fill them

| Common AI PM requirement | Status | What would fill it |
|---|---|---|
| Graded answer quality (rubric or LLM-as-judge) | Partial: judge scores recorded for Gemini 2.5 Flash; owner grading and agreement pending (PR #17) | Judge model scores faithfulness, completeness, clarity 1-5 against a written rubric; a grading sheet lets Tirath grade the same replies, and `--agreement` reports how often his grades match the judge's |
| Model comparison and selection | Partial: one model measured, second model re-run pending (PRs #17, #18) | 12 held-out questions + 3 probes through two models with the same source check; per-model pass rate, first-try pass, rubric scores, unsupported claims, tokens and latency |
| Cost governance | Partial (tokens measured) | Per-request cost log and a daily cap |
| Red-teaming and prompt injection | Partial → in progress (PR #17) | Adversarial suite written; first local check found 5 of 7 refusal probes slipping through (capitalisation, "my daughter"/"my student", vendor word order); fixed, with tests requiring no over-refusal of 41 legitimate questions. Preview run after the fixes: 10 of 10 probes pass (82 of 82 checks), with 0 regressions in the regular suites. |
| Production monitoring | Missing | Log lookups and explanation failures; a weekly quality summary |
| Users and outcomes | Missing | A few real users (e.g. FA colleagues), a feedback button, a usage count |

To map these to your own resume, paste your gap list and each gap will get a row here.
