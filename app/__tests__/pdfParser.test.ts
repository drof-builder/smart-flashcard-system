import {
  splitIntoQuestionBlocks,
  extractQuestionAndOptions,
  parseAnswerText,
  shouldSkipQuestion,
  buildParsedCards,
} from '../src/lib/pdfParser';

describe('splitIntoQuestionBlocks', () => {
  it('splits text on Q{number}. pattern', () => {
    const text = 'Header text\nQ1.\nFirst question\na) A\nb) B\nc) C\nd) D\nQ2.\nSecond question\na) X\nb) Y\nc) Z\nd) W';
    const result = splitIntoQuestionBlocks(text);
    expect(result).toHaveLength(2);
    expect(result[0].num).toBe(1);
    expect(result[0].body).toContain('First question');
    expect(result[1].num).toBe(2);
    expect(result[1].body).toContain('Second question');
  });

  it('handles Q numbers above 9', () => {
    const text = 'Q10.\nTenth question body\nQ100.\nHundredth question body';
    const result = splitIntoQuestionBlocks(text);
    expect(result).toHaveLength(2);
    expect(result[0].num).toBe(10);
    expect(result[1].num).toBe(100);
  });

  it('returns empty array for text with no questions', () => {
    expect(splitIntoQuestionBlocks('Just some random text')).toEqual([]);
  });
});

describe('extractQuestionAndOptions', () => {
  it('extracts single-line options', () => {
    const body = 'What is 1+1?\n\na) 1\nb) 2\nc) 3\nd) 4';
    const result = extractQuestionAndOptions(body);
    expect(result).not.toBeNull();
    expect(result!.questionText).toBe('What is 1+1?');
    expect(result!.options).toEqual(['a) 1', 'b) 2', 'c) 3', 'd) 4']);
  });

  it('extracts multi-line (table) options', () => {
    const body = 'Choose the pair:\n\na)\nfoo\nbar\nb)\nbaz\nqux\nc)\none\ntwo\nd)\nthree\nfour';
    const result = extractQuestionAndOptions(body);
    expect(result).not.toBeNull();
    expect(result!.options).toEqual([
      'a) foo bar',
      'b) baz qux',
      'c) one two',
      'd) three four',
    ]);
  });

  it('returns null when fewer than 4 options found', () => {
    const body = 'Question\n\na) Only one option';
    expect(extractQuestionAndOptions(body)).toBeNull();
  });

  it('returns null when no options found', () => {
    expect(extractQuestionAndOptions('Just a question with no options')).toBeNull();
  });

  it('cleans up whitespace in question text', () => {
    const body = 'This is a\nmulti-line\nquestion text.\n\na) A\nb) B\nc) C\nd) D';
    const result = extractQuestionAndOptions(body);
    expect(result!.questionText).toBe('This is a multi-line question text.');
  });

  it('handles all four options inline on the same line', () => {
    const body = 'Which binary sum is correct?\n\na) 00110001  b)  01111011  c)  10000100  d)  11000101';
    const result = extractQuestionAndOptions(body);
    expect(result).not.toBeNull();
    expect(result!.options).toEqual([
      'a) 00110001',
      'b) 01111011',
      'c) 10000100',
      'd) 11000101',
    ]);
  });

  it('handles options split across two lines with inline pairs', () => {
    const body = 'Pick the memory type:\n\na) SSD  b)  Virtual memory\nc) Cache memory  d)  Defragmentation';
    const result = extractQuestionAndOptions(body);
    expect(result).not.toBeNull();
    expect(result!.options).toEqual([
      'a) SSD',
      'b) Virtual memory',
      'c) Cache memory',
      'd) Defragmentation',
    ]);
  });
});

describe('parseAnswerText', () => {
  it('parses number-letter pairs on separate lines', () => {
    const text = '1\nb\n51\nd\n2\nc\n52\nb';
    const result = parseAnswerText(text);
    expect(result.get(1)).toBe('b');
    expect(result.get(2)).toBe('c');
    expect(result.get(51)).toBe('d');
    expect(result.get(52)).toBe('b');
  });

  it('ignores header lines', () => {
    const text = '30th ITPEC IP Exam\nQ.No\nCorrect Answer\n1\na\n2\nb';
    const result = parseAnswerText(text);
    expect(result.get(1)).toBe('a');
    expect(result.get(2)).toBe('b');
    expect(result.size).toBe(2);
  });

  it('ignores footer like 1/1', () => {
    const text = '1\na\n2\nb\n1/1';
    const result = parseAnswerText(text);
    expect(result.size).toBe(2);
  });
});

describe('shouldSkipQuestion', () => {
  it('returns true for Fig. references', () => {
    expect(shouldSkipQuestion('Refer to Fig. 1 below')).toBe(true);
  });

  it('returns true for lowercase fig.', () => {
    expect(shouldSkipQuestion('as shown in fig. 2')).toBe(true);
  });

  it('returns false for normal questions', () => {
    expect(shouldSkipQuestion('What is the correct answer?')).toBe(false);
  });

  it('returns true for the word figure', () => {
    expect(shouldSkipQuestion('Refer to the figure below')).toBe(true);
  });

  it('does not match Config or similar words', () => {
    expect(shouldSkipQuestion('Configure the system')).toBe(false);
  });
});

describe('buildParsedCards', () => {
  it('merges questions with answers and skips figure questions', () => {
    const questions = [
      { num: 1, body: 'Normal question\n\na) A\nb) B\nc) C\nd) D' },
      { num: 2, body: 'See Fig. 1\n\na) X\nb) Y\nc) Z\nd) W' },
      { num: 3, body: 'Another question\n\na) P\nb) Q\nc) R\nd) S' },
    ];
    const answers = new Map([[1, 'b'], [2, 'a'], [3, 'd']]);
    const { cards, skipped } = buildParsedCards(questions, answers);

    expect(cards).toHaveLength(2);
    expect(skipped).toBe(1);
    expect(cards[0].questionNumber).toBe(1);
    expect(cards[0].correctAnswer).toBe('b');
    expect(cards[1].questionNumber).toBe(3);
    expect(cards[1].correctAnswer).toBe('d');
  });

  it('skips questions with no matching answer', () => {
    const questions = [{ num: 1, body: 'Q text\n\na) A\nb) B\nc) C\nd) D' }];
    const answers = new Map<number, string>();
    const { cards, skipped } = buildParsedCards(questions, answers);
    expect(cards).toHaveLength(0);
    expect(skipped).toBe(1);
  });

  it('skips questions that fail to parse options', () => {
    const questions = [{ num: 1, body: 'No options here' }];
    const answers = new Map([[1, 'a']]);
    const { cards, skipped } = buildParsedCards(questions, answers);
    expect(cards).toHaveLength(0);
    expect(skipped).toBe(1);
  });
});
