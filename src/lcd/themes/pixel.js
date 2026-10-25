// Pixel Blocks: banded voxel sky, blocky clouds and terrain, our own 5x7 pixel font, pixel hearts and an XP bar.
import { SIZE, C, ALARM, reading, level, valueText, fanAvg, mix, mixHex, rnd, wrap } from './common.js';

// Original 5x7 pixel font grid (each row is a 5-bit integer, MSB on left)
const GLYPHS = {
  '0': [14, 17, 19, 21, 25, 17, 14],
  '1': [4, 12, 4, 4, 4, 4, 14],
  '2': [14, 17, 1, 6, 8, 16, 31],
  '3': [30, 1, 1, 14, 1, 1, 30],
  '4': [2, 6, 10, 18, 31, 2, 2],
  '5': [31, 16, 30, 1, 1, 17, 14],
  '6': [14, 16, 30, 17, 17, 17, 14],
  '7': [31, 1, 2, 4, 8, 8, 8],
  '8': [14, 17, 17, 14, 17, 17, 14],
  '9': [14, 17, 17, 15, 1, 1, 14],
  '-': [0, 0, 0, 31, 0, 0, 0],
  ':': [0, 4, 4, 0, 4, 4, 0],
  '°': [12, 18, 18, 12, 0, 0, 0],
  'A': [14, 17, 17, 31, 17, 17, 17],
  'C': [14, 17, 16, 16, 16, 17, 14],
  'E': [31, 16, 16, 30, 16, 16, 31],
  'F': [31, 16, 16, 30, 16, 16, 16],
  'H': [17, 17, 17, 31, 17, 17, 17],
  'I': [14, 4, 4, 4, 4, 4, 14],
  'L': [16, 16, 16, 16, 16, 16, 31],
  'M': [17, 27, 21, 21, 17, 17, 17],
  'N': [17, 25, 21, 19, 17, 17, 17],
  'O': [14, 17, 17, 17, 17, 17, 14],
  'P': [30, 17, 17, 30, 16, 16, 16],
  'R': [30, 17, 17, 30, 20, 18, 17],
  'S': [15, 16, 16, 14, 1, 1, 30],
  'T': [31, 4, 4, 4, 4, 4, 4],
  'U': [17, 17, 17, 17, 17, 17, 14],
  'V': [17, 17, 17, 17, 17, 10, 4],
  '!': [4, 4, 4, 4, 4, 0, 4],
  ' ': [0, 0, 0, 0, 0, 0, 0],
};

function drawPixText(ctx, str, cx, y, scale, fill, shadow, bevel) {
  const s = String(str).toUpperCase();
  const charStep = 6 * scale;
  const totalW = s.length * charStep - scale;
  const startX = Math.round(cx - totalW / 2);
  const startY = Math.round(y);

  const renderPass = (ox, oy, color, maxRow = 7) => {
    ctx.fillStyle = color;
    for (let c = 0; c < s.length; c++) {
      const g = GLYPHS[s[c]] || GLYPHS[' '];
      const bx = startX + c * charStep + ox;
      for (let r = 0; r < maxRow; r++) {
        const rowBits = g[r];
        if (!rowBits) continue;
        for (let col = 0; col < 5; col++) {
          if ((rowBits >> (4 - col)) & 1) {
            ctx.fillRect(bx + col * scale, startY + r * scale + oy, scale, scale);
          }
        }
      }
    }
  };

  if (shadow) renderPass(scale, scale, shadow);
  renderPass(0, 0, fill);
  if (bevel) renderPass(0, 0, bevel, 2);
}

// 9x8 pixel heart template: 1 = border, 2 = inside, 3 = highlight
const HEART = [
  '011000110',
  '133101221',
  '132212221',
  '122222221',
  '012222210',
  '001222100',
  '000121000',
  '000010000',
];

function drawHeart(ctx, x, y, scale, fill, stateMode, hiColor) {
  for (let r = 0; r < 8; r++) {
    const row = HEART[r];
    for (let c = 0; c < 9; c++) {
      const v = row[c];
      if (v === '0') continue;
      if (v === '1') {
        ctx.fillStyle = '#140c14';
      } else if (v === '3') {
        ctx.fillStyle = stateMode > 0 ? '#ffd8e0' : '#42353d';
      } else {
        const active = stateMode === 2 || (stateMode === 1 && c < 4);
        ctx.fillStyle = active ? fill : '#261d23';
      }
      ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      if (v === '1' && hiColor) {
        ctx.fillStyle = hiColor;
        ctx.fillRect(x + c * scale, y + r * scale, scale, scale);
      }
    }
  }
}

let terrainCache = null;
let cacheKey = '';

