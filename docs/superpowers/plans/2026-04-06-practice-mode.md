# Practice Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Practice Mode that lets users drill all cards in a deck without affecting their SM-2 spaced repetition schedule.

**Architecture:** A "Practice" button on DeckDetail opens a new PracticeModePicker screen with a filter toggle ("All Cards" / "Due Today"). Selecting a study mode passes `practiceMode: true` through route params to the existing study screens, which skip `saveReview` when that flag is set. A new `getAllCards()` helper in `useReviews` fetches all deck cards without due-date filtering.

**Tech Stack:** React Native (Expo), TypeScript, React Navigation (native stack), Supabase

---

### Task 1: Extend types and register route

**Files:**
- Modify: `app/src/types.ts`
- Modify: `app/src/navigation/AppNavigator.tsx`

- [ ] **Step 1: Add PracticeModePicker route and practiceMode param to study routes in `app/src/types.ts`**

Replace the `MainStackParamList` type with:

```typescript
export type MainStackParamList = {
  DeckList: undefined;
  DeckDetail: { deckId: string; deckName: string };
  StudyModePicker: { deckId: string; deckName: string };
  PracticeModePicker: { deckId: string; deckName: string };
  FlipCards: { deckId: string; deckName: string; practiceMode?: boolean };
  MultipleChoice: { deckId: string; deckName: string; practiceMode?: boolean };
  TypeAnswer: { deckId: string; deckName: string; practiceMode?: boolean };
  SessionSummary: { result: SessionResult; deckId: string; deckName: string };
  Settings: undefined;
};
```

- [ ] **Step 2: Register PracticeModePicker in `app/src/navigation/AppNavigator.tsx`**

Add the import after the existing screen imports:

```typescript
import PracticeModePickerScreen from '../screens/PracticeModePickerScreen';
```

Add the screen inside `MainNavigator`, after the `StudyModePicker` screen entry:

```tsx
<MainStack.Screen name="PracticeModePicker" component={PracticeModePickerScreen} options={{ title: 'Practice Mode' }} />
```

- [ ] **Step 3: Commit**

```bash
git add app/src/types.ts app/src/navigation/AppNavigator.tsx
git commit -m "feat: add PracticeModePicker route and practiceMode param to types"
```

---

### Task 2: Add getAllCards() to useReviews

**Files:**
- Modify: `app/src/hooks/useReviews.ts`
- Test: `app/__tests__/useReviews.test.ts`

- [ ] **Step 1: Write the failing test**

Open `app/__tests__/useReviews.test.ts` and add this describe block at the end (before the closing of the file):

```typescript
describe('getAllCards', () => {
  it('returns all cards in the deck without due-date filtering', async () => {
    // fetchCards response
    mockQueryResult.mockResolvedValueOnce({
      data: [
        { id: 'c1', deck_id: 'deck-1', front: 'Q1', back: 'A1', created_at: '2026-01-01' },
        { id: 'c2', deck_id: 'deck-1', front: 'Q2', back: 'A2', created_at: '2026-01-01' },
      ],
      error: null,
    });

    const { result } = renderHook(() => useReviews('deck-1'));
    let cards: any[] = [];
    await act(async () => {
      cards = await result.current.getAllCards();
    });

    expect(cards).toHaveLength(2);
    expect(cards[0].id).toBe('c1');
    expect(cards[1].id).toBe('c2');
  });

  it('returns empty array when supabase returns an error', async () => {
    mockQueryResult.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

    const { result } = renderHook(() => useReviews('deck-1'));
    let cards: any[] = [];
    await act(async () => {
      cards = await result.current.getAllCards();
    });

    expect(cards).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd app && npm test -- --testPathPattern="useReviews" --no-coverage
```

Expected: FAIL — `result.current.getAllCards is not a function`

- [ ] **Step 3: Add getAllCards() to `app/src/hooks/useReviews.ts`**

Add this `useCallback` inside the `useReviews` function body, after `getReviewForCard` and before the return statement:

```typescript
const getAllCards = useCallback(async (): Promise<Card[]> => {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('deck_id', deckId);

  if (error || !data) return [];
  return data;
}, [deckId]);
```

Add `getAllCards` to the return object:

```typescript
return { getDueCards, getDueCount, getReviewForCard, saveReview, getAllCards };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd app && npm test -- --testPathPattern="useReviews" --no-coverage
```

Expected: PASS — all useReviews tests green

- [ ] **Step 5: Commit**

```bash
git add app/src/hooks/useReviews.ts app/__tests__/useReviews.test.ts
git commit -m "feat: add getAllCards helper to useReviews"
```

---

### Task 3: Create PracticeModePickerScreen

**Files:**
- Create: `app/src/screens/PracticeModePickerScreen.tsx`

This screen shows a filter toggle ("All Cards" / "Due Today") and three study mode buttons. It calls `getAllCards()` or `getDueCards()` depending on the filter, then navigates to the selected study screen with `practiceMode: true`.

