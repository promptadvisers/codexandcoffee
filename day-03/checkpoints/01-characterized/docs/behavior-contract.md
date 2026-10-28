# Pricing behavior contract

This characterizes the prepared baseline's exported `calculateQuote(input)` in `app.js`. It is a regression boundary for the planned extraction, not a new validation specification. Run `node --test` from the app directory. Literal expectations live in `test/fixtures.json`; tests import the public export from `app.js`.

- Return exactly `rows`, `subtotal`, `cost`, `discount`, `net`, `tax`, `total`, `deposit`, `balance`, and `margin`. Each row has exactly `id`, `amount`, and `cost`. All money is numeric cents; margin is a numeric percentage rounded to one decimal place. Input metadata does not appear in the result.
- Coerce numeric inputs with JavaScript `Number()`. Non-finite values become zero; negative values clamp to zero. Percentages additionally cap at 100. Numeric strings, booleans, null numeric fields, and fractional quantities retain this coercion behavior. This is not comprehensive input validation.
- Round unit rate and cost to cents first, then multiply each by normalized quantity and round each row. Sum those rounded rows. Thus `0.014 * 3` produces **3 cents**; two separate half-cent rows produce **2 cents**.
- Round discount on subtotal; subtract it to obtain net fees. Round tax on net fees. Round deposit on total **including tax**. Balance is total minus deposit. Margin uses `(net - cost) / net`, excluding tax, expressed as a percentage rounded to one decimal place. Preserve negative margins. When net is zero, margin is zero even when cost is positive.
- Missing, empty, or non-array `items` yields no rows and zero totals. Preserve array order and duplicate IDs. IDs use `String(id ?? '')`, so missing/null IDs become empty strings. Do not mutate the input; return fresh result and row containers.
- **Unsupported inputs remain unsupported:** null or missing top-level input, and explicit null or undefined items, throw `TypeError`. Tests deliberately capture the error class without fixing the inputs or depending on engine-specific error messages. Other exotic objects, sparse arrays, Symbols, BigInts, and overflowing magnitudes are not comprehensively characterized.

The seeded scope has subtotal 1,275,000 cents and cost 725,000 cents. Its 0% / 5% / 10% scenarios have net fees 1,275,000 / 1,211,250 / 1,147,500 cents and margins 43.1% / 40.1% / 36.8%. At 5%, 13% tax and 30% deposit produce total 1,368,713, deposit 410,614, and balance 958,099 cents.

Five deterministic property checks each exercise 64 bounded scopes: reversing rows, splitting whole-unit rows, changing metadata/IDs, changing only internal costs, and duplicating undiscounted/untaxed scope. These check relationships rather than reproducing the pricing formula as an oracle. They do not establish universal equivalence.

UI validity, labels, localStorage, save/reopen, export privacy, downloaded HTML, and rendering are outside this Node suite. Their existing behavior still needs to survive the refactor and be verified separately; passing pricing tests does not verify those flows.