function getTerrain(cGrass, cDirt, cXP) {
  const key = `${cGrass}|${cDirt}|${cXP}`;
  if (terrainCache && cacheKey === key) return terrainCache;
  cacheKey = key;
  const oc = new OffscreenCanvas(SIZE, 200);
  const g = oc.getContext('2d');
  const B = 40, P = 5; // 40px block = 8x8 grid of 5px texels

  const grassHi = mixHex(cGrass, '#ffffff', 0.24);
  const grassLo = mixHex(cGrass, '#000000', 0.25);
  const dirtHi = mixHex(cDirt, '#ffffff', 0.16);
  const dirtLo = mixHex(cDirt, '#000000', 0.24);

  for (let col = 0; col < 12; col++) {
    const dip = col === 0 || col === 11 ? 0 : (col === 1 || col === 10 ? 1 : 2);
    for (let row = 0; row < 5; row++) {
      if (row < dip) continue;
      const isTop = row === dip;
      const isDirt = row <= dip + 1;
      const bx = col * B, by = row * B;

      for (let py = 0; py < 8; py++) {
        for (let px = 0; px < 8; px++) {
          const seed = col * 313 + row * 97 + py * 13 + px * 7;
          const n = rnd(seed);
          let colHex;
          const grassLen = 2 + Math.floor(rnd(col * 19 + px * 3) * 3);
          if (isTop && py < grassLen) {
            colHex = n < 0.28 ? grassLo : n > 0.74 ? grassHi : cGrass;
          } else if (isDirt) {
            colHex = n < 0.25 ? dirtLo : n > 0.8 ? dirtHi : n > 0.72 ? '#6e6e75' : cDirt;
          } else {
            colHex = n < 0.28 ? '#42444a' : n > 0.76 ? '#747880' : '#585b63';
            // Embedded glowing ore clusters in deep stone
            if (px > 0 && px < 7 && py > 0 && py < 7 && rnd(seed + 501) > 0.87) {
              colHex = cXP;
            }
          }
          g.fillStyle = colHex;
          g.fillRect(bx + px * P, by + py * P, P, P);
        }
      }
      // Subtle pixel block border
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(bx, by + B - 2, B, 2);
      g.fillRect(bx + B - 2, by, 2, B);
      if (isTop) {
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.fillRect(bx, by, B, 3);
      }
    }
  }
  terrainCache = oc;
  return oc;
}

