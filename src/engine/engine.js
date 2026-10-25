// The engine: finds devices, runs cooling (with safety), lighting, the MSI board, PSU monitoring and the LCD.
// Runs in its own process. Every LINK hub is handed back to hardware mode (its stored profile) on stop.
import { listHid, match, LinkHub, MsiBoard, LcdScreen, Psu } from './devices.js';
import { baseboard, conflicts } from './system.js';
import { decideDuties, PUMP_STALL_RPM } from './cooling.js';
import { render, tempColor, hexToRgb, isAnimated } from './effects.js';
import { isSupportedBoard, MODES, HEADERS } from './proto/msi.js';
import { SimHub, SimMsi, SimLcd, SimPsu, simHid } from './sim.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const redact = s => (s ? `${String(s).slice(0, 4)}…` : '');

export class Engine {
  constructor({ settings, log = () => {}, emit = () => {}, simulate = false }) {
    Object.assign(this, { settings, log, emit, simulate });
    this.t0 = Date.now();
    this.stopping = false;
    this.hubs = [];             // { hub, pumps, stall, status }
    this.msi = null; this.lcd = null; this.psu = null;
    this.board = null; this.blocked = { corsair: false, msi: false };
    this.live = { liquid: null, pumpRpm: null, fanRpm: [], duties: {}, alarm: null, msi: 'not found', lcd: 'not found', psu: null, conflicts: [] };
    this.lcdFrame = null; this.lcdBusy = false; this.lcdFrames = 0; this.lcdSince = Date.now();
  }

  now() { return (Date.now() - this.t0) / 1000; }

  async start() {
    this.board = this.simulate ? { manufacturer: 'Demo', product: 'MAG X870E TOMAHAWK WIFI (MS-7E59)' } : await baseboard();
    this.log(`board: ${this.board.manufacturer} ${this.board.product}`);
    await this.checkConflicts();
    await this.discover();
    this.timers = [
      setInterval(() => this.coolingTick(), 1000),
      setInterval(() => this.lightsTick(), 50),
      setInterval(() => this.checkConflicts().then(() => this.discover()), 15000),
      setInterval(() => this.psuTick(), 2000),
      setInterval(() => this.emit('state', this.state()), 1000),
    ];
    this.msiLoop();
    this.coolingTick();
  }

  async checkConflicts() {
    const list = this.simulate ? [] : await conflicts();
    this.live.conflicts = list;
    const corsair = list.some(c => c.family === 'corsair' || c.family === 'both');
    const msi = list.some(c => c.family === 'msi' || c.family === 'both');
    if (corsair && !this.blocked.corsair) { this.log(`other software is using Corsair devices (${list.map(c => c.process).join(', ')}): releasing them`); this.releaseHubs(); }
    if (msi && !this.blocked.msi) { this.log('other software is using the MSI board: leaving it alone'); await this.msi?.close(); this.msi = null; }
    this.blocked = { corsair, msi };
  }

