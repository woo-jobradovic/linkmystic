// The engine: finds devices, runs cooling (with safety), lighting, the MSI board, PSU monitoring and the LCD.
// Runs in its own process. Every LINK hub is handed back to hardware mode (its stored profile) on stop.
import { listHid, match, LinkHub, MsiBoard, LcdScreen, Psu } from './devices.js';
import { baseboard, conflicts } from './system.js';
import { decideDuties, PUMP_STALL_RPM } from './cooling.js';
import { render, tempColor, hexToRgb, isAnimated } from './effects.js';
import { isSupportedBoard, MODES, HEADERS } from './proto/msi.js';
import { SimHub, SimMsi, SimPsu, simHid } from './sim.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const redact = s => (s ? `${String(s).slice(0, 4)}…` : '');

const LIGHTS_FPS = 30;

export class Engine {
  constructor({ settings, log = () => {}, emit = () => {}, simulate = false }) {
    Object.assign(this, { settings, log, emit, simulate });
    this.t0 = Date.now();
    this.stopping = false;
    this.hubs = [];             // { hub, pumps, stall, status }
    this.msi = null; this.lcd = null; this.psu = null;
    this.board = null; this.blocked = { corsair: false, msi: false };
    this.live = { liquid: null, pumpRpm: null, fanRpm: [], duties: {}, alarm: null, msi: 'not found', lcd: 'not found', psu: null, conflicts: [] };
    this.lcdFrames = 0; this.lcdSince = Date.now();
  }

  now() { return (Date.now() - this.t0) / 1000; }

  async start() {
    try { this.board = this.simulate ? { manufacturer: 'Demo', product: 'MAG X870E TOMAHAWK WIFI (MS-7E59)' } : await baseboard(); }
    catch { this.board = { manufacturer: '', product: '' }; }
    this.log(`board: ${this.board.manufacturer} ${this.board.product}`);
    // timers first: a failed first discovery must never leave the engine without its loops
    this.timers = [
      setInterval(() => this.coolingTick(), 1000),
      setInterval(() => this.refresh(), 15000),
      setInterval(() => this.psuTick(), 2000),
      setInterval(() => this.emit('state', this.state()), 1000),
    ];
    this.lightsLoop();
    await this.refresh();
    this.msiLoop();
    this.coolingTick();
  }

  // conflict check + discovery, never overlapping and never throwing
  async refresh() {
    if (this.discovering || this.stopping) return;
    this.discovering = true;
    try { await this.checkConflicts(); await this.discover(); }
    catch (e) { this.log(`device scan failed: ${e.message}`); }
    finally { this.discovering = false; }
  }

  async checkConflicts() {
    const list = this.simulate ? [] : await conflicts();
    if (list === null) return;                     // process list unavailable: keep the previous decision (fail closed)
    this.live.conflicts = list;
    const corsair = list.some(c => c.family === 'corsair' || c.family === 'both');
    const msi = list.some(c => c.family === 'msi' || c.family === 'both');
    if (corsair && !this.blocked.corsair) { this.log(`other software is using Corsair devices (${list.map(c => c.process).join(', ')}): releasing them`); this.releaseHubs(); }
    if (msi && !this.blocked.msi) { this.log('other software is using the MSI board: leaving it alone'); await this.msi?.close(); this.msi = null; this.live.msi = 'paused: other MSI lighting software is running'; }
    this.blocked = { corsair, msi };
  }

  makeHub(info) { return this.simulate ? new SimHub(info) : new LinkHub(info); }   // tests replace this

