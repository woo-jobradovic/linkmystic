// Twin Citadels: dark fantasy arena, a river splitting verdant and scorched halves, a two-sided clash gauge, carved runes and embers.
import { SIZE, C, ALARM, fitFont, reading, level, valueText, fanAvg, pad4, isRpm, rgba, mix, rnd, wrap, bigText, polygon } from './common.js';

const EMBERS = Array.from({ length: 26 }, (_, i) => ({
  seed: i + 1,
  x0: 40 + rnd(i * 3 + 1) * 400,
  size: 2 + rnd(i * 5 + 2) * 3.5,
  spd: 0.12 + rnd(i * 7 + 3) * 0.22,
  drift: (rnd(i * 11 + 4) - 0.5) * 55,
}));

// Generic geometric rune strokes in [-1..1] box
const RUNES = [
  [[-0.5, -0.8, 0.5, 0.8], [0, -0.9, 0, 0.9], [-0.5, -0.2, 0.5, -0.8]],
  [[-0.6, -0.7, 0, 0.8], [0, 0.8, 0.6, -0.7], [-0.4, 0, 0.4, 0]],
  [[0, -0.9, -0.6, 0], [-0.6, 0, 0, 0.9], [0, 0.9, 0.6, 0], [0, -0.5, 0, 0.5]],
  [[-0.5, -0.8, -0.5, 0.8], [0.5, -0.8, 0.5, 0.8], [-0.5, -0.1, 0.5, 0.2]],
];

let stoneCanvas = null;
function getStone() {
  if (stoneCanvas) return stoneCanvas;
  stoneCanvas = new OffscreenCanvas(SIZE, SIZE);
  const g = stoneCanvas.getContext('2d');
  // Radial stone blocks & weathered cracks
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = 2;
  for (let i = 0; i < 24; i++) {
    const a = (i * Math.PI * 2) / 24;
    g.beginPath();
    g.moveTo(C + Math.cos(a) * 150, C + Math.sin(a) * 150);
    g.lineTo(C + Math.cos(a + 0.04) * 238, C + Math.sin(a + 0.04) * 238);
    g.stroke();
  }
  return stoneCanvas;
}

