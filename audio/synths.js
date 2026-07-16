import * as Tone from "tone";
import { attachRandomEffects } from "./randomEffectChain.js";

const waveforms = ["sine", "triangle"]; //, "sawtooth", "square"];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Wrapper explicite (remplace les anciens Proxy): chaîne Synth -> [Filter] -> Gain.
// La sortie de l'instrument est le gain; le synth interne reste accessible
// via .synth pour la régénération de timbre, le filtre via .filter pour le drift.
function createInstrument(synth, { gainDb = -8, filter = null } = {}) {
  const gain = new Tone.Gain(Tone.dbToGain(gainDb));
  if (filter) {
    synth.chain(filter, gain);
  } else {
    synth.connect(gain);
  }
  return {
    synth,
    filter,
    gain,
    connect(destination) {
      gain.connect(destination);
      return this;
    },
    triggerAttackRelease(...args) {
      return synth.triggerAttackRelease(...args);
    },
  };
}

// Construction paresseuse: les instruments sont créés et routés sur le graphe
// passé en paramètre (voir createAudioGraph), pas à l'import du module.
export function createSynths(audioGraph) {
  const { dryBus, optional } = audioGraph;

  function route(inst, effectNames) {
    inst.connect(dryBus);
    for (const name of effectNames) {
      if (optional[name]) inst.connect(optional[name]);
    }
  }

  // Bass: chaîne dédiée plus sombre (lowpass ~900Hz)
  const bassLineSynth = createInstrument(
    new Tone.Synth({
      oscillator: { type: pick(["triangle", "sine"]) },
      envelope: { attack: 0.006, decay: 0.22, sustain: 0.32, release: 0.55 },
    }),
    {
      gainDb: -7,
      filter: new Tone.Filter({
        type: "lowpass",
        frequency: 900,
        rolloff: -24,
        Q: 0.2,
      }),
    }
  );
  route(bassLineSynth, ["reverb", "longReverb"]);
  attachRandomEffects(bassLineSynth, { max: 8, audioGraph });

  // Sub bass layer (pure sine lowpassed) pour profondeur
  // Trempe aussi dans les grandes reverbs pour atmosphère immense
  const subBassSynth = createInstrument(
    new Tone.Synth({
      oscillator: { type: "sine" },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.8 },
    }),
    {
      gainDb: -12, // contrôlé par setSubBassLevel
      filter: new Tone.Filter({
        type: "lowpass",
        frequency: 160,
        rolloff: -24,
        Q: 0.7,
      }),
    }
  );
  route(subBassSynth, ["reverb", "longReverb"]);

  function setSubBassLevel(db = -12) {
    subBassSynth.gain.gain.rampTo(Tone.dbToGain(db), 0.3);
  }

  // Mid voice (softened): Synth -> Lowpass 2kHz -> Gain
  const midLineSynth = createInstrument(
    new Tone.Synth({
      oscillator: { type: pick(["sine", "triangle"]) },
      envelope: { attack: 0.035, decay: 0.5, sustain: 0.55, release: 1.4 },
    }),
    {
      gainDb: -16,
      filter: new Tone.Filter({
        type: "lowpass",
        frequency: 2000, // coupe les aiguës agressives
        rolloff: -24,
        Q: 0.4,
      }),
    }
  );
  // Routing effets: reverbs seulement pour conserver douceur
  route(midLineSynth, ["reverb", "longReverb"]);

  // Second midline voice (accents), un peu plus douce
  const midLineSynth2 = createInstrument(
    new Tone.Synth({
      oscillator: { type: pick(waveforms) },
      envelope: { attack: 0.04, decay: 0.55, sustain: 0.45, release: 1.2 },
    }),
    { gainDb: -15 }
  );
  route(midLineSynth2, ["reverb", "longReverb"]);
  attachRandomEffects(midLineSynth2, { max: 8, audioGraph });

  // Arp (version douce filtrée): Synth -> Lowpass 3.5kHz -> Gain
  const arpegioSynth = createInstrument(
    new Tone.Synth({
      oscillator: { type: pick(["sine", "triangle"]) },
      envelope: { attack: 0.025, decay: 0.45, sustain: 0.55, release: 1.9 },
      volume: -2,
    }),
    {
      gainDb: -10,
      filter: new Tone.Filter({
        type: "lowpass",
        frequency: 3500, // coupe légèrement les harmoniques
        rolloff: -24,
        Q: 0.5,
      }),
    }
  );
  // Routage effets: reverb + delay + vibrato (pas de chorus pour conserver douceur)
  route(arpegioSynth, ["reverb", "longReverb", "delay", "vibrato"]);

  // Régénère les instruments avec de nouvelles formes d'onde aléatoires
  function regenerateInstruments() {
    bassLineSynth.synth.oscillator.type = pick(["triangle", "sine"]);
    midLineSynth.synth.oscillator.type = pick(["sine", "triangle"]);
    midLineSynth2.synth.oscillator.type = pick(waveforms);
    arpegioSynth.synth.oscillator.type = pick(["sine", "triangle"]);
    // Varie légèrement le filtre de l'arpège
    arpegioSynth.filter.frequency.value = 3000 + Math.random() * 1500; // 3000-4500 Hz
    arpegioSynth.filter.Q.value = 0.3 + Math.random() * 0.4; // 0.3-0.7
  }

  return {
    bassLineSynth,
    subBassSynth,
    midLineSynth,
    midLineSynth2,
    arpegioSynth,
    regenerateInstruments,
    setSubBassLevel,
  };
}
