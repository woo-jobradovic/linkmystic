// Windows facts the engine needs: motherboard model, and other RGB/fan software that would fight us for a device.
import { execFile } from 'node:child_process';

const run = (file, args) => new Promise(resolve => {
  execFile(file, args, { windowsHide: true, timeout: 15000 }, (err, stdout) => resolve(err ? '' : String(stdout)));
});

export async function baseboard() {
  const out = await run('powershell.exe', ['-NoProfile', '-Command', '$b = Get-CimInstance Win32_BaseBoard; "$($b.Manufacturer)|$($b.Product)"']);
  const [manufacturer = '', product = ''] = out.trim().split('|');
  return { manufacturer: manufacturer.trim(), product: product.trim() };
}

// process name (lower case, no .exe) -> which device family it would conflict with
const CONFLICTS = {
  icue: 'corsair', 'corsair.service': 'corsair', icuedevicepluginhost: 'corsair',
  ledkeeper2: 'msi', mystic_light_service: 'msi', lightkeeperservice: 'msi',
  signalrgb: 'both', openrgb: 'both', fancontrol: 'corsair', openlinkhub: 'corsair',
};
// Returns null when the process list could not be read: callers must then keep their previous decision.
export async function conflicts() {
  const out = await run('tasklist.exe', ['/fo', 'csv', '/nh']);
  if (!out.trim()) return null;
  const found = new Map();
  for (const line of out.split(/\r?\n/)) {
    const name = (line.split('","')[0] || '').replace(/^"/, '').replace(/\.exe$/i, '').toLowerCase();
    if (Object.hasOwn(CONFLICTS, name)) found.set(name, CONFLICTS[name]);
  }
  return [...found].map(([process, family]) => ({ process, family }));
}
