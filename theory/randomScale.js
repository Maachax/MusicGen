import { Mode } from "tonal";

const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

export function getRandomScale() {
    const randomNote = notes[Math.floor(Math.random() * notes.length)];
    const randomMode =
      Mode.names()[Math.floor(Math.random() * Mode.names().length)];
      console.log(randomNote, randomMode)
    return { randomNote, randomMode };
}
