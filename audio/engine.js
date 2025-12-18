import * as Tone from "tone";

// NOTE: Dans les versions récentes de Tone.js, context.latencyHint et lookAhead
// sont en lecture seule une fois le contexte créé. Pour ajuster la latence,
// il faut soit:
//  - passer par Tone.setContext(new Tone.Context({ latencyHint: "balanced" })) AVANT toute instanciation
//  - ou utiliser des stratégies internes (scheduling lookAhead via Tone.getTransport().lookAhead)
// Ici on laisse les valeurs par défaut pour éviter l'erreur runtime.

// Headroom global (gain en dB converti plus tard si besoin), limiter pour éviter clipping
// Augmenter headroom initial à -10 dB pour réduire risques de pompage/écrêtage
const bus = new Tone.Gain(Tone.dbToGain(-10));

// Sous-bus dry (tous les synths se branchent dessus) avant envoi vers les effets parallèles
const dryBus = new Tone.Gain(1).connect(bus);

// Effets réutilisables (ne pas recréer en boucle) + leur gain wet dédié
// Style A: très large et éthéré
const reverb = new Tone.Reverb({
  decay: 6,
  wet: 1,
  preDelay: 0.05,
  dampening: 2800,
});
const reverbHP = new Tone.Filter({ type: "highpass", frequency: 220, Q: 0.7 });
const reverbLP = new Tone.Filter({ type: "lowpass", frequency: 4800, Q: 0.4 });
const reverbWet = new Tone.Gain(0.78).connect(bus);
reverb.chain(reverbHP, reverbLP, reverbWet);

// Long Hall reverb boostée (lush)
const longReverb = new Tone.Reverb({
  decay: 9,
  wet: 1,
  preDelay: 0.08,
  dampening: 3400,
});
const longRevHP = new Tone.Filter({ type: "highpass", frequency: 180, Q: 0.6 });
const longRevLP = new Tone.Filter({
  type: "lowpass",
  frequency: 4200,
  Q: 0.45,
});
const longReverbWet = new Tone.Gain(0.74).connect(bus);
longReverb.chain(longRevHP, longRevLP, longReverbWet);

// Delay feedback modéré pour échos rythmiques subtils
const delay = new Tone.FeedbackDelay({
  delayTime: 0.25,
  feedback: 0.3,
  wet: 1,
});
const delayWet = new Tone.Gain(0.16).connect(bus);
delay.connect(delayWet);

// Vibrato doux (pitch modulation lente)
const vibrato = new Tone.Vibrato({ frequency: 5, depth: 0.15, wet: 1 });
const vibratoWet = new Tone.Gain(0.2).connect(bus);
vibrato.connect(vibratoWet);

const chorus = new Tone.Chorus({ frequency: 1.2, depth: 0.4, wet: 1 }).start();
const chorusWet = new Tone.Gain(0.16).connect(bus);
chorus.connect(chorusWet);

const bitCrusher = new Tone.BitCrusher(6); // 6 bits = couleur mais pas bruit extrême
const bitCrusherWet = new Tone.Gain(0.12).connect(bus);
bitCrusher.connect(bitCrusherWet);

const dist = new Tone.Distortion(0.25);
const distWet = new Tone.Gain(0.08).connect(bus);
dist.connect(distWet);
const lowpass = new Tone.Filter(9000, "lowpass");
const comp = new Tone.Compressor({
  threshold: -18,
  ratio: 3,
  attack: 0.01,
  release: 0.25,
});
const limiter = new Tone.Limiter(-1);
const meter = new Tone.Meter();

// Chaîne principale: bus -> tone shaping -> comp -> limiter -> destination
bus.chain(lowpass, comp, limiter, Tone.getDestination());

// Les effets reçoivent des signaux des synths (qui se connectent sur leur entrée) et renvoient leur wet vers bus via leurs gains respectifs.

// Mesure niveau
bus.connect(meter);

export const audioGraph = {
  bus,
  dryBus,
  optional: { reverb, longReverb, delay, vibrato, chorus, bitCrusher, dist },
  wet: {
    reverb: reverbWet,
    longReverb: longReverbWet,
    delay: delayWet,
    vibrato: vibratoWet,
    chorus: chorusWet,
    bitCrusher: bitCrusherWet,
    dist: distWet,
  },
  lowpass,
  comp,
  limiter,
  meter,
};

export function setGlobalHeadroom(db = -6) {
  bus.gain.rampTo(Tone.dbToGain(db), 0.05);
}

export function setEffectWet(effectName, linearValue) {
  const g = audioGraph.wet[effectName];
  if (g) g.gain.rampTo(linearValue, 0.1);
}

// Depth factor applique sur combos reverb/longReverb (wet + decay scaling partiel)
export function setReverbDepth(factor = 1) {
  factor = Math.max(0, factor);
  const baseShort = 6;
  const baseLong = 9;
  const shortDecay = Math.min(baseShort + factor * 3.5, 12);
  const longDecay = Math.min(baseLong + factor * 4.5, 16);
  reverb.decay = shortDecay;
  longReverb.decay = longDecay;
  const wetScale = Math.min(1.4, 1 + factor * 0.4);
  audioGraph.wet.reverb.gain.rampTo(0.78 * wetScale, 0.35);
  audioGraph.wet.longReverb.gain.rampTo(0.74 * wetScale, 0.45);
  const shortDamp = Math.max(1700, 2800 - factor * 350);
  const longDamp = Math.max(1900, 3400 - factor * 420);
  reverb.dampening = shortDamp;
  longReverb.dampening = longDamp;
  const shortLP = Math.max(3000, 4800 - factor * 420);
  const longLP = Math.max(2600, 4200 - factor * 480);
  reverbLP.frequency.rampTo(shortLP, 0.35);
  longRevLP.frequency.rampTo(longLP, 0.45);
}

export function getMeterLevel() {
  // Valeur ~ -60 silencieux à 0 dBFS
  return meter.getValue();
}

export function initAudioTransport() {
  if (!Tone.Transport.state || Tone.Transport.state === "stopped") {
    Tone.Transport.bpm.value = 100;
  }
}

// ========= Auto Headroom Guard (optionnel) =========
let headroomGuard = { enabled: false, schedId: null };
export function enableAutoHeadroom(
  enable = true,
  { targetPeakDb = -6, sampleInterval = "8n", minGainDb = -22, stepDb = 1 } = {}
) {
  if (enable && !headroomGuard.enabled) {
    headroomGuard.enabled = true;
    headroomGuard.schedId = Tone.Transport.scheduleRepeat(() => {
      const meterDb = getMeterLevel();
      // meterDb proche de 0 = très fort
      if (meterDb > targetPeakDb + 0.5) {
        // Réduire bus gain d'un petit pas
        const currentLinear = bus.gain.value;
        const currentDb = Tone.gainToDb(currentLinear);
        if (currentDb > minGainDb) {
          const nextDb = Math.max(minGainDb, currentDb - stepDb);
          bus.gain.rampTo(Tone.dbToGain(nextDb), 0.25);
          if (typeof debugLog === "function")
            debugLog(
              "AutoHeadroom: peak",
              meterDb.toFixed(1),
              ">",
              targetPeakDb,
              "→",
              nextDb.toFixed(1),
              "dB"
            );
        }
      }
    }, sampleInterval);
  } else if (!enable && headroomGuard.enabled) {
    if (headroomGuard.schedId) Tone.Transport.clear(headroomGuard.schedId);
    headroomGuard = { enabled: false, schedId: null };
  }
}

export function getCurrentHeadroomDb() {
  return Tone.gainToDb(bus.gain.value);
}
