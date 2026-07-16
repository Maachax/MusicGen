import { randomDegreeProgression } from "../utils/randomDegreeProgression.js";
import { debugLog } from "../utils/log.js";
import { Scale, Mode, Chord } from "tonal";

// Catégorisation fonctionnelle pour ajustements dynamiques
globalThis.__HARMONIC_FUNC__ = {
  tonic: [1, 3, 6], // 3 et 6 assimilés tonique relative
  predominant: [2, 4],
  dominant: [5],
};

// Force une cadence fonctionnelle sur chaque bloc de degrés.
// Seules les deux dernières positions du bloc sont imposées (Dominante -> Tonique):
// les premières restent aléatoires pour garder de la variété, tout en conservant
// la résolution fonctionnelle en fin de bloc.
// Entrée: array de degrés (ex: [1,6,2,5]) — modifié sur place.
function enforceFunctionalCadence(degrees, options = {}) {
  const funcs = globalThis.__HARMONIC_FUNC__;
  if (!funcs) return degrees;
  const { blockSize = 4 } = options;

  function pick(arr) {
    return arr[(Math.random() * arr.length) | 0];
  }

  for (let start = 0; start + blockSize <= degrees.length; start += blockSize) {
    degrees[start + blockSize - 2] = pick(funcs.dominant);
    degrees[start + blockSize - 1] = pick(funcs.tonic);
  }
  return degrees;
}

export function getChordProgression(randomNote, randomMode) {
  const degreesProgression = randomDegreeProgression();
  // Cadence fonctionnelle: fin de bloc D -> T, début laissé aléatoire
  enforceFunctionalCadence(degreesProgression, { blockSize: 4 });
  const scaleDegreesFn = Scale.degrees(`${randomNote} ${randomMode}`);
  const seventhChords = Mode.seventhChords(randomMode, randomNote);

  const chordProgression = degreesProgression.map(scaleDegreesFn);

  const seventhChordVoicings = degreesProgression.map((d) => {
    const idx = d - 1;
    return Chord.get(seventhChords[idx]).notes;
  });
  debugLog("Chords (7th) for melody source:", seventhChordVoicings);

  return {
    chordProgression, // root notes
    seventhChords,
    degreesProgression,
    seventhChordVoicings,
  };
}

// Ancienne fonction remplacée par buildExtendedChord + voiceLeading.
