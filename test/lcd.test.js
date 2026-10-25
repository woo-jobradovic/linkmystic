// Pump LCD: the writer thread's one-waiting-frame queue, and per-theme settings with their defaults.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LcdScreen } from '../src/engine/devices.js';
import { DEFAULTS, sanitize, update } from '../src/engine/settings.js';
import { THEMES, THEME_FIELDS } from '../src/lcd/themes.js';

const frame = n => new Uint8Array(1000).fill(n);

test('the writer thread writes the current frame, keeps the newest waiting one and answers every frame', async () => {
  const lcd = await LcdScreen.open({ path: 'demo' }, { simulate: true });
  try {
    await lcd.brightness(50);
    const results = await Promise.all([lcd.show(frame(1)), lcd.show(frame(2)), lcd.show(frame(3))]);
    assert.deepEqual(results, [true, false, true]);   // 1 written, 2 replaced by 3, 3 written
    assert.equal(await lcd.show(frame(4)), true);
  } finally { await lcd.close(); }
  await assert.rejects(lcd.show(frame(5)), /LCD writer stopped/);
});

test('a frame handed to the screen is copied, so the caller can reuse its buffer', async () => {
  const lcd = await LcdScreen.open({ path: 'demo' }, { simulate: true });
  const f = frame(7);
  try { await lcd.show(f); } finally { await lcd.close(); }
  assert.equal(f.byteLength, 1000);
});

test('every theme has defaults for every field the LCD tab shows', () => {
  for (const [name, F] of Object.entries(THEME_FIELDS)) {
    for (const [k] of F.colors) assert.match(THEMES[name].colors[k], /^#[0-9a-f]{6}$/, `${name}.${k}`);
    for (const [k] of F.animations) assert.equal(typeof THEMES[name].animations[k], 'boolean', `${name}.${k}`);
  }
  assert.deepEqual(sanitize(DEFAULTS).lcd.themes, THEMES);
});

test('theme settings are validated per field and kept per theme', () => {
  const s = sanitize({ lcd: { themes: { cyberpunk: { colors: { number: '#ABCDEF', detail: 'red' }, animations: { glitch: false, scanlines: 'no' } }, minimal: { colors: { track: '#010203' } }, evil: { x: 1 } } } });
  assert.equal(s.lcd.themes.cyberpunk.colors.number, '#abcdef');
  assert.equal(s.lcd.themes.cyberpunk.colors.detail, THEMES.cyberpunk.colors.detail);
  assert.equal(s.lcd.themes.cyberpunk.animations.glitch, false);
  assert.equal(s.lcd.themes.cyberpunk.animations.scanlines, true);
  assert.equal(s.lcd.themes.minimal.colors.track, '#010203');
  assert.equal(s.lcd.themes.minimal.colors.number, THEMES.minimal.colors.number);
  assert.ok(!('evil' in s.lcd.themes));
  // restoring = sending the defaults back
  const restored = update(s, { lcd: { themes: { ...s.lcd.themes, cyberpunk: structuredClone(THEMES.cyberpunk) } } });
  assert.deepEqual(restored.lcd.themes.cyberpunk, THEMES.cyberpunk);
  assert.equal(restored.lcd.themes.minimal.colors.track, '#010203');
});

test('the old single number color carries over to the Cyberpunk theme', () => {
  const s = sanitize({ lcd: { accent: '#123456' } });
  assert.equal(s.lcd.themes.cyberpunk.colors.number, '#123456');
  assert.ok(!('accent' in s.lcd));
});

test('every theme file is registered, with a unique id, a name, a blurb, valid defaults and a draw function', async () => {
  const { THEME_LIST, THEME_IDS } = await import('../src/lcd/themes.js');
  const fs = await import('node:fs');
  const files = fs.readdirSync(new URL('../src/lcd/themes/', import.meta.url)).filter(f => f.endsWith('.js') && f !== 'common.js').map(f => f.slice(0, -3));
  assert.deepEqual([...files].sort(), [...THEME_IDS].sort());
  assert.equal(new Set(THEME_IDS).size, THEME_IDS.length);
  for (const t of THEME_LIST) {
    assert.ok(t.name && t.blurb && typeof t.draw === 'function', t.id);
    for (const [k, label, d] of t.colors) assert.ok(k && label && /^#[0-9a-f]{6}$/.test(d), `${t.id}.${k}`);
    for (const [k, label, d] of t.animations) assert.ok(k && label && typeof d === 'boolean', `${t.id}.${k}`);
    assert.equal(sanitize({ lcd: { template: t.id } }).lcd.template, t.id);
  }
  assert.equal(sanitize({ lcd: { template: 'image' } }).lcd.template, 'image');
  assert.equal(sanitize({ lcd: { template: 'nope' } }).lcd.template, DEFAULTS.lcd.template);
});
