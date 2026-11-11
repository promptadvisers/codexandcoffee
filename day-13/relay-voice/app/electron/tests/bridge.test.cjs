'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter, once } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const { HelperBridge } = require('../lib/bridge.cjs');

function fixture(options = {}) {
  let spawned = 0; const writes = [], signals = [];
  const child = new EventEmitter(); child.exitCode = null; child.signalCode = null;
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.stdin = new Writable({ write(chunk, _encoding, callback) { writes.push(...chunk.toString().trim().split('\n').map(JSON.parse)); callback(); } });
  child.kill = signal => { signals.push(signal); if (options.exitOnKill !== false) { child.signalCode = signal; child.emit('exit'); } };
  const bridge = new HelperBridge({ executable: '/fixture/helper', timeoutMs: options.timeoutMs || 200, shutdownMs: options.shutdownMs || 15, spawnProcess(executable, args, config) { spawned++; assert.equal(executable, '/fixture/helper'); assert.deepEqual(args, []); assert.equal(config.shell, false); assert.equal(config.detached, false); return child; } });
  const events = []; bridge.on('event', event => events.push(event)); bridge.start();
  const emit = object => child.stdout.write(Buffer.from(JSON.stringify({ v: 1, ...object }) + '\n'));
  const ready = () => emit({ event: 'ready', protocol: 'relay-helper/1', draft_writes: false });
  return { bridge, child, writes, events, signals, ready, emit, spawned: () => spawned };
}
test('one helper, strict handshake, unique request IDs, out-of-order correlation', async () => {
  const f = fixture(); f.ready(); assert.throws(() => f.bridge.start()); assert.equal(f.spawned(), 1);
  const first = f.bridge.request({ command: 'permissions' }), second = f.bridge.request({ command: 'history_get' });
  assert.notEqual(f.writes[0].id, f.writes[1].id);
  f.emit({ event: 'response', id: f.writes[1].id, ok: true, entries: [] }); f.emit({ event: 'response', id: f.writes[0].id, ok: true, permissions: { shortcut: false } });
  assert.deepEqual((await second).entries, []); assert.equal((await first).permissions.shortcut, false); await f.bridge.stop();
});
test('partial UTF-8 and several NDJSON objects in one chunk retain private text exactly', async () => {
  const f = fixture(); f.ready();
  const bytes = Buffer.from(JSON.stringify({ v: 1, event: 'transcript', text: 'héllo 🌿' }) + '\n' + JSON.stringify({ v: 1, event: 'state', state: 'idle' }) + '\n');
  for (const byte of bytes) f.child.stdout.write(Buffer.from([byte]));
  assert.equal(f.events.find(event => event.event === 'transcript').text, 'héllo 🌿'); assert.equal(f.events.at(-1).state, 'idle'); await f.bridge.stop();
});
test('malformed and oversized lines recover; unknown events and protocol versions ignored', async () => {
  const f = fixture(); f.ready();
  f.child.stdout.write('private malformed value\n');
  f.child.stdout.write('x'.repeat(4 * 1024 * 1024 + 1)); f.child.stdout.write('remaining\n');
  f.emit({ event: 'state', state: 'idle' }); f.emit({ event: 'send_email', secret: 'never-echo' });
  f.child.stdout.write('{"v":2,"event":"state","state":"bad"}\n');
  assert.equal(f.events.at(-1).state, 'idle'); assert.equal(f.events.filter(event => event.event === 'warning').length, 2);
  assert.ok(!JSON.stringify(f.events).includes('private malformed')); await f.bridge.stop();
});
test('incompatible or write-enabled helper is rejected and terminated', () => {
  const f = fixture(); f.emit({ event: 'ready', protocol: 'relay-helper/1', draft_writes: true });
  assert.equal(f.bridge.ready, false); assert.equal(f.signals[0], 'SIGTERM');
});
test('cancellation settles an active status request; late response is harmless', async () => {
  const f = fixture(); f.ready(); const pending = f.bridge.request({ command: 'status' }); const id = f.writes[0].id;
  f.emit({ event: 'cancelled', request_id: id, reason: 'command' }); assert.equal((await pending).error, 'Cancelled.');
  const delivered = f.events.length;
  f.emit({ event: 'response', id, ok: true }); assert.equal(f.bridge.pending.size, 0); assert.equal(f.events.length, delivered); await f.bridge.stop();
});
test('exit rejects pending request without respawning', async () => {
  const f = fixture(); f.ready(); const pending = f.bridge.request({ command: 'status' }); f.child.exitCode = 1; f.child.emit('exit');
  await assert.rejects(pending, /stopped/); assert.equal(f.bridge.ready, false); assert.equal(f.spawned(), 1); await f.bridge.stop();
});
test('request timeout releases its pending slot', async () => {
  const f = fixture({ timeoutMs: 10 }); f.ready(); await assert.rejects(f.bridge.request({ command: 'status' }), /in time/); assert.equal(f.bridge.pending.size, 0); await f.bridge.stop();
});
test('shutdown writes one framed command, closes stdin and exits gracefully', async () => {
  const f = fixture(); f.ready(); const stop = f.bridge.stop(); f.child.exitCode = 0; f.child.emit('exit'); await stop;
  assert.equal(f.writes.at(-1).command, 'shutdown'); assert.equal(f.child.stdin.writableEnded, true); assert.deepEqual(f.signals, []); await f.bridge.stop(); assert.equal(f.writes.length, 1);
});
test('shutdown escalates to SIGTERM when graceful exit stalls', async () => {
  const f = fixture(); f.ready(); await f.bridge.stop(); assert.deepEqual(f.signals, ['SIGTERM']);
});
test('requests cannot run before readiness, after stop or against a closed pipe', async () => {
  const f = fixture(); await assert.rejects(f.bridge.request({ command: 'ping' }), /not ready/); f.ready(); await f.bridge.stop(); await assert.rejects(f.bridge.request({ command: 'ping' }), /not ready/);
});
