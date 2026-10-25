// LinkMystic UI. Talks to the main process only through window.lm (see src/main/preload.cjs).
import { draw, loadFonts, decodeImage, frameAt } from '../lcd/render.js';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lm = window.lm;
let S = await lm.getSettings();
let state = await lm.getState();
const { presets: PRESETS, PUMP_MIN, FAN_MIN, LIQUID_CRITICAL } = await lm.presets();
$('ver').textContent = `v${await lm.version()}`;

// ---------- saving (debounced) ----------
let pending = {}, saveTimer = null;
function save(patch) {
  for (const [k, v] of Object.entries(patch)) pending[k] = { ...(pending[k] || {}), ...v };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => { const p = pending; pending = {}; S = await lm.setSettings(p); renderAll(); }, 200);
}
const local = patch => { for (const [k, v] of Object.entries(patch)) S[k] = { ...S[k], ...v }; };

// ---------- tabs ----------
document.querySelectorAll('nav button[data-tab]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('nav button[data-tab]').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('section.tab').forEach(s => s.classList.toggle('on', s.id === `tab-${b.dataset.tab}`));
  if (b.dataset.tab === 'cool') drawCurve();
  if (b.dataset.tab === 'logs') loadLogs();
}));

// chip groups: <div class="chips" id=..><button data-v=..>
function chips(id, value, onPick) {
  const box = $(id);
  box.querySelectorAll('[data-v]').forEach(b => {
    b.classList.toggle('on', String(value) === b.dataset.v);
    b.onclick = () => onPick(b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : b.dataset.v);
  });
}

// ---------- dashboard ----------
const fmt = (v, d = 0, unit = '') => (Number.isFinite(v) ? `${v.toFixed(d)}${unit}` : '-');
function renderState() {
  const s = state;
  $('dLiquid').textContent = fmt(s.liquid, 1, ' °C');
  $('dPreset').textContent = `Cooling: ${S.cooling.preset === 'custom' ? 'Custom' : PRESETS[S.cooling.preset]?.label}`;
  $('dPump').textContent = fmt(s.pumpRpm, 0, ' rpm');
  $('dPumpDuty').textContent = s.duties?.pump != null ? `duty ${s.duties.pump}%` : '';
  const fan = s.fanRpm?.length ? s.fanRpm.reduce((a, b) => a + b, 0) / s.fanRpm.length : null;
  $('dFans').textContent = fmt(fan, 0, ' rpm');
  $('dFanDuty').textContent = s.duties?.fans != null ? `duty ${s.duties.fans}%` : '';
  $('dPsu').textContent = s.psu ? fmt(s.psu.powerOut, 0, ' W') : 'not found';
  $('dPsuSub').textContent = s.psu ? `${s.psu.model} | ${fmt(s.psu.tempVrm, 1, ' °C')} | fan ${fmt(s.psu.fanRpm, 0)} rpm` : '';
  const devs = (s.hubs || []).flatMap(h => h.devices);
  $('dLink').textContent = s.blocked?.corsair ? 'paused: other Corsair software is running' : devs.length ? `${s.hubs.length} hub(s), ${devs.length} devices` : 'no iCUE LINK hub found';
  $('dMsi').textContent = s.msi || '-';
  $('dLcd').textContent = s.lcdPresent ? `${s.lcd}${s.lcdFps ? `, ${s.lcdFps} fps` : ''}` : (s.lcd || 'not found');
  $('alarm').classList.toggle('show', !!s.alarm);
  $('alarm').textContent = s.alarm ? `ALARM: ${s.alarm}. Pump and fans are running at 100 %.` : '';
  const c = s.conflicts || [];
  $('conflict').classList.toggle('show', c.length > 0);
  $('conflict').textContent = c.length ? `Other RGB/fan software is running (${c.map(x => x.process).join(', ')}). LinkMystic leaves those devices alone until it is closed. Close it (and turn off its autostart) to let LinkMystic take over.` : '';
  $('demo').classList.toggle('show', !!s.simulate);
  renderDevices();
}
lm.onState(s => { state = s; renderState(); });

