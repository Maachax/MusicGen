# Music Generation Engine

Système de génération musicale algorithmique extrait du projet visualizer POC.

## 🚀 Démarrage Rapide

### Installation

```bash
npm install
```

### Développement

```bash
npm start
```

Ouvrir http://localhost:5173

### Build Production

```bash
npm run build
```

## 📁 Structure

```
toKeep/
├── audio/              # Moteur audio & synthétiseurs
│   ├── engine.js
│   ├── synths.js
│   ├── parameterDrift.js
│   └── randomEffectChain.js
├── theory/             # Théorie musicale
│   ├── randomScale.js
│   └── chords.js
├── rhythm/             # Génération rythmique
│   └── generateRhythmicMotif.js
├── utils/              # Utilitaires
│   ├── generateConditionalArray.js
│   └── randomDegreeProgression.js
├── core/               # Orchestrateur central
│   └── musicEngine.js
├── example.js          # Exemple d'utilisation
├── index.html          # Page de demo
└── README.md
```

## 🎵 Utilisation

### Basique

```javascript
import * as Tone from "tone";
import { createMusicEngine } from "./core/musicEngine.js";

const engine = createMusicEngine({
  bpm: 95,
  debug: true,
});

engine.initialize();

// User gesture requis
document.body.addEventListener("click", async () => {
  await Tone.start();
  engine.start();
});
```

### Contrôles

```javascript
// Tempo
engine.setBpm(120);

// Instruments
engine.toggleInstrument("bass", true);
engine.toggleInstrument("arp", false);

// Génération
engine.newScale();
engine.regeneratePatterns();
engine.regenerateAll();

// Paramètres
engine.setArpDensity(0.6);
engine.setReverb(3);
engine.freeze(true);

// État
const state = engine.getState();
console.log(state);
```

## 🎹 Instruments

- **Bass** - Ligne de basse (lowpass 900Hz)
- **SubBass** - Sub-basse (lowpass 160Hz)
- **Midline** - Voix médium douce (lowpass 2000Hz)
- **Arpegio** - Arpège mélodique (lowpass 3500Hz)
- **Chords** - Accords polyphoniques

## 🎚️ Effets

- Reverb (court & long)
- Delay
- Vibrato
- Chorus
- BitCrusher
- Distortion

## 📊 Théorie

- Gammes aléatoires (12 notes × tous les modes)
- Progressions harmoniques fonctionnelles (T-PD-D-T)
- Accords 7ème avec voicings
- Degrés harmoniques

## 🥁 Rythme

- Génération par distribution d'intervalles
- Mutations contrôlées
- Densité ajustable
- Cycles de régénération automatiques

## 🔧 Configuration

Voir `core/musicEngine.js` pour toutes les options de configuration.

## 📝 License

MIT
