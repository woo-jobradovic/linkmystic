// Corsair iCUE LINK System Hub (1B1C:0C3F) protocol: pure packet builders and parsers, no USB access.
// Protocol facts as documented by OpenRGB (CorsairICueLinkController, GPL-2.0-or-later) and
// OpenLinkHub (GPL-3.0); verified against a real hub (firmware 4.1.656).

export const VID = 0x1b1c;
export const PID_HUB = 0x0c3f;
export const USAGE_PAGE = 0xff42;
export const WRITE_LEN = 513;          // report id + 512
export const COLOR_CHUNK = 508;        // max payload per colour write request

export const CMD = {
  open: [0x0d, 0x01], openColor: [0x0d, 0x00], close: [0x05, 0x01, 0x01],
  firmware: [0x02, 0x13], software: [0x01, 0x03, 0x00, 0x02], hardware: [0x01, 0x03, 0x00, 0x01],
  write: [0x06, 0x01], writeColor: [0x06, 0x00], writeColorNext: [0x07, 0x00], read: [0x08, 0x01],
};
export const EP = { devices: [0x36], temps: [0x21], speeds: [0x17], setSpeed: [0x18], color: [0x22] };
export const TYPE = { devices: [0x21, 0x00], temps: [0x10, 0x00], speeds: [0x25, 0x00], setSpeed: [0x07, 0x00], color: [0x12, 0x00] };

// Device types reported by the hub (type byte; model byte only matters for names).
// kind: pump = has a pump (safety floor applies) + liquid sensor; fan; lcd = pump LCD cap ring; block/chassis/other.
const TYPES = {
  0x01: { name: 'iCUE LINK QX RGB fan', leds: 34, kind: 'fan' },
  0x02: { name: 'iCUE LINK LX RGB fan', leds: 18, kind: 'fan' },
  0x03: { name: 'iCUE LINK RX RGB MAX fan', leds: 8, kind: 'fan' },
  0x04: { name: 'iCUE LINK RX MAX fan', leds: 0, kind: 'fan' },
  0x06: { name: 'iCUE LINK pump LCD cap', leds: 24, kind: 'lcd' },
  0x07: { name: 'iCUE LINK H-series AIO', leds: 20, kind: 'pump' },
  0x09: { name: 'iCUE LINK XC7 ELITE block', leds: 24, kind: 'block' },
  0x0a: { name: 'iCUE LINK XG3 HYBRID', leds: 0, kind: 'block' },
  0x0c: { name: 'iCUE LINK XD5 ELITE pump/res', leds: 22, kind: 'pump' },
  0x0d: { name: 'iCUE LINK XG7 RGB block', leds: 16, kind: 'block' },
  0x0e: { name: 'iCUE LINK XD5 ELITE LCD', leds: 22, kind: 'internal' },   // duplicate of the XD5 entry, skipped
  0x0f: { name: 'iCUE LINK RX RGB fan', leds: 8, kind: 'fan' },
  0x10: { name: 'iCUE LINK VRM cooler fan', leds: 0, kind: 'fan' },
  0x11: { name: 'iCUE LINK TITAN AIO', leds: 20, kind: 'pump' },
  0x13: { name: 'iCUE LINK RX fan', leds: 0, kind: 'fan' },
  0x14: { name: 'iCUE LINK ORIGIN OA', leds: 0, kind: 'other' },
  0x19: { name: 'iCUE LINK XD6 ELITE pump/res', leds: 22, kind: 'pump' },
};
const CHASSIS = { 0x00: { name: 'iCUE LINK adapter', leds: 0, kind: 'other' }, 0x01: { name: 'iCUE LINK 9000D RGB AIRFLOW', leds: 22, kind: 'chassis' }, 0x02: { name: 'iCUE LINK 5000T RGB', leds: 160, kind: 'chassis' } };
const AIO_MODELS = { 0x07: ['H100i', 'H115i', 'H150i', 'H170i', 'H100i', 'H150i'], 0x11: ['TITAN 240', 'TITAN 280', 'TITAN 360', 'TITAN 420', 'TITAN 240', 'TITAN 360'] };

