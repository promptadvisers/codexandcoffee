'use strict';
const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, protocol, session, screen, shell, clipboard, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { HelperBridge } = require('./lib/bridge.cjs');
const { ProviderVault, helperEnvironment } = require('./lib/config.cjs');
const { validPlacement, rememberPlacement, placedBounds } = require('./lib/placement.cjs');
const { initialState, reduce } = require('./lib/state.cjs');
const { actionTrace } = require('./lib/trace.cjs');
const { commandPayload, trustedSender, canOpenPanel, overlayBounds, externalURL, PAGES } = require('./lib/policy.cjs');

app.setName('Relay Voice');
app.setPath('userData', process.env.RELAY_SMOKE_DIR ? path.resolve(process.env.RELAY_SMOKE_DIR) : path.join(app.getPath('appData'), 'Relay Voice Community'));
let providerVault, providerKeys = {}, helperExecutable, nativeDir;
app.enableSandbox();
protocol.registerSchemesAsPrivileged([{ scheme: 'relay', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
let overlay, panel, tray, bridge, quitting = false, exited = false, hiddenOverlay = false;
let state = initialState();
let placement = null, draggingOverlay = false, placementWrites = Promise.resolve();
let placementPath;
let shownAnswer = '', panelPage = 'history', panelRequest = '', panelWanted = false;
const iconPath = app.isPackaged ? path.join(process.resourcesPath, 'relay-voice-icon.png') : path.join(__dirname, '../assets/relay-voice-icon.png');
const assets = new Map([
  ['/markdown.js', ['ui/markdown.js', 'text/javascript']],
  ['/vendor/marked.js', ['ui/vendor/marked.js', 'text/javascript']],
  ['/services/firecrawl.png', ['ui/services/firecrawl.png', 'image/png']],
  ['/services/google.png', ['ui/services/google.png', 'image/png']],
  ['/services/gmail.svg', ['ui/services/gmail.svg', 'image/svg+xml']],
  ['/index.html', ['ui/index.html', 'text/html']], ['/overlay.html', ['ui/overlay.html', 'text/html']],
  ['/renderer.js', ['ui/renderer.js', 'text/javascript']], ['/overlay.js', ['ui/overlay.js', 'text/javascript']],
  ['/styles.css', ['ui/styles.css', 'text/css']], ['/overlay.css', ['ui/overlay.css', 'text/css']],
  ['/services/firecrawl-active.png', ['ui/services/firecrawl-active.png', 'image/png']],
  ['/view.js', ['ui/view.js', 'text/javascript']], ['/icon.png', [null, 'image/png']]
]);
function publish(meterOnly = false) {
  // Audio ticks never copy the private history or redraw the secondary window.
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send('relay:state', { ...state, history: [] });
  if (!meterOnly && panel && !panel.isDestroyed()) panel.webContents.send('relay:state', state);
}
function savePlacement() {
  const contents = JSON.stringify({ placement, collapsed: state.overlayCollapsed });
  placementWrites = placementWrites.then(async () => {
    await fs.mkdir(path.dirname(placementPath), { recursive: true });
    await fs.writeFile(`${placementPath}.tmp`, contents, { mode: 0o600 });
    await fs.rename(`${placementPath}.tmp`, placementPath);
  }).catch(() => {});
}
function placeOverlay() {
  if (!overlay || overlay.isDestroyed() || draggingOverlay) return;
  overlay.setBounds(placedBounds(placement, screen.getAllDisplays(), screen.getPrimaryDisplay(), state.overlayCollapsed), false);
}
function resetOverlayPosition() {
  placement = null; draggingOverlay = false; placeOverlay(); savePlacement(); revealOverlay();
}
function revealOverlay() {
  if (!overlay || overlay.isDestroyed()) return;
  hiddenOverlay = false; placeOverlay(); overlay.showInactive();
}
function lockWindow(win) {
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.webContents.on('render-process-gone', () => {
    bridge?.request({ command: 'cancel' }).catch(() => {});
    state = reduce(state, { event: 'error', code: 'renderer', message: 'A Relay Voice window stopped. Quit and reopen the app.' });
    publish();
  });
}
function preferences() {
  return { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true, allowRunningInsecureContent: false, webviewTag: false, devTools: !app.isPackaged, spellcheck: false, backgroundThrottling: false };
}
function makeOverlay() {
  overlay = new BrowserWindow({ ...placedBounds(placement, screen.getAllDisplays(), screen.getPrimaryDisplay(), state.overlayCollapsed), title: 'Relay Voice', icon: iconPath, ...(process.platform === 'darwin' ? { type: 'panel' } : {}), acceptFirstMouse: true, frame: false, transparent: true, backgroundColor: '#00000000', show: false, focusable: false, alwaysOnTop: true, resizable: false, movable: true, minimizable: false, maximizable: false, fullscreenable: false, hasShadow: false, skipTaskbar: true, webPreferences: preferences() });
  overlay.on('will-move', () => { draggingOverlay = true; });
  overlay.on('moved', () => {
    if (!draggingOverlay) return;
    draggingOverlay = false;
    const bounds = overlay.getBounds();
    placement = rememberPlacement(bounds, screen.getDisplayMatching(bounds));
    placeOverlay(); savePlacement();
  });
  overlay.setAlwaysOnTop(true, 'floating');
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  lockWindow(overlay);
  overlay.webContents.once('did-finish-load', () => { publish(); if (!hiddenOverlay) overlay.showInactive(); });
  overlay.loadURL('relay://app/overlay.html');
}
function showPanel(page = 'history') {
  // Every entry point, including Dock/tray/IPC, shares this focus guard.
  if (!canOpenPanel(state)) return false;
  panelWanted = true;
  panelPage = page; panelRequest = state.requestId;
  if (!panel || panel.isDestroyed()) {
    panel = new BrowserWindow({ width: 1040, height: 740, minWidth: 780, minHeight: 590, title: 'Relay Voice', icon: iconPath, show: false, backgroundColor: '#111715', titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 20, y: 21 }, webPreferences: preferences() });
    lockWindow(panel);
    panel.on('close', event => { if (!quitting) { event.preventDefault(); panelWanted = false; panel.hide(); } });
    panel.webContents.once('did-finish-load', () => {
      publish(); panel.webContents.send('relay:page', panelPage);
      // A key hold can begin while the window loads.
      if (panelWanted && canOpenPanel(state) && (panelPage !== 'result' || panelRequest === state.requestId)) panel.show();
    });
    panel.on('focus', () => { if (bridge?.ready) bridge.request({ command: 'permissions' }).catch(() => {}); });
    panel.loadURL('relay://app/index.html');
  } else { panel.webContents.send('relay:page', page); panel.show(); }
  return true;
}
function menu() {
  const available = canOpenPanel(state);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Relay Voice', enabled: false },
    { label: state.online ? (state.permissions.shortcut ? (process.platform === 'win32' ? 'Hold Ctrl+Shift+Space to speak' : 'Hold Option to speak') : 'Shortcut unavailable · open setup') : 'Voice helper unavailable', enabled: false },
    { type: 'separator' },
    { label: 'History', enabled: available, click: () => showPanel('history') },
    { label: 'Ask Relay', enabled: available, click: () => showPanel('ask') },
    { label: 'Settings & setup', enabled: available, click: () => showPanel('settings') },
    { label: 'Show voice pill', click: revealOverlay },
    { label: 'Reset voice pill position', click: resetOverlayPosition },
    { label: 'Cancel current request', enabled: !available, click: () => bridge.request({ command: 'cancel' }).catch(() => {}) },
    { type: 'separator' }, { label: 'Quit Relay Voice', click: () => app.quit() }
  ]));
}
function handleEvent(event) {
  state = reduce(state, event); publish(event.event === 'meter');
  // The helper saves the answer before going idle. Never focus a window mid-hold.
  if (state.phase === 'idle' && !state.error && state.result?.kind === 'ask'
      && state.result.request_id === state.requestId && state.result.result?.ok
      && state.history.some(entry => entry.id === state.requestId && entry.outcome === 'answered')
      && shownAnswer !== state.requestId) {
    shownAnswer = state.requestId;
    if (!state.overlayCollapsed) showPanel('result');
  }
  if (event.event !== 'meter' && event.event !== 'transcript') menu();
  if (['state', 'error', 'offline', 'result', 'warning'].includes(event.event)) {
    if (event.event !== 'state' || !['idle', 'status'].includes(event.state)) revealOverlay();
  }
  if (event.event === 'ready') {
    bridge.request({ command: 'history_get' }).catch(() => {});
    // Provider checks are explicit; startup never performs a Gmail read.
  }
}
async function action(event, input) {
  if (!trustedSender(event, [overlay, panel])) return { ok: false, error: 'Untrusted window.' };
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid action.');
    switch (input.action) {
      case 'snapshot': return { ok: true, state, platform: process.platform, keys: { gemini: !!providerKeys.gemini, firecrawl: !!providerKeys.firecrawl } };
      case 'save-provider-keys': {
        if (!canOpenPanel(state)) throw new Error('Finish the current request first.');
        const configured = await providerVault.save(input.keys);
        providerKeys = await providerVault.read();
        const previous = bridge;
        previous?.removeAllListeners();
        await previous?.stop();
        startHelper();
        return { ok: true, keys: configured };
      }
      case 'collapse-overlay':
        if (typeof input.collapsed !== 'boolean') throw new Error('Invalid compact view.');
        state = { ...state, overlayCollapsed: input.collapsed };
        if (input.collapsed) { panelWanted = false; panel?.hide(); }
        placeOverlay(); savePlacement(); publish(); revealOverlay(); return { ok: true };
      case 'copy-result': {
        if (!canOpenPanel(state)) throw new Error('Finish the current request before copying.');
        const result = state.result;
        if (!result || input.requestId !== result.request_id || result.request_id !== state.requestId || !result.result?.text) throw new Error('This result is no longer available.');
        clipboard.writeText(result.result.text); return { ok: true };
      }
      case 'command': return await bridge.request(commandPayload(input.payload));
      case 'open-panel':
        if (!PAGES.has(input.page)) throw new Error('Unknown page.');
        return { ok: showPanel(input.page), error: canOpenPanel(state) ? undefined : 'Finish or cancel the current request first.' };
      case 'hide-overlay':
        if (!canOpenPanel(state)) throw new Error('Finish or cancel the current request first.');
        hiddenOverlay = true; overlay.hide(); return { ok: true };
      case 'open-source': {
        if (!canOpenPanel(state)) throw new Error('Finish or cancel the current request first.');
        const url = externalURL(input.url);
        // Only links supplied by actual results can leave the app.
        const sources = [...(state.result?.result?.sources || []), ...state.history.flatMap(entry => entry.result?.sources || [])];
        if (!sources.some(source => { try { return externalURL(source.url) === url; } catch { return false; } })) throw new Error('This source is not in your results.');
        await shell.openExternal(url); return { ok: true };
      }
      case 'system-settings': {
        if (!canOpenPanel(state)) throw new Error('Finish or cancel the current request first.');
        const destinations = process.platform === 'win32' ? { microphone: 'ms-settings:privacy-microphone', accessibility: 'ms-settings:easeofaccess' } : { microphone: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone', accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility' };
        if (!Object.hasOwn(destinations, input.kind)) throw new Error('Unknown setting.');
        await shell.openExternal(destinations[input.kind]); return { ok: true };
      }
      case 'copy-entry': {
        if (!canOpenPanel(state)) throw new Error('Finish the current request before copying.');
        const entry = state.history.find(item => item.id === input.id);
        if (!entry) throw new Error('This history entry is no longer available.');
        const text = input.part === 'draft' ? entry.result?.draft?.body : input.part === 'result' ? entry.result?.text : input.part === 'request' ? entry.request : input.part === 'trace' ? actionTrace(entry) : undefined;
        if (typeof text !== 'string' || !text) throw new Error('There is no text to copy.');
        clipboard.writeText(text); return { ok: true };
      }
      default: throw new Error('This action is not available.');
    }
  } catch (error) { return { ok: false, error: error.message || 'The action could not be completed.' }; }
}

