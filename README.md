# Music Generation Engine - Architecture & Core Files

This directory contains the complete file structure and essential components for an algorithmic music generation system. It deliberately excludes all graphical/visualization components.

## 📁 Project Structure

```
toKeep/
├── README.md (this file)
├── audio/
│   ├── engine.js
│   ├── synths.js
│   ├── parameterDrift.js
│   └── randomEffectChain.js
├── theory/
│   ├── randomScale.js
│   └── chords.js
├── rhythm/
│   └── generateRhythmicMotif.js
├── utils/
│   ├── generateConditionalArray.js
│   └── randomDegreeProgression.js
└── core/
    └── musicEngine.js (main orchestrator)
```

---

## 🎵 Module Descriptions

### **audio/** - Audio Engine & Synthesizers

#### `engine.js`

**Responsibilities:**
- Global audio graph configuration (main bus, effects, compression, limiter)
- Parallel effects management: reverb (short/long), delay, vibrato, chorus, bitcrusher, distortion
- Dynamic headroom control and limiting
- Audio metrics (peak meter)

**Dependencies:** Tone.js

**Main Exports:**
```javascript
export const audioGraph = {
  bus,           // Main bus
  dryBus,        // Dry bus (pre-effects)
  optional,      // Available effects
  wet,           // Wet gains per effect
  lowpass, comp, limiter, meter
}
export function setGlobalHeadroom(db)
export function setReverbDepth(factor)
export function initAudioTransport()
```

---

#### `synths.js`

**Responsibilities:**
- Definition of all system synthesizers
- Custom audio processing chains (filters, gains)
- Proxy system to expose synths + their filters
- Random timbre regeneration (`regenerateInstruments()`)

**Instruments:**
- `bassLineSynth` - Main bass (triangle/sine, lowpass 900Hz)
- `subBassSynth` - Sub-bass (pure sine, lowpass 160Hz)
- `midLineSynth` - Soft mid voice (lowpass 2000Hz)
- `midLineSynth2` - Accent mid voice
- `arpegioSynth` - Melodic arpeggio (lowpass 3500Hz)
- `chordSynth` - Polyphonic chords (PolySynth)

**Exports:**
```javascript
export {
  bassLineSynth,
  subBassSynth,
  midLineSynth,
  midLineSynth2,
  arpegioSynth,
  chordSynth,
  regenerateInstruments,
  setSubBassLevel,
};
```

---

#### `parameterDrift.js`

**Responsibilities:**
- Slow random drift of audio parameters (filters, reverb, delay, vibrato)
- Transport-based scheduling (measure resolution)
- Smooth transitions (ramp) between target values
- Modular system: dynamic target addition

**API:**
```javascript
export function createParameterDrift(opts) {
  // Returns:
  addTarget({ name, getter, apply, range, stepMeasures, rampMeasures }),
  start(),
  stop(),
  dispose()
}
```

**Example Usage:**
```javascript
const drift = createParameterDrift({ debug: true });
drift.addTarget({
  name: "filterFreq",
  getter: () => synth.filter.frequency.value,
  apply: (v, dur) => synth.filter.frequency.rampTo(v, dur),
  range: [1200, 2600],
  stepMeasures: [8, 20],
  rampMeasures: [2, 6],
});
drift.start();
```

---

#### `randomEffectChain.js`

**Responsibilities:**
- Weighted random effect selection for each synth
- Avoids duplicates and problematic combinations (e.g., 2 reverbs simultaneously)
- WeakMap registry to track attached effects

**Exports:**
```javascript
export function pickEffectSubset(max = 2)
export function attachRandomEffects(synth, { max = 2 })
```

**Available Effect Pool:**
- reverb (weight: 3)
- longReverb (weight: 1)
- delay (weight: 2)
- vibrato (weight: 2)
- chorus (weight: 1)

---

### **theory/** - Music Theory

#### `randomScale.js`

**Responsibilities:**
- Random scale generation (note + mode)
- Uses Tonal library for modes

**Export:**
```javascript
export function getRandomScale()
// Returns: { randomNote, randomMode }
// Example: { randomNote: "C#", randomMode: "dorian" }
```

**Available Notes:** C, C#, D, D#, E, F, F#, G, G#, A, A#, B

---

#### `chords.js`

**Responsibilities:**
- Harmonic chord progression generation
- Functional cadence application (Tonic-Predominant-Dominant-Tonic)
- 7th chord construction with voicings
- Future extensions possible: 9ths, 11ths, 13ths

