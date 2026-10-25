// Development aid: renders every LCD theme (or the ones named) into one contact-sheet PNG, at a few moments of
// their animation plus one hot reading, clipped to the round screen, and prints each theme's draw cost.
//   npx electron scripts/theme-sheet.cjs out.png [themeId,themeId]
const { app, BrowserWindow } = require('electron');
const path = require('node:path');
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false } });
  w.webContents.on('console-message', e => { if (e.level !== 'warning') console.log(e.message); });
  w.webContents.on('ipc-message', () => app.quit());
  await w.loadFile(path.join(__dirname, 'theme-sheet.html'), { query: { out: path.resolve(process.argv[2] || 'theme-sheet.png'), ids: process.argv[3] || '' } });
  setTimeout(() => app.quit(), 120000);
});
