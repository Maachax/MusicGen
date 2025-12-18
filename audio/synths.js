import * as Tone from "tone";
import { attachRandomEffects } from "./randomEffectChain";
import { audioGraph } from "./engine";

const waveforms = ["sine", "triangle"]; //, "sawtooth", "square"];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function wrapWithGainAndProxy(node, gainDb) {
  const gain = new Tone.Gain(Tone.dbToGain(gainDb));
  node.connect(gain);
  // Proxy pour exposer toutes les propriétés/méthodes du node + accès au gain
  const proxy = new Proxy(gain, {
    get(target, prop, receiver) {
      if (prop === "_inner") return node;
      if (prop in target) return Reflect.get(target, prop, receiver);
      return node[prop];
    },
    set(target, prop, value, receiver) {
      if (prop in target) return Reflect.set(target, prop, value, receiver);
      node[prop] = value;
      return true;
    },
  });
  return proxy;
}

function mkSynth(options = {}, gainDb = -8) {
  const synth = new Tone.Synth({
    oscillator: { type: pick(waveforms) },
    envelope: { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.8 },
    ...options,
  });
  return wrapWithGainAndProxy(synth, gainDb);
}

// Bass: refactor vers chaîne dédiée plus sombre (lowpass ~900Hz)
const bassInner = new Tone.Synth({
  oscillator: { type: pick(["triangle", "sine"]) },
  envelope: { attack: 0.006, decay: 0.22, sustain: 0.32, release: 0.55 },
});
const bassFilter = new Tone.Filter({
  type: "lowpass",
  frequency: 900,
  rolloff: -24,
  Q: 0.2,
});
const bassGain = new Tone.Gain(Tone.dbToGain(-7));
bassInner.chain(bassFilter, bassGain);
const bassLineSynth = new Proxy(bassGain, {
  get(target, prop, receiver) {
    if (prop === "_inner") return bassInner;
    if (prop === "filter") return bassFilter;
    if (prop in target) return Reflect.get(target, prop, receiver);
    const val = bassInner[prop];
    return typeof val === "function" ? val.bind(bassInner) : val;
  },
  set(target, prop, value, receiver) {
    if (prop in target) return Reflect.set(target, prop, value, receiver);
    bassInner[prop] = value;
    return true;
  },
});
bassLineSynth.connect(audioGraph.dryBus);
if (audioGraph.optional.reverb)
  bassLineSynth.connect(audioGraph.optional.reverb);
if (audioGraph.optional.longReverb)
  bassLineSynth.connect(audioGraph.optional.longReverb);
attachRandomEffects(bassLineSynth, { max: 8 });

// Sub bass layer (pure sine lowpassed) pour profondeur
const subBassInner = new Tone.Synth({
  oscillator: { type: "sine" },
  envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.8 },
  // volume: -4,
});
const subLowpass = new Tone.Filter({
  type: "lowpass",
  frequency: 160,
  rolloff: -24,
  Q: 0.7,
});
const subGain = new Tone.Gain(Tone.dbToGain(-12)); // contrôlé par API
subBassInner.chain(subLowpass, subGain);
subGain.connect(audioGraph.dryBus);
if (audioGraph.optional.reverb) subGain.connect(audioGraph.optional.reverb);
if (audioGraph.optional.longReverb)
  subGain.connect(audioGraph.optional.longReverb);
// Sub-layer trempe désormais aussi dans les grandes reverbs pour atmosphère immense
function setSubBassLevel(db = -12) {
  subGain.gain.rampTo(Tone.dbToGain(db), 0.3);
}

// Mid voices (softened): filtered gentle synth
// Chaîne custom: Synth -> Lowpass Filter (2kHz) -> Gentle Gain proxy
const midLineInner = new Tone.Synth({
  oscillator: { type: pick(["sine", "triangle"]) },
  envelope: { attack: 0.035, decay: 0.5, sustain: 0.55, release: 1.4 },
});
const midLineFilter = new Tone.Filter({
  type: "lowpass",
  frequency: 2000, // coupe les aiguës agressives
  rolloff: -24,
  Q: 0.4,
});
const midLineGain = new Tone.Gain(Tone.dbToGain(-16));
midLineInner.connect(midLineFilter);
midLineFilter.connect(midLineGain);
// Proxy similaire au pattern arp pour exposer synth interne
const midLineSynth = new Proxy(midLineGain, {
  get(target, prop, receiver) {
    if (prop === "_inner") return midLineInner;
    if (prop === "filter") return midLineFilter;
    if (prop in target) return Reflect.get(target, prop, receiver);
    const val = midLineInner[prop];
    return typeof val === "function" ? val.bind(midLineInner) : val;
  },
  set(target, prop, value, receiver) {
    if (prop in target) return Reflect.set(target, prop, value, receiver);
    midLineInner[prop] = value;
    return true;
  },
});
// Routing effets: limiter à reverb légère seulement pour conserver douceur
midLineSynth.connect(audioGraph.dryBus);
if (audioGraph.optional.reverb)
  midLineSynth.connect(audioGraph.optional.reverb);
