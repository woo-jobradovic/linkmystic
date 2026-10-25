// Shared drawing helpers for the LCD themes (480x480 round screen).
export const SIZE = 480;
export const C = 240;
export const ALARM = '#ff003c';                       // alarms are always this red, whatever the theme colors
export const START = Math.PI * 0.75, SWEEP = Math.PI * 1.5;   // the 270° gauge arc most themes use

// value shown on the screen + its range
export function reading(state, lcd) {
  if (lcd.metric === 'pump') return { label: 'PUMP', value: state.pumpRpm, unit: 'RPM', min: 0, max: 3200, digits: 0 };
  if (lcd.metric === 'fans') return { label: 'FANS', value: fanAvg(state), unit: 'RPM', min: 0, max: 2400, digits: 0 };
  return { label: 'COOLANT', value: state.liquid, unit: '°C', min: lcd.min, max: lcd.max, digits: 0 };
}
export const level = r => (Number.isFinite(r.value) ? Math.max(0, Math.min(1, (r.value - r.min) / (r.max - r.min))) : 0);
export const valueText = r => (Number.isFinite(r.value) ? r.value.toFixed(r.digits) : '--');
export const fanAvg = state => (state.fanRpm?.length ? Math.round(state.fanRpm.reduce((a, b) => a + b, 0) / state.fanRpm.length) : null);
export const pad4 = v => (Number.isFinite(v) ? String(Math.round(v)).padStart(4, '0') : '----');
export const isRpm = r => r.unit === 'RPM';

const parse = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
export const rgba = (hex, a) => `rgba(${parse(hex).join(',')},${a})`;
export function mix(a, b, k) {
  const x = parse(a), y = parse(b), q = Math.max(0, Math.min(1, k));
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * q)).join(',')})`;
}
// the same blend as a #rrggbb string, for use with rgba()
export function mixHex(a, b, k) {
  const x = parse(a), y = parse(b), q = Math.max(0, Math.min(1, k));
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * q).toString(16).padStart(2, '0')).join('');
}
export const gauge3 = (k, lo, mid, hi) => (k < 0.55 ? mix(lo, mid, k / 0.55) : mix(mid, hi, (k - 0.55) / 0.45));
// deterministic pseudo-random 0..1, so particles and textures are the same every frame
export const rnd = n => { const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
export const wrap = x => ((x % 1) + 1) % 1;

// the big number, shrunk until it fits `maxW`
export function bigText(ctx, text, px, family, maxW, weight = '700') {
  let s = px;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > 20) { s -= 4; ctx.font = `${weight} ${s}px ${family}`; }
  return s;
}
// a smaller line of text that must stay inside a box: shrinks from px until it fits maxW (never below 9 px)
export function fitFont(ctx, text, maxW, px, family, weight = '400') {
  let s = px;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > 9) { s -= 1; ctx.font = `${weight} ${s}px ${family}`; }
  return s;
}
// text with a solid outline (outline first, fill on top)
export function outlined(ctx, text, x, y, fill, stroke, width) {
  ctx.lineJoin = 'round'; ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}
export function star(ctx, x, y, r, points = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / points, rr = i % 2 ? r * inner : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
export function polygon(ctx, x, y, r, sides, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) { const a = rot + i * Math.PI * 2 / sides; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  ctx.closePath();
}
