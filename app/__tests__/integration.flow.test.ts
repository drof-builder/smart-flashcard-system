import { renderHook, act, waitFor } from '@testing-library/react-native';

jest.mock('../src/lib/supabase');
import { mockQueryResult, mockFrom, mockGetUser, mockGetSession } from '../src/lib/supabase';

import { useDecks } from '../src/hooks/useDecks';
import { useCards } from '../src/hooks/useCards';
import { useReviews } from '../src/hooks/useReviews';

// ─── Shared fake data ───────────────────────────────────────────────────────

const DECK_ID = 'deck-1';
const USER_ID = 'user-123';

const fakeDeck = {
  id: DECK_ID,
  user_id: USER_ID,
  name: 'Biology',
  description: 'Bio deck',
  created_at: '2026-01-01T00:00:00.000Z',
};

const fakeCard1 = {
  id: 'card-1',
  deck_id: DECK_ID,
  front: 'What is DNA?',
  back: 'Deoxyribonucleic acid',
  created_at: '2026-01-01T00:00:00.000Z',
};

const fakeCard2 = {
  id: 'card-2',
  deck_id: DECK_ID,
  front: 'What is RNA?',
  back: 'Ribonucleic acid',
  created_at: '2026-01-01T00:01:00.000Z',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Queue responses onto mockQueryResult in the given order. */
function queueResponses(responses: Array<{ data: any; error: any }>) {
  responses.forEach(r => mockQueryResult.mockResolvedValueOnce(r));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Full study session flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // auth mocks return the same value every time (not consumed from queue)
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: USER_ID } } },
    });
  });

  // ── Test 1 ─────────────────────────────────────────────────────────────────
  it('Complete study cycle', async () => {
    // Queue ALL mockQueryResult responses in the exact order they will be consumed.
    //
    // Both hooks render (and their useEffects fire) before the test body awaits
    // anything, so the two mount fetches fire concurrently and resolve FIFO.
    //
    // 1.  useDecks mount  → fetchDecks          (empty)
    // 2.  useCards mount  → fetchCards           (empty)
    // 3.  createDeck      → insert
    // 4.  createDeck      → refetch fetchDecks
    // 5.  createCard(Q1)  → insert
    // 6.  createCard(Q1)  → refetch fetchCards
    // 7.  createCard(Q2)  → insert
    // 8.  createCard(Q2)  → refetch fetchCards
    // 9.  getDueCards #1  → cards query
    // 10. getDueCards #1  → card_reviews query   (no future reviews)
    // 11. saveReview      → upsert
    // 12. getDueCards #2  → cards query
    // 13. getDueCards #2  → card_reviews query   (card1 now future-dated)

    queueResponses([
      /* 1  */ { data: [], error: null },
      /* 2  */ { data: [], error: null },
      /* 3  */ { data: null, error: null },
      /* 4  */ { data: [fakeDeck], error: null },
      /* 5  */ { data: null, error: null },
      /* 6  */ { data: [fakeCard1], error: null },
      /* 7  */ { data: null, error: null },
      /* 8  */ { data: [fakeCard1, fakeCard2], error: null },
      /* 9  */ { data: [fakeCard1, fakeCard2], error: null },
      /* 10 */ { data: [], error: null },
      /* 11 */ { data: null, error: null },
      /* 12 */ { data: [fakeCard1, fakeCard2], error: null },
      /* 13 */ { data: [{ card_id: fakeCard1.id }], error: null },
    ]);

    // Render hooks — mount triggers fetchDecks (#1) and fetchCards (#2) concurrently.
    const decksHook = renderHook(() => useDecks());
    const cardsHook = renderHook(() => useCards(DECK_ID));
    const reviewsHook = renderHook(() => useReviews(DECK_ID));

    // Wait for initial fetches to settle.
    await waitFor(() => expect(decksHook.result.current.loading).toBe(false));
    await waitFor(() => expect(cardsHook.result.current.loading).toBe(false));

    // ── createDeck ────────────────────────────────────────────────────────────
    let deckError: string | null = 'pending';
    await act(async () => {
      deckError = await decksHook.result.current.createDeck('Biology', 'Bio deck');
    });

    expect(deckError).toBeNull();
    await waitFor(() =>
      expect(decksHook.result.current.decks.length).toBe(1),
    );
    expect(decksHook.result.current.decks[0].id).toBe(DECK_ID);

    // ── createCard x2 ─────────────────────────────────────────────────────────
    let cardError1: string | null = 'pending';
    await act(async () => {
      cardError1 = await cardsHook.result.current.createCard(
        'What is DNA?',
        'Deoxyribonucleic acid',
      );
    });
    expect(cardError1).toBeNull();

    let cardError2: string | null = 'pending';
    await act(async () => {
      cardError2 = await cardsHook.result.current.createCard(
        'What is RNA?',
        'Ribonucleic acid',
      );
    });
    expect(cardError2).toBeNull();

    await waitFor(() =>
      expect(cardsHook.result.current.cards.length).toBe(2),
    );

    // ── getDueCards #1 ────────────────────────────────────────────────────────
    let dueCards1: any[] = [];
    await act(async () => {
      dueCards1 = await reviewsHook.result.current.getDueCards();
    });

    expect(dueCards1.length).toBe(2);

    // ── saveReview (card1, rating=4, no existing review) ──────────────────────
    let reviewError: string | null = 'pending';
    await act(async () => {
      reviewError = await reviewsHook.result.current.saveReview(fakeCard1, 4, null);
    });

    expect(reviewError).toBeNull();

    // Verify the upsert payload via mockFrom.
    // mockFrom always returns the same shared builder object, so we pull it
    // from any result — all spy calls are recorded on the same instance.
    const builder = mockFrom.mock.results[0]?.value;
    expect(builder).toBeDefined();

    const upsertMock = builder.upsert;
    expect(upsertMock).toHaveBeenCalled();

    // Find the call that corresponds to saveReview (card_reviews upsert).
    const upsertPayload = upsertMock.mock.calls[0][0];
    expect(upsertPayload.card_id).toBe(fakeCard1.id);
    expect(upsertPayload.user_id).toBe(USER_ID);
    expect(upsertPayload.interval).toBe(1);
    expect(upsertPayload.repetitions).toBe(1);
    // rating=4: ease_factor delta = 0.1 - (5-4)*(0.08+(5-4)*0.02) = 0.1 - 0.1 = 0
    // so ease_factor stays exactly 2.5 for rating=4 (only rating=5 increases it)
    expect(upsertPayload.ease_factor).toBeCloseTo(2.5, 5);
    // next_review_date should be a valid YYYY-MM-DD string
    expect(upsertPayload.next_review_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // ── getDueCards #2 ────────────────────────────────────────────────────────
    let dueCards2: any[] = [];
    await act(async () => {
      dueCards2 = await reviewsHook.result.current.getDueCards();
    });

    expect(dueCards2.length).toBe(1);
    expect(dueCards2[0].id).toBe(fakeCard2.id);
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────────
  it('Failed review resets SM-2 state', async () => {
    // Queue only what this test needs:
    // 1. useDecks mount  → fetchDecks  (empty)
    // 2. useCards mount  → fetchCards  (empty)
    // 3. saveReview      → upsert
    queueResponses([
      /* 1 */ { data: [], error: null },
      /* 2 */ { data: [], error: null },
      /* 3 */ { data: null, error: null },
    ]);

    const decksHook = renderHook(() => useDecks());
    const cardsHook = renderHook(() => useCards(DECK_ID));
    const reviewsHook = renderHook(() => useReviews(DECK_ID));

    await waitFor(() => expect(decksHook.result.current.loading).toBe(false));
    await waitFor(() => expect(cardsHook.result.current.loading).toBe(false));

    const existingReview = {
      id: 'review-1',
      card_id: fakeCard1.id,
      user_id: USER_ID,
      ease_factor: 2.5,
      interval: 10,
      repetitions: 5,
      next_review_date: '2026-01-10',
      last_reviewed_at: '2026-01-09T00:00:00.000Z',
    };

    let reviewError: string | null = 'pending';
    await act(async () => {
      reviewError = await reviewsHook.result.current.saveReview(fakeCard1, 2, existingReview);
    });

    expect(reviewError).toBeNull();

    // Inspect upsert payload — rating < 3 should reset interval=1, repetitions=0
    const builder = mockFrom.mock.results[0]?.value;
    const upsertMock = builder.upsert;
    expect(upsertMock).toHaveBeenCalled();

    const upsertPayload = upsertMock.mock.calls[0][0];
    expect(upsertPayload.interval).toBe(1);
    expect(upsertPayload.repetitions).toBe(0);
  });
});
