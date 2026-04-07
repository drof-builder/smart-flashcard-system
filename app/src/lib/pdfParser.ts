export type ParsedCard = {
  questionNumber: number;
  front: string;
  options: string[];
  correctAnswer: string;
};

export function splitIntoQuestionBlocks(text: string): { num: number; body: string }[] {
  const parts = text.split(/Q(\d+)\.\s*\n/);
  const questions: { num: number; body: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const num = parseInt(parts[i], 10);
    const body = parts[i + 1]?.trim() ?? '';
    if (body) questions.push({ num, body });
  }
  return questions;
}

export function extractQuestionAndOptions(
  body: string
): { questionText: string; options: string[] } | null {
  const firstOption = body.match(/(?:^|\n)\s*a\)/);
  if (!firstOption || firstOption.index === undefined) return null;

  const rawQuestion = body.substring(0, firstOption.index);
  const questionText = rawQuestion.replace(/\s+/g, ' ').trim();
  const optionsSection = body.substring(firstOption.index);

  const optionStarts: { letter: string; startIndex: number; contentStart: number }[] = [];
  const regex = /(?:^|\n)\s*([a-d])\)\s*/gm;
  let match;
  while ((match = regex.exec(optionsSection)) !== null) {
    optionStarts.push({
      letter: match[1],
      startIndex: match.index,
      contentStart: match.index + match[0].length,
    });
  }

  if (optionStarts.length !== 4) return null;
  if (optionStarts.map(o => o.letter).join('') !== 'abcd') return null;

  const options: string[] = [];
  for (let i = 0; i < optionStarts.length; i++) {
    const start = optionStarts[i].contentStart;
    const end =
      i + 1 < optionStarts.length ? optionStarts[i + 1].startIndex : optionsSection.length;
    const content = optionsSection.substring(start, end).replace(/\s+/g, ' ').trim();
    options.push(`${optionStarts[i].letter}) ${content}`);
  }

  return { questionText, options };
}

export function parseAnswerText(text: string): Map<number, string> {
  const answers = new Map<number, string>();
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  for (let i = 0; i < lines.length - 1; i++) {
    const num = parseInt(lines[i], 10);
    if (isNaN(num) || num < 1 || num > 200 || String(num) !== lines[i]) continue;
    const nextLine = lines[i + 1];
    if (/^[a-d]$/.test(nextLine)) {
      answers.set(num, nextLine);
      i++;
    }
  }

  return answers;
}

export function shouldSkipQuestion(text: string): boolean {
  return /\bFig\./i.test(text);
}

export function buildParsedCards(
  questions: { num: number; body: string }[],
  answers: Map<number, string>
): { cards: ParsedCard[]; skipped: number } {
  const cards: ParsedCard[] = [];
  let skipped = 0;

  for (const q of questions) {
    const answer = answers.get(q.num);
    if (!answer) {
      skipped++;
      continue;
    }

    const parsed = extractQuestionAndOptions(q.body);
    if (!parsed) {
      skipped++;
      continue;
    }

    if (shouldSkipQuestion(parsed.questionText)) {
      skipped++;
      continue;
    }

    cards.push({
      questionNumber: q.num,
      front: parsed.questionText,
      options: parsed.options,
      correctAnswer: answer,
    });
  }

  return { cards, skipped };
}
