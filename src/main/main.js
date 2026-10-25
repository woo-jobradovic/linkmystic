// LinkMystic main process: windows, tray, settings, logs, and the engine process that owns the devices.
import { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell, utilityProcess, MessageChannelMain, nativeImage, clipboard, session } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULTS, sanitize, update } from '../engine/settings.js';
import { PRESETS, PUMP_MIN, FAN_MIN, LIQUID_CRITICAL } from '../engine/cooling.js';
import { diagnostics } from '../engine/diagnostics.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..', '..');
const simulate = process.argv.includes('--demo');
const startHidden = process.argv.includes('--hidden');

// a second copy must exit before it starts an engine: it would hand the first copy's hub back to hardware mode
const primary = app.requestSingleInstanceLock();
if (!primary) app.exit(0);

const dataDir = app.getPath('userData');
const settingsFile = path.join(dataDir, 'settings.json');
const imageDir = path.join(dataDir, 'lcd-images');
const logDir = path.join(dataDir, 'logs');
const logFile = path.join(logDir, 'linkmystic.log');
let settings = DEFAULTS;
let state = {};
let win = null, lcdWin = null, tray = null, engine = null, quitting = false;
const logBuffer = [];

// ---------- logging ----------
// logs get pasted into public issues: never include the Windows user folder or raw HID device paths
const HOME = os.homedir();
const redactLine = l => l.split(HOME).join('~').replace(/\\\\\?\\hid#[^\s,)]+/gi, '<hid-path>');
function log(line) {
  const l = redactLine(line.match(/^\d{4}-\d\d-\d\dT/) ? line : `${new Date().toISOString()} ${line}`);
  logBuffer.push(l); if (logBuffer.length > 2000) logBuffer.shift();
  try {
    fs.mkdirSync(logDir, { recursive: true });
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 2e6) fs.renameSync(logFile, `${logFile}.1`);
    fs.appendFileSync(logFile, l + '\n');
  } catch { /* logging must never stop the app */ }
  win?.webContents.send('log', l);
}

// ---------- settings ----------
function loadSettings() {
  try { settings = sanitize(JSON.parse(fs.readFileSync(settingsFile, 'utf8'))); }
  catch { settings = sanitize(DEFAULTS); }
}
function saveSettings() {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = settingsFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(settings, null, 2));
  fs.renameSync(tmp, settingsFile);
}
function applyLoginItem() {
  if (!app.isPackaged) return;     // never register a dev build to start with Windows
  app.setLoginItemSettings({ openAtLogin: settings.app.startWithWindows, args: settings.app.startMinimized ? ['--hidden'] : [] });
}

// ---------- engine process ----------
function startEngine() {
  engine = utilityProcess.fork(path.join(root, 'src', 'engine', 'process.js'), [], { serviceName: 'LinkMystic engine', stdio: 'pipe' });
  engine.stdout?.on('data', d => log(String(d).trim()));
  engine.stderr?.on('data', d => log(`engine: ${String(d).trim()}`));
  engine.on('message', msg => {
    if (msg?.type === 'state') { state = msg.state; win?.webContents.send('state', state); lcdWin?.webContents.send('state', state); tray?.setToolTip(trayText()); }
    else if (msg?.type === 'log') log(msg.line);
  });
  engine.on('exit', code => {
    engine = null;
    if (!quitting) { log(`engine stopped (code ${code}) - restarting in 3 s (if it could not hand the hub back, the hub returns to its stored profile by itself after about 10 s without updates)`); setTimeout(() => { if (!quitting) { startEngine(); connectLcd(); } }, 3000); }
  });
  engine.postMessage({ type: 'start', settings, simulate });
}

// LCD frames go renderer window -> engine directly over a MessagePort (no copy through the main process)
function connectLcd() {
  if (!engine || !lcdWin) return;
  const { port1, port2 } = new MessageChannelMain();
  engine.postMessage({ type: 'lcd-port' }, [port2]);
  lcdWin.webContents.postMessage('lcd-port', null, [port1]);
}

