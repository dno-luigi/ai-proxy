# ai-proxy - recovered production snapshot (v151)

**This repository is not a source baseline.** It records what was deployed.

- `bundle/worker.js` - exact deployed artifact, 36104 bytes, SHA-256 `94a4bd21c0bbd628a4d20e8e0e69ec9c016be208bc6a2f90289411ca881f7f8a`.
- Tag `recovered-v151` marks the commit holding that artifact.
- `src/parts/` - derived navigation split; `node src/assemble.mjs --check` reproduces the bundle exactly.
- `PROVENANCE.md` / `provenance.json` - version id, deploy time, compatibility date, retrieval
  method and timestamp, SHA-256, workers_dev flags, binding inventory.

Never regenerate `bundle/` from `src/parts/`. The bundle is authoritative; the split derives from it.