  async discover() {
    const all = this.simulate ? simHid() : await listHid();
    // LINK hubs
    if (!this.blocked.corsair) {
      for (const info of all.filter(match.linkHub)) {
        if (this.hubs.some(h => h.hub.info.path === info.path)) continue;
        try {
          const hub = this.simulate ? new SimHub(info) : new LinkHub(info);
          const fw = hub.firmware();
          hub.enterSoftwareMode();
          const devs = hub.enumerate();
          this.hubs.push({ hub, fw, stall: 0, status: 'ok' });
          this.log(`LINK hub ${redact(info.serialNumber)} fw ${fw}: ${devs.map(d => `ch${d.channel} ${d.name}`).join(', ')}`);
        } catch (e) { this.log(`LINK hub open failed: ${e.message}`); }
      }
      if (!this.lcd && this.settings.lcd.enabled) {
        const info = all.find(match.lcd);
        if (info) {
          try { this.lcd = this.simulate ? new SimLcd(info) : await LcdScreen.open(info); await this.lcd.brightness(this.settings.lcd.brightness); this.live.lcd = 'ok'; this.log('pump LCD ready'); }
          catch (e) { this.live.lcd = `unavailable: ${e.message}`; }
        }
      }
      if (!this.psu) {
        const info = all.find(match.psu);
        if (info) { try { this.psu = this.simulate ? new SimPsu(info) : await Psu.open(info); this.log(`PSU ${this.psu.model} (read-only monitoring)`); } catch (e) { this.log(`PSU open failed: ${e.message}`); } }
      }
    }
    // MSI board: only on the allow-listed 761 boards
    if (!this.msi && !this.blocked.msi) {
      const info = all.find(match.msi);
      if (info && !isSupportedBoard(this.board.product)) this.live.msi = `board "${this.board.product}" is not on the supported list - not touched`;
      else if (info) {
        try { this.msi = this.simulate ? new SimMsi(info) : await MsiBoard.open(info); this.live.msi = 'ok'; this.log(`MSI board ${this.board.product} ready`); }
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
      catch (e) { this.log(`LINK hub speed write failed: ${e.message}`); }
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
  lightsTick() {
    if (this.stopping) return;
    const t = this.now(), L = this.settings.lighting;
    for (const h of this.hubs) {
      const colors = {};
      for (const d of h.hub.devices) {
        if (d.leds <= 0) continue;
        const n = d.kind === 'pump' ? 16 : d.leds;
        colors[d.channel] = this.live.alarm ? [this.alarmColor(t)] : render(L, this.live.liquid, n, t, n);
      }
      try { h.hub.setColors(colors); } catch (e) { if (!h.colorError) this.log(`LINK colour write failed: ${e.message}`); h.colorError = true; }
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
        : L.effect === 'rainbow' || L.effect === 'color-cycle' ? { mode: MODES[M.style[h] || 'colorring'], rainbow: true, speed, brightness: L.brightness }
        : L.effect === 'breathing' ? { mode: MODES.breathing, color: hexToRgb(L.color), speed, brightness: L.brightness }
        : L.effect === 'off' ? { mode: MODES.off, brightness: 0 }
        : { mode: MODES.steady, color: L.effect === 'temperature' ? tempColor(this.live.liquid, L.temp) : hexToRgb(L.color), brightness: L.brightness };
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
        if (key !== setupKey || Date.now() - setupAt > 30000) { await this.msi.setup(M.headers, specs); setupKey = key; setupAt = Date.now(); lastKey = ''; }
        this.live.msi = direct.length === names.length ? 'ok (exact copy)' : direct.length ? `ok (${direct.join('+')} exact, rest built-in)` : 'ok (built-in effect)';
        if (!direct.length) { await sleep(250); continue; }
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

  // ---------- LCD: frames are rendered elsewhere and handed in; only the newest one is sent ----------
  async submitLcdFrame(jpg) {
    if (!this.lcd || this.stopping) return;
    this.lcdFrame = jpg;
    if (this.lcdBusy) return;
    this.lcdBusy = true;
    while (this.lcdFrame && !this.stopping && this.lcd) {
      const f = this.lcdFrame; this.lcdFrame = null;
      try { await this.lcd.show(f); this.lcdFrames++; this.live.lcd = 'ok'; }
      catch (e) { this.live.lcd = `write failed: ${e.message}`; this.log(`LCD: ${e.message}`); break; }
    }
    if (Date.now() - this.lcdSince > 5000) { this.live.lcdFps = +(this.lcdFrames * 1000 / (Date.now() - this.lcdSince)).toFixed(1); this.lcdFrames = 0; this.lcdSince = Date.now(); }
    this.lcdBusy = false;
  }

  async applySettings(next) {
    const prev = this.settings;
    this.settings = next;
    if (this.lcd && next.lcd.brightness !== prev.lcd.brightness) await this.lcd.brightness(next.lcd.brightness).catch(() => {});
    if (!next.lcd.enabled && this.lcd) { await this.lcd.close(); this.lcd = null; this.live.lcd = 'off'; }
    if (next.lcd.enabled && !prev.lcd.enabled) await this.discover();
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
    this.releaseHubs();
    await this.msi?.close();
    this.log('stopped: LINK hubs back on their stored profiles');
  }
}