**Export:**
```javascript
export function getChordProgression(randomNote, randomMode) {
  // Returns:
  chordProgression,      // Root notes [C, F, G, C]
  seventhChords,         // 7th chord names
  degreesProgression,    // Degrees [1, 4, 5, 1]
  seventhChordVoicings   // Complete voicings [[C,E,G,B], ...]
}
```

**Harmonic Logic:**
```javascript
globalThis.__HARMONIC_FUNC__ = {
  tonic: [1, 3, 6],
  predominant: [2, 4],
  dominant: [5],
};
```

---

### **rhythm/** - Rhythm & Motifs

#### `generateRhythmicMotif.js`

**Responsibilities:**
- Rhythmic motif generation via interval distribution
- Controlled motif mutation (subtle variation)
- Dynamic density adjustment
- Motif manager with automatic regeneration cycles

**Exports:**
```javascript
export function generateRhythmicMotif(steps, { density, weights, protectStrongBeats })
export function mutateMotif(motif, { steps, maxTries })
export function createMotifManager({ 
  steps, 
  density, 
  mutateEvery, 
  regenEvery, 
  mutationProbability, 
  weights 
})
```

**MotifManager API:**
```javascript
{
  current(),                   // Current position in motif
  advanceStep(beatIndex),      // Advances and returns true if trigger
  tickExternal(),              // Increments cycle
  getMotif(),                  // Returns current motif
  forceRegenerate(density),    // Forces new generation
  getLastDurationSteps()       // Duration of last note
}
```

**Default Interval Weights:**
```javascript
{ 1: 1, 2: 2, 3: 3, 4: 4, 6: 2, 8: 1 }
```

---

### **utils/** - Utilities

#### `generateConditionalArray.js`

**Responsibilities:**
- Probability-based sequence generation
- Two modes: melodic indices and binary (0/1)

**Exports:**
```javascript
export function generateMelodyProbability(size, probability)
// Returns: [0, 2, 5, 7, ...] (active indices)

export function generateBinaryProbability(size, probability)
// Returns: [1, 0, 1, 1, 0, ...] (binary choices)
```

---

#### `randomDegreeProgression.js`

**Responsibilities:**
- Basic degree progression generation (1-7)
- Used by `chords.js` then refined by functional cadences

**Export:**
```javascript
export function randomDegreeProgression()
// Returns: [1, 4, 5, 1] (4 random degrees)
```

---

### **core/** - Central Orchestration

#### `musicEngine.js`

**Responsibilities:**
- Complete music system initialization
- Main sequencing loop (Tone.Loop)
- Global state management (beatIndex, chordIndex, loopIndex)
- Coordination between instruments, harmony, and rhythm
- Public API for engine control

**Proposed Architecture:**
```javascript
import * as Tone from "tone";
import { initAudioTransport, audioGraph } from "../audio/engine";
import {
  bassLineSynth,
  subBassSynth,
  midLineSynth,
  midLineSynth2,
  arpegioSynth,
  chordSynth,
  regenerateInstruments,
} from "../audio/synths";
import { createParameterDrift } from "../audio/parameterDrift";
import { getRandomScale } from "../theory/randomScale";
import { getChordProgression } from "../theory/chords";
import { createMotifManager } from "../rhythm/generateRhythmicMotif";
import {
  generateMelodyProbability,
  generateBinaryProbability,
} from "../utils/generateConditionalArray";

export function createMusicEngine(config = {}) {
  // Configuration
  const {
    BASE_MELODY_STEPS = 16,
    SUBDIV_FACTOR = 2,
    bpm = 100,
    debug = false,
  } = config;

  // State
  let beatIndex = 0;
  let chordIndex = 0;
  let loopIndex = 1;

  // Initial generation
  let { randomNote, randomMode } = getRandomScale();
  let chordsProg = getChordProgression(randomNote, randomMode);

  // Rhythmic motifs
  const arpegioMotifManager = createMotifManager({
    steps: BASE_MELODY_STEPS * SUBDIV_FACTOR,
    density: 0.4,
    mutateEvery: 128,
    regenEvery: 512,
  });

  // Main loop
  const mainLoop = new Tone.Loop((time) => {
    // Sequencing logic...
  }, "32n");

  // Public API
  return {
    start() {
      mainLoop.start(0);
      Tone.getTransport().start();
    },
    stop() {
      Tone.getTransport().stop();
    },
    setBpm(bpm) {
      Tone.getTransport().bpm.rampTo(bpm, 0.25);
    },
    newScale() { /* ... */ },
    toggleInstrument(name) { /* ... */ },
    getState() { /* ... */ },
  };
}
```

