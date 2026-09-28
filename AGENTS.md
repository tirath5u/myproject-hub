# Project rules

- Regulation lookups (eCFR, Federal Register, Regulations.gov) run server-side in `/api/ed-source-desk/*` via `src/lib/ed-source-desk.server.ts`; keys never reach the client — keeps DATA_GOV_API_KEY secret and refusal rules un-bypassable.
- Golden eval cases live in `src/data/ed-source-desk/goldens.ts`; the pass badge only shows real published results — never compute percentages client-side.
- Phase 2 library tables `documents`/`chunks` are server-only (RLS on, no anon/authenticated grants, service_role only) — visitors never read or write content directly.
- Chunk embeddings use `google/gemini-embedding-2` at 3072 dims (`chunks.embedding vector(3072)`); changing model means re-embedding everything. HNSW needs a `halfvec(3072)` cast index (vector index limit is 2000 dims).