- [ ] **Step 1: Create `app/src/screens/PracticeModePickerScreen.tsx`**

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { MainStackParamList } from '../types';
import { useReviews } from '../hooks/useReviews';
import { useCards } from '../hooks/useCards';

type Props = {
  navigation: NativeStackNavigationProp<MainStackParamList, 'PracticeModePicker'>;
  route: RouteProp<MainStackParamList, 'PracticeModePicker'>;
};

type Filter = 'all' | 'due';

export default function PracticeModePickerScreen({ navigation, route }: Props) {
  const { deckId, deckName } = route.params;
  const { getAllCards, getDueCards } = useReviews(deckId);
  const { cards } = useCards(deckId);
  const [filter, setFilter] = useState<Filter>('all');
  const [cardCount, setCardCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const fetch = filter === 'all' ? getAllCards : getDueCards;
    fetch()
      .then(c => { setCardCount(c.length); setLoading(false); })
      .catch(() => { setCardCount(0); setLoading(false); });
  }, [filter, getAllCards, getDueCards]);

  const canMultipleChoice = cards.length >= 4;

  const navigate = (mode: 'FlipCards' | 'MultipleChoice' | 'TypeAnswer') => {
    navigation.navigate(mode, { deckId, deckName, practiceMode: true });
  };

  if (loading) return <ActivityIndicator style={{ flex: 1 }} size="large" color="#6366f1" />;

  return (
    <View style={styles.container}>
      <Text style={styles.deckName}>{deckName}</Text>

      {/* Filter toggle */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'all' && styles.filterBtnActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterBtnText, filter === 'all' && styles.filterBtnTextActive]}>
            All Cards
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterBtn, filter === 'due' && styles.filterBtnActive]}
          onPress={() => setFilter('due')}
        >
          <Text style={[styles.filterBtnText, filter === 'due' && styles.filterBtnTextActive]}>
            Due Today
          </Text>
        </TouchableOpacity>
      </View>

      {cardCount === 0 && filter === 'due' ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No cards due today. Try "All Cards" instead.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.countText}>{cardCount} card{cardCount !== 1 ? 's' : ''} selected</Text>

          <TouchableOpacity style={styles.modeBtn} onPress={() => navigate('FlipCards')}>
            <Text style={styles.modeIcon}>🃏</Text>
            <View style={styles.modeInfo}>
              <Text style={styles.modeName}>Flip Cards</Text>
              <Text style={styles.modeDesc}>Tap to reveal, then rate your recall</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeBtn, !canMultipleChoice && styles.modeBtnDisabled]}
            disabled={!canMultipleChoice}
            onPress={() => navigate('MultipleChoice')}
          >
            <Text style={styles.modeIcon}>🔘</Text>
            <View style={styles.modeInfo}>
              <Text style={styles.modeName}>Multiple Choice</Text>
              <Text style={styles.modeDesc}>
                {canMultipleChoice ? '4 options, pick the correct one' : 'Need at least 4 cards in deck'}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modeBtn} onPress={() => navigate('TypeAnswer')}>
            <Text style={styles.modeIcon}>⌨️</Text>
            <View style={styles.modeInfo}>
              <Text style={styles.modeName}>Type Answer</Text>
              <Text style={styles.modeDesc}>Type the answer from memory</Text>
            </View>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#f9fafb' },
  deckName: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  filterRow: { flexDirection: 'row', backgroundColor: '#e5e7eb', borderRadius: 8, padding: 4, marginBottom: 20 },
  filterBtn: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  filterBtnActive: { backgroundColor: '#fff', elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2 },
  filterBtnText: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  filterBtnTextActive: { color: '#6366f1' },
  emptyBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#6b7280', fontSize: 16, textAlign: 'center' },
  countText: { color: '#f59e0b', fontWeight: '600', fontSize: 15, marginBottom: 24 },
  modeBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 16, gap: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  modeBtnDisabled: { opacity: 0.4 },
  modeIcon: { fontSize: 32 },
  modeInfo: { flex: 1 },
  modeName: { fontSize: 18, fontWeight: '600' },
  modeDesc: { color: '#6b7280', marginTop: 2, fontSize: 14 },
});
```

- [ ] **Step 2: Verify TypeScript compiles (no red errors in editor or via tsc)**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/src/screens/PracticeModePickerScreen.tsx
git commit -m "feat: add PracticeModePickerScreen with filter toggle"
```

---

### Task 4: Add Practice button to DeckDetailScreen

**Files:**
- Modify: `app/src/screens/DeckDetailScreen.tsx`

- [ ] **Step 1: Add the Practice button in `app/src/screens/DeckDetailScreen.tsx`**

In the header `View` (the one with `styles.header`), add a "Practice" button after the "Study →" button:

```tsx
<TouchableOpacity
  style={[styles.practiceBtn, cards.length === 0 && styles.studyBtnDisabled]}
  disabled={cards.length === 0}
  onPress={() => navigation.navigate('PracticeModePicker', { deckId, deckName })}
>
  <Text style={styles.practiceBtnText}>Practice</Text>
</TouchableOpacity>
```

Add these two entries to the `StyleSheet.create` call at the bottom:

```typescript
practiceBtn: { marginLeft: 8, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#6366f1', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
practiceBtnText: { color: '#6366f1', fontWeight: 'bold' },
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/src/screens/DeckDetailScreen.tsx
git commit -m "feat: add Practice button to DeckDetailScreen"
```

---

### Task 5: Skip saveReview in study screens when practiceMode is true

**Files:**
- Modify: `app/src/screens/FlipCardScreen.tsx`
- Modify: `app/src/screens/MultipleChoiceScreen.tsx`
- Modify: `app/src/screens/TypeAnswerScreen.tsx`

#### FlipCardScreen

- [ ] **Step 1: Read practiceMode from route params in `app/src/screens/FlipCardScreen.tsx`**

In the destructure of `route.params`, add `practiceMode`:

```typescript
const { deckId, deckName, practiceMode } = route.params;
```

- [ ] **Step 2: Skip saveReview when practiceMode is true**

In `handleRate`, replace:

```typescript
const existing = await getReviewForCard(card.id);
const saveError = await saveReview(card, rating, existing);
if (saveError) setToastMessage("Couldn't save review. Will retry next session.");
```

With:

```typescript
if (!practiceMode) {
  const existing = await getReviewForCard(card.id);
  const saveError = await saveReview(card, rating, existing);
  if (saveError) setToastMessage("Couldn't save review. Will retry next session.");
}
```

#### MultipleChoiceScreen

- [ ] **Step 3: Read practiceMode from route params in `app/src/screens/MultipleChoiceScreen.tsx`**

In the destructure of `route.params`, add `practiceMode`:

```typescript
const { deckId, deckName, practiceMode } = route.params;
```

- [ ] **Step 4: Skip saveReview when practiceMode is true**

In `handleSelect`, replace:

```typescript
const existing = await getReviewForCard(card.id);
const saveError = await saveReview(card, rating, existing);
if (saveError) setToastMessage("Couldn't save review. Will retry next session.");
```

With:

```typescript
if (!practiceMode) {
  const existing = await getReviewForCard(card.id);
  const saveError = await saveReview(card, rating, existing);
  if (saveError) setToastMessage("Couldn't save review. Will retry next session.");
}
```

#### TypeAnswerScreen

- [ ] **Step 5: Read practiceMode from route params in `app/src/screens/TypeAnswerScreen.tsx`**

In the destructure of `route.params`, add `practiceMode`:

```typescript
const { deckId, deckName, practiceMode } = route.params;
```

- [ ] **Step 6: Skip saveReview when practiceMode is true**

In `handleSubmit`, replace:

```typescript
const existing = await getReviewForCard(card.id);
const saveError = await saveReview(card, rating, existing);
if (saveError) setToastMessage("Couldn't save review. Will retry next session.");
```

With:

```typescript
if (!practiceMode) {
  const existing = await getReviewForCard(card.id);
  const saveError = await saveReview(card, rating, existing);
  if (saveError) setToastMessage("Couldn't save review. Will retry next session.");
}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd app && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 8: Run full test suite**

```bash
cd app && npm test
```

Expected: all 91+ tests pass (existing tests unchanged — practiceMode defaults to undefined which is falsy, so save logic is still exercised)

- [ ] **Step 9: Commit**

```bash
git add app/src/screens/FlipCardScreen.tsx app/src/screens/MultipleChoiceScreen.tsx app/src/screens/TypeAnswerScreen.tsx
git commit -m "feat: skip saveReview in study screens when practiceMode is true"
```

---

### Task 6: Manual smoke test

- [ ] **Step 1: Start the app**

```bash
cd app && npx expo start
```

- [ ] **Step 2: Verify Practice button appears on DeckDetail**

Open any deck. Confirm both "Study →" and "Practice" buttons are visible in the header row. Confirm "Practice" is greyed out (disabled) if the deck has 0 cards.

- [ ] **Step 3: Verify PracticeModePicker filter toggle**

Tap "Practice". Confirm "All Cards" is selected by default. Confirm card count shown in amber. Tap "Due Today" — if no cards due, confirm the "No cards due today. Try 'All Cards' instead." message appears. Switch back to "All Cards" — confirm mode buttons reappear.

- [ ] **Step 4: Verify practice session does not affect schedule**

Note the `next_review_date` of a card in Supabase (or by checking due count on DeckDetail). Complete a full practice session in Flip Cards mode rating all cards 5. Return to DeckDetail — confirm the due count is unchanged. Confirm the card's `next_review_date` in Supabase is unchanged.

- [ ] **Step 5: Verify SessionSummary navigation works after practice**

After a practice session, confirm "Back to Deck" and "Study Again" buttons both navigate correctly.
