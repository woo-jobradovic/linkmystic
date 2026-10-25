// Lighting effects: valid colors from every effect, direction, own temperature colors, settings validation,
// the MSI direction bit, and the LCD switching dark instantly instead of being released.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render, EFFECT_IDS, EFFECT_USES, tempColor } from '../src/engine/effects.js';
import { DEFAULTS, sanitize, update } from '../src/engine/settings.js';
import { headerRow, MODES } from '../src/engine/proto/msi.js';
import { Engine } from '../src/engine/engine.js';

const base = { ...DEFAULTS.lighting, color: '#ff8000' };

test('every effect gives valid colors for every LED at any time', () => {
  for (const effect of EFFECT_IDS) {
    for (const t of [0, 0.37, 2.5, 123.4]) {
      const out = render({ ...base, effect }, 37, 24, t, 8, 0.5);
      assert.equal(out.length, 24, effect);
      for (const c of out) assert.ok(c.length === 3 && c.every(x => Number.isInteger(x) && x >= 0 && x <= 255), `${effect} ${c}`);
    }
  }
});

test('every effect lists the settings it uses (the UI hides the rest)', () => {
  for (const effect of EFFECT_IDS) assert.ok(Array.isArray(EFFECT_USES[effect]), effect);
});

test('effects without a color setting ignore the color', () => {
  for (const effect of EFFECT_IDS.filter(e => !EFFECT_USES[e].includes('color'))) {
    const a = render({ ...base, effect, color: '#ff0000' }, 40, 8, 1.3, 8);
    const b = render({ ...base, effect, color: '#0000ff' }, 40, 8, 1.3, 8);
    assert.deepEqual(a, b, effect);
  }
});

test('counter-clockwise runs the same animation backwards', () => {
  for (const effect of ['rainbow', 'spiral-rainbow', 'color-wave']) {
    const cw = render({ ...base, effect, direction: 'cw' }, 0, 8, -1.7, 8);
    const ccw = render({ ...base, effect, direction: 'ccw' }, 0, 8, 1.7, 8);
    assert.deepEqual(cw, ccw, effect);
  }
});

test('the spiral puts each wheel a quarter turn behind the previous one', () => {
  const cfg = { ...base, effect: 'spiral-rainbow' };
  const strip = render(cfg, 0, 16, 2, 8);            // two wheels in one strip
  assert.deepEqual(strip.slice(8), render(cfg, 0, 8, 2, 8, 0.25));
  assert.notDeepEqual(strip.slice(0, 8), strip.slice(8));
});

test('breathing fades close to dark at its lowest point (gamma-corrected)', () => {
  const cfg = { ...base, effect: 'breathing', color: '#ffffff', period: 4 };
  assert.ok(render(cfg, 0, 1, 0)[0][0] < 20);        // trough
  assert.equal(render(cfg, 0, 1, 2)[0][0], 255);     // peak
});

test('temperature uses the chosen colors', () => {
  const colors = { cool: '#0000ff', warm: '#ff00ff', hot: '#ffffff' };
  const temp = { cool: 30, warm: 36, hot: 42 };
  assert.deepEqual(tempColor(25, temp, colors), [0, 0, 255]);
  assert.deepEqual(tempColor(36, temp, colors), [255, 0, 255]);
  assert.deepEqual(tempColor(50, temp, colors), [255, 255, 255]);
  assert.deepEqual(render({ ...base, effect: 'temperature', tempColors: colors }, 50, 1, 0)[0], [255, 255, 255]);
});

test('direction and temperature colors are validated', () => {
  const s = sanitize({ lighting: { direction: 'sideways', tempColors: { cool: 'blue', warm: '#ABCDEF', hot: 5 } } });
  assert.equal(s.lighting.direction, 'cw');
  assert.deepEqual(s.lighting.tempColors, { cool: DEFAULTS.lighting.tempColors.cool, warm: '#abcdef', hot: DEFAULTS.lighting.tempColors.hot });
  assert.equal(update(s, { lighting: { direction: 'ccw' } }).lighting.direction, 'ccw');
  assert.equal(sanitize({ lighting: { effect: 'visor' } }).lighting.effect, 'visor');
});

test('MSI built-in rows carry the direction bit only when reversed', () => {
  const fwd = headerRow({ mode: MODES.colorring, rainbow: true, speed: 1, brightness: 100 }, 12);
  const rev = headerRow({ mode: MODES.colorring, rainbow: true, speed: 1, brightness: 100, reverse: true }, 12);
  assert.equal(fwd[14] & 0x40, 0);
  assert.equal(rev[14] & 0x40, 0x40);
  assert.equal(rev[14] & ~0x40, fwd[14]);
});

test('switching the LCD off turns the backlight off at once and keeps the screen', async () => {
  const e = new Engine({ settings: sanitize(DEFAULTS), simulate: true });
  const calls = [];
  e.lcd = { brightness: async p => calls.push(p), show: async () => {}, close: () => calls.push('closed') };
  await e.applySettings(update(e.settings, { lcd: { enabled: false } }));
  assert.deepEqual(calls, [0]);
  assert.equal(e.live.lcd, 'off (screen dark)');
  await e.applySettings(update(e.settings, { lcd: { enabled: true } }));
  assert.deepEqual(calls, [0, DEFAULTS.lcd.brightness]);
  assert.ok(e.lcd);
  await e.applySettings(update(e.settings, { lcd: { enabled: false } }));
  await e.stop();
  assert.deepEqual(calls, [0, DEFAULTS.lcd.brightness, 0, DEFAULTS.lcd.brightness, 'closed']);   // quitting restores the backlight
});
