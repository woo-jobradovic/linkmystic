// Drop Zone: survival topo map with a grid, a shrinking blue play zone, a flight path, bearing tape and health/boost bars.
import { SIZE, C, ALARM, fitFont, reading, level, valueText, fanAvg, pad4, isRpm, rgba, wrap, bigText, outlined } from './common.js';

let mapCache = null;
let mapColorKey = '';

function getTopoMap(cLand, cCoast) {
  const key = `${cLand}|${cCoast}`;
  if (mapCache && mapColorKey === key) return mapCache;
  mapColorKey = key;
  mapCache = new OffscreenCanvas(SIZE, SIZE);
  const g = mapCache.getContext('2d');

  // Sea & olive landmass base
  g.fillStyle = cCoast;
  g.fillRect(0, 0, SIZE, SIZE);

  // Main island mass
  g.fillStyle = cLand;
  g.beginPath();
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const rad = 195 + Math.sin(a * 3 + 0.5) * 22 + Math.cos(a * 5 - 1.2) * 14;
    const x = C + 12 + Math.cos(a) * rad;
    const y = C - 8 + Math.sin(a) * rad;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();

  // Topographic elevation contour rings
  g.strokeStyle = 'rgba(220, 212, 175, 0.16)';
  g.lineWidth = 1.4;
  for (const [cx, cy, baseR,layers] of [
    [195, 190, 24, 5],
    [305, 275, 20, 4],
    [165, 310, 16, 3],
  ]) {
    for (let L = 1; L <= layers; L++) {
      g.beginPath();
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        const r = baseR * L + Math.sin(a * 3 + L) * 7 + Math.cos(a * 4 - L) * 5;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.stroke();
    }
  }

  // Coordinate grid (A-D, 1-4)
  g.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  g.lineWidth = 1;
  const step = 96;
  for (let i = 1; i <= 4; i++) {
    const p = i * step;
    g.beginPath();
    g.moveTo(p, 0);
    g.lineTo(p, SIZE);
    g.moveTo(0, p);
    g.lineTo(SIZE, p);
    g.stroke();
  }
  return mapCache;
}

