// Lighting effects shared by every zone, so all devices stay in sync.
// An effect gives [r,g,b] for an LED at position p (0..1 around one wheel) at time t (seconds).
// `phase` (0..1) shifts an effect per device or per wheel; only the spiral uses it, everything else stays in lockstep.

export const EFFECT_IDS = ['temperature', 'static', 'breathing', 'color-pulse', 'rainbow', 'spiral-rainbow', 'color-cycle', 'color-wave', 'visor', 'off'];

// which settings each effect actually uses (the UI hides the rest)
export const EFFECT_USES = {
  temperature: ['brightness', 'temp'],
  static: ['color', 'brightness'],
  breathing: ['color', 'brightness', 'speed'],
  'color-pulse': ['color', 'brightness', 'speed'],
  rainbow: ['brightness', 'speed', 'direction'],
  'spiral-rainbow': ['brightness', 'speed', 'direction'],
  'color-cycle': ['brightness', 'speed'],
  'color-wave': ['color', 'brightness', 'speed', 'direction'],
  visor: ['color', 'brightness', 'speed'],
  off: [],
};

export const TEMP_COLORS = { cool: '#00ff00', warm: '#ffff00', hot: '#ff0000' };

export const hexToRgb = s => (/^#[0-9a-f]{6}$/i.test(s) ? [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)) : [255, 255, 255]);
const hsv = h => {
  const f = n => { const k = (n + h * 6) % 6; return 1 - Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5), f(3), f(1)].map(x => Math.round(x * 255));
};
const mix = (a, b, k) => a.map((x, i) => Math.round(x + (b[i] - x) * k));
const wrap = x => ((x % 1) + 1) % 1;
// LEDs are linear, eyes are not: fades are shaped in perceived brightness and converted back (gamma 2.2),
// so a breath no longer jumps out of the dark part and lingers at the top
const lum = k => Math.pow(Math.max(0, Math.min(1, k)), 2.2);
const scale = (c, k) => c.map(x => Math.round(x * k));
const cosine = x => 0.5 - 0.5 * Math.cos(x * Math.PI * 2);   // 0 -> 1 -> 0 over x = 0..1

// cool color up to `cool`, blending to warm at `warm`, then to hot at `hot` (default green / yellow / red)
export function tempColor(temp, { cool, warm, hot }, colors = TEMP_COLORS) {
  const C = hexToRgb(colors.cool), W = hexToRgb(colors.warm), H = hexToRgb(colors.hot);
  if (!Number.isFinite(temp) || temp <= cool) return C;
  if (temp <= warm) return mix(C, W, (temp - cool) / (warm - cool));
  if (temp <= hot) return mix(W, H, (temp - warm) / (hot - warm));
  return H;
}

const FX = {
  static: cfg => { const c = hexToRgb(cfg.color); return () => c; },
  breathing: cfg => { const c = hexToRgb(cfg.color); return (p, t) => scale(c, lum(0.25 + 0.75 * cosine(t / cfg.period))); },
  // quick flash, slow fade, all devices together
  'color-pulse': cfg => {
    const c = hexToRgb(cfg.color);
    return (p, t) => { const u = wrap(t / cfg.period); return scale(c, lum(u < 0.08 ? u / 0.08 : Math.exp(-(u - 0.08) * 6))); };
  },
  // each wheel shows the whole rainbow and turns
  rainbow: (cfg, temp, dir) => (p, t) => hsv(wrap(p + dir * t / cfg.period)),
  // the turning rainbow, each wheel a quarter turn behind the one before, so the colors spiral through the system
  'spiral-rainbow': (cfg, temp, dir) => (p, t, phase) => hsv(wrap(p + phase + dir * t / cfg.period)),
  'color-cycle': cfg => (p, t) => hsv(wrap(t / cfg.period)),
  // a bright band of the color travels around each wheel over a dim trail
  'color-wave': (cfg, temp, dir) => {
    const c = hexToRgb(cfg.color);
    return (p, t) => { const d = wrap(p - dir * t / cfg.period); return scale(c, lum(0.12 + 0.88 * Math.pow(cosine(d), 3))); };
  },
  // a band of the color sweeps back and forth across each wheel
  visor: cfg => {
    const c = hexToRgb(cfg.color);
    return (p, t) => { const pos = cosine(t / cfg.period / 2); return scale(c, lum(Math.max(0, 1 - Math.abs(p - pos) / 0.3))); };
  },
  temperature: (cfg, temp) => { const c = tempColor(temp, cfg.temp, cfg.tempColors); return () => c; },
  off: () => () => [0, 0, 0],
};

// Render `count` LEDs. `wave` = LEDs per full color wheel (one fan = one wheel, like iCUE).
// `phase` = this device's offset; every further wheel inside one strip adds a quarter turn.
export function render(cfg, temp, count, t, wave = count, phase = 0) {
  const dir = cfg.direction === 'ccw' ? -1 : 1;
  const fx = (FX[cfg.effect] || FX.static)(cfg, temp, dir);
  const k = Math.max(0, Math.min(100, cfg.brightness)) / 100;
  const w = Math.max(1, wave), out = [];
  for (let i = 0; i < count; i++) out.push(scale(fx((i / w) % 1, t, wrap(phase + Math.floor(i / w) * 0.25)), k));
  return out;
}

export const isAnimated = effect => !['static', 'temperature', 'off'].includes(effect);
