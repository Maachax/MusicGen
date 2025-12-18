export function randomDegreeProgression() {
  const progression = [];
  for (let i = 0; i < 4; i++) {
    progression.push(Math.floor((Math.random() * (1 - 7) + 7)));
  }
  return progression;
}