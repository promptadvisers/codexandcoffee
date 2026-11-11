import { markdownPreview } from './markdown.js';
import { busy, readiness, outcome, shortcut, windows, button, toolLabel, serviceIcon, serviceAsset } from './view.js';
const $ = selector => document.querySelector(selector);
const bars = Array.from({ length: 22 }, () => { const bar = document.createElement('i'); $('#meter').append(bar); return bar; });
let lastPreviewKey = '', lastActionKey = '', notice = '', noticeTimer, currentState;
async function run(action) { try { const result = await action(); if (!result.ok) flash(result.error || 'Action unavailable.'); return result; } catch { flash('Relay connection closed.'); return {ok:false}; } }
function flash(text) { notice = text; clearTimeout(noticeTimer); if(currentState) render(currentState); noticeTimer = setTimeout(() => { notice = ''; if(currentState) render(currentState); }, 2400); }
async function copyResult() { if (currentState && (await run(() => window.relay.copyResult(currentState.requestId))).ok) flash('Copied to clipboard'); }
function render(state) {
  currentState = state;
  const collapsed = !!state.overlayCollapsed;
  document.body.classList.toggle('collapsed', collapsed);
  $('.mini-controls').hidden = !collapsed;
  $('#mini-copy').disabled = busy(state) || !state.result?.result?.text;
  $('#mini-copy').title = notice || 'Copy result';
  $('#mini-copy').ariaLabel = notice || 'Copy result';
  $('#mini-copy').classList.toggle('copied', notice === 'Copied to clipboard');
  const readinessState = readiness(state), active = busy(state);
  const transcriptOnly = !active && !state.error && !state.warning && state.result?.kind === 'dictation' && !!state.result.result?.text && ['inserted_verified', 'paste_unverified', 'inserted', 'inserted_value'].includes(state.result.insertion);
  document.body.classList.toggle('transcript-only', transcriptOnly);
  let title = readinessState.title, subtitle = 'Dictation · Research · Email', detail = readinessState.detail;
  if (state.phase === 'recording') { title = 'Listening'; subtitle = `Release ${shortcut} to finish`; detail = 'Escape cancels'; }
  if (state.phase === 'permission') { title = 'Waiting for microphone access'; subtitle = windows ? 'Allow desktop microphone access in Windows Settings' : 'Approve access in the macOS prompt'; detail = 'If you release now, press again after setup.'; }
  if (state.phase === 'transcribing') { title = 'Understanding your voice'; subtitle = 'Keep your original field focused'; detail = 'Transcribing and choosing the next step'; }
  if (state.phase === 'asking') { title = 'Working on your request'; subtitle = 'Ask Relay'; detail = 'Waiting for the provider'; }
  if (state.phase === 'inserting') {
    title = state.reason.startsWith('test_countdown_') ? `Click your text field · ${state.reason.split('_').at(-1)}s` : state.reason === 'waiting_for_keys' ? 'Release modifier keys' : 'Inserting your text';
    subtitle = state.reason.startsWith('test_countdown_') ? 'Relay will insert a short test sentence' : 'Keep your text field focused';
    detail = 'Escape cancels before paste';
  }
  if (state.phase === 'verifying') { title = 'Checking insertion'; subtitle = 'Text sent to your field'; detail = 'Waiting for the editor to confirm'; }
  if (state.phase === 'status') { title = 'Checking setup'; subtitle = 'Reading actual provider configuration'; detail = 'This can include a bounded Gmail profile check.'; }
  const tool = state.tools.findLast(item => item.status === 'running') || state.tools.at(-1);
  if (tool && state.phase === 'asking') { title = tool.label; subtitle = `${tool.provider} · ${tool.status}`; detail = tool.summary || (tool.input?.query ? `Query: ${tool.input.query}` : tool.input?.url || 'Actual request in progress'); }
  const provider = collapsed ? 'Relay' : state.phase === 'asking' && tool ? tool.provider : 'Relay';
  const activity = state.phase === 'asking' && tool ? tool.status : state.phase === 'transcribing' ? 'running' : 'idle';
  $('.brand-frame').dataset.provider = provider; $('.brand-frame').dataset.status = activity;
  $('.brand').src = serviceAsset(provider, activity); $('.brand').alt = provider; $('.brand').dataset.provider = provider;
  const trail = $('#trail'); trail.replaceChildren();
  for (const item of state.tools.filter(item => item.kind !== 'state').slice(-4)) {
    const step = document.createElement('span'); step.className = `trail-step ${item.status}`;
    step.title = `${toolLabel(item)} · ${item.status}`; step.setAttribute('aria-label', step.title);
    step.append(serviceIcon(item.provider, 'service-icon', item.status)); trail.append(step);
  }
  if (!active && state.result) { title = outcome(state.result.insertion); subtitle = state.result.result?.text || 'Result available in history'; detail = state.result.kind === 'ask' ? 'Open your answer. Copy only when you need it.' : 'Your transcript is saved in History.'; }
  if (!active && state.reason === 'short_tap') { title = 'Hold a little longer'; subtitle = `Keep ${shortcut} pressed while speaking`; }
  if (!active && ['escape', 'command', 'recording_limit', 'option_chord'].includes(state.reason) && !state.result) { title = 'Cancelled'; subtitle = 'No text inserted'; }
  if (state.error) { title = state.error.code === 'shortcut_unavailable' ? `${shortcut} unavailable` : 'Relay needs your attention'; subtitle = state.error.message; detail = 'Open setup or try again. Saved results remain in History.'; }
  if (state.warning) detail = state.warning.message;
  $('.pill').dataset.phase = state.phase; $('.pill').dataset.provider = provider; $('.pill').dataset.activity = activity; $('.pill').dataset.error = String(!!state.error);
  $('#title').textContent = title; $('#title').title = title;
  const formattedPreview = !active && !state.error && state.result?.kind === 'ask';
  const previewKey = `${formattedPreview}:${subtitle}`;
  if (previewKey !== lastPreviewKey) {
    lastPreviewKey = previewKey;
    const preview = $('#subtitle');
    if (formattedPreview) preview.replaceChildren(markdownPreview(subtitle));
    else preview.textContent = subtitle;
    preview.title = preview.textContent;
  }
  $('#detail').textContent = notice || detail; $('#detail').title = detail;
  $('#duration').textContent = state.phase === 'recording' ? `${Math.floor(state.elapsed / 60000)}:${String(Math.floor(state.elapsed / 1000) % 60).padStart(2, '0')}` : '';
  $('.pill').title = collapsed ? (notice || `${title} · ${detail}`) : '';
  $('.pill').setAttribute('aria-label', collapsed ? `Relay Voice · ${notice || title}` : 'Relay Voice status');
  $('#meter').hidden = state.phase !== 'recording';
  $('#mini-status').hidden = !collapsed || state.phase === 'recording';
  $('#mini-status').textContent = notice === 'Copied to clipboard' ? 'Copied' : state.error || !readinessState.ready ? 'Setup' : state.phase === 'permission' ? 'Allow mic' : active ? 'Working' : state.result?.kind === 'ask' ? 'Answer' : 'Ready';
  bars.forEach((bar, i) => { const level = state.phase === 'recording' ? state.meter[i - ((collapsed ? 11 : 22) - state.meter.length)] || 0 : 0; bar.style.height = `${3 + level * 26}px`; });
  const key = `${state.phase}:${active}:${state.result?.kind}:${readinessState.ready}:${!!state.error}:${collapsed}:${transcriptOnly}:${notice}`;
  if (key === lastActionKey) return; lastActionKey = key;
  const actions = $('#actions'); actions.replaceChildren();
  if (active && state.phase !== 'verifying') actions.append(button('Cancel', () => run(() => window.relay.command({ command: 'cancel' }))));
  else if (!active) {
    if (state.result?.result?.text) {
      const copy = button('', copyResult, 'icon-copy');
      copy.append($('#mini-copy svg').cloneNode(true));
      copy.title = copy.ariaLabel = notice === 'Copied to clipboard' ? 'Copied to clipboard' : 'Copy text';
      copy.classList.toggle('copied', notice === 'Copied to clipboard');
      actions.append(copy);
    }
    if (state.result?.kind === 'ask') actions.append(button('View answer', () => run(() => window.relay.openPanel('result'))));
    else if (!transcriptOnly) actions.append(button(state.result || (readinessState.ready && !state.error) ? 'History' : 'Setup', () => run(() => window.relay.openPanel(state.result || (readinessState.ready && !state.error) ? 'history' : 'settings'))));

  }
  const minimize = button('−', () => run(() => window.relay.collapseOverlay(true)), 'close');
  minimize.ariaLabel = 'Minimize voice pill'; minimize.title = 'Minimize to logo and waveform'; actions.append(minimize);
}
$('#mini-copy').addEventListener('click', copyResult);
$('#expand-pill').addEventListener('click', () => run(() => window.relay.collapseOverlay(false)));
window.relay.onState(render);
window.relay.snapshot().then(result => { if (result.ok) render(result.state); });
