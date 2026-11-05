# Reconstruction status - ai-proxy

Stage 1 - **recovered artifact** (complete, authoritative): `bundle/worker.js`, tag `recovered-v151`,
36104 bytes, SHA-256 `94a4bd21c0bbd628a4d20e8e0e69ec9c016be208bc6a2f90289411ca881f7f8a`.

Stage 2 - **readable navigation split** (complete, derived): 48 byte-exact segments split at
top-level declaration boundaries, with line ranges and per-part hashes in `src/parts.json`.
`node src/assemble.mjs --check` concatenates them and asserts byte equality with the bundle, so the
split cannot silently drift from the deployed artifact.

Stage 3 - **refactor into maintainable modules** (not started): requires behaviour-preserving
restructuring backed by tests. No equivalence is claimed until that suite exists; until then the
bundle remains the only authoritative statement of behaviour.