---

## 🔧 External Dependencies

```json
{
  "dependencies": {
    "tone": "^14.8.x",
    "tonal": "^6.x.x"
  }
}
```

---

## 🚀 Minimal Usage

```javascript
import * as Tone from "tone";
import { createMusicEngine } from "./core/musicEngine";

// Initialization
const engine = createMusicEngine({
  bpm: 95,
  debug: true,
});

// Initialize
engine.initialize();

// Start (requires user gesture)
document.body.addEventListener("click", async () => {
  await Tone.start();
  engine.start();
});

// Controls
engine.setBpm(120);
engine.newScale();
engine.toggleInstrument("bass");
```

---

## 🎛️ Advanced Configuration

### Main Constants (define in `musicEngine.js`):

```javascript
const BASE_MELODY_STEPS = 16;      // Base grid (16th notes)
const SUBDIV_FACTOR = 2;           // Subdivision (32nd notes)
const MELODY_LENGTH = 32;          // Total resolution
const MID_LENGTH = 8;              // Midline grid

const CHORD_INTERVAL = 32;         // Chord change (ticks)
const MUTATE_INTERVAL = 128;       // Pattern mutation
const PROG_INTERVAL = 512;         // New progression

const HUMANIZE_MIN_MS = 5;         // Min micro-timing (ms)
const HUMANIZE_MAX_MS = 35;        // Max micro-timing (ms)
```

### Humanization:

```javascript
function humanize(time) {
  if (!humanizeEnabled) return time;
  const r = Math.random() * 2 - 1;
  const mag = HUMANIZE_MIN_MS + 
    (HUMANIZE_MAX_MS - HUMANIZE_MIN_MS) * Math.random() ** 2;
  return time + (r * mag) / 1000;
}
```

---

## 📊 Data Flow

```
getRandomScale()
    ↓
getChordProgression(note, mode)
    ↓
seventhChordVoicings → melodyNotes (note pool)
    ↓
generateRhythmicMotif() → arpegioMotifManager
    ↓
mainLoop (Tone.Loop @ 32n)
    ↓
├─ bassLineSynth.triggerAttackRelease()
├─ midLineSynth.triggerAttackRelease()
└─ arpegioSynth.triggerAttackRelease()
    ↓
audioGraph (bus → effects → comp → limiter → destination)
```

---

## 🔄 Regeneration Cycles

| Element              | Interval     | Effect                      |
|---------------------|-------------|----------------------------|
| Chord               | 32 ticks    | Changes current chord       |
| Arp motif mutation  | 128 ticks   | Small rhythmic variation    |
| Midline mutation    | 128 ticks   | New probabilities          |
| Harmonic progression| 512 ticks   | New chord sequence         |
| Parameter drift     | 8-32 measures| Filters, reverb, etc.     |

---

## 🎨 Future Extension Points

1. **Advanced Melody Generation:**
   - Markov chains for melodic contours
   - Interval constraints (no jumps > 7 semitones)
   - Recurring melodic motifs

2. **Enhanced Harmony:**
   - Chord extensions (9ths, 11ths, 13ths, alterations)
   - Intelligent voice leading
   - Modulations/pivot chords

3. **Compositional Structure:**
   - A-B-A-C sections (verse/chorus)
   - Builds and drops
   - Dynamic intensity variation

4. **Generative Effects:**
   - Granular synthesis
   - Spectral processing
   - Glitch/silence probabilities

5. **Export/Save:**
   - MIDI export
   - Audio export (WAV/MP3)
   - State serialization for exact replay

---

## 📝 Important Notes

- **Transport Required:** All sequencing relies on `Tone.Transport`
- **User Gesture:** `Tone.start()` must be called after user interaction
- **Timing Precision:** Use `time` parameter in callbacks, never `Tone.now()`
- **Binary Masks:** `MASK_MELODY = 31` for efficient wrapping (beatIndex & 31)
- **Freeze Mode:** Ability to freeze all mutations/variations via global flag

---

## 🐛 Debugging

```javascript
// Enable detailed logs
const DEBUG_MUTABLE = true;

// Inspect state
console.log({
  beatIndex,
  chordIndex,
  currentChord: chordsProg.chordProgression[chordIndex],
  arpMotif: arpegioMotifManager.getMotif(),
  peakLevel: audioGraph.meter.getValue(),
});

// Force regeneration
arpegioMotifManager.forceRegenerate(0.6);
regenerateInstruments();
```
