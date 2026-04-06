# Practice Mode — Design Spec

**Date:** 2026-04-06  
**Status:** Approved

---

## Problem

After completing a study session, all cards are scheduled for a future date (minimum tomorrow). The app shows "All caught up!" and blocks further study. Users who want to drill cards again the same day have no way to do so.

---

## Solution

Add a Practice Mode that lets users study any card in a deck without affecting their SM-2 schedule. Practice is purely for drilling — no review data is saved.

---

## User Flow

1. User opens a deck → **DeckDetail** screen
2. Two buttons visible: **"Study →"** (existing) and **"Practice"** (new, secondary style)
3. Tapping "Practice" opens the new **PracticeModePicker** screen
4. At the top, a filter toggle with two options — **"All Cards"** (default) and **"Due Today"**
5. Below, the same three mode buttons: Flip Cards, Multiple Choice, Type Answer
   - Multiple Choice still requires 4+ cards total in the deck
6. Tapping a mode launches the existing study screen with `practiceMode: true` passed as a route param
7. Session plays out normally — questions, answers, ratings — but `saveReview` is never called
8. SessionSummary screen shown at the end as usual (score + emoji)

---

## What Changes

### New files
- `src/screens/PracticeModePicker.tsx` — filter toggle + mode picker, no due-count gating

### Modified files
- `src/types.ts` — add `PracticeModePicker` to `MainStackParamList`; add `practiceMode: boolean` param to `FlipCards`, `MultipleChoice`, and `TypeAnswer` routes
- `src/navigation/AppNavigator.tsx` — register `PracticeModePicker` screen
- `src/screens/DeckDetailScreen.tsx` — add "Practice" button alongside "Study →"; disabled when deck has 0 cards
- `src/screens/FlipCardScreen.tsx` — skip `saveReview` when `practiceMode === true`
- `src/screens/MultipleChoiceScreen.tsx` — same
- `src/screens/TypeAnswerScreen.tsx` — same
- `src/hooks/useReviews.ts` — add `getAllCards()` helper that returns all cards in the deck without due-date filtering

### Unchanged
- SM-2 algorithm (`sm2.ts`)
- `SessionSummaryScreen`
- Supabase schema / RLS

---

## Edge Cases & Error Handling

| Scenario | Behavior |
|---|---|
| Deck has 0 cards | "Practice" button disabled (same as "Study →") |
| Multiple Choice, < 4 cards | Button greyed out with "Need at least 4 cards in deck" |
| "Due Today" filter returns 0 | Show message: "No cards due today. Try 'All Cards' instead." No navigation. |
| `practiceMode === true` | `saveReview` is not called — silently skipped, no toast |
| SessionSummary "Back to Deck" / "Study Again" | Work unchanged — already use `deckId`/`deckName` params |

---

## Out of Scope

- Filtering by tags, difficulty, or any other criteria
- Tracking practice session history
- Cram mode (practice that does affect SM-2 scheduling)
