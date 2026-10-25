// USB transports. All protocol bytes come from ./proto/*; this file only moves them over HID.
import HID from 'node-hid';
import * as L from './proto/link.js';
import * as M from './proto/msi.js';
import * as P from './proto/psu.js';
import * as D from './proto/lcd.js';

export async function listHid() { return HID.devicesAsync(); }

// ---------- Corsair iCUE LINK hub (synchronous: short request/response transactions) ----------
export class LinkHub {
  constructor(info) {
    this.info = info;
    this.dev = new HID.HID(info.path);
    this.devices = [];
    this.software = false;
  }
  cmd(command, data = []) {
    this.dev.write(L.commandPacket(command, data));
    const r = this.dev.readTimeout(1000);
    if (!r.length) throw new Error('LINK hub did not answer');      // a silent timeout is an error, never an empty result
    return r;
  }
  read(ep, type) {
    this.cmd(L.CMD.close, ep);
    this.cmd(L.CMD.open, ep);
    let r = this.cmd(L.CMD.read);
    if (r[4] === type[0] && r[5] === type[1]) r = r.concat(this.cmd(L.CMD.read).slice(4));
    this.cmd(L.CMD.close, ep);
    return r;
  }
  write(ep, type, data) {
    this.cmd(L.CMD.close, ep);
    this.cmd(L.CMD.open, ep);
    const r = this.cmd(L.CMD.write, L.endpointPayload(type, data));
    this.cmd(L.CMD.close, ep);
    return r;
  }
  firmware() { return L.firmwareString(this.cmd(L.CMD.firmware)); }
  enterSoftwareMode() { this.cmd(L.CMD.software); this.software = true; }
  enumerate() { this.devices = L.parseDevices(this.read(L.EP.devices, L.TYPE.devices)); return this.devices; }
  speeds() { return L.parseSensors(this.read(L.EP.speeds, L.TYPE.speeds)); }
  temps() { return L.parseSensors(this.read(L.EP.temps, L.TYPE.temps), 10, true); }
  // r[3] is the hub's status byte; non-zero means it did not accept the write (e.g. it fell back to hardware mode after sleep)
  setSpeeds(duties) {
    const r = this.write(L.EP.setSpeed, L.TYPE.setSpeed, L.speedData(duties));
    if (r[3] !== 0x00) throw new Error(`LINK hub refused the speed write (status 0x${r[3].toString(16)})`);
    return r;
  }
  setColors(perChannel) {
    const payload = L.endpointPayload(L.TYPE.color, L.colorData(this.devices, perChannel));
    this.cmd(L.CMD.close, L.EP.color);
    this.cmd(L.CMD.openColor, L.EP.color);
    for (const [command, chunk] of L.colorChunks(payload)) this.cmd(command, chunk);
    this.cmd(L.CMD.close, L.EP.color);
  }
  // always hand the hub back to its stored (Device Memory Mode) profile
  close() { try { if (this.software) this.cmd(L.CMD.hardware); } finally { this.software = false; try { this.dev.close(); } catch { /* already closed */ } } }
}

// ---------- MSI 761 board (async: each write takes ~95 ms) ----------
export class MsiBoard {
  static async open(info) { const b = new MsiBoard(); b.info = info; b.dev = await HID.HIDAsync.open(info.path); return b; }
  async readSetup() { return this.dev.getFeatureReport(0x50, M.SETUP_LEN); }
  async setup(ledCounts, specs) { this.ledCounts = ledCounts; await this.dev.sendFeatureReport(M.setupReport(ledCounts, specs)); }
  async setHeader(name, colors) { await this.dev.sendFeatureReport(M.directReport(name, this.ledCounts[name], colors)); }
  async close() { try { await this.dev.close(); } catch { /* already closed */ } }
}

// ---------- pump LCD screen ----------
export class LcdScreen {
  static async open(info) { const s = new LcdScreen(); s.info = info; s.dev = await HID.HIDAsync.open(info.path); return s; }
  async brightness(pct) { await this.dev.sendFeatureReport(D.brightnessReport(pct)); }
  async show(jpg) { for (const p of D.framePackets(jpg)) await this.dev.write(p); }
  async close() { try { await this.dev.close(); } catch { /* already closed */ } }
}

// ---------- Corsair HXi/RMi PSU, read-only ----------
export class Psu {
  static async open(info) {
    const p = new Psu(); p.info = info; p.model = P.MODELS[info.productId] || 'Corsair PSU';
    p.dev = await HID.HIDAsync.open(info.path);
    try { await p.dev.write(P.handshake()); await p.dev.read(500); }
    catch (e) { await p.close(); throw e; }
    return p;
  }
  async reg(r) { await this.dev.write(P.readCmd(r)); const res = await this.dev.read(500); return res && res.length >= 4 ? P.linear11(res[2], res[3]) : null; }
  async status() {
    await this.dev.write(P.selectRail(0)); await this.dev.read(500);
    const out = {
      model: this.model,
      tempVrm: await this.reg(P.REG.temp1), tempCase: await this.reg(P.REG.temp2), fanRpm: await this.reg(P.REG.fan),
      inputVolts: await this.reg(P.REG.vin), powerOut: await this.reg(P.REG.totalPower), rails: {},
    };
    for (const [rail, name] of [[0, '+12V'], [1, '+5V'], [2, '+3.3V']]) {
      await this.dev.write(P.selectRail(rail)); await this.dev.read(500);
      out.rails[name] = { volts: await this.reg(P.REG.vout), amps: await this.reg(P.REG.iout), watts: await this.reg(P.REG.pout) };
    }
    await this.dev.write(P.selectRail(0)); await this.dev.read(500);
    return out;
  }
  async close() { try { await this.dev.close(); } catch { /* already closed */ } }
}

export const match = {
  linkHub: d => d.vendorId === L.VID && d.productId === L.PID_HUB && d.usagePage === L.USAGE_PAGE && d.usage === 0x01,
  msi: d => d.vendorId === M.VID && d.productId === M.PID && d.usagePage === M.USAGE_PAGE,
  lcd: d => d.vendorId === D.VID && d.productId === D.PID,
  psu: d => d.vendorId === P.VID && Object.hasOwn(P.MODELS, d.productId),
};
