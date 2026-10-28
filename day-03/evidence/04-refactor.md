# Day 3: pricing extraction implementation evidence

## Changed paths

- `app/app.js`
- `app/domain/pricing.js` (new)
- `Codex & Coffee/Day-03-production/evidence/04-refactor.md` (this record)

The existing `number`, `percent`, `cents`, and `calculateQuote` function text was moved without body or arithmetic changes. The domain exports `number`, `percent`, and `calculateQuote`; `cents` stays private. The facade imports all three exports and re-exports `calculateQuote`. The obsolete first-line comment was updated. No dependencies were introduced.

Before editing, scoped `git status --short -- app.js domain/pricing.js` and `git diff -- app.js` produced no output. A pre-edit copy and SHA-256 hashes of existing app files were captured outside the app at `/var/folders/pg/67wkhdcs7t75b_1_277g0n3r0000gn/T/quote-studio-refactor-j_bi29j4/`. A final Python comparison verified the moved text exactly, allowing only the two newly added export prefixes. It also verified that all remaining app text equals the baseline except the planned removal, wiring, and header correction. All protected existing app-file hashes matched, including tests, fixtures, HTML, CSS, package, server, and guidance.

## Executed code checks

Working directory: `app`.

```sh
git status --short -- app.js domain/pricing.js
git diff -- app.js
npm run check
```

Before extraction: `npm run check` passed app syntax and all 27 unchanged tests, with zero failures. After extraction: the same command passed app syntax and all 27 unchanged tests, with zero failures. Tests still import `app.js`.

```sh
node --check domain/pricing.js
node --input-type=module -e 'import assert from "node:assert/strict"; import { calculateQuote as facade } from "./app.js"; import { calculateQuote as domain, number, percent } from "./domain/pricing.js"; assert.strictEqual(facade, domain); assert.strictEqual(number("2.5"), 2.5); assert.strictEqual(percent(101), 100); console.log("Facade/domain identity and helper smoke checks passed");'
```

Both passed with exit status 0. The smoke check printed `Facade/domain identity and helper smoke checks passed`. The scoped diff was reviewed: removal of the four original definitions, import/re-export wiring, and the optional header correction only. The new domain contains no imports, DOM/storage access, mutable application state, or dependencies.

### Corrected command failure

The initial Python edit script contained an unmatched parenthesis. Python rejected it before executing any writes. The shell continued: `npm run check` passed the unchanged baseline again; `node --check domain/pricing.js` and the identity smoke command failed with module-not-found because the new file did not yet exist. The script was corrected, the extraction performed, and both checks rerun successfully as recorded above. This was an execution mistake, not an application regression; no test or expected result was changed to obtain a pass.

## Browser execution and observed results

```sh
npm start
PORT=43987 npm start
```

The first command failed with `EADDRINUSE` for `127.0.0.1:4323`, where a server was already running. The second started this app successfully at `http://127.0.0.1:43987`. The existing 4323 origin was only inspected; it already had one saved proposal and was not used for storage changes. Chrome verification used the separate 43987 origin, which initially displayed **0 saved**.

Observed on the isolated origin:

- Seeded UI loaded: subtotal $12,750.00, total $13,687.13, deposit $4,106.14, balance $9,580.99, margin 40.1%.
- Opened scenarios and applied 0%, 10%, then 5%. Displayed net fees/margins were $12,750.00 / 43.1%, $11,475.00 / 36.8%, and $12,112.50 / 40.1% respectively.
- Saved the restored 5% quote. The UI confirmed saving and showed one saved proposal at $13,687.13.
- Edited first quantity to 3, first rate to 1700, first internal cost to 1000, tax to 10%, and deposit to 50%. The UI updated to subtotal $14,650.00, net $13,917.50, tax $1,391.75, total $15,309.25, deposit $7,654.63, balance $7,654.62, and margin 39.3%.
- Added and removed a fourth service. Clearing Client disabled both Save quote and Export proposal.
- Reloaded. The earlier saved proposal remained at $13,687.13. The unsaved draft edits were discarded and seeded fields/totals rendered again.
- Clicked Open for the saved quote. The expected replace-draft confirmation appeared. Attempting `getJsDialog().accept()` timed out in the browser control (`Emulation.setFocusEmulationEnabled`). Reopening is therefore not claimed as completed here.

## Verification boundary

The requested extraction, unchanged regression checks, domain syntax, direct facade identity, and file-scope checks passed. Browser integration was partially verified as above. This implementation stage did **not** complete reopen confirmation, new/reset confirmation checks, downloaded-proposal inspection, or independent export rendering. No claim of full browser verification or export privacy verification is made from this stage. The parent chat reported separate baseline browser checks and will perform final browser verification; those results are not treated as this stage's own executed evidence.

No application behavior deviation was introduced. The operational deviations were the corrected edit-script syntax error, the occupied default port, and the browser confirmation timeout. No commits, publication, test edits, extra chats, agents, or messages to other chats were performed by this stage.
