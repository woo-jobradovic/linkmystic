// Arena Shields: chamfered armor plates, a hex-weave shimmer and a 5-cell shield bar that climbs through color tiers.
import { SIZE, C, ALARM, reading, level, valueText, fanAvg, pad4, isRpm, rgba, mixHex, bigText, polygon } from './common.js';

// Precompute hex-grid centers within the screen circle
const HEXES = [];
const HR = 18, DX = HR * 1.732, DY = HR * 1.5;
for (let row = -9; row <= 9; row++) {
  for (let col = -9; col <= 9; col++) {
    const x = C + col * DX + (row & 1 ? DX * 0.5 : 0);
    const y = C + row * DY;
    const d = Math.hypot(x - C, y - C);
    if (d > 65 && d < 226) HEXES.push({ x, y, d, ang: Math.atan2(y - C, x - C) });
  }
}

function shieldTier(k, c) {
  if (k < 0.22) return { col: '#e6edf5', name: 'LVL 1 // STANDARD', cells: 2 };
  if (k < 0.48) return { col: c.tier2, name: 'LVL 2 // RARE', cells: 3 };
  if (k < 0.74) return { col: c.tier3, name: 'LVL 3 // EPIC', cells: 4 };
  if (k < 0.92) return { col: c.tier4, name: 'LVL 4 // GUARDIAN', cells: 4 };
  return { col: c.accent, name: 'LVL 5 // OVERCHARGE', cells: 5 };
}

