// Fan and pump control: presets, custom curves and the safety rules every duty passes through.
// Curves map liquid temperature (degC) to duty (%), as piecewise-linear points [[temp, duty], ...].

export const PUMP_MIN = 70;          // never run a pump slower than this
export const FAN_MIN = 20;           // never run a fan slower than this
export const LIQUID_CRITICAL = 50;   // above this liquid temperature everything runs at 100 %
export const PUMP_STALL_RPM = 1000;  // pump below this (3 readings in a row) counts as stalled

export const PRESETS = {
  quiet: {
    label: 'Quiet',
    fans: [[25, 20], [30, 25], [34, 35], [38, 55], [42, 80], [45, 100]],
    pump: [[30, 70], [38, 80], [42, 100]],
  },
  balanced: {
    label: 'Balanced',
    fans: [[25, 30], [30, 40], [34, 50], [37, 60], [40, 75], [44, 100]],
    pump: [[30, 85], [38, 100]],
  },
  extreme: {
    label: 'Extreme',
    fans: [[25, 60], [32, 75], [36, 90], [40, 100]],
    pump: [[0, 100]],
  },
};

// piecewise-linear interpolation; points sorted by temperature
export function curve(points, x) {
  const p = [...points].sort((a, b) => a[0] - b[0]);
  if (!p.length) return 100;
  if (x <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    const [x0, y0] = p[i - 1], [x1, y1] = p[i];
    if (x <= x1) return x1 === x0 ? y1 : y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }
  return p[p.length - 1][1];
}

// Validate a user-supplied curve: 2-10 points, temps 0-100, duty 0-100, numbers only.
export function validCurve(points) {
  return Array.isArray(points) && points.length >= 2 && points.length <= 10 &&
    points.every(pt => Array.isArray(pt) && pt.length === 2 && pt.every(Number.isFinite) && pt[0] >= 0 && pt[0] <= 100 && pt[1] >= 0 && pt[1] <= 100);
}

// settings.cooling = { preset: 'balanced' | 'quiet' | 'extreme' | 'custom', custom: { fans: [...], pump: [...] } }
export function activeCurves(cooling = {}) {
  if (cooling.preset === 'custom' && validCurve(cooling.custom?.fans) && validCurve(cooling.custom?.pump)) return cooling.custom;
  return PRESETS[cooling.preset] || PRESETS.balanced;
}

// The single place where duties are decided. Returns { pump, fans, alarm }.
export function decideDuties({ liquid, pumpRpm, stallCount = 0 }, cooling) {
  const c = activeCurves(cooling);
  let pump = curve(c.pump, liquid ?? 100), fans = curve(c.fans, liquid ?? 100), alarm = null;
  if (liquid == null || !Number.isFinite(liquid)) alarm = 'no liquid temperature reading';
  else if (liquid > LIQUID_CRITICAL) alarm = `liquid ${liquid.toFixed(1)} °C is above ${LIQUID_CRITICAL} °C`;
  if (stallCount >= 3) alarm = `pump only ${pumpRpm ?? 0} rpm`;
  if (alarm) { pump = 100; fans = 100; }
  return { pump: Math.round(Math.max(PUMP_MIN, Math.min(100, pump))), fans: Math.round(Math.max(FAN_MIN, Math.min(100, fans))), alarm };
}
