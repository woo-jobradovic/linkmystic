// Minimal: one clean arc and a big number.
import { SIZE, C, ALARM, START, SWEEP, reading, level, valueText, isRpm, gauge3 } from './common.js';

export default {
  id: 'minimal',
  name: 'Minimal',
  blurb: 'One clean arc and a big number.',
  colors: [['number', 'Number', '#ffffff'], ['label', 'Label', '#9aa0a8'], ['track', 'Gauge track', '#1b1f26'], ['low', 'Gauge low', '#00f0ff'], ['mid', 'Gauge middle', '#fcee0a'], ['high', 'Gauge high', '#ff003c']],
  animations: [],
  draw(ctx, state, lcd, t, { colors: c }) {
    const r = reading(state, lcd), k = level(r);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SIZE, SIZE);
    ctx.lineCap = 'round'; ctx.lineWidth = 22;
    ctx.strokeStyle = c.track; ctx.beginPath(); ctx.arc(C, C, 200, START, START + SWEEP); ctx.stroke();
    ctx.strokeStyle = state.alarm ? ALARM : gauge3(k, c.low, c.mid, c.high); ctx.beginPath(); ctx.arc(C, C, 200, START, START + SWEEP * Math.max(0.01, k)); ctx.stroke();
    ctx.textAlign = 'center'; ctx.fillStyle = state.alarm ? ALARM : c.number;
    ctx.font = `700 ${isRpm(r) ? 100 : 140}px "LM Display"`;
    ctx.fillText(valueText(r), C, 280);
    ctx.font = '28px "LM Mono"'; ctx.fillStyle = c.label; ctx.fillText(`${r.label}  ${r.unit}`, C, 340);
  },
};
