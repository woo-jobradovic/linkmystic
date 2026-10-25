// Neon Horizon: synthwave sunset, palms and skyline, a scrolling neon grid, side neon gauges and a 5-star heat rating.
import { SIZE, C, ALARM, reading, level, valueText, fanAvg, isRpm, rgba, mix, mixHex, rnd, wrap, bigText, outlined, star } from './common.js';

function drawPalm(ctx, baseX, baseY, dir, scale, sway) {
  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.scale(scale, scale);

  const topX = dir * 34 + sway * 10;
  const topY = -126;

  // Curved trunk
  ctx.fillStyle = '#090214';
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.quadraticCurveTo(dir * 10, -60, topX - 3, topY);
  ctx.lineTo(topX + 3, topY);
  ctx.quadraticCurveTo(dir * 22, -60, 9, 0);
  ctx.closePath();
  ctx.fill();

  // Fronds radiating from crown
  const angles = [-2.65, -2.15, -1.6, -1.0, -0.45, 0.05, 0.5];
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i] + sway * 0.07;
    const len = 54 + (i % 2) * 14;
    const ex = topX + Math.cos(a) * len * dir;
    const ey = topY + Math.sin(a) * len + 20;
    const cx = topX + Math.cos(a) * len * 0.55 * dir;
    const cy = topY + Math.sin(a) * len * 0.55 - 14;

    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.quadraticCurveTo(cx, cy + 13, topX, topY + 4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export default {
  id: 'sunset',
  name: 'Neon Horizon',
  blurb: 'Synthwave sunset, palm silhouettes, neon grid and a 5-star heat level.',
  colors: [
    ['number', 'Number', '#ffffff'],
    ['neonPink', 'Neon pink', '#ff2a85'],
    ['neonCyan', 'Neon cyan', '#00f0ff'],
    ['sunTop', 'Sun gold', '#ffdd40'],
    ['sunBot', 'Sun magenta', '#ff1e6b'],
    ['stars', 'Heat stars', '#ffcc00'],
  ],
  animations: [
    ['grid', 'Scrolling neon highway', true],
    ['police', '5-star heat flash', true],
    ['sway', 'Palm breeze & sun pulse', true],
  ],
  draw(ctx, state, lcd, t, { colors: c, animations: a }) {
    const r = reading(state, lcd), k = level(r);
    const horizonY = 266;

    // 1. Dusk synthwave sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0, '#100326');
    sky.addColorStop(0.45, '#3b0a57');
    sky.addColorStop(0.82, c.neonPink);
    sky.addColorStop(1, c.sunTop);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, SIZE, horizonY);

    // Twinkling retro stars in upper sky
    for (let i = 0; i < 20; i++) {
      const sx = 40 + rnd(i * 13 + 1) * 400;
      const sy = 18 + rnd(i * 29 + 7) * 115;
      const tw = a.sway ? 0.35 + 0.65 * Math.sin(t * 3 + i * 2) : 0.7;
      ctx.fillStyle = `rgba(255,255,255,${tw * 0.7})`;
      ctx.fillRect(sx, sy, 2, 2);
    }

    // 2. Sliced retro synthwave sun
    const sunY = 176;
    const sunR = 98 + (a.sway ? Math.sin(t * 2) * 2 : 0);
    ctx.save();
    ctx.beginPath();
    ctx.arc(C, sunY, sunR, 0, Math.PI * 2);
    ctx.clip();

    const sunGrad = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sunGrad.addColorStop(0, c.sunTop);
    sunGrad.addColorStop(0.55, '#ff6b3d');
    sunGrad.addColorStop(1, c.sunBot);

    // Draw horizontal sun slices with widening gaps toward bottom
    for (let y = sunY - sunR; y < sunY + sunR; y += 2) {
      const rel = (y - (sunY - sunR)) / (sunR * 2);
      if (rel > 0.42) {
        const band = ((y + (a.sway ? t * 8 : 0)) % 14 + 14) % 14;
        const cut = (rel - 0.42) * 16;
        if (band < cut) continue;
      }
      ctx.fillStyle = sunGrad;
      ctx.fillRect(C - sunR, y, sunR * 2, 2.4);
    }
    ctx.restore();

    // 3. Distant city skyline & palm silhouettes along the horizon
    ctx.fillStyle = '#090214';
    for (let i = 0; i < 26; i++) {
      const bx = 35 + i * 16;
      const bh = 8 + Math.floor(rnd(i * 41 + 9) * 32 * Math.sin((i / 25) * Math.PI));
      ctx.fillRect(bx, horizonY - bh, 14, bh + 2);
    }
    const sway = a.sway ? Math.sin(t * 1.8) : 0;
    drawPalm(ctx, 56, horizonY + 4, 1, 1.05, sway);
    drawPalm(ctx, 424, horizonY + 4, -1, 1.05, -sway);
    drawPalm(ctx, 102, horizonY + 6, 1, 0.65, sway * 0.8);
    drawPalm(ctx, 378, horizonY + 6, -1, 0.65, -sway * 0.8);

    // 4. Perspective neon grid floor
    const floorGrad = ctx.createLinearGradient(0, horizonY, 0, SIZE);
    floorGrad.addColorStop(0, '#1e0538');
    floorGrad.addColorStop(1, '#05010d');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, horizonY, SIZE, SIZE - horizonY);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizonY, SIZE, SIZE - horizonY);
    ctx.clip();

    // Radial perspective lines from vanishing point
    ctx.strokeStyle = rgba(c.neonPink, 0.55);
    ctx.lineWidth = 2;
    for (let i = -10; i <= 10; i++) {
      ctx.beginPath();
      ctx.moveTo(C + i * 12, horizonY);
      ctx.lineTo(C + i * 115, SIZE);
      ctx.stroke();
    }

    // Scrolling horizontal perspective bars
    const phase = a.grid ? wrap(t * 0.65) : 0;
    for (let i = 0; i < 10; i++) {
      const p = (i + phase) / 10;
      const y = horizonY + Math.pow(p, 2.2) * (SIZE - horizonY);
      ctx.strokeStyle = rgba(c.neonCyan, 0.18 + p * 0.65);
      ctx.lineWidth = 1 + p * 2.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SIZE, y);
      ctx.stroke();
    }
    ctx.restore();

    // Glowing horizon divider bar
    ctx.fillStyle = c.neonCyan;
    ctx.fillRect(0, horizonY - 2, SIZE, 4);

    // 5. Police siren corner glow when at 5-star heat or alarm
    if (a.police && (k >= 0.85 || state.alarm)) {
      const siren = Math.sin(t * 14);
      const col = siren > 0 ? '#ff1744' : '#00b0ff';
      const g = ctx.createRadialGradient(C, C, 150, C, C, 245);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, rgba(col, 0.36));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, SIZE, SIZE);
    }

    // 6. Outer neon tube gauge arcs (left and right chrome-neon rails)
    ctx.lineCap = 'round';
    const arcSpan = Math.PI * 0.68;
    const drawSideArc = (centerAng, rev) => {
      const a0 = centerAng - arcSpan / 2;
      const a1 = centerAng + arcSpan / 2;
      ctx.strokeStyle = 'rgba(10, 4, 20, 0.75)';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(C, C, 214, a0, a1);
      ctx.stroke();

      const segs = 22, lit = Math.round(k * segs);
      for (let i = 0; i < segs; i++) {
        const idx = rev ? segs - 1 - i : i;
        const s0 = a0 + (idx / segs) * arcSpan + 0.01;
        const s1 = a0 + ((idx + 1) / segs) * arcSpan - 0.01;
        ctx.strokeStyle = i < lit ? mix(c.neonCyan, c.neonPink, i / (segs - 1)) : 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(C, C, 214, s0, s1);
        ctx.stroke();
      }
    };
    drawSideArc(Math.PI, false);
    drawSideArc(0, true);

    // 7. 5-Star "Heat" Wanted Rating along top arc
    const starCount = 5;
    const activeStars = Math.ceil(k * 5 - 0.001);
    const blinkHigh = a.police && (k >= 0.85 || state.alarm) && Math.floor(t * 7) % 2 === 0;

    for (let i = 0; i < starCount; i++) {
      const ang = -Math.PI / 2 + (i - 2) * 0.21;
      const sx = C + Math.cos(ang) * 184;
      const sy = C + Math.sin(ang) * 184;
      const isLit = i < activeStars || state.alarm;

      star(ctx, sx + 3, sy + 3, 18, 5, 0.45);
      ctx.fillStyle = '#06010d';
      ctx.fill();

      star(ctx, sx, sy, 18, 5, 0.45);
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#06010d';
      ctx.stroke();
      ctx.fillStyle = isLit
        ? (state.alarm ? ALARM : blinkHigh ? '#ffffff' : c.stars)
        : 'rgba(20, 10, 35, 0.75)';
      ctx.fill();
    }

    // 8. Slanted arcade readout with thick black outline
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // Slanted label pill
    ctx.save();
    ctx.translate(C, 128);
    ctx.transform(1, 0, -0.18, 1, 0, 0);
    ctx.fillStyle = '#070210';
    ctx.strokeStyle = c.neonCyan;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-86, -26, 172, 34, 6);
    ctx.fill();
    ctx.stroke();
    ctx.font = '700 23px Impact';
    outlined(ctx, r.label, 0, -1, c.neonPink, '#000000', 4);
    ctx.restore();

    // Big slanted value number
    const valStr = valueText(r);
    ctx.save();
    ctx.translate(C, 276);   // low enough to clear the label pill
    ctx.transform(1, 0, -0.15, 1, 0, 0);
    bigText(ctx, valStr, isRpm(r) ? 116 : 144, 'Impact', 230, '700');

    // Extruded neon shadow
    ctx.fillStyle = state.alarm ? '#4a0012' : c.neonPink;
    ctx.fillText(valStr, 7, 7);

    // Main glyph with heavy black outline
    const numGrad = ctx.createLinearGradient(0, -120, 0, 10);
    if (state.alarm) {
      numGrad.addColorStop(0, '#ff809b');
      numGrad.addColorStop(1, ALARM);
    } else {
      numGrad.addColorStop(0, c.number);
      numGrad.addColorStop(0.6, c.number);
      numGrad.addColorStop(1, mixHex(c.neonCyan, '#ffffff', 0.4));
    }
    outlined(ctx, valStr, 0, 0, numGrad, '#05010a', 14);
    ctx.restore();

    // Slanted unit & bottom dashboard street plate
    ctx.save();
    ctx.translate(C, 322);
    ctx.transform(1, 0, -0.16, 1, 0, 0);
    ctx.font = '700 32px Impact';
    outlined(ctx, r.unit, 0, 0, c.sunTop, '#05010a', 8);
    ctx.restore();

    // Bottom retro dashboard stereo / telemetry bar
    ctx.save();
    ctx.translate(C, 376);
    ctx.transform(1, 0, -0.14, 1, 0, 0);
    ctx.fillStyle = 'rgba(6, 2, 16, 0.86)';
    ctx.strokeStyle = c.neonPink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-124, -24, 248, 38, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fontStretch = 'condensed';
    ctx.font = '700 21px Bahnschrift';
    ctx.fillStyle = state.alarm ? ALARM : c.neonCyan;
    const statusText = state.alarm
      ? 'HEAT LEVEL CRITICAL'
      : `PUMP ${state.pumpRpm ?? '--'}  //  FANS ${fanAvg(state) ?? '--'}`;
    ctx.fillText(statusText, 0, 2);
    ctx.restore();
  },
};
