# Day 3 Quote Studio: audit before extraction

## Scope and evidence

This is the deliberately tangled teaching baseline at `app/`. The authoritative requirement for this audit is `PRODUCT-BRIEF.md`: separate pricing arithmetic from UI and storage while preserving the public `calculateQuote(input)` output, rounding order, storage key, labels, and flows. This report describes the source as inspected; it does not propose a broader product redesign.

Read: `PRODUCT-BRIEF.md`, `README.md`, `app.js`, `index.html`, `style.css`, `package.json`, and `server.mjs`. Source references below are relative to that demo directory and use the original baseline line numbers.

Read-only checks completed:

- `node --check app.js` and `node --check server.mjs`: passed
- `node --test`: completed successfully but discovered **zero tests**; this is not regression coverage
- Imported `calculateQuote` from `app.js` in Node and evaluated the example, three discount scenarios, fractional rounding, zero net fees, coercion, and missing items; results are recorded below

No browser flow, actual localStorage write, downloaded HTML, or rendered layout was exercised. Those behaviors are source-inspected, not end-to-end verified. No app files, tests, dependencies, or publication state were changed for this audit.

## What already works

The core arithmetic is already a pure seam. `calculateQuote(input)` (`app.js:8–18`) reads its argument and returns numeric results without reading the DOM, localStorage, or module-level `quote`. Its helpers `number`, `percent`, and `cents` (`app.js:5–7`) are also pure. The guarded `boot()` call (`app.js:70`) makes a Node import possible without a browser.

The source implements the requested product path:

- `boot()` binds project, client, brief, discount, tax, deposit, service, and internal-cost inputs (`app.js:55–56`). `renderLines()` supplies the service and cost editors (`app.js:34–37`; their containers are in `index.html:14–16`).
- `updateTotals()` displays quote totals and delivery margin (`app.js:25–33`). `renderScenarios()` recalculates the same scope at 0%, 5%, and 10% discounts; applying one updates the draft (`app.js:38–40,59`).
- `saveQuote()` clones the current quote, adds a date, replaces a saved entry with the same ID, and writes it locally. Opening clones the saved entry back into the editor (`app.js:47,60`). The storage key is exactly `codex-coffee-quote-studio-v1` (`app.js:2`).
- `exportProposal()` builds a standalone HTML document with inline styling and downloads it using a Blob URL (`app.js:48–51`). Its template explicitly selects client-facing scope, quantities, amounts, discount, tax, total, deposit, and balance. It does not serialize the full quote or include internal cost or margin. User text is HTML-escaped through `escapeHtml()` (`app.js:20,49`). This privacy boundary is visible in the template, although an actual downloaded file still needs verification.

The example calculation returned subtotal **$12,750.00**, internal cost **$7,250.00**, discount **$637.50**, net fees **$12,112.50**, tax **$1,574.63**, total **$13,687.13**, deposit **$4,106.14**, balance **$9,580.99**, and margin **40.1%**. The 0% / 5% / 10% scenarios returned net fees of **$12,750.00 / $12,112.50 / $11,475.00** and margins of **43.1% / 40.1% / 36.8%**.

## Where responsibilities are coupled

| Boundary | Concrete coupling | Consequence for an extraction |
| --- | --- | --- |
| Pricing and UI | Pure pricing lives in the same module as DOM startup. `updateTotals()` both calculates and writes labels, money, margin styling, validation state, and scenario cards (`app.js:25–33`). | Move the arithmetic without rewriting this orchestration. A new formula or different return shape affects several surfaces. |
| Shared normalization | `number()` and `percent()` serve both the calculator and editor validation, display, and event handling (`app.js:23,29,35–36,39,55–56`). | They cannot simply disappear from `app.js` when the calculator moves. Preserve their behavior through explicit imports. |
| Draft state and rendering | Module-level `quote`, `saved`, and `dirty` (`app.js:4`) are accessed directly by renderers, validators, export, storage actions, and event listeners. `renderLines()` calls `updateTotals()`, which calls `renderScenarios()`. | A seemingly local rendering change can alter notification timing, focus, validation, or scenario refresh. These are outside the smallest arithmetic extraction. |
| Pricing and persistence | `renderSaved()` calls `calculateQuote(q)` for each stored quote instead of displaying a stored total (`app.js:41–44`). | Any pricing change also changes the apparent value of previously saved quotes, without changing their stored records. |
| Persistence and UI | `storeSaved()` reads the global saved array and reports failures through the DOM. `saveQuote()` owns cloning, dating, replacement, persistence, rollback, status, and rendering (`app.js:46–47`). `boot()` also parses and filters storage (`app.js:53`). | Storage is not an independent adapter. Extracting it now would enlarge the lesson and introduce additional failure-path changes. |
| Pricing and export | `exportProposal()` validates global state, recalculates, formats escaped HTML, creates a download, schedules cleanup, and notifies the user (`app.js:48–51`). It pairs items and calculated rows by array index. | Preserve row order and keep the explicit public-field template. Reusing a whole internal result object in the proposal could expose cost data. |

