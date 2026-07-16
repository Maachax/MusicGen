export function randomDegreeProgression() {
  const progression = [];
  for (let i = 0; i < 4; i++) {
    progression.push(Math.floor(Math.random() * 7) + 1);
  }
  return progression;
}