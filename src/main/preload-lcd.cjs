// Minimal bridge for the hidden LCD renderer window. It decodes user-chosen images, so it gets as little as possible:
// receive settings/state, fetch the chosen LCD image, and the port that carries finished frames to the engine.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lm', {
  onState: cb => ipcRenderer.on('state', (_e, s) => cb(s)),
  onSettings: cb => ipcRenderer.on('settings', (_e, s) => cb(s)),
  getLcdImage: name => ipcRenderer.invoke('lcd:get-image', name),
  onLcdPort: cb => ipcRenderer.on('lcd-port', e => cb(e.ports[0])),
});