export function describeDevice(type, model) {
  const base = type === 0x05 ? CHASSIS[model] : TYPES[type];
  if (!base) return { name: `unknown LINK device (type 0x${type.toString(16)}, model 0x${model.toString(16)})`, leds: 0, kind: 'unknown' };
  const sub = AIO_MODELS[type]?.[model];
  return { ...base, name: sub ? `iCUE LINK ${sub}` : base.name };
}

// One 513-byte output report: 00 00 01 <command> <data...>
export function commandPacket(command, data = []) {
  const buf = new Array(WRITE_LEN).fill(0);
  buf[2] = 0x01;
  command.forEach((b, i) => { buf[3 + i] = b; });
  data.forEach((b, i) => { buf[3 + command.length + i] = b; });
  return buf;
}

// Payload written to an endpoint: <len lo> <len hi> 00 00 <data type 2B> <data>, len = data + 2
export function endpointPayload(type, data) {
  const len = data.length + 2;
  return [len & 0xff, (len >> 8) & 0xff, 0, 0, ...type, ...data];
}

export const firmwareString = r => `${r[4]}.${r[5]}.${r[6] | (r[7] << 8)}`;

// Device list read from EP.devices: r[6] = channel count, then per channel 8 metadata bytes + id string
export function parseDevices(r) {
  const channels = r[6], idx = r.slice(7), out = [];
  let pos = 0;
  for (let ch = 1; ch <= channels; ch++) {
    const idLen = idx[pos + 7];
    if (idLen === undefined) break;
    if (!idLen) { pos += 8; continue; }
    const type = idx[pos + 2], model = idx[pos + 3];
    const serial = String.fromCharCode(...idx.slice(pos + 8, pos + 8 + idLen));
    out.push({ channel: ch, type, model, serial, ...describeDevice(type, model) });
    pos += 8 + idLen;
  }
  return out;
}

// Speeds / temperatures: r[6] = count, then 3 bytes per entry: status (0 = valid), value LE16.
// Entry i belongs to hub channel i (entry 0 = the hub itself): verified on a real hub, where entry 13 = TITAN pump rpm
// and liquid temperature, entries 1-3 = fan rpm, matching the channels reported by parseDevices().
export function parseSensors(r, scale = 1, signed = false) {
  const out = {};
  for (let i = 0; i < r[6]; i++) {
    const s = r.slice(7 + i * 3, 10 + i * 3);
    if (s.length === 3 && s[0] === 0x00) {
      let v = s[1] | (s[2] << 8);
      if (signed && v & 0x8000) v -= 0x10000;
      out[i] = v / scale;
    }
  }
  return out;
}

// Set-speed data: count, then per channel: channel, mode 0 (percent), duty, 0
export function speedData(duties) {
  const chans = Object.keys(duties).map(Number).sort((a, b) => a - b);
  const data = [chans.length];
  for (const ch of chans) data.push(ch, 0x00, Math.round(duties[ch]), 0x00);
  return data;
}

// Colour stream for all LED devices in channel order; pump LEDs 16-19 sit under an LCD cap and are sent black.
export function colorData(devices, perChannel) {
  const hasLcd = devices.some(d => d.kind === 'lcd');
  const data = [];
  for (const d of devices) {
    if (d.leds <= 0 || d.kind === 'internal' || d.kind === 'unknown') continue;
    const leds = perChannel[d.channel] || [];
    for (let i = 0; i < d.leds; i++) {
      const hidden = d.kind === 'pump' && hasLcd && i >= 16;
      const c = hidden ? [0, 0, 0] : (leds[i] || leds[leds.length - 1] || [0, 0, 0]);
      data.push(c[0], c[1], c[2]);
    }
  }
  return data;
}

// Split a colour payload into the 0x06 first chunk + 0x07 continuation chunks
export function colorChunks(payload) {
  const out = [];
  for (let off = 0; off < payload.length; off += COLOR_CHUNK) out.push([off === 0 ? CMD.writeColor : CMD.writeColorNext, payload.slice(off, off + COLOR_CHUNK)]);
  return out;
}