  // Open one LINK hub. Anything short of a fully recognised hub is handed straight back to its stored profile.
  openHub(info) {
    let hub;
    try {
      hub = this.makeHub(info);
      const fw = hub.firmware();
      hub.enterSoftwareMode();
      const devs = hub.enumerate();
      const unknown = devs.filter(d => d.kind === 'unknown');
      const controllable = devs.filter(d => d.kind === 'pump' || d.kind === 'fan');
      if (!devs.length) throw new Error('hub reported no devices (will retry)');
      if (unknown.length) throw new Error(`unsupported device(s) on this hub (${unknown.map(d => d.name).join(', ')}) - left on its stored profile`);
      if (!controllable.length) throw new Error('no fans or pump on this hub - left on its stored profile');
      this.hubs.push({ hub, fw, stall: 0, status: 'ok' });
      this.log(`LINK hub ${redact(info.serialNumber)} fw ${fw}: ${devs.map(d => `ch${d.channel} ${d.name}`).join(', ')}`);
    } catch (e) {
      this.log(`LINK hub not used: ${e.message}`);
      try { hub?.close(); } catch { /* best effort: the hub falls back to its stored profile on its own */ }
    }
  }

  async discover() {
    const all = this.simulate ? simHid() : await listHid();
    if (!this.blocked.corsair) {
      for (const info of all.filter(match.linkHub)) if (!this.hubs.some(h => h.hub.info.path === info.path)) this.openHub(info);
      // opened even when switched off: off = backlight 0 + black frames, so the screen goes dark at once
      // (released, the screen keeps its last picture for ~30 s before showing its own)
      if (!this.lcd) {
        const info = all.find(match.lcd);
        if (info) {
          try { this.lcd = await LcdScreen.open(info, { simulate: this.simulate }); await this.lcd.brightness(this.lcdBrightness()); this.live.lcd = this.lcdStatus(); this.lcdErrors = 0; this.log('pump LCD ready'); }
          catch (e) { await this.lcd?.close(); this.lcd = null; this.live.lcd = `unavailable: ${e.message}`; }
        }
      }
      if (!this.psu) {
        const info = all.find(match.psu);
        if (info) {
          try { this.psu = this.simulate ? new SimPsu(info) : await Psu.open(info); this.log(`PSU ${this.psu.model} (read-only monitoring)`); }
          catch (e) { this.log(`PSU not used: ${e.message}`); }
        }
      }
    }
    // MSI board: only on the allow-listed 761 boards
    if (!this.msi && !this.blocked.msi) {
      const info = all.find(match.msi);
      if (info && !isSupportedBoard(this.board.product)) this.live.msi = `board "${this.board.product}" is not on the supported list - not touched`;
      else if (info) {
        try { this.msi = this.simulate ? new SimMsi(info) : await MsiBoard.open(info); this.msiFresh = true; this.live.msi = 'ok'; this.log(`MSI board ${this.board.product} ready`); }
        catch (e) { this.live.msi = `unavailable: ${e.message}`; }
      }
    }
  }

  releaseHubs() {
    for (const h of this.hubs) { try { h.hub.close(); } catch { /* best effort */ } }
    this.hubs = [];
    if (this.lcd) { this.lcd.close(); this.lcd = null; this.live.lcd = 'released'; }
    if (this.psu) { this.psu.close(); this.psu = null; }
  }

