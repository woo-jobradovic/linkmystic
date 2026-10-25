// Eternal Realm: classic fantasy stone and gold around a glass orb of liquid (mana blue to fire orange), runes and a scroll.
import { SIZE, C, ALARM, START, SWEEP, reading, level, valueText, fanAvg, isRpm, rgba, mixHex, rnd, wrap, bigText, outlined } from './common.js';

const BUBBLES = Array.from({ length: 22 }, (_, i) => ({
  xOff: (rnd(i * 5 + 1) - 0.5) * 260,
  y0: rnd(i * 5 + 2),
  r: 2 + rnd(i * 5 + 3) * 4.5,
  spd: 0.12 + rnd(i * 5 + 4) * 0.18,
  wobble: rnd(i * 5 + 5) * Math.PI * 2,
}));

// 12 generic angular elder-style rune strokes (in normalized -1..1 coords)
const RUNES = [
  [[-0.4, -0.8, -0.4, 0.8], [-0.4, -0.6, 0.5, -0.1], [-0.4, 0.1, 0.4, 0.6]],
  [[-0.5, -0.8, 0.5, 0.8], [0.5, -0.8, -0.5, 0.8], [0, -0.9, 0, 0.9]],
  [[0, -0.85, -0.55, 0], [-0.55, 0, 0, 0.85], [0, 0.85, 0.55, 0], [0.55, 0, 0, -0.85]],
  [[-0.45, -0.8, -0.45, 0.8], [0.45, -0.8, 0.45, 0.8], [-0.45, 0, 0.45, -0.4]],
  [[0, -0.85, 0, 0.85], [-0.55, -0.35, 0, -0.85], [0.55, -0.35, 0, -0.85]],
  [[-0.5, -0.75, 0.5, -0.75], [0, -0.75, 0, 0.8], [-0.4, 0.15, 0.4, 0.15]],
  [[-0.45, -0.8, 0.45, 0], [0.45, 0, -0.45, 0.8], [-0.45, -0.8, -0.45, 0.8]],
  [[-0.5, 0.8, 0, -0.8], [0, -0.8, 0.5, 0.8], [-0.35, 0.2, 0.35, 0.2]],
  [[0, -0.85, 0, 0.85], [-0.5, -0.45, 0.5, 0.45], [-0.5, 0.45, 0.5, -0.45]],
  [[-0.4, -0.8, -0.4, 0.8], [-0.4, -0.8, 0.45, -0.3], [0.45, -0.3, -0.4, 0.2]],
  [[-0.5, -0.6, 0, -0.1], [0.5, -0.6, 0, -0.1], [0, -0.1, 0, 0.85]],
  [[-0.45, -0.8, 0.45, -0.2], [0.45, -0.2, -0.45, 0.3], [-0.45, 0.3, 0.45, 0.8]],
];

