'use strict';
// Execute the real main module with in-memory Electron surfaces. No Electron,
// microphone, global keyboard hook, clipboard, provider or native helper is run.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const root = path.resolve(__dirname, '..');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function harness({ singleInstance = true, storage = {} } = {}) {
  const windows = [], bridges = [], handlers = new Map(), opened = [], clip = [], requests = [];
  class FakeWindow extends EventEmitter {
    constructor(options) { super(); this.options = options; this.bounds = {x:options.x,y:options.y,width:options.width,height:options.height}; this.shows = 0; this.inactiveShows = 0; this.webContents = new EventEmitter(); this.webContents.mainFrame = { url: '' }; this.webContents.send = () => {}; this.webContents.setWindowOpenHandler = fn => { this.windowOpen = fn; }; windows.push(this); }
    isDestroyed() { return false; } setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} setBounds(bounds) { this.bounds = bounds; } getBounds() { return this.bounds; }
    loadURL(url) { this.webContents.mainFrame.url = url; return Promise.resolve(); }
    show() { this.shows++; } showInactive() { this.inactiveShows++; } hide() { this.hidden = true; }
  }
  class FakeBridge extends EventEmitter {
    constructor(options) { super(); this.options = options; this.ready = true; this.stops = 0; bridges.push(this); }
    start() { this.started = true; } request(payload) { requests.push(payload); return Promise.resolve({ ok: true }); } async stop() { this.stops++; }
  }
  const app = new EventEmitter(); Object.assign(app, { isPackaged: false, setName() {}, setPath() {}, enableSandbox() { this.sandboxed = true; }, requestSingleInstanceLock: () => singleInstance, whenReady: () => Promise.resolve(), getVersion: () => '0.6.0', getPath: () => '/fixture/user-data', setAboutPanelOptions() {}, dock: { setIcon() {} }, quit() { this.quits = (this.quits || 0) + 1; this.emit('before-quit', { preventDefault() {} }); } });
  const screen = new EventEmitter(); Object.assign(screen, { getPrimaryDisplay: () => ({ id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }), getAllDisplays() { return [this.getPrimaryDisplay()]; }, getDisplayMatching() { return this.getPrimaryDisplay(); }, getDisplayNearestPoint() { return this.getPrimaryDisplay(); }, getCursorScreenPoint: () => ({ x: 200, y: 200 }) });
  const ses = new EventEmitter(); Object.assign(ses, { setPermissionRequestHandler(fn) { this.permission = fn; }, setPermissionCheckHandler(fn) { this.checkPermission = fn; }, webRequest: { onBeforeRequest(fn) { this.checkRequest = fn; } } });
  const protocol = { registerSchemesAsPrivileged() {}, handle(_name, fn) { this.handler = fn; } };
  const electron = { app, BrowserWindow: FakeWindow, Menu: { buildFromTemplate: value => value, setApplicationMenu() {} }, Tray: class extends EventEmitter { setToolTip() {} setContextMenu() {} }, nativeImage: { createFromPath: () => ({ resize() { return this; } }) }, ipcMain: { handle: (name, fn) => handlers.set(name, fn) }, protocol, session: { defaultSession: ses }, screen, shell: { openExternal: async url => opened.push(url) }, clipboard: { writeText: text => clip.push(text) } };
  const fakeFS = { ...fs.promises,
    readFile: async (file, ...args) => file.startsWith(path.join('/fixture/user-data') + path.sep) ? (storage[file] ?? '{}') : fs.promises.readFile(file, ...args),
    mkdir: async () => {}, writeFile: async (file, contents) => { storage[file] = contents; },
    rename: async (from, to) => { storage[to] = storage[from]; delete storage[from]; }
  };
  const fakeProcess = new EventEmitter(); Object.assign(fakeProcess, { resourcesPath: '/fixture/resources', env: {}, platform: 'darwin', pid: 123 });
  vm.runInNewContext(fs.readFileSync(path.join(root, 'main.cjs'), 'utf8'), { require: name => name === 'node:fs/promises' ? fakeFS : name === 'electron' ? electron : name === './lib/config.cjs' ? { ProviderVault: class { async read() { return { gemini: 'fixture-key' }; } }, helperEnvironment: () => ({}) } : name === './lib/bridge.cjs' ? { HelperBridge: FakeBridge } : name.startsWith('./') ? require(path.join(root, name)) : require(name), __dirname: root, process: fakeProcess, URL, Response, Promise, console }, { filename: 'main.cjs' });
  await tick();
  const invoke = (input, win = windows[0], frame = win?.webContents.mainFrame) => handlers.get('relay:action')({ sender: win?.webContents, senderFrame: frame }, input);
  return { windows, bridges, app, ses, protocol, invoke, opened, clip, requests };
}
test('real main startup creates only isolated inactive pill and one production helper', async () => {
  const h = await harness(); assert.equal(h.windows.length, 1); assert.equal(h.bridges.length, 1); assert.ok(h.app.sandboxed);
  const overlay = h.windows[0]; overlay.webContents.emit('did-finish-load');
  assert.equal(overlay.options.focusable, false); assert.equal(overlay.options.alwaysOnTop, true); assert.equal(overlay.shows, 0); assert.equal(overlay.inactiveShows, 1);
  assert.equal(overlay.options.webPreferences.sandbox, true); assert.equal(overlay.options.webPreferences.contextIsolation, true); assert.equal(overlay.options.webPreferences.nodeIntegration, false);
  assert.ok(h.bridges[0].options.executable.endsWith(path.join('dist', 'helper', 'relay-voice-helper'))); assert.equal(h.requests.length, 0);
});
test('active helper events never open a focusing panel via Dock, second instance or IPC', async () => {
  const h = await harness();
  for (const phase of ['permission', 'recording', 'transcribing', 'asking', 'status', 'inserting', 'verifying']) {
    h.bridges[0].emit('event', { event: 'state', state: phase, request_id: 'physical-hold' });
    h.app.emit('activate'); h.app.emit('second-instance');
    assert.equal((await h.invoke({ action: 'open-panel', page: 'history' })).ok, false);
  }
  assert.equal(h.windows.length, 1); assert.equal(h.windows[0].shows, 0);
});
test('a hold starting while history loads prevents late show from stealing focus', async () => {
  const h = await harness(); assert.equal((await h.invoke({ action: 'open-panel', page: 'history' })).ok, true);
  h.bridges[0].emit('event', { event: 'state', state: 'recording', request_id: 'id' });
  h.windows[1].webContents.emit('did-finish-load'); assert.equal(h.windows[1].shows, 0);
});
test('actual IPC handler rejects unknown frames and recording/write bypasses', async () => {
  const h = await harness();
  assert.equal((await h.invoke({ action: 'snapshot' }, h.windows[0], { url: 'relay://app/overlay.html' })).ok, false);
  for (const command of ['record_start', 'insert', 'send', 'save_draft', 'shutdown']) assert.equal((await h.invoke({ action: 'command', payload: { command } })).ok, false);
  assert.equal(h.requests.length, 0);
  assert.equal((await h.invoke({ action: 'command', payload: { command: 'ask', text: 'A typed request' } })).ok, true); assert.equal(h.requests[0].command, 'ask');
});
test('source links and clipboard are restricted to actual stored results', async () => {
  const h = await harness(); h.bridges[0].emit('event', { event: 'history_entry', entry: { id: 'entry', result: { text: 'Private result', draft: { body: 'Unsaved body' }, sources: [{ url: 'https://example.com/receipt' }] } } });
  assert.equal((await h.invoke({ action: 'open-source', url: 'https://other.example' })).ok, false);
  assert.equal((await h.invoke({ action: 'open-source', url: 'javascript:alert(1)' })).ok, false);
  assert.equal((await h.invoke({ action: 'open-source', url: 'https://example.com/receipt' })).ok, true);
  assert.equal((await h.invoke({ action: 'copy-entry', id: 'entry', part: 'draft' })).ok, true); assert.deepEqual(h.clip, ['Unsaved body']);
  assert.equal((await h.invoke({ action: 'copy-entry', id: 'entry', part: 'arbitrary' })).ok, false);
  h.bridges[0].emit('event', { event: 'state', state: 'transcribing', request_id: 'id' }); assert.equal((await h.invoke({ action: 'open-source', url: 'https://example.com/receipt' })).ok, false);
});
test('navigation, popups, web permissions and remote fetch are blocked', async () => {
  const h = await harness(); assert.equal(h.windows[0].windowOpen().action, 'deny');
  let prevented = false; h.windows[0].webContents.emit('will-navigate', { preventDefault() { prevented = true; } }); assert.ok(prevented);
  h.ses.permission(null, 'media', value => assert.equal(value, false)); assert.equal(h.ses.checkPermission(), false);
  h.ses.webRequest.checkRequest({ url: 'https://example.com' }, value => assert.equal(value.cancel, true));
  h.ses.webRequest.checkRequest({ url: 'relay://app/renderer.js' }, value => assert.equal(value.cancel, false));
  assert.equal((await h.protocol.handler({ url: 'relay://app/package.json' })).status, 404);
  assert.equal((await h.protocol.handler({ url: 'relay://other/index.html' })).status, 404);
});
test('quit waits for one helper shutdown and second launch owns no helper', async () => {
  const h = await harness(); h.app.quit(); await tick(); assert.equal(h.bridges[0].stops, 1); assert.equal(h.app.quits, 2);
  const second = await harness({ singleInstance: false }); assert.equal(second.bridges.length, 0); assert.equal(second.windows.length, 0); assert.equal(second.app.quits, 1);
});

