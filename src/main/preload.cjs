// Bridge between the sandboxed windows and the main process. Only these calls exist; no Node access in the UI.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lm', {
  version: () => ipcRenderer.invoke('app:version'),
  getState: () => ipcRenderer.invoke('state:get'),
  onState: cb => ipcRenderer.on('state', (_e, s) => cb(s)),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: patch => ipcRenderer.invoke('settings:set', patch),
  onSettings: cb => ipcRenderer.on('settings', (_e, s) => cb(s)),
  presets: () => ipcRenderer.invoke('cooling:presets'),
  getLogs: () => ipcRenderer.invoke('logs:get'),
  onLog: cb => ipcRenderer.on('log', (_e, line) => cb(line)),
  diagnostics: () => ipcRenderer.invoke('diagnostics'),
  openLogsFolder: () => ipcRenderer.invoke('logs:open-folder'),
  pickLcdImage: () => ipcRenderer.invoke('lcd:pick-image'),
  getLcdImage: name => ipcRenderer.invoke('lcd:get-image', name),
  openExternal: what => ipcRenderer.invoke('open:external', what),
  quit: () => ipcRenderer.invoke('app:quit'),
});