export default {
  id: 'arena',
  name: 'Arena Shields',
  blurb: 'Chamfered armor plates, hex-weave shimmer and an evolving tier shield bar.',
  colors: [
    ['number', 'Number', '#ffffff'],
    ['accent', 'Arena red-orange', '#ff461c'],
    ['panel', 'Armor charcoal', '#16191f'],
    ['tier2', 'Shield blue', '#2cb5ff'],
    ['tier3', 'Shield purple', '#b354ff'],
    ['tier4', 'Shield gold', '#ffbe2e'],
  ],
  animations: [
    ['shimmer', 'Hex-grid shimmer', true],
    ['charge', 'Shield cell pulse', true],
    ['scan', 'Target-lock ring', true],
  ],
  draw(ctx, state, lcd, t, { colors: c, animations: a }) {
    const r = reading(state, lcd), k = level(r);
    const tier = shieldTier(k, c);
    const activeCol = state.alarm ? ALARM : tier.col;

    // 1. Brushed dark charcoal background
    const bg = ctx.createRadialGradient(C, C, 20, C, C, 250);
    bg.addColorStop(0, mixHex(c.panel, '#2b313d', 0.45));
    bg.addColorStop(1, '#090b0e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // 2. Hexagonal energy weave with sweeping wave shimmer
    ctx.lineWidth = 1.2;
    for (const h of HEXES) {
      let wave = 0.08;
      if (a.shimmer) {
        const pulse = Math.sin(h.d * 0.045 - t * 3.2 + Math.cos(h.ang * 3)) * 0.5 + 0.5;
        wave = 0.04 + Math.pow(pulse, 3) * 0.28;
      }
      ctx.strokeStyle = rgba(activeCol, wave);
      polygon(ctx, h.x, h.y, HR - 2, 6, Math.PI / 6);
      ctx.stroke();
    }

    // 3. Outer rotating target-lock ring & perimeter ticks
    const ringRot = a.scan ? t * 0.35 : 0;
    ctx.save();
    ctx.translate(C, C);
    ctx.rotate(ringRot);
    ctx.strokeStyle = rgba(c.accent, 0.35);
    ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      const a0 = (i * Math.PI) / 2 + 0.18;
      ctx.beginPath();
      ctx.arc(0, 0, 218, a0, a0 + 0.42);
      ctx.stroke();
    }
    ctx.restore();

    // Top & bottom chamfered armor plates
    ctx.fillStyle = rgba(c.panel, 0.92);
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 2.5;

    // Top header armor plate
    ctx.beginPath();
    ctx.moveTo(C - 118, 42);
    ctx.lineTo(C + 118, 42);
    ctx.lineTo(C + 96, 82);
    ctx.lineTo(C - 96, 82);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Red-orange top chevron accent
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.moveTo(C - 40, 42);
    ctx.lineTo(C + 40, 42);
    ctx.lineTo(C + 30, 50);
    ctx.lineTo(C - 30, 50);
    ctx.closePath();
    ctx.fill();

    // 4. Central Chamfered Combat Visor Frame
    ctx.fillStyle = rgba('#0b0d12', 0.86);
    ctx.strokeStyle = rgba('#ffffff', 0.18);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(76, 134);
    ctx.lineTo(404, 134);
    ctx.lineTo(426, 160);
    ctx.lineTo(426, 266);
    ctx.lineTo(394, 298);
    ctx.lineTo(86, 298);
    ctx.lineTo(54, 266);
    ctx.lineTo(54, 160);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Heavy red-orange side brackets on visor
    ctx.strokeStyle = c.accent;
    ctx.lineWidth = 4.5;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(C + s * 150, 134);
      ctx.lineTo(C + s * 164, 134);
      ctx.lineTo(C + s * 186, 160);
      ctx.lineTo(C + s * 186, 205);
      ctx.stroke();
    }

    // 5. Segmented 5-cell shield bar (y: 318..354)
    const totalCells = 5;
    const cellW = 54, cellH = 28, gap = 8;
    const slant = 10;
    const startX = C - ((totalCells * cellW + (totalCells - 1) * gap) / 2);
    const barY = 320;
    const exactFill = k * totalCells;

    for (let i = 0; i < totalCells; i++) {
      const x = startX + i * (cellW + gap);
      const cellFill = Math.max(0, Math.min(1, exactFill - i));

      // Skewed parallelogram path
      ctx.beginPath();
      ctx.moveTo(x + slant, barY);
      ctx.lineTo(x + cellW + slant, barY);
      ctx.lineTo(x + cellW, barY + cellH);
      ctx.lineTo(x, barY + cellH);
      ctx.closePath();

      // Background slot
      ctx.fillStyle = 'rgba(10,12,16,0.85)';
      ctx.fill();

      // Partial or full shield energy fill
      if (cellFill > 0) {
        ctx.save();
        ctx.clip();
        const pulse = a.charge ? 0.88 + 0.12 * Math.sin(t * 6 - i * 0.7) : 1;
        ctx.fillStyle = rgba(activeCol, pulse);
        ctx.fillRect(x, barY, (cellW + slant) * cellFill, cellH);

        // Bright internal scan highlight
        ctx.fillStyle = 'rgba(255,255,255,0.32)';
        ctx.fillRect(x, barY, (cellW + slant) * cellFill, 6);
        ctx.restore();
      }

      // Cell border
      ctx.strokeStyle = cellFill >= 1 ? '#ffffff' : rgba(activeCol, 0.45);
      ctx.lineWidth = cellFill >= 1 ? 2 : 1.5;
      ctx.stroke();
    }

    // 6. Condensed DIN-like Typography (Bahnschrift)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fontStretch = 'condensed';

    // Top header tier status
    ctx.font = '700 17px Bahnschrift, "Segoe UI", sans-serif';
    ctx.fillStyle = activeCol;
    ctx.fillText(state.alarm ? '!! SHIELD CRITICAL !!' : tier.name, C, 68);

    // Metric label & flanked tactical chevrons
    ctx.font = '700 22px Bahnschrift, "Segoe UI", sans-serif';
    ctx.fillStyle = c.accent;
    ctx.fillText(`» ${r.label} TELEMETRY «`, C, 120);

    // Big primary number
    const txt = valueText(r);
    bigText(ctx, txt, isRpm(r) ? 124 : 152, 'Bahnschrift, "Segoe UI", sans-serif', 235, '700');
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(txt, C + 4, 266);
    ctx.fillStyle = state.alarm ? ALARM : c.number;
    ctx.fillText(txt, C, 262);

    // Unit badge tucked to the right of the visor
    ctx.font = '700 26px Bahnschrift, "Segoe UI", sans-serif';
    ctx.fillStyle = activeCol;
    ctx.textAlign = 'right';   // inside the visor's right bracket
    ctx.fillText(r.unit, C + 172, 288);
    ctx.textAlign = 'center';

    // Bottom armor plate with dual telemetry counters
    ctx.fillStyle = rgba(c.panel, 0.9);
    ctx.strokeStyle = rgba('#ffffff', 0.2);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(C - 126, 368);
    ctx.lineTo(C + 126, 368);
    ctx.lineTo(C + 102, 412);
    ctx.lineTo(C - 102, 412);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.font = '700 20px "LM Mono", Consolas, monospace';
    ctx.fillStyle = '#d8dee9';
    ctx.fillText(`PMP ${pad4(state.pumpRpm)}  //  FAN ${pad4(fanAvg(state))}`, C, 397);

    ctx.fontStretch = 'normal';
  },
};