test('completed tool answer opens once after saved history and idle, never mid-request', async () => {
  const h = await harness(), emit = event => h.bridges[0].emit('event', event);
  emit({ event: 'state', state: 'asking', request_id: 'answer' });
  emit({ event: 'result', request_id: 'answer', kind: 'ask', result: { ok: true, text: '# Answer' }, insertion: 'not_requested' });
  emit({ event: 'history_entry', entry: { id: 'answer', kind: 'ask', outcome: 'answered', result: { text: '# Answer' } } });
  assert.equal(h.windows.length, 1);
  emit({ event: 'state', state: 'idle', request_id: 'answer' });
  assert.equal(h.windows.length, 2);
  h.windows[1].webContents.emit('did-finish-load'); assert.equal(h.windows[1].shows, 1);
  emit({ event: 'response', permissions: {} });
  emit({ event: 'state', state: 'idle', request_id: 'answer' });
  assert.equal(h.windows[1].shows, 1);
});
test('dictation, cancelled answers and stale answers never open a result window', async () => {
  for (const kind of ['dictation', 'cancelled', 'stale']) {
    const h = await harness(), emit = event => h.bridges[0].emit('event', event);
    emit({ event: 'state', state: 'asking', request_id: 'current' });
    emit({ event: 'result', request_id: kind === 'stale' ? 'old' : 'current', kind: kind === 'dictation' ? kind : 'ask', result: { ok: true, text: 'Answer' } });
    emit({ event: 'history_entry', entry: { id: 'current', outcome: 'answered' } });
    if (kind === 'cancelled') emit({ event: 'cancelled', request_id: 'current' });
    emit({ event: 'state', state: 'idle', request_id: 'current' });
    assert.equal(h.windows.length, 1, kind);
  }
});
test('new hold cancels a pending automatic result reveal even if hold ends before page load', async () => {
  const h = await harness(), emit = event => h.bridges[0].emit('event', event);
  emit({ event: 'state', state: 'asking', request_id: 'old' });
  emit({ event: 'result', request_id: 'old', kind: 'ask', result: { ok: true, text: 'Answer' } });
  emit({ event: 'history_entry', entry: { id: 'old', outcome: 'answered' } });
  emit({ event: 'state', state: 'idle', request_id: 'old' });
  emit({ event: 'state', state: 'recording', request_id: 'new' });
  emit({ event: 'state', state: 'idle', request_id: 'new', reason: 'short_tap' });
  h.windows[1].webContents.emit('did-finish-load');
  assert.equal(h.windows[1].shows, 0);
});

