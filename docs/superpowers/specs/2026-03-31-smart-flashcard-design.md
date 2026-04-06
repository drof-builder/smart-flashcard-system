# Smart Flashcard System — Design Spec

**Date:** 2026-03-31  
**Status:** Approved

---

## Overview

A cross-platform flashcard app with spaced repetition and multiple study modes. Runs on web, iOS, and Android from a single codebase. Multi-user: each user logs in and has their own decks.

---

## Architecture

**Approach:** Client-side spaced repetition + Supabase backend.

- **Expo (React Native + Web)** — single codebase targeting web browser, iOS, and Android.
- **Supabase** — provides auth (email/password), PostgreSQL database, auto-generated REST API, and row-level security. No custom backend code required.
- **SM-2 algorithm** — runs entirely in the app. After each review, the app recalculates the card's schedule and syncs the result to Supabase immediately.

**Data flow:**
1. User logs in → Supabase Auth issues a session token
2. App fetches decks and cards → stored in local React state
3. User studies → SM-2 runs locally, calculates next review date
4. Review result saved → written to Supabase `card_reviews` table

---

## Data Model

Four tables in Supabase (PostgreSQL). All tables use row-level security so users can only access their own data.

### `profiles`
| Column | Type | Notes |
|---|---|---|
| id | uuid | FK → auth.users |
| display_name | text | |
| created_at | timestamp | |

Auto-created via Supabase trigger on user signup.

### `decks`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | → profiles.id |
| name | text | |
| description | text | nullable |
| created_at | timestamp | |

### `cards`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| deck_id | uuid FK | → decks.id |
| front | text | question side |
| back | text | answer side |
| created_at | timestamp | |

Inherits deck ownership through RLS policy.

### `card_reviews`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| card_id | uuid FK | → cards.id |
| user_id | uuid FK | → profiles.id |
| ease_factor | float | default 2.5 |
| interval | int | days until next review |
| repetitions | int | consecutive correct reviews |
| next_review_date | date | when to show this card again |
| last_reviewed_at | timestamp | |

One row per card per user. Created on first review with SM-2 default values. Updated after every study session.

**Constraints:**
- Unique constraint on `(card_id, user_id)` — enforces one review record per card per user

**Indexes:**
- `card_reviews(user_id, next_review_date)` — composite index for the "due cards" query (runs on every session)

---

## Spaced Repetition (SM-2 Algorithm)

After each card review, the user rates recall on a 0–5 scale:
- 0–2: failed (blackout or significant error)
- 3: hard (correct but with difficulty)
- 4: good (correct with minor hesitation)
- 5: easy (perfect recall)

**Algorithm:**
- If rating < 3: reset `repetitions` to 0, set `interval` to 1 day
- If rating ≥ 3: increment `repetitions` by 1, then:
  - repetitions 1 → interval = 1
  - repetitions 2 → interval = 6
  - repetitions > 2 → interval = round(previous_interval × ease_factor)
- `ease_factor` update: `ease_factor + (0.1 - (5 - rating) × (0.08 + (5 - rating) × 0.02))`
- `ease_factor` minimum: 1.3

The SM-2 logic is a pure TypeScript function — no side effects, fully unit-testable.

The Deck Detail screen shows a "due cards" count: cards where `next_review_date ≤ today`.

---

## Screens & Navigation

### Auth Flow (unauthenticated)
- **Login** — email + password, link to Sign Up
- **Sign Up** — display name + email + password, link to Login

### Main App (authenticated)
- **Deck List** — all user's decks, search/filter, create deck button, logout in header
- **Deck Detail** — cards in deck, due count, study button, add/edit/delete cards
- **Study Mode Picker** — choose Flip Cards / Multiple Choice / Type Answer; shows due card count
- **Flip Cards** — tap card to flip, rate 0–5 after reveal, progress indicator
- **Multiple Choice** — show front, 4 options (1 correct + 3 random from same deck), rate automatically on selection
- **Type Answer** — show front, text input, check on submit, fuzzy match (trim + lowercase), rate automatically
- **Session Summary** — cards reviewed, correct %, cards due tomorrow, option to review again or go home

### Modals
- **Create/Edit Deck** — name + optional description
- **Add/Edit Card** — front + back text fields

### Settings
- Accessible from Deck List header
- Change password, logout

---

## Study Mode Details

### Multiple Choice
- Requires minimum 4 cards in the deck to generate 3 distractor options
- If deck has fewer than 4 cards, fall back to Flip Card mode automatically with a notice
- Distractors pulled randomly from other cards in the same deck (using `back` values as wrong answers)
- Distractor rules: exclude the correct card's `back` value, deduplicate, shuffle all 4 options before display

### Type Answer
- Comparison: trim whitespace + lowercase both sides
- Accept as correct if exact match after normalization
- Show the correct answer after submission regardless of result

### Rating & SM-2 Integration
- Flip Cards: user manually rates 0–5
- Multiple Choice + Type Answer: auto-rated (correct = 4, incorrect = 1)

---

## Row-Level Security Policies

All tables restrict access so users can only read and write their own data.

