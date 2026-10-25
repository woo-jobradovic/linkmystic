// Seraphic Flight: wings of light whose feathers light up with the gauge, an astrolabe halo and rising light motes.
import { SIZE, C, ALARM, fitFont, reading, level, valueText, fanAvg, isRpm, rgba, mixHex, rnd, wrap, bigText, star } from './common.js';

const MOTES = Array.from({ length: 34 }, (_, i) => ({
  x: 45 + rnd(i * 3 + 1) * 390,
  y0: rnd(i * 3 + 2),
  r: 1.2 + rnd(i * 3 + 3) * 2.6,
  spd: 0.04 + rnd(i * 3 + 4) * 0.07,
  sway: 8 + rnd(i * 3 + 5) * 16,
  phase: rnd(i * 3 + 6) * Math.PI * 2,
  gold: i % 3 === 0,
}));

export default {
  id: 'ethereal',
  name: 'Seraphic Flight',
  blurb: 'Luminous wings of light, celestial astrolabe halo and rising starlight motes.',
  colors: [
    ['number', 'Number', '#ffffff'],
    ['sky', 'Sanctum sky', '#170b36'],
    ['wing', 'Wing azure', '#48d1ff'],
    ['violet', 'Aether violet', '#b56bff'],
    ['gold', 'Celestial gold', '#ffd984'],
  ],
  animations: [
    ['wings', 'Breathing wings', true],
    ['motes', 'Rising light motes', true],
    ['halo', 'Rotating astrolabe', true],
  ],
  draw(ctx, state, lcd, t, { colors: c, animations: a }) {
    const r = reading(state, lcd), k = level(r);

    // 1. Celestial sanctum background
    const bg = ctx.createRadialGradient(C, 150, 10, C, C, 260);
    bg.addColorStop(0, mixHex(c.violet, c.sky, 0.55));
    bg.addColorStop(0.55, c.sky);
    bg.addColorStop(1, '#05020d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Subtle god-rays from top crown
    ctx.save();
    const rayRot = a.halo ? Math.sin(t * 0.3) * 0.06 : 0;
    ctx.translate(C, 65);
    ctx.rotate(rayRot);
    for (let i = -4; i <= 4; i++) {
      const ang = i * 0.18 + Math.PI / 2;
      const g = ctx.createLinearGradient(0, 0, Math.cos(ang) * 360, Math.sin(ang) * 360);
      g.addColorStop(0, rgba(c.wing, 0.11));
      g.addColorStop(1, rgba(c.wing, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 360, ang - 0.055, ang + 0.055);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 2. Rotating celestial astrolabe rings
    const haloSpin = a.halo ? t * 0.22 : 0;
    ctx.save();
    ctx.translate(C, C);
    ctx.strokeStyle = rgba(c.gold, 0.22);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 154, 0, Math.PI * 2);
    ctx.arc(0, 0, 212, 0, Math.PI * 2);
    ctx.stroke();

    // Inner sacred geometry star
    ctx.save();
    ctx.rotate(haloSpin);
    ctx.strokeStyle = rgba(c.gold, 0.16);
    ctx.lineWidth = 1.2;
    for (let s = 0; s < 2; s++) {
      ctx.rotate(Math.PI / 4);
      ctx.strokeRect(-108, -108, 216, 216);
    }
    for (let i = 0; i < 12; i++) {
      const ang = (i * Math.PI) / 6;
      const x = Math.cos(ang) * 154, y = Math.sin(ang) * 154;
      ctx.fillStyle = i % 3 === 0 ? rgba(c.gold, 0.7) : rgba(c.wing, 0.45);
      ctx.beginPath();
      ctx.arc(x, y, i % 3 === 0 ? 3.5 : 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.restore();

    // 3. Rising light motes
    for (const m of MOTES) {
      const prog = a.motes ? wrap(m.y0 - t * m.spd) : m.y0;
      const y = 30 + prog * 420;
      const x = m.x + (a.motes ? Math.sin(t * 1.6 + m.phase) * m.sway : 0);
      const fade = Math.sin(prog * Math.PI);
      if (fade <= 0.05) continue;
      const col = m.gold ? c.gold : c.wing;
      ctx.fillStyle = rgba(col, fade * 0.45);
      ctx.beginPath();
      ctx.arc(x, y, m.r * 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba('#ffffff', fade * 0.9);
      ctx.beginPath();
      ctx.arc(x, y, m.r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Wings of Light (12 feathers per side, acting as primary visual gauge + outer halo arc)
    const flap = a.wings ? Math.sin(t * 2.1) * 0.045 : 0;
    const feathers = 12;
    const litFeathers = k * feathers;

    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(C + side * 92, C + 8);   // wing roots clear of the digits
      ctx.scale(side, 1);

      // Golden wing-shoulder clasp
      ctx.fillStyle = rgba(c.gold, 0.85);
      ctx.beginPath();
      ctx.moveTo(-6, -28);
      ctx.quadraticCurveTo(18, -8, 6, 26);
      ctx.quadraticCurveTo(-4, 6, -6, -28);
      ctx.fill();

      for (let i = 0; i < feathers; i++) {
        // i=0 is lowest feather, i=11 is highest crowning primary feather
        const frac = i / (feathers - 1);
        const active = Math.max(0, Math.min(1, litFeathers - i));
        const baseAng = 0.78 - frac * 1.48 - flap * (0.35 + frac * 0.65);

        ctx.save();
        ctx.rotate(baseAng);

        const len = 76 + Math.sin(frac * Math.PI * 0.85) * 68 + (i > 8 ? (i - 8) * 7 : 0);
        const w = 9 + frac * 5;

        const fCol = mixHex(c.violet, c.wing, frac * 0.75 + active * 0.25);
        const alpha = 0.16 + active * 0.72;

        const fg = ctx.createLinearGradient(8, 0, len, 0);
        fg.addColorStop(0, rgba(c.gold, 0.35 + active * 0.55));
        fg.addColorStop(0.28, rgba(fCol, alpha));
        fg.addColorStop(1, rgba(c.wing, active * 0.08));

        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.quadraticCurveTo(len * 0.45, -w, len, -w * 0.15);
        ctx.quadraticCurveTo(len * 0.58, w * 0.55, 8, 3);
        ctx.closePath();
        ctx.fill();

        // Luminous feather quill spine
        ctx.strokeStyle = active > 0.2 ? rgba('#ffffff', 0.35 + active * 0.55) : rgba(c.violet, 0.25);
        ctx.lineWidth = active > 0.2 ? 1.8 : 1;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.quadraticCurveTo(len * 0.5, -w * 0.3, len * 0.94, -w * 0.1);
        ctx.stroke();

        ctx.restore();
      }
      ctx.restore();
    }

    // 5. Outer Halo Gauge Arc (splits at bottom, rises to top crown)
    const rHalo = 196;
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      const a0 = Math.PI * 0.5 + side * 0.24;
      const a1 = Math.PI * 0.5 + side * (0.24 + 0.72 * Math.PI);
      const aLit = Math.PI * 0.5 + side * (0.24 + 0.72 * Math.PI * k);

      // Unlit track
      ctx.strokeStyle = rgba(c.violet, 0.22);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(C, C, rHalo, a0, a1, side < 0);
      ctx.stroke();

      // Lit energy halo
      if (k > 0.005) {
        ctx.strokeStyle = rgba(c.wing, 0.32);
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.arc(C, C, rHalo, a0, aLit, side < 0);
        ctx.stroke();

        ctx.strokeStyle = c.gold;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(C, C, rHalo, a0, aLit, side < 0);
        ctx.stroke();

        // Leading spark
        const sx = C + Math.cos(aLit) * rHalo;
        const sy = C + Math.sin(aLit) * rHalo;
        ctx.fillStyle = '#ffffff';
        star(ctx, sx, sy, 9, 4, 0.25);
        ctx.fill();
      }
    }

    // Top crown star emblem
    ctx.fillStyle = k > 0.92 ? '#ffffff' : c.gold;
    star(ctx, C, C - rHalo, 14, 4, 0.28);
    ctx.fill();
    ctx.fillStyle = rgba(c.wing, 0.45);
    star(ctx, C, C - rHalo, 8, 4, 0.3);
    ctx.fill();

    // 6. Central readout & ornate serif typography
    const coreGlow = ctx.createRadialGradient(C, C, 6, C, C, 118);
    coreGlow.addColorStop(0, rgba(c.sky, 0.82));
    coreGlow.addColorStop(0.7, rgba(c.sky, 0.45));
    coreGlow.addColorStop(1, rgba(c.sky, 0));
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(C, C, 118, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    // Label with filigree lines
    ctx.font = '700 18px "Palatino Linotype", Georgia, serif';
    ctx.fillStyle = c.gold;
    ctx.fillText(`✧  ${r.label}  ✧`, C, 166);

    // Big number
    const txt = valueText(r);
    bigText(ctx, txt, isRpm(r) ? 112 : 142, '"Palatino Linotype", Georgia, serif', 168, '700');   // fits between the wing clasps
    ctx.fillStyle = rgba(c.violet, 0.45);
    ctx.fillText(txt, C, 282);
    ctx.fillStyle = state.alarm ? ALARM : c.number;
    ctx.fillText(txt, C, 278);

    // Unit & subtle divider
    ctx.strokeStyle = rgba(c.gold, 0.55);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(C - 54, 300);
    ctx.lineTo(C + 54, 300);
    ctx.stroke();
    star(ctx, C, 300, 5, 4, 0.3);
    ctx.fillStyle = c.gold;
    ctx.fill();

    ctx.font = '700 24px "Palatino Linotype", Georgia, serif';
    ctx.fillStyle = c.wing;
    ctx.fillText(r.unit, C, 330);

    // Bottom secondary telemetry badge
    const fAvg = fanAvg(state);
    const subText = state.alarm
      ? '✦ AETHER OVERLOAD ✦'
      : `PUMP ${ state.pumpRpm ?? '--' }   •   FANS ${ fAvg ?? '--' }`;
    fitFont(ctx, subText, 150, 15, '"Palatino Linotype", Georgia, serif', '600');   // stays between the halo arcs
    ctx.fillStyle = state.alarm ? ALARM : rgba(c.gold, 0.82);
    ctx.fillText(subText, C, 396);
  },
};