// ---------- lighting ----------
const EFFECTS = [['temperature', 'Temperature'], ['static', 'Static'], ['breathing', 'Breathing'], ['rainbow', 'Rainbow wave'], ['color-cycle', 'Colour cycle'], ['off', 'Off']];
$('effects').innerHTML = EFFECTS.map(([k, n]) => `<button class="chip" data-v="${k}">${n}</button>`).join('');
function renderLighting() {
  const L = S.lighting;
  chips('effects', L.effect, v => { local({ lighting: { effect: v } }); save({ lighting: { effect: v } }); renderLighting(); });
  $('lColor').value = L.color;
  $('lBright').value = L.brightness; $('lBrightV').textContent = `${Math.round(L.brightness)}%`;
  $('lSpeed').value = 31 - L.period; $('lSpeedV').textContent = `${L.period} s per cycle`;
  $('tCool').value = L.temp.cool; $('tWarm').value = L.temp.warm; $('tHot').value = L.temp.hot;
}
$('lColor').oninput = e => save({ lighting: { color: e.target.value } });
$('lBright').oninput = e => { $('lBrightV').textContent = `${e.target.value}%`; save({ lighting: { brightness: +e.target.value } }); };
$('lSpeed').oninput = e => { const p = 31 - e.target.value; $('lSpeedV').textContent = `${p} s per cycle`; save({ lighting: { period: p } }); };
for (const id of ['tCool', 'tWarm', 'tHot']) $(id).onchange = () => save({ lighting: { temp: { cool: +$('tCool').value, warm: +$('tWarm').value, hot: +$('tHot').value } } });

