# Product brief

Morrow Advisory is a fictional consulting studio. A consultant needs to shape a quote, understand how concessions affect margin, save it in the browser, and export a proposal without exposing internal delivery costs.

Required behavior: named project and client; editable services, quantity, unit price and internal unit cost; discount, tax and deposit percentages; totals and margin; scenarios at 0%, 5%, 10% discounts; save and reopen locally; export a self-contained HTML proposal containing only client-facing figures.

No login, payment, email, external API or AI runtime. All names, prices and clients are fictional. CAD is a display convention, not foreign exchange. All arithmetic is a teaching example, not financial or tax advice.

Refactoring goal: separate pricing arithmetic from UI and storage while keeping the public `calculateQuote(input)` output, numeric rounding order, storage key, visible labels, and user flows unchanged. Do not silently improve existing quirks. Tests bound the behavior we know; they do not prove universal equivalence.
