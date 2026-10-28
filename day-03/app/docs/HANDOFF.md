# Verified pricing extraction

The finished application is in `app/`; the before copy is `checkpoints/01-characterized/`. Pricing lives in `domain/pricing.js`; `app.js` retains the public calculator export, UI, storage and HTML export.

The 27 existing tests pass in both copies. Eight literal cases and 1,000 deterministic bounded cases match. Protected HTML, CSS, server, package and tests are byte-identical. Run the verifier from the Day 3 directory as explained in START-HERE.md.

Chrome checks separately covered the seed values, three discount scenarios, save/reload/reopen, new quote, reset and exported HTML without internal costs. See `evidence/06-browser-verification.md`.

Known limitations: this does not prove equality for arbitrary JavaScript objects. Save failure and delete failure handle memory rollback differently. Renamed service labels in the internal-cost area can stay stale until rerender. These are preserved behaviors, not fixes made in this extraction.

Next task: characterize persistence and failure behavior before extracting storage. Do not expand this refactor without a new contract and checks.
