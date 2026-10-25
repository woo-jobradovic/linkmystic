// Hidden window: renders LCD frames and sends them as JPEG straight to the engine over a MessagePort.
import { draw, loadFonts, decodeImage, frameAt } from './render.js';

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let state = {}, settings = null, port = null, frames = null, imageName = null;
const t0 = performance.now();

window.lm.onState(s => { state = s; });
window.lm.onSettings(async s => {
  settings = s;
  if (s.lcd.template === 'image' && s.lcd.image && s.lcd.image !== imageName) {
    imageName = s.lcd.image;
    const img = await window.lm.getLcdImage(imageName);
    frames = img ? await decodeImage(img.data, img.type).catch(() => null) : null;
  }
});
window.lm.onLcdPort(p => { port = p; port.start?.(); });

await loadFonts('../../assets/fonts');

async function loop() {
  const started = performance.now();
  const active = port && settings?.lcd.enabled && state.lcdPresent;
  if (active) {
    const t = (performance.now() - t0) / 1000;
    draw(ctx, state, settings.lcd, t, settings.lcd.template === 'image' ? frameAt(frames, t) : null);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.8));
    const buf = await blob.arrayBuffer();
    port.postMessage(buf, [buf]);
  }
  const interval = active ? 1000 / (settings.lcd.fps || 30) : 1000;
  setTimeout(loop, Math.max(0, interval - (performance.now() - started)));
}
loop();