test('pill activation and Copy never open History or request a helper command', async () => {
  const h = await harness(), emit = event => h.bridges[0].emit('event', event);
  assert.equal(h.windows[0].options.type, 'panel'); assert.equal(h.windows[0].options.acceptFirstMouse, true);
  emit({event:'state', state:'recording',request_id:'voice'});
  emit({event:'result',request_id:'voice',kind:'dictation',result:{ok:true,text:'Exact dictated words'}});
  emit({event:'state',state:'idle',request_id:'voice'});
  h.app.emit('activate');
  assert.equal((await h.invoke({action:'copy-result',requestId:'voice'})).ok,true);
  assert.deepEqual(h.clip,['Exact dictated words']);
  assert.equal(h.windows.length,1); assert.equal(h.requests.length,0);
  assert.equal((await h.invoke({action:'copy-result',requestId:'old'})).ok,false);
  emit({event:'state',state:'verifying',request_id:'voice'});
  assert.equal((await h.invoke({action:'copy-result',requestId:'voice'})).ok,false);
  assert.equal(h.clip.length,1);
});
test('minimize resizes the actual overlay, preserves recording and suppresses automatic answer opening', async () => {
  const h = await harness(), emit = event => h.bridges[0].emit('event', event);
  emit({event:'state',state:'recording',request_id:'voice'});
  assert.equal((await h.invoke({action:'collapse-overlay',collapsed:true})).ok,true);
  assert.equal(h.windows[0].bounds.width,204); assert.equal(h.windows[0].bounds.height,82);
  assert.equal((await h.invoke({action:'snapshot'})).state.phase,'recording');
  emit({event:'state',state:'asking',request_id:'voice'});
  emit({event:'result',request_id:'voice',kind:'ask',result:{ok:true,text:'Answer'}});
  emit({event:'history_entry',entry:{id:'voice',kind:'ask',outcome:'answered'}});
  emit({event:'state',state:'idle',request_id:'voice'});
  assert.equal(h.windows.length,1);
  assert.equal((await h.invoke({action:'snapshot'})).state.overlayCollapsed,true);
  await h.invoke({action:'collapse-overlay',collapsed:false});
  assert.equal(h.windows[0].bounds.width,440);
  emit({event:'response',permissions:{}}); assert.equal(h.windows.length,1);
  assert.equal((await h.invoke({action:'open-panel',page:'result'})).ok,true);
});
test('minimizing a pending result window prevents its late load from reopening it', async () => {
  const h = await harness();
  await h.invoke({action:'open-panel',page:'result'});
  await h.invoke({action:'collapse-overlay',collapsed:true});
  h.windows[1].webContents.emit('did-finish-load');
  assert.equal(h.windows[1].shows,0); assert.equal(h.windows[1].hidden,true);
  assert.equal((await h.invoke({action:'collapse-overlay',collapsed:'yes'})).ok,false);
});
test('history Copy cannot overwrite the native clipboard during insertion', async () => {
  const h = await harness(), emit = event => h.bridges[0].emit('event', event);
  emit({event:'history_entry',entry:{id:'old',result:{text:'Older words'}}});
  emit({event:'state',state:'inserting',request_id:'new'});
  assert.equal((await h.invoke({action:'copy-entry',id:'old',part:'result'})).ok,false);
  assert.deepEqual(h.clip,[]);
});

test('dragged pill stays put through state changes, minimize and restart', async () => {
  const storage = {}, h = await harness({storage}), pill = h.windows[0];
  pill.emit('will-move'); pill.setBounds({x:0,y:450,width:440,height:128}); pill.emit('moved');
  const original = {...pill.bounds};
  h.app.emit('activate');
  h.bridges[0].emit('event',{event:'state',state:'transcribing',request_id:'voice'});
  assert.deepEqual(pill.bounds,original);
  await h.invoke({action:'collapse-overlay',collapsed:true});
  assert.equal(pill.bounds.x,0); assert.equal(pill.bounds.width,204);
  const compact = {...pill.bounds};
  h.app.quit(); await tick(); await tick();
  assert.ok(storage[path.join('/fixture/user-data', 'overlay-position.json')]);
  const reopened = await harness({storage});
  assert.deepEqual(reopened.windows[0].bounds,compact);
  await reopened.invoke({action:'collapse-overlay',collapsed:false});
  assert.deepEqual(reopened.windows[0].bounds,original);
});