  // ---------- cooling: once a second per hub ----------
  coolingTick() {
    if (this.stopping) return;
    const C = this.settings.cooling;
    let liquidAll = null;
    for (const h of this.hubs) {
      try {
        const rpm = h.hub.speeds(), temps = h.hub.temps();
        h.rpm = rpm;
        const pump = h.hub.devices.find(d => d.kind === 'pump');
        h.liquid = pump ? temps[pump.channel] ?? null : null;
        h.pumpRpm = pump ? rpm[pump.channel] : null;
        h.stall = pump && !(h.pumpRpm > PUMP_STALL_RPM) ? h.stall + 1 : 0;
        if (h.liquid != null) liquidAll = h.liquid;
        h.failures = 0;
      } catch (e) {
        h.failures = (h.failures || 0) + 1;
        this.log(`LINK hub read failed (${h.failures}): ${e.message}`);
      }
    }
    let alarm = null;
    for (const h of this.hubs.filter(x => !x.failures)) {
      const pump = h.hub.devices.find(d => d.kind === 'pump');
      const hasSensor = (h.liquid ?? liquidAll) != null || pump;
      const d = hasSensor ? decideDuties({ liquid: h.liquid ?? liquidAll, pumpRpm: h.pumpRpm, stallCount: h.stall }, C)
        : { pump: 100, fans: C.noSensorFanDuty, alarm: null };
      alarm = alarm || d.alarm;
      const duties = {};
      for (const dev of h.hub.devices) {
        if (dev.kind === 'pump') duties[dev.channel] = d.pump;
        else if (dev.kind === 'fan') duties[dev.channel] = d.fans;
      }
      try { if (Object.keys(duties).length) h.hub.setSpeeds(duties); h.duties = d; }
      catch (e) {
        // e.g. after sleep the hub may be back on its stored profile: take it back and retry once
        this.log(`LINK hub speed write failed (${e.message}) - re-entering software mode`);
        try { h.hub.enterSoftwareMode(); h.hub.setSpeeds(duties); h.duties = d; }
        catch (e2) { h.failures = (h.failures || 0) + 1; this.log(`LINK hub speed write failed again: ${e2.message}`); }
      }
    }
    // a hub that stops answering is left to its stored profile
    for (const h of this.hubs.filter(x => x.failures >= 5)) { this.log('LINK hub not answering - leaving it to its stored profile'); try { h.hub.close(); } catch { /* gone */ } }
    this.hubs = this.hubs.filter(x => (x.failures || 0) < 5);
    if (alarm && alarm !== this.live.alarm) this.log(`ALARM: ${alarm} - pump and fans at 100 %`);
    const first = this.hubs.find(h => h.pumpRpm != null);
    Object.assign(this.live, {
      liquid: liquidAll, alarm, pumpRpm: first?.pumpRpm ?? null,
      fanRpm: this.hubs.flatMap(h => h.hub.devices.filter(d => d.kind === 'fan').map(d => h.rpm?.[d.channel]).filter(Number.isFinite)),
      duties: first?.duties || this.hubs[0]?.duties || {},
    });
  }

  // ---------- LINK lighting: 20 frames per second ----------
  alarmColor(t) { return Math.floor(t * 2) % 2 ? [255, 0, 0] : [40, 0, 0]; }
  // 30 lighting updates per second. Windows timers tick in ~15.6 ms steps, so a plain 33 ms interval really runs
  // every ~47 ms (about 21 fps); each wait is measured against a running target instead, which averages 30.
  lightsLoop() {
    let next = Date.now();
    const step = () => {
      if (this.stopping) return;
      try { this.lightsTick(); } catch (e) { this.log(`lighting error: ${e.message}`); }
      next += 1000 / LIGHTS_FPS;
      const now = Date.now();
      if (next < now - 100) next = now;   // fell far behind (slow hub): carry on from now instead of bursting
      this.lightsTimer = setTimeout(step, Math.max(0, next - now));
    };
    step();
  }

  lightsTick() {
    if (this.stopping) return;
    const t = this.now(), L = this.settings.lighting, started = Date.now();
    let wheel = 0;
    for (const h of this.hubs) {
      const colors = {};
      for (const d of h.hub.devices) {
        if (d.leds <= 0) continue;
        const n = d.kind === 'pump' ? 16 : d.leds;
        // every device is one wheel, a quarter turn behind the previous one (used by the spiral)
        colors[d.channel] = this.live.alarm ? [this.alarmColor(t)] : render(L, this.live.liquid, n, t, n, (wheel++ * 0.25) % 1);
      }
      try { h.hub.setColors(colors); } catch (e) { if (!h.colorError) this.log(`LINK color write failed: ${e.message}`); h.colorError = true; }
    }
    if (!this.hubs.length) return;
    // measured, so the log shows whether 30 fps holds on this hub (a slow hub just runs at a lower rate)
    const m = this.lightStats ??= { n: 0, ms: 0, since: Date.now(), logged: false };
    m.n++; m.ms += Date.now() - started;
    if (Date.now() - m.since >= 30000) {
      this.live.lightsFps = +(m.n * 1000 / (Date.now() - m.since)).toFixed(1);
      this.live.lightsMs = +(m.ms / m.n).toFixed(1);
      if (!m.logged) { this.log(`LINK lighting: ${this.live.lightsFps} updates/s, ${this.live.lightsMs} ms each`); m.logged = true; }
      Object.assign(m, { n: 0, ms: 0, since: Date.now() });
    }
  }

