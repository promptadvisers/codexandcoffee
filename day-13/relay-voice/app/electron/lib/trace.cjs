'use strict';
const INPUT_KEYS = new Set(['query', 'url', 'account', 'message_id', 'provider', 'capability', 'indicator_ids', 'country_codes', 'date', 'per_page', 'page']);
function actionTrace(entry) {
  const lines = ['Request', String(entry.request || '').slice(0, 4000), '', 'Action trace'];
  for (const step of (entry.result?.tool_events || entry.tools || []).slice(0, 30)) {
    lines.push(`${step.provider || 'Relay'} · ${step.label || step.tool || 'Action'} · ${step.status || 'unknown'}`);
    for (const [key, value] of Object.entries(step.input || {})) {
      if (INPUT_KEYS.has(key) && typeof value === 'string') lines.push(`  ${key}: ${value.slice(0, 1500)}`);
    }
    if (typeof step.summary === 'string') lines.push(`  ${step.summary.slice(0, 300)}`);
  }
  lines.push('', 'Sources');
  for (const source of (entry.result?.sources || []).slice(0, 30)) {
    if (typeof source.url === 'string') lines.push(source.url.slice(0, 1500));
  }
  return lines.join('\n');
}
module.exports = { actionTrace };