function startHelper() {
  const env = helperEnvironment(process.env, providerKeys, app.getPath('userData'), nativeDir, process.platform);
  env.RELAY_HOST_PID = String(process.pid);
  if (process.env.RELAY_SMOKE_DIR) env.RELAY_NO_SHORTCUTS = '1';
  bridge = new HelperBridge({ executable: helperExecutable, env });
  bridge.on('event', handleEvent);
  bridge.start();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (!showPanel('history')) revealOverlay(); });
  // macOS can activate the app when its non-focusing pill is clicked. A Copy or
  // minimize click must never become an implicit request to open History.
  app.on('activate', revealOverlay);
  app.on('window-all-closed', () => {});
  app.on('before-quit', event => {
    if (exited) return;
    event.preventDefault();
    if (quitting) return;
    quitting = true;
    Promise.allSettled([bridge?.stop(), placementWrites]).finally(() => { exited = true; app.quit(); });
  });
  process.on('SIGTERM', () => app.quit());
  process.on('SIGINT', () => app.quit());
  process.on('exit', () => { bridge?.child?.stdin?.end(); });
  app.whenReady().then(async () => {
    protocol.handle('relay', async request => {
      const url = new URL(request.url);
      const entry = url.host === 'app' && !url.search ? assets.get(url.pathname) : undefined;
      if (!entry) return new Response('Not found', { status: 404 });
      try { return new Response(await fs.readFile(entry[0] ? path.join(__dirname, entry[0]) : iconPath), { headers: { 'Content-Type': entry[1], 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } }); }
      catch { return new Response('Not found', { status: 404 }); }
    });
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !details.url.startsWith('relay://app/') }));
    session.defaultSession.on('will-download', event => event.preventDefault());
    app.dock?.setIcon(nativeImage.createFromPath(iconPath));
    tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 19, height: 19 }));
    tray.setToolTip('Relay Voice'); tray.on('click', () => { if (!showPanel('history')) revealOverlay(); });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: 'Relay Voice', submenu: [{ label: 'About Relay Voice', role: 'about' }, { label: 'Settings…', accelerator: 'CmdOrCtrl+,', click: () => showPanel('settings') }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] },
      { role: 'editMenu' }, { label: 'Window', submenu: [{ label: 'History', click: () => showPanel('history') }, { label: 'Show voice pill', click: revealOverlay }, { role: 'minimize' }, { role: 'close' }] }
    ]));
    app.setAboutPanelOptions({ applicationName: 'Relay Voice', applicationVersion: app.getVersion(), iconPath, copyright: 'Hold to speak. Release to write.' });
    ipcMain.handle('relay:action', action);
    placementPath = path.join(app.getPath('userData'), 'overlay-position.json');
    try {
      const saved = JSON.parse(await fs.readFile(placementPath, 'utf8'));
      if (validPlacement(saved.placement)) placement = saved.placement;
      state.overlayCollapsed = saved.collapsed === true;
    } catch { /* Missing or invalid preferences fall back to the default position. */ }
    makeOverlay(); menu();
    screen.on('display-metrics-changed', placeOverlay);
    screen.on('display-removed', placeOverlay);
    screen.on('display-added', placeOverlay);
    nativeDir = app.isPackaged ? path.join(process.resourcesPath, 'native') : path.join(__dirname, '../dist/helper');
    helperExecutable = path.join(nativeDir, process.platform === 'win32' ? 'relay-voice-helper.exe' : 'relay-voice-helper');
    providerVault = new ProviderVault(path.join(app.getPath('userData'), 'providers.json'), safeStorage);
    try { providerKeys = await providerVault.read(); } catch (error) { state.warning = { message: error.message }; }
    startHelper();
    if (!providerKeys.gemini) showPanel('settings');
    if (process.env.RELAY_SMOKE_DIR) {
      const deadline = Date.now() + 15000;
      while ((!bridge.ready || !panel || panel.webContents.isLoading()) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
      if (!bridge.ready || !panel || panel.webContents.isLoading()) throw new Error('Smoke setup did not become ready.');
      const history = await bridge.request({ command: 'history_get' });
      const provider = await bridge.request({ command: 'permissions' });
      const page = await panel.webContents.executeJavaScript(`({ title: document.title, inputs: [...document.querySelectorAll('input[type="password"]')].map(input => ({ name: input.name, empty: input.value === '' })), text: document.body.innerText })`);
      const report = { version: app.getVersion(), platform: process.platform, helperReady: bridge.ready, historyEmpty: history.entries?.length === 0, keysEmpty: !providerKeys.gemini && !providerKeys.firecrawl, provider, page };
      await fs.mkdir(app.getPath('userData'), { recursive: true });
      await fs.writeFile(path.join(app.getPath('userData'), 'smoke-report.json'), JSON.stringify(report, null, 2));
      const capture = await panel.webContents.capturePage();
      await fs.writeFile(path.join(app.getPath('userData'), 'setup.png'), capture.toPNG());
      if (!report.historyEmpty || !report.keysEmpty || !page.inputs.length || !page.inputs.every(input => input.empty)) process.exitCode = 1;
      app.quit();
    }
  }).catch(async error => { if (process.env.RELAY_SMOKE_DIR) { await fs.mkdir(app.getPath('userData'), { recursive: true }); await fs.writeFile(path.join(app.getPath('userData'), 'smoke-error.txt'), error.message); process.exitCode = 1; app.quit(); } state = reduce(state, { event: 'offline', message: 'Relay Voice could not initialize. Quit and rebuild the app.' }); publish(); });
}