`style.css` owns layout and presentation; `index.html` supplies the IDs and labels consumed by the script. `server.mjs` is a local static-file server, not a pricing or storage backend. Neither needs to change for the proposed extraction.

## Behaviors that must survive the move

1. **Rounding happens in a particular order.** The calculator first rounds a nonnegative unit rate or unit cost to cents, then multiplies by the normalized quantity and rounds each row. It sums rows, rounds the discount on subtotal, rounds tax on net fees, then rounds the deposit on the tax-inclusive total (`app.js:9–17`). A rate of `0.014` and quantity `3` produces **3 cents**, not the 4 cents that rounding only after multiplication would produce. Margin uses net fees before tax and is rounded to one decimal place.
2. **Normalization is part of the contract.** `number()` uses `Number()`, maps non-finite values to zero, and clamps negatives to zero. `percent()` additionally caps at 100. Numeric strings and fractional quantities are accepted. IDs become strings; row order and duplicate IDs are retained. Missing or non-array `items` becomes an empty list. This is not comprehensive input validation: null input or a null item can still throw. Do not silently broaden or tighten the accepted input domain during a file move.
3. **The return shape includes internal data.** Preserve `rows` with `id`, `amount`, and `cost`, plus `subtotal`, `cost`, `discount`, `net`, `tax`, `total`, `deposit`, `balance`, and `margin`. Monetary values are cents; margin is a percentage number. At 100% discount, the example keeps its internal costs but returns `net: 0` and `margin: 0`, not a negative or undefined margin.
4. **UI validity is different from calculator permissiveness.** `valid()` requires trimmed project and client names, at least one item, and a nonblank service name with positive normalized quantity (`app.js:23`). A zero-priced service can still be saved or exported. Input `step` attributes do not enforce calculator precision. Preserve the distinction rather than adding new calculator rejection rules.
5. **Existing UI and storage quirks are observable behavior.** Editing a service name calls `updateTotals()` but not `renderLines()`, so its internal-cost label stays stale until a full rerender (`app.js:36,56`). Saving rolls back the in-memory saved list on write failure, but deleting does not (`app.js:47,61`). A storage-read error notice survives the initial `syncFields()` and `renderSaved()` calls because neither path clears notices; an edit later clears it through `setDirty()` (`app.js:24,53–56`). These are existing behaviors to document, not fixes to fold into an arithmetic extraction.
6. **Draft transitions and public presentation stay intact.** Opening, starting, and resetting have different confirmation/status paths (`app.js:60,64,66`). Scenarios show net fees, while the main headline and saved list show totals including tax. CAD formatting stays in `money()` (`app.js:19`); HTML escaping and download behavior stay in export. Keep the storage key, saved record shape, labels, and confirmation text unchanged.

## Smallest useful refactor

Create a dependency-free `pricing.js` containing the existing `number`, `percent`, `cents`, and `calculateQuote` implementations without arithmetic edits. Export `number` and `percent` for the existing UI call sites; keep `cents` private if nothing else needs it. In `app.js`, import the shared helpers and calculator, and re-export `calculateQuote` so existing imports from `app.js` still work. Leave draft state, DOM rendering, validation, storage, export, CSS, HTML, and event wiring in place.

This gives pricing its own importable boundary without pretending the entire application has been decoupled. The next staged work should characterize the current calculator before moving it, then run the same checks against the extracted implementation and preserved `app.js` export. High-value cases include the example, exact return shape, fractional rounding, coercion and clamping, empty items, zero net fees, and negative margins. Separately verify save/reopen and the downloaded proposal in a browser, including absence of internal costs. Tests can bound these known behaviors; neither a few examples nor a clean test exit proves universal equivalence.

No refactor or tests were implemented in this audit stage.
