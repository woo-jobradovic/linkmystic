// Byte-exact tests for every packet LinkMystic sends. Expected bytes come from packets verified on real
// hardware (iCUE LINK hub fw 4.1.656 + TITAN 360 RX LCD, MSI MAG X870E TOMAHAWK WIFI, HX1500i).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as link from '../src/engine/proto/link.js';
import * as msi from '../src/engine/proto/msi.js';
import * as psu from '../src/engine/proto/psu.js';
import * as lcd from '../src/engine/proto/lcd.js';

const hex = s => s.trim().split(/\s+/).map(x => parseInt(x, 16));

test('LINK: software/hardware mode command packets', () => {
  const sw = link.commandPacket(link.CMD.software);
  assert.equal(sw.length, 513);
  assert.deepEqual(sw.slice(0, 8), [0x00, 0x00, 0x01, 0x01, 0x03, 0x00, 0x02, 0x00]);
  assert.deepEqual(link.commandPacket(link.CMD.hardware).slice(0, 7), [0x00, 0x00, 0x01, 0x01, 0x03, 0x00, 0x01]);
  assert.deepEqual(link.commandPacket(link.CMD.close, link.EP.speeds).slice(0, 7), [0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x17]);
});

test('LINK: endpoint payload and speed data', () => {
  const data = link.speedData({ 13: 100, 1: 50, 2: 50 });
  assert.deepEqual(data, [3, 1, 0, 50, 0, 2, 0, 50, 0, 13, 0, 100, 0]);
  assert.deepEqual(link.endpointPayload(link.TYPE.setSpeed, data).slice(0, 6), [15, 0, 0, 0, 0x07, 0x00]);
});

test('LINK: parse device list (3 RX RGB fans, TITAN 360, LCD cap on channels 1-3, 13, 14)', () => {
  const entry = (type, model, id) => [0, 0, type, model, 0, 0, 0, id.length, ...[...id].map(c => c.charCodeAt(0))];
  const empty = [0, 0, 0, 0, 0, 0, 0, 0];
  const body = [...entry(0x0f, 0, 'FAN1'), ...entry(0x0f, 0, 'FAN2'), ...entry(0x0f, 0, 'FAN3'),
    ...Array(9).fill(empty).flat(), ...entry(0x11, 0x02, 'PUMP'), ...entry(0x06, 0, 'LCDCAP')];
  const r = [0, 0, 0, 0, 0x21, 0x00, 14, ...body];
  const devs = link.parseDevices(r);
  assert.deepEqual(devs.map(d => [d.channel, d.kind, d.leds]), [[1, 'fan', 8], [2, 'fan', 8], [3, 'fan', 8], [13, 'pump', 20], [14, 'lcd', 24]]);
  assert.equal(devs[3].name, 'iCUE LINK TITAN 360');
  assert.equal(link.describeDevice(0x42, 0).kind, 'unknown');
});

test('LINK: sensor parsing (speeds, signed temperatures)', () => {
  const r = [0, 0, 0, 0, 0x25, 0, 3, 0x00, 0xd8, 0x03, 0x01, 0, 0, 0x00, 0x2c, 0x0b];
  assert.deepEqual(link.parseSensors(r), { 0: 984, 2: 2860 });
  const t = [0, 0, 0, 0, 0x10, 0, 1, 0x00, 0x5f, 0x01];
  assert.deepEqual(link.parseSensors(t, 10, true), { 0: 35.1 });
});

test('LINK: colour stream hides pump LEDs 16-19 under an LCD cap, chunks at 508', () => {
  const devs = [{ channel: 1, kind: 'fan', leds: 8 }, { channel: 13, kind: 'pump', leds: 20 }, { channel: 14, kind: 'lcd', leds: 24 }];
  const data = link.colorData(devs, { 1: [[1, 2, 3]], 13: [[9, 9, 9]], 14: [[5, 5, 5]] });
  assert.equal(data.length, (8 + 20 + 24) * 3);
  assert.deepEqual(data.slice(8 * 3, 8 * 3 + 3), [9, 9, 9]);                 // pump LED 0
  assert.deepEqual(data.slice((8 + 16) * 3, (8 + 20) * 3), Array(12).fill(0)); // pump LEDs 16-19 black
  const chunks = link.colorChunks(link.endpointPayload(link.TYPE.color, Array(600).fill(1)));
  assert.equal(chunks.length, 2);
  assert.deepEqual(chunks[0][0], [0x06, 0x00]);
  assert.deepEqual(chunks[1][0], [0x07, 0x00]);
  assert.equal(chunks[0][1].length, 508);
});

