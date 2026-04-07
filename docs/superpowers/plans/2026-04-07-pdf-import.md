# PDF Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import ITPEC past exam ZIP files into flashcard decks with on-device parsing and a preview/edit flow before saving.

**Architecture:** Two new screens (ImportScreen, ImportPreviewScreen) in the MainStack. A rule-based PDF parser extracts questions from the ZIP's two PDFs (questions + answers). A `cardUtils` module detects imported cards so MultipleChoice and TypeAnswer screens use embedded options instead of generating random ones.

**Tech Stack:** expo-document-picker (file picker), jszip (ZIP extraction), pdfjs-dist (PDF text extraction), existing Supabase + React Navigation stack.

---

### Task 1: Install Dependencies

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Install expo-document-picker**

```bash
cd app && npx expo install expo-document-picker
```

- [ ] **Step 2: Install jszip**

```bash
cd app && npm install jszip
```

- [ ] **Step 3: Install pdfjs-dist**

```bash
cd app && npm install pdfjs-dist
```

- [ ] **Step 4: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "chore: add expo-document-picker, jszip, pdfjs-dist dependencies"
```

---

### Task 2: Card Utilities (TDD)

**Files:**
- Create: `app/src/lib/cardUtils.ts`
- Create: `app/__tests__/cardUtils.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/cardUtils.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd app && npx jest __tests__/cardUtils.test.ts --no-coverage
```

Expected: FAIL — module `../src/lib/cardUtils` not found.

- [ ] **Step 3: Write the implementation**

Create `app/src/lib/cardUtils.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd app && npx jest __tests__/cardUtils.test.ts --no-coverage
```

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/cardUtils.ts app/__tests__/cardUtils.test.ts
git commit -m "feat: add cardUtils with parseImportedCard and formatCardBack"
```

---

### Task 3: PDF Parser — Pure Functions (TDD)

**Files:**
- Create: `app/src/lib/pdfParser.ts`
- Create: `app/__tests__/pdfParser.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/__tests__/pdfParser.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd app && npx jest __tests__/pdfParser.test.ts --no-coverage
```

Expected: FAIL — module `../src/lib/pdfParser` not found.

- [ ] **Step 3: Write the pure function implementations**

Create `app/src/lib/pdfParser.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd app && npx jest __tests__/pdfParser.test.ts --no-coverage
```

Expected: all 16 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/pdfParser.ts app/__tests__/pdfParser.test.ts
git commit -m "feat: add PDF parser with pure parsing functions and tests"
```

---

### Task 4: PDF Parser — I/O Layer

**Files:**
- Modify: `app/src/lib/pdfParser.ts` (append I/O functions)

> **Note:** `pdfjs-dist` may have compatibility issues with React Native's Hermes engine. If imports fail at runtime, the fallback is to run pdf.js inside a hidden WebView via `react-native-webview`. Test this early by running the app and importing a real ZIP file.

- [ ] **Step 1: Add the I/O functions to pdfParser.ts**

Add the following imports at the **top** of `app/src/lib/pdfParser.ts` (above the existing type/function code):

```typescript
import * as FileSystem from 'expo-file-system';
import JSZip from 'jszip';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

GlobalWorkerOptions.workerSrc = '';
```

Then append the following functions at the **end** of the file:

async function extractTextFromPdf(pdfData: Uint8Array): Promise<string> {
  const doc = await getDocument({ data: pdfData, disableWorker: true }).promise;
  let fullText = '';

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let pageText = '';

    for (const item of content.items) {
      if (!('str' in item)) continue;
      const y = (item as any).transform?.[5];
      if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2) {
        pageText += '\n';
      } else if (pageText.length > 0 && !pageText.endsWith('\n')) {
        pageText += ' ';
      }
      pageText += item.str;
      if (y !== undefined) lastY = y;
    }

    fullText += pageText + '\n';
  }

  return fullText;
}

export async function parseZipFile(
  fileUri: string
): Promise<{ cards: ParsedCard[]; skipped: number }> {
  const base64 = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const zip = await JSZip.loadAsync(base64, { base64: true });
  const fileNames = Object.keys(zip.files);

  const questionsFile = fileNames.find(n => /questions/i.test(n) && n.endsWith('.pdf'));
  const answerFile = fileNames.find(n => /answer/i.test(n) && n.endsWith('.pdf'));

  if (!questionsFile || !answerFile) {
    throw new Error('ZIP must contain a Questions PDF and an Answer PDF.');
  }

  const questionsPdf = await zip.files[questionsFile].async('uint8array');
  const answerPdf = await zip.files[answerFile].async('uint8array');

  const questionsText = await extractTextFromPdf(questionsPdf);
  const answerText = await extractTextFromPdf(answerPdf);

  const questionBlocks = splitIntoQuestionBlocks(questionsText);
  const answers = parseAnswerText(answerText);

  return buildParsedCards(questionBlocks, answers);
}
```

