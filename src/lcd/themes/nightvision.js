// Phosphor Optics: night-vision scope with mil-dots, compass tape, REC indicator, twin load arcs, scanlines and grain.
import { SIZE, C, ALARM, reading, level, valueText, fanAvg, pad4, isRpm, rgba, mix, rnd, wrap, bigText } from './common.js';

// Lazily built tiles, drawn as repeating patterns: one fill each per frame
let scanCanvas = null;
function getScan() {
  if (scanCanvas) return scanCanvas;
  scanCanvas = new OffscreenCanvas(4, 4);
  const g = scanCanvas.getContext('2d');
  g.fillStyle = 'rgba(0, 0, 0, 0.22)';
  g.fillRect(0, 0, 4, 1.5);
  return scanCanvas;
}
let grainCanvas = null;
function getGrain() {
  if (grainCanvas) return grainCanvas;
  const G = 120;
  grainCanvas = new OffscreenCanvas(G, G);
  const g = grainCanvas.getContext('2d');
  for (let y = 0; y < G; y += 2) {
    for (let x = 0; x < G; x += 2) {
      const n = rnd(y * 131 + x * 17);
      if (n > 0.62) {
        g.fillStyle = `rgba(210, 255, 220, ${(n - 0.62) * 0.25})`;
        g.fillRect(x, y, 2, 2);
      } else if (n < 0.28) {
        g.fillStyle = `rgba(0, 0, 0, ${(0.28 - n) * 0.45})`;
        g.fillRect(x, y, 2, 2);
      }
    }
  }
  return grainCanvas;
}

