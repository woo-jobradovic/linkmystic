// Engine process entry (Electron utilityProcess). Talks to the main process over parentPort:
//   in:  { type: 'start', settings, simulate } | { type: 'settings', settings } | { type: 'stop' }
//   in (LCD port): JPEG frames (Uint8Array)
//   out: { type: 'state', state } | { type: 'log', line } | { type: 'stopped' }
import { Engine } from './engine.js';

const port = process.parentPort;
let engine = null;
const send = msg => port.postMessage(msg);
const log = line => send({ type: 'log', line: `${new Date().toISOString()} ${line}` });

process.on('uncaughtException', e => { log(`engine error: ${e.stack || e.message}`); engine?.stop().finally(() => process.exit(1)); });
// a stray async error must never take cooling control down: log it and keep running
process.on('unhandledRejection', e => log(`engine warning (unhandled): ${e?.stack || e}`));

const MAX_FRAME = 512 * 1024;   // a 480x480 JPEG is ~40-80 KB

port.on('message', async ({ data, ports }) => {
  if (data?.type === 'start' && !engine) {
    engine = new Engine({ settings: data.settings, simulate: !!data.simulate, log, emit: (type, state) => send({ type, state }) });
    await engine.start().catch(e => log(`engine start failed: ${e.message}`));
    send({ type: 'state', state: engine.state() });
  } else if (data?.type === 'lcd-port' && ports?.[0]) {
    const lcdPort = ports[0];
    // every frame is answered with 'ack' once written or replaced: the LCD window renders the next one then,
    // so frames are paced by the screen itself and none are thrown away unevenly
    const ack = () => lcdPort.postMessage('ack');
    lcdPort.on('message', ({ data: frame }) => {
      // frames arrive as a copied Uint8Array (a transferred ArrayBuffer arrives as null through MessagePortMain)
      const jpg = frame instanceof Uint8Array ? frame : frame instanceof ArrayBuffer ? new Uint8Array(frame) : null;
      if (jpg && jpg.byteLength > 0 && jpg.byteLength <= MAX_FRAME && engine) engine.submitLcdFrame(jpg).catch(() => {}).finally(ack);
      else ack();
    });
    lcdPort.start();
  } else if (data?.type === 'settings' && engine) {
    await engine.applySettings(data.settings);
  } else if (data?.type === 'stop') {
    await engine?.stop();
    send({ type: 'stopped' });
    process.exit(0);
  }
});
