#!/usr/bin/env node
// Independent, dependency-free comparison. Run: node verify-refactor.mjs BEFORE AFTER
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const [beforeArg, afterArg] = process.argv.slice(2);
if (!beforeArg || !afterArg || process.argv.length !== 4) {
  console.error('Usage: node verify-refactor.mjs BEFORE_DIRECTORY AFTER_DIRECTORY');
  process.exit(2);
}
const before = resolve(beforeArg), after = resolve(afterArg);
const read = (root, file) => readFileSync(join(root, file));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { node: process.version, before, after, protectedFiles: [], commands: [], functionText: [], literalCases: 0, generatedCases: 0, generatedReturns: 0, generatedErrors: 0 };
function command(root, args) {
  const run = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8' });
  const output = `${run.stdout || ''}${run.stderr || ''}`;
  const entry = { directory: root, command: `node ${args.join(' ')}`, status: run.status };
  if (args[0] === '--test') {
    entry.tests = Number(output.match(/# tests (\d+)/)?.[1]);
    entry.passed = Number(output.match(/# pass (\d+)/)?.[1]);
    entry.failed = Number(output.match(/# fail (\d+)/)?.[1]);
  }
  report.commands.push(entry);
  assert.equal(run.status, 0, `${entry.command}\n${output}\n${run.error || ''}`);
  if (args[0] === '--test') {
    assert.equal(entry.tests, 27, 'Expected unchanged 27-test suite');
    assert.equal(entry.passed, 27);
    assert.equal(entry.failed, 0);
  }
}
function files(root, directory) {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? files(root, file) : [file];
  });
}
function functionText(source, name) {
  // These known declarations end at the following top-level declaration or EOF.
  const match = source.match(new RegExp(`(?:export )?function ${name}\\([^]*?(?=\\n(?:export )?function |\\n*$)`));
  assert.ok(match, `Missing function ${name}`);
  return match[0].replace(/^export /, '').trimEnd();
}
function outcome(fn, input) {
  try { return { kind: 'return', value: fn(input) }; }
  catch (error) { return { kind: 'throw', name: error.name }; }
}
try {
  const protectedPaths = ['index.html', 'style.css', 'server.mjs', 'package.json', ...files(before, 'test')].sort();
  assert.deepStrictEqual(files(after, 'test').sort(), files(before, 'test').sort(), 'Test file inventory changed');
  for (const file of protectedPaths) {
    const oldBytes = read(before, file), newBytes = read(after, file);
    assert.ok(oldBytes.equals(newBytes), `Protected file changed: ${file}`);
    report.protectedFiles.push({ path: file, bytes: oldBytes.length, sha256: sha256(oldBytes) });
  }
  const oldSource = read(before, 'app.js').toString('utf8');
  const domainSource = read(after, 'domain/pricing.js').toString('utf8');
  report.sourceHashes = { baselineApp: sha256(read(before, 'app.js')), finalApp: sha256(read(after, 'app.js')), domain: sha256(read(after, 'domain/pricing.js')) };
  for (const name of ['number', 'percent', 'cents', 'calculateQuote']) {
    const oldText = functionText(oldSource, name), newText = functionText(domainSource, name);
    assert.equal(newText, oldText, `${name} declaration/body changed beyond export placement`);
    report.functionText.push({ name, sha256: sha256(oldText), unchanged: true });
  }
  assert.equal(domainSource.trim(), ['number', 'percent', 'cents', 'calculateQuote'].map(name => (name === 'cents' ? '' : 'export ') + functionText(oldSource, name)).join('\n'));
  report.domainContainsOnlyMovedFunctions = true;
  // Check all remaining facade text, permitting only extraction, wiring, and header correction.
  let remainder = oldSource;
  for (const name of ['number', 'percent', 'cents', 'calculateQuote']) {
    const text = functionText(oldSource, name);
    remainder = remainder.replace((name === 'calculateQuote' ? 'export ' : '') + text + '\n', '');
  }
  const removeHeader = text => text.replace(/^\/\*[^]*?\*\/\n/, '');
  const facadeSource = read(after, 'app.js').toString('utf8');
  const strippedFacade = facadeSource.replace(/^import \{ number, percent, calculateQuote \} from '\.\/domain\/pricing\.js';\nexport \{ calculateQuote \};\n/, '');
  assert.notEqual(strippedFacade, facadeSource, 'Expected exact facade import/re-export wiring');
  assert.equal(removeHeader(strippedFacade), removeHeader(remainder), 'Non-pricing facade text changed');
  report.remainingFacadeUnchangedExceptHeader = true;
  for (const root of [before, after]) { command(root, ['--check', 'app.js']); command(root, ['--test', '--test-reporter=tap']); }
  command(after, ['--check', 'domain/pricing.js']);
  const baseline = await import(pathToFileURL(join(before, 'app.js')).href);
  const facade = await import(pathToFileURL(join(after, 'app.js')).href);
  const domain = await import(pathToFileURL(join(after, 'domain/pricing.js')).href);
  assert.strictEqual(facade.calculateQuote, domain.calculateQuote);
  assert.deepStrictEqual(Object.keys(domain).sort(), ['calculateQuote', 'number', 'percent']);
  report.facadeDomainIdentity = true;
  const fixture = JSON.parse(read(before, 'test/fixtures.json'));
  const literals = [fixture.seeded, ...fixture.rounding, fixture.numericStrings,
    ...fixture.scenarios.map(s => ({ input: { ...fixture.seeded.input, discount: s.discountPercent }, expected: { rows: fixture.seeded.expected.rows, ...s.expected } }))];
  for (const { input, expected } of literals) {
    for (const fn of [baseline.calculateQuote, facade.calculateQuote, domain.calculateQuote]) assert.deepStrictEqual(fn(structuredClone(input)), expected);
    report.literalCases++;
  }
  // Fixed LCG, bounded ordinary data. No copied arithmetic formula serves as an oracle.
  let state = 20261027;
  const next = max => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state % max; };
  const values = [undefined, null, false, true, '', '  ', 'bad', NaN, Infinity, -Infinity, -10, -0, 0, 0.005, 0.014, 0.5, 1.05, '2.5', 100, 101, 200];
  const numeric = () => next(3) ? values[next(values.length)] : (next(2000001) - 1000000) / 100;
  const ids = [undefined, null, false, 0, 42, '', 'same', 'a<&>'];
  for (let i = 0; i < 1000; i++) {
    let input;
    switch (i % 20) {
      case 0: input = undefined; break;
      case 1: input = null; break;
      case 2: input = { items: [null] }; break;
      case 3: input = { items: [undefined] }; break;
      case 4: input = { items: [null, { qty: 1 }] }; break;
      default:
        input = { project: `case-${i}`, discount: numeric(), tax: numeric(), deposit: numeric(), items: Array.from({ length: next(9) }, () => ({ id: ids[next(ids.length)], qty: numeric(), rate: numeric(), cost: numeric() })) };
        if (i % 20 === 5) input.items = [undefined, null, 'items', 2, {}][next(5)];
        if (i % 20 === 6) delete input.items;
    }
    const original = structuredClone(input);
    const expected = outcome(baseline.calculateQuote, input);
    assert.deepStrictEqual(input, original, `Baseline mutation at case ${i}`);
    for (const fn of [facade.calculateQuote, domain.calculateQuote]) {
      assert.deepStrictEqual(outcome(fn, input), expected, `Outcome mismatch at generated case ${i}`);
      assert.deepStrictEqual(input, original, `Mutation at generated case ${i}`);
    }
    report.generatedCases++;
    report[expected.kind === 'throw' ? 'generatedErrors' : 'generatedReturns']++;
  }
  report.generator = { seed: 20261027, maxRows: 8, finiteGeneratedNumericRange: [-10000, 10000], errorComparison: 'error name only; engine-specific messages excluded' };
  report.scope = 'Literal fixtures and 1000 deterministic bounded cases passed; sampled equality is not universal equivalence. No browser, DOM, persistence, download, or rendered-output checks.';
  report.status = 'passed';
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  report.status = 'failed';
  report.failure = { name: error.name, message: error.message };
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 1;
}
