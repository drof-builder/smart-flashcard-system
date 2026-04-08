import { extractText } from '../src/lib/pdfTextExtractor';

// Helper to encode a string as Uint8Array
function enc(s: string): Uint8Array {
  const buf = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i);
  return buf;
}

// Build a minimal PDF with an uncompressed stream
function makePdf(streamContent: string): Uint8Array {
  const body = `stream\n${streamContent}\nendstream`;
  return enc(body);
}

describe('extractText', () => {
  describe('Tj operator', () => {
    it('extracts a simple Tj string', () => {
      const pdf = makePdf('(Hello) Tj');
      expect(extractText(pdf)).toBe('Hello');
    });

    it('extracts multiple Tj strings', () => {
      const pdf = makePdf('(Hello) Tj\n(World) Tj');
      expect(extractText(pdf)).toBe('Hello\nWorld');
    });

    it('handles escaped parens in Tj string', () => {
      const pdf = makePdf('(Hello \\(World\\)) Tj');
      expect(extractText(pdf)).toBe('Hello (World)');
    });

    it('handles escaped backslash', () => {
      const pdf = makePdf('(a\\\\b) Tj');
      expect(extractText(pdf)).toBe('a\\b');
    });

    it('handles escape sequences \\n \\r \\t', () => {
      const pdf = makePdf('(a\\nb) Tj');
      expect(extractText(pdf)).toContain('a\nb');
    });
  });

  describe("apostrophe (') operator", () => {
    it("extracts string with ' operator", () => {
      const pdf = makePdf("(Line) '");
      expect(extractText(pdf)).toBe('Line');
    });
  });

  describe('TJ operator', () => {
    it('extracts a TJ array with a single string', () => {
      const pdf = makePdf('[(Hello)] TJ');
      expect(extractText(pdf)).toBe('Hello');
    });

    it('extracts a TJ array with multiple strings', () => {
      const pdf = makePdf('[(Hello) (World)] TJ');
      expect(extractText(pdf)).toBe('HelloWorld');
    });

    it('inserts a space for large negative kerning', () => {
      const pdf = makePdf('[(Hello)-200(World)] TJ');
      expect(extractText(pdf)).toBe('Hello World');
    });

    it('does not insert a space for small kerning', () => {
      const pdf = makePdf('[(Hello)-50(World)] TJ');
      expect(extractText(pdf)).toBe('HelloWorld');
    });

    it('skips blank TJ arrays', () => {
      const pdf = makePdf('[( )] TJ');
      expect(extractText(pdf).trim()).toBe('');
    });
  });

  describe('nested parentheses', () => {
    it('handles nested parens in Tj', () => {
      const pdf = makePdf('(a (b) c) Tj');
      expect(extractText(pdf)).toBe('a (b) c');
    });

    it('handles nested parens in TJ array', () => {
      const pdf = makePdf('[(a (b) c)] TJ');
      expect(extractText(pdf)).toBe('a (b) c');
    });
  });

  describe('multiple streams', () => {
    it('joins text from multiple streams', () => {
      const s1 = 'stream\n(Page1) Tj\nendstream';
      const s2 = 'stream\n(Page2) Tj\nendstream';
      const pdf = enc(s1 + '\n' + s2);
      const result = extractText(pdf);
      expect(result).toContain('Page1');
      expect(result).toContain('Page2');
    });
  });

  describe('empty / no content', () => {
    it('returns empty string for empty input', () => {
      expect(extractText(new Uint8Array(0))).toBe('');
    });

    it('returns empty string when no text operators present', () => {
      const pdf = makePdf('q Q');
      expect(extractText(pdf)).toBe('');
    });
  });

  describe('Win-1252 encoding', () => {
    it('decodes en dash (0x96 → U+2013)', () => {
      // Raw bytes: ( a – b ) Tj
      const buf = new Uint8Array([0x28, 0x61, 0x96, 0x62, 0x29, 0x20, 0x54, 0x6A]);
      expect(extractText(buf)).toBe('a\u2013b');
    });

    it('decodes right single quote (0x92 → U+2019)', () => {
      // Raw bytes: ( i t ' s ) Tj
      const buf = new Uint8Array([0x28, 0x69, 0x74, 0x92, 0x73, 0x29, 0x20, 0x54, 0x6A]);
      expect(extractText(buf)).toBe('it\u2019s');
    });

    it('decodes curly double quotes (0x93 → U+201C, 0x94 → U+201D)', () => {
      // Raw bytes: ( " h i " ) Tj
      const buf = new Uint8Array([0x28, 0x93, 0x68, 0x69, 0x94, 0x29, 0x20, 0x54, 0x6A]);
      expect(extractText(buf)).toBe('\u201Chi\u201D');
    });
  });

  describe('hex strings', () => {
    it('decodes <...> Tj ASCII hex string', () => {
      const pdf = makePdf('<48656C6C6F> Tj');
      expect(extractText(pdf)).toBe('Hello');
    });

    it('silently drops null/control bytes in hex strings', () => {
      const pdf = makePdf('<0003> Tj');
      expect(extractText(pdf)).toBe('');
    });

    it('decodes hex string inside a TJ array', () => {
      const pdf = makePdf('[<48656C6C6F>] TJ');
      expect(extractText(pdf)).toBe('Hello');
    });

    it('mixes hex and paren strings in one TJ array', () => {
      const pdf = makePdf('[<48656C> (lo)] TJ');
      expect(extractText(pdf)).toBe('Hello');
    });
  });

  describe('mid-word break joining', () => {
    it('joins Tj calls that split a word mid-character', () => {
      const pdf = makePdf('(combina) Tj\n(tion) Tj');
      expect(extractText(pdf)).toBe('combination');
    });

    it('joins across three fragments', () => {
      const pdf = makePdf('(fo) Tj\n(llo) Tj\n(wing) Tj');
      expect(extractText(pdf)).toBe('following');
    });

    it('does not join when next chunk starts with uppercase', () => {
      const pdf = makePdf('(sentence.) Tj\n(Next) Tj');
      expect(extractText(pdf)).toBe('sentence.\nNext');
    });

    it('does not join after punctuation', () => {
      const pdf = makePdf('(Q3.) Tj\n(question text) Tj');
      expect(extractText(pdf)).toBe('Q3.\nquestion text');
    });
  });
});
