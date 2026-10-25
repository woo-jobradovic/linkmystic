// Demo mode: simulated devices so the app can run (and be tested) without any hardware.
import { describeDevice } from './proto/link.js';
import { MODELS } from './proto/psu.js';

export const simHid = () => [
  { vendorId: 0x1b1c, productId: 0x0c3f, usagePage: 0xff42, usage: 1, path: 'sim-hub', serialNumber: 'SIMHUB0001' },
  { vendorId: 0x1b1c, productId: 0x0c4e, usagePage: 0x0c, usage: 1, path: 'sim-lcd' },
  { vendorId: 0x0db0, productId: 0x0076, usagePage: 0xff00, usage: 1, path: 'sim-msi' },
  { vendorId: 0x1b1c, productId: 0x1c1f, usagePage: 0xff00, usage: 1, path: 'sim-psu' },
];

export class SimHub {
  constructor(info) { this.info = info; this.duty = {}; this.devices = []; }
  firmware() { return '0.0.0-demo'; }
  enterSoftwareMode() {}
  enumerate() {
    const mk = (channel, type, model) => ({ channel, type, model, serial: 'SIM', ...describeDevice(type, model) });
    this.devices = [mk(1, 0x0f, 0), mk(2, 0x0f, 0), mk(3, 0x0f, 0), mk(13, 0x11, 2), mk(14, 0x06, 0)];
    return this.devices;
  }
  speeds() {
    const out = {};
    for (const d of this.devices) if (d.kind === 'fan') out[d.channel] = Math.round(20 * (this.duty[d.channel] ?? 50)); else if (d.kind === 'pump') out[d.channel] = Math.round(29 * (this.duty[d.channel] ?? 100));
    return out;
  }
  temps() { return { 13: +(34 + 3 * Math.sin(Date.now() / 20000)).toFixed(1) }; }
  setSpeeds(d) { Object.assign(this.duty, d); }
  setColors() {}
  close() {}
}
export class SimMsi { constructor(info) { this.info = info; } async setup() {} async setHeader() { await new Promise(r => setTimeout(r, 95)); } async close() {} }
export class SimPsu {
  constructor(info) { this.info = info; this.model = MODELS[info.productId]; }
  async status() { return { model: this.model, tempVrm: 41.5, tempCase: 36.25, fanRpm: 0, inputVolts: 230, powerOut: 182, rails: { '+12V': { volts: 12.06, amps: 13.5, watts: 162.8 }, '+5V': { volts: 5.02, amps: 2.1, watts: 10.5 }, '+3.3V': { volts: 3.31, amps: 2.6, watts: 8.6 } } }; }
  close() {}
}