  // ---------- MSI board ----------
  msiSpecs(names) {
    const M = this.settings.msi, L = this.settings.lighting;
    const direct = M.mode === 'direct' ? names : M.mode === 'mixed' ? names.filter(h => M.directHeaders.includes(h)) : [];
    const speed = L.period <= 4 ? 2 : L.period <= 10 ? 1 : 0;
    const specs = {};
    for (const h of names) {
      specs[h] = direct.includes(h) ? { direct: true }
        : this.live.alarm ? { mode: MODES.breathing, color: [255, 0, 0], speed: 2, brightness: 100 }
        // built-in board effects: the closest MSI mode for each of ours
        : ['rainbow', 'spiral-rainbow', 'color-cycle'].includes(L.effect) ? { mode: MODES[M.style[h] || 'colorring'], rainbow: true, speed, brightness: L.brightness, reverse: L.direction === 'ccw' && L.effect !== 'color-cycle' }
        : L.effect === 'breathing' || L.effect === 'color-pulse' ? { mode: MODES.breathing, color: hexToRgb(L.color), speed, brightness: L.brightness }
        : L.effect === 'color-wave' || L.effect === 'visor' ? { mode: MODES.meteor, color: hexToRgb(L.color), speed, brightness: L.brightness, reverse: L.direction === 'ccw' && L.effect === 'color-wave' }
        : L.effect === 'off' ? { mode: MODES.off, brightness: 0 }
        : { mode: MODES.steady, color: L.effect === 'temperature' ? tempColor(this.live.liquid, L.temp, L.tempColors) : hexToRgb(L.color), brightness: L.brightness };
    }
    return { specs, direct };
  }
  async msiLoop() {
    let setupKey = '', setupAt = 0, lastKey = '', lastAt = 0, frames = 0, since = Date.now();
    while (!this.stopping) {
      if (!this.msi) { await sleep(1000); continue; }
      const M = this.settings.msi, L = this.settings.lighting;
      const names = Object.keys(M.headers).filter(h => HEADERS[h]);
      const { specs, direct } = this.msiSpecs(names);
      try {
        const key = JSON.stringify([specs, M.headers]);
        if (this.msiFresh || key !== setupKey || Date.now() - setupAt > 30000) { await this.msi.setup(M.headers, specs); this.msiFresh = false; setupKey = key; setupAt = Date.now(); lastKey = ''; }
        this.live.msi = direct.length === names.length ? 'ok (exact copy)' : direct.length ? `ok (${direct.join('+')} exact, rest built-in)` : 'ok (built-in effect)';
        if (!names.length || !direct.length) { await sleep(250); continue; }
        const frame = (h, t) => (this.live.alarm ? Array(M.headers[h]).fill(this.alarmColor(t)) : render(L, this.live.liquid, M.headers[h], t, M.waveLeds));
        const fkey = JSON.stringify(direct.map(h => frame(h, this.now())));
        if (isAnimated(L.effect) || this.live.alarm || fkey !== lastKey || Date.now() - lastAt > 10000) {
          for (const h of direct) await this.msi.setHeader(h, frame(h, this.now()));
          lastKey = fkey; lastAt = Date.now(); frames++;
          if (Date.now() - since > 60000) { this.live.msiFps = +(frames * 1000 / (Date.now() - since)).toFixed(1); frames = 0; since = Date.now(); }
        } else await sleep(200);
      } catch (e) { this.live.msi = `write failed: ${e.message}`; this.log(`MSI: ${e.message}`); await sleep(2000); }
    }
  }

