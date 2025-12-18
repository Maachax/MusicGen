# Système de Génération Musicale - Architecture & Fichiers Essentiels

Ce dossier contient l'arborescence complète et les fichiers essentiels pour le système de génération musicale algorithmique. Il exclut volontairement toute la partie graphique/visualisation.

## 📁 Structure du Projet

```
toKeep/
├── README.md (ce fichier)
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
    └── musicEngine.js (nouveau fichier orchestrateur)
```

---

## 🎵 Description des Modules

### **audio/** - Moteur Audio & Synthétiseurs

#### `engine.js`

**Responsabilités:**

- Configuration du graphe audio global (bus principal, effets, compression, limiteur)
- Gestion des effets parallèles: reverb (court/long), delay, vibrato, chorus, bitcrusher, distortion
- Contrôle du headroom dynamique et du limiteur
- Métriques audio (peak meter)
- API de contrôle: `setGlobalHeadroom()`, `setReverbDepth()`, `initAudioTransport()`

**Dépendances:** Tone.js

**Exports principaux:**

```javascript
export const audioGraph = {
  bus,           // Bus principal
  dryBus,        // Bus dry (avant effets)
  optional,      // Effets disponibles
  wet,           // Gains wet pour chaque effet
  lowpass, comp, limiter, meter
}
export function setGlobalHeadroom(db)
export function setReverbDepth(factor)
export function initAudioTransport()
```

---

#### `synths.js`

**Responsabilités:**

- Définition de tous les synthétiseurs du système
- Chaînes de traitement audio personnalisées (filters, gains)
- Système de proxy pour exposer les synthés + leurs filtres
- Régénération aléatoire des timbres (`regenerateInstruments()`)

**Instruments:**

- `bassLineSynth` - Basse principale (triangle/sine, lowpass 900Hz)
- `subBassSynth` - Sub-basse (pure sine, lowpass 160Hz)
- `midLineSynth` - Voix médium douce (lowpass 2000Hz)
- `midLineSynth2` - Voix médium accent
- `arpegioSynth` - Arpège mélodique (lowpass 3500Hz)
- `chordSynth` - Accords polyphoniques (PolySynth)

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

**Responsabilités:**

- Dérive aléatoire lente des paramètres audio (filtres, reverb, delay, vibrato)
- Scheduling basé sur le transport musical (mesures)
- Transitions douces (ramp) entre valeurs cibles
- Système modulaire: ajout de targets dynamiques

**API:**

```javascript
export function createParameterDrift(opts) {
  // Retourne:
  addTarget({ name, getter, apply, range, stepMeasures, rampMeasures }),
    start(),
    stop(),
    dispose();
}
```

**Exemple d'utilisation:**

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

**Responsabilités:**

- Sélection aléatoire pondérée d'effets pour chaque synthé
- Évite les doublons et combinaisons problématiques (ex: 2 reverbs simultanées)
- Registry WeakMap pour tracer les effets déjà attachés

**Exports:**

```javascript
export function pickEffectSubset(max = 2)
export function attachRandomEffects(synth, { max = 2 })
```

**Pool d'effets disponibles:**

- reverb (poids: 3)
- longReverb (poids: 1)
- delay (poids: 2)
- vibrato (poids: 2)
- chorus (poids: 1)

---

### **theory/** - Théorie Musicale

#### `randomScale.js`

**Responsabilités:**

- Génération aléatoire de gammes (note + mode)
- Utilise la librairie Tonal pour les modes

**Export:**

```javascript
export function getRandomScale()
// Retourne: { randomNote, randomMode }
// Ex: { randomNote: "C#", randomMode: "dorian" }
```

**Notes disponibles:** C, C#, D, D#, E, F, F#, G, G#, A, A#, B

---

#### `chords.js`

**Responsabilités:**

- Génération de progressions d'accords harmoniques
- Application de cadences fonctionnelles (Tonique-Prédominant-Dominant-Tonique)
- Construction d'accords 7ème avec voicings
- Extensions futures possibles: 9èmes, 11èmes, 13èmes

**Export:**

```javascript
export function getChordProgression(randomNote, randomMode) {
  // Retourne:
  chordProgression, // Notes fondamentales [C, F, G, C]
    seventhChords, // Noms d'accords 7ème
    degreesProgression, // Degrés [1, 4, 5, 1]
    seventhChordVoicings; // Voicings complets [[C,E,G,B], ...]
}
```