export default {
  id: 'ancient',
  name: 'Twin Citadels',
  blurb: 'Weathered obsidian and bronze arena where verdant life clashes with molten magma.',
  colors: [
    ['number', 'Monument text', '#fff3dc'],
    ['verdant', 'Verdant energy', '#3ddc84'],
    ['scorched', 'Scorched magma', '#ff3d1f'],
    ['bronze', 'Bronze ornament', '#c89b52'],
    ['river', 'Mystic river', '#2ee6d6'],
    ['stone', 'Obsidian stone', '#1a1715'],
  ],
  animations: [
    ['embers', 'Rising embers & spores', true],
    ['clash', 'Clash spark pulse', true],
    ['runes', 'Shimmering runes', true],
  ],
  draw(ctx, state, lcd, t, { colors: c, animations: a }) {
    const r = reading(state, lcd), k = level(r);

    // 1. Split Battlefield Background (Top-Left Verdant vs Bottom-Right Scorched)
    // Shift the diagonal slightly based on heat k
    const shift = (k - 0.5) * 45;
    const bgGrad = ctx.createLinearGradient(60 - shift, 60 - shift, 420 - shift, 420 - shift);
    bgGrad.addColorStop(0, mix(c.stone, c.verdant, 0.28));
    bgGrad.addColorStop(0.46, '#0d1311');
    bgGrad.addColorStop(0.5, mix('#0a1414', c.river, 0.22));
    bgGrad.addColorStop(0.54, '#180d0b');
    bgGrad.addColorStop(1, mix(c.stone, c.scorched, 0.35));
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 2. Diagonal Mystic River Chasm (from bottom-left to top-right)
    ctx.save();
    ctx.strokeStyle = rgba(c.river, 0.28);
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(60, 420);
    ctx.bezierCurveTo(170, 290 - shift, 310, 190 - shift, 420, 60);
    ctx.stroke();
    ctx.strokeStyle = rgba(c.river, 0.65);
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // 3. Embers & Spores drifting across the arena
    for (const e of EMBERS) {
      const p = a.embers ? wrap(t * e.spd + e.seed * 0.17) : wrap(e.seed * 0.31);
      const x = e.x0 + Math.sin(p * Math.PI * 2 + e.seed) * e.drift;
      const y = 430 - p * 380;
      const isScorchedSide = x + y > SIZE - shift * 1.5;
      const col = isScorchedSide ? c.scorched : c.verdant;
      const alpha = Math.sin(p * Math.PI) * 0.8;
      ctx.fillStyle = rgba(col, alpha);
      ctx.beginPath();
      ctx.arc(x, y, e.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Outer Carved Stone Ring & Bronze Trim
    ctx.lineWidth = 38;
    ctx.strokeStyle = c.stone;
    ctx.beginPath();
    ctx.arc(C, C, 214, 0, Math.PI * 2);
    ctx.stroke();
    ctx.drawImage(getStone(), 0, 0);

    // Carved runes around the stone ring
    for (let i = 0; i < 12; i++) {
      const ang = (i * Math.PI * 2) / 12 - Math.PI / 2;
      const rx = C + Math.cos(ang) * 214;
      const ry = C + Math.sin(ang) * 214;
      const runeSideScorched = Math.cos(ang) + Math.sin(ang) > 0;
      const glowPulse = a.runes ? 0.45 + 0.45 * Math.sin(t * 2.4 + i) : 0.7;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(ang + Math.PI / 2);
      ctx.strokeStyle = rgba(runeSideScorched ? c.scorched : c.verdant, glowPulse);
      ctx.lineWidth = 2.2;
      const glyph = RUNES[i % RUNES.length];
      for (const [x1, y1, x2, y2] of glyph) {
        ctx.beginPath();
        ctx.moveTo(x1 * 9, y1 * 9);
        ctx.lineTo(x2 * 9, y2 * 9);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Bronze bevels
    ctx.strokeStyle = c.bronze;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(C, C, 195, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(C, C, 232, 0, Math.PI * 2);
    ctx.stroke();

    // 5. Two-Sided Conflict Gauge Arc (Verdant vs Scorched)
    // Total 280 deg arc from bottom-left (0.72 PI) clockwise to bottom-right (0.28 PI)
    const gStart = Math.PI * 0.72;
    const gSweep = Math.PI * 1.56;
    // As heat k rises (0..1), Scorched claims k of the arc from the right, Verdant holds (1-k) from the left
    const clashAngle = gStart + gSweep * (1 - k);

    // Groove under-track
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.arc(C, C, 176, gStart, gStart + gSweep);
    ctx.stroke();

    // Verdant arc (left side)
    if (1 - k > 0.01) {
      const vGrad = ctx.createLinearGradient(80, C, C, 80);
      vGrad.addColorStop(0, '#16794b');
      vGrad.addColorStop(1, c.verdant);
      ctx.strokeStyle = vGrad;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(C, C, 176, gStart, clashAngle);
      ctx.stroke();
    }

    // Scorched arc (right side, grows as temperature rises)
    if (k > 0.01) {
      const sGrad = ctx.createLinearGradient(C, 80, 400, C);
      sGrad.addColorStop(0, '#ff9e2c');
      sGrad.addColorStop(1, state.alarm ? ALARM : c.scorched);
      ctx.strokeStyle = sGrad;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(C, C, 176, clashAngle, gStart + gSweep);
      ctx.stroke();
    }

    // Bronze segment dividers over the conflict bar
    ctx.strokeStyle = '#120f0d';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 20; i++) {
      const aSeg = gStart + (gSweep * i) / 20;
      ctx.beginPath();
      ctx.moveTo(C + Math.cos(aSeg) * 168, C + Math.sin(aSeg) * 168);
      ctx.lineTo(C + Math.cos(aSeg) * 184, C + Math.sin(aSeg) * 184);
      ctx.stroke();
    }

    // Clash point gem where Verdant and Scorched meet
    const cx = C + Math.cos(clashAngle) * 176;
    const cy = C + Math.sin(clashAngle) * 176;
    const clashR = a.clash ? 13 + Math.sin(t * 9) * 3 : 13;
    const clashGlow = ctx.createRadialGradient(cx, cy, 2, cx, cy, clashR * 1.9);
    clashGlow.addColorStop(0, '#ffffff');
    clashGlow.addColorStop(0.45, mix(c.verdant, c.scorched, k));
    clashGlow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = clashGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, clashR * 1.9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff8eb';
    ctx.strokeStyle = c.bronze;
    ctx.lineWidth = 2.5;
    polygon(ctx, cx, cy, 9, 4, clashAngle);
    ctx.fill();
    ctx.stroke();

    // 6. Central Monumental Shield Boss & Filigree
    const centerGrad = ctx.createRadialGradient(C, C, 15, C, C, 148);
    centerGrad.addColorStop(0, '#27211d');
    centerGrad.addColorStop(1, '#0e0b0a');
    ctx.fillStyle = centerGrad;
    ctx.strokeStyle = c.bronze;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(C, C, 146, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Four cardinal bronze spikes
    for (let i = 0; i < 4; i++) {
      const aSpike = (i * Math.PI) / 2;
      ctx.save();
      ctx.translate(C + Math.cos(aSpike) * 146, C + Math.sin(aSpike) * 146);
      ctx.rotate(aSpike);
      ctx.fillStyle = c.bronze;
      ctx.beginPath();
      ctx.moveTo(-10, -8);
      ctx.lineTo(12, 0);
      ctx.lineTo(-10, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 7. Monumental Serif Readout
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 20px "Palatino Linotype"';
    ctx.fillStyle = c.bronze;
    ctx.fillText(`❖  ${r.label}  ❖`, C, 152);

    const txt = valueText(r);
    bigText(ctx, txt, isRpm(r) ? 112 : 142, '"Palatino Linotype"', 222, '700');
    ctx.fillStyle = '#050404';
    ctx.fillText(txt, C + 4, 274);
    ctx.strokeStyle = rgba(c.bronze, 0.55);
    ctx.lineWidth = 4;
    ctx.strokeText(txt, C, 270);
    ctx.fillStyle = state.alarm ? ALARM : c.number;
    ctx.fillText(txt, C, 270);

    ctx.font = '700 26px "Palatino Linotype"';
    ctx.fillStyle = mix(c.verdant, c.scorched, k);
    ctx.fillText(r.unit, C, 310);

    // 8. Carved Stone Tablet Footer
    ctx.fillStyle = '#120f0d';
    ctx.strokeStyle = c.bronze;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(C - 94, 336);
    ctx.lineTo(C + 94, 336);
    ctx.lineTo(C + 78, 372);
    ctx.lineTo(C - 78, 372);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const foot = state.alarm ? 'OVERHEAT' : `PUMP ${pad4(state.pumpRpm)}  ·  FAN ${pad4(fanAvg(state))}`;
    fitFont(ctx, foot, 146, 16, 'Georgia', '700');   // stays inside the tablet's slanted sides
    ctx.fillStyle = state.alarm ? ALARM : '#d5c19e';
    ctx.fillText(foot, C, 360);
  },
};
