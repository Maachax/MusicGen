# Roadmap

Fixes and improvements identified during the July 2026 code review, ordered by
impact. Each item lists the affected file(s) so it can be tackled independently.

---

## Phase 1 — Crash & audible bug fixes (small, high impact)

- [x] **Fix `ReferenceError` in `regenerateInstruments()`**
  `audio/synths.js:219` — `debugLog && debugLog(...)` references an undeclared
  identifier, so every `engine.regenerateAll()` call throws after swapping
  oscillators but before patterns/indices/BPM are reset.
  Fix: remove the line (or guard with `typeof debugLog === "function"`).

- [x] **Fix 100-measure "immediate" drift ramp**
  `audio/parameterDrift.js:58` — `rampM = 100` (leftover test value; the
  comment says 0.5 measure). At 100 BPM the first drift ramp lasts ~4 minutes,
  so drift is effectively frozen on startup.
  Fix: `rampM = 0.5`.

- [x] **Make note durations track BPM**
  `core/musicEngine.js:57` — `STEP_DURATION_SECONDS` is computed once at
  engine creation, before the configured BPM is applied and never after
  `setBpm()`. Arp sustain lengths are wrong from the start.
  Fix: compute step duration inside the loop callback (or recompute on BPM
  changes).

- [x] **Fix degree distribution in `randomDegreeProgression()`**
  `utils/randomDegreeProgression.js:4` — `Math.floor(Math.random() * (1 - 7) + 7)`
  makes degree 7 unreachable.
  Fix: `Math.floor(Math.random() * 7) + 1`.
  Note: mostly invisible today because the cadence enforcement overwrites the
  whole progression (see Phase 3), but fix it anyway so it's correct when that
  changes.

## Phase 2 — Musical correctness

- [x] **Protect strong beats on the actual grid size**
  `rhythm/generateRhythmicMotif.js:54` — strong beats are hardcoded to
  `[0, 4, 8, 12]` (16-step grid) but the engine uses `steps: 32`, so offbeats
  get protected instead of downbeats.
  Fix: derive from `steps`, e.g. `[0, steps/4, steps/2, 3*steps/4]`.

- [x] **Symmetric humanization**
  `core/musicEngine.js:74-82` — negative deltas are discarded (to avoid
  scheduling in the past), so ~half of triggers get no humanization.
  Fix: schedule triggers with a small constant lookahead offset and apply the
  delta in both directions around it. Update the README snippet to match the
  real implementation.

- [x] **Rename `HUMANIZE_MIN_MS` / `HUMANIZE_MAX_MS`**
  `core/musicEngine.js:69-70` — named milliseconds, valued in seconds
  (`0.005`). Rename to `_SEC` or store ms and divide once.

## Phase 3 — Dead code & phantom features (decisions needed)

- [x] **Decide the fate of the "chords" instrument**
  Decision: removed (Option B). `chordSynth`, the `isChordsPlay` flag, the
  `toggleInstrument("chords")` case, and the demo checkbox are gone.

- [x] **Use or delete the `chordTransitions` table**
  Decision: deleted (recoverable from git history if the extended-chords
  feature is ever built).

- [x] **Rebalance cadence enforcement vs. random progression**
  Done: `enforceFunctionalCadence` now only pins the last two slots of each
  block to Dominant → Tonic; the opening degrees stay random (verified: all
  49 possible openings occur, cadence always resolves).

- [x] **Remove other dead code**
  Done: `getRandomEffectChain()` compat stub and unused `Note`/`Interval`
  imports removed.

- [x] **Normalize relative imports to include `.js` extensions** *(added
  during Phase 3)* — `theory/chords.js`, `audio/synths.js`, and
  `audio/randomEffectChain.js` used extensionless imports that Vite resolves
  but standard ESM (Node, test runners) rejects. Prerequisite for Phase 5
  tests.

## Phase 4 — Robustness & code health

- [x] **Replace the Proxy synth wrappers with plain wrapper objects**
  Done: `createInstrument(synth, { gainDb, filter })` returns a plain
  `{ synth, filter, gain, connect(), triggerAttackRelease() }` object; all
  Proxies and `wrapWithGainAndProxy`/`mkSynth` removed.

- [x] **Route all logging through the debug flag**
  Done: shared `utils/log.js` (`setDebugLogging` / `debugLog`), wired to the
  engine's `debug` config and `setDebug()` API; all stray `console.log`s
  removed or converted.

- [x] **Lazy audio-graph construction**
  Done: `createAudioGraph()` and `createSynths(audioGraph)` factories; nothing
  is constructed at module import. Control functions (`setGlobalHeadroom`,
  `setReverbDepth`, `getCurrentHeadroomDb`, `enableAutoHeadroom`, …) are now
  methods on the returned graph. `attachRandomEffects` takes the graph as a
  parameter. Engine API gained `setSubBassLevel(db)` (the export existed but
  was never reachable before).

- [x] **Unify Transport access**
  Done: everything goes through `Tone.getTransport()` (or the injectable
  `getTransport` option in `parameterDrift.js`).

## Phase 5 — Tests & docs

- [ ] **Unit tests for the pure modules**
  `rhythm/generateRhythmicMotif.js`, `theory/chords.js`,
  `utils/*` are pure logic (after Phase 4 decoupling, `audio/parameterDrift.js`
  too with an injected transport). Add Vitest; cover: motif density bounds,
  strong-beat protection, mutation invariants (sorted, unique, in range),
  degree range 1–7, cadence block behavior.

- [ ] **Sync the README with reality**
  The README documents an idealized version: the symmetric humanize snippet,
  `HUMANIZE_MIN_MS = 5`, the `toKeep/` structure name, and the extended-chords
  feature that doesn't exist yet. Update after Phases 1–3 land.

---

### Suggested order

Phase 1 is four one-to-five-line fixes — do it as a single commit. Phase 2 and
the Phase 3 decisions are independent of each other. Phase 4's lazy
construction should land before writing the Phase 5 tests.