- [ ] **Step 2: Verify existing pure-function tests still pass**

```bash
cd app && npx jest __tests__/pdfParser.test.ts --no-coverage
```

Expected: all 16 tests still PASS. (The I/O functions are not called by existing tests — they require a real file system and will be validated manually.)

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/pdfParser.ts
git commit -m "feat: add PDF parser I/O layer with ZIP extraction and PDF text extraction"
```

---

### Task 5: Import Store

**Files:**
- Create: `app/src/lib/importStore.ts`

Passing 100 `ParsedCard` objects through React Navigation params causes serialization overhead. Use a module-level store instead.

- [ ] **Step 1: Create the store**

Create `app/src/lib/importStore.ts`:

```typescript
import { ParsedCard } from './pdfParser';

let pendingCards: ParsedCard[] = [];

export function setPendingImport(cards: ParsedCard[]): void {
  pendingCards = cards;
}

export function getPendingImport(): ParsedCard[] {
  return pendingCards;
}

export function clearPendingImport(): void {
  pendingCards = [];
}
```

- [ ] **Step 2: Commit**

```bash
git add app/src/lib/importStore.ts
git commit -m "feat: add importStore for passing parsed cards between screens"
```

---

### Task 6: Types and Navigation

**Files:**
- Modify: `app/src/types.ts`
- Modify: `app/src/navigation/AppNavigator.tsx`

- [ ] **Step 1: Add route types**

In `app/src/types.ts`, add two routes to `MainStackParamList`:

```typescript
ImportDeck: undefined;
ImportPreview: { deckName: string };
```

Add them after the `Settings: undefined;` line.

- [ ] **Step 2: Register screens in AppNavigator**

In `app/src/navigation/AppNavigator.tsx`:

Add imports at the top:

```typescript
import ImportScreen from '../screens/ImportScreen';
import ImportPreviewScreen from '../screens/ImportPreviewScreen';
```

Add screen registrations inside `MainNavigator()`, after the Settings screen:

```typescript
<MainStack.Screen name="ImportDeck" component={ImportScreen} options={{ title: 'Import Deck' }} />
<MainStack.Screen name="ImportPreview" component={ImportPreviewScreen} options={{ title: 'Import Preview' }} />
```

- [ ] **Step 3: Commit**

```bash
git add app/src/types.ts app/src/navigation/AppNavigator.tsx
git commit -m "feat: add ImportDeck and ImportPreview routes to navigation"
```

> **Note:** The app will not compile until ImportScreen and ImportPreviewScreen exist (Tasks 7 and 9). If building incrementally, create placeholder files first.

---

### Task 7: ImportScreen

**Files:**
- Create: `app/src/screens/ImportScreen.tsx`

- [ ] **Step 1: Create ImportScreen**

Create `app/src/screens/ImportScreen.tsx`:

```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MainStackParamList } from '../types';
import * as DocumentPicker from 'expo-document-picker';
import { parseZipFile } from '../lib/pdfParser';
import { setPendingImport } from '../lib/importStore';
import Toast from '../components/Toast';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'ImportDeck'>;
};

function fileNameToDeckName(fileName: string): string {
  return fileName
    .replace(/\.zip$/i, '')
    .replace(/[_-]/g, ' ')
    .trim();
}

