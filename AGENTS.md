# Project rules

- Regulation lookups (eCFR, Federal Register, Regulations.gov) run server-side in `/api/ed-source-desk/*` via `src/lib/ed-source-desk.server.ts`; keys never reach the client — keeps DATA_GOV_API_KEY secret and refusal rules un-bypassable.
- Golden eval cases live in `src/data/ed-source-desk/goldens.ts`; the pass badge only shows real published results — never compute percentages client-side.
- Phase 2 library tables `documents`/`chunks` are server-only (RLS on, no anon/authenticated grants, service_role only) — visitors never read or write content directly.
- Chunk embeddings use `google/gemini-embedding-2` at 3072 dims (`chunks.embedding vector(3072)`); changing model means re-embedding everything. HNSW needs a `halfvec(3072)` cast index (vector index limit is 2000 dims).
- Pilot retrieval uses exact vector search (no approximate index) on `chunks.embedding`; each chunk's `citation_ref` = human label + official URL text-fragment locator — keeps citations traceable to the source page.
- Every free-text citation must pass a topical-fit check (question's distinctive terms present in cited text; numbers/generic words excluded; keyword-guessed sections need 0.8, user-named numbers 0.6) — stops section numbers or broad keywords validating unrelated questions.
- Ask Regs searches imported handbook chunks read-only via `match_chunks` (service_role only, exact search, similarity ≥ 0.74 + fit check) and shows passages verbatim with award year — no AI explanation.