  // ---------- PSU (read-only) ----------
  async psuTick() {
    if (!this.psu || this.stopping || this.psuBusy) return;
    this.psuBusy = true;
    try { this.live.psu = await this.psu.status(); } catch (e) { this.log(`PSU read failed: ${e.message}`); }
    this.psuBusy = false;
  }

  // ---------- LCD: frames are rendered elsewhere and handed in ----------
  // The screen's writer thread keeps one frame waiting (newest wins). The returned promise settles when this frame
  // is written or replaced, which is what the LCD window waits for before rendering the next one.
  async submitLcdFrame(jpg) {
    const lcd = this.lcd;
    if (!lcd || this.stopping) return;
    try {
      if (!(await lcd.show(jpg))) return;   // replaced by a newer frame
      this.lcdFrames++; this.live.lcd = this.lcdStatus(); this.lcdErrors = 0;
      if (!lcd.streaming) { lcd.streaming = true; this.log('pump LCD streaming'); }
    } catch (e) {
      // stop on the first failure: close the screen and let the next device scan (15 s) reopen it
      if (this.lcd !== lcd) return;          // already handled, or switched over
      this.lcdErrors = (this.lcdErrors || 0) + 1;
      if (this.lcdErrors <= 3) this.log(`LCD write failed: ${e.message} - reopening on the next scan`);
      this.live.lcd = `write failed: ${e.message}`;
      this.lcd = null; await lcd.close();
    }
    if (Date.now() - this.lcdSince > 10000) {
      this.live.lcdFps = +(this.lcdFrames * 1000 / (Date.now() - this.lcdSince)).toFixed(1);
      if (!this.lcdFpsLogged && this.settings.lcd.enabled) { this.lcdFpsLogged = true; this.log(`pump LCD: ${this.live.lcdFps} frames/s`); }
      this.lcdFrames = 0; this.lcdSince = Date.now();
    }
  }

  lcdBrightness() { return this.settings.lcd.enabled ? this.settings.lcd.brightness : 0; }
  lcdStatus() { return this.settings.lcd.enabled ? 'ok' : 'off (screen dark)'; }

  async applySettings(next) {
    const prev = this.settings;
    this.settings = next;
    if (this.lcd && (next.lcd.brightness !== prev.lcd.brightness || next.lcd.enabled !== prev.lcd.enabled)) {
      await this.lcd.brightness(this.lcdBrightness()).catch(() => {});
      this.live.lcd = this.lcdStatus();
    }
  }

  state() {
    return {
      simulate: this.simulate,
      board: this.board,
      msiSupported: isSupportedBoard(this.board?.product),
      hubs: this.hubs.map(h => ({ firmware: h.fw, devices: h.hub.devices.map(d => ({ channel: d.channel, name: d.name, kind: d.kind, leds: d.leds, rpm: h.rpm?.[d.channel] ?? null })) })),
      ...this.live,
      lcdPresent: !!this.lcd,
      blocked: this.blocked,
    };
  }

  async stop() {
    this.stopping = true;
    for (const t of this.timers || []) clearInterval(t);
    clearTimeout(this.lightsTimer);
    // switched off = backlight 0: give the screen its backlight back, or its own display would stay dark after we quit
    if (this.lcd) await this.lcd.brightness(this.settings.lcd.brightness).catch(() => {});
    this.releaseHubs();
    await this.msi?.close();
    this.log('stopped: LINK hubs handed back to their stored profiles; MSI headers keep their last colors until the next start or reboot');
  }
}
