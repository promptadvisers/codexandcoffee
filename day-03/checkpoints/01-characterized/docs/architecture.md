# Minimal pricing extraction

## Status and boundary

This is the target for one behavior-preserving extraction in a prepared teaching app. At planning time, pricing still lives in `app.js`; this document does not certify that an extraction or a full production architecture migration is complete.

Read `../PRODUCT-BRIEF.md`, `behavior-contract.md`, and `../test/pricing.test.mjs` before changing the implementation. The tests import the existing public entry point in `app.js`.

## Target modules

```text
index.html -> app.js -> domain/pricing.js
                 |
                 +-> DOM, localStorage, HTML download (unchanged)

test/pricing.test.mjs -> app.js (preserved facade)
```

- `domain/pricing.js`: owns the existing `number`, `percent`, `cents`, and `calculateQuote` implementations. Export `number`, `percent`, and `calculateQuote`; keep `cents` private. Use no DOM, storage, formatting, network, mutable application state, or dependencies.
- `app.js`: imports `number`, `percent`, and `calculateQuote` for its existing call sites and re-exports `calculateQuote`. Retains draft state, seed data, UI validation, rendering, events, CAD formatting, HTML escaping, persistence, export, and the guarded `boot()` call.
- `index.html`, `style.css`, `server.mjs`, and `package.json`: unchanged. The existing ESM setup and static server can load the relative module without a build step.

Use this facade wiring at the top of `app.js`:

```js
import { number, percent, calculateQuote } from './domain/pricing.js';
export { calculateQuote };
```

Move the four existing function bodies without changing their arithmetic, coercion, names, or evaluation order. Remove their original definitions from `app.js`. Do not duplicate the normalization helpers: UI call sites must use the same implementations as pricing. Re-exporting the calculator preserves `import { calculateQuote } from './app.js'` for tests and other consumers. The facade remains a browser application module with its existing guarded startup; only the domain module is independent of browser setup.

## Invariants

- Preserve the exact result keys and their order: `rows`, `subtotal`, `cost`, `discount`, `net`, `tax`, `total`, `deposit`, `balance`, `margin`. Rows contain `id`, `amount`, `cost`. Money remains numeric cents; margin remains a percentage rounded to one decimal place.
- Preserve `Number()` coercion, non-finite-to-zero behavior, nonnegative normalization, and the 100% cap. Keep fractional quantities, stringified IDs, row order, duplicate IDs, fresh containers, and non-mutation.
- Round unit prices/costs to cents, then each multiplied row, then discount, then tax on net fees, then deposit on the tax-inclusive total. Margin excludes tax, can be negative, and is zero when net is zero.
- Preserve empty/non-array `items` behavior and the characterized `TypeError` cases for missing/null top-level input and explicit null/undefined items. Do not add defaults, validation, or new supported inputs.
- Preserve storage key `codex-coffee-quote-studio-v1`, stored records, labels, confirmations, UI validity rules, and all event/render paths. Preserve export's explicit client-facing field selection and exclusion of internal costs and margin.

The detailed contract and literal fixtures remain authoritative. Passing the bounded tests does not establish equivalence for every possible JavaScript input or verify browser flows.

## Completion boundary and later opportunities

This slice is complete only after the two-file implementation, unchanged regression suite, facade/domain checks, and browser checks described in the extraction plan have passed and actual results are recorded. Its result is one pure pricing module plus the existing application facade.

Possible later work includes separating storage, rendering, proposal generation, or application state, and characterizing their failure paths. Those require their own scope and evidence. Fixing stale cost labels, changing delete rollback, adding validation, changing money arithmetic, adopting a framework, or creating a backend is outside this slice.