**Logique harmonique:**

```javascript
globalThis.__HARMONIC_FUNC__ = {
  tonic: [1, 3, 6],
  predominant: [2, 4],
  dominant: [5],
};
```

---

### **rhythm/** - Rythme & Motifs

#### `generateRhythmicMotif.js`

**Responsabilités:**

- Génération de motifs rythmiques par distribution d'intervalles
- Mutation contrôlée des motifs (variation subtile)
- Ajustement de densité dynamique
- Manager de motifs avec cycles de régénération automatiques

**Exports:**

```javascript
export function generateRhythmicMotif(steps, { density, weights, protectStrongBeats })
export function mutateMotif(motif, { steps, maxTries })
export function createMotifManager({ steps, density, mutateEvery, regenEvery, mutationProbability, weights })
```

**API MotifManager:**

```javascript
{
  current(), // Position actuelle dans le motif
    advanceStep(beatIndex), // Avance et retourne true si trigger
    tickExternal(), // Incrémente le cycle
    getMotif(), // Retourne le motif actuel
    forceRegenerate(density), // Force nouvelle génération
    getLastDurationSteps(); // Durée de la dernière note
}
```

**Poids d'intervalles par défaut:**

```javascript
{ 1: 1, 2: 2, 3: 3, 4: 4, 6: 2, 8: 1 }
```

---

### **utils/** - Utilitaires

#### `generateConditionalArray.js`

**Responsabilités:**

- Génération de séquences basées sur probabilités
- Deux modes: indices mélodiques et binaire (0/1)

**Exports:**

```javascript
export function generateMelodyProbability(size, probability)
// Retourne: [0, 2, 5, 7, ...] (indices actifs)

export function generateBinaryProbability(size, probability)
// Retourne: [1, 0, 1, 1, 0, ...] (choix binaires)
```

---

#### `randomDegreeProgression.js`

**Responsabilités:**

- Génération basique de progression de degrés (1-7)
- Utilise par `chords.js` puis affinée par cadences fonctionnelles

**Export:**

```javascript
export function randomDegreeProgression()
// Retourne: [1, 4, 5, 1] (4 degrés aléatoires)
```

---

### **core/** - Orchestration Centrale

#### `musicEngine.js` (NOUVEAU - À CRÉER)

**Responsabilités:**

- Initialisation complète du système musical
- Boucle principale de séquençage (Tone.Loop)
- Gestion du state global (beatIndex, chordIndex, loopIndex)
- Coordination entre instruments, harmonie et rythme
- API publique pour contrôler le moteur

**Architecture proposée:**

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

  // Génération initiale
  let { randomNote, randomMode } = getRandomScale();
  let chordsProg = getChordProgression(randomNote, randomMode);

  // Motifs rythmiques
  const arpegioMotifManager = createMotifManager({
    steps: BASE_MELODY_STEPS * SUBDIV_FACTOR,
    density: 0.4,
    mutateEvery: 128,
    regenEvery: 512,
  });

  // Boucle principale
  const mainLoop = new Tone.Loop((time) => {
    // Logique de séquençage...
  }, "32n");

  // API publique
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
    newScale() {
      /* ... */
    },
    toggleInstrument(name) {
      /* ... */
    },
    getState() {
      /* ... */
    },
  };
}
```

---

## 🔧 Dépendances Externes

```json
{
  "dependencies": {
    "tone": "^14.8.x",
    "tonal": "^6.x.x"
  }
}
```

---

## 🚀 Utilisation Minimale

```javascript
import * as Tone from "tone";
import { createMusicEngine } from "./core/musicEngine";

// Initialisation
const engine = createMusicEngine({
  bpm: 95,
  debug: true,
});

// Démarrage (requiert user gesture)
document.body.addEventListener("click", async () => {
  await Tone.start();
  engine.start();
});

// Contrôles
engine.setBpm(120);
engine.newScale();
engine.toggleInstrument("bass");
```

---

## 🎛️ Configuration Avancée

### Constantes principales (à définir dans `musicEngine.js`):

```javascript
const BASE_MELODY_STEPS = 16; // Grille de base (16e notes)
const SUBDIV_FACTOR = 2; // Subdivision (32e notes)
const MELODY_LENGTH = 32; // Résolution totale
const MID_LENGTH = 8; // Grille midline

