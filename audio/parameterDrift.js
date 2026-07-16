import * as Tone from "tone";

/*
  Parameter Drift Engine
  --------------------------------------------------
  Creates slow, musical random wandering of selected parameters.
  Each target has:
    - getter(): returns current numeric value
    - apply(v): applies a new numeric value (uses rampTo if available)
    - range: [min, max]
    - stepMeasures: random integer/min-max range for when to choose a new target
    - rampMeasures: range for ramp duration (musical smoothing)

  Transport-based scheduling: uses Tone.Transport.scheduleRepeat at measure resolution.
*/

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}
function pickRange([a, b]) {
  return a + Math.random() * (b - a);
}
function pickIntRange([a, b]) {
  return Math.floor(a + Math.random() * (b - a + 1));
}

export function createParameterDrift(opts) {
  const {
    measureInterval = 1, // check every measure
    getTransport = () => Tone.getTransport(),
    debug = false,
    immediateFirstApply = true,
  } = opts || {};

  const targets = [];
  let started = false;
  let scheduledId = null;
  let measureCounter = 0;

  function log(...args) {
    if (debug) console.log("[Drift]", ...args);
  }

  function addTarget(def) {
    if (debug) console.log("[Drift] Adding target", def.name);
    const t = {
      ...def,
      nextAt: 0,
      currentTarget: null,
    };
    scheduleNext(t, true);
    // Optionnel: appliquer immédiatement une première dérive douce
    if (immediateFirstApply) {
      // mini ramp 0.5 mesure pour première transition
      const nowVal = t.getter();
      const firstTarget = clamp(pickRange(t.range), t.range[0], t.range[1]);
      t.currentTarget = firstTarget;
      const rampM = 0.5;
      const durSec = rampM * (60 / getTransport().bpm.value) * 4;
      try {
        t.apply(firstTarget, durSec);
        log(
          "initial",
          t.name,
          "from",
          nowVal.toFixed(3),
          "to",
          firstTarget.toFixed(3)
        );
      } catch (e) {
        log("initial apply error", t.name, e);
      }
    }
    targets.push(t);
    return api;
  }

  function scheduleNext(t, initial = false) {
    const stepM = Array.isArray(t.stepMeasures)
      ? pickIntRange(t.stepMeasures)
      : t.stepMeasures;
    t.nextAt = measureCounter + stepM;
    if (initial) t.currentTarget = t.getter();
  }

  function applyRamp(t) {
    const nowVal = t.getter();
    const newTarget = clamp(pickRange(t.range), t.range[0], t.range[1]);
    t.currentTarget = newTarget;
    const rampM = Array.isArray(t.rampMeasures)
      ? pickRange(t.rampMeasures)
      : t.rampMeasures;
    const durSec = rampM * (60 / getTransport().bpm.value) * 4; // 1 measure = 4 beats
    try {
      t.apply(newTarget, durSec);
      log(
        "param",
        t.name,
        "from",
        nowVal.toFixed(3),
        "to",
        newTarget.toFixed(3),
        `(${rampM.toFixed(2)}m)`
      );
    } catch (e) {
      log("error applying", t.name, e);
    }
    scheduleNext(t);
  }

  function tick() {
    measureCounter++;
    for (const t of targets) {
      if (measureCounter >= t.nextAt) {
        applyRamp(t);
      }
    }
  }

  function start() {
    if (started) return api;
    started = true;
    // Schedule per measure
    scheduledId = getTransport().scheduleRepeat(() => tick(), "1m");
    log("started");
    return api;
  }

  function stop() {
    if (!started) return api;
    if (scheduledId != null) getTransport().clear(scheduledId);
    scheduledId = null;
    started = false;
    log("stopped");
    return api;
  }

  function dispose() {
    stop();
    targets.splice(0, targets.length);
  }

  const api = {
    addTarget,
    start,
    stop,
    dispose,
    getTargets: () => targets.slice(),
    nudgeAll: () => targets.forEach((t) => applyRamp(t)),
  };
  return api;
}
