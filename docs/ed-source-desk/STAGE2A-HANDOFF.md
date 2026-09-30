# Stage 2A handoff: Pell Volume 7 Chapter 2 (for the next coding session)

Written 2026-09-30 by a local Claude Code session after auditing this repo and the official page. Read `AGENTS.md` first. Do not publish the site, make the repository public, or commit keys, raw response archives, employer material, or full handbook text.

## Goal

Import the official 2026-27 FSA Handbook Volume 7, Chapter 2, "Calculating Pell Grants," into the existing `documents` and `chunks` tables. Show its passages in Ask Regs with correct labels, and prove this with evaluations. Then, only if each gate passes: Stage 2B (Volume 7 Chapter 3) and the private, owner-only AI explanation.

- Source: https://fsapartners.ed.gov/knowledge-center/fsa-handbook/2026-2027/vol7/ch2-calculating-pell-grants
- Reviewed extraction summary (metadata only, no text): `docs/ed-source-desk/vol7-ch2-2026-27-review-manifest.json`

## What the audit found

### The page can be fetched directly
A plain server `fetch` with the existing `UA` string returns HTTP 200 (about 90 KB). No Firecrawl is needed. Fetch once per import and never on a schedule.

### The page structure (Drupal), verified 2026-09-30
- The chapter body is inside `div.field--name-field-chapter-content` and ends at `</article>`. Everything outside it (menus, table of contents, footer, "Previous" and "Next") is site chrome.
- The body is a flat sequence of `div.field__item` blocks. Each block's type is in its class `paragraph--type--X`:
  - `header`: `<span id="pid_NNN" class="fsa-header-if-h2|h3|h4">` wraps the heading text. **Split sections at h2 and h3.** Keep h4 (for example "Dependent Student" and "Poverty Guidelines") as an inline sub-heading line inside its h3 section. That gives the 10 sections in the review manifest.
  - `paragraph`: text, `<ul><li>` lists (each item wraps nested field divs), and `<table>` with `thead` and `tbody`. There are 4 tables with 8 and 7 rows.
  - `callout` with `card fsa-card information-callout`: the three worked examples. Their first line is `<strong>Volume 7, Chapter 2, Example N: Title</strong>`.
  - `callout` with `important-callout`: notes, including the fictional-amount note ("Examples in this volume use fictional maximum ($7,500) and minimum ($750) ... should not be used in packaging").
  - `accordion`: the margin citations. The title is in `h3.mb-0` and the body is, for example, "HEA Sec. 401(b)(1)(A)". Render these as `Margin note: <title>` followed by the body, which is the Volume 3 format.
  - `_5-75-container`: two-column layout used by "Step 1:" through "Step 4:" in the Calculated Pell order of operations. Keep each label and its text together on one line.
- The text before the first header block is the introduction. It names the Scheduled Award inputs, which is the key passage for U09.
- Timestamp block: `Last Modified: 08/21/2026 (bullet) Published: 08/25/2023`. The 2023 date is the page's first-published date, **not** the 2026-27 release. Store it separately, never as the award-year release date.

### Chunking rules
- One chunk per section. Each example gets **its own chunk** whose heading is the example title (so `/\bExample \d+/` still matches). The rule paragraphs between and after examples stay in rule chunks with the parent section heading, as later pieces of the same section.
- Chunk `text` begins with its heading line, matching the Volume 3 rows. Continuation pieces don't repeat the heading.
- Store `is_example` and `fictional_amounts` flags. `fictional_amounts` is true for each example and for the section holding the note. The warning is shown **outside** the quoted passage; never prefix it into `text`.
- Don't force a chunk count. The review estimated 10 sections, or about 13 chunks with split examples.
- Match the existing keys: `document_version_key = fsa-handbook:2026-27:vol7:ch2:<last-modified YYYY-MM-DD>:<first 12 of sha256>`. Then `citation_ref` = label, the same separator the Volume 3 rows use, and the official URL with a `#:~:text=` fragment of the heading. Encode commas and hyphens.

### Defects in the current server code that Stage 2A will trigger
1. **Sections are keyed by heading alone.** `handbookSearch` builds `sectionText` as a `Map` keyed by `heading`, and ranking, dedupe, and "first piece" all compare headings. Volume 7 Chapter 2 has an "Introduction", and so does Volume 3 Chapter 1 (ordinal 1). Their text would merge across chapters. Key everything by `document_version_key + heading`.
2. **Row cap.** `match_current_chunks` limits results to 100 rows. The code asks for 500 and uses the whole list for word search. That's fine at 43 + ~13 rows, but word search will silently lose sections as the corpus grows. Raise the cap in a new function.
3. **Hard-coded coverage text.** `handbook_coverage` says "Vol 3 Ch 1 only". Build it from the documents actually returned.
4. **Hard-coded "look next" skip.** `lookNext` skips Volume 3 Chapter 1 as "this chapter". Make it skip the passage's own chapter and treat imported chapters as passages, not volume index links. Volume 7 also writes "Chapter 3 of this volume", which the current pattern misses.