### `profiles`
- SELECT: `id = auth.uid()`
- UPDATE: `id = auth.uid()`

### `decks`
- SELECT / INSERT / UPDATE / DELETE: `user_id = auth.uid()`

### `cards`
- SELECT / INSERT / UPDATE / DELETE: `deck_id IN (SELECT id FROM decks WHERE user_id = auth.uid())`

### `card_reviews`
- SELECT / INSERT / UPDATE / DELETE: `user_id = auth.uid()`

---

## Error Handling

- **Auth errors** — wrong password, email taken → inline message below form field
- **Network errors during study** — SM-2 already calculated locally; show toast "Couldn't save, retrying" and retry on next app focus
- **Empty states**:
  - No decks → prompt to create first deck
  - No cards in deck → prompt to add cards
  - No cards due today → "All caught up! Come back tomorrow."
- **Multiple choice fallback** — fewer than 4 cards in deck → auto-switch to flip card mode with a user-visible notice

---

## Testing

- **SM-2 algorithm** — unit tests (pure function, no dependencies)
- **Supabase queries** — integration tests against a Supabase test project (no mocking)
- **UI** — manual testing on web (browser) and mobile (Expo Go)

---

## Tech Stack Summary

| Layer | Choice |
|---|---|
| App framework | Expo (React Native + Web) |
| Language | TypeScript |
| Backend / DB | Supabase |
| Auth | Supabase Auth (email + password) |
| State management | React state + Context (no Redux) |
| Styling | React Native StyleSheet (shared where possible) |

---

## Practice Mode

**Added:** 2026-04-06

### Problem

After completing a study session, all cards are scheduled for a future date (minimum tomorrow). The app shows "All caught up!" and blocks further study. Users who want to drill cards again the same day have no way to do so.

### Solution

A Practice Mode that lets users study any card in a deck without affecting their SM-2 schedule. Practice is purely for drilling — no review data is saved.

### User Flow

1. User opens a deck → **DeckDetail** screen
2. Two buttons visible: **"Study →"** (existing) and **"Practice"** (new, secondary style)
3. Tapping "Practice" opens the new **PracticeModePicker** screen
4. At the top, a filter toggle: **"All Cards"** (default) and **"Due Today"**
5. Below, the same three mode buttons: Flip Cards, Multiple Choice, Type Answer
   - Multiple Choice still requires 4+ cards total in the deck
6. Tapping a mode launches the existing study screen with `practiceMode: true` passed as a route param
7. Session plays out normally — questions, answers, ratings — but `saveReview` is never called
8. SessionSummary screen shown at the end as usual (score + emoji)

### What Changes

**New files:**
- `src/screens/PracticeModePicker.tsx` — filter toggle + mode picker, no due-count gating

**Modified files:**
- `src/types.ts` — add `PracticeModePicker` to `MainStackParamList`; add `practiceMode: boolean` param to `FlipCards`, `MultipleChoice`, and `TypeAnswer` routes
- `src/navigation/AppNavigator.tsx` — register `PracticeModePicker` screen
- `src/screens/DeckDetailScreen.tsx` — add "Practice" button alongside "Study →"; disabled when deck has 0 cards
- `src/screens/FlipCardScreen.tsx` — skip `saveReview` when `practiceMode === true`
- `src/screens/MultipleChoiceScreen.tsx` — same
- `src/screens/TypeAnswerScreen.tsx` — same
- `src/hooks/useReviews.ts` — add `getAllCards()` helper returning all deck cards without due-date filtering

**Unchanged:** SM-2 algorithm, SessionSummaryScreen, Supabase schema / RLS

### Edge Cases

| Scenario | Behavior |
|---|---|
| Deck has 0 cards | "Practice" button disabled (same as "Study →") |
| Multiple Choice, < 4 cards | Button greyed out with "Need at least 4 cards in deck" |
| "Due Today" filter returns 0 | Show message: "No cards due today. Try 'All Cards' instead." No navigation. |
| `practiceMode === true` | `saveReview` not called — silently skipped, no toast |
| SessionSummary navigation | Works unchanged — already uses `deckId`/`deckName` params |

### Out of Scope

- Filtering by tags, difficulty, or any other criteria
- Tracking practice session history
- Cram mode (practice that does affect SM-2 scheduling)

---

## PDF Import

**Added:** 2026-04-07

### Problem

Users must manually create every flashcard one by one. For dense study material like ITPEC past exam papers (100 multiple-choice questions per exam, distributed as ZIP files with PDFs), this is impractical.

### Solution

Import ITPEC past exam ZIP files (containing question and answer PDFs) into the app, automatically creating a new deck with one flashcard per question. Cards work across all three study modes. Parsing is rule-based and runs entirely on-device — no AI/LLM API required.

### Decisions

