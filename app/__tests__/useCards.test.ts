jest.mock('../src/lib/supabase');

import { renderHook, waitFor, act } from '@testing-library/react-native';
import { useCards } from '../src/hooks/useCards';
// Import mock helpers from the mocked module itself so we get the same instance Jest uses
import { mockQueryResult, mockFrom } from '../src/lib/supabase';

const _mockQueryResult = mockQueryResult as jest.Mock;
const _mockFrom = mockFrom as jest.Mock;

const sampleCard = {
  id: 'c1',
  deck_id: 'deck-1',
  front: 'Q',
  back: 'A',
  created_at: '2024-01-01',
};

beforeEach(() => {
  jest.clearAllMocks();
  _mockQueryResult.mockResolvedValue({ data: [], error: null });
});

describe('useCards', () => {
  describe('fetchCards', () => {
    it('1. fetches cards on mount (mockFrom called with "cards")', async () => {
      const { result } = renderHook(() => useCards('deck-1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(_mockFrom).toHaveBeenCalledWith('cards');
    });

    it('2. sets cards state from returned data', async () => {
      _mockQueryResult.mockResolvedValueOnce({ data: [sampleCard], error: null });

      const { result } = renderHook(() => useCards('deck-1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.cards).toHaveLength(1);
      expect(result.current.cards[0]).toEqual(sampleCard);
    });

    it('3. sets loading to false after fetch', async () => {
      const { result } = renderHook(() => useCards('deck-1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.loading).toBe(false);
    });

    it('4. sets error when query fails', async () => {
      _mockQueryResult.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });

      const { result } = renderHook(() => useCards('deck-1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).not.toBeNull();
      expect(result.current.error).toBe('fail');
    });
  });

  describe('createCard', () => {
    it('5. calls mockFrom with "cards" when inserting', async () => {
      // fetchCards on mount
      _mockQueryResult.mockResolvedValueOnce({ data: [], error: null });
      // insert
      _mockQueryResult.mockResolvedValueOnce({ data: null, error: null });
      // refetch after insert
      _mockQueryResult.mockResolvedValueOnce({ data: [], error: null });

      const { result } = renderHook(() => useCards('deck-1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.createCard('Front', 'Back');
      });

      const calls = _mockFrom.mock.calls.map((c: any[]) => c[0]);
      expect(calls).toContain('cards');
    });

    it('6. returns null on success', async () => {
      // fetchCards on mount
      _mockQueryResult.mockResolvedValueOnce({ data: [], error: null });
      // insert
      _mockQueryResult.mockResolvedValueOnce({ data: null, error: null });
      // refetch after insert
      _mockQueryResult.mockResolvedValueOnce({ data: [], error: null });

      const { result } = renderHook(() => useCards('deck-1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      let returnValue: string | null = 'not-set';
      await act(async () => {
        returnValue = await result.current.createCard('Front', 'Back');
      });

      expect(returnValue).toBeNull();
    });

    it('7. returns error message on failure', async () => {
      // fetchCards on mount
      _mockQueryResult.mockResolvedValueOnce({ data: [], error: null });
      // insert returns error
      _mockQueryResult.mockResolvedValueOnce({ data: null, error: { message: 'insert failed' } });

      const { result } = renderHook(() => useCards('deck-1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      let returnValue: string | null = null;
      await act(async () => {
        returnValue = await result.current.createCard('Front', 'Back');
      });

      expect(returnValue).toBe('insert failed');
    });
  });

  describe('updateCard', () => {
    it('8. returns null on success', async () => {
      // fetchCards on mount
      _mockQueryResult.mockResolvedValueOnce({ data: [], error: null });
      // update
      _mockQueryResult.mockResolvedValueOnce({ data: null, error: null });
      // refetch after update
      _mockQueryResult.mockResolvedValueOnce({ data: [], error: null });

      const { result } = renderHook(() => useCards('deck-1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      let returnValue: string | null = 'not-set';
      await act(async () => {
        returnValue = await result.current.updateCard('c1', 'New Front', 'New Back');
      });

      expect(returnValue).toBeNull();
    });

    it('9. returns error on failure', async () => {
      // fetchCards on mount
      _mockQueryResult.mockResolvedValueOnce({ data: [], error: null });
      // update returns error
      _mockQueryResult.mockResolvedValueOnce({ data: null, error: { message: 'update failed' } });

      const { result } = renderHook(() => useCards('deck-1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      let returnValue: string | null = null;
      await act(async () => {
        returnValue = await result.current.updateCard('c1', 'New Front', 'New Back');
      });

      expect(returnValue).toBe('update failed');
    });
  });

  describe('deleteCard', () => {
    it('10. returns null on success', async () => {
      // fetchCards on mount
      _mockQueryResult.mockResolvedValueOnce({ data: [], error: null });
      // delete
      _mockQueryResult.mockResolvedValueOnce({ data: null, error: null });
      // refetch after delete
      _mockQueryResult.mockResolvedValueOnce({ data: [], error: null });

      const { result } = renderHook(() => useCards('deck-1'));
      await waitFor(() => expect(result.current.loading).toBe(false));

      let returnValue: string | null = 'not-set';
      await act(async () => {
        returnValue = await result.current.deleteCard('c1');
      });

      expect(returnValue).toBeNull();
    });
  });
});
