'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { initialState, reduce } = require('../lib/state.cjs');
test('real meter samples are bounded and correlated; stale meter and result ignored', () => {
  let s = reduce(initialState(), { event: 'state', state: 'recording', request_id: 'one', mode: 'dictate' });
  s = reduce(s, { event: 'meter', request_id: 'old', level: 1 }); assert.deepEqual(s.meter, []);
  for (let i = 0; i < 30; i++) s = reduce(s, { event: 'meter', request_id: 'one', level: i / 10, elapsed_ms: i * 50 });
  assert.equal(s.meter.length, 22); assert.equal(s.meter.at(-1), 1);
  s = reduce(s, { event: 'result', request_id: 'old', result: { text: 'wrong target' } }); assert.equal(s.result, null);
  s = reduce(s, { event: 'state', request_id: 'one', state: 'transcribing' }); assert.deepEqual(s.meter, []);
});
test('tool start/completion replace one ID, and final tool_events are authoritative', () => {
  let s = reduce(initialState(), { event: 'state', state: 'asking', request_id: 'one' });
  for (const status of ['running', 'completed']) s = reduce(s, { event: 'tool', request_id: 'one', tool: { id: 'tool', status } });
  assert.equal(s.tools.length, 1); assert.equal(s.tools[0].status, 'completed');
  s = reduce(s, { event: 'result', request_id: 'one', result: { tool_events: [{ id: 'actual', status: 'completed' }] } }); assert.equal(s.tools[0].id, 'actual');
  s = reduce(s, { event: 'tool', request_id: 'one', tool: { id: 'actual', status: 'running' } }); assert.equal(s.tools[0].status, 'completed');
});
test('new capture clears previous result; cancelled work marks running tools once', () => {
  let s = { ...initialState(), result: { result: { text: 'old' } }, error: { message: 'old error' } };
  s = reduce(s, { event: 'state', state: 'permission', request_id: 'new' }); assert.equal(s.result, null); assert.equal(s.error, null);
  s = reduce(s, { event: 'tool', request_id: 'new', tool: { id: 'tool', status: 'running' } });
  s = reduce(s, { event: 'cancelled', request_id: 'new', reason: 'escape' }); assert.equal(s.tools[0].status, 'cancelled'); assert.equal(s.reason, 'escape');
});
test('history is capped, replaces duplicate IDs, preserves draft preview and clears', () => {
  let s = initialState(); for (let i = 0; i < 105; i++) s = reduce(s, { event: 'history_entry', entry: { id: String(i) } }); assert.equal(s.history.length, 100);
  const entry = { id: '104', result: { draft: { body: 'unsaved' } } }; s = reduce(s, { event: 'history_entry', entry }); assert.equal(s.history.length, 100); assert.equal(s.history[0].result.draft.body, 'unsaved');
  s = reduce(s, { event: 'history', entries: [] }); assert.equal(s.history.length, 0);
});
test('actual permission and status responses replace setup observations', () => {
  const s = reduce(initialState(), { event: 'response', permissions: { shortcut: false }, result: { status: { gemini: true, gmail: false } } });
  assert.equal(s.permissions.shortcut, false); assert.equal(s.providers.gmail, false); assert.ok(s.providerCheckedAt); assert.equal(s.draftWrites, false);
});
test('inserted_value is retained as success, and offline clears capture state', () => {
  let s = reduce(initialState(), { event: 'state', state: 'transcribing', request_id: 'id' });
  s = reduce(s, { event: 'result', request_id: 'id', insertion: 'inserted_value', result: { text: 'spoken' } }); assert.equal(s.result.insertion, 'inserted_value');
  s = reduce(s, { event: 'offline' }); assert.equal(s.online, false); assert.equal(s.phase, 'offline');
});

test('failed requests settle running actions and ignore unrelated stale failures', () => {
  let s = reduce(initialState(), { event: 'state', state: 'asking', request_id: 'new' });
  s = reduce(s, { event: 'tool', request_id: 'new', tool: { id: 'query', status: 'running', input: { query: 'public query' } } });
  s = reduce(s, { event: 'error', request_id: 'old', message: 'stale' }); assert.equal(s.error, null);
  s = reduce(s, { event: 'error', request_id: 'new', message: 'failed' });
  assert.equal(s.tools[0].status, 'failed'); assert.equal(s.tools[0].input.query, 'public query');
});

test('insertion check clears previous results before the countdown', () => {
  let s = initialState();
  s.requestId = 'old'; s.result = {text:'old'}; s.error = {message:'old'};
  s = reduce(s, {event:'state', state:'inserting', request_id:'test', reason:'test_countdown_8'});
  assert.equal(s.result, null); assert.equal(s.error, null);
  assert.equal(s.phase, 'inserting');
});
