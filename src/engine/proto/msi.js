// MSI Mystic Light "761" motherboard controller (VID 0DB0, PID 0076): pure packet builders, no USB access.
// Facts: OpenRGB MSIMotherboard761Controller (GPL-2.0-or-later, direct mode based on SignalRGB's work);
// header row layout confirmed from MSI's own data structures (field order of Struct_Gen1AreaSetting).
// IMPORTANT: VID 1462 / PID 0076 is a DIFFERENT, older protocol - never treat it as this one.

export const VID = 0x0db0;
export const PID = 0x0076;
export const USAGE_PAGE = 0xff00;
export const SETUP_LEN = 290;        // 0x50: id + 18 rows x 16 + 1
export const DIRECT_LEN = 7 + 720;   // 0x51: header + 240 x RGB
export const MAX_LEDS = 240;

// Boards known to use this controller (Windows baseboard product name). Writes are refused on anything else.
export const SUPPORTED_BOARDS = [
  'MAG X870 TOMAHAWK WIFI (MS-7E51)', 'MAG B850M MORTAR WIFI (MS-7E61)', 'MPG B850I EDGE TI WIFI (MS-7E79)',
  'X870 GAMING PLUS WIFI (MS-7E47)', 'B850 GAMING PLUS WIFI6E (MS-7E80)', 'B850M GAMING PLUS WIFI6E (MS-7E81)',
  'MPG X870E CARBON WIFI (MS-7E49)', 'Z890 GAMING PLUS WIFI (MS-7E34)', 'X870E GAMING PLUS WIFI (MS-7E70)',
  'MAG X870E TOMAHAWK WIFI (MS-7E59)', 'PRO B850-P WIFI (MS-7E56)', 'B850M GAMING PLUS WIFI (MS-7E66)',
  'PRO X870E-P WIFI (MS-7E70)', 'MPG X870I EDGE TI EVO WIFI (MS-7E50)', 'B850 GAMING PLUS WIFI (MS-7E56)',
  'PRO X870-P WIFI (MS-7E47)', 'MPG X870E EDGE TI WIFI (MS-7E59)', 'MAG B850 TOMAHAWK MAX WIFI (MS-7E62)',
  'PRO B850M-P WIFI (MS-7E71)', 'MAG Z890 TOMAHAWK WIFI (MS-7E32)', 'MPG B850 EDGE TI WIFI (MS-7E62)',
  'PRO B850M-VC WIFI6E (MS-7E71)', 'MAG B850 TOMAHAWK WIFI (MS-7E53)', 'MEG Z890 UNIFY-X (MS-7E20)',
  'PRO X870E-S EVO WIFI (MS-7E86)', 'MAG X870E GAMING MAX WIFI (MS-7E86)', 'PRO Z890-P WIFI (MS-7E34)',
  'B850 GAMING PLUS WIFI PZ (MS-7E75)', 'MAG X870E TOMAHAWK MAX WIFI PZ (MS-7E84)', 'PRO B850M-A WIFI PZ (MS-7E78)',
  'B850MPOWER (MS-7E83)', 'B840M GAMING WIFI6E (MS-7E76)', 'PRO B850M-A WIFI (MS-7E66)', 'PRO B850-S WIFI6E (MS-7E80)',
  'B850M GAMING WIFI (MS-7E82)',
];
export const isSupportedBoard = product => SUPPORTED_BOARDS.includes(String(product || '').replace(/^MSI\s+/i, '').trim());

// Direct-capable headers: [hdr0, hdr1] for 0x51, row index in 0x50
export const HEADERS = { JARGB1: { h: [0x04, 0], row: 0 }, JARGB2: { h: [0x04, 1], row: 1 }, JARGB3: { h: [0x04, 2], row: 2 }, JAF: { h: [0x08, 0], row: 3 } };

// Built-in effect modes (board animates them itself)
export const MODES = { off: 0, wave: 1, steady: 2, flame: 3, breathing: 4, colorring: 5, lightning: 6, recreation: 7, meteor: 8, direct: 9 };

// One 16-byte header row: mode, 4 x RGB, color count, packed flags, LED count.
// flags = speed (bits 0-1) | brightness 0-5 (bits 2-4) | user color (bit 5) | direction (bit 6) | follow Select All (bit 7)
export function headerRow(spec, leds) {
  if (!spec) return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x1e];
  if (spec.direct) return [MODES.direct, 0xff, 0, 0, 0, 0xff, 0, 0, 0, 0xff, 0xff, 0xff, 0xff, 0x03, 0x15, leds];
  const { mode, color = [255, 255, 255], speed = 1, brightness = 100, rainbow = false, reverse = false } = spec;
  const bri = Math.max(0, Math.min(5, Math.round(brightness / 20)));
  const r = [mode];
  for (let k = 0; k < 4; k++) r.push(color[0], color[1], color[2]);
  r.push(0x00, (speed & 0x03) | (bri << 2) | (rainbow ? 0 : 0x20) | (reverse ? 0x40 : 0), leds);
  return r;
}

// 0x50 setup report. ledCounts: { JARGB1: n, ... }; specs: { JARGB1: { direct: true } | { mode, ... } }
export function setupReport(ledCounts, specs) {
  const r = new Array(SETUP_LEN).fill(0);
  r[0] = 0x50;
  const byRow = Object.fromEntries(Object.entries(HEADERS).map(([n, h]) => [h.row, n]));
  for (let row = 0; row < 18; row++) {
    const name = byRow[row];
    const leds = name ? Math.max(1, Math.min(MAX_LEDS, ledCounts[name] || 0)) : 0;
    const src = name && ledCounts[name] ? headerRow(specs[name], leds) : headerRow(null);
    for (let k = 0; k < 16; k++) r[1 + row * 16 + k] = src[k];
  }
  return r;
}

// 0x51 direct report for one header
export function directReport(header, leds, colors) {
  const [h0, h1] = HEADERS[header].h;
  const n = Math.max(1, Math.min(MAX_LEDS, leds));
  const r = new Array(DIRECT_LEN).fill(0);
  r.splice(0, 7, 0x51, 0x09, h0, h1, 0, 0, n);
  for (let i = 0; i < n; i++) {
    const c = colors[i] || [0, 0, 0];
    r[7 + i * 3] = c[0]; r[8 + i * 3] = c[1]; r[9 + i * 3] = c[2];
  }
  return r;
}
