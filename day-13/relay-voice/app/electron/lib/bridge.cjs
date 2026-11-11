'use strict';
const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { StringDecoder } = require('node:string_decoder');
const EVENTS = new Set(['ready', 'response', 'state', 'meter', 'transcript', 'tool', 'result', 'history_entry', 'history', 'cancelled', 'error', 'warning']);

class HelperBridge extends EventEmitter {
  constructor({ executable, env = process.env, spawnProcess = spawn, timeoutMs = 165000, shutdownMs = 2500 }) {
    super(); this.executable = executable; this.env = env; this.spawnProcess = spawnProcess; this.timeoutMs = timeoutMs; this.shutdownMs = shutdownMs;
    this.child = null; this.pending = new Map(); this.started = false; this.stopping = false; this.ready = false; this.buffer = ''; this.decoder = new StringDecoder('utf8'); this.discarding = false;
  }
  start() {
    if (this.started) throw new Error('The voice helper has already been started.');
    this.started = true;
    try { this.child = this.spawnProcess(this.executable, [], { stdio: ['pipe', 'pipe', 'pipe'], shell: false, detached: false, env: this.env }); }
    catch { this.fail('The voice helper could not start. Rebuild Relay Voice and reopen it.'); return; }
    this.child.stdout.on('data', data => this.consume(this.decoder.write(data)));
    // Drain without logging private process output.
    this.child.stderr.on('data', () => {});
    this.child.stdin.on('error', () => this.fail('The voice helper connection closed. Quit and reopen Relay Voice.'));
    this.child.once('error', () => this.fail('The voice helper could not start. Rebuild Relay Voice and reopen it.'));
    this.child.once('exit', () => { this.ready = false; clearTimeout(this.readyTimer); this.rejectPending('The voice helper stopped.'); if (!this.stopping) this.fail('The voice helper stopped. Quit and reopen Relay Voice.'); this.emit('exit'); });
    this.readyTimer = setTimeout(() => { if (!this.ready) { this.fail('The voice helper did not become ready. Quit and reopen Relay Voice.'); this.child?.kill('SIGTERM'); } }, 10000);
    this.readyTimer.unref?.();
  }
  consume(chunk) {
    // Cap each line, including partial lines. Recovery starts after the next newline.
    for (const piece of chunk.match(/[^\n]*\n|[^\n]+$/g) || []) {
      const endsLine = piece.endsWith('\n');
      if (!this.discarding) {
        this.buffer += piece;
        if (Buffer.byteLength(this.buffer) > 4 * 1024 * 1024) { this.buffer = ''; this.discarding = true; this.emit('event', { event: 'warning', code: 'protocol_size', message: 'A helper response exceeded the safe size limit.' }); }
      }
      if (!endsLine) continue;
      if (!this.discarding) this.line(this.buffer.trim());
      this.buffer = ''; this.discarding = false;
    }
  }
  line(line) {
    if (!line) return;
    let event; try { event = JSON.parse(line); } catch { this.emit('event', { event: 'warning', code: 'protocol_json', message: 'An unreadable helper response was ignored.' }); return; }
    if (!event || event.v !== 1 || !EVENTS.has(event.event)) return;
    // A late response after cancellation/timeout must not replace current setup.
    if (event.event === 'response' && !this.pending.has(event.id)) return;
    if (event.event === 'ready') {
      if (event.protocol !== 'relay-helper/1' || event.draft_writes !== false) { this.fail('The helper version does not match this app. Rebuild Relay Voice.'); this.child?.kill('SIGTERM'); return; }
      this.ready = true; clearTimeout(this.readyTimer);
    }
    this.emit('event', event);
    if (event.event === 'response') {
      const pending = this.pending.get(event.id);
      if (pending) { this.pending.delete(event.id); clearTimeout(pending.timer); pending.resolve(event); }
    }
    if (event.event === 'cancelled') {
      const pending = this.pending.get(event.request_id);
      if (pending) { this.pending.delete(event.request_id); clearTimeout(pending.timer); pending.resolve({ ok: false, error: 'Cancelled.' }); }
    }
  }
  request(payload) {
    if (!this.ready || this.stopping || !this.child?.stdin.writable) return Promise.reject(new Error('The voice helper is not ready. Quit and reopen Relay Voice.'));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('The helper did not answer in time. Cancel and retry.')); }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ ...payload, id }) + '\n', error => {
        if (error && this.pending.has(id)) { clearTimeout(timer); this.pending.delete(id); reject(new Error('The voice helper connection closed.')); }
      });
    });
  }
  rejectPending(message) { for (const { timer, reject } of this.pending.values()) { clearTimeout(timer); reject(new Error(message)); } this.pending.clear(); }
  fail(message) { this.ready = false; clearTimeout(this.readyTimer); this.rejectPending(message); this.emit('event', { event: 'offline', message }); }
  async stop() {
    if (this.stopPromise) return this.stopPromise;
    this.stopping = true; clearTimeout(this.readyTimer); this.rejectPending('Relay Voice is closing.');
    this.stopPromise = new Promise(resolve => {
      const child = this.child;
      if (!child || child.exitCode !== null || child.signalCode) return resolve();
      let termTimer, killTimer, endTimer;
      const done = () => { clearTimeout(termTimer); clearTimeout(killTimer); clearTimeout(endTimer); resolve(); };
      child.once('exit', done);
      if (child.stdin.writable) child.stdin.end(JSON.stringify({ id: randomUUID(), command: 'shutdown' }) + '\n');
      else child.kill('SIGTERM');
      termTimer = setTimeout(() => child.kill('SIGTERM'), this.shutdownMs);
      killTimer = setTimeout(() => child.kill('SIGKILL'), this.shutdownMs + 2000);
      endTimer = setTimeout(done, this.shutdownMs + 2500);
    });
    return this.stopPromise;
  }
}
module.exports = { HelperBridge };
