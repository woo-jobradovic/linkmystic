# Security policy

LinkMystic talks to USB hardware that controls cooling, so safety and security bugs matter.

- **Report privately:** use *Security -> Report a vulnerability* on GitHub (private advisory). Please do not open a public issue for security problems.
- **Safety bugs** (a pump or fan running too slowly, safety rules not applied) are treated as security issues.
- Supported versions: the latest release only.

What LinkMystic does and does not do:
- It runs as a normal user (no administrator rights, no drivers, no services).
- It makes **no network connections**. The only links it opens are the GitHub repository and issues page, and only when you click them.
- The windows run sandboxed with context isolation and a strict Content Security Policy; all settings from the UI are validated before they reach any device.
- Settings, logs and LCD images stay in `%APPDATA%\LinkMystic`.

Verifying a download: every release installer is built by the public GitHub workflow and carries a build-provenance attestation. With the GitHub CLI: `gh attestation verify LinkMystic-Setup-<version>.exe --repo woo-jobradovic/linkmystic`. The release also lists SHA-256 checksums.
