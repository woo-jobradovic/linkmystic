// Point Breach: tactical-shooter HUD, gunmetal slate, view-cone radar with contacts, split heat arcs and an LED timer module.
import { SIZE, C, ALARM, reading, level, valueText, fanAvg, pad4, isRpm, rgba, mix, rnd, bigText, polygon } from './common.js';

const CONTACTS = Array.from({ length: 8 }, (_, i) => ({
  a: rnd(i * 7 + 3) * Math.PI * 2,
  d: 48 + rnd(i * 13 + 5) * 118,
  hostile: i % 3 === 0,
}));

let bgTile = null;
function getBgTile() {
  if (bgTile) return bgTile;
  bgTile = new OffscreenCanvas(12, 12);
  const g = bgTile.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.025)';
  g.fillRect(0, 0, 6, 6);
  g.fillRect(6, 6, 6, 6);
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 1;
  g.strokeRect(0, 0, 12, 12);
  return bgTile;
}

export default {
  id: 'tactical',
  name: 'Point Breach',
  blurb: 'Frosted tactical slate HUD with a view-cone radar and LED countdown module.',
  colors: [
    ['number', 'Readout', '#f8fafc'],
    ['accent', 'Tactical amber', '#ff9f1c'],
    ['radar', 'Radar sweep', '#38e54d'],
    ['shield', 'Cool / armor bar', '#3b9eff'],
    ['led', 'Timer LED', '#ff2a38'],
    ['plate', 'Gunmetal plate', '#182028'],
  ],
  animations: [
    ['sweep', 'Radar view-cone', true],
    ['pulse', 'Countdown pulse', true],
    ['recoil', 'Crosshair breath', true],
  ],
  draw(ctx, state, lcd, t, { colors: c, animations: a }) {
    const r = reading(state, lcd), k = level(r);

    // 1. Gunmetal carbon base
    const bg = ctx.createRadialGradient(C, C, 10, C, C, 250);
    bg.addColorStop(0, c.plate);
    bg.addColorStop(1, '#070a0e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = ctx.createPattern(getBgTile(), 'repeat');
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 2. Outer rotating compass bezel
    const compRot = a.sweep ? Math.sin(t * 0.35) * 0.18 : 0;
    ctx.save();
    ctx.translate(C, C);
    ctx.rotate(compRot);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 218, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fontStretch = 'condensed';
    ctx.font = '600 11px Bahnschrift';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 36; i++) {
      const ang = (i * 10 * Math.PI) / 180 - Math.PI / 2;
      const major = i % 3 === 0;
      const r0 = major ? 210 : 214;
      ctx.strokeStyle = major ? rgba(c.accent, 0.55) : 'rgba(255,255,255,0.18)';
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
      ctx.lineTo(Math.cos(ang) * 218, Math.sin(ang) * 218);
      ctx.stroke();
      if (i % 9 === 0) {
        ctx.save();
        ctx.rotate(ang + Math.PI / 2);
        ctx.fillStyle = c.accent;
        ctx.fillText(['N', 'E', 'S', 'W'][i / 9], 0, -200);
        ctx.restore();
      }
    }
    ctx.restore();

    // 3. Tactical Radar Grid & View-Cone
    const coneA = a.sweep ? (t * 1.45) % (Math.PI * 2) : -Math.PI * 0.35;
    ctx.strokeStyle = rgba(c.radar, 0.16);
    ctx.lineWidth = 1;
    for (const rad of [55, 110, 165]) {
      ctx.beginPath();
      ctx.arc(C, C, rad, 0, Math.PI * 2);
      ctx.stroke();
    }

    // FOV radar cone (70 deg)
    const spread = 0.62;
    const coneGrad = ctx.createRadialGradient(C, C, 4, C, C, 170);
    coneGrad.addColorStop(0, rgba(c.radar, 0.28));
    coneGrad.addColorStop(1, rgba(c.radar, 0.02));
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(C, C);
    ctx.arc(C, C, 170, coneA - spread, coneA + spread);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = rgba(c.radar, 0.45);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(C + Math.cos(coneA - spread) * 170, C + Math.sin(coneA - spread) * 170);
    ctx.lineTo(C, C);
    ctx.lineTo(C + Math.cos(coneA + spread) * 170, C + Math.sin(coneA + spread) * 170);
    ctx.stroke();

    // Radar contacts (diamonds & X-marks)
    for (const b of CONTACTS) {
      let diff = ((coneA - b.a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      const inCone = diff <= spread;
      const alpha = a.sweep ? (inCone ? 0.95 : Math.max(0.12, 0.7 - diff * 0.25)) : 0.65;
      const bx = C + Math.cos(b.a) * b.d;
      const by = C + Math.sin(b.a) * b.d;
      if (b.hostile) {
        ctx.strokeStyle = rgba(c.led, alpha);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(bx - 5, by - 5);
        ctx.lineTo(bx + 5, by + 5);
        ctx.moveTo(bx + 5, by - 5);
        ctx.lineTo(bx - 5, by + 5);
        ctx.stroke();
      } else {
        ctx.fillStyle = rgba(c.radar, alpha);
        polygon(ctx, bx, by, 5.5, 4, 0);
        ctx.fill();
      }
    }

    // 4. Split Left/Right Segmented Gauge Arcs (Shield/Cool -> Heat/Danger)
    const segs = 16;
    const activeSegs = Math.round(k * segs);
    for (const side of [-1, 1]) {
      for (let i = 0; i < segs; i++) {
        // Bottom (0) to top (segs-1) along each flank
        const frac = i / (segs - 1);
        const a0 = side === -1 ? Math.PI * 0.72 + frac * Math.PI * 0.56 : Math.PI * 0.28 - frac * Math.PI * 0.56;
        const a1 = side === -1 ? a0 + 0.085 : a0 - 0.085;
        const lit = i < activeSegs;
        const segCol = frac < 0.55 ? mix(c.shield, c.accent, frac / 0.55) : mix(c.accent, c.led, (frac - 0.55) / 0.45);
        ctx.strokeStyle = lit ? (state.alarm ? ALARM : segCol) : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(C, C, 190, Math.min(a0, a1), Math.max(a0, a1));
        ctx.stroke();
      }
    }

    // 5. Top Tactical Header Plate (chamfered)
    ctx.fillStyle = rgba(c.plate, 0.88);
    ctx.strokeStyle = rgba(c.accent, 0.65);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(C - 95, 74);
    ctx.lineTo(C + 95, 74);
    ctx.lineTo(C + 80, 106);
    ctx.lineTo(C - 80, 106);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Accent top bar
    ctx.fillStyle = c.accent;
    ctx.fillRect(C - 48, 73, 96, 3);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fontStretch = 'condensed';
    ctx.font = '700 20px Bahnschrift';
    ctx.fillStyle = c.accent;
    ctx.fillText(`// ${r.label} //`, C, 91);

    // 6. Center Translucent HUD Plate & Dynamic Reticle
    ctx.fillStyle = 'rgba(10, 14, 19, 0.72)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(C - 132, 128);
    ctx.lineTo(C + 116, 128);
    ctx.lineTo(C + 132, 144);
    ctx.lineTo(C + 132, 306);
    ctx.lineTo(C - 116, 306);
    ctx.lineTo(C - 132, 290);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Amber corner ticks on center plate
    const gap = a.recoil ? Math.sin(t * 4) * 3 + k * 5 : 0;
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 3;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const cx = C + sx * (120 + gap);
      const cy = 217 + sy * (76 + gap * 0.5);
      ctx.beginPath();
      ctx.moveTo(cx - sx * 18, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy - sy * 18);
      ctx.stroke();
    }

    // 7. Big Main Readout
    const txt = valueText(r);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fontStretch = 'condensed';
    bigText(ctx, txt, isRpm(r) ? 124 : 152, 'Bahnschrift', 226, '700');
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillText(txt, C + 4, 258);
    ctx.fillStyle = state.alarm ? ALARM : c.number;
    ctx.fillText(txt, C, 254);

    // Unit badge + percentage readout
    ctx.font = '700 24px Bahnschrift';
    ctx.fillStyle = c.accent;
    ctx.fillText(`${r.unit}   ·   ${Math.round(k * 100)}%`, C, 292);

    // 8. Bottom LED Countdown & Telemetry Module
    ctx.fillStyle = 'rgba(8, 10, 14, 0.9)';
    ctx.strokeStyle = state.alarm ? ALARM : rgba(c.led, 0.65);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(C - 120, 330);
    ctx.lineTo(C + 120, 330);
    ctx.lineTo(C + 104, 398);
    ctx.lineTo(C - 104, 398);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Blinking armed LED beacon
    const freq = 1.5 + k * 5.5;
    const ledOn = !a.pulse || Math.sin(t * freq * Math.PI * 2) > -0.2;
    if (ledOn) {
      const glow = ctx.createRadialGradient(C - 86, 355, 1, C - 86, 355, 18);
      glow.addColorStop(0, c.led);
      glow.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(C - 86, 355, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = ledOn ? c.led : rgba(c.led, 0.25);
    ctx.beginPath();
    ctx.arc(C - 86, 355, 6, 0, Math.PI * 2);
    ctx.fill();

    // Digital telemetry line
    ctx.font = '400 23px "LM Mono"';
    ctx.fillStyle = state.alarm ? ALARM : c.led;
    ctx.textAlign = 'left';
    ctx.fillText(`P:${pad4(state.pumpRpm)} F:${pad4(fanAvg(state))}`, C - 68, 363);

    // 10-pip timer bar inside bottom module
    const pips = 10, litPips = Math.round(k * pips);
    for (let i = 0; i < pips; i++) {
      ctx.fillStyle = i < litPips ? (i > 7 ? c.led : c.accent) : 'rgba(255,255,255,0.12)';
      ctx.fillRect(C - 90 + i * 18.2, 377, 14, 8);
    }

    ctx.textAlign = 'center';
    ctx.fontStretch = 'condensed';
    ctx.font = '700 15px Bahnschrift';
    ctx.fillStyle = state.alarm ? ALARM : 'rgba(255,255,255,0.5)';
    ctx.fillText(state.alarm ? 'CRITICAL THERMAL BREACH' : 'SYS ARMED // TELEMETRY NOMINAL', C, 418);
  },
};
