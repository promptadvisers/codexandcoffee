import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculateQuote } from '../app.js';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
const empty = { rows: [], subtotal: 0, cost: 0, discount: 0, net: 0, tax: 0, total: 0, deposit: 0, balance: 0, margin: 0 };
const row = (overrides = {}) => ({ id: 'line', qty: 1, rate: 10, cost: 3, ...overrides });
const withoutRows = ({ rows, ...totals }) => totals;

test('seeded example matches independently checked cents and margin', () => {
  assert.deepStrictEqual(calculateQuote(fixtures.seeded.input), fixtures.seeded.expected);
});

for (const scenario of fixtures.scenarios) {
  test(`seeded ${scenario.discountPercent}% discount scenario`, () => {
    const actual = calculateQuote({ ...fixtures.seeded.input, discount: scenario.discountPercent });
    assert.deepStrictEqual(actual, { rows: fixtures.seeded.expected.rows, ...scenario.expected });
  });
}

for (const fixture of fixtures.rounding) {
  test(fixture.name, () => assert.deepStrictEqual(calculateQuote(fixture.input), fixture.expected));
}

test('numeric strings and fractional quantities use Number coercion', () => {
  assert.deepStrictEqual(calculateQuote(fixtures.numericStrings.input), fixtures.numericStrings.expected);
});

test('return object and row keys are exact, with no input metadata leaked', () => {
  const actual = calculateQuote({ ...fixtures.seeded.input, secret: 'internal' });
  assert.deepStrictEqual(Object.keys(actual), ['rows', 'subtotal', 'cost', 'discount', 'net', 'tax', 'total', 'deposit', 'balance', 'margin']);
  for (const result of actual.rows) assert.deepStrictEqual(Object.keys(result), ['id', 'amount', 'cost']);
});

test('missing, non-array and empty items yield the same exact empty result', () => {
  for (const items of [undefined, null, {}, 'items', 2, []]) {
    assert.deepStrictEqual(calculateQuote({ items, discount: 5, tax: 13, deposit: 30 }), empty);
  }
  assert.deepStrictEqual(calculateQuote({}), empty);
});

test('negative quantities, rates and costs clamp independently to zero', () => {
  const actual = calculateQuote({ items: [row({ id: 'qty', qty: -2 }), row({ id: 'rate', rate: -10 }), row({ id: 'cost', cost: -3 })] });
  assert.deepStrictEqual(actual, {
    rows: [{ id: 'qty', amount: 0, cost: 0 }, { id: 'rate', amount: 0, cost: 300 }, { id: 'cost', amount: 1000, cost: 0 }],
    subtotal: 1000, cost: 300, discount: 0, net: 1000, tax: 0, total: 1000, deposit: 0, balance: 1000, margin: 70,
  });
});

test('non-finite and nonnumeric values normalize to zero', () => {
  for (const value of [NaN, Infinity, -Infinity, 'Infinity', 'not a number', undefined]) {
    assert.deepStrictEqual(calculateQuote({ items: [row({ qty: value })] }).rows, [{ id: 'line', amount: 0, cost: 0 }]);
    assert.deepStrictEqual(calculateQuote({ items: [row({ rate: value, cost: value })] }).rows, [{ id: 'line', amount: 0, cost: 0 }]);
    assert.deepStrictEqual(calculateQuote({ items: [row()], discount: value, tax: value, deposit: value }), calculateQuote({ items: [row()] }));
  }
});

test('blank strings, null and booleans retain JavaScript numeric coercion', () => {
  for (const value of ['', '  ', null, false]) {
    assert.deepStrictEqual(calculateQuote({ items: [row({ qty: value })] }).rows, [{ id: 'line', amount: 0, cost: 0 }]);
  }
  assert.deepStrictEqual(calculateQuote({ items: [row({ qty: true, rate: true, cost: false })] }).rows, [{ id: 'line', amount: 100, cost: 0 }]);
  assert.deepStrictEqual(calculateQuote({ items: [{}] }).rows, [{ id: '', amount: 0, cost: 0 }]);
});

test('negative percentages clamp to zero', () => {
  assert.deepStrictEqual(calculateQuote({ items: [row()], discount: -1, tax: -13, deposit: -30 }), calculateQuote({ items: [row()] }));
});

test('percentage values above 100 cap independently at 100', () => {
  const base = { items: [row()] };
  assert.deepStrictEqual(calculateQuote({ ...base, discount: 101 }), { rows: [{ id: 'line', amount: 1000, cost: 300 }], subtotal: 1000, cost: 300, discount: 1000, net: 0, tax: 0, total: 0, deposit: 0, balance: 0, margin: 0 });
  assert.deepStrictEqual(calculateQuote({ ...base, tax: 101, deposit: 200 }), { rows: [{ id: 'line', amount: 1000, cost: 300 }], subtotal: 1000, cost: 300, discount: 0, net: 1000, tax: 1000, total: 2000, deposit: 2000, balance: 0, margin: 70 });
});

test('zero net from a full discount retains costs but forces margin to zero', () => {
  const actual = calculateQuote({ ...fixtures.seeded.input, discount: 100 });
  assert.deepStrictEqual(actual, { rows: fixtures.seeded.expected.rows, subtotal: 1275000, cost: 725000, discount: 1275000, net: 0, tax: 0, total: 0, deposit: 0, balance: 0, margin: 0 });
});

