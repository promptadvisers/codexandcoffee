'use strict';

const SIMPLE_COMMANDS = new Set(['test_insertion', 'ping', 'permissions', 'request_accessibility', 'request_microphone', 'settings_get', 'history_get', 'history_clear', 'status', 'cancel', 'copy']);
const PAGES = new Set(['history', 'ask', 'settings', 'result']);
const BUSY = new Set(['permission', 'recording', 'transcribing', 'asking', 'status', 'inserting', 'verifying']);
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function exactKeys(value, keys) { return object(value) && Object.keys(value).every(key => keys.includes(key)); }
function invalid() { throw new Error('This action is not available.'); }
function commandPayload(value) {
  if (!object(value) || typeof value.command !== 'string') return invalid();
  if (SIMPLE_COMMANDS.has(value.command) && exactKeys(value, ['command'])) return { command: value.command };
  if (value.command === 'ask' && exactKeys(value, ['command', 'text']) && typeof value.text === 'string' && value.text.trim() && value.text.length <= 4000) return { command: 'ask', text: value.text };
  if (value.command === 'settings_set' && exactKeys(value, ['command', 'settings'])) {
    const s = value.settings;
    if (exactKeys(s, ['account', 'model', 'voice_mode']) && ['primary', 'work', 'personal'].includes(s.account) && typeof s.model === 'string' && (s.model === '' || /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(s.model)) && ['auto', 'dictate', 'ask'].includes(s.voice_mode)) {
      return { command: 'settings_set', settings: { account: s.account, model: s.model, voice_mode: s.voice_mode } };
    }
  }
  return invalid();
}
function externalURL(value) {
  if (typeof value !== 'string' || value.length > 4096) return invalid();
  let url; try { url = new URL(value); } catch { return invalid(); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname) return invalid();
  return url.href;
}
function trustedSender(event, windows) {
  return windows.some(win => win && !win.isDestroyed() && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame && ['relay://app/index.html', 'relay://app/overlay.html'].includes(event.senderFrame.url));
}
function canOpenPanel(state) { return !BUSY.has(state.phase); }
function overlayBounds(workArea, width = 440, height = 128) {
  const w = Math.min(width, workArea.width - 24);
  return { x: Math.round(workArea.x + (workArea.width - w) / 2), y: Math.round(workArea.y + workArea.height - height - 16), width: w, height };
}
module.exports = { commandPayload, externalURL, trustedSender, canOpenPanel, overlayBounds, PAGES, BUSY };
