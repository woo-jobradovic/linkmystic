// Settings: defaults + strict validation. Anything the UI sends passes through sanitize() before use.
import { EFFECT_IDS, TEMP_COLORS } from './effects.js';
import { PRESETS, validCurve } from './cooling.js';
import { HEADERS, MODES } from './proto/msi.js';
import { THEMES, THEME_IDS, themeDefaults } from '../lcd/themes.js';

export const DEFAULTS = {
  lighting: { effect: 'rainbow', color: '#00aaff', brightness: 100, period: 6, direction: 'cw', temp: { cool: 30, warm: 36, hot: 42 }, tempColors: { ...TEMP_COLORS } },
  cooling: { preset: 'balanced', custom: { fans: PRESETS.balanced.fans, pump: PRESETS.balanced.pump }, noSensorFanDuty: 50 },
  msi: { mode: 'mixed', headers: { JARGB1: 12, JAF: 12 }, directHeaders: ['JARGB1'], style: {}, waveLeds: 12 },
  lcd: { enabled: true, template: 'cyberpunk', metric: 'liquid', min: 20, max: 50, brightness: 100, fps: 30, image: null, themes: themeDefaults() },
  app: { startWithWindows: true, startMinimized: true },
};

const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
const int = (v, lo, hi, d) => (Number.isInteger(v) ? Math.max(lo, Math.min(hi, v)) : d);
const color = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);
const bool = (v, d) => (typeof v === 'boolean' ? v : d);

// each LCD theme keeps its own colors and animation switches; anything missing or invalid falls back
function themes(D, base = THEMES) {
  const src = D.themes && typeof D.themes === 'object' ? D.themes : {};
  const out = {};
  for (const [name, def] of Object.entries(THEMES)) {
    const s = src[name] || {}, b = base?.[name] || def;
    out[name] = { colors: {}, animations: {} };
    for (const k of Object.keys(def.colors)) out[name].colors[k] = color(s.colors?.[k], b.colors?.[k] ?? def.colors[k]);
    for (const k of Object.keys(def.animations)) out[name].animations[k] = bool(s.animations?.[k], b.animations?.[k] ?? def.animations[k]);
  }
  // settings from before themes: the old Cyberpunk number color carries over
  if (!D.themes && typeof D.accent === 'string') out.cyberpunk.colors.number = color(D.accent, out.cyberpunk.colors.number);
  return out;
}

export function sanitize(input = {}, base = DEFAULTS) {
  const i = input || {}, b = base;
  const L = i.lighting || {}, C = i.cooling || {}, M = i.msi || {}, D = i.lcd || {}, A = i.app || {};
  const headerNames = Object.keys(HEADERS);
  const headers = {};
  for (const h of headerNames) {
    const src = M.headers && typeof M.headers === 'object' ? M.headers : b.msi.headers;
    const v = src[h];
    if (v !== undefined && v !== null) headers[h] = int(v, 1, 240, 12);
  }
  const style = {};
  for (const h of headerNames) { const s = (M.style || b.msi.style || {})[h]; if (s && Object.hasOwn(MODES, s) && s !== 'direct' && s !== 'off') style[h] = s; }
  const lcdMin = num(D.min, 0, 90, b.lcd.min);
  const t = L.temp || b.lighting.temp;
  const cool = num(t.cool, 0, 90, 30), warm = num(t.warm, cool + 1, 95, 36), hot = num(t.hot, warm + 1, 100, 42);
  const tc = L.tempColors || {}, btc = b.lighting.tempColors || TEMP_COLORS;
  return {
    lighting: {
      effect: oneOf(L.effect, EFFECT_IDS, b.lighting.effect),
      color: color(L.color, b.lighting.color),
      brightness: num(L.brightness, 0, 100, b.lighting.brightness),
      period: num(L.period, 1, 60, b.lighting.period),
      direction: oneOf(L.direction, ['cw', 'ccw'], b.lighting.direction || 'cw'),
      temp: { cool, warm, hot },
      tempColors: { cool: color(tc.cool, btc.cool), warm: color(tc.warm, btc.warm), hot: color(tc.hot, btc.hot) },
    },
    cooling: {
      preset: oneOf(C.preset, ['quiet', 'balanced', 'extreme', 'custom'], b.cooling.preset),
      custom: {
        fans: validCurve(C.custom?.fans) ? C.custom.fans.map(p => [...p]) : b.cooling.custom.fans,
        pump: validCurve(C.custom?.pump) ? C.custom.pump.map(p => [...p]) : b.cooling.custom.pump,
      },
      noSensorFanDuty: num(C.noSensorFanDuty, 20, 100, b.cooling.noSensorFanDuty),
    },
    msi: {
      mode: oneOf(M.mode, ['builtin', 'mixed', 'direct'], b.msi.mode),
      headers,                                    // may be empty: no MSI headers in use
      directHeaders: Array.isArray(M.directHeaders) ? M.directHeaders.filter(h => headerNames.includes(h)) : b.msi.directHeaders,
      style,
      waveLeds: int(M.waveLeds, 4, 120, b.msi.waveLeds),
    },
    lcd: {
      enabled: bool(D.enabled, b.lcd.enabled),
      template: oneOf(D.template, [...THEME_IDS, 'image'], b.lcd.template),
      metric: oneOf(D.metric, ['liquid', 'pump', 'fans'], b.lcd.metric),
      min: lcdMin,
      max: num(D.max, lcdMin + 5, 100, Math.max(b.lcd.max, lcdMin + 5)),
      brightness: num(D.brightness, 0, 100, b.lcd.brightness),
      fps: int(D.fps, 1, 30, b.lcd.fps),
      image: typeof D.image === 'string' && /^[\w.-]{1,80}$/.test(D.image) ? D.image : (D.image === null ? null : b.lcd.image),
      themes: themes(D, b.lcd.themes),
    },
    app: { startWithWindows: bool(A.startWithWindows, b.app.startWithWindows), startMinimized: bool(A.startMinimized, b.app.startMinimized) },
  };
}

// merge a partial update from the UI onto the current settings, then validate the result
export function update(current, patch) {
  const merged = structuredClone(current);
  for (const k of Object.keys(patch || {})) {
    if (!Object.hasOwn(DEFAULTS, k) || typeof patch[k] !== 'object' || patch[k] === null) continue;
    merged[k] = { ...merged[k], ...patch[k] };
  }
  return sanitize(merged, current);
}
