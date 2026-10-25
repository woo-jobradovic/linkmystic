// iCUE LINK pump LCD screen module (1B1C:0C4E): 480x480 JPEG frames sent as 1024-byte output reports.
// Facts: OpenLinkHub (GPL-3.0). Header: 02 05 01 <last> <chunk#> 00 <len lo> <len hi>, then up to 1016 bytes.
export const VID = 0x1b1c;
export const PID = 0x0c4e;
export const SIZE = 480;
export const PACKET = 1024;
export const CHUNK = PACKET - 8;

export function framePackets(jpg) {
  const n = Math.ceil(jpg.length / CHUNK), out = [];
  for (let i = 0; i < n; i++) {
    const part = jpg.subarray(i * CHUNK, (i + 1) * CHUNK);
    const buf = new Array(PACKET).fill(0);
    buf[0] = 0x02; buf[1] = 0x05; buf[2] = 0x01;
    buf[3] = i === n - 1 ? 0x01 : 0x00;
    buf[4] = i & 0xff;
    buf[6] = part.length & 0xff; buf[7] = (part.length >> 8) & 0xff;
    for (let k = 0; k < part.length; k++) buf[8 + k] = part[k];
    out.push(buf);
  }
  return out;
}

export const brightnessReport = pct => [0x03, 0x0b, Math.max(0, Math.min(100, Math.round(pct))), 0x01];
export const rotationReport = steps => [0x03, 0x0c, [0, 1, 2, 3].includes(steps) ? steps : 0, 0x01];   // 0/90/180/270
