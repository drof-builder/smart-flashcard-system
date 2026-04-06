jest.mock('../src/lib/supabase');
// Import helpers from the real module path — Jest serves the manual mock via this path
import { mockQueryResult, mockFrom, mockGetSession } from '../src/lib/supabase';
import { renderHook, act } from '@testing-library/react-native';
import { useReviews } from '../src/hooks/useReviews';
import { CardReview } from '../src/types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeCard = (id: string) => ({
  id,
  deck_id: 'deck-1',
  front: `Q${id}`,
  back: `A${id}`,
  created_at: '2024-01-01T00:00:00Z',
});
const card1 = makeCard('c1');
const card2 = makeCard('c2');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Call getDueCards and return the result */
async function callGetDueCards(hook: ReturnType<typeof useReviews>) {
  let dueCards: any[] = [];
  await act(async () => {
    dueCards = await hook.getDueCards();
  });
  return dueCards;
}

/** Call saveReview and return the result */
async function callSaveReview(
  hook: ReturnType<typeof useReviews>,
  card: any,
  rating: number,
  existingReview: CardReview | null,
) {
  let returnValue: string | null = 'not-set';
  await act(async () => {
    returnValue = await hook.saveReview(card, rating, existingReview);
  });
  return returnValue;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useReviews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryResult.mockResolvedValue({ data: [], error: null });
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-123' } } },
    });
  });

  // ─── getDueCards ───────────────────────────────────────────────────────────

  describe('getDueCards', () => {
    it('1. returns empty array when cards query returns empty data', async () => {
      // cards → empty
      mockQueryResult.mockResolvedValueOnce({ data: [], error: null });

      const { result } = renderHook(() => useReviews('deck-1'));
      const dueCards = await callGetDueCards(result.current);

      expect(dueCards).toHaveLength(0);
    });

    it('2. returns empty array when session has no user', async () => {
      // cards → [card1]
      mockQueryResult.mockResolvedValueOnce({ data: [card1], error: null });
      // session → no user
      mockGetSession.mockResolvedValueOnce({ data: { session: null } });

      const { result } = renderHook(() => useReviews('deck-1'));
      const dueCards = await callGetDueCards(result.current);

      expect(dueCards).toHaveLength(0);
    });

    it('3. returns all cards when no card_reviews exist', async () => {
      // cards → [card1, card2]
      mockQueryResult.mockResolvedValueOnce({ data: [card1, card2], error: null });
      // card_reviews → []
      mockQueryResult.mockResolvedValueOnce({ data: [], error: null });

      const { result } = renderHook(() => useReviews('deck-1'));
      const dueCards = await callGetDueCards(result.current);

      expect(dueCards).toHaveLength(2);
      expect(dueCards).toEqual(expect.arrayContaining([card1, card2]));
    });

    it('4. excludes cards with a future next_review_date', async () => {
      // cards → [card1, card2]
      mockQueryResult.mockResolvedValueOnce({ data: [card1, card2], error: null });
      // card_reviews → c1 has a future review
      mockQueryResult.mockResolvedValueOnce({ data: [{ card_id: 'c1' }], error: null });

      const { result } = renderHook(() => useReviews('deck-1'));
      const dueCards = await callGetDueCards(result.current);

      expect(dueCards).toHaveLength(1);
      expect(dueCards[0].id).toBe('c2');
    });

    it('5. returns all cards when card_reviews data is null', async () => {
      // cards → [card1, card2]
      mockQueryResult.mockResolvedValueOnce({ data: [card1, card2], error: null });
      // card_reviews → null (treated as empty)
      mockQueryResult.mockResolvedValueOnce({ data: null, error: null });

      const { result } = renderHook(() => useReviews('deck-1'));
      const dueCards = await callGetDueCards(result.current);

      expect(dueCards).toHaveLength(2);
    });

    it('6. returns empty array when cards query returns an error', async () => {
      // cards → error
      mockQueryResult.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

      const { result } = renderHook(() => useReviews('deck-1'));
      const dueCards = await callGetDueCards(result.current);

      expect(dueCards).toHaveLength(0);
    });
  });

  // ─── saveReview ────────────────────────────────────────────────────────────

  describe('saveReview', () => {
    it('7. upserts with correct SM-2 result fields', async () => {
      // getSession success (default mock)
      // upsert success
      mockQueryResult.mockResolvedValueOnce({ data: null, error: null });

      const { result } = renderHook(() => useReviews('deck-1'));
      await callSaveReview(result.current, card1, 4, null);

      // The builder is the shared singleton returned by mockFrom
      const builder = mockFrom.mock.results[0].value;
      expect(mockFrom).toHaveBeenCalledWith('card_reviews');

      const upsertCall = builder.upsert.mock.calls[0];
      expect(upsertCall).toBeDefined();

      const payload = upsertCall[0];
      expect(payload.card_id).toBe('c1');
      expect(payload.user_id).toBe('user-123');
      expect(payload).toHaveProperty('interval');
      expect(payload).toHaveProperty('repetitions');
      expect(payload).toHaveProperty('ease_factor');
      expect(payload).toHaveProperty('next_review_date');
    });

    it('8. uses onConflict: "card_id,user_id" in upsert options', async () => {
      mockQueryResult.mockResolvedValueOnce({ data: null, error: null });

      const { result } = renderHook(() => useReviews('deck-1'));
      await callSaveReview(result.current, card1, 4, null);

      const builder = mockFrom.mock.results[0].value;
      const upsertOptions = builder.upsert.mock.calls[0][1];
      expect(upsertOptions).toEqual({ onConflict: 'card_id,user_id' });
    });

    it('9. uses existingReview as base when provided (not default values)', async () => {
      mockQueryResult.mockResolvedValueOnce({ data: null, error: null });

      const existingReview: CardReview = {
        id: 'rev-1',
        card_id: 'c1',
        user_id: 'user-123',
        ease_factor: 2.0,
        interval: 5,
        repetitions: 3,
        next_review_date: '2024-01-10',
        last_reviewed_at: '2024-01-04T00:00:00Z',
      };

      const { result } = renderHook(() => useReviews('deck-1'));
      await callSaveReview(result.current, card1, 4, existingReview);

      const builder = mockFrom.mock.results[0].value;
      const payload = builder.upsert.mock.calls[0][0];

      // With existingReview: repetitions=3 → goes to Math.round(interval * ease_factor) branch
      // interval = Math.round(5 * 2.0) = 10, repetitions = 4
      expect(payload.repetitions).toBe(4);
      expect(payload.interval).toBe(10);
    });

    it('10. default SM-2 values on first review (no existingReview)', async () => {
      mockQueryResult.mockResolvedValueOnce({ data: null, error: null });

      const { result } = renderHook(() => useReviews('deck-1'));
      await callSaveReview(result.current, card1, 4, null);

      const builder = mockFrom.mock.results[0].value;
      const payload = builder.upsert.mock.calls[0][0];

      // First review: ease=2.5, interval=0, reps=0 → rating>=3, reps becomes 1 → interval=1
      expect(payload.interval).toBe(1);
      expect(payload.repetitions).toBe(1);
    });

    it('11. returns null on success', async () => {
      mockQueryResult.mockResolvedValueOnce({ data: null, error: null });

      const { result } = renderHook(() => useReviews('deck-1'));
      const returnValue = await callSaveReview(result.current, card1, 4, null);

      expect(returnValue).toBeNull();
    });

    it('12. returns error string when session has no user', async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } });

      const { result } = renderHook(() => useReviews('deck-1'));
      const returnValue = await callSaveReview(result.current, card1, 4, null);

      expect(returnValue).not.toBeNull();
      expect(typeof returnValue).toBe('string');
    });

    it('13. returns error message when upsert fails', async () => {
      // getSession success (default mock)
      // upsert fails
      mockQueryResult.mockResolvedValueOnce({ data: null, error: { message: 'Upsert failed' } });

      const { result } = renderHook(() => useReviews('deck-1'));
      const returnValue = await callSaveReview(result.current, card1, 4, null);

      expect(returnValue).toBe('Upsert failed');
    });
  });

  describe('getAllCards', () => {
    it('returns all cards in the deck without due-date filtering', async () => {
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
});
