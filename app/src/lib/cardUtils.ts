export type ImportedCardData = {
  options: string[];
  correctAnswer: string;
};

export function parseImportedCard(back: string): ImportedCardData | null {
  const correctMatch = back.match(/\nCorrect:\s*([a-d])\s*$/);
  if (!correctMatch) return null;

  const optionsText = back.substring(0, correctMatch.index).trim();
  const options: string[] = [];
  const regex = /^([a-d])\)\s*(.+)$/gm;
  let match;
  while ((match = regex.exec(optionsText)) !== null) {
    options.push(`${match[1]}) ${match[2].trim()}`);
  }

  if (options.length !== 4) return null;
  return { options, correctAnswer: correctMatch[1] };
}

export function formatCardBack(card: { options: string[]; correctAnswer: string }): string {
  return card.options.join('\n') + '\n\nCorrect: ' + card.correctAnswer;
}
