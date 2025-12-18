// Rhythmic motif generation (interval distribution + controlled mutation)
// Steps assumed: 16 (sixteenth-note grid), but generic param.

function weightedPick(entries) {
  let total = 0;
  for (let i = 0; i < entries.length; i++) total += entries[i].w;
  let r = Math.random() * total;
  for (let i = 0; i < entries.length; i++) {
    r -= entries[i].w;
    if (r <= 0) return entries[i].v;
  }
  return entries[entries.length - 1].v;
}

export function generateRhythmicMotif(
  steps = 16,
  {
    density = 0.35,
    weights = { 1: 1, 2: 2, 3: 3, 4: 4, 6: 2, 8: 1 },
    protectStrongBeats = true,
  } = {}
) {
  const entries = Object.entries(weights).map(([v, w]) => ({ v: +v, w }));
  const motif = [0];
  let pos = 0;

  while (pos < steps) {
    const interval = weightedPick(entries);
    pos += interval;
    if (pos < steps) {
      motif.push(pos);
    }
  }

  // Density adjustment
  const target = Math.round(steps * density);
  // Add notes if too sparse by splitting largest gaps
  while (motif.length < target) {
    let bestGap = -1;
    let bestIdx = -1;
    for (let i = 0; i < motif.length - 1; i++) {
      const gap = motif[i + 1] - motif[i];
      if (gap > bestGap) {
        bestGap = gap;
        bestIdx = i;
      }
    }
    if (bestGap <= 2) break;
    const insertPos = motif[bestIdx] + (bestGap >> 1);
    if (!motif.includes(insertPos)) motif.splice(bestIdx + 1, 0, insertPos);
  }
  // Remove notes if too dense; prefer removing non strong beats
  if (motif.length > target) {
    const strong = new Set([0, 4, 8, 12]);
    while (motif.length > target) {
      const removable = motif.filter(
        (p) => !(protectStrongBeats && strong.has(p))
      );
      if (!removable.length) break;
      const val = removable[(Math.random() * removable.length) | 0];
      const idx = motif.indexOf(val);
      if (idx > -1) motif.splice(idx, 1);
    }
  }

  motif.sort((a, b) => a - b);
  if (motif[0] !== 0) motif.unshift(0);
  return motif;
}

export function mutateMotif(motif, { steps = 16, maxTries = 4 } = {}) {
  if (!motif || motif.length < 2) return motif;
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const idx = 1 + ((Math.random() * (motif.length - 1)) | 0); // skip first (0)
    const dir = Math.random() < 0.5 ? -1 : 1;
    const candidate = motif[idx] + dir;
    if (candidate <= 0 || candidate >= steps) continue;
    if (motif.includes(candidate)) continue;
    motif[idx] = candidate;
    motif.sort((a, b) => a - b);
    return motif;
  }
  return motif; // unchanged
}

function computeStepDurations(motif, steps) {
  if (!motif || motif.length === 0) return [steps];
  const durations = new Array(motif.length);
  for (let i = 0; i < motif.length; i++) {
    const current = motif[i];
    const next = motif[(i + 1) % motif.length];
    let gap = next - current;
    if (gap <= 0) gap += steps;
    durations[i] = gap;
  }
  return durations;
}

export function createMotifManager({
  steps = 16,
  density = 0.35,
  mutateEvery = 64,
  regenEvery = 256,
  mutationProbability = 0.5,
  weights,
} = {}) {
  let motif = generateRhythmicMotif(steps, { density, weights });
  let motifIdx = 0;
  let cycle = 0;
  let durations = computeStepDurations(motif, steps);
  let lastDurationSteps = durations[0] || steps;
  let lastTriggerStep = -1;

  function refreshDurations({ resetIndex = false } = {}) {
    durations = computeStepDurations(motif, steps);
    if (resetIndex) {
      motifIdx = 0;
    } else if (motif.length && motifIdx >= motif.length) {
      motifIdx = motif.length - 1;
    }
    if (!durations.length) {
      lastDurationSteps = steps;
    } else if (lastTriggerStep !== -1) {
      const idx = motif.indexOf(lastTriggerStep);
      lastDurationSteps = idx > -1 ? durations[idx] : durations[0];
    } else {
      lastDurationSteps = durations[Math.min(motifIdx, durations.length - 1)];
    }
  }

  function current() {
    return motif[motifIdx];
  }
  function advanceStep(beatIndex) {
    if (beatIndex === motif[motifIdx]) {
      const triggeredStep = motif[motifIdx];
      lastTriggerStep = triggeredStep;
      lastDurationSteps = durations[motifIdx] || 1;
      motifIdx++;
      if (motifIdx >= motif.length) motifIdx = 0; // loop motif inside measure
      return true;
    }
    return false;
  }
  function tickExternal() {
    cycle++;
    if (cycle % regenEvery === 0) {
      motif = generateRhythmicMotif(steps, { density, weights });
      lastTriggerStep = -1;
      refreshDurations({ resetIndex: true });
    } else if (cycle % mutateEvery === 0) {
      if (Math.random() < mutationProbability) {
        mutateMotif(motif, { steps });
        refreshDurations();
      }
    }
  }
  function getMotif() {
    return motif.slice();
  }
  function forceRegenerate(customDensity = density) {
    motif = generateRhythmicMotif(steps, { density: customDensity, weights });
    lastTriggerStep = -1;
    refreshDurations({ resetIndex: true });
  }
  function lastStepWasActive(step) {
    return lastTriggerStep === step;
  }
  function getLastDurationSteps() {
    return lastDurationSteps;
  }
  return {
    current,
    advanceStep,
    tickExternal,
    getMotif,
    forceRegenerate,
    lastStepWasActive,
    getLastDurationSteps,
  };
}
