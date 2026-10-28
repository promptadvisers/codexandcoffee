# Day 3 replay prompts

Use a fresh copy of the appropriate checkpoint. These compact learner prompts reproduce each task; production chats also included local output paths and file ownership. Run the stages in order.

## audit

Read PRODUCT-BRIEF.md and inspect app.js. Map the quote calculation to its UI, saved-quote, scenario and export callers. Identify one safe extraction boundary and behavior risks. Do not edit files. Return findings with file references.

## tests

Before refactoring, characterize calculateQuote in app.js. Add literal fixtures for the seeded quote, rounding and discounts. Check normalization, output shape, row order, input mutation and errors. Run the tests against the existing app. Do not change application code.

## plan

Read the business brief, behavior contract and tests. Plan one pricing extraction into domain/pricing.js while preserving the app.js entry point. Document allowed files, forbidden changes, checks and rollback. Write focused AGENTS.md guidance. Do not implement the refactor.

## extract

Follow AGENTS.md and docs/architecture.md. Move the existing pricing functions into domain/pricing.js unchanged. Keep app.js callers and its calculateQuote export working. Do not edit tests, UI, storage or export behavior. Run the unchanged checks and report the scoped diff.

## verify

Compare checkpoints/01-characterized with the final app. Run the unchanged tests and check function identity, protected files and bounded pricing examples. Separately verify totals, scenarios, save/reopen and exported proposal privacy in the browser. Report evidence, gaps and the next safe step.

## fresh

Read PRODUCT-BRIEF.md, docs/behavior-contract.md and docs/architecture.md. Audit how pricing handles a zero-value quote. Inspect only the relevant pricing module, its caller and tests. Do not change code. Report current behavior, evidence and any unanswered question.
