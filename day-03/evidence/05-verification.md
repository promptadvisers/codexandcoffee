# Independent verification of the pricing extraction

Compared the final app with `checkpoints/01-characterized` on 2026-10-27 (America/Toronto). Read `PRODUCT-BRIEF.md`, `docs/behavior-contract.md`, `docs/architecture.md`, the unchanged tests and fixtures, and `evidence/04-refactor.md`. This pass owns only the verifier, this evidence, `context-scope.json`, and `docs/HANDOFF.md`. It does not edit implementation or existing tests.

## Executed checks

From the app directory, `npm run check` passed: app syntax and all **27 tests**, zero failures, skips or cancellations. The standalone command below also checked syntax and ran the unchanged 27-test suite separately in both directories, then checked domain syntax and direct facade/domain function identity. Runtime: Node v26.5.0.

```sh
node "verify-refactor.mjs" \
  "checkpoints/01-characterized" \
  "app"
```

Exit status: **0**. The verifier is dependency-free, accepts explicit before/after directories, writes JSON to stdout, and exits nonzero on a failed assertion. It does not write to either target. It checks:

- Byte equality and SHA-256 for HTML, CSS, server, package, existing tests and literal fixture file; the test file inventory is unchanged
- Exact text of `number`, `percent`, `cents`, and `calculateQuote`, allowing export placement only; the domain contains exactly these moved declarations
- All remaining facade text is unchanged except the import/re-export wiring and header comment
- The facade calculator is the same function object as the domain calculator; the domain exports precisely `number`, `percent`, and `calculateQuote`, keeping `cents` private
- Eight literal cases against the existing expected objects, independently for baseline, facade and domain: seed, three rounding fixtures, numeric strings and three discount scenarios
- **1,000 deterministic bounded inputs** using seed 20261027: **750 returns and 250 errors**, compared baseline to both facade and domain; input non-mutation checked after each call. Error comparison uses the error name, not engine-specific messages. The 250 errors are missing/null top-level inputs and explicit null/undefined array entries

The generated cases include zero to eight rows, bounded finite numbers from -10,000 through 10,000, numeric strings, booleans, null/undefined fields, non-finite values, percentages above and below bounds, empty/non-array items, duplicate/stringified IDs, and metadata. The formula is not copied into the verifier as an oracle. The eight literal expectations supply the fixed-output oracle; the 1,000 cases supply additional sampled comparison evidence.

## Failures and limitations

The first verifier run passed the baseline suite process but failed its own test-count parsing: Node 26 selected a non-TAP reporter, so `# tests` was absent. This was a verifier/reporting failure, not a pricing failure. The script now requests `--test-reporter=tap`; the subsequent complete run passed. No fixtures, expected outputs or application code changed to obtain a pass.

There were no observed pricing mismatches or protected-file changes. These checks do **not** prove equality for all JavaScript inputs. Symbols, BigInts, accessors, proxies, sparse arrays, arbitrary custom coercion, overflowing magnitudes and other exotic input behavior are not comprehensively exercised. This is one pricing extraction, not completion of a full architecture migration.

No UI/browser automation, localStorage operation, download, export-privacy inspection or rendered review was performed in this pass. The implementation evidence records partial browser checks and an unresolved reopen-confirmation timeout; the parent chat owns completion and documentation of final browser checks. Do not infer browser success from these Node results.

## Source context measurement

The baseline `app.js` contains **11,441 UTF-8 bytes / 11,427 Unicode characters**. The extracted `domain/pricing.js` contains **935 bytes / 935 characters**. The final facade contains **10,597 bytes / 10,583 characters**. Exact paths, hashes and definitions are in `context-scope.json`.

A future pricing-only source inspection can focus on the 935-byte file. This is a source-context comparison, **not billing tokens, actual model context usage, or token savings**. Contracts, tests, facade wiring and UI code remain relevant when the task crosses those boundaries.

## Exact verifier result

