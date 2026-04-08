# PDF Extraction Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four extraction bugs in `pdfTextExtractor.ts` and `pdfParser.ts` to bring parsed question count from 65/100 to ~100/100 on ITPEC exam PDFs.

**Architecture:** All fixes are surgical — two files change. `pdfTextExtractor.ts` gets Win-1252 decoding, hex string handling, and smart mid-word line joining. `pdfParser.ts` gets inline-options normalization. TDD throughout: write the failing test, verify it fails, implement, verify it passes, commit.

**Tech Stack:** TypeScript, Jest (jest-expo), React Native/Expo (Hermes-compatible — no DOM/browser APIs)

---

## File Map

| File | Change |
|------|--------|
| `app/src/lib/pdfTextExtractor.ts` | Add `WIN1252` table, update `decodePdfString`, add `decodeHexString`, add hex `<...>Tj` handler in main loop and TJ arrays, replace `lines.join('\n')` with smart `joinLines` |
| `app/src/lib/pdfParser.ts` | Add `normalizeOptions` helper, call it in `extractQuestionAndOptions` |
| `app/__tests__/pdfTextExtractor.test.ts` | Add test groups: Win-1252, hex strings, mid-word joining |
| `app/__tests__/pdfParser.test.ts` | Add two tests for inline options |

---

## Task 1: Win-1252 byte decoding

**Files:**
- Modify: `app/src/lib/pdfTextExtractor.ts`
- Test: `app/__tests__/pdfTextExtractor.test.ts`

PDF fonts in this exam use `WinAnsiEncoding`. Bytes 0x80–0x9F map to Windows-1252 characters (en dash, curly quotes, trademark, etc.) not Latin-1 control codes. Our extractor currently passes them through as raw `String.fromCharCode` values.

- [ ] **Step 1: Write the failing tests**

Append this `describe` block to `app/__tests__/pdfTextExtractor.test.ts` (inside the outer `describe('extractText', ...)` block, after the existing `empty / no content` group):

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```
cd app && npm test -- --testPathPattern=pdfTextExtractor
```
Expected: 3 new tests fail with wrong string values (raw control chars instead of Unicode).

- [ ] **Step 3: Add the Win-1252 table and update `decodePdfString`**

In `app/src/lib/pdfTextExtractor.ts`, add the table immediately before the `decodePdfString` function:

```typescript
const WIN1252: Record<number, string> = {
  0x80: '\u20AC', 0x82: '\u201A', 0x83: '\u0192', 0x84: '\u201E',
  0x85: '\u2026', 0x86: '\u2020', 0x87: '\u2021', 0x88: '\u02C6',
  0x89: '\u2030', 0x8A: '\u0160', 0x8B: '\u2039', 0x8C: '\u0152',
  0x8E: '\u017D', 0x91: '\u2018', 0x92: '\u2019', 0x93: '\u201C',
  0x94: '\u201D', 0x95: '\u2022', 0x96: '\u2013', 0x97: '\u2014',
  0x98: '\u02DC', 0x99: '\u2122', 0x9A: '\u0161', 0x9B: '\u203A',
  0x9C: '\u0153', 0x9E: '\u017E', 0x9F: '\u0178',
};
```

Replace the entire `decodePdfString` function body's `else` branch so the function reads:

