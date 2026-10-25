// Storm Circle: bright cartoon sky, a swirling purple storm wall closing in with heat, lightning and shield/health bars.
import { SIZE, C, ALARM, reading, level, valueText, fanAvg, isRpm, rgba, mixHex, rnd, bigText, outlined } from './common.js';

function drawPuffyCloud(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const puffs = [[-34, 6, 20], [-14, -8, 26], [14, -4, 24], [34, 8, 18], [0, 10, 22]];

  // Cartoon dark outline
  ctx.fillStyle = 'rgba(18, 45, 82, 0.25)';
  ctx.beginPath();
  for (const [px, py, pr] of puffs) {
    ctx.moveTo(px + pr + 4, py + 5);
    ctx.arc(px, py + 5, pr + 4, 0, Math.PI * 2);
  }
  ctx.fill();

  // Bright white cloud puffs
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (const [px, py, pr] of puffs) {
    ctx.moveTo(px + pr, py);
    ctx.arc(px, py, pr, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}

export default {
  id: 'storm',
  name: 'Storm Circle',
  blurb: 'Swirling purple storm wall closing in on a bright sky with shield and health bars.',
  colors: [
    ['number', 'Number', '#fff640'],
    ['sky', 'Safe zone sky', '#29b6f6'],
    ['storm', 'Storm purple', '#9c27b0'],
    ['lightning', 'Storm lightning', '#ff5bff'],
    ['shield', 'Shield bar', '#00d4ff'],
    ['health', 'Health bar', '#39e64d'],
  ],
  animations: [
    ['swirl', 'Swirling storm clouds', true],
    ['lightning', 'Storm lightning bolts', true],
    ['bounce', 'Bouncy cartoon numbers', true],
  ],
  draw(ctx, state, lcd, t, { colors: c, animations: a }) {
    const r = reading(state, lcd), k = level(r);

    // 1. Bright cartoony safe-zone sky background
    const skyGrad = ctx.createRadialGradient(C, C - 30, 10, C, C, 240);
    skyGrad.addColorStop(0, mixHex(c.sky, '#ffffff', 0.45));
    skyGrad.addColorStop(0.65, c.sky);
    skyGrad.addColorStop(1, mixHex(c.sky, '#0a3d62', 0.35));
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Comic sunburst rays radiating from center
    ctx.save();
    ctx.translate(C, C - 10);
    if (a.swirl) ctx.rotate(t * 0.08);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
    for (let i = 0; i < 12; i++) {
      const ang = (i * Math.PI * 2) / 12;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 250, ang, ang + 0.13);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 2. Puffy cartoon clouds inside the safe zone
    const drift = a.swirl ? Math.sin(t * 0.9) * 14 : 0;
    drawPuffyCloud(ctx, 135 + drift, 108, 0.72);
    drawPuffyCloud(ctx, 350 - drift * 0.8, 124, 0.65);
    drawPuffyCloud(ctx, 110 - drift * 0.6, 260, 0.58);

    // 3. Shrinking Purple Storm Wall (safe radius shrinks from 212px down to 132px as k rises)
    const safeR = 212 - k * 80 + (a.swirl ? Math.sin(t * 3.2) * 3 : 0);

    // Outer storm fill using even-odd rule around scalloped inner storm wall
    const stormGrad = ctx.createRadialGradient(C, C, safeR - 10, C, C, 248);
    stormGrad.addColorStop(0, rgba(c.storm, 0.55));
    stormGrad.addColorStop(0.35, rgba(c.storm, 0.88));
    stormGrad.addColorStop(1, mixHex(c.storm, '#120024', 0.72));

    ctx.fillStyle = stormGrad;
    ctx.beginPath();
    ctx.rect(0, 0, SIZE, SIZE);
    const lobes = 28;
    for (let i = 0; i <= 120; i++) {
      const ang = (i / 120) * Math.PI * 2;
      const wave = Math.sin(ang * lobes - (a.swirl ? t * 3.5 : 0)) * 6
                 + Math.cos(ang * 9 + (a.swirl ? t * 2.1 : 0)) * 4;
      const rad = safeR + wave;
      const px = C + Math.cos(ang) * rad;
      const py = C + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill('evenodd');

    // Swirling dark storm puffs around the outer rim
    for (let i = 0; i < 18; i++) {
      const baseAng = (i / 18) * Math.PI * 2 + (a.swirl ? t * (i % 2 ? 0.35 : -0.25) : 0);
      const dist = safeR + 28 + (i % 3) * 18;
      const px = C + Math.cos(baseAng) * dist;
      const py = C + Math.sin(baseAng) * dist;
      ctx.fillStyle = rgba( i % 2 ? c.storm : '#2a053d', 0.45);
      ctx.beginPath();
      ctx.arc(px, py, 26 + (i % 4) * 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Electric glowing safe-zone boundary ring
    ctx.strokeStyle = state.alarm ? ALARM : c.lightning;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const ang = (i / 120) * Math.PI * 2;
      const wave = Math.sin(ang * lobes - (a.swirl ? t * 3.5 : 0)) * 6
                 + Math.cos(ang * 9 + (a.swirl ? t * 2.1 : 0)) * 4;
      const rad = safeR + wave;
      const px = C + Math.cos(ang) * rad;
      const py = C + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();

    // Inner dashed white target safe-circle
    ctx.save();
    ctx.setLineDash([8, 8]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(C, C, 128, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 4. Crackling storm lightning bolts in the purple storm zone
    if (a.lightning) {
      const tick = Math.floor(t * 11);
      for (let b = 0; b < 3; b++) {
        if (rnd(tick * 17 + b * 31) < 0.45) continue;
        const ang = rnd(tick * 23 + b * 7) * Math.PI * 2;
        const rx = C + Math.cos(ang) * 236;
        const ry = C + Math.sin(ang) * 236;
        const tx = C + Math.cos(ang) * safeR;
        const ty = C + Math.sin(ang) * safeR;

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        for (let s = 1; s <= 4; s++) {
          const p = s / 4;
          const jx = (rnd(tick * 5 + s * 13 + b) - 0.5) * 26;
          const jy = (rnd(tick * 9 + s * 19 + b) - 0.5) * 26;
          ctx.lineTo(rx + (tx - rx) * p + jx, ry + (ty - ry) * p + jy);
        }
        ctx.stroke();

        ctx.strokeStyle = c.lightning;
        ctx.lineWidth = 6;
        ctx.globalAlpha = 0.45;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // 5. Playful slanted cartoon badge for the metric label
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.save();
    ctx.translate(C, 112);
    ctx.rotate(-0.04);
    ctx.fillStyle = '#101828';
    ctx.beginPath();
    ctx.roundRect(-84, -24, 168, 34, 10);
    ctx.fill();
    ctx.fillStyle = c.storm;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-88, -28, 168, 34, 10);
    ctx.fill();
    ctx.stroke();

    ctx.font = '900 20px "Segoe UI Black"';
    outlined(ctx, r.label, -4, -4, '#ffffff', '#101828', 5);
    ctx.restore();

    // 6. Bouncy, chunky outlined cartoon number
    const valStr = valueText(r);
    const bounceScale = a.bounce ? 1 + Math.sin(t * 5.2) * 0.035 : 1;
    const bounceRot = a.bounce ? Math.sin(t * 2.6) * 0.035 : -0.03;

    ctx.save();
    ctx.translate(C, 212);
    ctx.rotate(bounceRot);
    ctx.scale(bounceScale, bounceScale);

    bigText(ctx, valStr, isRpm(r) ? 108 : 138, '"Segoe UI Black"', 222, '900');

    // Deep cartoon drop-shadow
    ctx.fillStyle = '#0d1526';
    ctx.fillText(valStr, 6, 44);
    // Thick dark outline + bright yellow/white cartoon fill
    const numFill = state.alarm ? ALARM : c.number;
    outlined(ctx, valStr, 0, 36, numFill, '#0d1526', 15);

    // Unit badge tucked to the bottom-right of the number
    ctx.font = '900 28px "Segoe UI Black"';
    outlined(ctx, r.unit, 0, 72, '#ffffff', '#0d1526', 8);
    ctx.restore();

    // 7. Stacked slanted Shield (blue) & Health (green) bars
    const drawSlantedBar = (y, fillPct, col, iconType, textVal) => {
      const bw = 204, bh = 22, bx = C - bw / 2 + 12;
      ctx.save();
      ctx.transform(1, 0, -0.22, 1, 0, 0);

      // Bar frame
      ctx.fillStyle = 'rgba(13, 21, 38, 0.85)';
      ctx.strokeStyle = '#0d1526';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(bx, y, bw, bh, 5);
      ctx.fill();
      ctx.stroke();

      // 5 Segmented cells
      const cells = 5, gap = 4;
      const cellW = (bw - gap * (cells + 1)) / cells;
      for (let i = 0; i < cells; i++) {
        const cellFill = Math.max(0, Math.min(1, (fillPct - i / cells) * cells));
        const cx = bx + gap + i * (cellW + gap);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(cx, y + 4, cellW, bh - 8);
        if (cellFill > 0) {
          ctx.fillStyle = state.alarm ? ALARM : col;
          ctx.fillRect(cx, y + 4, cellW * cellFill, bh - 8);
          ctx.fillStyle = 'rgba(255,255,255,0.38)';
          ctx.fillRect(cx, y + 4, cellW * cellFill, 4);
        }
      }
      ctx.restore();

      // Left icon badge (Shield crest or Plus cross)
      const ix = C - bw / 2 - 14, iy = y + bh / 2;
      ctx.fillStyle = '#0d1526';
      ctx.beginPath();
      ctx.arc(ix, iy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = col;
      if (iconType === 'shield') {
        ctx.beginPath();
        ctx.moveTo(ix, iy - 9);
        ctx.lineTo(ix + 8, iy - 5);
        ctx.lineTo(ix + 6, iy + 4);
        ctx.lineTo(ix, iy + 9);
        ctx.lineTo(ix - 6, iy + 4);
        ctx.lineTo(ix - 8, iy - 5);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(ix - 3, iy - 8, 6, 16);
        ctx.fillRect(ix - 8, iy - 3, 16, 6);
      }

      // Numeric bar readout on right
      ctx.font = '900 16px "Segoe UI Black"';
      ctx.textAlign = 'right';
      outlined(ctx, String(textVal), C + bw / 2 + 4, y + 17, '#ffffff', '#0d1526', 4);
      ctx.textAlign = 'center';
    };

    const shieldPct = k;
    const healthPct = state.pumpRpm ? Math.min(1, state.pumpRpm / 3200) : Math.max(0.15, 1 - k * 0.5);
    drawSlantedBar(314, shieldPct, c.shield, 'shield', Math.round(shieldPct * 100));
    drawSlantedBar(344, healthPct, c.health, 'health', state.pumpRpm ?? Math.round(healthPct * 100));

    // 8. Bottom storm phase status pill
    ctx.font = '900 15px "Segoe UI Black"';
    const foot = state.alarm
      ? 'OVERHEAT WARNING!'
      : `STORM ${Math.round(k * 100)}%  •  FANS ${fanAvg(state) ?? '--'}`;
    outlined(ctx, foot, C, 396, '#ffffff', '#0d1526', 5);
  },
};