export default function ImportScreen({ navigation }: Props) {
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [deckName, setDeckName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/zip',
      copyToCacheDirectory: true,
    });

    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    setFileUri(asset.uri);
    setFileName(asset.name);
    setDeckName(fileNameToDeckName(asset.name));
  };

  const handleParse = async () => {
    if (!fileUri || !deckName.trim()) return;
    setIsParsing(true);
    try {
      const { cards, skipped } = await parseZipFile(fileUri);

      if (cards.length === 0) {
        Alert.alert('No Cards Found', 'Could not extract any questions from this ZIP file.');
        return;
      }

      if (skipped > 0) {
        setToastMessage(`Skipped ${skipped} question${skipped > 1 ? 's' : ''} (figures or parse errors)`);
      }

      setPendingImport(cards);
      navigation.navigate('ImportPreview', { deckName: deckName.trim() });
    } catch (error) {
      Alert.alert(
        'Parse Error',
        error instanceof Error ? error.message : 'Failed to parse the ZIP file.'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const canParse = fileUri !== null && deckName.trim().length > 0 && !isParsing;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>ZIP File</Text>
      <TouchableOpacity style={styles.filePicker} onPress={handlePickFile} disabled={isParsing}>
        <Text style={styles.filePickerText}>
          {fileName ?? 'Choose ZIP File'}
        </Text>
      </TouchableOpacity>

      <Text style={styles.label}>Deck Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter deck name"
        value={deckName}
        onChangeText={setDeckName}
        editable={!isParsing}
      />

      <TouchableOpacity
        style={[styles.parseBtn, !canParse && styles.parseBtnDisabled]}
        onPress={handleParse}
        disabled={!canParse}
      >
        {isParsing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.parseBtnText}>Parse PDF</Text>
        )}
      </TouchableOpacity>

      <Toast message={toastMessage} onHide={() => setToastMessage(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 16 },
  filePicker: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  filePickerText: { fontSize: 16, color: '#6366f1' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  parseBtn: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 32,
  },
  parseBtnDisabled: { opacity: 0.5 },
  parseBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/src/screens/ImportScreen.tsx
git commit -m "feat: add ImportScreen with file picker and PDF parsing"
```

---

### Task 8: ImportCardModal

**Files:**
- Create: `app/src/components/ImportCardModal.tsx`

A modal for editing imported cards before saving. Shows the question text, 4 option fields, and a correct-answer selector.

- [ ] **Step 1: Create ImportCardModal**

Create `app/src/components/ImportCardModal.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { ParsedCard } from '../lib/pdfParser';

type Props = {
  visible: boolean;
  card: ParsedCard | null;
  onClose: () => void;
  onSave: (updated: ParsedCard) => void;
};

const LETTERS = ['a', 'b', 'c', 'd'] as const;

export default function ImportCardModal({ visible, card, onClose, onSave }: Props) {
  const [front, setFront] = useState('');
  const [optionTexts, setOptionTexts] = useState(['', '', '', '']);
  const [correctAnswer, setCorrectAnswer] = useState('a');

  useEffect(() => {
    if (visible && card) {
      setFront(card.front);
      setOptionTexts(
        card.options.map(o => o.replace(/^[a-d]\)\s*/, ''))
      );
      setCorrectAnswer(card.correctAnswer);
    }
  }, [visible, card]);

  const handleSave = () => {
    if (!card || !front.trim()) return;
    onSave({
      questionNumber: card.questionNumber,
      front: front.trim(),
      options: optionTexts.map((t, i) => `${LETTERS[i]}) ${t.trim()}`),
      correctAnswer,
    });
  };

  const canSave = front.trim().length > 0 && optionTexts.every(t => t.trim().length > 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <ScrollView>
            <Text style={styles.title}>Edit Card (Q{card?.questionNumber})</Text>

            <Text style={styles.fieldLabel}>Question</Text>
            <TextInput
              style={styles.input}
              value={front}
              onChangeText={setFront}
              multiline
            />

            {LETTERS.map((letter, i) => (
              <View key={letter}>
                <Text style={styles.fieldLabel}>Option {letter})</Text>
                <TextInput
                  style={styles.input}
                  value={optionTexts[i]}
                  onChangeText={text => {
                    const updated = [...optionTexts];
                    updated[i] = text;
                    setOptionTexts(updated);
                  }}
                  multiline
                />
              </View>
            ))}

            <Text style={styles.fieldLabel}>Correct Answer</Text>
            <View style={styles.answerRow}>
              {LETTERS.map(letter => (
                <TouchableOpacity
                  key={letter}
                  style={[
                    styles.answerBtn,
                    correctAnswer === letter && styles.answerBtnSelected,
                  ]}
                  onPress={() => setCorrectAnswer(letter)}
                >
                  <Text
                    style={[
                      styles.answerBtnText,
                      correctAnswer === letter && styles.answerBtnTextSelected,
                    ]}
                  >
                    {letter}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    maxHeight: '85%',
  },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    backgroundColor: '#f9fafb',
    minHeight: 44,
    textAlignVertical: 'top',
  },
  answerRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  answerBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  answerBtnSelected: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  answerBtnText: { fontSize: 16, fontWeight: '600', color: '#6b7280' },
  answerBtnTextSelected: { color: '#6366f1' },
  saveBtn: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  cancelBtn: { padding: 16, alignItems: 'center' },
  cancelBtnText: { color: '#6b7280', fontSize: 16 },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/src/components/ImportCardModal.tsx
git commit -m "feat: add ImportCardModal for editing parsed cards before import"
```

---

### Task 9: ImportPreviewScreen

**Files:**
- Create: `app/src/screens/ImportPreviewScreen.tsx`

- [ ] **Step 1: Create ImportPreviewScreen**

Create `app/src/screens/ImportPreviewScreen.tsx`:

```typescript
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList } from '../types';
import { ParsedCard } from '../lib/pdfParser';
import { formatCardBack } from '../lib/cardUtils';
import { getPendingImport, clearPendingImport } from '../lib/importStore';
import { supabase } from '../lib/supabase';
import ImportCardModal from '../components/ImportCardModal';
import Toast from '../components/Toast';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'ImportPreview'>;
  route: RouteProp<MainStackParamList, 'ImportPreview'>;
};

export default function ImportPreviewScreen({ navigation, route }: Props) {
  const { deckName } = route.params;
  const [cards, setCards] = useState<ParsedCard[]>([]);
  const [editingCard, setEditingCard] = useState<ParsedCard | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    setCards(getPendingImport());
  }, []);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: `${deckName} — ${cards.length} cards`,
    });
  }, [navigation, deckName, cards.length]);

  const handleEditSave = (updated: ParsedCard) => {
    setCards(prev =>
      prev.map(c => (c.questionNumber === updated.questionNumber ? updated : c))
    );
    setModalVisible(false);
  };

  const handleDelete = (questionNumber: number) => {
    Alert.alert('Remove Card', `Remove Q${questionNumber} from import?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => setCards(prev => prev.filter(c => c.questionNumber !== questionNumber)),
      },
    ]);
  };

  const handleImport = async () => {
    if (cards.length === 0 || isSaving) return;
    setIsSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: deck, error: deckError } = await supabase
        .from('decks')
        .insert({ name: deckName, user_id: user.id })
        .select()
        .single();

      if (deckError || !deck) throw new Error(deckError?.message ?? 'Failed to create deck');

      const cardRows = cards.map(c => ({
        deck_id: deck.id,
        front: c.front,
        back: formatCardBack(c),
      }));

      const { error: cardsError } = await supabase.from('cards').insert(cardRows);

      if (cardsError) throw new Error(cardsError.message);

      clearPendingImport();
      navigation.replace('DeckDetail' as any, { deckId: deck.id, deckName });
    } catch (error) {
      Alert.alert(
        'Import Error',
        error instanceof Error ? error.message : 'Failed to import cards.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={cards}
        keyExtractor={item => String(item.questionNumber)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => {
              setEditingCard(item);
              setModalVisible(true);
            }}
            onLongPress={() => handleDelete(item.questionNumber)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.qNum}>Q{item.questionNumber}</Text>
              <Text style={styles.answer}>Answer: {item.correctAnswer}</Text>
            </View>
            <Text style={styles.qText} numberOfLines={2}>
              {item.front}
            </Text>
          </TouchableOpacity>
        )}
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.importBtn, (isSaving || cards.length === 0) && styles.importBtnDisabled]}
          onPress={handleImport}
          disabled={isSaving || cards.length === 0}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.importBtnText}>
              Import {cards.length} Card{cards.length !== 1 ? 's' : ''}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ImportCardModal
        visible={modalVisible}
        card={editingCard}
        onClose={() => setModalVisible(false)}
        onSave={handleEditSave}
      />

      <Toast message={toastMessage} onHide={() => setToastMessage(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  qNum: { fontWeight: '700', color: '#6366f1', fontSize: 14 },
  answer: { color: '#6b7280', fontSize: 13 },
  qText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  importBtn: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  importBtnDisabled: { opacity: 0.5 },
  importBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
```

- [ ] **Step 2: Commit**

```bash
git add app/src/screens/ImportPreviewScreen.tsx
git commit -m "feat: add ImportPreviewScreen with card list, edit, delete, and bulk import"
```

---

### Task 10: Update MultipleChoiceScreen for Imported Cards

**Files:**
- Modify: `app/src/screens/MultipleChoiceScreen.tsx`

The existing `buildOptions` function pulls distractors from other cards. For imported cards that already have embedded options, we use those instead.

- [ ] **Step 1: Modify buildOptions and the component**

In `app/src/screens/MultipleChoiceScreen.tsx`:

Add import at the top:

```typescript
import { parseImportedCard } from '../lib/cardUtils';
```

Replace the `buildOptions` function:

```typescript
function buildOptions(correct: Card, allCards: Card[]): { options: string[]; correctOption: string } {
  const imported = parseImportedCard(correct.back);
  if (imported) {
    const correctOpt = imported.options.find(o => o.startsWith(`${imported.correctAnswer})`)) ?? '';
    return {
      options: [...imported.options].sort(() => Math.random() - 0.5),
      correctOption: correctOpt,
    };
  }

  const distractors = allCards
    .filter(c => c.id !== correct.id)
    .map(c => c.back)
    .filter(v => v !== correct.back)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  return {
    options: [...distractors, correct.back].sort(() => Math.random() - 0.5),
    correctOption: correct.back,
  };
}
```

Add `correctOption` state alongside the existing `options` state:

```typescript
const [correctOption, setCorrectOption] = useState<string>('');
```

Update the `useEffect` that builds options:

```typescript
useEffect(() => {
  if (dueCards.length > 0 && allCards.length >= 4 && index < dueCards.length) {
    const result = buildOptions(dueCards[index], allCards);
    setOptions(result.options);
    setCorrectOption(result.correctOption);
    setSelected(null);
  }
}, [index, dueCards, allCards]);
```

In `handleSelect`, replace `option === card.back` with `option === correctOption`:

```typescript
const isCorrect = option === correctOption;
```

In the JSX render, replace `opt === card.back` with `opt === correctOption`:

```typescript
if (opt === correctOption) { bg = '#dcfce7'; border = '#16a34a'; }
```

- [ ] **Step 2: Verify existing tests still pass**

```bash
cd app && npx jest __tests__/MultipleChoiceScreen.test.tsx --no-coverage
```

Expected: existing tests still PASS (they use regular cards without the `Correct:` pattern).

- [ ] **Step 3: Commit**

```bash
git add app/src/screens/MultipleChoiceScreen.tsx
git commit -m "feat: update MultipleChoiceScreen to use embedded options for imported cards"
```

---

### Task 11: Update TypeAnswerScreen for Imported Cards

**Files:**
- Modify: `app/src/screens/TypeAnswerScreen.tsx`

For imported cards, the user types the correct answer letter (a/b/c/d) instead of the full back text.

- [ ] **Step 1: Modify the component**

In `app/src/screens/TypeAnswerScreen.tsx`:

Add import at the top:

```typescript
import { parseImportedCard } from '../lib/cardUtils';
```

Add a helper function before the component:

```typescript
function getCorrectAnswer(back: string): string {
  const imported = parseImportedCard(back);
  return imported ? imported.correctAnswer : back;
}

function getCorrectDisplay(back: string): string {
  const imported = parseImportedCard(back);
  if (imported) {
    return imported.options.find(o => o.startsWith(`${imported.correctAnswer})`)) ?? imported.correctAnswer;
  }
  return back;
}
```

