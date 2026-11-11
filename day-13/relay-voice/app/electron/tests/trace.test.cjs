'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { actionTrace } = require('../lib/trace.cjs');
test('all sources in a bounded research request survive copying the trace', () => {
  const sources = Array.from({length: 27}, (_, i) => ({url: `https://example.com/page-${i}`}));
  const text = actionTrace({result: {sources}});
  for (const source of sources) assert.ok(text.includes(source.url));
});
test('copyable trace contains actual request/query/sources, excluding bodies and unknown inputs', () => {
  const text = actionTrace({ request: 'Find workshop email', tools: [{ provider: 'Gmail', label: 'Finding email', status: 'completed', input: { query: 'subject:workshop', account: 'primary', body: 'private body', key: 'private key' }, summary: '1 message matches' }], result: { text: 'Private answer', draft: { body: 'Private draft' }, sources: [{ url: 'https://example.com/source' }] } });
  for (const expected of ['Find workshop email', 'subject:workshop', 'primary', '1 message matches', 'https://example.com/source']) assert.ok(text.includes(expected));
  for (const secret of ['private body', 'private key', 'Private answer', 'Private draft']) assert.ok(!text.includes(secret));
});
