// Hidden window: renders LCD frames and sends them as JPEG straight to the engine over a MessagePort.
import { draw, loadFonts, decodeImage, frameAt, freeFrames } from './render.js';

// CPU-rendered offscreen canvas + convertToBlob: about 2 ms per frame. (canvas.toBlob runs as a low-priority
// idle task in this hidden window and took 55-200 ms per frame, which made the screen stutter.)
const canvas = new OffscreenCanvas(480, 480);
const ctx = canvas.getContext('2d', { willReadFrequently: true });
let state = {}, settings = null, port = null, frames = null, imageName = null;
const t0 = performance.now();

window.lm.onState(s => { state = s; });
window.lm.onSettings(async s => {
  settings = s;
  if (s.lcd.template === 'image' && s.lcd.image && s.lcd.image !== imageName) {
    imageName = s.lcd.image;
    const img = await window.lm.getLcdImage(imageName);
    const next = img ? await decodeImage(img.data, img.type).catch(() => null) : null;
    freeFrames(frames);
    frames = next;
  }
});
// Pacing: the engine answers every frame with 'ack' once the screen has it. At most two frames are out
// (one being written, one ready), and the next is drawn the moment a slot frees, at the moment it is needed:
// the screen sets the rhythm, nothing is dropped, and the animation moves evenly.
const IN_FLIGHT = 2;
let inFlight = 0, lastSent = 0, timer = null, rendering = false;

window.addEventListener('message', e => {
  if (e.source !== window || e.data !== 'lm-lcd-port' || !e.ports?.[0]) return;
  port?.close?.();
  port = e.ports[0];
  inFlight = 0;
  port.onmessage = m => { if (m.data === 'ack') { inFlight = Math.max(0, inFlight - 1); kick(); } };
});

await loadFonts('../../assets/fonts');

function kick() {
  if (rendering) return;
  clearTimeout(timer);
  const present = port && settings && state.lcdPresent;
  if (!present) { timer = setTimeout(kick, 1000); return; }
  const active = settings.lcd.enabled;
  // switched off: a black frame every 2 s keeps the screen dark (the engine also turns the backlight off)
  const interval = active ? 1000 / (settings.lcd.fps || 30) : 2000;
  const now = performance.now();
  if (inFlight > 0 && now - lastSent > 3000) inFlight = 0;    // an answer got lost (engine restart): never stall
  const wait = lastSent + interval - now;
  if (wait > 0) { timer = setTimeout(kick, wait); return; }
  if (inFlight >= IN_FLIGHT) { timer = setTimeout(kick, 3000); return; }   // the next 'ack' calls kick()
  sendFrame(active);
}

async function sendFrame(active) {
  rendering = true; inFlight++; lastSent = performance.now();
  try {
    const t = (lastSent - t0) / 1000;
    if (active) draw(ctx, state, settings.lcd, t, settings.lcd.template === 'image' ? frameAt(frames, t) : null);
    else { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    const buf = await (await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 })).arrayBuffer();
    // a copy, not a transfer: a transferred ArrayBuffer arrives as null on the engine side
    if (buf) port.postMessage(new Uint8Array(buf)); else inFlight--;
  } catch (e) { inFlight--; console.error('LCD frame failed', e); }   // one bad frame must never stop the screen
  finally { rendering = false; kick(); }
}
kick();
