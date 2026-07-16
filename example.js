/**
 * EXEMPLE D'UTILISATION MINIMALE
 * ===============================
 * Démo basique du moteur de génération musicale
 */

import * as Tone from "tone";
import { createMusicEngine } from "./core/musicEngine.js";

// ========================
// 1. CRÉATION DU MOTEUR
// ========================
const engine = createMusicEngine({
  bpm: 95,
  debug: true,
  humanize: true,
  reverbDepth: 2,
  globalHeadroom: -10,
});

// Initialisation du système
engine.initialize();

// ========================
// 2. DÉMARRAGE (USER GESTURE REQUIS)
// ========================
const startScreen = document.getElementById("start-screen");
if (startScreen) {
  startScreen.addEventListener(
    "click",
    async () => {
      try {
        await Tone.start();
        console.log("Audio context started");

        // Hide start screen
        startScreen.style.display = "none";

        // Start the engine
        engine.start();
        console.log("Music engine started");
      } catch (error) {
        console.error("Failed to start audio:", error);
      }
    },
    { once: true }
  );
}

// ========================
// 3. INTERFACE DE CONTRÔLE SIMPLE
// ========================
function createSimpleUI() {
  const container = document.createElement("div");
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 20px;
    border-radius: 8px;
    font-family: monospace;
    font-size: 14px;
    max-width: 300px;
    z-index: 1000;
  `;

  container.innerHTML = `
    <h3 style="margin: 0 0 15px 0;">🎵 Music Engine</h3>
    
    <div style="margin-bottom: 10px;">
      <strong>Cliquez n'importe où pour démarrer</strong>
    </div>
    
    <div style="margin-bottom: 15px;">
      <label>
        BPM: <span id="bpm-value">95</span>
        <input type="range" id="bpm-slider" min="60" max="140" value="95" style="width: 100%;">
      </label>
    </div>
    
    <div style="margin-bottom: 15px;">
      <label>
        <input type="checkbox" id="bass-toggle" checked> Bass
      </label><br>
      <label>
        <input type="checkbox" id="mid-toggle" checked> Midline
      </label><br>
      <label>
        <input type="checkbox" id="arp-toggle" checked> Arpegio
      </label>
    </div>
    
    <div style="margin-bottom: 15px;">
      <label>
        Arp Density: <span id="density-value">0.40</span>
        <input type="range" id="density-slider" min="0" max="1" step="0.05" value="0.4" style="width: 100%;">
      </label>
    </div>
    
    <button id="new-scale-btn" style="width: 100%; margin-bottom: 8px; padding: 8px;">
      🎲 Nouvelle Gamme
    </button>
    
    <button id="regen-patterns-btn" style="width: 100%; margin-bottom: 8px; padding: 8px;">
      🔄 Regénérer Patterns
    </button>
    
    <button id="regen-all-btn" style="width: 100%; margin-bottom: 8px; padding: 8px;">
      ♻️ Tout Régénérer
    </button>
    
    <button id="freeze-btn" style="width: 100%; margin-bottom: 15px; padding: 8px;">
      ❄️ Freeze Variations
    </button>
    
    <div id="state-display" style="
      background: rgba(255, 255, 255, 0.1);
      padding: 10px;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.5;
    ">
      <div>Scale: <span id="scale-info">-</span></div>
      <div>Chord: <span id="chord-info">-</span></div>
      <div>Beat: <span id="beat-info">-</span></div>
    </div>
  `;

  document.body.appendChild(container);

  // Event listeners
  document.getElementById("bpm-slider").addEventListener("input", (e) => {
    const bpm = parseInt(e.target.value);
    engine.setBpm(bpm);
    document.getElementById("bpm-value").textContent = bpm;
  });

  document.getElementById("bass-toggle").addEventListener("change", (e) => {
    engine.toggleInstrument("bass", e.target.checked);
  });

  document.getElementById("mid-toggle").addEventListener("change", (e) => {
    engine.toggleInstrument("midline", e.target.checked);
  });

  document.getElementById("arp-toggle").addEventListener("change", (e) => {
    engine.toggleInstrument("arp", e.target.checked);
  });

  document.getElementById("density-slider").addEventListener("input", (e) => {
    const density = parseFloat(e.target.value);
    engine.setArpDensity(density);
    document.getElementById("density-value").textContent = density.toFixed(2);
  });

  document.getElementById("new-scale-btn").addEventListener("click", () => {
    const scale = engine.newScale();
    updateStateDisplay();
  });

  document
    .getElementById("regen-patterns-btn")
    .addEventListener("click", () => {
      engine.regeneratePatterns();
    });

  document.getElementById("regen-all-btn").addEventListener("click", () => {
    engine.regenerateAll();
    updateStateDisplay();
  });

  let frozen = false;
  document.getElementById("freeze-btn").addEventListener("click", (e) => {
    frozen = engine.freeze();
    e.target.textContent = frozen ? "🔥 Unfreeze" : "❄️ Freeze Variations";
  });

  // Mise à jour de l'affichage toutes les 500ms
  function updateStateDisplay() {
    const state = engine.getState();
    document.getElementById(
      "scale-info"
    ).textContent = `${state.scale.note} ${state.scale.mode}`;
    document.getElementById("chord-info").textContent =
      state.currentChord || "-";
    document.getElementById(
      "beat-info"
    ).textContent = `${state.beatIndex} (${state.loopIndex})`;
  }

  setInterval(updateStateDisplay, 500);
}

createSimpleUI();

// ========================
// 4. API CONSOLE POUR DEBUG
// ========================
window.musicEngine = engine;

console.log(`
╔════════════════════════════════════════╗
║   MUSIC ENGINE - API CONSOLE           ║
╚════════════════════════════════════════╝

Commandes disponibles:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
musicEngine.start()          - Démarre le moteur
musicEngine.stop()           - Arrête le moteur
musicEngine.pause()          - Met en pause
musicEngine.resume()         - Reprend

musicEngine.setBpm(120)      - Change le BPM
musicEngine.newScale()       - Nouvelle gamme
musicEngine.regenerateAll()  - Régénère tout

musicEngine.toggleInstrument("bass")
musicEngine.toggleInstrument("arp")
musicEngine.setArpDensity(0.6)

musicEngine.freeze()         - Gèle les variations
musicEngine.setHumanize(true)
musicEngine.setDebug(true)

musicEngine.getState()       - État complet
musicEngine.getScale()       - Gamme actuelle
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
