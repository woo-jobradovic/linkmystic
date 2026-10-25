// LCD templates, drawn on a 480x480 canvas. Shared by the hidden LCD renderer window and the LCD tab preview,
// so what users design is exactly what the pump screen shows.
export const SIZE = 480;
const C = 240;
const NEON = { yellow: '#fcee0a', cyan: '#00f0ff', red: '#ff003c', magenta: '#ff00aa' };

let fontsReady = null;
export function loadFonts(base) {
  fontsReady ??= Promise.all([
    new FontFace('LM Display', `url(${base}/Orbitron.ttf)`, { weight: '400 900' }).load(),
    new FontFace('LM Mono', `url(${base}/ShareTechMono.ttf)`).load(),
  ]).then(faces => { for (const f of faces) document.fonts.add(f); }).catch(() => {});
  return fontsReady;
}

// value shown on the screen + its range
export function reading(state, lcd) {
  if (lcd.metric === 'pump') return { label: 'PUMP', value: state.pumpRpm, unit: 'RPM', min: 0, max: 3200, digits: 0 };
  if (lcd.metric === 'fans') {
    const f = state.fanRpm?.length ? state.fanRpm.reduce((a, b) => a + b, 0) / state.fanRpm.length : null;
    return { label: 'FANS', value: f, unit: 'RPM', min: 0, max: 2400, digits: 0 };
  }
  return { label: 'COOLANT', value: state.liquid, unit: '°C', min: lcd.min, max: lcd.max, digits: 0 };
}

const level = r => (Number.isFinite(r.value) ? Math.max(0, Math.min(1, (r.value - r.min) / (r.max - r.min))) : 0);
const gauge = k => (k < 0.55 ? mixHex(NEON.cyan, NEON.yellow, k / 0.55) : mixHex(NEON.yellow, NEON.red, (k - 0.55) / 0.45));
function mixHex(a, b, k) {
  const p = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`;
}

function segments(ctx, lit, n, alpha, r0 = 196, r1 = 226) {
  const start = Math.PI * 0.75, sweep = Math.PI * 1.5, seg = sweep / n, gap = seg * 0.18;
  for (let i = 0; i < n; i++) {
    const a0 = start + i * seg + gap / 2, a1 = start + (i + 1) * seg - gap / 2;
    ctx.beginPath();
    ctx.arc(C, C, r1, a0, a1);
    ctx.arc(C, C, r0, a1, a0, true);
    ctx.closePath();
    if (i < lit) { ctx.fillStyle = gauge(i / (n - 1)); ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14 * alpha; }
    else { ctx.fillStyle = '#16222c'; ctx.shadowBlur = 0; }
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

function cyberpunk(ctx, state, lcd, t) {
  const r = reading(state, lcd), n = 36, lit = Math.round(level(r) * n);
  ctx.fillStyle = '#06070c'; ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  for (let y = 0; y < SIZE; y += 3) ctx.fillRect(0, y, SIZE, 1);                       // scanlines
  segments(ctx, lit, n, 0.6 + 0.4 * Math.sin(t * Math.PI * 1.2));
  ctx.strokeStyle = 'rgba(0,240,255,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([2, 6]);
  ctx.beginPath(); ctx.arc(C, C, 185, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke(); ctx.setLineDash([]);
  const sweepY = (t * 160) % (SIZE + 60) - 30;                                          // scan sweep
  const g = ctx.createLinearGradient(0, sweepY - 24, 0, sweepY);
  g.addColorStop(0, 'rgba(0,240,255,0)'); g.addColorStop(1, 'rgba(0,240,255,0.22)');
  ctx.fillStyle = g; ctx.fillRect(0, sweepY - 24, SIZE, 26);

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.font = '24px "LM Mono"'; ctx.fillStyle = NEON.cyan; ctx.fillText(`// ${r.label}`, C, 140);
  const glitch = t % 2.5 < 0.14, jx = glitch ? Math.round(Math.sin(t * 97) * 10) : 0, split = glitch ? 10 : 4;
  const txt = Number.isFinite(r.value) ? r.value.toFixed(r.digits) : '--';
  const big = r.unit === 'RPM' ? 96 : 150;
  ctx.font = `900 ${big}px "LM Display"`;
  const y = r.unit === 'RPM' ? 280 : 300;
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = NEON.magenta; ctx.fillText(txt, C - split + jx, y);
  ctx.fillStyle = NEON.cyan; ctx.fillText(txt, C + split + jx, y);
  ctx.globalAlpha = 1;
  ctx.fillStyle = state.alarm ? NEON.red : lcd.accent || NEON.yellow; ctx.fillText(txt, C + jx, y);
  if (glitch) { const sy = 190 + Math.floor(Math.abs(Math.sin(t * 53)) * 90); ctx.drawImage(ctx.canvas, 0, sy, SIZE, 10, jx * 2, sy, SIZE, 10); }
  ctx.font = '700 34px "LM Display"'; ctx.fillStyle = NEON.cyan; ctx.fillText(r.unit, C, y + 44);
  ctx.font = '22px "LM Mono"'; ctx.fillStyle = NEON.yellow;
  const fan = state.fanRpm?.length ? Math.round(state.fanRpm.reduce((a, b) => a + b, 0) / state.fanRpm.length) : null;
  const pad = v => (Number.isFinite(v) ? String(Math.round(v)).padStart(4, '0') : '----');
  ctx.fillText(`PUMP ${pad(state.pumpRpm)}  FAN ${pad(fan)}`, C, 384);
  ctx.fillStyle = state.alarm ? NEON.red : NEON.cyan; ctx.font = '24px "LM Mono"';
  ctx.fillText(state.alarm ? '!! ALERT' : 'SYS.OK', C, 430);
}