test('MSI: direct-mode setup rows match the bytes read back from the board', () => {
  const r = msi.setupReport({ JARGB1: 120, JAF: 120 }, { JARGB1: { direct: true }, JAF: { direct: true } });
  assert.equal(r.length, 290);
  assert.equal(r[0], 0x50);
  assert.deepEqual(r.slice(1, 17), hex('09 ff 00 00 00 ff 00 00 00 ff ff ff ff 03 15 78'));   // JARGB1
  assert.deepEqual(r.slice(17, 33), hex('00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 1e'));  // JARGB2 off
  assert.deepEqual(r.slice(49, 65), hex('09 ff 00 00 00 ff 00 00 00 ff ff ff ff 03 15 78'));  // JAF
});

test('MSI: built-in effect rows match the bytes read back from the board', () => {
  const r = msi.setupReport({ JARGB1: 36, JAF: 12 }, {
    JARGB1: { mode: msi.MODES.wave, rainbow: true, speed: 2, brightness: 100 },
    JAF: { mode: msi.MODES.flame, rainbow: true, speed: 1, brightness: 100 },
  });
  assert.deepEqual(r.slice(1, 17), hex('01 ff ff ff ff ff ff ff ff ff ff ff ff 00 16 24'));
  assert.deepEqual(r.slice(49, 65), hex('03 ff ff ff ff ff ff ff ff ff ff ff ff 00 15 0c'));
});

test('MSI: direct report header and LED clamp', () => {
  const r = msi.directReport('JAF', 12, [[255, 0, 0]]);
  assert.equal(r.length, 727);
  assert.deepEqual(r.slice(0, 10), [0x51, 0x09, 0x08, 0x00, 0x00, 0x00, 12, 255, 0, 0]);
  assert.deepEqual(msi.directReport('JARGB3', 999, []).slice(0, 7), [0x51, 0x09, 0x04, 0x02, 0, 0, 240]);
});

test('MSI: board allow-list', () => {
  assert.ok(msi.isSupportedBoard('MAG X870E TOMAHAWK WIFI (MS-7E59)'));
  assert.ok(msi.isSupportedBoard('MSI MAG X870E TOMAHAWK WIFI (MS-7E59)'));
  assert.ok(!msi.isSupportedBoard('MAG B650 TOMAHAWK WIFI (MS-7D75)'));
  assert.ok(!msi.isSupportedBoard(undefined));
});

test('PSU: LINEAR11 decoding (liquidctl test vector) and read-only packets', () => {
  assert.equal(psu.linear11(0x67, 0xe3), 54.4375);
  assert.deepEqual(psu.readCmd(psu.REG.temp1).slice(0, 3), [0x00, 0x03, 0x8d]);
  assert.deepEqual(psu.handshake().slice(0, 3), [0x00, 0xfe, 0x03]);
  assert.deepEqual(psu.selectRail(1).slice(0, 4), [0x00, 0x02, 0x00, 0x01]);
  assert.equal(psu.readCmd(0x8d).length, 65);
});

test('LCD: frame packets and brightness report', () => {
  const jpg = new Uint8Array(2500).fill(7);
  const p = lcd.framePackets(jpg);
  assert.equal(p.length, 3);
  assert.deepEqual(p[0].slice(0, 8), [0x02, 0x05, 0x01, 0x00, 0x00, 0x00, 0xf8, 0x03]);   // 1016 bytes
  assert.deepEqual(p[2].slice(0, 8), [0x02, 0x05, 0x01, 0x01, 0x02, 0x00, 0xd4, 0x01]);   // last: 468 bytes
  assert.deepEqual(lcd.brightnessReport(150), [0x03, 0x0b, 100, 0x01]);
  const exact = lcd.framePackets(new Uint8Array(1016 * 2));
  assert.equal(exact[1][3], 0x01);                                                  // last flag even when the frame fills the chunk exactly
});
