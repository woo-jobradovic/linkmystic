# Contributing

Thanks for helping LinkMystic support more hardware!

## The most helpful thing: test reports
Run LinkMystic, open **Logs -> Copy diagnostics** and open a *Device support* issue. Diagnostics are read-only and hide serial numbers.

## Code
- `src/engine/proto/`: pure packet builders and parsers (no USB). **Every byte sent to a device is built here and covered by `test/proto.test.js`.**
- `src/engine/devices.js`: USB transports only.
- `src/engine/cooling.js`: presets, curves and the safety rules. Changes here need a test.
- `src/engine/engine.js`: discovery and loops. `src/main/`: Electron shell. `src/renderer/`: UI. `src/lcd/`: LCD templates.

Rules for pull requests:
1. `npm run lint` and `npm test` must pass (CI checks both).
2. New device support needs byte-exact tests, and a statement of which real hardware it was verified on.
3. Never lower the safety floors (pump 70 %, fans 20 %, 50 °C liquid) without a discussion in an issue first.
4. Only write to a device that is identified exactly (vendor + product IDs, and for MSI the board allow-list). Unknown hardware stays read-only.
5. No code copied from GPL-incompatible or proprietary sources (including vendor software). Protocol facts are fine; please credit your sources.

By contributing you agree to license your work under GPL-3.0-or-later.
