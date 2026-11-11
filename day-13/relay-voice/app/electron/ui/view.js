export const shortcut = globalThis.relay?.platform === 'win32' ? 'Ctrl+Shift+Space' : 'Option';
export const windows = globalThis.relay?.platform === 'win32';
export const busy = state => ['permission', 'recording', 'transcribing', 'asking', 'status', 'inserting', 'verifying'].includes(state?.phase);
export const outcome = value => ({ inserted_verified: 'Inserted into your field', paste_unverified: 'Paste sent. Check your field.', modifiers_held: 'Release modifier keys, then try again.', focus_unavailable: 'Could not confirm your text field.', inserted: 'Earlier insertion was not verified', inserted_value: 'Earlier insertion was not verified', accessibility_required: 'Enable Accessibility, then try again. Your text is ready to copy.', no_eligible_target: 'No supported text field. Your text is ready to copy.', focus_changed: 'Focus changed. Your text is ready to copy.', focus_or_value_changed: 'The field changed. Your text is ready to copy.', target_not_safe: 'This field cannot receive text safely. Use Copy.', copy_required: 'This field needs Copy.', not_requested: 'Answer ready', answered: 'Answered', failed: 'Request failed', cancelled: 'Cancelled' }[value] || 'Text ready to copy');
export function readiness(state) {
  if (!state?.online) return { ready: false, title: state?.phase === 'starting' ? 'Starting Relay Voice' : 'Voice helper offline', detail: 'Open setup for details.' };
  if (!state.permissions.shortcut) return { ready: false, title: `${shortcut} unavailable`, detail: 'Quit the previous app or resolve the shortcut conflict, then restart.' };
  if (state.permissions.microphone !== 'authorized') return { ready: false, title: 'Microphone access needed', detail: 'Open setup to enable your microphone.' };
  if (!state.permissions.backend) return { ready: false, title: 'Provider bridge missing', detail: 'Rebuild Relay Voice, then reopen the app.' };
  if (!state.permissions.accessibility) return { ready: false, title: 'Accessibility access needed', detail: 'Enable insertion in setup. Dictation can still be copied.' };
  return { ready: true, title: 'Ready when you are', detail: `Hold ${shortcut}. Dictate or ask. Release to finish.` };
}
export function el(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
export function button(label, fn, className = 'button') { const node = el('button', className, label); node.type = 'button'; node.addEventListener('click', fn); return node; }
export function formatDate(value) { try { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)); } catch { return ''; } }
export function toolLabel(tool) { return [tool.provider, tool.label || tool.tool].filter(Boolean).join(' · '); }

export function serviceAsset(provider, status) {
  if (status === 'running' && ['Firecrawl', 'Alexandria'].includes(provider)) return 'services/firecrawl-active.png';
  return ({ Firecrawl: 'services/firecrawl.png', Alexandria: 'services/firecrawl.png', Google: 'services/google.png', Gmail: 'services/gmail.svg' })[provider] || 'icon.png';
}
export function serviceIcon(provider, className = 'service-icon', status) {
  const icon = el('img', className); icon.src = serviceAsset(provider, status); icon.alt = provider || 'Relay'; icon.dataset.provider = provider || 'Relay'; return icon;
}
export function inputText(tool) { return Object.entries(tool.input || {}).map(([key, value]) => `${key}: ${value}`).join('\n'); }

// Provider attribution comes from completed tool receipts, never answer wording.
export function resultProviders(tools = []) {
  const latest = new Map();
  for (const [index, tool] of tools.entries()) latest.set(tool.id || index, tool);
  const providers = new Map();
  for (const tool of latest.values()) {
    if (tool.status !== 'completed' || tool.kind === 'state' || !tool.provider || tool.provider === 'Relay') continue;
    if (!providers.has(tool.provider)) providers.set(tool.provider, new Set());
    providers.get(tool.provider).add(tool.label || tool.tool || 'Completed tool');
  }
  return [...providers].map(([provider, labels]) => ({ provider, detail: [...labels].join(' · ') }));
}