export default {
  id: 'battlezone',
  name: 'Drop Zone',
  blurb: 'Topographic survival map with a shrinking blue play-zone and flight path.',
  colors: [
    ['number', 'Readout', '#ffffff'],
    ['signal', 'Signal yellow', '#f7b500'],
    ['zone', 'Blue zone wall', '#1e90ff'],
    ['land', 'Terrain olive', '#2a3324'],
    ['water', 'Coastline slate', '#152229'],
    ['health', 'Health bar', '#f2f4f7'],
  ],
  animations: [
    ['flight', 'Airlift transport', true],
    ['zone', 'Blue wall shimmer', true],
    ['compass', 'Bearing strip drift', true],
  ],
  draw(ctx, state, lcd, t, { colors: c, animations: a }) {
    const r = reading(state, lcd), k = level(r);

    // 1. Cached Topographic Map + Grid
    ctx.drawImage(getTopoMap(c.land, c.water), 0, 0);

    // Grid coordinate labels inside safe bezel
    ctx.fontStretch = 'condensed';
    ctx.font = '700 13px Bahnschrift';
    ctx.fillStyle = rgba(c.signal, 0.65);
    ctx.textAlign = 'left';
    ctx.fillText('A', 102, 74);
    ctx.fillText('B', 198, 74);
    ctx.fillText('C', 294, 74);
    ctx.fillText('2', 64, 186);
    ctx.fillText('3', 64, 282);

    // 2. Shrinking Blue Play-Zone Wall & White Next-Circle
    // As k goes 0 -> 1, the blue zone shrinks from r=215 down to the safe zone r=122
    const safeX = C + 8, safeY = C - 6, safeR = 114;
    const blueR = 216 - k * 96 + (a.zone ? Math.sin(t * 3.2) * 3 : 0);

    // Translucent blue storm outside `blueR` using evenodd fill
    ctx.save();
    ctx.fillStyle = rgba(c.zone, 0.24 + k * 0.14);
    ctx.beginPath();
    ctx.rect(0, 0, SIZE, SIZE);
    ctx.arc(safeX, safeY, blueR, 0, Math.PI * 2, true);
    ctx.fill('evenodd');

    // Electric blue wall perimeter
    ctx.strokeStyle = state.alarm ? ALARM : c.zone;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(safeX, safeY, blueR, 0, Math.PI * 2);
    ctx.stroke();

    // Inner electric pulse ring
    if (a.zone) {
      const pulseR = blueR + ((t * 18) % 16);
      ctx.strokeStyle = rgba(c.zone, 0.45 * (1 - ((t * 18) % 16) / 16));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(safeX, safeY, pulseR, 0, Math.PI * 2);
      ctx.stroke();
    }

    // White dashed "Next Safe Zone" circle
    ctx.setLineDash([8, 6]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(safeX, safeY, safeR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 3. Dashed Flight Path & Moving Transport Plane
    const x1 = 76, y1 = 152, x2 = 408, y2 = 308;
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Red drop-line indicator perpendicular to flight path
    const pFlight = a.flight ? wrap(t * 0.08) : 0.72;
    const px = x1 + (x2 - x1) * pFlight;
    const py = y1 + (y2 - y1) * pFlight;
    const ang = Math.atan2(y2 - y1, x2 - x1);

    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.fillStyle = c.signal;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;
    // Simple geometric aircraft icon
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(4, -3);
    ctx.lineTo(-2, -14);
    ctx.lineTo(-6, -14);
    ctx.lineTo(-4, -3);
    ctx.lineTo(-12, -2);
    ctx.lineTo(-15, -7);
    ctx.lineTo(-17, -7);
    ctx.lineTo(-15, 0);
    ctx.lineTo(-17, 7);
    ctx.lineTo(-15, 7);
    ctx.lineTo(-12, 2);
    ctx.lineTo(-4, 3);
    ctx.lineTo(-6, 14);
    ctx.lineTo(-2, 14);
    ctx.lineTo(4, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 4. Top Horizontal Bearing Tape
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(C - 118, 42, 236, 30, 4);
    ctx.fillStyle = 'rgba(12, 16, 14, 0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.clip();

    const drift = a.compass ? Math.sin(t * 0.4) * 35 : 0;
    ctx.fontStretch = 'condensed';
    ctx.font = '700 13px Bahnschrift';
    ctx.textAlign = 'center';
    const bearings = ['NW', '330', '345', 'N', '015', '030', 'NE'];
    for (let i = 0; i < bearings.length; i++) {
      const bx = C + (i - 3) * 38 + drift;
      ctx.fillStyle = bearings[i] === 'N' ? c.signal : 'rgba(255,255,255,0.75)';
      ctx.fillText(bearings[i], bx, 62);
    }
    ctx.restore();

    // Yellow center marker triangle over compass
    ctx.fillStyle = c.signal;
    ctx.beginPath();
    ctx.moveTo(C - 6, 38);
    ctx.lineTo(C + 6, 38);
    ctx.lineTo(C, 46);
    ctx.closePath();
    ctx.fill();

    // 5. Phase & Metric Stencil Header
    const phase = Math.min(5, Math.floor(k * 5) + 1);
    // the plate grows with its text, so the accent bar never covers the first letter
    const head = `${r.label}  ·  PHASE ${phase}`;
    ctx.fontStretch = 'condensed';
    fitFont(ctx, head, 220, 18, 'Bahnschrift', '700');
    const hw = Math.ceil(ctx.measureText(head).width) + 28;
    ctx.fillStyle = 'rgba(15, 19, 17, 0.85)';
    ctx.fillRect(C - hw / 2, 108, hw, 28);
    ctx.fillStyle = c.signal;
    ctx.fillRect(C - hw / 2, 108, 5, 28);
    ctx.textAlign = 'center';
    ctx.fillText(head, C + 3, 128);

    // 6. Bold Condensed Main Readout
    const txt = valueText(r);
    ctx.textBaseline = 'alphabetic';
    bigText(ctx, txt, isRpm(r) ? 122 : 150, 'Bahnschrift', 228, '700');
    outlined(ctx, txt, C, 260, state.alarm ? ALARM : c.number, 'rgba(10,14,12,0.9)', 9);

    // Signal-yellow unit badge
    ctx.fillStyle = c.signal;
    ctx.beginPath();
    ctx.roundRect(C - 36, 274, 72, 28, 3);
    ctx.fill();
    ctx.font = '700 20px Bahnschrift';
    ctx.fillStyle = '#111410';
    ctx.fillText(r.unit, C, 295);

    // 7. Bottom Survival Boost + White Health Bar HUD
    const barW = 224, barX = C - barW / 2;

    // Thin segmented orange boost bar (4 segments)
    for (let i = 0; i < 4; i++) {
      const segW = (barW - 9) / 4;
      ctx.fillStyle = i < Math.ceil(k * 4) ? c.signal : 'rgba(0,0,0,0.55)';
      ctx.fillRect(barX + i * (segW + 3), 340, segW, 6);
    }

    // Main white survival bar (fills with level k, turns red in high zone)
    ctx.fillStyle = 'rgba(10, 14, 12, 0.82)';
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(barX - 2, 351, barW + 4, 22);
    ctx.fillRect(barX - 2, 351, barW + 4, 22);

    const fillW = Math.max(6, barW * k);
    ctx.fillStyle = state.alarm || k > 0.85 ? ALARM : c.health;
    ctx.fillRect(barX, 353, fillW, 18);

    // Subtle red damage tail on the bar
    if (k < 0.96) {
      ctx.fillStyle = rgba(ALARM, 0.55);
      ctx.fillRect(barX + fillW, 353, Math.min(14, barW - fillW), 18);
    }

    // Telemetry Alive / RPM counter box
    ctx.font = '700 16px Bahnschrift';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(
      state.alarm ? 'OUTSIDE PLAYABLE THERMAL ZONE' : `PUMP ${pad4(state.pumpRpm)}   |   FAN ${pad4(fanAvg(state))}`,
      C,
      398
    );
  },
};