// ---------- cooling: presets + curve editor ----------
let curveKind = 'fans';
function curves() { return S.cooling.preset === 'custom' ? S.cooling.custom : PRESETS[S.cooling.preset]; }
function renderCooling() {
  const cards = [...Object.entries(PRESETS).map(([k, p]) => [k, p.label]), ['custom', 'Custom']];
  const desc = { quiet: 'Low noise, fans ramp late', balanced: 'Everyday default', extreme: 'Maximum cooling', custom: 'Your own curves' };
  $('presets').innerHTML = cards.map(([k, n]) => `<div class="preset${S.cooling.preset === k ? ' on' : ''}" data-p="${k}"><b>${n}</b><span>${desc[k]}</span></div>`).join('');
  $('presets').querySelectorAll('.preset').forEach(el => { el.onclick = () => { local({ cooling: { preset: el.dataset.p } }); save({ cooling: { preset: el.dataset.p } }); renderCooling(); drawCurve(); }; });
  document.querySelectorAll('[data-curve]').forEach(b => { b.classList.toggle('on', b.dataset.curve === curveKind); b.onclick = () => { curveKind = b.dataset.curve; renderCooling(); drawCurve(); }; });
  $('curveNote').textContent = 'Drag a point to change it, double-click to add one, right-click to remove one. Editing a preset turns it into your Custom curve. X = liquid temperature, Y = speed %.';
  $('safetyNote').textContent = `Safety (always on): pump never below ${PUMP_MIN}%, fans never below ${FAN_MIN}%, everything 100% above ${LIQUID_CRITICAL} °C liquid, if the temperature reading is lost, or if the pump stalls.`;
  $('safety').textContent = $('safetyNote').textContent;
}
const cv = $('curve'), cx = cv.getContext('2d');
const X0 = 50, X1 = 880, Y0 = 230, Y1 = 15, T0 = 20, T1 = 60;
const px = (t, d) => [X0 + (t - T0) / (T1 - T0) * (X1 - X0), Y0 - d / 100 * (Y0 - Y1)];
const fromPx = (x, y) => [Math.round(Math.max(T0, Math.min(T1, T0 + (x - X0) / (X1 - X0) * (T1 - T0)))), Math.round(Math.max(0, Math.min(100, (Y0 - y) / (Y0 - Y1) * 100)))];
function drawCurve() {
  const pts = [...curves()[curveKind]].sort((a, b) => a[0] - b[0]);
  const floor = curveKind === 'pump' ? PUMP_MIN : FAN_MIN;
  cx.clearRect(0, 0, cv.width, cv.height);
  cx.fillStyle = 'rgba(255,59,92,.10)'; const fy = px(T0, floor)[1]; cx.fillRect(X0, fy, X1 - X0, Y0 - fy);
  cx.strokeStyle = '#222833'; cx.fillStyle = '#6b7380'; cx.font = '12px Segoe UI'; cx.lineWidth = 1;
  for (let t = T0; t <= T1; t += 5) { const [x] = px(t, 0); cx.beginPath(); cx.moveTo(x, Y0); cx.lineTo(x, Y1); cx.stroke(); cx.fillText(`${t}°`, x - 8, Y0 + 18); }
  for (let d = 0; d <= 100; d += 25) { const [, y] = px(T0, d); cx.beginPath(); cx.moveTo(X0, y); cx.lineTo(X1, y); cx.stroke(); cx.fillText(`${d}%`, 10, y + 4); }
  cx.strokeStyle = '#fcee0a'; cx.lineWidth = 3; cx.beginPath();
  pts.forEach(([t, d], i) => { const [x, y] = px(t, Math.max(floor, d)); if (i) cx.lineTo(x, y); else cx.moveTo(X0, y), cx.lineTo(x, y); });
  cx.lineTo(X1, px(T0, Math.max(floor, pts.at(-1)[1]))[1]); cx.stroke();
  for (const [t, d] of pts) { const [x, y] = px(t, d); cx.fillStyle = '#00f0ff'; cx.beginPath(); cx.arc(x, y, 7, 0, Math.PI * 2); cx.fill(); }
  if (Number.isFinite(state.liquid)) { const [x] = px(state.liquid, 0); cx.strokeStyle = 'rgba(0,240,255,.5)'; cx.setLineDash([4, 4]); cx.beginPath(); cx.moveTo(x, Y0); cx.lineTo(x, Y1); cx.stroke(); cx.setLineDash([]); }
  $('curveTitle').textContent = `${curveKind === 'pump' ? 'Pump' : 'Fan'} curve (${S.cooling.preset === 'custom' ? 'Custom' : PRESETS[S.cooling.preset].label})`;
}
function editCurve(mutate) {
  const custom = structuredClone(curves());
  const c = { fans: custom.fans.map(p => [...p]), pump: custom.pump.map(p => [...p]) };
  mutate(c[curveKind]);
  c[curveKind].sort((a, b) => a[0] - b[0]);
  local({ cooling: { preset: 'custom', custom: c } });
  save({ cooling: { preset: 'custom', custom: c } });
  renderCooling(); drawCurve();
}
const canvasPos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
const nearest = (x, y) => { const pts = curves()[curveKind]; let best = -1, dist = 14; pts.forEach(([t, d], i) => { const [px0, py0] = px(t, d); const k = Math.hypot(px0 - x, py0 - y); if (k < dist) { dist = k; best = i; } }); return best; };
let dragIdx = -1;
cv.addEventListener('mousedown', e => { if (e.button !== 0) return; const [x, y] = canvasPos(e); const i = nearest(x, y); if (i >= 0) { dragIdx = i; editCurve(() => {}); } });
cv.addEventListener('mousemove', e => {
  if (dragIdx < 0) return;
  const [x, y] = canvasPos(e);
  const pts = S.cooling.custom[curveKind];
  pts[dragIdx] = fromPx(x, y);
  drawCurve();
});
window.addEventListener('mouseup', () => { if (dragIdx >= 0) { dragIdx = -1; editCurve(() => {}); } });
cv.addEventListener('dblclick', e => { const [x, y] = canvasPos(e); editCurve(p => { if (p.length < 10) p.push(fromPx(x, y)); }); });
cv.addEventListener('contextmenu', e => { e.preventDefault(); const [x, y] = canvasPos(e); const i = nearest(x, y); editCurve(p => { if (i >= 0 && p.length > 2) p.splice(i, 1); }); });