const CHORD_INTERVAL = 32; // Changement d'accord (ticks)
const MUTATE_INTERVAL = 128; // Mutation patterns
const PROG_INTERVAL = 512; // Nouvelle progression

const HUMANIZE_MIN_MS = 5; // Micro-timing min
const HUMANIZE_MAX_MS = 35; // Micro-timing max
```

### Humanisation:

```javascript
function humanize(time) {
  if (!humanizeEnabled) return time;
  const r = Math.random() * 2 - 1;
  const mag =
    HUMANIZE_MIN_MS + (HUMANIZE_MAX_MS - HUMANIZE_MIN_MS) * Math.random() ** 2;
  return time + (r * mag) / 1000;
}
```

---

## 📊 Flux de Données

```
getRandomScale()
    ↓
getChordProgression(note, mode)
    ↓
seventhChordVoicings → melodyNotes (pool de notes)
    ↓
generateRhythmicMotif() → arpegioMotifManager
    ↓
mainLoop (Tone.Loop @ 32n)
    ↓
├─ bassLineSynth.triggerAttackRelease()
├─ midLineSynth.triggerAttackRelease()
└─ arpegioSynth.triggerAttackRelease()
    ↓
audioGraph (bus → effets → comp → limiter → destination)
```

---

## 🔄 Cycles de Régénération

| Élément                | Intervalle   | Effet                      |
| ---------------------- | ------------ | -------------------------- |
| Accord                 | 32 ticks     | Change l'accord courant    |
| Mutation motif arp     | 128 ticks    | Petite variation rythmique |
| Mutation midline       | 128 ticks    | Nouvelles probabilités     |
| Progression harmonique | 512 ticks    | Nouvelle suite d'accords   |
| Dérive paramètres      | 8-32 mesures | Filtres, reverb, etc.      |

---

## 🎨 Points d'Extension Futurs

1. **Génération mélodique avancée:**

   - Markov chains pour contours mélodiques
   - Contraintes d'intervalles (pas de sauts > 7 demi-tons)
   - Motifs mélodiques récurrents

2. **Harmonie enrichie:**

   - Extensions d'accords (9èmes, 11èmes, 13èmes, alterations)
   - Voice leading intelligent
   - Modulations/pivot chords

3. **Structure compositionnelle:**

   - Sections A-B-A-C (couplet/refrain)
   - Builds et drops
   - Variation d'intensité dynamique

4. **Effets génératifs:**

   - Granular synthesis
   - Spectral processing
   - Probabilités de glitches/silences

5. **Export/Sauvegarde:**
   - Export MIDI
   - Export audio (WAV/MP3)
   - Sérialisation du state pour replay exact

---

## 📝 Notes Importantes

- **Transport obligatoire:** Tout le séquençage repose sur `Tone.Transport`
- **User gesture:** `Tone.start()` doit être appelé suite à une interaction utilisateur
- **Précision timing:** Utiliser `time` parameter dans callbacks, jamais `Tone.now()`
- **Masques binaires:** `MASK_MELODY = 31` pour wrap efficace (beatIndex & 31)
- **Freeze mode:** Possibilité de geler toutes mutations/variations via flag global

---

## 🐛 Debugging

```javascript
// Activer logs détaillés
const DEBUG_MUTABLE = true;

// Inspecter state
console.log({
  beatIndex,
  chordIndex,
  currentChord: chordsProg.chordProgression[chordIndex],
  arpMotif: arpegioMotifManager.getMotif(),
  peakLevel: audioGraph.meter.getValue(),
});

// Forcer régénération
arpegioMotifManager.forceRegenerate(0.6);
regenerateInstruments();
```

---

## ✅ Checklist Migration Nouveau Projet

- [ ] Copier tous les fichiers `audio/`, `theory/`, `rhythm/`, `utils/`
- [ ] Créer `core/musicEngine.js` avec logique d'orchestration
- [ ] Installer dépendances: `npm install tone tonal`
- [ ] Implémenter user gesture pour `Tone.start()`
- [ ] Tester chaque instrument individuellement
- [ ] Configurer BPM et intervalles selon besoins
- [ ] Activer/désactiver parameter drift selon goût
- [ ] Optionnel: ajouter UI controls (sliders, buttons)

---

**Date de création:** 10 Décembre 2025  
**Version système:** POC → Production Ready  
**Maintenu par:** Migration depuis projet visualizer
