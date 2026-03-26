/**
 * Music Engine - Orchestrateur Central
 * =====================================
 * Coordonne tous les modules de génération musicale algorithmique.
 * Gère la boucle principale, le séquençage et l'état global du système.
 */

import * as Tone from "tone";
import {
  initAudioTransport,
  audioGraph,
  setReverbDepth,
  setGlobalHeadroom,
  getCurrentHeadroomDb,
} from "../audio/engine.js";
import {
  bassLineSynth,
  subBassSynth,
  midLineSynth,
  midLineSynth2,
  arpegioSynth,
  chordSynth,
  regenerateInstruments,
  setSubBassLevel,
} from "../audio/synths.js";
import { createParameterDrift } from "../audio/parameterDrift.js";
import { getRandomScale } from "../theory/randomScale.js";
import { getChordProgression } from "../theory/chords.js";
import { createMotifManager } from "../rhythm/generateRhythmicMotif.js";
import {
  generateMelodyProbability,
  generateBinaryProbability,
} from "../utils/generateConditionalArray.js";

export function createMusicEngine(config = {}) {
  // ========================
  // CONFIGURATION
  // ========================
  const {
    BASE_MELODY_STEPS = 16,
    SUBDIV_FACTOR = 2,
    bpm = 100,
    debug = false,
    humanize = true,
    reverbDepth = 2,
    globalHeadroom = -10,
  } = config;

  let DEBUG_MUTABLE = debug;
  const debugLog = (...args) => {
    if (DEBUG_MUTABLE) console.log("[MusicEngine]", ...args);
  };

  // Résolution mélodique
  const MELODY_LENGTH = BASE_MELODY_STEPS * SUBDIV_FACTOR; // 32
  const MID_LENGTH = 8;
  const STEP_DURATION_SECONDS = Tone.Time("16n").toSeconds();

  // Masques binaires pour wrap efficace
  const MASK_MELODY = MELODY_LENGTH - 1; // 31
  const MASK_MID = MID_LENGTH - 1; // 7

  // Intervalles de régénération
  const CHORD_INTERVAL = 16 * SUBDIV_FACTOR; // 32 ticks
  const MUTATE_INTERVAL = 64 * SUBDIV_FACTOR; // 128 ticks
  const PROG_INTERVAL = 256 * SUBDIV_FACTOR; // 512 ticks

  // Humanisation (micro-timing)
  const HUMANIZE_MIN_MS = 0.005; // 5ms
  const HUMANIZE_MAX_MS = 0.035; // 35ms
  let humanizeEnabled = humanize;
  let arpQuantize16 = true; // Force arpège sur grille 16e

  function humanizeTime(time) {
    if (!humanizeEnabled) return time;
    const r = Math.random() * 2 - 1;
    const mag =
      HUMANIZE_MIN_MS +
      (HUMANIZE_MAX_MS - HUMANIZE_MIN_MS) * Math.random() ** 2;
    const delta = r * mag;
    return delta < 0 ? time : time + delta;
  }

  // ========================
  // STATE GLOBAL
  // ========================
  let beatIndex = -1; // 0..31 (haute résolution)
  let midLineProgressionPosition = 0;
  let chordIndex = 0;
  let loopIndex = 1;
  let freezeVariations = false;

  // Flags instruments
  let isBassPlay = true;
  let isMidlinePlay = true;
  let isArpegioPlay = true;
  let isChordsPlay = false;

  function anyInstrumentActive() {
    return isBassPlay || isMidlinePlay || isArpegioPlay || isChordsPlay;
  }

  // ========================
  // GÉNÉRATION INITIALE
  // ========================
  let { randomNote, randomMode } = getRandomScale();
  let chordsProg = getChordProgression(randomNote, randomMode);
  debugLog("Initial scale:", randomNote, randomMode);
  debugLog("Chord progression:", chordsProg.chordProgression);

  // Génération pool de notes mélodiques
  function generateMelodyNotesCached(prog) {
    const src = prog.seventhChordVoicings;
    const out = new Array(src.length * (src[0]?.length || 0));
    let k = 0;
    for (let i = 0; i < src.length; i++) {
      const arr = src[i];
      for (let j = 0; j < arr.length; j++) out[k++] = arr[j];
    }
    console.log(out, "melody notes generated");
    return out;
  }

  let melodyNotes = generateMelodyNotesCached(chordsProg);

  // Motif rythmique arpège
  const arpegioMotifManager = createMotifManager({
    steps: MELODY_LENGTH,
    density: 0.4,
    mutateEvery: MUTATE_INTERVAL,
    regenEvery: PROG_INTERVAL,
    mutationProbability: 0.6,
  });

  // Patterns midline
  let midLineNoteSelection = generateBinaryProbability(MID_LENGTH, 1);
  let midLineProbability = generateMelodyProbability(MID_LENGTH, 0.8);

  // ========================
  // PARAMETER DRIFT
  // ========================
  let paramDriftEnabled = true;
  let paramDrift = null;

  function initParameterDrift() {
    if (paramDrift) return;
    paramDrift = createParameterDrift({
      debug: DEBUG_MUTABLE,
      immediateFirstApply: true,
    });

    // Dérive filtre midline
    if (midLineSynth.filter) {
      paramDrift.addTarget({
        name: "midLineFilterFreq",
        getter: () => midLineSynth.filter.frequency.value,
        apply: (v, dur) => midLineSynth.filter.frequency.rampTo(v, dur),
        range: [1200, 2600],
        stepMeasures: [8, 20],
        rampMeasures: [2, 6],
      });
    }

    // Dérive filtre arpège
    if (arpegioSynth.filter) {
      paramDrift.addTarget({
        name: "arpFilterFreq",
        getter: () => arpegioSynth.filter.frequency.value,
        apply: (v, dur) => arpegioSynth.filter.frequency.rampTo(v, dur),
        range: [2800, 4200],
        stepMeasures: [12, 28],
        rampMeasures: [3, 8],
      });
    }

    // Dérive reverb decay
    if (audioGraph?.optional?.reverb) {
      const rev = audioGraph.optional.reverb;
      paramDrift.addTarget({
        name: "reverbDecay",
        getter: () => rev.decay,
        apply: (v) => (rev.decay = v),
        range: [2.5, 4.5],
        stepMeasures: [16, 32],
        rampMeasures: [4, 10],
      });
    }

    // Dérive delay feedback
    if (audioGraph?.optional?.delay) {
      const del = audioGraph.optional.delay;
      paramDrift.addTarget({
        name: "delayFeedback",
        getter: () => del.feedback.value,
        apply: (v, dur) => del.feedback.rampTo(v, dur),
        range: [0.22, 0.38],
        stepMeasures: [12, 24],
        rampMeasures: [2, 5],
      });
    }

    // Dérive vibrato
    if (audioGraph?.optional?.vibrato) {
      const vib = audioGraph.optional.vibrato;
      paramDrift.addTarget({
        name: "vibratoDepth",
        getter: () => vib.depth.value,
        apply: (v, dur) => vib.depth.rampTo(v, dur),
        range: [0.08, 0.22],
        stepMeasures: [8, 16],
        rampMeasures: [2, 4],
      });
      paramDrift.addTarget({
        name: "vibratoFreq",
        getter: () => vib.frequency.value,
        apply: (v, dur) => vib.frequency.rampTo(v, dur),
        range: [3, 7],
        stepMeasures: [12, 24],
        rampMeasures: [3, 6],
      });
    }

    if (paramDriftEnabled) paramDrift.start();
  }

  // ========================
  // HELPERS
  // ========================
  function refreshChordCaches() {
    melodyNotes = generateMelodyNotesCached(chordsProg);
  }

  function regenerateAllPatterns() {
    midLineNoteSelection = generateBinaryProbability(MID_LENGTH, 1);
    midLineProbability = generateMelodyProbability(MID_LENGTH, 0.8);
    arpegioMotifManager.forceRegenerate(Math.random() * 0.5 + 0.2);
  }

  function regenerateCompleteSession() {
    // Nouvelle gamme
    const { randomNote: rn, randomMode: rm } = getRandomScale();
    randomNote = rn;
    randomMode = rm;
    chordsProg = getChordProgression(randomNote, randomMode);
    refreshChordCaches();

    // Nouveaux instruments
    regenerateInstruments();

    // Reset patterns
    regenerateAllPatterns();

    // Reset indices
    beatIndex = -1;
    midLineProgressionPosition = 0;
    chordIndex = 0;
    loopIndex = 1;

    // Nouveau BPM
    const newBpm = (Math.random() * 61 + 60) | 0;
    Tone.getTransport().bpm.rampTo(newBpm, 0.5);

    debugLog("Session régénérée:", {
      scale: randomNote + " " + randomMode,
      bpm: newBpm,
    });
  }

  // ========================
  // BOUCLE PRINCIPALE
  // ========================
  const mainLoop = new Tone.Loop((time) => {
    // Early exit si aucun instrument actif
    if (!anyInstrumentActive()) {
      loopIndex++;
      if (loopIndex % PROG_INTERVAL === 0) {
        chordsProg = getChordProgression(randomNote, randomMode);
        refreshChordCaches();
      }
      return;
    }

    // Incrémentation beat
    beatIndex = (beatIndex + 1) & MASK_MELODY; // wrap 0..31
    const coarseBeat = beatIndex >> 1; // 0..15 pour midline
    if (coarseBeat === MID_LENGTH) midLineProgressionPosition = 0;

    // ======= CHANGEMENT D'ACCORD =======
    if (loopIndex % CHORD_INTERVAL === 0) {
      chordIndex++;
      if (chordIndex >= chordsProg.chordProgression.length) chordIndex = 0;
      const chordName = chordsProg.chordProgression[chordIndex];

      if (isBassPlay) {
        bassLineSynth.triggerAttackRelease(`${chordName}2`, "1m", time);
        const subOct = 1;
        subBassSynth.triggerAttackRelease(`${chordName}${subOct}`, "1m", time);
        debugLog("Bass:", chordName);
      }
    }

    // ======= MUTATION PATTERNS =======
    if (!freezeVariations && loopIndex % MUTATE_INTERVAL === 0) {
      midLineNoteSelection = generateBinaryProbability(MID_LENGTH, 1);
      midLineProbability = generateMelodyProbability(MID_LENGTH, 0.8);
    }

    // ======= NOUVELLE PROGRESSION =======
    if (!freezeVariations && loopIndex % PROG_INTERVAL === 0) {
      chordsProg = getChordProgression(randomNote, randomMode);
      refreshChordCaches();
    }

    // ======= MIDLINE =======
    const midTarget = midLineProbability[midLineProgressionPosition];
    if (midTarget !== undefined) {
      const doubled = midTarget << 1;
      if (coarseBeat === midTarget || beatIndex === doubled) {
        if (isMidlinePlay) {
          const chordName = chordsProg.chordProgression[chordIndex];
          if (midLineNoteSelection[midLineProgressionPosition] === 0) {
            midLineSynth.triggerAttackRelease(
              `${chordName}2`,
              "4n",
              humanizeTime(time)
            );
          } else {
            midLineSynth2.triggerAttackRelease(
              `${chordName}3`,
              "1n",
              humanizeTime(time)
            );
          }
        }
        midLineProgressionPosition++;
      }
    }

    // ======= ARPÈGE =======
    if (arpegioMotifManager.advanceStep(beatIndex)) {
      if (isArpegioPlay) {
        const coarseBeatIdx = beatIndex >> 1;
        if (!(arpQuantize16 && (beatIndex & 1) === 1)) {
          const note = melodyNotes[coarseBeatIdx];
          if (note) {
            const durationSteps = Math.max(
              arpegioMotifManager.getLastDurationSteps
                ? arpegioMotifManager.getLastDurationSteps()
                : 1,
              1
            );
            const sustainSeconds = durationSteps * STEP_DURATION_SECONDS;
            arpegioSynth.triggerAttackRelease(
              `${note}4`,
              sustainSeconds,
              humanizeTime(time)
            );
            debugLog("Arp:", note, "beat:", beatIndex);
          }
        }
      }
    }

    // ======= INCRÉMENTATION & CALLBACKS =======
    loopIndex++;
    if (!freezeVariations) arpegioMotifManager.tickExternal();

    // Debug peak level
    if (DEBUG_MUTABLE && loopIndex % 64 === 0) {
      const level = audioGraph.meter.getValue();
      debugLog(
        "Peak:",
        level.toFixed(1),
        "dBFS | Headroom:",
        getCurrentHeadroomDb().toFixed(1),
        "dB"
      );
    }

    // Reset loopIndex si trop grand
    if (loopIndex > 1_000_000_000) loopIndex = 1;
  }, "32n");

  // ========================
  // INITIALISATION AUDIO
  // ========================
  function initialize() {
    initAudioTransport();
    Tone.getTransport().bpm.value = bpm;
    setGlobalHeadroom(globalHeadroom);
    setReverbDepth(reverbDepth);
    initParameterDrift();
    debugLog("Music engine initialized at", bpm, "BPM");
  }

  // ========================
  // API PUBLIQUE
  // ========================
  return {
    /**
     * Démarre le moteur (nécessite Tone.start() préalable)
     */
    start() {
      if (Tone.getContext().state !== "running") {
        console.warn(
          "[MusicEngine] Audio context not running. Call Tone.start() first."
        );
        return;
      }
      mainLoop.start(0);
      Tone.getTransport().start();
      debugLog("Engine started");
    },

    /**
     * Arrête le moteur
     */
    stop() {
      Tone.getTransport().stop();
      mainLoop.stop();
      debugLog("Engine stopped");
    },

    /**
     * Pause le transport
     */
    pause() {
      Tone.getTransport().pause();
      debugLog("Engine paused");
    },

    /**
     * Reprend après pause
     */
    resume() {
      Tone.getTransport().start();
      debugLog("Engine resumed");
    },

    /**
     * Configure le BPM
     */
    setBpm(newBpm) {
      Tone.getTransport().bpm.rampTo(newBpm, 0.25);
      debugLog("BPM set to", newBpm);
    },

    /**
     * Obtient le BPM actuel
     */
    getBpm() {
      return Tone.getTransport().bpm.value;
    },

    /**
     * Génère une nouvelle gamme/progression
     */
    newScale() {
      const { randomNote: rn, randomMode: rm } = getRandomScale();
      randomNote = rn;
      randomMode = rm;
      chordsProg = getChordProgression(randomNote, randomMode);
      refreshChordCaches();
      debugLog("New scale:", randomNote, randomMode);
      return { note: randomNote, mode: randomMode };
    },

    /**
     * Obtient la gamme actuelle
     */
    getScale() {
      return { note: randomNote, mode: randomMode };
    },

    /**
     * Régénère tous les patterns rythmiques
     */
    regeneratePatterns() {
      regenerateAllPatterns();
      debugLog("Patterns regenerated");
    },

    /**
     * Régénération complète (gamme + instruments + patterns + BPM)
     */
    regenerateAll() {
      regenerateCompleteSession();
      debugLog("Complete session regenerated");
    },

    /**
     * Active/désactive un instrument
     */
    toggleInstrument(name, state = null) {
      switch (name) {
        case "bass":
          isBassPlay = state !== null ? state : !isBassPlay;
          break;
        case "midline":
        case "mid":
          isMidlinePlay = state !== null ? state : !isMidlinePlay;
          break;
        case "arpegio":
        case "arp":
          isArpegioPlay = state !== null ? state : !isArpegioPlay;
          break;
        case "chords":
          isChordsPlay = state !== null ? state : !isChordsPlay;
          break;
        default:
          console.warn("[MusicEngine] Unknown instrument:", name);
      }
      debugLog("Instrument states:", {
        bass: isBassPlay,
        midline: isMidlinePlay,
        arp: isArpegioPlay,
        chords: isChordsPlay,
      });
      return { isBassPlay, isMidlinePlay, isArpegioPlay, isChordsPlay };
    },

    /**
     * Obtient l'état des instruments
     */
    getInstrumentStates() {
      return { isBassPlay, isMidlinePlay, isArpegioPlay, isChordsPlay };
    },

    /**
     * Gèle/dégèle les variations
     */
    freeze(state = null) {
      freezeVariations = state !== null ? state : !freezeVariations;
      debugLog("Freeze variations:", freezeVariations);
      return freezeVariations;
    },

    /**
     * Active/désactive l'humanisation
     */
    setHumanize(state) {
      humanizeEnabled = state;
      debugLog("Humanize:", humanizeEnabled);
    },

    /**
     * Configure la densité mélodique de l'arpège
     */
    setArpDensity(density) {
      arpegioMotifManager.forceRegenerate(density);
      debugLog("Arp density:", density);
    },

    /**
     * Configure le headroom global (dB)
     */
    setHeadroom(db) {
      setGlobalHeadroom(db);
      debugLog("Headroom:", db, "dB");
    },

    /**
     * Configure la profondeur de reverb
     */
    setReverb(depth) {
      setReverbDepth(depth);
      debugLog("Reverb depth:", depth);
    },

    /**
     * Active/désactive la dérive paramétrique
     */
    setParameterDrift(enabled) {
      paramDriftEnabled = enabled;
      if (paramDrift) {
        if (enabled) paramDrift.start();
        else paramDrift.stop();
      }
      debugLog("Parameter drift:", paramDriftEnabled);
    },

    /**
     * Active/désactive le mode debug
     */
    setDebug(enabled) {
      DEBUG_MUTABLE = enabled;
      return DEBUG_MUTABLE;
    },

    /**
     * Obtient l'état complet du système
     */
    getState() {
      return {
        beatIndex,
        chordIndex,
        loopIndex,
        currentChord: chordsProg.chordProgression[chordIndex],
        scale: { note: randomNote, mode: randomMode },
        bpm: Tone.getTransport().bpm.value,
        instruments: {
          bass: isBassPlay,
          midline: isMidlinePlay,
          arp: isArpegioPlay,
          chords: isChordsPlay,
        },
        arpMotif: arpegioMotifManager.getMotif
          ? arpegioMotifManager.getMotif()
          : [],
        freezeVariations,
        humanizeEnabled,
        paramDriftEnabled,
        peakLevel: audioGraph.meter.getValue(),
        headroom: getCurrentHeadroomDb(),
      };
    },

    /**
     * Expose les synthés pour contrôle avancé
     */
    getSynths() {
      return {
        bass: bassLineSynth,
        subBass: subBassSynth,
        midline: midLineSynth,
        midline2: midLineSynth2,
        arpegio: arpegioSynth,
        chords: chordSynth,
      };
    },

    /**
     * Expose l'audioGraph pour routing avancé
     */
    getAudioGraph() {
      return audioGraph;
    },

    /**
     * Initialise le système
     */
    initialize,
  };
}