export default {
  id: 'realm',
  name: 'Eternal Realm',
  blurb: 'Carved stone and gold filigree globe with sloshing mana-to-fire liquid and runes.',
  colors: [
    ['number', 'Number', '#fff8e7'],
    ['cool', 'Mana blue', '#1868ff'],
    ['hot', 'Fire orange', '#ff5500'],
    ['gold', 'Gold filigree', '#e5b54f'],
    ['stone', 'Carved stone', '#23252c'],
    ['parchment', 'Parchment banner', '#d8be8c'],
  ],
  animations: [
    ['waves', 'Sloshing liquid', true],
    ['bubbles', 'Potion bubbles', true],
    ['runes', 'Pulsing runes', true],
  ],
  draw(ctx, state, lcd, t, { colors: c, animations: a }) {
    const r = reading(state, lcd), k = level(r);
    const liqCol = state.alarm ? ALARM : mixHex(c.cool, c.hot, k);
    const liqHi = mixHex(liqCol, '#ffffff', 0.42);
    const liqDark = mixHex(liqCol, '#06030d', 0.62);

    // 1. Dark carved stone outer vault background
    const bg = ctx.createRadialGradient(C, C, 120, C, C, 250);
    bg.addColorStop(0, c.stone);
    bg.addColorStop(1, '#0c0d10');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Carved stone ring segments & mortar joints
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const ang = (i * Math.PI) / 6 + Math.PI / 12;
      ctx.beginPath();
      ctx.moveTo(C + Math.cos(ang) * 165, C + Math.sin(ang) * 165);
      ctx.lineTo(C + Math.cos(ang) * 238, C + Math.sin(ang) * 238);
      ctx.stroke();
    }

    // 2. 12 Carved Elder Runes around the stone bezel (light up along gauge level)
    const litRunes = Math.round(k * 12);
    for (let i = 0; i < 12; i++) {
      const ang = START + (SWEEP * i) / 11;
      const rx = C + Math.cos(ang) * 204;
      const ry = C + Math.sin(ang) * 204;
      const isLit = i < litRunes;
      const pulse = a.runes && isLit ? 0.75 + 0.25 * Math.sin(t * 4 + i) : 1;

      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(ang + Math.PI / 2);

      if (isLit) {
        ctx.fillStyle = rgba(liqHi, 0.25 * pulse);
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = isLit ? rgba(liqHi, pulse) : 'rgba(0,0,0,0.6)';
      ctx.lineWidth = isLit ? 2.5 : 2;
      ctx.lineCap = 'round';
      for (const [x1, y1, x2, y2] of RUNES[i]) {
        ctx.beginPath();
        ctx.moveTo(x1 * 10, y1 * 10);
        ctx.lineTo(x2 * 10, y2 * 10);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. The Glass Orb (radius 158) with clipped sloshing liquid
    const orbR = 158;
    ctx.save();
    ctx.beginPath();
    ctx.arc(C, C, orbR, 0, Math.PI * 2);
    ctx.clip();

    // Deep empty glass cavity
    const cav = ctx.createRadialGradient(C, C - 40, 15, C, C, orbR);
    cav.addColorStop(0, '#1a1829');
    cav.addColorStop(1, '#050509');
    ctx.fillStyle = cav;
    ctx.fillRect(C - orbR, C - orbR, orbR * 2, orbR * 2);

    // Liquid level (fills from bottom y=384 to top y=96)
    const fillY = (C + orbR - 14) - k * (orbR * 2 - 28);

    // Back wave (darker, out of phase)
    ctx.fillStyle = rgba(liqCol, 0.55);
    ctx.beginPath();
    ctx.moveTo(C - orbR - 10, C + orbR + 10);
    for (let x = C - orbR - 10; x <= C + orbR + 10; x += 12) {
      const w = a.waves ? Math.sin(x * 0.032 - t * 2.6 + 1.8) * 8 + Math.cos(x * 0.06 + t * 1.9) * 4 : 0;
      ctx.lineTo(x, fillY + w - 4);
    }
    ctx.lineTo(C + orbR + 10, C + orbR + 10);
    ctx.closePath();
    ctx.fill();

    // Front main liquid body with rich vertical gradient
    const lg = ctx.createLinearGradient(C, fillY - 15, C, C + orbR);
    lg.addColorStop(0, liqHi);
    lg.addColorStop(0.18, liqCol);
    lg.addColorStop(1, liqDark);
    ctx.fillStyle = lg;

    ctx.beginPath();
    ctx.moveTo(C - orbR - 10, C + orbR + 10);
    for (let x = C - orbR - 10; x <= C + orbR + 10; x += 10) {
      const w = a.waves ? Math.sin(x * 0.028 + t * 3.1) * 9 + Math.sin(x * 0.055 - t * 2.1) * 4 : 0;
      ctx.lineTo(x, fillY + w);
    }
    ctx.lineTo(C + orbR + 10, C + orbR + 10);
    ctx.closePath();
    ctx.fill();

    // Glowing meniscus crest line
    ctx.strokeStyle = rgba('#ffffff', 0.65);
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = C - orbR - 10; x <= C + orbR + 10; x += 10) {
      const w = a.waves ? Math.sin(x * 0.028 + t * 3.1) * 9 + Math.sin(x * 0.055 - t * 2.1) * 4 : 0;
      if (x === C - orbR - 10) ctx.moveTo(x, fillY + w);
      else ctx.lineTo(x, fillY + w);
    }
    ctx.stroke();

    // Effervescent rising potion bubbles inside liquid
    for (const b of BUBBLES) {
      const prog = a.bubbles ? wrap(b.y0 - t * b.spd) : b.y0;
      const by = fillY + 12 + prog * (C + orbR - fillY - 12);
      if (by < fillY + 8) continue;
      const bx = C + b.xOff + (a.bubbles ? Math.sin(t * 2.5 + b.wobble) * 7 : 0);
      ctx.strokeStyle = rgba('#ffffff', 0.45);
      ctx.fillStyle = rgba(liqHi, 0.28);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(bx, by, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Inner glass spherical shadow & top-left specular crescent reflection
    const innerShade = ctx.createRadialGradient(C, C, orbR * 0.68, C, C, orbR);
    innerShade.addColorStop(0, 'rgba(0,0,0,0)');
    innerShade.addColorStop(1, 'rgba(0,0,0,0.68)');
    ctx.fillStyle = innerShade;
    ctx.fillRect(C - orbR, C - orbR, orbR * 2, orbR * 2);

    ctx.save();
    ctx.translate(C - 56, C - 58);
    ctx.rotate(-Math.PI / 4);
    const spec = ctx.createLinearGradient(0, -35, 0, 35);
    spec.addColorStop(0, 'rgba(255,255,255,0.52)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = spec;
    ctx.beginPath();
    ctx.ellipse(0, 0, 72, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.restore(); // end orb clip

    // 4. Ornate Gold Filigree Bezel & 4 Cardinal Dragon-scale Clasps
    ctx.strokeStyle = '#3a280a';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(C, C, orbR + 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = c.gold;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(C, C, orbR + 3, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#fff2bd';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(C, C, orbR + 1, 0, Math.PI * 2);
    ctx.stroke();

    // 4 ornate cardinal clasps holding the glass globe
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.translate(C, C);
      ctx.rotate((i * Math.PI) / 2);
      ctx.fillStyle = c.gold;
      ctx.strokeStyle = '#2a1b04';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-22, -orbR - 14);
      ctx.lineTo(22, -orbR - 14);
      ctx.lineTo(14, -orbR + 14);
      ctx.lineTo(0, -orbR + 24);
      ctx.lineTo(-14, -orbR + 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Embedded ruby/sapphire gem on clasp
      ctx.fillStyle = liqHi;
      ctx.beginPath();
      ctx.arc(0, -orbR - 1, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Readout inside the Orb (Ornate Serif with heavy dark outline)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    ctx.font = '700 20px "Palatino Linotype", Georgia, serif';
    outlined(ctx, r.label, C, 156, c.gold, '#0e0904', 5);

    const txt = valueText(r);
    bigText(ctx, txt, isRpm(r) ? 114 : 144, 'Georgia, "Palatino Linotype", serif', 218, '700');
    outlined(ctx, txt, C, 276, state.alarm ? ALARM : c.number, '#0b0704', 10);

    ctx.font = '700 26px "Palatino Linotype", Georgia, serif';
    outlined(ctx, r.unit, C, 314, c.gold, '#0b0704', 6);

    // 6. Warm Parchment Scroll Banner across the lower bezel
    const pGrad = ctx.createLinearGradient(C - 115, 360, C + 115, 360);
    pGrad.addColorStop(0, mixHex(c.parchment, '#5c431c', 0.45));
    pGrad.addColorStop(0.5, c.parchment);
    pGrad.addColorStop(1, mixHex(c.parchment, '#5c431c', 0.45));

    ctx.fillStyle = pGrad;
    ctx.strokeStyle = '#3b270c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(C - 112, 366, 224, 38, 8);
    ctx.fill();
    ctx.stroke();

    // Scroll rolled ends
    ctx.fillStyle = mixHex(c.parchment, '#4a3310', 0.55);
    for (const sx of [C - 114, C + 106]) {
      ctx.beginPath();
      ctx.roundRect(sx, 362, 8, 46, 4);
      ctx.fill();
      ctx.stroke();
    }

    ctx.font = '700 16px "Palatino Linotype", Georgia, serif';
    ctx.fillStyle = state.alarm ? ALARM : '#2b1a06';
    const scrollTxt = state.alarm
      ? '!! CORE OVERHEAT !!'
      : `PUMP ${ state.pumpRpm ?? '--' }  •  FANS ${ fanAvg(state) ?? '--' }`;
    ctx.fillText(scrollTxt, C, 391);
  },
};