```json
{
  "node": "v26.5.0",
  "before": "checkpoints/01-characterized",
  "after": "app",
  "protectedFiles": [
    {
      "path": "index.html",
      "bytes": 4643,
      "sha256": "6b417a1ef4851631a194d74d719020401136a9d59582c1c396d451f51365c2e9"
    },
    {
      "path": "package.json",
      "bytes": 340,
      "sha256": "b712e462ca091d291fca2aa1197ee624f719b054dfe67843f70b0a1cb8c19f98"
    },
    {
      "path": "server.mjs",
      "bytes": 1017,
      "sha256": "30d834924d6b258403cc2aa9c79cbfb8202df7663416f1e890bc064035b2c557"
    },
    {
      "path": "style.css",
      "bytes": 9304,
      "sha256": "38e91427b918bbabdf392d8b3dae22eb25897433ca2489017265cc841944c4d8"
    },
    {
      "path": "test/fixtures.json",
      "bytes": 3352,
      "sha256": "5238196ec41197cd4f189692d3f771672120f65632aa7a5629e9da485f3b55c5"
    },
    {
      "path": "test/pricing.test.mjs",
      "bytes": 9753,
      "sha256": "279ba6ee45a15cec7d558224db44ce9be3a88ba21ee6c236d5d4e7bc19eebd45"
    }
  ],
  "commands": [
    {
      "directory": "checkpoints/01-characterized",
      "command": "node --check app.js",
      "status": 0
    },
    {
      "directory": "checkpoints/01-characterized",
      "command": "node --test --test-reporter=tap",
      "status": 0,
      "tests": 27,
      "passed": 27,
      "failed": 0
    },
    {
      "directory": "app",
      "command": "node --check app.js",
      "status": 0
    },
    {
      "directory": "app",
      "command": "node --test --test-reporter=tap",
      "status": 0,
      "tests": 27,
      "passed": 27,
      "failed": 0
    },
    {
      "directory": "app",
      "command": "node --check domain/pricing.js",
      "status": 0
    }
  ],
  "functionText": [
    {
      "name": "number",
      "sha256": "6e48076773b7e6148f17b982faf3eff192e88826664f3d5370f8da42818df1d4",
      "unchanged": true
    },
    {
      "name": "percent",
      "sha256": "f2d9332895128b2ab31fe7c1f6f2e5a54963311384610a3c8e7f53e758d09819",
      "unchanged": true
    },
    {
      "name": "cents",
      "sha256": "d3c0ed3b58de86e7eecfb3235fdb075be3be740d235d970a3713912c9b8b7e57",
      "unchanged": true
    },
    {
      "name": "calculateQuote",
      "sha256": "ad6652526b49338879a95ca63b76dda4804d2361fe52554470e21c9320b345bc",
      "unchanged": true
    }
  ],
  "literalCases": 8,
  "generatedCases": 1000,
  "generatedReturns": 750,
  "generatedErrors": 250,
  "sourceHashes": {
    "baselineApp": "9d2291b547d06dd35acd4e83549790df5c6b07603839d07b162ad7e8a2b9dfe1",
    "finalApp": "7aa3924262b00f1ddef0072141206f6b49398e58518d204c064fa79ff408bc30",
    "domain": "3a1001341ac9da3c0cf6d73ca805398ba7551b174ed82d24a8d2f231552db81e"
  },
  "domainContainsOnlyMovedFunctions": true,
  "remainingFacadeUnchangedExceptHeader": true,
  "facadeDomainIdentity": true,
  "generator": {
    "seed": 20261027,
    "maxRows": 8,
    "finiteGeneratedNumericRange": [
      -10000,
      10000
    ],
    "errorComparison": "error name only; engine-specific messages excluded"
  },
  "scope": "Literal fixtures and 1000 deterministic bounded cases passed; sampled equality is not universal equivalence. No browser, DOM, persistence, download, or rendered-output checks.",
  "status": "passed"
}
```
