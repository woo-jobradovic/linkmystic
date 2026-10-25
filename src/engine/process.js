// Engine process entry (Electron utilityProcess). Talks to the main process over parentPort:
//   in:  { type: 'start', settings, simulate } | { type: 'settings', settings } | { type: 'stop' }
//   in (LCD port): ArrayBuffer JPEG frames
//   out: { type: 'state', state } | { type: 'log', line } | { type: 'stopped' }
import { Engine } from './engine.js';

const port = process.parentPort;
let engine = null;
const send = msg => port.postMessage(msg);
const log = line => send({ type: 'log', line: `${new Date().toISOString()} ${line}` });

process.on('uncaughtException', e => { log(`engine error: ${e.stack || e.message}`); engine?.stop().finally(() => process.exit(1)); });

port.on('message', async ({ data, ports }) => {
  if (data?.type === 'start' && !engine) {
    engine = new Engine({ settings: data.settings, simulate: !!data.simulate, log, emit: (type, state) => send({ type, state }) });
    await engine.start().catch(e => log(`engine start failed: ${e.message}`));
    send({ type: 'state', state: engine.state() });
  } else if (data?.type === 'lcd-port' && ports?.[0]) {
    ports[0].on('message', ({ data: frame }) => { if (frame) engine?.submitLcdFrame(new Uint8Array(frame)); });
    ports[0].start();
  } else if (data?.type === 'settings' && engine) {
    await engine.applySettings(data.settings);
  } else if (data?.type === 'stop') {
    await engine?.stop();
    send({ type: 'stopped' });
    process.exit(0);
  }
});