```typescript
function decodePdfString(s: string): string {
  let result = '';
  let i = 0;
  while (i < s.length) {
    if (s[i] === '\\' && i + 1 < s.length) {
      const next = s[i + 1];
      if (next === 'n') { result += '\n'; i += 2; }
      else if (next === 'r') { result += '\r'; i += 2; }
      else if (next === 't') { result += '\t'; i += 2; }
      else if (next === '(' || next === ')' || next === '\\') { result += next; i += 2; }
      else { result += next; i += 2; }
    } else {
      const code = s.charCodeAt(i);
      result += (code >= 0x80 && code <= 0x9F && WIN1252[code] !== undefined)
        ? WIN1252[code]
        : s[i];
      i++;
    }
  }
  return result;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
cd app && npm test -- --testPathPattern=pdfTextExtractor
```
Expected: all tests pass (existing 16 + 3 new = 19 total).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/pdfTextExtractor.ts app/__tests__/pdfTextExtractor.test.ts
git commit -m "fix: decode Win-1252 bytes in PDF text strings"
```

---

## Task 2: Hex string `<...>` handling

**Files:**
- Modify: `app/src/lib/pdfTextExtractor.ts`
- Test: `app/__tests__/pdfTextExtractor.test.ts`

PDF text can be written as hex strings: `<48656C6C6F> Tj` = "Hello". Our extractor only handles `(...)` strings. Hex strings also appear inside `[...]TJ` arrays.

- [ ] **Step 1: Write the failing tests**

Append this block inside `describe('extractText', ...)` in `app/__tests__/pdfTextExtractor.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```
cd app && npm test -- --testPathPattern=pdfTextExtractor
```
Expected: 4 new tests fail.

- [ ] **Step 3: Add `decodeHexString` and hex handlers in `extractTextFromStream`**

In `app/src/lib/pdfTextExtractor.ts`, add this function after `WIN1252` (before `decodePdfString`):

```typescript
function decodeHexString(hex: string): string {
  const clean = hex.replace(/\s/g, '');
  if (clean.length % 2 !== 0) return ''; // odd-length = CID/corrupt, skip
  let result = '';
  for (let i = 0; i < clean.length; i += 2) {
    const byte = parseInt(clean.substring(i, i + 2), 16);
    if (byte < 0x20) continue; // skip null and control chars
    if (byte < 0x80) { result += String.fromCharCode(byte); continue; }
    if (byte <= 0x9F) { result += WIN1252[byte] ?? ''; continue; }
    result += String.fromCharCode(byte);
  }
  return result;
}
```

In `extractTextFromStream`, in the **main loop** (after the `[` TJ handler and before the fallthrough `i++`), add:

```typescript
    // Hex string: <...> Tj
    if (text[i] === '<' && (i === 0 || text[i - 1] !== '<')) {
      let j = i + 1;
      let hex = '';
      while (j < text.length && text[j] !== '>') { hex += text[j]; j++; }
      if (j < text.length) {
        j++; // skip '>'
        while (j < text.length && (text[j] === ' ' || text[j] === '\r' || text[j] === '\n')) j++;
        if (text[j] === 'T' && text[j + 1] === 'j') {
          const decoded = decodeHexString(hex);
          if (decoded.trim()) lines.push(decoded);
          i = j + 2;
          continue;
        }
      }
    }
```

In the **TJ array parser** (inside the `if (text[i] === '[')` block), add a hex handler after the `(` handler (before the number handler):

```typescript
        if (text[i] === '<' && (i === 0 || text[i - 1] !== '<')) {
          let j = i + 1;
          let hex = '';
          while (j < text.length && text[j] !== '>') { hex += text[j]; j++; }
          if (j < text.length) {
            tjLine += decodeHexString(hex);
            i = j + 1;
          } else { i++; }
          continue;
        }
```

- [ ] **Step 4: Run tests to confirm they pass**