function minimal(ctx, state, lcd) {
  const r = reading(state, lcd), k = level(r);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.lineCap = 'round'; ctx.lineWidth = 22;
  ctx.strokeStyle = '#1b1f26'; ctx.beginPath(); ctx.arc(C, C, 200, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke();
  ctx.strokeStyle = state.alarm ? NEON.red : gauge(k); ctx.beginPath(); ctx.arc(C, C, 200, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * Math.max(0.01, k))); ctx.stroke();
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.font = `700 ${r.unit === 'RPM' ? 100 : 140}px "LM Display"`;
  ctx.fillText(Number.isFinite(r.value) ? r.value.toFixed(r.digits) : '--', C, 280);
  ctx.font = '28px "LM Mono"'; ctx.fillStyle = '#9aa0a8'; ctx.fillText(`${r.label}  ${r.unit}`, C, 340);
}

// image template: frame = ImageBitmap / VideoFrame / canvas; small temperature badge on top
function image(ctx, state, lcd, t, frame) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SIZE, SIZE);
  if (frame) {
    const w = frame.displayWidth || frame.width, h = frame.displayHeight || frame.height, s = Math.max(SIZE / w, SIZE / h);
    ctx.drawImage(frame, C - (w * s) / 2, C - (h * s) / 2, w * s, h * s);
  } else { ctx.fillStyle = '#9aa0a8'; ctx.font = '26px "LM Mono"'; ctx.textAlign = 'center'; ctx.fillText('choose an image or GIF', C, C); }
  const r = reading(state, lcd);
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.roundRect(C - 90, 360, 180, 64, 32); ctx.fill();
  ctx.fillStyle = state.alarm ? NEON.red : '#fff'; ctx.textAlign = 'center'; ctx.font = '700 40px "LM Display"';
  ctx.fillText(`${Number.isFinite(r.value) ? r.value.toFixed(0) : '--'}${r.unit === 'RPM' ? '' : '°'}`, C, 407);
}

export function draw(ctx, state, lcd, t, frame = null) {
  ctx.save();
  if (lcd.template === 'minimal') minimal(ctx, state, lcd, t);
  else if (lcd.template === 'image') image(ctx, state, lcd, t, frame);
  else cyberpunk(ctx, state, lcd, t);
  ctx.restore();
}

// Animated image support (GIF/APNG/WebP via ImageDecoder, still images via createImageBitmap)
export async function decodeImage(buffer, type) {
  if ('ImageDecoder' in window && /gif|webp|png/.test(type)) {
    const dec = new ImageDecoder({ data: buffer, type });
    await dec.tracks.ready;
    const count = dec.tracks.selectedTrack?.frameCount || 1;
    const frames = [];
    for (let i = 0; i < Math.min(count, 300); i++) { const { image: f } = await dec.decode({ frameIndex: i }); frames.push({ bitmap: await createImageBitmap(f), ms: (f.duration || 100000) / 1000 }); f.close(); }
    return frames;
  }
  return [{ bitmap: await createImageBitmap(new Blob([buffer], { type })), ms: 1e9 }];
}
export function frameAt(frames, t) {
  if (!frames?.length) return null;
  const total = frames.reduce((a, f) => a + f.ms, 0);
  let x = (t * 1000) % total;
  for (const f of frames) { if (x < f.ms) return f.bitmap; x -= f.ms; }
  return frames[0].bitmap;
}