if (audioGraph.optional.longReverb)
  midLineSynth.connect(audioGraph.optional.longReverb);

// Second midline voice (accents) reuse original mkSynth but slightly softer
const midLineSynth2 = mkSynth(
  {
    envelope: { attack: 0.04, decay: 0.55, sustain: 0.45, release: 1.2 },
  },
  -15
);
attachRandomEffects(midLineSynth2, { max: 8 });
if (audioGraph.optional.reverb)
  midLineSynth2.connect(audioGraph.optional.reverb);
if (audioGraph.optional.longReverb)
  midLineSynth2.connect(audioGraph.optional.longReverb);

// Arp (version douce filtrée)
// Chaîne: Synth (triangle/sine) -> Lowpass Filter doux -> Gain proxy
const arpFilter = new Tone.Filter({
  type: "lowpass",
  frequency: 3500, // coupe légèrement les harmoniques
  rolloff: -24,
  Q: 0.5,
});
const arpegioSynthInner = new Tone.Synth({
  oscillator: { type: pick(["sine", "triangle"]) },
  envelope: {
    attack: 0.025,
    decay: 0.45,
    sustain: 0.55,
    release: 1.9,
  },
  volume: -2,
});
// Chaînage explicite Synth -> Filter -> Gain et proxy sur Synth (pour garder triggerAttackRelease)
const arpGain = new Tone.Gain(Tone.dbToGain(-10));
arpegioSynthInner.connect(arpFilter);
arpFilter.connect(arpGain);
const arpegioSynth = new Proxy(arpGain, {
  get(target, prop, receiver) {
    if (prop === "_inner") return arpegioSynthInner;
    if (prop === "filter") return arpFilter;
    if (prop in target) return Reflect.get(target, prop, receiver);
    const val = arpegioSynthInner[prop];
    return typeof val === "function" ? val.bind(arpegioSynthInner) : val;
  },
  set(target, prop, value, receiver) {
    if (prop in target) return Reflect.set(target, prop, value, receiver);
    arpegioSynthInner[prop] = value;
    return true;
  },
});
// Routage effets: reverb + delay + vibrato (pas de chorus pour conserver douceur)
arpegioSynth.connect(audioGraph.dryBus);
if (audioGraph.optional.reverb)
  arpegioSynth.connect(audioGraph.optional.reverb);
if (audioGraph.optional.longReverb)
  arpegioSynth.connect(audioGraph.optional.longReverb);
if (audioGraph.optional.delay) arpegioSynth.connect(audioGraph.optional.delay);
if (audioGraph.optional.vibrato)
  arpegioSynth.connect(audioGraph.optional.vibrato);

// Chords poly (limiter la densité)
const chordSynthInner = new Tone.PolySynth(Tone.Synth, {
  maxPolyphony: 4,
  oscillator: { type: pick(waveforms) },
  envelope: { attack: 0.2, decay: 0.9, sustain: 0.6, release: 1.5 },
});
const chordSynth = wrapWithGainAndProxy(chordSynthInner, -8);
attachRandomEffects(chordSynth, { max: 8 });
if (audioGraph.optional.reverb) chordSynth.connect(audioGraph.optional.reverb);
if (audioGraph.optional.longReverb)
  chordSynth.connect(audioGraph.optional.longReverb);

// Fonction pour régénérer les instruments avec nouvelles formes d'onde aléatoires
function regenerateInstruments() {
  // Régénère bass
  bassLineSynth._inner.oscillator.type = pick(["triangle", "sine"]);

  // Régénère midlines
  midLineSynth._inner.oscillator.type = pick(["sine", "triangle"]);
  midLineSynth2._inner.oscillator.type = pick(waveforms);

  // Régénère arp (oscillateur interne)
  arpegioSynthInner.oscillator.type = pick(["sine", "triangle"]);
  // Varie légèrement le filtre
  arpFilter.frequency.value = 3000 + Math.random() * 1500; // 3000-4500 Hz
  arpFilter.Q.value = 0.3 + Math.random() * 0.4; // 0.3-0.7

  // Régénère chords
  chordSynthInner.options.oscillator.type = pick(waveforms);

  debugLog && debugLog("Instruments régénérés avec nouvelles formes d'onde");
}

export {
  bassLineSynth,
  subBassInner as subBassSynth,
  midLineSynth,
  midLineSynth2,
  arpegioSynth,
  chordSynth,
  regenerateInstruments,
  setSubBassLevel,
};
