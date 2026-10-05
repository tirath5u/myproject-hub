# Ask Regs cost economics, item 1.4

Status: proposed list-price model, checked 2026-10-06. This is not a Lovable invoice or a forecast of public AI usage.

## Decision this supports

The public Ask Regs route cites official material and does not generate an answer. Its variable model charge is the query embedding when handbook search runs. The AI explanation is owner-only and adds generation cost. Tirath's Flash choice was made against a measured speed and token difference, with a human-rated quality concession recorded in [MODEL-DECISION.md](MODEL-DECISION.md). This memo turns those observations into a cost range rather than claiming a bill we cannot see.

## Inputs and dated list prices

| Input | Recorded observation or source |
|---|---|
| Handbook lookup | About 119 embedding tokens across a six-question eval run, or 19.83 per question in that small run. Not every lookup necessarily embeds, and this is not a production mean. [Evidence log](AI-EVIDENCE-LOG.md). |
| Explanation comparison | Mean total tokens per answered comparison: Flash 2,209, GPT-5 mini 3,948. Input and output are not separately saved in the comparison summary. Median response time: 2.1 vs 21.9 seconds. [Evidence log](AI-EVIDENCE-LOG.md). |
| Gemini Embedding 2 text | $0.20 per million input tokens, standard paid tier. [Google price page](https://ai.google.dev/gemini-api/docs/pricing). |
| Gemini 2.5 Flash text | $0.30 per million input tokens and $2.50 per million output tokens, standard paid tier. [Google price page](https://ai.google.dev/gemini-api/docs/pricing). |
| GPT-5 mini text | $0.25 per million input tokens and $2.00 per million output tokens, standard API list price. [OpenAI model page](https://developers.openai.com/api/docs/models/gpt-5-mini). |

These are the providers' published rates checked on 2026-10-06, not a verified Lovable Gateway charge. Hosting, database reads, government-source traffic, retries, caching, credits and any gateway markup are excluded. Free-tier allowances are not assumed.

## Unit economics from the evidence available

Cost equals input tokens times input rate plus output tokens times output rate, each divided by one million. The usage log records embedding tokens for a lookup and total AI tokens for an explanation or comparison, but not separate input and output tokens. Therefore a precise per-explanation dollar value cannot be derived from the committed data. Applying the two endpoint rates to all observed tokens gives a mathematical range, not a likely price:

| Operation | Conditional list-price estimate | What is missing |
|---|---:|---|
| One handbook query embedding at 19.83 tokens | $0.00000397 | Six-question sample only; actual lookup mix and retries. |
| One Flash explanation at 2,209 total tokens | $0.000663 to $0.005523 | Input/output split, retry count, actual gateway rate. |
| One GPT-5 mini explanation at 3,948 total tokens | $0.000987 to $0.007896 | Same gaps. |
| One two-model comparison | At least the two explanation components; their combined list-price interval is $0.001650 to $0.013419 before judging | Judge model calls and tokens, input/output splits, retries. Do not quote this as the comparison price. |

The output-heavy endpoint is deliberately broad. Token count alone does not prove Flash costs less in dollars: GPT-5 mini has lower published rates per token, while Flash used fewer tokens. The quality and speed trade remains valid; the dollar trade stays conditional until priced usage is split by token type.

## 10,000 queries a month: projection, not current traffic

Scenario A, 10,000 handbook lookups with the six-question mean of 19.83 embedding tokens each and no AI explanation: roughly 198,333 embedding tokens, or $0.04 at Google's text embedding list price. Some questions use eCFR or other routes and may not embed, so this is an illustrative volume assumption, not a measured month. Infrastructure and upstream API costs remain unknown.

Scenario B, 10,000 lookups plus one Flash explanation per lookup at the comparison-run mean: embedding about $0.04 plus generation between $6.63 and $55.23, giving a conditional range of about $6.67 to $55.27 before infrastructure, gateway differences, retries and safety checks. This is a stress scenario, not the current owner-only product design. The corresponding GPT-5 mini generation range is $9.87 to $78.96, plus the same illustrative embedding $0.04. These intervals overlap, so they cannot support a definitive provider-cost ranking.

A more relevant operating measure is cost per useful cited answer: total lookup, explanation, retry and judge spending divided by the number of human-verified useful answers. The current logs do not establish that denominator. Item 2.2 and the pilot task observations can provide it.

## Next measurement

Export a non-sensitive usage sample with model name, input tokens, output tokens, retry count, embedding tokens, route and whether the citation was useful. Reconcile it with the Lovable credit ledger or invoice. Price one lookup, one successful explanation, one failed explanation and one full comparison including judge calls. Keep provider list rates and actual billed rates in separate columns. Tirath decides whether the observed cost and quality support keeping Flash.
