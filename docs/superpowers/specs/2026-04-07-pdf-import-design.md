# PDF Import Feature — Design Spec

**Date:** 2026-04-07
**Author:** Clifford + Claude

## Overview

Import ITPEC past exam ZIP files (containing question and answer PDFs) into the app, automatically creating a new deck with one flashcard per question. Cards work across all three study modes (FlipCard, MultipleChoice, TypeAnswer).

## Decisions

- **Parsing:** Rule-based, on-device. ITPEC exams have a consistent format (Q1–Q100, a–d options, separate answer PDF). No AI/LLM required.
- **File format:** ZIP files containing `*_Questions.pdf` and `*_Answer.pdf` (matching ITPEC distribution format).
- **Card storage:** Uses existing `front`/`back` schema — no database migration needed.
- **Figures:** Questions referencing figures are skipped in v1. The data model is ready for an optional `image_url` field later.
- **Preview:** Users review and can edit/delete extracted cards before saving.
- **URL import:** Out of scope for v1. File picker only.

## Navigation

Two new screens added to MainStack:

```
DeckList → ImportDeck → ImportPreview → DeckDetail (of newly created deck)
```

**Route additions to `MainStackParamList`:**

```ts
ImportDeck: undefined;
ImportPreview: { deckName: string; cards: ParsedCard[] };
```

**Entry point:** "Import" button in DeckListScreen header, alongside existing "+ New".

## Card Data Model

Uses existing `Card` type (`front`/`back`) with no schema changes.

- **`front`**: Question text (e.g. "Which of the following is an appropriate description concerning machine language?")
- **`back`**: Structured string with options and correct answer:

```
a) A program that is written in Fortran or C is converted into machine language and then executed.
b) Machine language is a high-level language.
c) Machine language expresses a program with sequences of decimal numbers.
d) Most of application software is still programmed in machine language.

Correct: a
```

**How each study mode uses this:**

- **FlipCard** — shows `front`, flips to reveal full `back` (options + answer). No changes needed.
- **MultipleChoice** — currently generates random wrong options from other cards in the deck. For imported cards (detected by `back` containing `Correct: ` pattern), parse `back` to extract the 4 embedded options and correct answer letter instead. Requires a small modification to MultipleChoiceScreen.
- **TypeAnswer** — currently compares user input to `card.back`. For imported cards, extract just the correct answer letter from the `Correct: X` line and compare against that. Requires a small modification to TypeAnswerScreen.

**Detection helper:** A utility function `parseImportedCard(back: string)` in `app/src/lib/cardUtils.ts` that checks for the `Correct: ` pattern and returns `{ options: string[], correctAnswer: string } | null`. Returns `null` for regular (non-imported) cards. Used by MultipleChoice and TypeAnswer screens.

## PDF Parser

New utility module: `app/src/lib/pdfParser.ts`

### ParsedCard Type

```ts
type ParsedCard = {
  questionNumber: number;
  front: string;        // question text
  options: string[];    // ["a) ...", "b) ...", "c) ...", "d) ..."]
  correctAnswer: string; // "a", "b", "c", or "d"
};
```

### Parsing Strategy

1. **Extract ZIP** — use `react-native-zip-archive` to unzip, locate `*_Questions.pdf` and `*_Answer.pdf`
2. **Extract text from Questions PDF** — use a React Native PDF text extraction library
3. **Split into questions** — regex split on `Q{number}.` pattern (`/Q(\d+)\.\s/`)
4. **Extract options** — for each question block, find `a)` through `d)` patterns
5. **Parse Answer PDF** — extract the table mapping question numbers to correct letters
6. **Merge** — match each question with its correct answer by question number
7. **Skip unparseable questions** — exclude questions where: (a) the text contains `Fig.` or `figure` (case-insensitive), indicating a diagram dependency, or (b) fewer than 4 options were extracted. Report skipped count to user.

## Screens

### ImportScreen

- **Header title:** "Import Deck"
- **File picker:** "Choose ZIP File" button — opens `expo-document-picker` filtered to `.zip` files
- **Deck name field:** Auto-filled from ZIP filename (e.g. `2024A_IP.zip` -> "2024A IP"). Editable.
- **Parse button:** "Parse PDF" — disabled until file selected. Shows `ActivityIndicator` while parsing. Button at `opacity: 0.5` during processing (matching existing async pattern).
- **Error handling:**
  - Parse failure or no questions found: `Alert.alert()` (critical error pattern)
  - Some questions skipped: Toast auto-dismiss 2.5s (e.g. "Skipped 3 questions with figures")
- **On success:** Navigate to ImportPreviewScreen with parsed cards and deck name.

### ImportPreviewScreen

- **Header:** Deck name + card count (e.g. "2024A IP — 97 cards")
- **Card list:** FlatList showing compact card previews — question number, truncated question text (~80 chars), correct answer letter
- **Edit:** Tap a card to open a modal (similar to existing CardModal) for editing front/back/correct answer
- **Delete:** Long-press to remove a card from the import list
- **Import button:** Fixed at bottom — "Import 97 Cards". Disabled + `opacity: 0.5` while saving.
- **Save flow:**
  1. Create deck via direct Supabase insert (not the `useDecks` hook) — insert with `.select().single()` to get the new deck's ID back. Pass `user_id` from `supabase.auth.getUser()`.
  2. Bulk insert all cards in a single Supabase `.insert()` call with the new `deck_id` (format each `back` from options + correct answer).
  3. On success: navigate to new deck's DeckDetailScreen with `{ deckId, deckName }`.
  4. On error: `Alert.alert()` — cards stay in memory for retry.

### Styling

Follows existing palette:
- Primary: `#6366f1` (indigo)
- Background: `#f9fafb`
- Cards: white with elevation/shadow
- Disabled state: `opacity: 0.5`

## Dependencies

New packages needed:

- `expo-document-picker` — file selection
- `react-native-zip-archive` — ZIP extraction
- PDF text extraction library (evaluate `react-native-pdf-text` or alternatives during implementation)

## Out of Scope (v1)

- Image/figure extraction from PDFs
- URL-based import (download from URL)
- Non-ITPEC PDF formats
- Batch import of multiple ZIPs
