// Astral Artifice: navy and gold astrolabe rings around a crystal core, an 18-gem gauge and drifting sparkles.
import { SIZE, C, ALARM, fitFont, START, SWEEP, reading, level, valueText, fanAvg, pad4, isRpm, rgba, mix, rnd, wrap, bigText, polygon, mixHex } from './common.js';

const MOTES = Array.from({ length: 18 }, (_, i) => ({
  seed: i + 1,
  angle: rnd(i * 5 + 1) * Math.PI * 2,
  rad: 35 + rnd(i * 11 + 2) * 125,
  spd: 0.1 + rnd(i * 7 + 3) * 0.18,
  sz: 2.5 + rnd(i * 13 + 4) * 3.5,
}));

export default {
  id: 'runeward',
  name: 'Astral Artifice',
  blurb: 'Midnight navy and polished gold filigree powered by a cyan crystal core.',
  colors: [
    ['number', 'Display numeral', '#f4ebd9'],
    ['gold', 'Gold filigree', '#c89b3c'],
    ['goldHi', 'Polished brass', '#f0e6d2'],
    ['cyan', 'Crystal energy', '#0ac8b9'],
    ['surge', 'Overcharge violet', '#a855f7'],
    ['navy', 'Midnight housing', '#091428'],
  ],
  animations: [
    ['gears', 'Astrolabe rotation', true],
    ['motes', 'Sparkles', true],
    ['pulse', 'Crystal resonance', true],
  ],
  draw(ctx, state, lcd, t, { colors: c, animations: a }) {
    const r = reading(state, lcd), k = level(r);
    const energyCol = state.alarm ? ALARM : mixHex(c.cyan, c.surge, Math.max(0, (k - 0.55) / 0.45));

    // 1. Deep Midnight Navy & Radial Mana Glow
    const bg = ctx.createRadialGradient(C, C, 10, C, C, 245);
    bg.addColorStop(0, mix(c.navy, energyCol, 0.25 + k * 0.15));
    bg.addColorStop(0.65, c.navy);
    bg.addColorStop(1, '#030710');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 2. Subtle Crystalline Hex Lattice in Center
    ctx.strokeStyle = rgba(c.cyan, 0.08);
    ctx.lineWidth = 1;
    for (const rad of [65, 105, 145]) {
      polygon(ctx, C, C, rad, 6, Math.PI / 6);
      ctx.stroke();
    }

    // 3. Counter-Rotating Gold Filigree Astrolabe Rings
    const rot1 = a.gears ? t * 0.18 : 0;
    const rot2 = a.gears ? -t * 0.24 : 0;

    ctx.save();
    ctx.translate(C, C);
    ctx.rotate(rot1);
    ctx.strokeStyle = rgba(c.gold, 0.35);
    ctx.lineWidth = 1.5;
    polygon(ctx, 0, 0, 156, 8, 0);
    ctx.stroke();
    polygon(ctx, 0, 0, 156, 8, Math.PI / 8);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(C, C);
    ctx.rotate(rot2);
    ctx.strokeStyle = rgba(c.goldHi, 0.25);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 134, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const ang = (i * Math.PI * 2) / 12;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * 126, Math.sin(ang) * 126);
      ctx.lineTo(Math.cos(ang) * 140, Math.sin(ang) * 140);
      ctx.stroke();
    }
    ctx.restore();

    // 4. Floating Diamond Sparkles
    for (const m of MOTES) {
      const p = a.motes ? wrap(t * m.spd + m.seed * 0.13) : wrap(m.seed * 0.29);
      const curR = m.rad * (1 - p * 0.35);
      const mx = C + Math.cos(m.angle + p * 1.2) * curR;
      const my = C + Math.sin(m.angle + p * 1.2) * curR;
      const alpha = Math.sin(p * Math.PI) * 0.85;
      ctx.fillStyle = m.seed % 3 === 0 ? rgba(c.goldHi, alpha) : rgba(energyCol, alpha);
      polygon(ctx, mx, my, m.sz, 4, 0);
      ctx.fill();
    }

    // 5. Outer Gold Filigree Bezel & Winged Chevrons
    ctx.strokeStyle = c.gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(C, C, 224, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = rgba(c.gold, 0.45);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(C, C, 172, 0, Math.PI * 2);
    ctx.stroke();

    // 6. 18-Facet Crystalline Arc Gauge
    const gems = 18;
    const litGems = k * gems;
    for (let i = 0; i < gems; i++) {
      const ang = START + (SWEEP * i) / (gems - 1);
      const gx = C + Math.cos(ang) * 198;
      const gy = C + Math.sin(ang) * 198;
      const fillAmt = Math.max(0, Math.min(1, litGems - i));

      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(ang + Math.PI / 2);

      // Gem socket in dark navy + gold rim
      ctx.fillStyle = '#050b16';
      ctx.strokeStyle = fillAmt > 0.1 ? c.goldHi : rgba(c.gold, 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.lineTo(9, 0);
      ctx.lineTo(0, 14);
      ctx.lineTo(-9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (fillAmt > 0.05) {
        const gemCol = mixHex(c.cyan, energyCol, i / (gems - 1));
        const pulse = a.pulse ? 0.82 + 0.18 * Math.sin(t * 4 - i * 0.4) : 1;
        ctx.fillStyle = rgba(gemCol, fillAmt * pulse);
        ctx.beginPath();
        ctx.moveTo(0, -11);
        ctx.lineTo(6.5, 0);
        ctx.lineTo(0, 11);
        ctx.lineTo(-6.5, 0);
        ctx.closePath();
        ctx.fill();

        // Inner specular facet highlight
        ctx.fillStyle = rgba('#ffffff', 0.55 * fillAmt);
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(3, 0);
        ctx.lineTo(0, 2);
        ctx.lineTo(-3, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // 7. Ornate Geometric Gold Frame Around Center Readout
    const goldGrad = ctx.createLinearGradient(C - 120, 130, C + 120, 320);
    goldGrad.addColorStop(0, c.gold);
    goldGrad.addColorStop(0.5, c.goldHi);
    goldGrad.addColorStop(1, c.gold);

    // Top & bottom chevron crowns
    ctx.strokeStyle = goldGrad;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(C - 86, 152);
    ctx.lineTo(C - 52, 136);
    ctx.lineTo(C, 146);
    ctx.lineTo(C + 52, 136);
    ctx.lineTo(C + 86, 152);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(C - 96, 306);
    ctx.lineTo(C - 48, 322);
    ctx.lineTo(C, 310);
    ctx.lineTo(C + 48, 322);
    ctx.lineTo(C + 96, 306);
    ctx.stroke();

    // Top crystal keystone
    ctx.fillStyle = energyCol;
    ctx.strokeStyle = c.goldHi;
    ctx.lineWidth = 2;
    polygon(ctx, C, 110, 11, 4, 0);
    ctx.fill();
    ctx.stroke();

    // 8. Regal Serif Typography
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '700 18px "Palatino Linotype"';
    ctx.fillStyle = c.goldHi;
    ctx.fillText(`◆  ${r.label}  ◆`, C, 174);

    const txt = valueText(r);
    bigText(ctx, txt, isRpm(r) ? 114 : 144, '"Palatino Linotype"', 224, '700');
    ctx.fillStyle = 'rgba(2, 6, 14, 0.85)';
    ctx.fillText(txt, C + 3, 278);
    ctx.strokeStyle = c.gold;
    ctx.lineWidth = 3;
    ctx.strokeText(txt, C, 274);
    ctx.fillStyle = state.alarm ? ALARM : c.number;
    ctx.fillText(txt, C, 274);

    ctx.font = '700 24px "Palatino Linotype"';
    ctx.fillStyle = energyCol;
    ctx.fillText(r.unit, C, 304);

    // 9. Bottom Filigree Telemetry Crest
    ctx.fillStyle = 'rgba(6, 13, 26, 0.9)';
    ctx.strokeStyle = goldGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(C - 96, 360);
    ctx.lineTo(C - 112, 378);
    ctx.lineTo(C - 96, 396);
    ctx.lineTo(C + 96, 396);
    ctx.lineTo(C + 112, 378);
    ctx.lineTo(C + 96, 360);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Side diamond rivets on crest
    ctx.fillStyle = energyCol;
    polygon(ctx, C - 98, 378, 5, 4, 0);
    ctx.fill();
    polygon(ctx, C + 98, 378, 5, 4, 0);
    ctx.fill();

    const crest = state.alarm ? 'CORE OVERLOAD' : `PUMP ${pad4(state.pumpRpm)}  ✧  FAN ${pad4(fanAvg(state))}`;
    fitFont(ctx, crest, 168, 16, '"Palatino Linotype"', '600');   // stays between the two rivets
    ctx.fillStyle = state.alarm ? ALARM : c.goldHi;
    ctx.fillText(crest, C, 384);
  },
};
