// Cyberpunk: neon segment gauge, scanlines, scan sweep and a glitching chromatic number.
import { SIZE, C, ALARM, START, SWEEP, reading, level, valueText, fanAvg, pad4, isRpm, rgba, gauge3 } from './common.js';

function segments(ctx, lit, n, alpha, c, r0 = 196, r1 = 226) {
  const seg = SWEEP / n, gap = seg * 0.18;
  for (let i = 0; i < n; i++) {
    const a0 = START + i * seg + gap / 2, a1 = START + (i + 1) * seg - gap / 2;
    ctx.beginPath();
    ctx.arc(C, C, r1, a0, a1);
    ctx.arc(C, C, r0, a1, a0, true);
    ctx.closePath();
    if (i < lit) { ctx.fillStyle = gauge3(i / (n - 1), c.low, c.mid, c.high); ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14 * alpha; }
    else { ctx.fillStyle = '#16222c'; ctx.shadowBlur = 0; }
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

export default {
  id: 'cyberpunk',
  name: 'Cyberpunk',
  blurb: 'Neon segments, scanlines and a glitching number.',
  colors: [['number', 'Number', '#fcee0a'], ['detail', 'Details (text, ring, sweep)', '#00f0ff'], ['shadow', 'Number shadow', '#ff00aa'], ['low', 'Gauge low', '#00f0ff'], ['mid', 'Gauge middle', '#fcee0a'], ['high', 'Gauge high', '#ff003c']],
  animations: [['glitch', 'Glitch', true], ['scanlines', 'Scanlines', true], ['sweep', 'Scan sweep', true], ['pulse', 'Gauge glow pulse', true]],
  draw(ctx, state, lcd, t, { colors: c, animations: a }) {
    const r = reading(state, lcd), n = 36, lit = Math.round(level(r) * n);
    ctx.fillStyle = '#06070c'; ctx.fillRect(0, 0, SIZE, SIZE);
    if (a.scanlines) {
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      for (let y = 0; y < SIZE; y += 3) ctx.fillRect(0, y, SIZE, 1);
    }
    segments(ctx, lit, n, a.pulse ? 0.6 + 0.4 * Math.sin(t * Math.PI * 1.2) : 0.8, c);
    ctx.strokeStyle = rgba(c.detail, 0.35); ctx.lineWidth = 2; ctx.setLineDash([2, 6]);
    ctx.beginPath(); ctx.arc(C, C, 185, START, START + SWEEP); ctx.stroke(); ctx.setLineDash([]);
    if (a.sweep) {
      const sweepY = (t * 160) % (SIZE + 60) - 30;
      const g = ctx.createLinearGradient(0, sweepY - 24, 0, sweepY);
      g.addColorStop(0, rgba(c.detail, 0)); g.addColorStop(1, rgba(c.detail, 0.22));
      ctx.fillStyle = g; ctx.fillRect(0, sweepY - 24, SIZE, 26);
    }

    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.font = '24px "LM Mono"'; ctx.fillStyle = c.detail; ctx.fillText(`// ${r.label}`, C, 140);
    const glitch = a.glitch && t % 2.5 < 0.14, jx = glitch ? Math.round(Math.sin(t * 97) * 10) : 0, split = glitch ? 10 : 4;
    const txt = valueText(r);
    ctx.font = `900 ${isRpm(r) ? 96 : 150}px "LM Display"`;
    const y = isRpm(r) ? 280 : 300;
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = c.shadow; ctx.fillText(txt, C - split + jx, y);
    ctx.fillStyle = c.detail; ctx.fillText(txt, C + split + jx, y);
    ctx.globalAlpha = 1;
    ctx.fillStyle = state.alarm ? ALARM : c.number; ctx.fillText(txt, C + jx, y);
    if (glitch) { const sy = 190 + Math.floor(Math.abs(Math.sin(t * 53)) * 90); ctx.drawImage(ctx.canvas, 0, sy, SIZE, 10, jx * 2, sy, SIZE, 10); }
    ctx.font = '700 34px "LM Display"'; ctx.fillStyle = c.detail; ctx.fillText(r.unit, C, y + 44);
    ctx.font = '22px "LM Mono"'; ctx.fillStyle = c.number;
    ctx.fillText(`PUMP ${pad4(state.pumpRpm)}  FAN ${pad4(fanAvg(state))}`, C, 384);
    ctx.fillStyle = state.alarm ? ALARM : c.detail; ctx.font = '24px "LM Mono"';
    ctx.fillText(state.alarm ? '!! ALERT' : 'SYS.OK', C, 430);
  },
};
