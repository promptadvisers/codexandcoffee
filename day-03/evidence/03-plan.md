# Day 3: bounded pricing extraction plan

## Planning evidence and status

Read the demo's `PRODUCT-BRIEF.md`, `docs/behavior-contract.md`, `test/pricing.test.mjs`, `app.js`, `package.json`, `README.md`, and `server.mjs`, plus `01-audit.md` in this evidence directory.

The audit identifies the correct pure seam and shared-normalization dependency. Its suggested root-level `pricing.js` is superseded here by the requested `domain/pricing.js`. Its zero-test result is historical: the prepared characterization suite now exists. During this planning chat, `node --test` and then `npm run check` both passed **27 tests**, including five deterministic property checks over 64 bounded inputs each; the latter also passed the `app.js` syntax check. This is baseline evidence, not proof of a completed extraction or of browser behavior.

This chat completes only the architecture and plan documents. It does not implement the extraction, edit tests, perform browser verification, or complete a production migration.

## Allowed paths

All app-relative paths below are under `app/`.

- This planning chat writes only `docs/architecture.md`, `AGENTS.md`, and `Codex & Coffee/Day-03-production/evidence/03-plan.md` (this file).
- The subsequent implementation slice may change only `app.js` and create `domain/pricing.js`.
- Read but do not edit `test/pricing.test.mjs`, `test/fixtures.json`, and `docs/behavior-contract.md` for verification. No UI, storage, validation, export, HTML/CSS, server, package, framework, or dependency changes belong in this implementation slice.

## Exact incremental sequence

1. Inspect current `app.js` and the scoped working-tree diff immediately before implementation. Other work is happening; preserve any intervening changes. Capture its pre-extraction contents outside tracked app files for a selective rollback. Run `npm run check` from the app directory and record the actual baseline result. Stop and investigate if the baseline fails.
2. Create `domain/pricing.js`. Copy `number`, `percent`, `cents`, and `calculateQuote` exactly from `app.js`. Add exports to `number`, `percent`, and `calculateQuote`; keep `cents` private. Change no function body, formula, default, coercion, or rounding order.
3. Replace those four definitions in `app.js` with `import { number, percent, calculateQuote } from './domain/pricing.js';` and `export { calculateQuote };`. Keep all existing calculator and helper call sites. Keep seed data, state, `valid()`, formatting, DOM code, storage, export, events, and `if(typeof document!=='undefined')boot();` unchanged. A short baseline header comment may be corrected to reflect the extracted pricing module.
4. Review the diff before testing. It should contain only the new pure module, removed original definitions, facade wiring, and the optional header correction. Check that the domain has no imports or browser/global-state access and that the UI does not retain duplicate helpers.
5. Run the checks below without editing tests or expected fixtures to obtain a pass. Inspect actual results; do not treat commands merely listed here as executed.
6. Run the browser checks below and record their outcomes in the follow-up implementation evidence. If any required check is unavailable, report that gap and do not describe the whole slice as verified.

## Invariants to review

- The facade keeps the public `calculateQuote(input)` export. `number` and `percent` are imported for existing UI normalization; `cents` remains an internal domain helper.
- Exact result/row shape, numeric cents, one-decimal margin, row order/IDs, fresh containers, and non-mutation survive.
- Unit cents precede row multiplication/rounding; discount precedes net; tax uses net; deposit uses total including tax. Negative margins and zero-net margin behavior survive.
- `Number()` coercion, non-finite handling, clamping, fractional quantities, missing/non-array items, and characterized unsupported-input `TypeError`s survive unchanged.
- Storage key/records, UI validity, visible text, scenario behavior, confirmation paths, and export privacy survive. Existing quirks remain outside scope.

## Commands and browser checks

Run from the app directory:

```sh
npm run check
node --check domain/pricing.js
node --input-type=module -e 'import assert from "node:assert/strict"; import { calculateQuote as facade } from "./app.js"; import { calculateQuote as domain, number, percent } from "./domain/pricing.js"; assert.strictEqual(facade, domain); assert.strictEqual(number("2.5"), 2.5); assert.strictEqual(percent(101), 100);'
npm start
```

`npm run check` executes `node --check app.js && node --test`; the unchanged tests exercise the public facade. The separate import command checks domain loadability in Node and facade identity. It supplements, rather than replaces, the regression suite.

Use `http://127.0.0.1:4323` in a disposable browser profile/origin without overwriting valuable saved quotes:

- Confirm no module-load error and correct seeded rendering: subtotal $12,750.00, cost $7,250.00, total $13,687.13, deposit $4,106.14, balance $9,580.99, margin 40.1%.
- Open and apply 0%, 5%, and 10% scenarios. Net fees are $12,750.00 / $12,112.50 / $11,475.00; margins are 43.1% / 40.1% / 36.8%.
- Edit quantity, rate, internal cost, tax, and deposit; check totals and controls still update. Exercise add/remove service and the existing validity gates without adding new rules.
- Save, reload, and reopen a disposable quote on the same origin; confirm fields and totals survive. Check new/reset confirmations and that reset retains saved quotes.
- Download and open the proposal HTML. Verify client, scope, quantities, public amounts, tax, total, deposit, and balance. Inspect the actual file for absence of internal costs and margin, including the seeded $7,250.00 internal total. Confirm it opens independently with readable layout.

The Node suite bounds known pricing behavior. Browser checks cover this slice's integration; they are not comprehensive storage-failure or UI coverage.

## Rollback and completion

If the extraction introduces a failure, revert only its import/re-export and function-removal hunks in `app.js`, restore the captured original four definitions, and remove only the newly created `domain/pricing.js` if no other work depends on it. Preserve concurrent edits and these planning records. Rerun `npm run check` to confirm the original baseline is restored. Do not use a repository-wide reset, clean, or unqualified checkout.

The implementation slice is complete when its scoped diff is reviewed, unchanged pricing tests pass, facade/domain checks pass, and the browser checks have actual recorded results. Future storage adapters, view modules, export modules, state separation, validation changes, bug fixes, and production hardening require separate plans. This slice establishes only a pricing boundary within the teaching application.
