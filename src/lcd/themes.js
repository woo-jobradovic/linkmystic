// LCD theme registry. Each theme module (./themes/*.js) declares its name, colors and animations (with defaults)
// and its draw function; this file derives the defaults and the LCD tab's labels from them, so settings validation,
// the renderer, "Restore theme defaults" and the UI always agree. Add a theme: write the module, list it here.
import cyberpunk from './themes/cyberpunk.js';
import minimal from './themes/minimal.js';
import tactical from './themes/tactical.js';
import ancient from './themes/ancient.js';
import battlezone from './themes/battlezone.js';
import runeward from './themes/runeward.js';
import pixel from './themes/pixel.js';
import sunset from './themes/sunset.js';
import nightvision from './themes/nightvision.js';
import storm from './themes/storm.js';
import ethereal from './themes/ethereal.js';
import arena from './themes/arena.js';
import realm from './themes/realm.js';

// order = the dropdown order
export const THEME_LIST = [cyberpunk, minimal, tactical, ancient, battlezone, runeward, pixel, sunset, nightvision, storm, ethereal, arena, realm];
export const THEME_IDS = THEME_LIST.map(t => t.id);
export const themeById = id => THEME_LIST.find(t => t.id === id);

export const THEMES = Object.fromEntries(THEME_LIST.map(t => [t.id, {
  colors: Object.fromEntries(t.colors.map(([k, , d]) => [k, d])),
  animations: Object.fromEntries(t.animations.map(([k, , d]) => [k, d])),
}]));

export const THEME_FIELDS = Object.fromEntries(THEME_LIST.map(t => [t.id, {
  name: t.name,
  blurb: t.blurb,
  colors: t.colors.map(([k, n]) => [k, n]),
  animations: t.animations.map(([k, n]) => [k, n]),
}]));

export const themeDefaults = () => structuredClone(THEMES);
