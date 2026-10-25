// LCD templates, drawn on a 480x480 canvas. Shared by the hidden LCD renderer window and the LCD tab preview,
// so what users design is exactly what the pump screen shows. The themes live in ./themes/*.js.
import { THEMES, themeById } from './themes.js';
import { SIZE, C, ALARM, reading } from './themes/common.js';

export { SIZE, reading };

let fontsReady = null;
export function loadFonts(base) {
  fontsReady ??= Promise.all([
    new FontFace('LM Display', `url(${base}/Orbitron.ttf)`, { weight: '400 900' }).load(),
    new FontFace('LM Mono', `url(${base}/ShareTechMono.ttf)`).load(),
  ]).then(faces => { for (const f of faces) document.fonts.add(f); }).catch(() => {});
  return fontsReady;
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
  ctx.fillStyle = state.alarm ? ALARM : '#fff'; ctx.textAlign = 'center'; ctx.font = '700 40px "LM Display"';
  ctx.fillText(`${Number.isFinite(r.value) ? r.value.toFixed(0) : '--'}${r.unit === 'RPM' ? '' : '°'}`, C, 407);
}

export function draw(ctx, state, lcd, t, frame = null) {
  ctx.save();
  if (lcd.template === 'image') image(ctx, state, lcd, t, frame);
  else {
    const theme = themeById(lcd.template) || themeById('cyberpunk');
    theme.draw(ctx, state, lcd, t, lcd.themes?.[theme.id] || THEMES[theme.id]);
  }
  ctx.restore();
}

// Animated image support (GIF/APNG/WebP via ImageDecoder, still images via createImageBitmap).
// Every frame is downscaled to cover the 480x480 screen while decoding, so memory stays small
// (at most MAX_FRAMES x ~1 MB); absurdly large source images are refused.
const MAX_FRAMES = 150;
const MAX_SOURCE_PIXELS = 40e6;
async function fitted(src) {
  const w = src.displayWidth || src.width, h = src.displayHeight || src.height;
  if (!w || !h || w * h > MAX_SOURCE_PIXELS) throw new Error('image too large');
  const s = Math.max(SIZE / w, SIZE / h);
  return createImageBitmap(src, { resizeWidth: Math.max(1, Math.round(w * s)), resizeHeight: Math.max(1, Math.round(h * s)), resizeQuality: 'medium' });
}
export async function decodeImage(buffer, type) {
  if ('ImageDecoder' in window && /gif|webp|png/.test(type)) {
    const dec = new ImageDecoder({ data: buffer, type });
    const frames = [];
    try {
      await dec.tracks.ready;
      const count = Math.min(dec.tracks.selectedTrack?.frameCount || 1, MAX_FRAMES);
      for (let i = 0; i < count; i++) {
        const { image: f } = await dec.decode({ frameIndex: i });
        try { frames.push({ bitmap: await fitted(f), ms: Math.max(20, (f.duration || 100000) / 1000) }); } finally { f.close(); }
      }
      return frames;
    } catch (e) { freeFrames(frames); throw e; } finally { dec.close(); }
  }
  const full = await createImageBitmap(new Blob([buffer], { type }));
  try { return [{ bitmap: await fitted(full), ms: 1e9 }]; } finally { full.close(); }
}
export function freeFrames(frames) { for (const f of frames || []) f.bitmap?.close(); }
export function frameAt(frames, t) {
  if (!frames?.length) return null;
  const total = frames.reduce((a, f) => a + f.ms, 0);
  let x = (t * 1000) % total;
  for (const f of frames) { if (x < f.ms) return f.bitmap; x -= f.ms; }
  return frames[0].bitmap;
}
