# Third-party notices

LinkMystic is licensed under the GNU General Public License v3.0 or later (see `LICENSE`). It includes or uses:

| Component | Licence | Use |
|---|---|---|
| [Electron](https://www.electronjs.org) (includes Chromium and Node.js) | MIT; Chromium/Node licences ship in the installer as `LICENSES.chromium.html` | application shell |
| [node-hid](https://github.com/node-hid/node-hid) | MIT or X11 (`assets/licenses/node-hid-LICENSE.txt`) | USB HID access |
| [hidapi](https://github.com/libusb/hidapi) (inside node-hid) | BSD-style, used under the BSD licence option (`assets/licenses/hidapi-LICENSE-bsd.txt`) | USB HID access |
| [Orbitron](https://github.com/theleagueof/orbitron) font | SIL Open Font License 1.1 (`assets/fonts/Orbitron-OFL.txt`) | LCD and UI display font; `Orbitron.ttf` sha256 f42db2dd16e642258e35782916eceb1dcdbea06fb958d77ad71dc5963587e8fd |
| [Share Tech Mono](https://fonts.google.com/specimen/Share+Tech+Mono) font | SIL Open Font License 1.1 (`assets/fonts/ShareTechMono-OFL.txt`) | LCD HUD font; `ShareTechMono.ttf` sha256 9ceab1f87414829af259c0f537573ae03ef7dd3147c0b27a36a1a0beb6732677 |

## Protocol knowledge
No code from these projects is copied verbatim; LinkMystic implements the protocols from the facts they document. We are grateful to:
- **OpenRGB** (GPL-2.0-or-later): iCUE LINK and MSI "761" controller protocols. Its MSI direct mode credits SignalRGB.
- **OpenLinkHub** (GPL-3.0): iCUE LINK speeds, temperatures, LCD transfer and pump safety practice.
- **liquidctl** (GPL-3.0): Corsair HXi/RMi PSU protocol and PMBus decoding.
- **SignalRGB**: MSI "761" direct mode, via OpenRGB.

LinkMystic contains no code, firmware or files from Corsair or MSI.
