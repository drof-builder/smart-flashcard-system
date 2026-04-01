# Smart Flashcard System

React Native/Expo spaced repetition app. Supabase backend (auth, DB, RLS). TypeScript throughout. Functional components + hooks only — no class components.

## Navigation
Two stacks:
- AuthStack: Login → SignUp
- MainStack: DeckList → DeckDetail → StudyModePicker → [FlipCard | MultipleChoice | TypeAnswer] → SessionSummary
- Settings accessible from DeckList header

When adding a new screen: add route to AppNavigator.tsx AND param types to types.ts.

SessionSummary uses `navigation.replace()` not `push` — prevents back button returning into study session.

## Hooks
- `useDecks()` — deck CRUD, no params
- `useCards(deckId)` — card CRUD for a specific deck
- `useReviews(deckId)` — SM-2 review logic for a specific deck

Reads rely on RLS — do NOT add `.eq('user_id', ...)` on selects.
Always pass `user_id` explicitly on inserts (fetch via `supabase.auth.getUser()` first).

## Database Critical Details
- `profiles` auto-created on signup via `handle_new_user()` trigger — never insert manually
- `card_reviews` has UNIQUE(card_id, user_id) — always upsert with `onConflict('card_id,user_id')`
- Due cards query: cards with NO review row are always due (treated as next_review_date = today)

## SM-2 Algorithm
- Rating scale: integers 0–5 only
- Fail threshold: `rating < 3` (not <= 3)
- New card defaults: ease_factor=2.5, interval=0, repetitions=0
- Dates: always use UTC — `setUTCDate()` and `.toISOString().split('T')[0]`

## Study Mode Constraints
- FlipCard: any number of cards, user rates 0–5
- MultipleChoice: requires `allCards.length >= 4` (not dueCards), auto-rates 4=correct/1=incorrect
- TypeAnswer: normalization is `trim().toLowerCase()` only — no punctuation/accent stripping. Don't change without updating tests.
- SessionSummary: emoji 🎉 ≥80%, 👍 ≥50%, 💪 <50%

## Error Handling Pattern
- Async mutations: try/catch/finally, return `string | null` (null = success)
- Disable buttons during async ops (`isSaving`/`loading` flag + `opacity: 0.5`)
- Non-blocking feedback: Toast (auto-dismiss 2.5s)
- Critical errors: Alert.alert()

## Tests
- Runner: Jest with jest-expo preset (`npm test` inside /app)
- Location: `app/__tests__/`
- Currently tested: SM-2 algorithm only (11 tests)
- NOT tested: screens, hooks (no Supabase mock set up yet)