Replace the `isCorrect` derivation (around line 62):

```typescript
const correctAnswer = getCorrectAnswer(card.back);
const isCorrect = submitted && normalize(input) === normalize(correctAnswer);
```

Update `handleSubmit` to use `correctAnswer`:

```typescript
const handleSubmit = async () => {
  if (!input.trim() || submitted) return;
  setSubmitted(true);
  const correct = normalize(input) === normalize(getCorrectAnswer(card.back));
  const rating = correct ? 4 : 1;
  if (correct) setCorrectCount(c => c + 1);
  if (!practiceMode) {
    const existing = await getReviewForCard(card.id);
    const saveError = await saveReview(card, rating, existing);
    if (saveError) setToastMessage("Couldn't save review. Will retry next session.");
  }
};
```

Update the "Correct answer" display text (around line 122):

```typescript
{!isCorrect && (
  <Text style={styles.correctAnswer}>Correct answer: {getCorrectDisplay(card.back)}</Text>
)}
```

- [ ] **Step 2: Verify existing tests still pass**

```bash
cd app && npx jest __tests__/TypeAnswerScreen.test.tsx --no-coverage
```

Expected: existing tests still PASS (they use regular cards).

- [ ] **Step 3: Commit**

```bash
git add app/src/screens/TypeAnswerScreen.tsx
git commit -m "feat: update TypeAnswerScreen to handle imported card answer format"
```

