# Final browser verification

Actual Chrome interaction at localhost:4323 after extraction.

- Seeded total CAD 13,687.13; deposit CAD 4,106.14; balance CAD 9,580.99; margin 40.1%
- 0%, 5%, 10% scenario fees/margins displayed as expected
- Changed discount to 10%, saved, reloaded and reopened saved quote through native confirmation: total CAD 12,966.75 and margin 36.8%
- Exported actual HTML download. Visible proposal includes CAD 12,966.75 and excludes internal cost/margin text
- New quote clears fields and disables save/export until required fields supplied
- Reset example confirmed: seeded values restored; saved record remains

Screenshots: QA/day-03/app-editor.png and app-scenarios.png. Actual exported HTML: QA/day-03/final-proposal.html. Native browser dialogs were handled through Chrome accessibility controls; the DOM automation confirmation timeout is resolved.

These checks do not test storage quota failures, every browser, or every possible input. Earlier implementation evidence records editing and add/remove checks.