const trayText = () => {
  const s = state;
  const parts = ['LinkMystic'];
  if (Number.isFinite(s.liquid)) parts.push(`liquid ${s.liquid.toFixed(1)} °C`);
  if (Number.isFinite(s.pumpRpm)) parts.push(`pump ${s.pumpRpm} rpm`);
  if (s.alarm) parts.push(`ALARM: ${s.alarm}`);
  return parts.join(' | ').slice(0, 127);
};

// ---------- windows ----------
const secure = { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(here, 'preload.cjs') };
function lockDown(w) {
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', e => e.preventDefault());
  // a crashed renderer (e.g. a bad image) is reloaded instead of leaving a frozen window or LCD
  w.webContents.on('render-process-gone', (_e, d) => {
    log(`window renderer stopped (${d.reason}) - reloading`);
    if (!quitting && !w.isDestroyed()) w.webContents.reload();
  });
}
function createWindow() {
  if (win) { win.show(); win.focus(); return; }
  win = new BrowserWindow({
    width: 1100, height: 760, minWidth: 900, minHeight: 620, backgroundColor: '#0d0f14', title: 'LinkMystic',
    icon: path.join(root, 'assets', 'icon.ico'), autoHideMenuBar: true, show: false, webPreferences: secure,
  });
  lockDown(win);
  win.loadFile(path.join(root, 'src', 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide(); } });     // closing the window keeps lights and cooling running
  win.on('closed', () => { win = null; });
}
function createLcdWindow() {
  lcdWin = new BrowserWindow({ width: 480, height: 480, show: false, webPreferences: { ...secure, preload: path.join(here, 'preload-lcd.cjs'), backgroundThrottling: false } });
  lockDown(lcdWin);
  lcdWin.loadFile(path.join(root, 'src', 'lcd', 'lcd.html'));
  // also after a reload: resend settings and state and give it a fresh frame port
  lcdWin.webContents.on('did-finish-load', () => { lcdWin.webContents.send('settings', settings); lcdWin.webContents.send('state', state); connectLcd(); });
}
function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(root, 'assets', 'icon.ico')));
  tray.setToolTip('LinkMystic');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open LinkMystic', click: createWindow },
    { type: 'separator' },
    { label: 'Quit (hub falls back to its stored profile)', click: () => quit() },
  ]));
  tray.on('click', createWindow);
}

async function quit() {
  if (quitting) return;
  quitting = true;
  log('quitting: handing devices back');
  if (engine) {
    const done = new Promise(r => { engine.once('exit', r); setTimeout(r, 10000); });
    engine.postMessage({ type: 'stop' });
    await done;
  }
  app.exit(0);
}