---

### Task 12: Add Import Button to DeckListScreen

**Files:**
- Modify: `app/src/screens/DeckListScreen.tsx`

- [ ] **Step 1: Add "Import" button to the header**

In `app/src/screens/DeckListScreen.tsx`, modify the `useLayoutEffect` to add an "Import" button alongside "+ New":

```typescript
React.useLayoutEffect(() => {
  navigation.setOptions({
    headerRight: () => (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TouchableOpacity onPress={() => navigation.navigate('ImportDeck')}>
          <Text style={{ color: '#6366f1', fontSize: 16, marginRight: 16 }}>Import</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setEditingDeck(null); setModalVisible(true); }}>
          <Text style={{ color: '#6366f1', fontSize: 16, marginRight: 8 }}>+ New</Text>
        </TouchableOpacity>
      </View>
    ),
    headerLeft: () => (
      <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
        <Text style={{ fontSize: 20, marginLeft: 8 }}>⚙️</Text>
      </TouchableOpacity>
    ),
  });
}, [navigation]);
```

Add `View` to the imports from `react-native` if not already there (it is — already imported).

- [ ] **Step 2: Verify the app builds**

```bash
cd app && npx expo start --web
```

Expected: app builds and DeckListScreen shows "Import" and "+ New" buttons in the header.

- [ ] **Step 3: Run all tests to confirm nothing is broken**

```bash
cd app && npx jest --no-coverage
```

Expected: all existing tests pass plus new tests from Tasks 2 and 3.

- [ ] **Step 4: Commit**

```bash
git add app/src/screens/DeckListScreen.tsx
git commit -m "feat: add Import button to DeckListScreen header"
```

---

## Compatibility Note

`pdfjs-dist` may encounter issues in React Native's Hermes engine (missing browser globals like `document` or `DOMParser`). If this happens during Task 4 integration testing:

1. Add polyfills at the top of `pdfParser.ts` before the pdfjs import:

```typescript
if (typeof globalThis.document === 'undefined') {
  (globalThis as any).document = {
    createElement: () => ({ getContext: () => null }),
    currentScript: { src: '' },
  };
}
```

2. If polyfills are insufficient, switch to a WebView-based approach using `react-native-webview` with `pdfjs-dist` running inside the WebView (requires a development build instead of Expo Go).
