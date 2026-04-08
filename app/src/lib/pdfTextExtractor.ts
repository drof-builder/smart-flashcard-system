/**
 * Minimal PDF text extractor for React Native (Hermes-compatible).
 * No browser APIs or heavy regex — uses pako (bundled with jszip) for FlateDecode.
 * Parses PDF streams with a simple state machine.
 */

const pako = require('pako');

function toStr(buf: Uint8Array, start: number, end: number): string {
  let s = '';
  const limit = Math.min(end, buf.length);
  for (let i = start; i < limit; i++) {
    s += String.fromCharCode(buf[i]);
  }
  return s;
}

function indexOf(buf: Uint8Array, pattern: string, from: number): number {
  const pLen = pattern.length;
  for (let i = from; i <= buf.length - pLen; i++) {
    let match = true;
    for (let j = 0; j < pLen; j++) {
      if (buf[i + j] !== pattern.charCodeAt(j)) { match = false; break; }
    }
    if (match) return i;
  }
  return -1;
}

function extractStreams(pdf: Uint8Array): Uint8Array[] {
  const streams: Uint8Array[] = [];
  let pos = 0;

  while (pos < pdf.length) {
    const streamStart = indexOf(pdf, 'stream', pos);
    if (streamStart === -1) break;

    // Make sure it's not "endstream"
    if (streamStart >= 3) {
      const before = toStr(pdf, streamStart - 3, streamStart);
      if (before === 'end') { pos = streamStart + 6; continue; }
    }

    // Find content start (after "stream\r\n" or "stream\n")
    let contentStart = streamStart + 6;
    if (contentStart < pdf.length && pdf[contentStart] === 13) contentStart++;
    if (contentStart < pdf.length && pdf[contentStart] === 10) contentStart++;

    // Find endstream
    const endPos = indexOf(pdf, 'endstream', contentStart);
    if (endPos === -1) break;

    let contentEnd = endPos;
    while (contentEnd > contentStart && (pdf[contentEnd - 1] === 10 || pdf[contentEnd - 1] === 13)) {
      contentEnd--;
    }

    if (contentEnd > contentStart) {
      const raw = pdf.slice(contentStart, contentEnd);

      // Check header for FlateDecode
      const headerStart = Math.max(0, streamStart - 500);
      const header = toStr(pdf, headerStart, streamStart);

      if (header.includes('FlateDecode')) {
        try {
          streams.push(pako.inflate(raw));
        } catch {
          // skip invalid streams
        }
      } else {
        streams.push(raw);
      }
    }

    pos = endPos + 9;
  }

  return streams;
}

const WIN1252: Record<number, string> = {
  0x80: '\u20AC', 0x82: '\u201A', 0x83: '\u0192', 0x84: '\u201E',
  0x85: '\u2026', 0x86: '\u2020', 0x87: '\u2021', 0x88: '\u02C6',
  0x89: '\u2030', 0x8A: '\u0160', 0x8B: '\u2039', 0x8C: '\u0152',
  0x8E: '\u017D', 0x91: '\u2018', 0x92: '\u2019', 0x93: '\u201C',
  0x94: '\u201D', 0x95: '\u2022', 0x96: '\u2013', 0x97: '\u2014',
  0x98: '\u02DC', 0x99: '\u2122', 0x9A: '\u0161', 0x9B: '\u203A',
  0x9C: '\u0153', 0x9E: '\u017E', 0x9F: '\u0178',
};

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

/**
 * Parse a parenthesized PDF string starting at position `start`.
 * Returns the string content and the position after the closing ')'.
 */
function parsePdfString(text: string, start: number): { value: string; end: number } | null {
  if (text[start] !== '(') return null;
  let depth = 1;
  let i = start + 1;
  let raw = '';
  while (i < text.length && depth > 0) {
    if (text[i] === '\\' && i + 1 < text.length) {
      raw += text[i] + text[i + 1];
      i += 2;
    } else if (text[i] === '(') {
      depth++;
      raw += text[i];
      i++;
    } else if (text[i] === ')') {
      depth--;
      if (depth > 0) { raw += text[i]; }
      i++;
    } else {
      raw += text[i];
      i++;
    }
  }
  return { value: decodePdfString(raw), end: i };
}

function extractTextFromStream(streamData: Uint8Array): string {
  const text = toStr(streamData, 0, streamData.length);
  const lines: string[] = [];
  let i = 0;

  while (i < text.length) {
    // Look for '(' which starts a PDF string
    if (text[i] === '(') {
      const parsed = parsePdfString(text, i);
      if (!parsed) { i++; continue; }
      i = parsed.end;

      // Skip whitespace
      while (i < text.length && (text[i] === ' ' || text[i] === '\r' || text[i] === '\n')) i++;

      // Check for Tj or ' operator
      if (text[i] === 'T' && text[i + 1] === 'j') {
        lines.push(parsed.value);
        i += 2;
      } else if (text[i] === "'") {
        lines.push(parsed.value);
        i++;
      }
      // If followed by something else, it might be part of a TJ array — skip
      continue;
    }

    // Look for '[' which starts a TJ array
    if (text[i] === '[') {
      i++;
      let tjLine = '';
      let isTJArray = false;

      while (i < text.length && text[i] !== ']') {
        if (text[i] === '(') {
          const parsed = parsePdfString(text, i);
          if (!parsed) { i++; continue; }
          tjLine += parsed.value;
          i = parsed.end;
        } else if (text[i] === '-' || (text[i] >= '0' && text[i] <= '9')) {
          // Parse number — large negative = word space
          let numStr = '';
          while (i < text.length && text[i] !== ']' && text[i] !== '(' && text[i] !== ' ' && text[i] !== '\n' && text[i] !== '\r') {
            numStr += text[i];
            i++;
          }
          const num = parseFloat(numStr);
          if (num < -100) tjLine += ' ';
        } else {
          i++;
        }
      }

      if (text[i] === ']') i++;
      // Skip whitespace
      while (i < text.length && (text[i] === ' ' || text[i] === '\r' || text[i] === '\n')) i++;
      // Check for TJ operator
      if (text[i] === 'T' && text[i + 1] === 'J') {
        if (tjLine.trim()) lines.push(tjLine);
        i += 2;
      }
      continue;
    }

    i++;
  }

  return lines.join('\n');
}

/**
 * Extract text from a PDF file represented as a Uint8Array.
 * Works on React Native without browser APIs.
 */
export function extractText(pdfData: Uint8Array): string {
  const streams = extractStreams(pdfData);
  const textParts: string[] = [];

  if (streams.length === 0) {
    // No usable stream content found — try the buffer as a raw content stream
    // (handles streamless test data and uncompressed single-stream PDFs)
    const extracted = extractTextFromStream(pdfData);
    return extracted.trim() ? extracted : '';
  }

  for (const stream of streams) {
    const extracted = extractTextFromStream(stream);
    if (extracted.trim()) {
      textParts.push(extracted);
    }
  }

  return textParts.join('\n');
}