// ---------- IPC (every handler validates its sender and its input) ----------
// Only our own two windows, showing our own local pages, may call the main process.
// The hidden LCD window decodes user images, so it may only fetch its image; everything else is main-window only.
const LCD_CHANNELS = new Set(['lcd:get-image']);
function trusted(e, channel) {
  const url = e.senderFrame?.url || '';
  if (!url.startsWith('file://')) return false;
  if (e.sender === win?.webContents) return true;
  return e.sender === lcdWin?.webContents && LCD_CHANNELS.has(channel);
}
function handle(channel, fn) {
  ipcMain.handle(channel, (e, ...args) => {
    if (!trusted(e, channel)) { log(`refused IPC ${channel} from an untrusted sender`); throw new Error('untrusted sender'); }
    return fn(e, ...args);
  });
}
function ipc() {
  handle('app:version', () => app.getVersion());
  handle('state:get', () => state);
  handle('settings:get', () => settings);
  handle('cooling:presets', () => ({ presets: PRESETS, PUMP_MIN, FAN_MIN, LIQUID_CRITICAL }));
  handle('settings:set', (_e, patch) => {
    if (typeof patch !== 'object' || patch === null) return settings;
    settings = update(settings, patch);
    saveSettings();
    applyLoginItem();
    engine?.postMessage({ type: 'settings', settings });
    lcdWin?.webContents.send('settings', settings);
    return settings;
  });
  handle('logs:get', () => logBuffer.slice(-500));
  handle('logs:open-folder', () => shell.openPath(logDir));
  handle('diagnostics', async () => {
    const text = simulate ? 'diagnostics are not available in demo mode' : await diagnostics(app.getVersion(), state);
    clipboard.writeText(text);
    return text;
  });
  handle('lcd:pick-image', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Choose an LCD image', properties: ['openFile'], filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }] });
    if (r.canceled || !r.filePaths[0]) return null;
    const src = r.filePaths[0];
    if (fs.statSync(src).size > 20e6) { dialog.showErrorBox('LinkMystic', 'Please choose an image smaller than 20 MB.'); return null; }
    const ext = path.extname(src).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) { dialog.showErrorBox('LinkMystic', 'Please choose a PNG, JPG, GIF or WebP image.'); return null; }
    const name = `lcd-${Date.now()}${ext}`;
    fs.mkdirSync(imageDir, { recursive: true });
    fs.copyFileSync(src, path.join(imageDir, name));
    // keep only the newest copy (these are LinkMystic's own copies, never the user's original file)
    for (const old of fs.readdirSync(imageDir)) {
      if (old !== name && /^lcd-\d+\.(png|jpe?g|gif|webp)$/.test(old)) fs.rmSync(path.join(imageDir, old), { force: true });
    }
    return name;
  });
  handle('lcd:get-image', (_e, name) => {
    if (typeof name !== 'string' || !/^lcd-\d+\.(png|jpe?g|gif|webp)$/.test(name)) return null;
    const file = path.join(imageDir, name);
    if (!fs.existsSync(file)) return null;
    const ext = path.extname(name).slice(1);
    return { data: fs.readFileSync(file), type: `image/${ext === 'jpg' ? 'jpeg' : ext}` };
  });
  handle('open:external', (_e, what) => {
    const urls = { repo: 'https://github.com/woo-jobradovic/linkmystic', issues: 'https://github.com/woo-jobradovic/linkmystic/issues/new/choose' };
    if (typeof what === 'string' && Object.hasOwn(urls, what)) shell.openExternal(urls[what]);
  });
  handle('app:quit', () => quit());
}

app.on('second-instance', () => createWindow());
app.on('window-all-closed', e => e?.preventDefault?.());     // stay in the tray
app.on('before-quit', e => { if (primary && !quitting) { e.preventDefault(); quit(); } });

app.whenReady().then(() => {
  if (!primary) return;
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));   // no camera, mic, notifications, ...
  session.defaultSession.setPermissionCheckHandler(() => false);
  loadSettings();
  log(`LinkMystic ${app.getVersion()} starting${simulate ? ' (demo mode)' : ''}`);
  ipc();
  applyLoginItem();
  createTray();
  startEngine();
  createLcdWindow();
  if (!startHidden) createWindow();
  if (process.env.LM_SCREENSHOT && !app.isPackaged) screenshots(process.env.LM_SCREENSHOT);
});

// Development aid (only when LM_SCREENSHOT=<folder> is set): saves one PNG per tab, then quits.
async function screenshots(dir) {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await wait(6000);
  fs.mkdirSync(dir, { recursive: true });
  for (const tab of ['dash', 'light', 'cool', 'lcd', 'msi', 'devices', 'logs', 'settings']) {
    await win.webContents.executeJavaScript(`document.querySelector('nav button[data-tab="${tab}"]').click()`);
    await wait(1200);
    fs.writeFileSync(path.join(dir, `${tab}.png`), (await win.webContents.capturePage()).toPNG());
  }
  quit();
}
