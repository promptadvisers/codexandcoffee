// Marked 18.0.14 supplies tokens only. Content never enters innerHTML.
import { Lexer } from './vendor/marked.js';

const element = tag => document.createElement(tag);
function url(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : null; } catch { return null; }
}
function decoded(text) {
  return String(text || '').replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (full, code) => {
    if (code[0] !== '#') return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' })[code.toLowerCase()] || full;
    const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
    return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '\ufffd';
  });
}
export function markdown(text, sources = [], openSource = () => {}, { preview = false } = {}) {
  const root = element('div'); root.className = 'markdown';
  const allowed = new Set((sources || []).map(source => url(source.url)).filter(Boolean));
  function render(tokens, parent) {
    for (const token of tokens || []) {
      let node;
      const child = tag => { node = element(tag); render(token.tokens, node); };
      switch (token.type) {
        case 'space': continue;
        case 'heading': child(`h${Math.min(6, Math.max(1, token.depth))}`); break;
        case 'paragraph': child('p'); break;
        case 'strong': child('strong'); break;
        case 'em': child('em'); break;
        case 'del': child('del'); break;
        case 'blockquote': child('blockquote'); break;
        case 'br': node = element('br'); break;
        case 'hr': node = element('hr'); break;
        case 'codespan': node = element('code'); node.textContent = token.text; break;
        case 'code': {
          node = element('pre'); const code = element('code'); code.textContent = token.text; node.append(code); break;
        }
        case 'list':
          node = element(token.ordered ? 'ol' : 'ul');
          if (token.ordered) node.start = token.start;
          for (const item of token.items) {
            const li = element('li');
            if (item.task) li.append(document.createTextNode(item.checked ? '☑ ' : '☐ '));
            render(item.tokens, li); node.append(li);
          }
          break;
        case 'table': {
          node = element('div'); node.className = 'table-scroll'; node.tabIndex = 0;
          const table = element('table'), head = element('thead'), body = element('tbody');
          const row = (cells, tag) => { const tr = element('tr'); for (const cell of cells) { const td = element(tag); render(cell.tokens, td); tr.append(td); } return tr; };
          head.append(row(token.header, 'th'));
          for (const cells of token.rows) body.append(row(cells, 'td'));
          table.append(head, body); node.append(table); break;
        }
        case 'link': {
          const href = url(decoded(token.href));
          child(!preview && href && allowed.has(href) ? 'a' : 'span');
          if (!preview && href && allowed.has(href)) { node.href = href; node.title = href; node.addEventListener('click', event => { event.preventDefault(); openSource(href); }); }
          else if (!preview && href) { node.append(document.createTextNode(` (${href})`)); }
          break;
        }
        case 'image': node = document.createTextNode(decoded(token.text)); break;
        case 'text':
          if (token.tokens) { render(token.tokens, parent); continue; }
          node = document.createTextNode(decoded(token.text)); break;
        // Raw HTML is readable literal text; it cannot execute or load a resource.
        case 'html': node = document.createTextNode(token.raw); break;
        default: node = document.createTextNode(decoded(token.text || token.raw));
      }
      parent.append(node);
    }
  }
  render(Lexer.lex(String(text || ''), { gfm: true }), root);
  return root;
}

// The pill is a reading preview; source navigation belongs to the full answer.
export function markdownPreview(text) {
  const root = markdown(text, [], () => {}, { preview: true });
  root.className = 'markdown markdown-preview';
  return root;
}
