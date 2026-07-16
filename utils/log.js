// Logging debug partagé par tous les modules.
// Activé via setDebugLogging(true) — l'API moteur setDebug() le pilote.
let debugEnabled = false;

export function setDebugLogging(enabled) {
  debugEnabled = !!enabled;
}

export function isDebugLogging() {
  return debugEnabled;
}

export function debugLog(...args) {
  if (debugEnabled) console.log(...args);
}
