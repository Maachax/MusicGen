function generateConditionalArray(length, probability, valueFunction) {
  const playSequence = [];
  for (let i = 0; i < length; i++) {
    if (Math.random() <= probability) {
      playSequence.push(valueFunction(i));
    }
  }
  return playSequence;
}

export function generateMelodyProbability(size, probability) {
  return generateConditionalArray(size, probability, index => index);
}

export function generateBinaryProbability(size, probability) {
  return generateConditionalArray(size, probability, () => Math.floor(Math.random() * 2));
}