### Live-safety: assume the database is shared
Assume preview and the published site read the **same** Lovable Cloud database. This was not verified, so treat it as true. The published code calls `match_current_chunks(embedding, award, count)` and shows every current-year row. **Rows inserted for Volume 7 would appear on the live site immediately, before review, and would hit defect 1.** Therefore:
- Import new documents with a new `source_status` value, `staged`. The migration must add it to the check constraint.
- In the same migration, change the **existing** `match_current_chunks` to exclude `staged`, `superseded`, and `withdrawn` rows. The published code keeps working and never sees staged rows.
- Add `match_current_chunks_v2(query_embedding, award, match_count, include_staged boolean)`. It returns the new flag columns and `page_published_date`, caps at 500, and is granted to `service_role` only. Preview code calls v2 with `include_staged = true` and falls back to v1 if v2 doesn't exist yet. Merging to `main` updates the preview before anyone applies the migration.
- Add a `promote` action that changes `staged` to `in_force` after Tirath approves publishing. Never promote automatically.
- Also add `chunks.is_example`, `chunks.fictional_amounts`, and `documents.page_published_date`. Backfill `is_example` for existing rows from `heading ~ 'Example [0-9]+'`.

### How the import runs (no public ingestion endpoint)
Lovable doesn't run new migration files, and the service key isn't in Git. Build:
- A pure parser, `src/lib/handbook-parse.ts` (no `@/` imports, no network), plus a source registry, `src/data/ed-source-desk/handbook-sources.ts`. The registry holds the URL, award year, volume and chapter, and the **expected checks**: 10 sections, 4 tables with rows 8 and 7, 3 examples, the fictional note present, and the "Step 1" to "Step 4" labels. The import refuses to write if any check fails.
- A server importer, `src/lib/handbook-import.server.ts`: fetch, parse, check, batch-embed with `google/gemini-embedding-2` (the existing gateway call, 3072 dimensions verified), upsert the document as `staged`, and replace its chunks. Reuse an embedding when the chunk text hash is unchanged. It is idempotent.
- A route, `POST /api/ed-source-desk/admin/import`: `Authorization: Bearer <ED_SOURCE_DESK_ADMIN_TOKEN>` compared timing-safely (copy the pattern in `src/integrations/supabase/cron-auth.ts`). Actions are `dry-run` (a manifest with counts and hashes, no text, no writes, no embedding), `import`, and `promote`. With no token configured it returns 404.
- The one Lovable action for Tirath: apply the migration, set the secret, and call `dry-run`, then `import`, on preview.

### Behavior to add in lookup
- Handbook passages carry `is_example`, `fictional_amounts`, `document_title`, `page_published_date`, and a `warning` string when fictional. Fall back to heading or text detection when the columns are missing.
- For a question asking for the actual maximum or minimum Pell amount, a passage with fictional amounts is never the answer. An example chunk is only ever related. The response must say that official amounts are published separately and not taken from handbook examples.
- The UI shows the fictional-amount warning outside the quote, and labels the 2023 date as "FSA page first published," not as a release date.

## Stage 2A evaluation (candidate cases; Tirath reviews before they become goldens)
New suite `tests/evals/stage2a-pell-cases.json`, marked `"status": "candidate-unreviewed"`:
- U09 "What inputs determine a student's scheduled full-time Pell Grant award?": expect a Volume 7 Chapter 2 passage (introduction or "Scheduled Award, Award Year, and Annual Award"), with the 690.2 definition allowed. **This intentionally changes the Stage 1 U09 expectation** (definition-only). Record it as an expected change, not a regression.
- U08 "Does a low Student Aid Index by itself establish eligibility for the maximum Pell Grant?": expect a Maximum Pell eligibility criteria passage.
- U26 "Under the applicable OBBBA rules, what happens to Pell eligibility when nonfederal scholarships equal cost of attendance and the student has a low SAI?": expect partial or related, never complete.
- U10 "How is a payment-period Pell amount affected when enrollment intensity differs from full time?": expect related only (Chapter 3 holds the calculation).
- U21 "How does a school select Pell Formula 1, 2, 3, or 4 for a program?": expect partial or related ("Basic Pell Grant Formulas").
- NEG "What is the maximum Pell Grant amount for the 2026-27 award year?": no passage showing $7,500 or $750 may be the answer. Every passage containing them must have `fictional_amounts: true` and a warning.
- Rerun all 18 Stage 1 cases on preview after the import. Record U09 as the one expected change.

Extend `tests/evals/run-live-evals.mjs` with kinds for these checks. Export pass or fail per assertion, latency, and cost (embedding tokens if the gateway reports them; otherwise "unavailable"). Never count HTTP 200 as passage correctness.

## CI (pull-request checks, no network)
Add `.github/workflows/ci.yml` running `bun install --frozen-lockfile`, `bunx tsc --noEmit`, `bun test tests/unit`, and fixture validation. Unit tests use a **small synthetic HTML sample** in the page's structure, not a copy of the handbook. Local-only (not CI): a parser check against the live page that prints counts and hashes only.

## Environment notes
- `bun` is the package manager (`bun.lock`). The baseline `bunx tsc --noEmit` passed on 2026-09-30.
- A cloud session may not have network access to fsapartners.ed.gov or eCFR. If so, build and test against the synthetic sample, state that the live parse was not run, and leave the live check for the local or Lovable step.

## Reporting
After each milestone, report: the branch and PR, the files changed, what ran locally, what ran on preview versus live (kept separate), the measured results, the gaps, the cost, and the single next action.

Product Manager: Tirath Chhatriwala
