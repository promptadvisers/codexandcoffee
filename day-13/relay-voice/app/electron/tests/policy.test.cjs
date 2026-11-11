'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { commandPayload, externalURL, trustedSender, canOpenPanel, overlayBounds } = require('../lib/policy.cjs');
test('renderer cannot start recording, insert, execute backend actions, write drafts or send', () => {
  for (const command of ['record', 'record_start', 'press', 'insert', 'draft_save', 'send', 'shutdown', 'exec', 'backend']) assert.throws(() => commandPayload({ command }));
  assert.throws(() => commandPayload({ command: 'copy', text: 'arbitrary clipboard' }));
  assert.throws(() => commandPayload({ command: 'ping', id: 'spoofed' }));
});
test('Ask and settings validate backend-compatible limits, enums, and keys', () => {
  assert.deepEqual(commandPayload({ command: 'ask', text: 'read this' }), { command: 'ask', text: 'read this' });
  for (const text of ['', '  ', 'x'.repeat(4001), {}, null]) assert.throws(() => commandPayload({ command: 'ask', text }));
  const settings = { account: 'primary', model: '', voice_mode: 'dictate' }; assert.deepEqual(commandPayload({ command: 'settings_set', settings }).settings, settings);
  for (const settings of [{ account: 'unknown', model: '', voice_mode: 'dictate' }, { account: 'primary', model: '../injection', voice_mode: 'dictate' }, { account: 'primary', model: '', voice_mode: 'toggle' }, { account: 'primary', voice_mode: 'dictate' }, { account: 'primary', model: '', voice_mode: 'dictate', token: 'secret' }]) assert.throws(() => commandPayload({ command: 'settings_set', settings }));
});
test('external links reject custom protocols, credentials, invalid and oversized input', () => {
  assert.equal(externalURL('https://example.com/source'), 'https://example.com/source');
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', 'relay://app/', 'x-apple.systempreferences:privacy', 'https://user:pass@example.com', 'https://example.com/' + 'x'.repeat(4096), null]) assert.throws(() => externalURL(url));
});
test('IPC requires a known main frame at an exact local URL', () => {
  const frame = { url: 'relay://app/index.html' }, contents = { mainFrame: frame }, win = { isDestroyed: () => false, webContents: contents };
  assert.equal(trustedSender({ sender: contents, senderFrame: frame }, [win]), true);
  assert.equal(trustedSender({ sender: contents, senderFrame: { url: frame.url } }, [win]), false);
  assert.equal(trustedSender({ sender: {}, senderFrame: frame }, [win]), false);
  frame.url = 'https://example.com'; assert.equal(trustedSender({ sender: contents, senderFrame: frame }, [win]), false);
});
test('panel focus is forbidden throughout capture, permission, transcription and tools', () => {
  for (const phase of ['recording', 'permission', 'transcribing', 'asking', 'status', 'inserting', 'verifying']) assert.equal(canOpenPanel({ phase }), false);
  assert.equal(canOpenPanel({ phase: 'idle' }), true); assert.equal(canOpenPanel({ phase: 'offline' }), true);
});
test('pill placement uses the active display work area, including negative origins', () => {
  assert.deepEqual(overlayBounds({ x: -1920, y: 0, width: 1920, height: 1040 }), { x: -1180, y: 896, width: 440, height: 128 });
  const narrow = overlayBounds({ x: 0, y: 0, width: 400, height: 800 }); assert.equal(narrow.width, 376); assert.equal(narrow.x, 12);
});

test('setup insertion check is fixed-text only', () => {
  assert.deepEqual(commandPayload({command: 'test_insertion'}), {command: 'test_insertion'});
  assert.throws(() => commandPayload({command: 'test_insertion', text: 'arbitrary input'}));
});
