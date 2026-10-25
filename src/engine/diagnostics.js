// Read-only diagnostics for bug reports: lists relevant USB HID devices, the motherboard and conflicting software.
// Never writes to any device. Serial numbers are redacted. Usable from the app ("Copy diagnostics") or the CLI:
//   node src/engine/diagnostics.js
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { listHid, match } from './devices.js';
import { baseboard, conflicts } from './system.js';
import { isSupportedBoard } from './proto/msi.js';

const VENDORS = new Set([0x1b1c, 0x0db0, 0x1462]);
const h4 = n => n.toString(16).padStart(4, '0');

export async function diagnostics(version = 'dev', engineState = null) {
  const [hid, board, conf] = await Promise.all([listHid(), baseboard(), conflicts()]);
  const lines = [
    `LinkMystic ${version} diagnostics`,
    `Windows ${os.release()} (${os.arch()})`,
    `Motherboard: ${board.manufacturer} | ${board.product} | MSI 761 supported: ${isSupportedBoard(board.product) ? 'yes' : 'no'}`,
    `Conflicting software running: ${conf.length ? conf.map(c => c.process).join(', ') : 'none'}`,
    '',
    'USB HID devices (Corsair / MSI):',
  ];
  for (const d of hid.filter(x => VENDORS.has(x.vendorId))) {
    const role = match.linkHub(d) ? 'LINK hub' : match.lcd(d) ? 'pump LCD' : match.psu(d) ? 'PSU' : match.msi(d) ? 'MSI 761 controller' : 'not used';
    lines.push(`  ${h4(d.vendorId)}:${h4(d.productId)} if${d.interface} page ${h4(d.usagePage ?? 0)} usage ${h4(d.usage ?? 0)} | ${d.manufacturer ?? ''} ${d.product ?? ''} | ${role}`);
  }
  if (engineState) {
    lines.push('', 'Engine:');
    for (const [i, h] of (engineState.hubs || []).entries()) {
      lines.push(`  hub ${i + 1} firmware ${h.firmware}`);
      for (const d of h.devices) lines.push(`    ch ${d.channel}: ${d.name} [${d.kind}] leds ${d.leds} rpm ${d.rpm ?? '-'}`);
    }
    lines.push(`  liquid ${engineState.liquid ?? '-'} C, alarm ${engineState.alarm ?? 'none'}, MSI ${engineState.msi}, LCD ${engineState.lcd}`);
  }
  return lines.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) diagnostics().then(t => console.log(t));
