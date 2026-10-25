// Lighting effects shared by every zone, so all devices stay in sync.
// An effect gives [r,g,b] for an LED at position p (0..1 around one wheel) at time t (seconds).

export const EFFECT_IDS = ['temperature', 'static', 'breathing', 'rainbow', 'color-cycle', 'off'];

export const hexToRgb = s => (/^#[0-9a-f]{6}$/i.test(s) ? [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16)) : [255, 255, 255]);
const hsv = h => {
  const f = n => { const k = (n + h * 6) % 6; return 1 - Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5), f(3), f(1)].map(x => Math.round(x * 255));
};
const mix = (a, b, k) => a.map((x, i) => Math.round(x + (b[i] - x) * k));

// green at cool, yellow at warm, red at hot
export function tempColor(temp, { cool, warm, hot }) {
  const G = [0, 255, 0], Y = [255, 255, 0], R = [255, 0, 0];
  if (!Number.isFinite(temp) || temp <= cool) return G;
  if (temp <= warm) return mix(G, Y, (temp - cool) / (warm - cool));
  if (temp <= hot) return mix(Y, R, (temp - warm) / (hot - warm));
  return R;
}

const FX = {
  static: cfg => () => hexToRgb(cfg.color),
  breathing: cfg => (p, t) => { const k = 0.15 + 0.85 * (0.5 - 0.5 * Math.cos(t * Math.PI * 2 / cfg.period)); return hexToRgb(cfg.color).map(x => Math.round(x * k)); },
  rainbow: cfg => (p, t) => hsv(((p + t / cfg.period) % 1 + 1) % 1),
  'color-cycle': cfg => (p, t) => hsv((t / cfg.period) % 1),
  temperature: (cfg, temp) => () => tempColor(temp, cfg.temp),
  off: () => () => [0, 0, 0],
};

// Render `count` LEDs. `wave` = LEDs per full colour wheel (one fan = one wheel, like iCUE).
export function render(cfg, temp, count, t, wave = count) {
  const fx = (FX[cfg.effect] || FX.static)(cfg, temp);
  const k = Math.max(0, Math.min(100, cfg.brightness)) / 100;
  const out = [];
  for (let i = 0; i < count; i++) out.push(fx((i / Math.max(1, wave)) % 1, t).map(x => Math.round(x * k)));
  return out;
}

export const isAnimated = effect => ['breathing', 'rainbow', 'color-cycle'].includes(effect);