test('zero-priced work retains nonzero costs and zero margin', () => {
  assert.deepStrictEqual(calculateQuote({ items: [row({ rate: 0 })], tax: 13, deposit: 30 }), { rows: [{ id: 'line', amount: 0, cost: 300 }], subtotal: 0, cost: 300, discount: 0, net: 0, tax: 0, total: 0, deposit: 0, balance: 0, margin: 0 });
});

test('negative margin is retained, uses net fees and excludes tax', () => {
  assert.deepStrictEqual(calculateQuote({ items: [row({ cost: 15 })], discount: 20, tax: 100, deposit: 50 }), { rows: [{ id: 'line', amount: 1000, cost: 1500 }], subtotal: 1000, cost: 1500, discount: 200, net: 800, tax: 800, total: 1600, deposit: 800, balance: 800, margin: -87.5 });
});

test('IDs stringify with nullish fallback, preserving order and duplicates', () => {
  const ids = ['same', 42, 'same', null, undefined, false, 0];
  const actual = calculateQuote({ items: ids.map((id, index) => row({ id, rate: index + 1, cost: 0 })) });
  assert.deepStrictEqual(actual.rows, ['same', '42', 'same', '', '', 'false', '0'].map((id, index) => ({ id, amount: (index + 1) * 100, cost: 0 })));
});

test('calculation does not mutate frozen input or reuse output containers', () => {
  const input = structuredClone(fixtures.seeded.input);
  for (const item of input.items) Object.freeze(item);
  Object.freeze(input.items);
  Object.freeze(input);
  const first = calculateQuote(input);
  const second = calculateQuote(input);
  assert.deepStrictEqual(first, second);
  assert.notStrictEqual(first, second);
  assert.notStrictEqual(first.rows, second.rows);
  assert.notStrictEqual(first.rows[0], second.rows[0]);
});

test('unsupported null or missing top-level input throws TypeError', () => {
  assert.throws(() => calculateQuote(null), TypeError);
  assert.throws(() => calculateQuote(), TypeError);
});

test('unsupported null or undefined item throws TypeError', () => {
  assert.throws(() => calculateQuote({ items: [null] }), TypeError);
  assert.throws(() => calculateQuote({ items: [undefined] }), TypeError);
});

// Bounded metamorphic checks: relationships, not a second copy of the formula.
// Integer dollar rates and positive integer quantities avoid rounding ambiguity.
function generatedInputs() {
  let state = 20261027;
  const next = (max) => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % max; };
  return Array.from({ length: 64 }, (_, n) => ({
    discount: next(101), tax: next(101), deposit: next(101),
    items: Array.from({ length: 1 + next(6) }, (_, i) => ({ id: `${n}-${i}`, qty: 1 + next(10), rate: 1 + next(1000), cost: next(1500) })),
  }));
}

test('generated: reversing rows reverses output rows but preserves every total', () => {
  for (const input of generatedInputs()) {
    const original = calculateQuote(input);
    const reversed = calculateQuote({ ...input, items: [...input.items].reverse() });
    assert.deepStrictEqual(reversed, { ...original, rows: [...original.rows].reverse() });
  }
});

test('generated: splitting whole-unit rows preserves every total', () => {
  for (const input of generatedInputs()) {
    const items = input.items.flatMap(item => Array.from({ length: item.qty }, (_, i) => ({ ...item, id: `${item.id}/${i}`, qty: 1 })));
    assert.deepStrictEqual(withoutRows(calculateQuote({ ...input, items })), withoutRows(calculateQuote(input)));
  }
});

test('generated: metadata and IDs do not affect totals', () => {
  for (const input of generatedInputs()) {
    const decorated = { ...input, client: 'Fictional client', project: 'Ignored metadata', items: input.items.map(item => ({ ...item, id: 'duplicate', name: 'Renamed' })) };
    assert.deepStrictEqual(withoutRows(calculateQuote(decorated)), withoutRows(calculateQuote(input)));
  }
});

test('generated: internal costs cannot alter client-facing monetary results', () => {
  for (const input of generatedInputs()) {
    const original = calculateQuote(input);
    const changed = calculateQuote({ ...input, items: input.items.map(item => ({ ...item, cost: item.cost + 100 })) });
    for (const key of ['subtotal', 'discount', 'net', 'tax', 'total', 'deposit', 'balance']) assert.equal(changed[key], original[key]);
    assert.deepStrictEqual(changed.rows.map(({ id, amount }) => ({ id, amount })), original.rows.map(({ id, amount }) => ({ id, amount })));
    assert.ok(changed.cost > original.cost);
  }
});

test('generated: duplicating scope doubles undiscounted, untaxed money and preserves margin', () => {
  for (const input of generatedInputs()) {
    const base = { ...input, discount: 0, tax: 0, deposit: 0 };
    const original = calculateQuote(base);
    const doubled = calculateQuote({ ...base, items: [...base.items, ...base.items] });
    for (const key of ['subtotal', 'cost', 'net', 'total', 'balance']) assert.equal(doubled[key], 2 * original[key]);
    assert.equal(doubled.margin, original.margin);
    assert.deepStrictEqual(doubled.rows, [...original.rows, ...original.rows]);
  }
});
