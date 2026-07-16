import { debugLog } from "../utils/log.js";

// Pool élargi (pondérations simples). Clés = nom effet, val = poids de sélection.
const EFFECT_POOL = {
  reverb: 3,
  longReverb: 1, // moins fréquent
  delay: 2,
  vibrato: 2,
  chorus: 1, // un peu moins pour limiter coloration
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function weightedPick(list, totalWeight) {
  let r = Math.random() * totalWeight;
  for (const item of list) {
    r -= item.w;
    if (r <= 0) return item.n;
  }
  return list[list.length - 1].n;
}

export function pickEffectSubset(max = 2) {
  const entries = Object.entries(EFFECT_POOL).map(([n, w]) => ({ n, w }));
  const total = entries.reduce((a, e) => a + e.w, 0);
  const chosen = new Set();
  const targetCount =
    1 + Math.floor(Math.random() * Math.min(max, entries.length));
  let safety = 20;
  while (chosen.size < targetCount && safety-- > 0) {
    const pickName = weightedPick(entries, total);
    // Éviter d'empiler 2 reverbs longues simultanément
    if (pickName === "longReverb" && chosen.has("reverb")) continue;
    if (pickName === "reverb" && chosen.has("longReverb")) continue;
    chosen.add(pickName);
  }
  return Array.from(chosen);
}

// Pour éviter empilements multiples, on mémorise les effets déjà attachés sur un synth donné.
const __effectRegistry = new WeakMap();
export function attachRandomEffects(synth, { max = 2, audioGraph } = {}) {
  if (!audioGraph) {
    console.warn("[attachRandomEffects] audioGraph requis, effets ignorés");
    return;
  }
  let attached = __effectRegistry.get(synth);
  if (!attached) {
    attached = new Set();
    __effectRegistry.set(synth, attached);
  }
  // Dry une seule fois
  if (!attached.has("__dry__")) {
    synth.connect(audioGraph.dryBus);
    attached.add("__dry__");
  }
  // Ne ré-attache pas si déjà plein
  if (attached.size - 1 >= max) return;
  const remainingSlots = Math.max(0, max - (attached.size - 1));
  if (!remainingSlots) return;
  const chosen = pickEffectSubset(remainingSlots).filter(
    (n) => !attached.has(n)
  );
  chosen.forEach((name) => {
    const eff = audioGraph.optional[name];
    if (eff) {
      synth.connect(eff);
      attached.add(name);
    }
  });
  debugLog("Attached effects (new):", chosen, "total now", attached);
}
