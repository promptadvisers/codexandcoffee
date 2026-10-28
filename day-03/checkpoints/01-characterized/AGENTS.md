# Quote Studio working guidance

- This is a self-contained fictional teaching app. Read `PRODUCT-BRIEF.md`, `docs/behavior-contract.md`, `docs/architecture.md`, and `test/pricing.test.mjs` before a pricing change.
- Use Node.js 20 or newer. No dependencies or install step are needed. Run commands from this directory.
- For the planned extraction, change only `app.js` and new `domain/pricing.js`. Move the existing calculator and `number`/`percent`/`cents` helpers unchanged. Export `number`, `percent`, and `calculateQuote` from the domain module; keep `cents` private.
- In `app.js`, import those three exports and re-export `calculateQuote`. Keep every UI call site working through the imports. Keep the guarded `boot()` call.
- Preserve exact output shape, cents, rounding order, coercion, unsupported-input errors, row order, non-mutation, and all behavior characterized by the tests. Do not fix quirks during extraction.
- Leave UI, validation, storage, export, `index.html`, `style.css`, `server.mjs`, `package.json`, tests, and fixtures unchanged in this slice. Keep `codex-coffee-quote-studio-v1`, labels, saved records, and export privacy intact. Do not add frameworks or dependencies.
- Before and after implementation run `npm run check` (syntax plus the unchanged Node tests). After creating the domain file also run `node --check domain/pricing.js` and confirm the facade and domain export the same calculator function. Tests must continue importing `app.js`.
- Run `npm start` and open `http://127.0.0.1:4323` for browser verification: seeded totals, 0/5/10% scenarios, editing, save/reopen, and exported HTML. Verify the download excludes internal costs and margin. Use a disposable browser profile for storage checks.
- Record actual command and browser results separately from planned checks. Node tests do not verify DOM behavior, persistence, export privacy, or rendered output.
- Other work may be present. Preserve others' edits; review a scoped diff and never use a broad reset or cleanup. Roll back only your extraction changes. Do not commit, publish, or expand scope without authorization.
