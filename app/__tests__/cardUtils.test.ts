import { parseImportedCard, formatCardBack } from '../src/lib/cardUtils';

describe('parseImportedCard', () => {
  it('returns null for a regular card back', () => {
    expect(parseImportedCard('Simple answer')).toBeNull();
  });

  it('returns null if fewer than 4 options parsed', () => {
    const back = 'a) One\nb) Two\n\nCorrect: a';
    expect(parseImportedCard(back)).toBeNull();
  });

  it('parses a valid imported card back', () => {
    const back = 'a) Option one\nb) Option two\nc) Option three\nd) Option four\n\nCorrect: b';
    expect(parseImportedCard(back)).toEqual({
      options: ['a) Option one', 'b) Option two', 'c) Option three', 'd) Option four'],
      correctAnswer: 'b',
    });
  });

  it('handles options with special characters', () => {
    const back = 'a) ("X" AND "Y") OR "Z"\nb) foo && bar\nc) 100 × 5\nd) x ≤ 300\n\nCorrect: d';
    const result = parseImportedCard(back);
    expect(result?.correctAnswer).toBe('d');
    expect(result?.options).toHaveLength(4);
  });

  it('returns null when Correct line is missing', () => {
    const back = 'a) One\nb) Two\nc) Three\nd) Four';
    expect(parseImportedCard(back)).toBeNull();
  });
});

describe('formatCardBack', () => {
  it('formats a ParsedCard into the back string', () => {
    const result = formatCardBack({
      options: ['a) Alpha', 'b) Beta', 'c) Gamma', 'd) Delta'],
      correctAnswer: 'c',
    });
    expect(result).toBe('a) Alpha\nb) Beta\nc) Gamma\nd) Delta\n\nCorrect: c');
  });
});
