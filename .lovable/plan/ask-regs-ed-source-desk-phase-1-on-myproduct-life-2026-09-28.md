# Ask Regs (ED Source Desk) — phase 1 on myproduct.life

## Where it goes on your page

```text
Nav:  Tools | AI Work (new) | Process | Work | How I think | [Open the calculator]

Home page order:
  Hero
  Proof strip
  My Tools          <- add 4th tile "Ask Regs" (Live · Beta)
  AI Work  (NEW)    <- "AI in RegTech" section, sits right after Tools
  Process / Engine
  For developers
  Proof of work
  How I think
  Footer            <- add "Ask Regs" link
```

- **New "AI Work" section on the home page** (title: "AI in RegTech — grounded, cited, refuses when it should"). It shows a 3-step roadmap so visitors see where this is heading:
  1. **Cite** (live now): ask a question, get the official regulation and a link. No AI model, $0 per question.
  2. **Search the handbooks** (next): FSA Handbook, PDFs, and guidance searchable by meaning.
  3. **Explain** (later): an AI answer that must quote its citations, and refuses otherwise.
  Plus one button: "Try Ask Regs".
- **New page `/ask-regs`** (the full tool). The name "ED Source Desk" appears as the subtitle.

## The Ask Regs page

1. **Top:** "Ask Regs — search, cite, official link." Badges: "$0 model cost" and "Eval 12/12 pass".
2. **Search box** with example chips (e.g. "Satisfactory academic progress", "§668.22 return of funds", "Is Jane Doe eligible for Pell?").
3. **Answer card:** the citation ID (in monospace), section title, a short excerpt, when it was fetched, and an "Open official source" button. If the question is about a specific student, private tips, or tax advice, a neutral **refusal card** explains why and points to the school's financial aid office / StudentAid.gov.
4. **Test results panel:** the 12 test questions, which should be answered vs refused, expected citations, and the pass badge with the run date. This is your "I test my AI" proof.
5. **How it works strip:** Browser → our server → eCFR / Federal Register / Regulations.gov → citation back. Your key never touches the browser.
6. **Footer note:** sources and "citations are the source of truth".

## Backend — you don't need to set one up

This site can already run server code, so the lookup lives inside this same project (at `/api/ed-source-desk/lookup`). No separate server, no database, no extra hosting for phase 1. eCFR and Federal Register need no key; only Regulations.gov uses your data.gov key.

## What I need from you

1. **Your data.gov API key** — after you approve, I'll open a secure form; paste it there (never in chat). Stored as `DATA_GOV_API_KEY`, server-only.
2. **The two golden files** (`ed-source-desk-v1.json` and `ed-source-desk-v1-results.json`) — paste them in chat. Until then I'll show the 4 cases named in the brief and mark the panel "full set loading"; the 12/12 badge only appears once the real results file is in.

## Phase 2 later (not built now)

Supabase (Lovable Cloud) + pgvector for handbooks, Firecrawl to collect FSA pages, then an AI "explain" step through the built-in AI gateway. The page and section are designed so these slot in as new steps without a redesign.

## Technical details

- `src/routes/api/ed-source-desk/lookup.ts`: POST server route, Zod-validated `{ q }` or structured `{ mode, ... }`. Ports `detect_refuse` + routing from cite.py: `§?668.xx` → eCFR XML (`/api/versioner/v1/full/{latest_issue_date}/title-34.xml?section=`, date from titles API), FR doc numbers → `federalregister.gov/api/v1/documents/{n}.json`, `ED-…` → `api.regulations.gov/v4/documents/{id}` with key, else FR search (agency: education-department, per_page 3). Returns the contract shape (citation_id, title, source_url, text capped ~30KB, truncated, fetched_at, content_hash via crypto.subtle, refuse fields). Upstream errors surfaced with status.
- `src/routes/api/ed-source-desk/goldens.ts`: GET returning static JSON from `src/data/ed-source-desk/`.
- `src/routes/ask-regs.tsx`: page with own head() meta; UI caps displayed text at ~6KB; basic XML→text stripping server-side.
- `src/routes/index.tsx`: add Ask Regs tool tile (grid to 2x2), new `#ai-work` section, nav + footer links.
- AGENTS.md: record "regulation lookups run server-side in /api/ed-source-desk; keys never in client".
