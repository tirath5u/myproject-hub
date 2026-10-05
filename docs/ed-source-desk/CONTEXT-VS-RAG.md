# Ask Regs long context versus retrieval, item 1.5

Status: proposed decision memo. No long-context implementation or traffic experiment was run.

## Recommendation

Keep the current cited retrieval path for public Ask Regs. A full Volume 7 prompt is technically feasible, but it changes the product from selecting an official, versioned passage to asking a model to identify and explain the right passage inside a large context. That is a different answer and citation risk. If later evals show retrieval misses are the main failure and a cached full-context challenger improves expert-reviewed answers, test it owner-only against the same blind set before considering a change. Tirath makes that decision.

## The comparable input

The evidence log records Volume 7 Chapter 2 at 3,656 embedding tokens, Chapter 3 at 4,838, and the staged Chapters 1, 4, 5 and 6 at 21,506. Their sum is 30,000 embedding tokens. This is a useful order-of-magnitude proxy for a full-volume prompt, not an exact Gemini generation-token count. It excludes instructions, question, citation metadata, any other handbook volume, and output.

Current retrieval embeds a question, filters to the 2026-27 award year, finds versioned chunks, applies program and topical-fit rules, and exposes official quotations. It can still miss the right section or rank related text ahead of the answer. Full context would avoid a search miss within the included volume, but would still need the model to select the right rule and award year.

## Economics at a common scale

On 2026-10-06, Google's published Gemini 2.5 Flash standard rates were $0.30 per million input tokens, $0.03 per million cached input tokens, $1.00 per million cached tokens per hour of storage, and $2.50 per million output tokens. [Pricing](https://ai.google.dev/gemini-api/docs/pricing); [caching behavior](https://ai.google.dev/gemini-api/docs/caching). These are provider list prices, not verified Lovable Gateway charges.

For a 30,000-token full-volume prefix, an uncached request has about $0.009 of input cost before the question and output. Ten thousand identical-size requests would be about $90 of prefix input. A perfect cached hit would be about $0.0009 per request, or $9 for 10,000 reads, plus cache storage. Holding 30,000 tokens for a continuous 720-hour month would add about $21.60 at the published storage rate, before creation, refresh and other tokens. Real hit rate, TTL, context-cache access through this gateway, tokenization and award-year updates are unverified. A missed cache returns toward the uncached figure.

The recorded six-question lookup run averaged 19.83 embedding tokens per query. At Google's $0.20 per million text embedding tokens, 10,000 such embeddings would be about $0.04 in list-price model usage. This is not the total cost of RAG: database search, ingestion, passage tokens sent to an explanation model, retries and infrastructure are excluded. The current public citation route has no generated output; a full-context answering route would add output tokens and their price. Thus $0.04 versus $9 is not a complete apples-to-apples product bill. See [COST-ECONOMICS.md](COST-ECONOMICS.md) when item 1.4 lands.

## Product controls

| Question | Current retrieval | Full-volume model context |
|---|---|---|
| Speed | Public lookup has a recorded roughly 0.5 to 0.7 second median on prior preview runs. | No Ask Regs measurement. More input may add latency; caching may help, but this cannot be claimed without a run. |
| Citation | Each returned chunk carries a human label, source URL and text-fragment locator; the public result quotes it verbatim. | The model must choose a passage and produce a reference. A source-ID checker alone cannot prove that its interpretation or location is right. |
| Award year | Query filter selects current 2026-27 content, while earlier versions stay stored. | A cache must be rebuilt and invalidated when sources or award years change. Mixing years in one prompt creates a selection burden. |
| Failure mode | Can miss or misrank a relevant section, which can be measured by recall at k and reviewer labels. | Can attend to the wrong part of the included text or synthesize rules incorrectly; needs claim-level human review and an explicit cite oracle. |
| Scope | The public product cites or refuses; owner-only explanation is separate. | A whole-volume generative answer would cross the current public boundary. |

## What would change the recommendation

First label a fresh retrieval set with exact official answer sections and measure recall at k, top-rank correctness and false confident citations. Then run a full-context challenger on the same questions, same 2026-27 source version and human claim-level rubric. Record actual input/output tokens, cache hits, latency, failure cost and citation validity. Set the release bar before looking at results, and keep both variants owner-only during the comparison. A cheaper cached prefix alone is not a reason to weaken the citation boundary.

Tirath's product judgment is the decision to compare a simpler architecture against the real failure mode while keeping official passage traceability and award-year control intact. The experiment remains proposed.
