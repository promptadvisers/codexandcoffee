'use strict';

function initialState() {
  return { online: false, phase: 'starting', requestId: '', mode: 'auto', overlayCollapsed: false, settings: { account: 'primary', model: '', voice_mode: 'auto' }, permissions: {}, providers: null, providerCheckedAt: null, history: [], tools: [], meter: [], elapsed: 0, result: null, error: null, warning: null, reason: '', draftWrites: false };
}
function upsertTool(tools, tool) {
  if (!tool || typeof tool.id !== 'string') return tools;
  const index = tools.findIndex(item => item.id === tool.id);
  if (index < 0) return [...tools, tool].slice(-30);
  return tools.map((item, i) => i === index ? tool : item);
}
function reduce(state, event) {
  const s = { ...state };
  switch (event.event) {
    case 'ready':
      s.online = true; s.phase = 'idle'; s.permissions = event.permissions || {}; s.settings = event.settings || s.settings; s.mode = s.settings.voice_mode; s.error = null; break;
    case 'state':
      if (event.request_id !== s.requestId && ['recording', 'permission', 'asking', 'inserting'].includes(event.state)) {
        s.tools = []; s.meter = []; s.elapsed = 0; s.result = null; s.error = null; s.warning = null;
      }
      s.phase = event.state; s.requestId = event.request_id || ''; s.mode = event.mode || s.mode; s.reason = event.reason || '';
      if (s.phase !== 'recording') s.meter = [];
      break;
    case 'meter':
      if (event.request_id !== s.requestId || s.phase !== 'recording') break;
      s.meter = [...s.meter, Math.max(0, Math.min(1, Number(event.level) || 0))].slice(-22); s.elapsed = event.elapsed_ms || 0; break;
    case 'tool':
      if (event.request_id === s.requestId && s.result?.request_id !== event.request_id) s.tools = upsertTool(s.tools, event.tool); break;
    case 'result':
      if (event.request_id !== s.requestId) break;
      s.result = event; s.error = null;
      if (Array.isArray(event.result?.tool_events)) s.tools = event.result.tool_events;
      break;
    case 'response':
      if (event.permissions) s.permissions = event.permissions;
      if (event.settings) s.settings = event.settings;
      if (Array.isArray(event.entries)) s.history = event.entries.slice(0, 100);
      if (event.result?.status) { s.providers = event.result.status; s.providerCheckedAt = new Date().toISOString(); }
      break;
    case 'history_entry':
      if (event.entry?.id) s.history = [event.entry, ...s.history.filter(item => item.id !== event.entry.id)].slice(0, 100); break;
    case 'history': s.history = (event.entries || []).slice(0, 100); break;
    case 'error':
      if (event.request_id && event.request_id !== s.requestId) break;
      s.error = { code: event.code, message: event.message || 'The request could not be completed.' };
      s.tools = s.tools.map(item => item.status === 'running' ? { ...item, status: 'failed' } : item); break;
    case 'warning': s.warning = { code: event.code, message: event.message }; break;
    case 'cancelled':
      s.reason = event.reason; s.result = null; s.tools = s.tools.map(item => item.status === 'running' ? { ...item, status: 'cancelled' } : item); break;
    case 'offline': s.online = false; s.phase = 'offline'; s.meter = []; s.error = { code: 'helper_offline', message: event.message || 'The voice helper stopped. Quit and reopen Relay Voice.' }; break;
  }
  return s;
}
module.exports = { initialState, reduce, upsertTool };