```
cd app && npm test -- --testPathPattern=pdfTextExtractor
```
Expected: all 23 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/pdfTextExtractor.ts app/__tests__/pdfTextExtractor.test.ts
git commit -m "fix: handle hex string <...>Tj and <...> inside TJ arrays"
```

---

## Task 3: Smart mid-word line joining

**Files:**
- Modify: `app/src/lib/pdfTextExtractor.ts`
- Test: `app/__tests__/pdfTextExtractor.test.ts`

The PDF renderer splits words across multiple `Tj`/`TJ` calls for kerning. Our extractor joins all text runs with `\n`, producing `"combina\ntion"` instead of `"combination"`. Fix: when the previous line ends with a letter/digit and the next starts with a lowercase letter, concatenate directly (no separator).

- [ ] **Step 1: Write the failing tests**

Append inside `describe('extractText', ...)`:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```
cd app && npm test -- --testPathPattern=pdfTextExtractor
```
Expected: `joins Tj calls that split a word mid-character` and `joins across three fragments` fail; the other two pass already.

- [ ] **Step 3: Add `joinLines` and wire it into `extractTextFromStream`**

In `app/src/lib/pdfTextExtractor.ts`, add this function before `extractTextFromStream`:

```typescript
function joinLines(lines: string[]): string {
  if (lines.length === 0) return '';
  let result = lines[0];
  for (let i = 1; i < lines.length; i++) {
    const curr = lines[i];
    if (!result || !curr) { result += '\n' + curr; continue; }
    const lastChar = result[result.length - 1];
    const firstChar = curr[0];
    // Mid-word break: alphanumeric end + lowercase start → join directly
    if (/[a-zA-Z0-9]/.test(lastChar) && /[a-z]/.test(firstChar)) {
      result += curr;
    } else {
      result += '\n' + curr;
    }
  }
  return result;
}
```

At the bottom of `extractTextFromStream`, replace:

```typescript
  return lines.join('\n');
```

with:

```typescript
  return joinLines(lines);
```

- [ ] **Step 4: Run tests to confirm they pass**

```
cd app && npm test -- --testPathPattern=pdfTextExtractor
```
Expected: all 27 tests pass.

- [ ] **Step 5: Run full suite to confirm no regressions**

```
cd app && npm test
```
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/pdfTextExtractor.ts app/__tests__/pdfTextExtractor.test.ts
git commit -m "fix: join mid-word line breaks in PDF text extraction"
```

---

## Task 4: Inline options normalization

**Files:**
- Modify: `app/src/lib/pdfParser.ts`
- Test: `app/__tests__/pdfParser.test.ts`

35/100 questions fail because the PDF puts all four options on one line or across two lines:
- `a) 00110001  b)  01111011  c)  10000100  d)  11000101`
- `a) SSD  b)  Virtual memory\nc) Cache memory  d)  Defragmentation`

The parser regex `(?:^|\n)\s*([a-d])\)\s*/gm` only matches options at the start of a line. Fix: normalize any `b)`, `c)`, `d)` preceded by 2+ spaces onto its own line before running the regex.

- [ ] **Step 1: Write the failing tests**

In `app/__tests__/pdfParser.test.ts`, add these two tests inside the `describe('extractQuestionAndOptions', ...)` block:

```typescript
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
```

- [ ] **Step 2: Run tests to confirm they fail**

```
cd app && npm test -- --testPathPattern=pdfParser
```
Expected: both new tests fail — `extractQuestionAndOptions` returns `null`.

- [ ] **Step 3: Add `normalizeOptions` and wire it in**

In `app/src/lib/pdfParser.ts`, add this helper before `extractQuestionAndOptions`:

```typescript
function normalizeOptions(text: string): string {
  // When b), c), d) appear after 2+ spaces on the same line, move each to its own line.
  return text.replace(/[ \t]{2,}([b-d])\)[ \t]*/g, '\n$1) ');
}
```

In `extractQuestionAndOptions`, replace the line:

```typescript
  const optionsSection = body.substring(firstOption.index);
```

with:

```typescript
  const optionsSection = normalizeOptions(body.substring(firstOption.index));
```

- [ ] **Step 4: Run tests to confirm they pass**

```
cd app && npm test -- --testPathPattern=pdfParser
```
Expected: all tests pass (existing 14 + 2 new = 16 total).

- [ ] **Step 5: Run full suite to confirm no regressions**

```
cd app && npm test
```
Expected: all 136 tests pass.

- [ ] **Step 6: Commit and push**

```bash
git add app/src/lib/pdfParser.ts app/__tests__/pdfParser.test.ts
git commit -m "fix: normalize inline options before parsing"
git push
```
