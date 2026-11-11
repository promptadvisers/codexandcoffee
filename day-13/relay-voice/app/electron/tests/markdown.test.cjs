const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
class Node {
  constructor(tag, text = '') { this.tag = tag; this.children = []; this.textContent = text; this.events = {}; }
  append(...nodes) { this.children.push(...nodes); }
  addEventListener(type, fn) { this.events[type] = fn; }
  set innerHTML(_) { throw Error('Unsafe HTML sink'); }
}
global.document = { createElement: tag => new Node(tag), createTextNode: text => new Node('#text', text) };
const moduleURL = pathToFileURL(path.resolve(__dirname, '../ui/markdown.js')).href;
const all = node => [node, ...node.children.flatMap(all)];
const content = node => node.textContent + node.children.map(content).join('');
test('renders headings, emphasis, nested lists, tables, quotes and literal fenced code', async () => {
  const { markdown } = await import(moduleURL);
  const root = markdown('### Research\n\n- **Study:** an *example*\n  - Nested item\n\n> A quote\n\n| Name | Value |\n| --- | --- |\n| A | 42 |\n\n```html\n<script>literal</script>\n```');
  const tags = all(root).map(n => n.tag);
  for (const tag of ['h3', 'strong', 'em', 'ul', 'li', 'blockquote', 'table', 'th', 'td', 'pre', 'code']) assert.ok(tags.includes(tag), tag);
  assert.ok(content(root).includes('<script>literal</script>'));
  assert.equal(tags.includes('script'), false);
});
test('raw HTML and remote images cannot execute or load; only known sources are links', async () => {
  const { markdown } = await import(moduleURL), opened = [];
  const root = markdown('<img src=x onerror=alert(1)>\n\n![tracking](https://evil.test/image)\n\n[bad](javascript:alert(1)) [unknown](https://evil.test/) [source](https://example.com/paper)', [{url:'https://example.com/paper'}], u => opened.push(u));
  assert.ok(content(root).includes('<img src=x onerror=alert(1)>'));
  assert.equal(all(root).some(n => ['img', 'script', 'iframe'].includes(n.tag)), false);
  const links = all(root).filter(n => n.tag === 'a'); assert.equal(links.length, 1);
  let prevented = false; links[0].events.click({preventDefault(){prevented = true;}});
  assert.ok(prevented); assert.deepEqual(opened, ['https://example.com/paper']);
});
test('decodes text entities without treating decoded HTML as markup; malformed input stays readable', async () => {
  const { markdown } = await import(moduleURL);
  const root = markdown('Fish &amp; chips &#60;script&#62;\n\n**unfinished\n\n[broken](\n\n- [x] Done');
  assert.ok(content(root).includes('Fish & chips <script>'));
  assert.ok(content(root).includes('unfinished'));
  assert.ok(content(root).includes('☑'));
  assert.equal(all(root).some(n => n.tag === 'script'), false);
});
test('native voice and typed asks share answer-only path with no insertion option', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../native/ElectronHelper.swift'), 'utf8');
  assert.ok(source.includes('self.state.transition(.asking); self.ask(text)'));
  const ask = source.split('private func ask(_ text: String)')[1].split('private func remember')[0];
  assert.ok(ask.includes('target = nil; targetPID = nil'));
  assert.ok(ask.includes('"insertion": "not_requested"'));
  assert.equal(/self\.insert\(/.test(ask), false);
  assert.equal(source.includes('insertResult'), false);
});
