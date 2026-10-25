// LCD writer thread: owns the pump screen's USB handle, so frame writes never wait behind the hub's
// (synchronous) cooling and lighting traffic on the engine thread. One frame is written while at most one waits;
// a newer frame replaces the waiting one. Every frame gets an answer: written, replaced, or failed.
// Demo mode (workerData.simulate) runs the same queue with a 40 ms pretend write instead of USB.
import { parentPort, workerData } from 'node:worker_threads';
import * as D from './proto/lcd.js';

const simulate = !!workerData?.simulate;
let dev = null, waiting = null, busy = false;
const reply = m => parentPort.postMessage(m);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function write(jpg) {
  if (simulate) return sleep(40);
  for (const p of D.framePackets(jpg)) await dev.write(p);
}

async function drain() {
  busy = true;
  while (waiting) {
    const { id, jpg } = waiting; waiting = null;
    try { await write(jpg); reply({ id, result: 'written' }); }
    catch (e) { reply({ id, error: e.message }); }
  }
  busy = false;
}

parentPort.on('message', async m => {
  try {
    if (m.type === 'frame') {
      if (waiting) reply({ id: waiting.id, result: 'replaced' });
      waiting = { id: m.id, jpg: m.jpg };
      if (!busy) drain();
      return;
    }
    if (m.type === 'open') {
      if (!simulate) { const { default: HID } = await import('node-hid'); dev = await HID.HIDAsync.open(m.path); }
    } else if (m.type === 'brightness') {
      if (!simulate) await dev.sendFeatureReport(D.brightnessReport(m.pct));
    } else if (m.type === 'close') {
      if (waiting) { reply({ id: waiting.id, result: 'replaced' }); waiting = null; }
      const d = dev; dev = null;
      await d?.close();
    }
    reply({ id: m.id, result: 'ok' });
  } catch (e) { reply({ id: m.id, error: e.message }); }
});
