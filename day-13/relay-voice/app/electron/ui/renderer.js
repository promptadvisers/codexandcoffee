import { busy, readiness, outcome, shortcut, windows, el, button, formatDate, toolLabel, serviceIcon, inputText, resultProviders } from './view.js';
import { markdown } from './markdown.js';
let answerId = null, answerKey = '';
const $ = selector => document.querySelector(selector);
let state, page = 'history', selectedId = null, settingsDirty = false, toastTimer, clearArmed = false, clearTimer, historyKey = '', askKey = '', setupKey = '';
function toast(text) { $('#toast').textContent = text; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 4500); }
async function run(action, success) {
  try { const result = await action(); if (!result.ok) toast(result.error || result.result?.error || 'The request could not be completed.'); else if (success) toast(success); return result; }
  catch { toast('The app connection closed. Reopen Relay Voice.'); return { ok: false }; }
}
const command = (name, extra = {}, success) => run(() => window.relay.command({ command: name, ...extra }), success);
function showPage(value) {
  if (!['history', 'ask', 'settings', 'result'].includes(value)) return;
  page = value;
  document.body.classList.toggle('answer-window', page === 'result');
  if (page === 'result') { answerId = state?.requestId; answerKey = ''; }
  if (page === 'history' && state?.history.some(entry => entry.id === state.requestId)) selectedId = state.requestId;
  for (const node of document.querySelectorAll('.page')) node.hidden = node.id !== `page-${page}`;
  for (const node of document.querySelectorAll('[data-page]')) node.classList.toggle('active', node.dataset.page === page);
  renderHistory(true); renderAsk(true); renderSetup(true); renderAnswer();
}
function empty(title, text, mark = '◷') {
  const node = el('div', 'empty-state'); node.append(el('div', 'empty-mark', mark), el('h2', '', title), el('p', '', text)); return node;
}
function toolList(tools) {
  const list = el('div', 'tool-list');
  for (const tool of tools || []) {
    const row = el('div', 'tool-row'), info = el('div', 'tool-info');
    info.append(el('strong', '', tool.label || tool.tool || 'Tool'), el('span', '', `${tool.provider || 'Provider'} · ${tool.status || 'unknown'}`));
    row.dataset.status = tool.status || '';
    row.dataset.provider = tool.provider || 'Relay';
    row.append(serviceIcon(tool.provider, 'service-icon', tool.status), info);
    if (tool.input && Object.keys(tool.input).length) info.append(el('pre', 'tool-input', inputText(tool)));
    if (tool.summary) info.append(el('span', 'tool-summary', tool.summary));
    if (Number.isFinite(tool.duration_ms)) row.append(el('span', 'tool-time', `${(tool.duration_ms / 1000).toFixed(1)}s`));
    list.append(row);
  }
  return list;
}
function resultView(entry) {
  const fragment = document.createDocumentFragment(), result = entry.result || {}, head = el('div', 'detail-head'), meta = el('div');
  if (page !== 'result') meta.append(el('span', 'tag', entry.kind === 'dictation' || entry.kind === 'dictate' ? 'Dictation' : 'Ask Relay'));
  meta.append(el('p', 'date', formatDate(entry.date)));
  if (page === 'result') meta.prepend(el('span', 'completion-label', 'Saved in History'));
  head.append(meta);
  if (result.text && state.history.some(item => item.id === entry.id)) head.append(button('Copy text', () => run(() => window.relay.copyEntry(entry.id, 'result'), 'Copied to clipboard')));
  fragment.append(head);
  const tools = result.tool_events || entry.tools || [];
  const providers = resultProviders(tools);
  if (providers.length) {
    const attribution = el('div', 'answer-providers');
    attribution.setAttribute('aria-label', 'Tools used for this answer');
    attribution.append(el('span', 'provider-caption', 'Tools used'));
    for (const { provider, detail } of providers) {
      const badge = el('span', 'answer-provider'); badge.title = detail;
      if (['Google', 'Gmail', 'Firecrawl', 'Alexandria'].includes(provider)) badge.append(serviceIcon(provider, 'provider-logo', 'completed'));
      const label = el('span', 'provider-name', provider);
      badge.append(label);
      // A Google profile check is connection evidence, not Google Search evidence.
      if (provider === 'Google') badge.append(el('span', 'provider-role', 'Connection'));
      attribution.append(badge);
    }
    fragment.append(attribution);
  }
  if (entry.request && entry.kind !== 'dictation') { const section = el('section', 'detail-section request-section'); section.append(el('p', 'detail-label', 'Your request'), el('p', 'prose request-prose', entry.request));
    if (page !== 'result' && state.history.some(item => item.id === entry.id)) {
      const actions = el('div', 'request-actions');
      actions.append(button('Copy request', () => run(() => window.relay.copyEntry(entry.id, 'request'), 'Request copied')), button('Use request again', () => { showPage('ask'); $('#ask-text').value = entry.request; $('#ask-text').focus(); }));
      section.append(actions);
    }
    fragment.append(section); }
  if (result.error) fragment.append(el('p', 'prose error-copy', result.error));
  if (result.text) { const section = el('section', 'detail-section'); section.append(entry.kind === 'dictation' ? el('p', 'prose', result.text) : markdown(result.text, result.sources, url => run(() => window.relay.openSource(url)))); fragment.append(section); }
  let trace;
  if (tools.length) {
    const details = el('details', 'entry-tools');
    details.append(el('summary', '', `Action trace · ${tools.length} ${tools.length === 1 ? "step" : "steps"}`), el('p', 'fine-print', 'Actual generated inputs and completed actions. Email content and private reasoning are excluded.'), toolList(tools));
    if (state.history.some(item => item.id === entry.id)) details.append(button('Copy action trace', () => run(() => window.relay.copyEntry(entry.id, 'trace'), 'Action trace copied')));
    if (result.model) details.append(el('p', 'fine-print', `Model: ${result.model}`));
    trace = details;
  }
  if (entry.outcome !== 'answered') fragment.append(el('p', 'outcome-line', outcome(entry.outcome)));
  if (result.draft) {
    const draft = el('section', 'draft detail-section'), top = el('div', 'draft-title'); top.append(el('span', 'tag', 'Unsaved draft preview'));
    if (state.history.some(item => item.id === entry.id)) top.append(button('Copy body', () => run(() => window.relay.copyEntry(entry.id, 'draft'), 'Draft body copied')));
    draft.append(top, el('p', 'field-line', `To: ${result.draft.to || ''}`), el('p', 'field-line', `Subject: ${result.draft.subject || ''}`), el('p', 'prose', result.draft.body || ''), el('p', 'fine-print', 'Preview only. Nothing has been saved to Gmail or sent.'));
    fragment.append(draft);
  }
  if (Array.isArray(result.sources) && result.sources.length) {
    const section = el('section', 'detail-section sources-section'); section.append(el('p', 'detail-label', 'Sources'));
    for (const source of result.sources) {
      let url; try { url = new URL(source.url); } catch { continue; }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue;
      const link = button(source.title || url.hostname, () => run(() => window.relay.openSource(source.url)), 'source'); link.append(el('span', '', url.hostname)); section.append(link);
    }
    fragment.append(section);
  }
  if (trace) fragment.append(trace);
  return fragment;
}
function renderAnswer() {
  if (!state || page !== 'result') return;
  const entry = state.history.find(item => item.id === answerId);
  const key = JSON.stringify(entry || null);
  if (key === answerKey) return;
  answerKey = key;
  $('#answer-detail').replaceChildren(entry ? resultView(entry) : empty('No answer here yet.', 'Completed requests appear here and are saved in History.'));
}
function renderHistory(force = false) {
  if (!state || page !== 'history') return;
  const query = $('#search').value.trim().toLocaleLowerCase();
  const key = JSON.stringify([state.history, query, selectedId]);
  if (!force && key === historyKey) return;
  historyKey = key;
  const entries = state.history.filter(entry => [entry.request, entry.result?.text, entry.result?.error, entry.result?.draft?.body, ...(entry.tools || []).map(tool => `${toolLabel(tool)} ${inputText(tool)} ${tool.summary || ""}`)].filter(Boolean).join(' ').toLocaleLowerCase().includes(query));
  if (!entries.some(entry => entry.id === selectedId)) selectedId = entries[0]?.id || null;
  const list = $('#history-list'); list.replaceChildren();
  if (!entries.length) list.append(el('p', 'empty-list', query ? 'No matching requests. Try a different word.' : 'Your first request will appear here.'));
  for (const entry of entries) {
    const item = button('', () => { selectedId = entry.id; renderHistory(true); }, `history-item${entry.id === selectedId ? ' selected' : ''}`);
    item.ariaPressed = String(entry.id === selectedId);
    const meta = el('div', 'item-meta'); meta.append(el('span', '', entry.kind === 'dictation' || entry.kind === 'dictate' ? 'DICTATE' : 'ASK'), el('span', '', formatDate(entry.date)));
    item.append(meta, el('div', 'item-excerpt', entry.request || entry.result?.text || entry.result?.error || 'Request'), el('div', 'item-outcome', entry.outcome === 'inserted_verified' ? 'Inserted' : ['inserted', 'inserted_value'].includes(entry.outcome) ? 'Earlier insertion unverified' : entry.outcome === 'paste_unverified' ? 'Paste sent · unverified' : entry.outcome === 'answered' ? 'Answered' : entry.outcome === 'failed' ? 'Needs attention' : entry.outcome === 'cancelled' ? 'Cancelled' : 'Text ready to copy'));
    list.append(item);
  }
  const selected = entries.find(entry => entry.id === selectedId);
  $('#history-detail').replaceChildren(selected ? resultView(selected) : empty(query ? 'Nothing found yet.' : 'Good ideas start here.', query ? 'Try another search to find a past request.' : `Focus a text field, hold ${shortcut}, and speak. Release to turn your voice into words.`));
}
function renderAsk(force = false) {
  if (!state || page !== 'ask') return;
  const current = state.history.find(entry => entry.id === state.requestId && entry.kind === 'ask');
  const key = JSON.stringify([state.phase, state.tools, state.result, current, state.error]);
  if (!force && key === askKey) return;
  askKey = key;
  const result = $('#ask-result');
  if (state.phase === 'asking' || (state.phase === 'transcribing' && state.mode === 'ask')) {
    result.replaceChildren(el('h2', '', state.phase === 'asking' ? 'Working on your request' : 'Transcribing your request'), el('p', 'fine-print', 'Tool activity appears here as the provider reports it.'), toolList(state.tools));
  } else if (current) result.replaceChildren(resultView(current));
  else if (state.result?.kind === 'ask') result.replaceChildren(resultView({ id: state.requestId, kind: 'ask', result: state.result.result, tools: state.tools, outcome: 'answered' }));
  else if (state.error) result.replaceChildren(el('p', 'prose error-copy', state.error.message));
}
function permissionRow(title, value, description, actionLabel, action) {
  const row = el('div', 'permission-row'), top = el('div', 'top');
  top.append(el('span', '', title), el('span', `value${['Allowed', 'Registered', 'Present', 'Configured', 'Available'].includes(value) ? '' : ' bad'}`, value)); row.append(top);
  if (description) row.append(el('p', '', description));
  if (action) { const control = button(actionLabel, action, 'button subtle'); control.disabled = busy(state); row.append(control); }
  return row;
}
function renderSetup(force = false) {
  if (!state || page !== 'settings') return;
  const key = JSON.stringify([state.permissions, state.providers, state.providerCheckedAt, state.settings, state.online, busy(state), state.error]);
  if (!force && key === setupKey) return;
  setupKey = key;
  const ready = readiness(state), banner = $('#setup-banner'); banner.classList.toggle('ready', ready.ready);
  banner.replaceChildren(el('strong', '', ready.title), el('p', '', ready.detail));
  if (state.error) banner.append(el('p', '', state.error.message));
  const p = state.permissions, permissions = $('#permissions-list'); permissions.replaceChildren();
  permissions.append(permissionRow('Microphone', p.microphone === 'authorized' ? 'Allowed' : p.microphone === 'not_determined' ? 'Not requested' : p.microphone || 'Unknown', `Used only while you hold ${shortcut}.`, p.microphone === 'not_determined' ? 'Enable microphone' : 'Open System Settings', () => p.microphone === 'not_determined' ? command('request_microphone') : run(() => window.relay.systemSettings('microphone'))));
  permissions.append(permissionRow('Accessibility', p.accessibility ? 'Allowed' : 'Not allowed', 'Needed to insert into your original text field.', windows ? 'Windows permissions' : p.accessibility ? 'Open System Settings' : 'Enable Accessibility', () => p.accessibility ? run(() => window.relay.systemSettings('accessibility')) : command('request_accessibility')));
  permissions.append(permissionRow(shortcut, p.shortcut ? 'Listening' : 'Unavailable', p.shortcut ? `Hold to record. Release ${shortcut} to finish.` : 'Quit the previous Relay Voice app or resolve the shortcut conflict, then restart this app.'));
  permissions.append(permissionRow('Voice helper', state.online && p.backend ? 'Present' : 'Unavailable', state.online && p.backend ? 'Native capture and provider bridge loaded.' : 'Rebuild and reopen Relay Voice.'));
  const providers = $('#providers-list'), status = state.providers; providers.replaceChildren();
  for (const [key, label] of [['gemini', 'Gemini'], ['firecrawl', 'Firecrawl'], ['gmail', 'Gmail · primary account']]) providers.append(permissionRow(label, !status ? 'Unchecked' : status[key] ? key === 'gmail' ? 'Available' : 'Configured' : 'Not ready'));
  $('#provider-note').textContent = status ? `Checked ${formatDate(state.providerCheckedAt)}. Gemini and Firecrawl indicate a configured key, not a completed API call. Gmail checks the primary account only. ${status.speech_model ? `Bridge default: ${status.speech_model}.` : ''}` : 'No provider check has run this session. This check reads Gmail’s primary profile when configured.';
  if (!settingsDirty) {
    $('#account').value = state.settings.account; $('#model').value = state.settings.model || '';
  }
}
function render(next) {
  state = next;
  const active = busy(state), ready = readiness(state);
  $('#history-count').textContent = String(state.history.length);
  $('#sidebar-status').textContent = ready.title; $('#sidebar-status').classList.toggle('attention', !ready.ready);
  $('#operation').hidden = !active;
  $('#operation-title').textContent = ({ recording: `Listening · release ${shortcut} to finish`, transcribing: 'Transcribing your voice', asking: 'Working on your request', status: 'Checking provider setup', inserting: 'Click your destination text field', verifying: 'Checking insertion', permission: 'Waiting for microphone permission' })[state.phase] || '';
  const tool = state.tools.findLast(item => item.status === 'running');
  $('#operation-detail').textContent = tool ? toolLabel(tool) : 'Escape or Cancel stops this request.';
  for (const selector of ['#ask-submit', '#save-settings', '#check-providers', '#test-insertion']) $(selector).disabled = active || !state.online;
  for (const control of document.querySelectorAll('#settings-form input, #settings-form select')) control.disabled = active;
  $('#refresh-permissions').disabled = !state.online; $('#refresh-history').disabled = !state.online; $('#clear-history').disabled = !state.online || active || !state.history.length;
  renderHistory(); renderAsk(); renderSetup(); renderAnswer();
}
for (const node of document.querySelectorAll('[data-page]')) node.addEventListener('click', () => showPage(node.dataset.page));
$('#search').addEventListener('input', () => renderHistory(true));
$('#minimize-to-pill').addEventListener('click', () => run(() => window.relay.collapseOverlay(true)));
$('#refresh-history').addEventListener('click', () => command('history_get'));
$('#test-insertion').addEventListener('click', () => command('test_insertion'));
$('#refresh-permissions').addEventListener('click', () => command('permissions'));
$('#check-providers').addEventListener('click', () => command('status'));
$('#cancel-operation').addEventListener('click', () => command('cancel'));
$('#settings-form').addEventListener('input', () => { settingsDirty = true; });
$('#settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  const settings = { voice_mode: 'auto', account: $('#account').value, model: $('#model').value.trim() };
  const result = await command('settings_set', { settings }, 'Settings saved');
  if (result.ok) { settingsDirty = false; renderSetup(true); }
});
$('#ask-form').addEventListener('submit', async event => {
  event.preventDefault(); const text = $('#ask-text').value.trim(); if (!text) { toast('Add a request first.'); $('#ask-text').focus(); return; }
  const result = await command('ask', { text }); if (result.ok) $('#ask-text').value = '';
});
$('#clear-history').addEventListener('click', async () => {
  if (!clearArmed) { clearArmed = true; $('#clear-history').textContent = 'Confirm clear history'; clearTimer = setTimeout(() => { clearArmed = false; $('#clear-history').textContent = 'Clear history…'; }, 5000); return; }
  clearTimeout(clearTimer); clearArmed = false; $('#clear-history').textContent = 'Clear history…'; await command('history_clear', {}, 'History cleared');
});
document.addEventListener('keydown', event => {
  if (event.metaKey && event.key.toLowerCase() === 'f') { event.preventDefault(); showPage('history'); $('#search').focus(); }
  if (event.key === 'Escape' && busy(state)) { event.preventDefault(); command('cancel'); }
});
window.relay.onState(render); window.relay.onPage(showPage);
window.relay.snapshot().then(result => { if (result.ok) render(result.state); });

for (const node of document.querySelectorAll('[data-shortcut]')) node.textContent = node.textContent.replace(/⌥ ?Option|⌥|Option/g, shortcut);
$('#provider-keys').addEventListener('submit', async event => {
  event.preventDefault();
  const result = await run(() => window.relay.saveProviderKeys({ gemini: $('#gemini-key').value.trim(), firecrawl: $('#firecrawl-key').value.trim() }), 'Keys saved securely. Voice helper restarted.');
  if (result.ok) { $('#gemini-key').value = ''; $('#firecrawl-key').value = ''; $('#key-status').textContent = result.keys.gemini ? 'Gemini key saved. You can try dictation.' : 'Add a Gemini key to enable dictation.'; }
});
