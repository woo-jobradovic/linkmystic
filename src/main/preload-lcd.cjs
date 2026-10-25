// Minimal bridge for the hidden LCD renderer window. It decodes user-chosen images, so it gets as little as possible:
// receive settings/state, fetch the chosen LCD image, and the port that carries finished frames to the engine.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lm', {
  onState: cb => ipcRenderer.on('state', (_e, s) => cb(s)),
  onSettings: cb => ipcRenderer.on('settings', (_e, s) => cb(s)),
  getLcdImage: name => ipcRenderer.invoke('lcd:get-image', name),
});
// a MessagePort cannot cross contextBridge, so it is transferred to the page with window.postMessage (Electron's documented way)
ipcRenderer.on('lcd-port', e => window.postMessage('lm-lcd-port', '*', e.ports));