// ---------- LCD ----------
await loadFonts('../../assets/fonts');
let lcdFrames = null, lcdImage = null;
async function loadLcdImage() {
  if (S.lcd.image === lcdImage) return;
  lcdImage = S.lcd.image;
  const img = lcdImage ? await lm.getLcdImage(lcdImage) : null;
  lcdFrames = img ? await decodeImage(img.data, img.type).catch(() => null) : null;
}
function renderLcd() {
  const D = S.lcd;
  chips('lcdOnOff', D.enabled, v => save({ lcd: { enabled: v } }));
  chips('lcdTemplate', D.template, v => save({ lcd: { template: v } }));
  chips('lcdMetric', D.metric, v => save({ lcd: { metric: v } }));
  $('lcdMin').value = D.min; $('lcdMax').value = D.max; $('lcdAccent').value = D.accent;
  $('lcdBright').value = D.brightness; $('lcdBrightV').textContent = `${D.brightness}%`;
  $('lcdFps').value = D.fps; $('lcdFpsV').textContent = `${D.fps}`;
  $('imgRow').style.display = D.template === 'image' ? '' : 'none';
  $('lcdImgName').textContent = D.image ? 'image loaded' : 'no image chosen';
  loadLcdImage();
}
$('lcdMin').onchange = () => save({ lcd: { min: +$('lcdMin').value, max: +$('lcdMax').value } });
$('lcdMax').onchange = () => save({ lcd: { min: +$('lcdMin').value, max: +$('lcdMax').value } });
$('lcdAccent').oninput = e => save({ lcd: { accent: e.target.value } });
$('lcdBright').oninput = e => { $('lcdBrightV').textContent = `${e.target.value}%`; save({ lcd: { brightness: +e.target.value } }); };
$('lcdFps').oninput = e => { $('lcdFpsV').textContent = e.target.value; save({ lcd: { fps: +e.target.value } }); };
$('lcdPick').onclick = async () => { const name = await lm.pickLcdImage(); if (name) save({ lcd: { image: name, template: 'image' } }); };
const pctx = $('lcdPreview').getContext('2d');
const tStart = performance.now();
(function preview() {
  if ($('tab-lcd').classList.contains('on')) { const t = (performance.now() - tStart) / 1000; draw(pctx, state, S.lcd, t, S.lcd.template === 'image' ? frameAt(lcdFrames, t) : null); }
  requestAnimationFrame(preview);
})();