export default {
  id: 'pixel',
  name: 'Pixel Blocks',
  blurb: 'Blocky voxel world with pixel hearts, an XP gauge bar and custom pixel type.',
  colors: [
    ['number', 'Number', '#ffffff'],
    ['sky', 'Sky blue', '#5898ff'],
    ['grass', 'Grass block', '#5ab535'],
    ['dirt', 'Dirt block', '#865b3c'],
    ['hearts', 'Heart fill', '#ff2942'],
    ['xp', 'XP & ore glow', '#80ff20'],
  ],
  animations: [
    ['clouds', 'Drifting blocky clouds', true],
    ['bounce', 'Heart shake & XP shimmer', true],
    ['particles', 'Floating voxel motes', true],
  ],
  draw(ctx, state, lcd, t, { colors: c, animations: a }) {
    const r = reading(state, lcd), k = level(r);

    // 1. Banded voxel sky (quantized horizontal color bands)
    const skyTop = mixHex(c.sky, '#0e1d47', 0.48);
    const skyBot = mixHex(c.sky, '#ffffff', 0.42);
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = mix(skyTop, skyBot, i / 15);
      ctx.fillRect(0, i * 24, SIZE, 25);
    }

    // 2. Blocky layered sun
    const sx = 342, sy = 62;
    ctx.fillStyle = 'rgba(255, 240, 128, 0.22)';
    ctx.fillRect(sx - 12, sy - 12, 68, 68);
    ctx.fillStyle = '#ffde59';
    ctx.fillRect(sx, sy, 44, 44);
    ctx.fillStyle = '#fff9b3';
    ctx.fillRect(sx + 8, sy + 8, 28, 28);

    // 3. Stepped 3D blocky clouds
    const clouds = [
      { y: 58, speed: 12, w: 108, h: 20, offset: 0.1 },
      { y: 100, speed: 18, w: 144, h: 24, offset: 0.55 },
      { y: 146, speed: 9, w: 96, h: 18, offset: 0.82 },
    ];
    for (let i = 0; i < clouds.length; i++) {
      const cl = clouds[i];
      const prog = a.clouds ? wrap(cl.offset + (t * cl.speed) / 640) : cl.offset;
      const cx = Math.round((prog * 640 - 160) / 4) * 4;
      const cy = cl.y;
      // Cloud bottom shadow
      ctx.fillStyle = 'rgba(180, 205, 235, 0.85)';
      ctx.fillRect(cx, cy + cl.h, cl.w, 6);
      ctx.fillRect(cx + 16, cy - 10 + cl.h, cl.w - 32, 6);
      // Cloud main body
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx, cy, cl.w, cl.h);
      ctx.fillRect(cx + 16, cy - 12, cl.w - 32, 12);
    }

    // 4. Cached voxel terrain cross-section
    ctx.drawImage(getTerrain(c.grass, c.dirt, c.xp), 0, 280);

    // 5. Floating square voxel spores/sparkles
    if (a.particles) {
      for (let i = 0; i < 16; i++) {
        const p = wrap(rnd(i * 17 + 3) + t * (0.08 + rnd(i * 5) * 0.08));
        const px = Math.round((70 + rnd(i * 31) * 340 + Math.sin(t * 2 + i) * 10) / 4) * 4;
        const py = Math.round((390 - p * 230) / 4) * 4;
        const sz = rnd(i * 9) > 0.5 ? 6 : 4;
        ctx.fillStyle = i % 3 === 0 ? c.xp : '#ffffff';
        ctx.globalAlpha = Math.sin(p * Math.PI) * 0.85;
        ctx.fillRect(px, py, sz, sz);
      }
      ctx.globalAlpha = 1;
    }

    // 6. Dark stone HUD plaque with pixel bevel border behind readout
    const px = 92, py = 128, pw = 296, ph = 188;
    ctx.fillStyle = 'rgba(16, 18, 24, 0.78)';
    ctx.fillRect(px + 6, py, pw - 12, ph);
    ctx.fillRect(px, py + 6, pw, ph - 12);
    // Pixelated light/dark bevels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fillRect(px + 6, py, pw - 12, 4);
    ctx.fillRect(px, py + 6, 4, ph - 12);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(px + 6, py + ph - 4, pw - 12, 4);
    ctx.fillRect(px + pw - 4, py + 6, 4, ph - 12);

    // 7. Top label banner
    // dark plate behind the label, so it stays readable when a white cloud drifts behind it
    const lw = r.label.length * 24 + 12;
    ctx.fillStyle = 'rgba(16, 18, 24, 0.72)';
    ctx.fillRect(Math.round(C - lw / 2), 84, lw, 40);
    drawPixText(ctx, r.label, C, 92, 4, '#fff799', '#242014');

    // 8. Big custom pixel number + unit
    const valStr = valueText(r);
    const numScale = valStr.length >= 4 ? 10 : valStr.length === 3 ? 13 : 17;
    const numH = 7 * numScale;
    const numY = Math.round(212 - numH / 2);
    const numCol = state.alarm ? ALARM : c.number;
    const numHi = state.alarm ? '#ff99aa' : mixHex(c.number, '#ffffff', 0.35);
    drawPixText(ctx, valStr, C, numY, numScale, numCol, '#14161f', numHi);

    // Unit badge
    drawPixText(ctx, r.unit, C, 286, 3, c.xp, '#122409');

    // 9. 10 Pixel hearts gauge (20 half-steps)
    const halfSteps = Math.round(k * 20);
    const hScale = 3; // 9*3 = 27px wide, 8*3 = 24px tall
    const hStep = 30;
    const hStartX = C - (10 * hStep - 3) / 2;
    const flash = state.alarm && a.bounce && Math.floor(t * 8) % 2 === 0 ? '#ffffff' : null;

    for (let i = 0; i < 10; i++) {
      const hState = halfSteps >= (i + 1) * 2 ? 2 : halfSteps === i * 2 + 1 ? 1 : 0;
      let jitterY = 0;
      if (a.bounce) {
        if (k > 0.78 || state.alarm) {
          jitterY = (Math.floor(t * 15 + i * 7) % 3 - 1) * 2;
        } else if (Math.floor(t * 4) % 14 === i) {
          jitterY = -3;
        }
      }
      drawHeart(ctx, hStartX + i * hStep, 326 + jitterY, hScale, state.alarm ? ALARM : c.hearts, hState, flash);
    }

    // 10. 18-segment XP bar gauge
    const barW = 288, barH = 16, barX = C - barW / 2, barY = 368;
    ctx.fillStyle = '#0c120c';
    ctx.fillRect(barX - 3, barY - 3, barW + 6, barH + 6);
    ctx.fillStyle = '#334233';
    ctx.fillRect(barX, barY, barW, barH);

    const segs = 18, segW = barW / segs;
    const litSegs = Math.round(k * segs);
    const shimmerIdx = a.bounce ? Math.floor(t * 12) % (segs + 4) : -1;

    for (let i = 0; i < segs; i++) {
      const sx = barX + i * segW;
      if (i < litSegs) {
        const isShimmer = i === shimmerIdx || i === shimmerIdx - 1;
        ctx.fillStyle = state.alarm ? ALARM : isShimmer ? '#dfff9e' : c.xp;
        ctx.fillRect(sx + 1, barY + 2, segW - 2, barH - 4);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(sx + 1, barY + 2, segW - 2, 3);
      } else {
        ctx.fillStyle = '#182118';
        ctx.fillRect(sx + 1, barY + 2, segW - 2, barH - 4);
      }
    }

    // 11. Bottom telemetry sub-readout
    const subText = state.alarm ? 'OVERHEAT!' : `P:${ state.pumpRpm ?? '--' } F:${ fanAvg(state) ?? '--' }`;
    drawPixText(ctx, subText, C, 404, 2, state.alarm ? ALARM : '#d0dce8', '#10141c');
  },
};
