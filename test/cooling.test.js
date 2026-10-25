import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, PUMP_MIN, FAN_MIN, curve, validCurve, activeCurves, decideDuties } from '../src/engine/cooling.js';
import { render, tempColor } from '../src/engine/effects.js';

test('curve interpolation and clamping at the ends', () => {
  const pts = [[30, 40], [40, 80]];
  assert.equal(curve(pts, 20), 40);
  assert.equal(curve(pts, 35), 60);
  assert.equal(curve(pts, 50), 80);
  assert.equal(curve([[40, 80], [30, 40]], 35), 60);   // unsorted input
});

test('every preset respects the safety floors at every temperature', () => {
  for (const name of Object.keys(PRESETS)) {
    for (let t = 0; t <= 60; t += 0.5) {
      const d = decideDuties({ liquid: t, pumpRpm: 2800 }, { preset: name });
      assert.ok(d.pump >= PUMP_MIN && d.pump <= 100, `${name} pump at ${t}`);
      assert.ok(d.fans >= FAN_MIN && d.fans <= 100, `${name} fans at ${t}`);
    }
  }
});

test('custom curves cannot go below the floors, invalid custom falls back to balanced', () => {
  const custom = { fans: [[20, 0], [60, 0]], pump: [[20, 0], [60, 10]] };
  const d = decideDuties({ liquid: 30, pumpRpm: 2800 }, { preset: 'custom', custom });
  assert.equal(d.pump, PUMP_MIN);
  assert.equal(d.fans, FAN_MIN);
  assert.equal(activeCurves({ preset: 'custom', custom: { fans: [[1, 2]] } }), PRESETS.balanced);
  assert.ok(!validCurve([[10, 200], [20, 30]]));
  assert.ok(!validCurve('nope'));
});

test('alarms force 100 %', () => {
  for (const state of [{ liquid: 51, pumpRpm: 2800 }, { liquid: null }, { liquid: 30, pumpRpm: 0, stallCount: 3 }]) {
    const d = decideDuties(state, { preset: 'quiet' });
    assert.equal(d.pump, 100);
    assert.equal(d.fans, 100);
    assert.ok(d.alarm);
  }
  assert.equal(decideDuties({ liquid: 35, pumpRpm: 2800, stallCount: 2 }, { preset: 'quiet' }).alarm, null);
});

test('effects: one full wheel per fan, temperature gradient', () => {
  const cfg = { effect: 'rainbow', color: '#00aaff', brightness: 100, period: 6, temp: { cool: 30, warm: 36, hot: 42 } };
  const fan = render(cfg, 35, 8, 0, 8);
  assert.deepEqual(fan[0], [255, 0, 0]);
  assert.notDeepEqual(fan[4], fan[0]);
  assert.deepEqual(tempColor(28, cfg.temp), [0, 255, 0]);
  assert.deepEqual(tempColor(36, cfg.temp), [255, 255, 0]);
  assert.deepEqual(tempColor(45, cfg.temp), [255, 0, 0]);
  assert.deepEqual(render({ ...cfg, effect: 'static', brightness: 50 }, 0, 1, 0)[0], [0, 85, 128]);
});
