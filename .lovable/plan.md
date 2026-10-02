# Ask Regs public-page feedback fixes

## What will change

- **Bring every result into view:** after a lookup finishes, scroll the answer, refusal, error, or no-match panel into view. Respect reduced-motion settings and place keyboard focus on the result summary without disrupting typing.
- **Lead with answer limitations:** show a prominent warning before the citation whenever the result is partial, the displayed excerpt is shortened, fictional example amounts are involved, or the exact official amount was not found. The warning will use the response’s existing status and wording rather than changing retrieval or source selection.
- **Make written feedback discoverable:** keep the Yes/No flow, add a clear “Optional comment after you rate” hint beside it, and retain the existing context-specific comment prompt after selection.
- **Remove public diagnostic badges:** remove the model-cost and evaluation badges from the top of `/ask-regs`. Replace the public test-panel badge/date chrome with plain, accurate copy explaining that the archived checks test routing, not answer correctness.
- **Fix the reported page warning:** render stored dates in a server/client-stable format so the current hydration warning no longer appears.

## Validation

- Test answer, refusal, partial/truncated, and fictional-amount result states on desktop and mobile widths.
- Confirm the result automatically becomes visible after submitting a question.
- Confirm Yes and No still save feedback, including an optional comment.
- Confirm the public page contains no `$0 model cost` or `Eval … pass` badge.
- Run the focused tests and check the current preview for build, console, and runtime errors.

## Scope

No lookup logic, source ranking, database behavior, daily limits, promotion state, or publishing will change. The uploaded screenshots are not required because the ticket and current page reproduce all four issues.
