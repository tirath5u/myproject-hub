# Project rules

- Regulation lookups (eCFR, Federal Register, Regulations.gov) run server-side in `/api/ed-source-desk/*` via `src/lib/ed-source-desk.server.ts`; keys never reach the client — keeps DATA_GOV_API_KEY secret and refusal rules un-bypassable.
- Golden eval cases live in `src/data/ed-source-desk/goldens.ts`; the pass badge only shows real published results — never compute percentages client-side.
