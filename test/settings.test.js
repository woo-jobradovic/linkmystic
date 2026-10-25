import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, sanitize, update } from '../src/engine/settings.js';

test('defaults survive sanitize unchanged', () => {
  assert.deepEqual(sanitize(DEFAULTS), sanitize(sanitize(DEFAULTS)));
});

test('out-of-range and wrong-type values are clamped or replaced', () => {
  const s = sanitize({
    lighting: { effect: 'hack', color: 'red', brightness: 500, period: -3, temp: { cool: 80, warm: 10, hot: 5 } },
    msi: { mode: 'flash-firmware', headers: { JARGB1: 9999, BOGUS: 5 }, directHeaders: ['JAF', 'X'], style: { JAF: 'direct', JARGB1: 'wave' }, waveLeds: 1 },
    lcd: { fps: 999, image: '..\\..\\evil.exe', template: 'x', min: 10, max: 11 },
    app: { startWithWindows: 'yes' },
  });
  assert.equal(s.lighting.effect, DEFAULTS.lighting.effect);
  assert.equal(s.lighting.color, DEFAULTS.lighting.color);
  assert.equal(s.lighting.brightness, 100);
  assert.equal(s.lighting.period, 1);
  assert.ok(s.lighting.temp.cool < s.lighting.temp.warm && s.lighting.temp.warm < s.lighting.temp.hot);
  assert.equal(s.msi.mode, DEFAULTS.msi.mode);
  assert.deepEqual(s.msi.headers, { JARGB1: 240 });
  assert.deepEqual(s.msi.directHeaders, ['JAF']);
  assert.deepEqual(s.msi.style, { JARGB1: 'wave' });          // 'direct' is never a built-in style
  assert.equal(s.msi.waveLeds, 4);
  assert.equal(s.lcd.fps, 30);
  assert.equal(s.lcd.image, DEFAULTS.lcd.image);              // path tricks rejected
  assert.equal(s.lcd.template, DEFAULTS.lcd.template);
  assert.ok(s.lcd.max >= s.lcd.min + 5);
  assert.equal(s.app.startWithWindows, DEFAULTS.app.startWithWindows);
});

test('invalid custom curves fall back, valid ones are kept', () => {
  const bad = sanitize({ cooling: { preset: 'custom', custom: { fans: [[30, 50]], pump: 'x' } } });
  assert.deepEqual(bad.cooling.custom, DEFAULTS.cooling.custom);
  const good = sanitize({ cooling: { preset: 'custom', custom: { fans: [[25, 30], [45, 100]], pump: [[25, 80], [40, 100]] } } });
  assert.deepEqual(good.cooling.custom.fans, [[25, 30], [45, 100]]);
});

test('partial updates merge and unknown sections are ignored', () => {
  const s = update(sanitize(DEFAULTS), { lighting: { effect: 'static' }, evil: { x: 1 }, cooling: null });
  assert.equal(s.lighting.effect, 'static');
  assert.equal(s.lighting.color, DEFAULTS.lighting.color);
  assert.ok(!('evil' in s));
});

test('lcd range: string or out-of-range min never yields NaN or max below min + 5', () => {
  for (const lcd of [{ min: 'abc', max: 60 }, { min: -10, max: 2 }, { min: 200, max: 10 }, { min: 30, max: 'x' }]) {
    const s = sanitize({ lcd });
    assert.ok(Number.isFinite(s.lcd.min) && Number.isFinite(s.lcd.max), JSON.stringify(lcd));
    assert.ok(s.lcd.max >= s.lcd.min + 5, JSON.stringify(lcd));
  }
});

test('all MSI headers can be switched off', () => {
  const s = update(sanitize(DEFAULTS), { msi: { headers: {} } });
  assert.deepEqual(s.msi.headers, {});
});
