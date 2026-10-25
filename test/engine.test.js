// Safety: a LINK hub is only kept (in software mode) when it is fully recognised; otherwise it is closed,
// which hands it back to the profile stored in its memory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine/engine.js';
import { DEFAULTS } from '../src/engine/settings.js';
import { describeDevice } from '../src/engine/proto/link.js';

function fakeHub(devices, { failOn } = {}) {
  return {
    info: { path: 'fake', serialNumber: 'FAKE0001' }, closed: false, software: false, devices: [],
    firmware() { if (failOn === 'firmware') throw new Error('LINK hub did not answer'); return '4.1.656'; },
    enterSoftwareMode() { this.software = true; },
    enumerate() { if (failOn === 'enumerate') throw new Error('LINK hub did not answer'); this.devices = devices; return devices; },
    close() { this.closed = true; this.software = false; },
  };
}
const dev = (channel, type, model = 0) => ({ channel, type, model, serial: 'X', ...describeDevice(type, model) });

function tryHub(hub) {
  const e = new Engine({ settings: DEFAULTS, simulate: true });
  e.makeHub = () => hub;
  e.openHub({ path: 'fake' });
  return e;
}

test('a fully recognised hub is kept in software mode', () => {
  const hub = fakeHub([dev(1, 0x0f), dev(13, 0x11, 2), dev(14, 0x06)]);
  const e = tryHub(hub);
  assert.equal(e.hubs.length, 1);
  assert.equal(hub.closed, false);
  assert.equal(hub.software, true);
});

for (const [name, hub] of [
  ['an empty device list', fakeHub([])],
  ['an unknown device', fakeHub([dev(1, 0x0f), dev(2, 0x42)])],
  ['no fans or pump', fakeHub([dev(1, 0x09)])],
  ['a timeout during enumerate', fakeHub([], { failOn: 'enumerate' })],
  ['a timeout before software mode', fakeHub([], { failOn: 'firmware' })],
]) {
  test(`a hub with ${name} is handed back to its stored profile and not used`, () => {
    const e = tryHub(hub);
    assert.equal(e.hubs.length, 0);
    assert.equal(hub.software, false);
  });
}
