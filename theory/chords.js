import { randomDegreeProgression } from "../utils/randomDegreeProgression";
import { Scale, Mode, Chord, Note, Interval } from "tonal";

const chordTransitions = {
  1: {
    maj7: 0.25,
    maj9: 0.25,
    maj6: 0.15,
    add9: 0.15,
    "maj7#11": 0.1,
    maj13: 0.1,
  },
  4: {
    maj7: 0.25,
    maj9: 0.25,
    add9: 0.2,
    "maj7#11": 0.15,
    maj6: 0.1,
    maj13: 0.05,
  },
  2: { min7: 0.6, min9: 0.25, min11: 0.15 },
  3: { min7: 0.7, min9: 0.3 },
  6: { min7: 0.5, min9: 0.25, min11: 0.15, min6: 0.1 },
  5: {
    9: 0.15,
    13: 0.15,
    "7#9": 0.15,
    "7b9": 0.15,
    "7#5": 0.1,
    "7b5": 0.1,
    "7sus4": 0.1,
    "7alt": 0.1,
  },
};

// Catégorisation fonctionnelle pour ajustements dynamiques
globalThis.__HARMONIC_FUNC__ = {
  tonic: [1, 3, 6], // 3 et 6 assimilés tonique relative
  predominant: [2, 4],
  dominant: [5],
};

// Force une cadence fonctionnelle sur un bloc de degrés.
// Pattern par défaut: T -> PD -> D -> T (ex: 1 -> 4 -> 5 -> 1) mais on ajoute variété.
// Entrée: array de degrés (ex: [1,6,2,5])
// Sortie: array modifié sur place
function enforceFunctionalCadence(degrees, options = {}) {
  const funcs = globalThis.__HARMONIC_FUNC__;
  if (!funcs) return degrees;
  const {
    blockSize = 4, // taille d'un bloc cadence
    applyEvery = 2, // appliquer une fois sur deux blocs (pour variété)
    seed = Math.random(),
  } = options;
  // Regroupement
  const tonicChoices = funcs.tonic;
  const pdChoices = funcs.predominant;
  const domChoices = funcs.dominant;

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  for (
    let start = 0, blockIndex = 0;
    start < degrees.length;
    start += blockSize, blockIndex++
  ) {
    const end = Math.min(start + blockSize, degrees.length);
    if (end - start < blockSize) break; // bloc incomplet → on laisse tel quel
    if (blockIndex % applyEvery !== 0) continue; // on saute selon fréquence
    // Pattern T - PD - D - T
    degrees[start] = pick(tonicChoices);
    if (start + 1 < end) degrees[start + 1] = pick(pdChoices);
    if (start + 2 < end) degrees[start + 2] = pick(domChoices);
    if (start + 3 < end) degrees[start + 3] = pick(tonicChoices);
  }
  return degrees;
}

export function getChordProgression(randomNote, randomMode) {
  const degreesProgression = randomDegreeProgression();
  // Application cadence fonctionnelle sur la progression générée
  enforceFunctionalCadence(degreesProgression, {
    blockSize: 4,
    applyEvery: 1, // pour l'instant chaque bloc → peut être rendu paramétrable
  });
  const scaleDegreesFn = Scale.degrees(`${randomNote} ${randomMode}`);
  const seventhChords = Mode.seventhChords(randomMode, randomNote);

  const chordProgression = degreesProgression.map(scaleDegreesFn);

  const seventhChordVoicings = degreesProgression.map((d) => {
    const idx = d - 1;
    return Chord.get(seventhChords[idx]).notes;
  });
  console.log("Chords (7th) for melody source:", seventhChordVoicings);

  return {
    chordProgression, // root notes
    seventhChords,
    degreesProgression,
    seventhChordVoicings,
  };
}

// Ancienne fonction remplacée par buildExtendedChord + voiceLeading.
