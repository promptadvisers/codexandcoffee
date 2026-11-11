'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const subscribe = (channel, callback) => {
  if (typeof callback !== 'function') throw new TypeError('Expected callback');
  const listener = (_event, value) => callback(value);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};
// No raw ipcRenderer, filesystem, process, clipboard, or arbitrary channel access.
contextBridge.exposeInMainWorld('relay', Object.freeze({
  platform: process.platform,
  saveProviderKeys: keys => ipcRenderer.invoke('relay:action', { action: 'save-provider-keys', keys }),
  snapshot: () => ipcRenderer.invoke('relay:action', { action: 'snapshot' }),
  command: payload => ipcRenderer.invoke('relay:action', { action: 'command', payload }),
  openPanel: page => ipcRenderer.invoke('relay:action', { action: 'open-panel', page }),
  hideOverlay: () => ipcRenderer.invoke('relay:action', { action: 'hide-overlay' }),
  collapseOverlay: collapsed => ipcRenderer.invoke('relay:action', { action: 'collapse-overlay', collapsed }),
  copyResult: requestId => ipcRenderer.invoke('relay:action', { action: 'copy-result', requestId }),
  openSource: url => ipcRenderer.invoke('relay:action', { action: 'open-source', url }),
  systemSettings: kind => ipcRenderer.invoke('relay:action', { action: 'system-settings', kind }),
  copyEntry: (id, part) => ipcRenderer.invoke('relay:action', { action: 'copy-entry', id, part }),
  onState: callback => subscribe('relay:state', callback),
  onPage: callback => subscribe('relay:page', callback)
}));
