# Day 3: start here

Theme: **Rescuing a Vibe-Coded App**. You do not need Days 1 or 2.

## Watch and inspect

1. [Open the finished app](https://promptadvisers.github.io/codexandcoffee/day-03/). Change a discount and explore pricing scenarios.
2. Open `Day-03.pptx` in PowerPoint.
3. Open `Day-03.excalidraw` in [Excalidraw](https://excalidraw.com): top-left menu → Open. Five sections each include separate document examples.
4. Read `evidence/` for the actual audit, test, plan, refactor and verification results.

## Run it yourself

Install Node.js 20 or later from nodejs.org if needed. Download and unzip the Day 3 ZIP. Open the **app** folder in Codex. In its terminal run:

```sh
npm start
```

Open http://127.0.0.1:4323 in your browser. Keep the terminal running. In another terminal in the app folder:

```sh
npm test
```

Expected: **27 tests pass**. No `npm install` needed. Stop the server with Ctrl+C. If port 4323 is busy, stop the other copy first or choose a port: `PORT=4325 npm start` on Mac/Linux; `$env:PORT=4325; npm start` in Windows PowerShell. Saved quotes are local to each browser origin.

## Follow the five stages

| Stage | Starting copy | Result to inspect |
| --- | --- | --- |
| 1. Audit | A fresh copy of `checkpoints/00-working-spaghetti/` | `evidence/01-audit.md` |
| 2. Characterize behavior | The same pre-test working copy | 27 reference tests in `checkpoints/01-characterized/test/` |
| 3. Plan | A copy with your tests, or `checkpoints/01-characterized/` | `docs/architecture.md` and `AGENTS.md` |
| 4. Extract pricing | A fresh copy of `checkpoints/01-characterized/` | Compare with `app/domain/pricing.js` and `app/app.js` |
| 5. Verify | Keep the untouched before copy beside the finished app | `evidence/05-verification.md` and `06-browser-verification.md` |

`PROMPTS.md` has the exact compact replay prompts shown in the slides. Work in copies so the reference checkpoints stay intact. The supplied architecture and guidance in checkpoint 01 let you resume directly at extraction. Re-running planning is optional.

From the **Day 3 directory**, compare the provided copies:

```sh
node verify-refactor.mjs checkpoints/01-characterized app
```

Expected: JSON ends with `"status": "passed"`. It runs the unchanged tests in both copies, compares eight literal cases and 1,000 bounded cases, and checks protected files. This is sampled evidence, not proof for every possible JavaScript input.

## Browser success check

- Seed: CAD 13,687.13 total, CAD 4,106.14 deposit, 40.1% margin
- 10% discount: CAD 12,966.75 total, 36.8% margin
- Save, reload, then Open: the saved values return after confirmation
- Export proposal: download HTML and open it; internal costs and margin are absent
- New quote: empty client and zero total; Reset example restores the seed

The prepared tangled app is fictional. The refactor is real. Existing rounding quirks were deliberately preserved. The example is not tax or accounting advice.