export default {
  id: 'nightvision',
  name: 'Phosphor Optics',
  blurb: 'Night-vision phosphor optics with mil-dot reticle, grain and scan bands.',
  colors: [
    ['number', 'Number', '#e4ffea'],
    ['phosphor', 'Phosphor green', '#28f068'],
    ['reticle', 'Scope reticle', '#7aff9e'],
    ['amber', 'Warning amber', '#ffb82e'],
    ['rec', 'REC indicator', '#ff2a38'],
  ],
  animations: [
    ['scan', 'Rolling scan bands', true],
    ['grain', 'Phosphor tube grain', true],
    ['rec', 'Blinking REC & compass', true],
  ],
  draw(ctx, state, lcd, t, { colors: c, animations: a }) {
    const r = reading(state, lcd), k = level(r);

    // 1. Intensifier tube radial phosphor background
    const bg = ctx.createRadialGradient(C, C, 15, C, C, 245);
    bg.addColorStop(0, mix(c.phosphor, '#061a0c', 0.72));
    bg.addColorStop(0.68, mix(c.phosphor, '#020d05', 0.86));
    bg.addColorStop(1, '#010402');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Subtle topographic grid rings inside optics
    ctx.strokeStyle = rgba(c.phosphor, 0.11);
    ctx.lineWidth = 1;
    for (const rad of [75, 135, 195]) {
      ctx.beginPath();
      ctx.arc(C, C, rad, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. Mil-dot scope crosshairs (broken around center readout for clarity)
    ctx.strokeStyle = rgba(c.reticle, 0.42);
    ctx.fillStyle = rgba(c.reticle, 0.65);
    ctx.lineWidth = 1.5;

    // Horizontal arms
    ctx.beginPath();
    ctx.moveTo(32, C); ctx.lineTo(116, C);
    ctx.moveTo(364, C); ctx.lineTo(448, C);
    // Vertical arms
    ctx.moveTo(C, 86); ctx.lineTo(C, 154);
    ctx.moveTo(C, 314); ctx.lineTo(C, 360);
    ctx.stroke();

    // Mil-dots and stadia ticks along horizontal & vertical axes
    for (const d of [-185, -165, -145, -125, 125, 145, 165, 185]) {
      ctx.beginPath();
      ctx.arc(C + d, C, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(C + d, C - 5);
      ctx.lineTo(C + d, C + 5);
      ctx.stroke();
    }
    for (const d of [-140, -120, -100, 82, 102]) {
      ctx.beginPath();
      ctx.arc(C, C + d, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Top compass heading tape
    const tapeW = 210, tapeX = C - tapeW / 2, tapeY = 44;
    ctx.save();
    ctx.beginPath();
    ctx.rect(tapeX, tapeY, tapeW, 30);
    ctx.clip();

    ctx.fillStyle = 'rgba(0, 12, 4, 0.65)';
    ctx.fillRect(tapeX, tapeY, tapeW, 30);
    const drift = a.rec ? Math.sin(t * 0.45) * 35 + k * 60 : k * 60;
    ctx.font = '600 13px "LM Mono"';
    ctx.textAlign = 'center';
    ctx.strokeStyle = rgba(c.reticle, 0.55);
    ctx.fillStyle = c.reticle;

    for (let i = -8; i <= 8; i++) {
      const x = C + i * 22 - (drift % 22);
      const deg = (((Math.round(drift / 22) + i) * 15) % 360 + 360) % 360;
      const major = deg % 45 === 0;
      ctx.beginPath();
      ctx.moveTo(x, tapeY + 28);
      ctx.lineTo(x, tapeY + (major ? 17 : 22));
      ctx.stroke();
      if (major) {
        const card = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg);
        ctx.fillText(card, x, tapeY + 13);
      }
    }
    ctx.restore();
    // Center compass lubber triangle
    ctx.fillStyle = c.amber;
    ctx.beginPath();
    ctx.moveTo(C, tapeY + 34);
    ctx.lineTo(C - 5, tapeY + 41);
    ctx.lineTo(C + 5, tapeY + 41);
    ctx.closePath();
    ctx.fill();

    // 4. Twin curved thermal-load gauge arcs (left and right of scope)
    const segs = 28, lit = Math.round(k * segs);
    const span = Math.PI * 0.62;
    for (const side of [-1, 1]) {
      const baseAng = side === -1 ? Math.PI : 0;
      for (let i = 0; i < segs; i++) {
        const frac = i / (segs - 1);
        const ang = side === -1
          ? (baseAng - span / 2) + frac * span
          : (baseAng + span / 2) - frac * span;
        const rIn = i % 4 === 0 ? 198 : 203;
        const rOut = 216;
        const isLit = i < lit;
        const segCol = state.alarm
          ? ALARM
          : frac > 0.78 ? c.amber : c.phosphor;

        ctx.strokeStyle = isLit ? segCol : rgba(c.phosphor, 0.14);
        ctx.lineWidth = i % 4 === 0 ? 4.5 : 3;
        ctx.beginPath();
        ctx.moveTo(C + Math.cos(ang) * rIn, C + Math.sin(ang) * rIn);
        ctx.lineTo(C + Math.cos(ang) * rOut, C + Math.sin(ang) * rOut);
        ctx.stroke();
      }
    }

    // 5. Blinking REC status & NVG battery indicator
    const recOn = !a.rec || (t % 1.1) < 0.65;
    ctx.fillStyle = recOn ? c.rec : rgba(c.rec, 0.2);
    ctx.beginPath();
    ctx.arc(118, 108, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '700 15px "LM Mono"';
    ctx.textAlign = 'left';
    ctx.fillStyle = c.reticle;
    ctx.fillText('REC', 129, 113);

    // Right side GAIN / IR status
    ctx.textAlign = 'right';
    ctx.fillStyle = state.alarm ? ALARM : c.amber;
    ctx.fillText(`LOAD ${Math.round(k * 100)}%`, 368, 113);

    // 6. Central optical target brackets & primary readout
    ctx.strokeStyle = state.alarm ? ALARM : c.phosphor;
    ctx.lineWidth = 2.5;
    for (const [bx, by, dx, dy] of [[124, 166, 1, 1], [356, 166, -1, 1], [124, 306, 1, -1], [356, 306, -1, -1]]) {
      ctx.beginPath();
      ctx.moveTo(bx, by + dy * 20);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + dx * 20, by);
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 20px "LM Mono"';
    ctx.fillStyle = c.reticle;
    ctx.fillText(`[ ${r.label} ]`, C, 154);

    // Big phosphor number with bloom layer
    const valStr = valueText(r);
    bigText(ctx, valStr, isRpm(r) ? 116 : 146, '"LM Mono"', 225, '700');
    ctx.fillStyle = state.alarm ? rgba(ALARM, 0.28) : rgba(c.phosphor, 0.28);
    ctx.fillText(valStr, C + 2, 276);
    ctx.fillText(valStr, C - 2, 272);
    ctx.fillStyle = state.alarm ? ALARM : c.number;
    ctx.fillText(valStr, C, 274);

    ctx.font = '700 26px "LM Mono"';
    ctx.fillStyle = c.phosphor;
    ctx.fillText(r.unit, C, 304);

    // 7. Bottom ammo-counter style telemetry box
    const boxW = 216, boxH = 54, boxX = C - boxW / 2, boxY = 358;
    ctx.fillStyle = 'rgba(2, 14, 5, 0.78)';
    ctx.strokeStyle = rgba(c.phosphor, 0.55);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();

    // Vertical divider
    ctx.beginPath();
    ctx.moveTo(C, boxY + 8);
    ctx.lineTo(C, boxY + boxH - 8);
    ctx.stroke();

    ctx.font = '600 12px "LM Mono"';
    ctx.fillStyle = rgba(c.reticle, 0.7);
    ctx.fillText('PUMP RPM', C - 54, boxY + 18);
    ctx.fillText('FANS RPM', C + 54, boxY + 18);

    ctx.font = '700 26px "LM Mono"';
    ctx.fillStyle = state.alarm ? ALARM : c.number;
    ctx.fillText(pad4(state.pumpRpm), C - 54, boxY + 44);
    ctx.fillStyle = c.phosphor;
    ctx.fillText(pad4(fanAvg(state)), C + 54, boxY + 44);

    // 8. Rolling CRT scanlines & phosphor grain overlay
    ctx.fillStyle = ctx.createPattern(getScan(), 'repeat');
    ctx.fillRect(0, 0, SIZE, SIZE);

    if (a.scan) {
      const scanY = wrap(t * 0.28) * (SIZE + 90) - 45;
      const sg = ctx.createLinearGradient(0, scanY - 40, 0, scanY + 40);
      sg.addColorStop(0, 'rgba(40, 240, 104, 0)');
      sg.addColorStop(0.5, rgba(c.phosphor, 0.14));
      sg.addColorStop(1, 'rgba(40, 240, 104, 0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, scanY - 40, SIZE, 80);
    }

    if (a.grain) {
      const ox = Math.floor(rnd(Math.floor(t * 20)) * 60);
      const oy = Math.floor(rnd(Math.floor(t * 20) + 99) * 60);
      ctx.save();
      ctx.translate(-ox, -oy);
      ctx.fillStyle = ctx.createPattern(getGrain(), 'repeat');
      ctx.fillRect(ox, oy, SIZE, SIZE);
      ctx.restore();
    }

    // 9. Dark optical tube vignette
    const vig = ctx.createRadialGradient(C, C, 175, C, C, 244);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.75, 'rgba(0, 6, 2, 0.45)');
    vig.addColorStop(1, 'rgba(0, 0, 0, 0.92)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, SIZE, SIZE);
  },
};