// ---------- MSI board ----------
const STYLES = [['colorring', 'Color Ring'], ['wave', 'Wave'], ['flame', 'Flame'], ['meteor', 'Meteor'], ['lightning', 'Lightning'], ['breathing', 'Breathing']];
function renderMsi() {
  const M = S.msi;
  $('msiBoard').textContent = state.board?.product ? `Motherboard: ${state.board.product} - ${state.msiSupported ? 'supported' : 'not on the supported list (LinkMystic will not write to it)'}` : '';
  chips('msiMode', M.mode, v => save({ msi: { mode: v } }));
  $('msiHeaders').innerHTML = ['JARGB1', 'JARGB2', 'JARGB3', 'JAF'].map(h => {
    const used = M.headers[h] != null;
    return `<tr><td>${h}</td><td><input type="checkbox" data-h="${h}" data-k="used"${used ? ' checked' : ''}></td>
      <td><input type="number" min="1" max="240" data-h="${h}" data-k="leds" value="${M.headers[h] ?? 12}"${used ? '' : ' disabled'}></td>
      <td><input type="checkbox" data-h="${h}" data-k="direct"${M.directHeaders.includes(h) ? ' checked' : ''}${used ? '' : ' disabled'}></td>
      <td><select data-h="${h}" data-k="style"${used ? '' : ' disabled'}>${STYLES.map(([k, n]) => `<option value="${k}"${(M.style[h] || 'colorring') === k ? ' selected' : ''}>${n}</option>`).join('')}</select></td></tr>`;
  }).join('');
  $('msiHeaders').querySelectorAll('[data-h]').forEach(el => {
    el.onchange = () => {
      const h = el.dataset.h, headers = { ...S.msi.headers };
      let directHeaders = [...S.msi.directHeaders]; const style = { ...S.msi.style };
      if (el.dataset.k === 'used') { if (el.checked) headers[h] = 12; else delete headers[h]; }
      if (el.dataset.k === 'leds') headers[h] = Math.max(1, Math.min(240, Math.round(+el.value || 12)));
      if (el.dataset.k === 'direct') directHeaders = el.checked ? [...new Set([...directHeaders, h])] : directHeaders.filter(x => x !== h);
      if (el.dataset.k === 'style') style[h] = el.value;
      S.msi = { ...S.msi, headers, directHeaders, style };
      save({ msi: { headers, directHeaders, style } });
    };
  });
}

// ---------- devices ----------
function renderDevices() {
  const rows = (state.hubs || []).flatMap((h, i) => h.devices.map(d => `<tr><td>${i + 1} (fw ${esc(h.firmware)})</td><td>${esc(d.channel)}</td><td>${esc(d.name)}</td><td>${esc(d.kind)}</td><td>${esc(d.leds)}</td><td>${esc(d.rpm ?? '-')}</td></tr>`));
  $('devTable').innerHTML = rows.join('') || '<tr><td colspan="6">No iCUE LINK devices found.</td></tr>';
  const p = state.psu;
  $('psuTable').innerHTML = p ? [
    ['Model', p.model], ['Total output', fmt(p.powerOut, 0, ' W')], ['VRM / case temperature', `${fmt(p.tempVrm, 1, ' °C')} / ${fmt(p.tempCase, 1, ' °C')}`],
    ['Fan', fmt(p.fanRpm, 0, ' rpm')], ['Input', fmt(p.inputVolts, 0, ' V')],
    ...Object.entries(p.rails || {}).map(([n, r]) => [n, `${fmt(r.volts, 2, ' V')} | ${fmt(r.amps, 1, ' A')} | ${fmt(r.watts, 0, ' W')}`]),
  ].map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('') : '<tr><td>No Corsair HXi/RMi power supply found.</td></tr>';
}

// ---------- logs + settings ----------
async function loadLogs() { $('log').textContent = (await lm.getLogs()).join('\n'); $('log').scrollTop = 1e9; }
lm.onLog(line => { const el = $('log'); el.textContent += `\n${line}`; if (el.textContent.length > 300000) el.textContent = el.textContent.slice(-200000); el.scrollTop = 1e9; });
$('diag').onclick = async () => { await lm.diagnostics(); $('diag').textContent = 'Copied to clipboard'; setTimeout(() => { $('diag').textContent = 'Copy diagnostics'; }, 2500); };
$('openLogs').onclick = () => lm.openLogsFolder();
$('report').onclick = () => lm.openExternal('issues');
$('repo').onclick = e => { e.preventDefault(); lm.openExternal('repo'); };
$('quit').onclick = () => lm.quit();
function renderSettings() {
  chips('sAuto', S.app.startWithWindows, v => save({ app: { startWithWindows: v } }));
  chips('sMin', S.app.startMinimized, v => save({ app: { startMinimized: v } }));
}

function renderAll() { renderLighting(); renderCooling(); renderLcd(); renderMsi(); renderSettings(); renderState(); drawCurve(); }
renderAll();