- **Parsing:** Rule-based, on-device. ITPEC exams have a consistent format (Q1–Q100, a–d options, separate answer PDF).
- **File format:** ZIP files containing `*_Questions.pdf` and `*_Answer.pdf` (matching ITPEC distribution format).
- **Card storage:** Uses existing `front`/`back` schema — no database migration needed.
- **Figures:** Questions referencing figures are skipped in v1. The data model is ready for an optional `image_url` field later.
- **Preview:** Users review and can edit/delete extracted cards before saving.
- **URL import:** Out of scope for v1. File picker only.

### User Flow

1. User opens **DeckList** screen → taps "Import" in the header (alongside existing "+ New")
2. **ImportScreen** opens — user taps "Choose ZIP File" to pick a file via `expo-document-picker`
3. Deck name auto-fills from filename (e.g. `2024A_IP.zip` → "2024A IP"). Editable.
4. User taps "Parse PDF" — app extracts ZIP, parses both PDFs, builds card list
5. On success, navigates to **ImportPreviewScreen** showing all extracted cards
6. User reviews cards — can tap to edit or long-press to delete individual cards
7. User taps "Import X Cards" — app creates deck + bulk inserts cards
8. Navigates to the new deck's **DeckDetailScreen**

### Navigation

Two new screens added to MainStack:

```
DeckList → ImportDeck → ImportPreview → DeckDetail (of newly created deck)
```

Route additions to `MainStackParamList`:

```ts
ImportDeck: undefined;
ImportPreview: { deckName: string; cards: ParsedCard[] };
```

### Card Storage Format

Uses existing `Card` type (`front`/`back`) with no schema changes.

- **`front`**: Question text
- **`back`**: Structured string with options and correct answer:

```
a) Option one text
b) Option two text
c) Option three text
d) Option four text

Correct: a
```

**Study mode compatibility:**

- **FlipCard** — shows `front`, flips to reveal full `back` (options + answer). No changes needed.
- **MultipleChoice** — currently generates random wrong options from other cards. For imported cards (detected by `back` containing `Correct: ` pattern), parse `back` to extract the 4 embedded options and correct answer letter instead. Requires a small modification to MultipleChoiceScreen.
- **TypeAnswer** — currently compares user input to `card.back`. For imported cards, extract just the correct answer letter from the `Correct: X` line and compare against that. Requires a small modification to TypeAnswerScreen.

**Detection helper:** A utility function `parseImportedCard(back: string)` in `app/src/lib/cardUtils.ts` that checks for the `Correct: ` pattern and returns `{ options: string[], correctAnswer: string } | null`. Returns `null` for regular (non-imported) cards. Used by MultipleChoice and TypeAnswer screens.

### PDF Parser

New utility module: `app/src/lib/pdfParser.ts`

**ParsedCard type:**

```ts
type ParsedCard = {
  questionNumber: number;
  front: string;        // question text
  options: string[];    // ["a) ...", "b) ...", "c) ...", "d) ..."]
  correctAnswer: string; // "a", "b", "c", or "d"
};
```

**Parsing strategy:**

1. **Extract ZIP** — use `react-native-zip-archive` to unzip, locate `*_Questions.pdf` and `*_Answer.pdf`
2. **Extract text from Questions PDF** — use a React Native PDF text extraction library
3. **Split into questions** — regex split on `Q{number}.` pattern (`/Q(\d+)\.\s/`)
4. **Extract options** — for each question block, find `a)` through `d)` patterns
5. **Parse Answer PDF** — extract the table mapping question numbers to correct letters
6. **Merge** — match each question with its correct answer by question number
7. **Skip unparseable questions** — exclude questions where: (a) the text contains `Fig.` or `figure` (case-insensitive), indicating a diagram dependency, or (b) fewer than 4 options were extracted. Report skipped count to user.

### Screen Details

**ImportScreen:**
- Header title: "Import Deck"
- "Choose ZIP File" button — `expo-document-picker` filtered to `.zip`
- Deck name field — auto-filled from filename, editable
- "Parse PDF" button — disabled until file selected, `ActivityIndicator` + `opacity: 0.5` while parsing
- Error: parse failure or no questions → `Alert.alert()`. Some questions skipped → Toast 2.5s.

**ImportPreviewScreen:**
- Header: deck name + card count (e.g. "2024A IP — 97 cards")
- FlatList: question number, truncated question text (~80 chars), correct answer letter
- Tap to edit (modal, similar to CardModal), long-press to delete
- Fixed bottom button: "Import 97 Cards", disabled + `opacity: 0.5` while saving
- Save flow:
  1. Create deck via direct Supabase insert with `.select().single()` to get the new deck ID. Pass `user_id` from `supabase.auth.getUser()`.
  2. Bulk insert all cards in a single Supabase `.insert()` call with the new `deck_id`.
  3. On success: navigate to new deck's DeckDetailScreen.
  4. On error: `Alert.alert()` — cards stay in memory for retry.

### Dependencies

New packages needed:

- `expo-document-picker` — file selection
- `react-native-zip-archive` — ZIP extraction
- PDF text extraction library (evaluate `react-native-pdf-text` or alternatives during implementation)

### Out of Scope (v1)

- Image/figure extraction from PDFs
- URL-based import (download from URL)
- Non-ITPEC PDF formats
- Batch import of multiple ZIPs
