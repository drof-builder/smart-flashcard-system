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
